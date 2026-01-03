# 🎯 DEPLOYMENT VISUAL - PASO A PASO

**Tiempo**: 15 minutos  
**Resultado**: App en producción 🚀

---

# PASO 1: RAILWAY BACKEND (5 minutos)

## 1️⃣ Abre Railway

```
URL: https://railway.app/dashboard
```

**Deberías ver tu dashboard con un botón "New Project"**

---

## 2️⃣ Nuevo Proyecto

```
Click: "New Project"
     ↓
Selecciona: "Deploy from GitHub"
     ↓
Autoriza GitHub (si pide)
     ↓
Busca y selecciona: "turnos-landing"
```

**Verás que está cargando...**

---

## 3️⃣ Agregar PostgreSQL

Cuando termine de cargar el proyecto:

```
Click: "Add Service"
     ↓
Busca: "PostgreSQL"
     ↓
Click en PostgreSQL
     ↓
Espera 30 segundos (se configura solo)
```

✅ **PostgreSQL creada automáticamente**

---

## 4️⃣ Configurar Backend

Click en el servicio NestJS (no en PostgreSQL):

```
┌─────────────────────────────────┐
│ Railway Project                 │
├─────────────────────────────────┤
│ • turnos-landing (NestJS) ← AQUÍ│
│ • PostgreSQL                    │
└─────────────────────────────────┘
```

---

## 5️⃣ Agregar Variables

Dentro del servicio NestJS:

```
Click: Variables
     ↓
Verás un formulario para agregar variables
     ↓
COPIA ESTO (abre DEPLOYMENT_VARIABLES.md):
```

Pasteaesto en las variables (copia cada línea):

```
NODE_ENV = production
PORT = 3000
API_URL = https://api-tuturno-production.up.railway.app
JWT_SECRET = (GENERA UNO SEGURO - ver abajo)
JWT_EXPIRATION = 900
REFRESH_TOKEN_EXPIRATION = 604800
FRONTEND_URL = https://tuturno.vercel.app
LOG_LEVEL = info
```

**Para JWT_SECRET**, usa un generador:
- https://www.uuidgenerator.net/
- O copia: `myapp_secret_key_1234567890abcdefghijklmnopqr`

```
Clic: "Save"
     ↓
Railway redeploy automático
     ↓
✅ Status = Success (verde)
```

---

## 6️⃣ Obtener URL del Backend

En Railway, verás algo como:

```
📍 URL: https://api-tuturno-production.up.railway.app

Copia esta URL → la usarás en Vercel
```

✅ **Backend desplegado**

---

---

# PASO 2: VERCEL FRONTEND (5 minutos)

## 1️⃣ Abre Vercel

```
URL: https://vercel.com/dashboard
```

---

## 2️⃣ Nuevo Proyecto

```
Click: "Add New..."
     ↓
Click: "Project"
     ↓
Busca: "turnos-landing"
     ↓
Click: "Import"
```

---

## 3️⃣ Configurar Proyecto

Vercel te mostrará una pantalla así:

```
┌─────────────────────────────────┐
│ Import Project                  │
├─────────────────────────────────┤
│ Root Directory: [________]      │
│                                 │
│ Framework: Auto-detect          │
│ Build Command: npm run build    │
└─────────────────────────────────┘
```

**IMPORTANTE: Cambia Root Directory:**

```
Root Directory: packages/frontend ← CAMBIA ESTO
```

Luego click: "Deploy"

---

## 4️⃣ Esperar Deploy

```
Vercel está compilando...
     ↓
Espera 5-10 minutos
     ↓
✅ Status = Ready (verde)
```

**Verás una URL como:**

```
https://tuturno.vercel.app

Copia esta URL
```

---

## 5️⃣ Agregar Variables de Entorno

En la pantalla del proyecto de Vercel:

```
Click: Settings
     ↓
Click: Environment Variables
     ↓
Verás formulario para agregar variables
```

**Agrega estas 3 variables:**

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_API_URL` | `https://api-tuturno-production.up.railway.app` |
| `NEXT_PUBLIC_APP_URL` | `https://tuturno.vercel.app` |
| `NEXT_PUBLIC_GA_ID` | `G-XXXXXX` (opcional) |

```
Click: Save
     ↓
Vercel redeploy automático
     ↓
Espera 2-3 minutos
     ↓
✅ Nueva URL en verde = listo
```

---

---

# PASO 3: VERIFICAR (2 minutos)

## 1️⃣ Probar Backend

Abre tu navegador y ve a:

```
https://api-tuturno-production.up.railway.app/health
```

**Deberías ver:**

```json
{"status":"ok"}
```

✅ Si ves esto → Backend OK

---

## 2️⃣ Probar Frontend

Ve a:

```
https://tuturno.vercel.app
```

**Deberías ver tu landing page cargando**

Abre Console (F12):
- ¿Sin errores rojos? ✅

---

## 3️⃣ Probar Conexión Backend ↔ Frontend

En Console de Vercel:

```javascript
fetch('https://api-tuturno-production.up.railway.app/health')
  .then(r => r.json())
  .then(d => console.log('✅ CONECTADO:', d))
  .catch(e => console.error('❌ ERROR:', e.message))
```

**Deberías ver:**

```
✅ CONECTADO: {status: 'ok'}
```

---

## ✨ ¡LISTO!

```
✅ Backend:  https://api-tuturno-production.up.railway.app
✅ Frontend: https://tuturno.vercel.app
✅ SSL:      Automático
✅ Database: PostgreSQL funcionando
✅ Costo:    ~$5/mes (o gratis)
```

---

# 🎊 PRÓXIMOS PASOS (Opcionales)

## Dominio Personalizado (20 min)

```
1. Compra: GoDaddy, Namecheap, etc.
2. En Vercel: Settings → Domains
3. Sigue instrucciones
4. Espera 24-48h
```

## Pagos (5 min)

```
1. Crea account: MercadoPago.com
2. Obtén: Public Key + Access Token
3. En Railway, agrega:
   MERCADOPAGO_PUBLIC_KEY=xxx
   MERCADOPAGO_ACCESS_TOKEN=xxx
4. ¡Listo!
```

## Emails (5 min)

```
1. Crea account: SendGrid.com
2. Obtén: API Key
3. En Railway, agrega:
   SENDGRID_API_KEY=xxx
4. ¡Emails automáticos!
```

---

# 🆘 PROBLEMAS

## Frontend muestra error de conexión

```
1. Verifica: NEXT_PUBLIC_API_URL es exacta (sin trailing slash)
2. Redeploy en Vercel
3. Limpia cache: Ctrl+Shift+Delete
```

## Railway no ve PostgreSQL

```
1. En Railway, ¿ves PostgreSQL en "Services"?
2. Si no: Click "Add Service" → PostgreSQL
3. Redeploy backend
```

## CORS Error

```
Backend main.ts tiene CORS configurado?

app.enableCors({
  origin: process.env.FRONTEND_URL,
})
```

---

**¡FELICIDADES!** 🎉

Tu app está en PRODUCCIÓN.

Tiempo total: ~15 minutos ⏱️  
Costo: ~$5/mes 💰  
Status: LISTO 🚀
