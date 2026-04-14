/**
 * STOCKIA Billing Service
 * ======================
 * Node.js microservice for AFIP electronic invoicing.
 *
 * Responsibilities:
 * - Generate RSA 2048 key pair + CSR (OpenSSL-compatible)
 * - WSAA: Generate TRA, sign CMS/PKCS#7, obtain Token+Sign
 * - WSFEv1: FECompUltimoAutorizado + FECAESolicitar
 * - Generate professional A4 PDF (Factura A/B/C)
 * - Return CAE + PDF base64 to the Edge Function
 *
 * Endpoints:
 *   GET  /health
 *   POST /generate-csr     { cuit, razon_social, enc_key }
 *   POST /test-connection   { business_id, env, supabase_url, supabase_service_key, enc_key }
 *   POST /authorize         { business_id, env, supabase_url, supabase_service_key, enc_key, invoice, fiscal_settings }
 */

const express = require('express')
const cors = require('cors')
const forge = require('node-forge')
const soap = require('soap')
const crypto = require('crypto')
const { createClient } = require('@supabase/supabase-js')
const { generateInvoicePDF } = require('./pdf')

const app = express()
app.use(cors())
app.use(express.json({ limit: '10mb' }))

const PORT = process.env.PORT || 3001
const SERVICE_KEY = process.env.BILLING_SERVICE_KEY || ''

// ============================================================
// Auth middleware
// ============================================================
function authMiddleware(req, res, next) {
  if (SERVICE_KEY && req.headers['x-service-key'] !== SERVICE_KEY) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
}

// ============================================================
// AFIP URLs
// ============================================================
const AFIP_URLS = {
  homo: {
    wsaa: 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms?WSDL',
    wsfe: 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx?WSDL',
  },
  prod: {
    wsaa: 'https://wsaa.afip.gov.ar/ws/services/LoginCms?WSDL',
    wsfe: 'https://servicios1.afip.gov.ar/wsfev1/service.asmx?WSDL',
  },
}

// ============================================================
// Crypto helpers
// ============================================================

/**
 * Encrypt private key with AES-256-GCM
 */
function encryptPrivateKey(privateKeyPem, encKey) {
  const key = crypto.createHash('sha256').update(encKey).digest()
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  let encrypted = cipher.update(privateKeyPem, 'utf8', 'base64')
  encrypted += cipher.final('base64')
  const tag = cipher.getAuthTag()
  // Format: iv:tag:ciphertext (all base64)
  return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted}`
}

/**
 * Decrypt private key from AES-256-GCM
 */
function decryptPrivateKey(encryptedStr, encKey) {
  const key = crypto.createHash('sha256').update(encKey).digest()
  const [ivB64, tagB64, ciphertext] = encryptedStr.split(':')
  const iv = Buffer.from(ivB64, 'base64')
  const tag = Buffer.from(tagB64, 'base64')
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  let decrypted = decipher.update(ciphertext, 'base64', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

// ============================================================
// WSAA: Token + Sign
// ============================================================

// Cache tokens per business+env
const tokenCache = {}

function getTokenCacheKey(businessId, env) {
  return `${businessId}:${env}`
}

/**
 * Generate TRA XML (Ticket de Requerimiento de Acceso)
 */
function generateTRA(service = 'wsfe') {
  const now = new Date()
  const expiration = new Date(now.getTime() + 12 * 60 * 60 * 1000) // 12h

  const formatDate = (d) => d.toISOString().replace(/\.\d{3}Z$/, '-03:00')

  return `<?xml version="1.0" encoding="UTF-8" ?>
<loginTicketRequest version="1.0">
  <header>
    <uniqueId>${Math.floor(Date.now() / 1000)}</uniqueId>
    <generationTime>${formatDate(now)}</generationTime>
    <expirationTime>${formatDate(expiration)}</expirationTime>
  </header>
  <service>${service}</service>
</loginTicketRequest>`
}

/**
 * Sign TRA with CMS/PKCS#7 using node-forge
 */
function signTRA(traXml, privateKeyPem, certPem) {
  const p7 = forge.pkcs7.createSignedData()
  p7.content = forge.util.createBuffer(traXml, 'utf8')

  const cert = forge.pki.certificateFromPem(certPem)
  const privateKey = forge.pki.privateKeyFromPem(privateKeyPem)

  p7.addCertificate(cert)
  p7.addSigner({
    key: privateKey,
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date() },
    ],
  })

  p7.sign()
  const asn1 = p7.toAsn1()
  const derBytes = forge.asn1.toDer(asn1).getBytes()
  return Buffer.from(derBytes, 'binary').toString('base64')
}

/**
 * Call WSAA LoginCms to get Token + Sign
 */
async function getWSAAToken(env, privateKeyPem, certPem, businessId) {
  const cacheKey = getTokenCacheKey(businessId, env)
  const cached = tokenCache[cacheKey]
  if (cached && cached.expiry > Date.now()) {
    return cached
  }

  const tra = generateTRA('wsfe')
  const cms = signTRA(tra, privateKeyPem, certPem)

  const wsaaUrl = AFIP_URLS[env].wsaa
  const client = await soap.createClientAsync(wsaaUrl)

  const [result] = await client.loginCmsAsync({ in0: cms })
  const loginResponse = result.loginCmsReturn

  // Parse XML response
  const tokenMatch = loginResponse.match(/<token>(.+?)<\/token>/)
  const signMatch = loginResponse.match(/<sign>(.+?)<\/sign>/)
  const expirationMatch = loginResponse.match(/<expirationTime>(.+?)<\/expirationTime>/)

  if (!tokenMatch || !signMatch) {
    throw new Error('WSAA: Could not extract token/sign from response')
  }

  const tokenData = {
    token: tokenMatch[1],
    sign: signMatch[1],
    expiry: expirationMatch ? new Date(expirationMatch[1]).getTime() : Date.now() + 11 * 60 * 60 * 1000,
  }

  tokenCache[cacheKey] = tokenData
  return tokenData
}

// ============================================================
// WSFEv1: Invoice authorization
// ============================================================

async function getWSFEClient(env) {
  return soap.createClientAsync(AFIP_URLS[env].wsfe)
}

async function getLastCbteNro(wsfeClient, auth, ptoVta, cbteTipo) {
  const [result] = await wsfeClient.FECompUltimoAutorizadoAsync({
    Auth: auth,
    PtoVta: ptoVta,
    CbteTipo: cbteTipo,
  })
  return result.FECompUltimoAutorizadoResult.CbteNro || 0
}

async function authorizeCbte(wsfeClient, auth, invoiceData) {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const cbteDesde = invoiceData.cbte_nro
  const cbteHasta = invoiceData.cbte_nro

  const feDetReq = {
    Concepto: 1, // Productos
    DocTipo: invoiceData.doc_tipo,
    DocNro: invoiceData.doc_nro || '0',
    CbteDesde: cbteDesde,
    CbteHasta: cbteHasta,
    CbteFch: today,
    ImpTotal: invoiceData.imp_total,
    ImpTotConc: invoiceData.imp_neto_no_gravado || 0,
    ImpNeto: invoiceData.imp_neto,
    ImpOpEx: invoiceData.imp_exento || 0,
    ImpIVA: invoiceData.imp_iva || 0,
    ImpTrib: invoiceData.imp_trib || 0,
    MonId: 'PES',
    MonCotiz: 1,
  }

  // Add IVA breakdown for Factura A
  if (invoiceData.imp_iva > 0) {
    feDetReq.Iva = {
      AlicIva: [{
        Id: 5, // 21%
        BaseImp: invoiceData.imp_neto,
        Importe: invoiceData.imp_iva,
      }],
    }
  }

  const [result] = await wsfeClient.FECAESolicitarAsync({
    Auth: auth,
    FeCAEReq: {
      FeCabReq: {
        CantReg: 1,
        PtoVta: invoiceData.pto_vta,
        CbteTipo: invoiceData.cbte_tipo,
      },
      FeDetReq: {
        FECAEDetRequest: [feDetReq],
      },
    },
  })

  const det = result.FECAESolicitarResult.FeDetResp.FECAEDetResponse[0]
  const errors = result.FECAESolicitarResult.Errors

  if (det.Resultado === 'R') {
    const obs = det.Observaciones?.Obs
    const errMsg = obs
      ? (Array.isArray(obs) ? obs.map(o => o.Msg).join('; ') : obs.Msg)
      : (errors ? JSON.stringify(errors) : 'Unknown AFIP error')
    throw new Error(`AFIP rechazó el comprobante: ${errMsg}`)
  }

  return {
    cae: det.CAE,
    cae_vto: det.CAEFchVto,
    cbte_nro: cbteDesde,
    resultado: det.Resultado,
  }
}

// ============================================================
// Get keys from Supabase
// ============================================================
async function getFiscalKeys(supabaseUrl, supabaseServiceKey, businessId, env) {
  const sb = createClient(supabaseUrl, supabaseServiceKey)
  const { data, error } = await sb
    .from('fiscal_keys')
    .select('*')
    .eq('business_id', businessId)
    .eq('env', env)
    .single()

  if (error || !data) throw new Error('Fiscal keys not found')
  if (!data.crt_pem) throw new Error('CRT not uploaded yet')
  return data
}

// ============================================================
// ROUTES
// ============================================================

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'stockia-billing-service', time: new Date().toISOString() })
})

// ------- Generate CSR -------
app.post('/generate-csr', authMiddleware, (req, res) => {
  try {
    const { cuit, razon_social, enc_key } = req.body
    if (!cuit || !enc_key) return res.status(400).json({ error: 'cuit and enc_key required' })

    const cleanCuit = cuit.replace(/[-\s]/g, '')

    // Generate RSA 2048 key pair
    const keys = forge.pki.rsa.generateKeyPair(2048)
    const privateKeyPem = forge.pki.privateKeyToPem(keys.privateKey)

    // Generate CSR
    const csr = forge.pki.createCertificationRequest()
    csr.publicKey = keys.publicKey
    csr.setSubject([
      { name: 'commonName', value: `STOCKIA-${cleanCuit}` },
      { name: 'organizationName', value: razon_social || `CUIT ${cleanCuit}` },
      { shortName: 'serialNumber', value: `CUIT ${cleanCuit}` },
    ])
    csr.sign(keys.privateKey, forge.md.sha256.create())
    const csrPem = forge.pki.certificationRequestToPem(csr)

    // Encrypt private key
    const privateKeyEnc = encryptPrivateKey(privateKeyPem, enc_key)

    res.json({
      csr_pem: csrPem,
      private_key_enc: privateKeyEnc,
    })
  } catch (err) {
    console.error('CSR generation error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ------- Test Connection -------
app.post('/test-connection', authMiddleware, async (req, res) => {
  try {
    const { business_id, env, supabase_url, supabase_service_key, enc_key } = req.body

    const keys = await getFiscalKeys(supabase_url, supabase_service_key, business_id, env)
    const privateKeyPem = decryptPrivateKey(keys.private_key_enc, enc_key)

    // Try WSAA login
    const token = await getWSAAToken(env, privateKeyPem, keys.crt_pem, business_id)

    // Try FECompUltimoAutorizado (lightweight check)
    const wsfeClient = await getWSFEClient(env)
    const auth = { Token: token.token, Sign: token.sign, Cuit: keys.crt_pem.match(/serialNumber.*?(\d+)/)?.[1] || '' }

    // Get CUIT from fiscal_settings
    const sb = createClient(supabase_url, supabase_service_key)
    const { data: fiscal } = await sb.from('fiscal_settings').select('cuit, pto_vta').eq('business_id', business_id).eq('env', env).single()
    if (!fiscal) throw new Error('Fiscal settings not found')

    auth.Cuit = fiscal.cuit.replace(/[-\s]/g, '')

    const lastNro = await getLastCbteNro(wsfeClient, auth, fiscal.pto_vta, 11) // Factura C
    
    res.json({
      ok: true,
      message: `Conexión exitosa. Último comprobante C: ${lastNro}`,
      last_cbte_nro: lastNro,
    })
  } catch (err) {
    console.error('Test connection error:', err)
    res.status(400).json({ ok: false, error: err.message })
  }
})

// ------- Authorize Invoice -------
app.post('/authorize', authMiddleware, async (req, res) => {
  try {
    const { business_id, env, supabase_url, supabase_service_key, enc_key, invoice, fiscal_settings } = req.body

    // Get keys and decrypt
    const keys = await getFiscalKeys(supabase_url, supabase_service_key, business_id, env)
    const privateKeyPem = decryptPrivateKey(keys.private_key_enc, enc_key)

    // Get token
    const token = await getWSAAToken(env, privateKeyPem, keys.crt_pem, business_id)
    const cuit = fiscal_settings.cuit.replace(/[-\s]/g, '')

    const auth = {
      Token: token.token,
      Sign: token.sign,
      Cuit: cuit,
    }

    // Map invoice type to cbte_tipo
    const cbteTipoMap = { A: 1, B: 6, C: 11, NC_A: 3, NC_B: 8, NC_C: 13 }
    const cbteTipo = invoice.cbte_tipo || cbteTipoMap[invoice.invoice_type] || 11

    // Get last authorized number
    const wsfeClient = await getWSFEClient(env)
    const lastNro = await getLastCbteNro(wsfeClient, auth, fiscal_settings.pto_vta, cbteTipo)
    const nextNro = lastNro + 1

    // Map document type
    const docTipo = invoice.doc_tipo || 99
    const docNro = invoice.doc_nro || '0'

    // Authorize
    const result = await authorizeCbte(wsfeClient, auth, {
      pto_vta: fiscal_settings.pto_vta,
      cbte_tipo: cbteTipo,
      cbte_nro: nextNro,
      doc_tipo: docTipo,
      doc_nro: docNro,
      imp_total: Number(invoice.total),
      imp_neto: Number(invoice.neto_gravado || invoice.total),
      imp_neto_no_gravado: Number(invoice.neto_no_gravado || 0),
      imp_exento: Number(invoice.exento || 0),
      imp_iva: Number(invoice.iva_amount || 0),
      imp_trib: Number(invoice.tributos || 0),
    })

    // Generate PDF
    let pdf_base64 = null
    try {
      pdf_base64 = await generateInvoicePDF({
        businessName: fiscal_settings.razon_social,
        businessCuit: cuit,
        businessAddress: fiscal_settings.domicilio,
        ivaCondition: fiscal_settings.iva_condition,
        invoiceType: invoice.invoice_type,
        invoiceNumber: result.cbte_nro,
        puntoVenta: fiscal_settings.pto_vta,
        cae: result.cae,
        caeVto: result.cae_vto,
        date: new Date(),
        customerName: invoice.customer_name,
        customerDocTipo: docTipo,
        customerDocNro: docNro,
        total: Number(invoice.total),
        netoGravado: Number(invoice.neto_gravado || invoice.total),
        ivaAmount: Number(invoice.iva_amount || 0),
        items: invoice.items || [],
      })
    } catch (pdfErr) {
      console.error('PDF generation error (non-fatal):', pdfErr)
    }

    res.json({
      cae: result.cae,
      cae_vto: result.cae_vto,
      cbte_nro: result.cbte_nro,
      pdf_base64,
      afip_request: { pto_vta: fiscal_settings.pto_vta, cbte_tipo: cbteTipo, cbte_nro: nextNro },
      afip_response: result,
    })
  } catch (err) {
    console.error('Authorize error:', err)
    res.status(400).json({ error: err.message })
  }
})

// ------- Market Data Scraper (Local Proxy) -------
app.post('/market-data', async (req, res) => {
  try {
    const { term } = req.body
    if (!term) return res.status(400).json({ error: 'term required' })

    const cleanTerm = term.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()
    // Use the exact search URL format
    const url = `https://listado.mercadolibre.com.ar/search?q=${encodeURIComponent(cleanTerm)}`
    
    console.log(`[Radar Local] Buscando en Mercado Libre: ${url}`)
    
    // Using simple fetch (available in Node 18+)
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
      }
    })

    if (!response.ok) {
      throw new Error(`Mercado Libre respondió con status ${response.status}`)
    }

    const html = await response.text()
    
    if (html.includes('suspicious-traffic-frontend')) {
       throw new Error('Bloqueo detectado incluso en local. Intenta buscando de nuevo en unos minutos.')
    }

    const prices = []
    const titles = []
    
    const priceRegex = /<span class="andes-money-amount__fraction"[^>]*>([\d\.]+)<\/span>/g
    const titleRegex = /<h[2-3][^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)<\/h[2-3]>/g
    
    let match
    while ((match = priceRegex.exec(html)) !== null) {
      const val = parseInt(match[1].replace(/\./g, ''))
      if (!isNaN(val) && val > 300) prices.push(val)
    }
    
    while ((match = titleRegex.exec(html)) !== null) {
      const t = match[1].trim()
      if (t.length > 5 && !t.includes('{')) titles.push(t)
    }

    if (prices.length < 2) {
      return res.status(404).json({ ok: false, error: 'No se encontraron resultados en el rastro. Intenta con una palabra más simple.' })
    }

    const validPrices = prices.slice(0, 15)
    res.json({
      ok: true,
      data: {
        avg: validPrices.reduce((a, b) => a + b, 0) / validPrices.length,
        min: Math.min(...validPrices),
        max: Math.max(...prices),
        sample_size: prices.length,
        samples: titles.slice(0, 5).map((t, i) => ({
          title: t,
          price: prices[i],
          permalink: url
        }))
      }
    })
  } catch (err) {
    console.error('[Radar Local Error]:', err.message)
    res.status(500).json({ ok: false, error: err.message })
  }
})

// ============================================================
// Start
// ============================================================
app.listen(PORT, () => {
  console.log(`🧾 STOCKIA Billing Service running on port ${PORT}`)
})
