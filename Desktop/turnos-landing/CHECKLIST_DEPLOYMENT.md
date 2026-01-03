# 🚀 DEPLOYMENT CHECKLIST INTERACTIVO

## PRE-DEPLOYMENT ✅

### Verificaciones Locales

- [ ] Git configurado con tu usuario
  ```powershell
  git config --global user.name
  git config --global user.email
  ```

- [ ] Código en GitHub (main branch)
  ```powershell
  git remote -v
  git branch
  ```

- [ ] Estructura del proyecto
  - [ ] packages/backend existe
  - [ ] packages/frontend existe
  - [ ] pnpm-workspace.yaml existe

- [ ] Archivos de configuración
  - [ ] packages/backend/railway.json
  - [ ] packages/backend/.env.example
  - [ ] packages/frontend/vercel.json
  - [ ] packages/frontend/.env.example

---

## RAILWAY SETUP 🚂

### Crear Proyecto

- [ ] Abre https://railway.app/dashboard
- [ ] Click "New Project"
- [ ] Click "Deploy from GitHub"
- [ ] Selecciona "turnos-landing"
- [ ] Proyecto creado y visible

### Agregar PostgreSQL

- [ ] Click "Add Service" en el proyecto
- [ ] Selecciona "PostgreSQL"
- [ ] Espera 30 segundos
- [ ] PostgreSQL aparece en "Services"

### Configurar Backend

- [ ] Click en servicio NestJS
- [ ] Tab "Variables"
- [ ] Agrega variables (ver DEPLOYMENT_VARIABLES.md):
  - [ ] NODE_ENV = production
  - [ ] PORT = 3000
  - [ ] API_URL = https://api-tuturno-production.up.railway.app
  - [ ] JWT_SECRET = (seguro, 32+ chars)
  - [ ] JWT_EXPIRATION = 900
  - [ ] REFRESH_TOKEN_EXPIRATION = 604800
  - [ ] FRONTEND_URL = https://tuturno.vercel.app
  - [ ] LOG_LEVEL = info

- [ ] Click "Save"
- [ ] Railway redeploy automático
- [ ] Status = "Success" (verde)

### Obtener URL Backend

- [ ] En Railway, copia URL del servicio
- [ ] Ejemplo: `https://api-tuturno-production.up.railway.app`
- [ ] **Guarda esta URL** (la usarás en Vercel)

---

## VERCEL SETUP ✨

### Crear Proyecto

- [ ] Abre https://vercel.com/dashboard
- [ ] Click "Add New..." → "Project"
- [ ] Busca "turnos-landing"
- [ ] Click "Import"

### Configurar Deploy

- [ ] **Root Directory: `packages/frontend`** ← IMPORTANTE
- [ ] Framework: Next.js (auto-detect)
- [ ] Click "Deploy"
- [ ] Espera 5-10 minutos
- [ ] Status = "Ready" (verde)

### Obtener URL Frontend

- [ ] En Vercel, copia URL del proyecto
- [ ] Ejemplo: `https://tuturno.vercel.app`
- [ ] **Guarda esta URL** (la usarás después)

### Agregar Variables de Entorno

- [ ] En Vercel: Settings → Environment Variables
- [ ] Agrega 3 variables:
  - [ ] `NEXT_PUBLIC_API_URL` = `https://api-tuturno-production.up.railway.app`
  - [ ] `NEXT_PUBLIC_APP_URL` = `https://tuturno.vercel.app`
  - [ ] `NEXT_PUBLIC_GA_ID` = `G-XXXXXX` (opcional)

- [ ] Click "Save"
- [ ] Vercel redeploy automático
- [ ] Espera 2-3 minutos
- [ ] Status = "Ready" (verde)

---

## VERIFICACIÓN 🔍

### Test Backend

```powershell
# PowerShell
$url = "https://api-tuturno-production.up.railway.app/health"
$response = Invoke-WebRequest -Uri $url
$response.StatusCode # Debe ser 200
$response.Content    # Debe ser {"status":"ok"}
```

- [ ] Backend responde
- [ ] Status Code = 200
- [ ] Response = `{"status":"ok"}`

### Test Frontend

- [ ] Abre: https://tuturno.vercel.app
- [ ] Página carga correctamente
- [ ] Abre Console (F12)
- [ ] No hay errores rojos

### Test Conexión

En Console del navegador:

```javascript
fetch('https://api-tuturno-production.up.railway.app/health')
  .then(r => r.json())
  .then(d => console.log('✅ OK:', d))
  .catch(e => console.error('❌ ERROR:', e))
```

- [ ] Ejecuta script arriba
- [ ] Ver: `✅ OK: {status: 'ok'}`

### Test Login

- [ ] Abre https://tuturno.vercel.app
- [ ] Click en "Login" o "Register"
- [ ] Intenta crear cuenta
- [ ] Verifica en Console que se conecta al backend

---

## POST-DEPLOYMENT (Opcional) 🎁

### Dominio Personalizado

- [ ] Compra dominio (GoDaddy, Namecheap, etc.)
- [ ] En Vercel: Settings → Domains
- [ ] Agrega tu dominio
- [ ] Sigue instrucciones DNS
- [ ] Espera 24-48 horas

### Pagos (MercadoPago)

- [ ] Crea account en MercadoPago.com
- [ ] Obtén Public Key + Access Token
- [ ] En Railway, agrega variables:
  - [ ] MERCADOPAGO_PUBLIC_KEY
  - [ ] MERCADOPAGO_ACCESS_TOKEN
- [ ] Redeploy backend
- [ ] Activa pagos en frontend

### Emails (SendGrid)

- [ ] Crea account en SendGrid.com
- [ ] Obtén API Key
- [ ] En Railway, agrega variable: SENDGRID_API_KEY
- [ ] Redeploy backend
- [ ] Activa emails en código

### Analytics (Google Analytics)

- [ ] Ve a Google Analytics 4
- [ ] Copia tu Measurement ID (G-XXXXXX)
- [ ] En Vercel, agrega: NEXT_PUBLIC_GA_ID
- [ ] Redeploy frontend
- [ ] Verifica que trackea eventos

---

## ✨ FINAL

```
✅ Backend en producción:  https://api-tuturno-production.up.railway.app
✅ Frontend en producción: https://tuturno.vercel.app
✅ SSL automático en ambas
✅ Database PostgreSQL funcionando
✅ Código en GitHub sincronizado
✅ Listo para invitar usuarios
✅ Listo para recopilar feedback
✅ Listo para escalar
```

---

## 🎊 ¡FELICIDADES!

Tu MVP está en **PRODUCCIÓN** 🚀

**Próximos pasos:**
1. Invita primeros usuarios
2. Recopila feedback
3. Itera mejoras
4. Escala cuando creza
5. Monetiza (MercadoPago)
6. Expande globalmente

---

**Tiempo total**: ~15 minutos ⏱️  
**Costo**: ~$5/mes (o gratis con free tier) 💰  
**Status**: LISTO PARA PRODUCCIÓN ✨
