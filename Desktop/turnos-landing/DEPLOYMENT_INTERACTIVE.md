# 🚀 DEPLOYMENT INTERACTIVO - Tuturno MVP

**Tiempo Total**: 15 minutos  
**Resultado Final**: App en producción con SSL automático 🔒

---

## ✅ CHECKLIST PRE-DEPLOYMENT

Verifica antes de empezar:

- [ ] ¿Tu código está en GitHub? → https://github.com/franarmani/turnos-landing
- [ ] ¿Tienes cuenta en Railway? → railway.app
- [ ] ¿Tienes cuenta en Vercel? → vercel.com
- [ ] ¿GitHub está conectado en ambas?

**Si no tienes cuentas:**
1. Crea Railway: https://railway.app (Sign in with GitHub)
2. Crea Vercel: https://vercel.com (Sign in with GitHub)

---

# 🎯 DEPLOYMENT STEP BY STEP

## PASO 1️⃣: BACKEND EN RAILWAY (3 minutos)

### 1.1 Crear Proyecto

```
1. Ve a: https://railway.app/dashboard
2. Click: "New Project"
3. Click: "Deploy from GitHub"
4. Autoriza GitHub
5. Selecciona: "turnos-landing"
6. Click en el proyecto cuando aparezca
```

### 1.2 Agregar PostgreSQL

```
1. En tu proyecto, click: "Add Service"
2. Selecciona: "PostgreSQL"
3. Espera 30 segundos (configura automático)
4. ✅ Base de datos lista
```

### 1.3 Configurar Variables Backend

```
En tu proyecto Railway:
1. Click en el servicio NestJS
2. Tab "Variables"
3. Agrega estas variables (COPIA/PEGA):
```

```env
NODE_ENV=production
PORT=3000
API_URL=https://api-tuturno.up.railway.app
JWT_SECRET=tu_secret_aqui_minimo_32_caracteres_aleatorios
JWT_EXPIRATION=900
REFRESH_TOKEN_EXPIRATION=604800
FRONTEND_URL=https://tuturno.vercel.app
LOG_LEVEL=info
```

**Las variables `DB_*` se auto-generan** ✅

### 1.4 Deploy Backend

```
1. En Railway, tab "Deploy"
2. Build Command: npm run build
3. Start Command: npm start
4. Root Directory: packages/backend
5. Click: "Deploy"
6. Espera 5-10 minutos (primera vez es lenta)
```

**Señal de éxito**: ✅ Status "Success" (verde)  
**Tu URL será**: `https://api-tuturno-production.up.railway.app`

---

## PASO 2️⃣: FRONTEND EN VERCEL (5 minutos)

### 2.1 Conectar Proyecto

```
1. Ve a: https://vercel.com/new
2. Click: "Import Git Repository"
3. Busca y selecciona: "turnos-landing"
4. Click: "Import"
```

### 2.2 Configurar Deploy

```
1. Root Directory: packages/frontend ← IMPORTANTE
2. Framework: Next.js (auto-detect)
3. Click: "Deploy"
4. Espera 5-10 minutos
```

**Señal de éxito**: ✅ Status "Ready" (verde)  
**Tu URL será**: `https://tuturno.vercel.app`

### 2.3 Agregar Variables Frontend

```
En Vercel:
1. Click en tu proyecto
2. Tab "Settings" → "Environment Variables"
3. Agrega estas 3 variables:
```

| Variable | Valor |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | `https://api-tuturno-production.up.railway.app` |
| `NEXT_PUBLIC_APP_URL` | `https://tuturno.vercel.app` |
| `NEXT_PUBLIC_GA_ID` | `G-XXXXXX` (opcional, tu Google Analytics ID) |

```
4. Click: "Save"
5. Vercel redeploy automático
```

---

## PASO 3️⃣: VERIFICACIÓN (2 minutos)

### 3.1 Probar Backend

Abre tu terminal y ejecuta:

```bash
curl https://api-tuturno-production.up.railway.app/health
```

**Resultado esperado**:
```json
{"status":"ok"}
```

### 3.2 Probar Frontend

1. Ve a: `https://tuturno.vercel.app`
2. ¿Carga? ✅
3. Abre Console (F12) → ¿Sin errores? ✅

### 3.3 Probar Conexión

En Console del navegador:

```javascript
fetch('https://api-tuturno-production.up.railway.app/health')
  .then(r => r.json())
  .then(d => console.log('✅ Backend OK:', d))
  .catch(e => console.error('❌ Error:', e.message))
```

**Si ves `✅ Backend OK`** → ¡FUNCIONANDO! 🎉

---

## 🎊 RESULTADO FINAL

```
✅ Backend:  https://api-tuturno-production.up.railway.app
✅ Frontend: https://tuturno.vercel.app
✅ SSL:      Automático en ambas
✅ CDN:      Global con Vercel
✅ Database: PostgreSQL en Railway
✅ Costo:    ~$5/mes (o free tier)
```

---

## 📱 PRÓXIMOS PASOS OPCIONALES

### Dominio Personalizado (20 min adicional)

```
1. Compra dominio en: GoDaddy, Namecheap, etc.
2. En Vercel: Settings → Domains → "Add Domain"
3. Sigue instrucciones DNS de Vercel
4. Espera 24-48 horas
5. ¡Listo! https://tuturno.com (tu dominio)
```

### Activar Pagos (5 min)

```
1. MercadoPago: https://www.mercadopago.com/developers
2. Obtén: Public Key + Access Token
3. En Railway, agrega variables:
   - MERCADOPAGO_PUBLIC_KEY=xxx
   - MERCADOPAGO_ACCESS_TOKEN=xxx
4. ¡Pagos activados!
```

### Emails Automáticos (5 min)

```
1. SendGrid: https://sendgrid.com
2. Obtén: API Key
3. En Railway, agrega: SENDGRID_API_KEY=xxx
4. ¡Emails activados!
```

---

## 🆘 PROBLEMAS COMUNES

### Frontend no ve Backend

**Problema**: Console muestra error de conexión

**Solución**:
1. Verifica `NEXT_PUBLIC_API_URL` en Vercel (exacta URL de Railway)
2. Redeploy en Vercel
3. Limpia cache (Ctrl+Shift+Delete)

### Railway no crea la BD

**Problema**: Error de conexión a DB

**Solución**:
1. En Railway, ¿ves PostgreSQL en "Services"?
2. Si no, click "Add Service" → PostgreSQL
3. Espera 30 seg y redeploy

### CORS Error

**Problema**: Frontend bloqueado por CORS

**Solución**:
1. En backend `main.ts`, verifica:
```typescript
app.enableCors({
  origin: process.env.FRONTEND_URL,
})
```
2. Redeploy backend

---

## ✨ ¡FELICIDADES!

Tu app está en producción. 🚀

**Ahora puedes:**
- ✅ Invitar usuarios
- ✅ Testear en producción
- ✅ Recopilar feedback
- ✅ Iterar mejoras
- ✅ Escalar cuando creza

---

**Tiempo total**: ~15 minutos ⏱️  
**Resultado**: App en producción con SSL 🔒  
**Costo**: ~$5/mes (o gratis con free tier)

**¡Lanzado!** 🎉
