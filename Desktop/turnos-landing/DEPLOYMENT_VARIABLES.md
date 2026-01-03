# 🚀 VARIABLES PARA DEPLOYMENT

## BACKEND (Railway)

Copia TODAS estas variables en Railway:

```env
# Environment
NODE_ENV=production
PORT=3000

# URLs
API_URL=https://api-tuturno.up.railway.app
FRONTEND_URL=https://tuturno.vercel.app

# JWT
JWT_SECRET=your_super_secret_key_32_chars_minimum_1234567890abcdef
JWT_EXPIRATION=900
REFRESH_TOKEN_EXPIRATION=604800

# Logging
LOG_LEVEL=info

# Database (AUTO-GENERADAS por Railway con PostgreSQL)
# ⚠️ NO TOQUES ESTAS - se crean automáticamente:
# DB_HOST
# DB_PORT
# DB_USERNAME
# DB_PASSWORD
# DB_NAME
# DB_TYPE
# DATABASE_URL
```

---

## FRONTEND (Vercel)

Copia ESTAS variables en Vercel Settings → Environment Variables:

```env
NEXT_PUBLIC_API_URL=https://api-tuturno-production.up.railway.app
NEXT_PUBLIC_APP_URL=https://tuturno.vercel.app
NEXT_PUBLIC_GA_ID=G-XXXXXX
```

⚠️ **IMPORTANTE**: Las variables con `NEXT_PUBLIC_` se usan en el frontend (públicas)

---

## PASOS PARA COPIAR

### Railway:

```
1. Ve a: https://railway.app/dashboard
2. Click en tu proyecto
3. Selecciona el servicio (NestJS)
4. Tab "Variables"
5. COPIA/PEGA cada variable arriba
6. Click "Save"
7. El servicio se redeploy automático
```

### Vercel:

```
1. Ve a: https://vercel.com/dashboard
2. Selecciona "tuturno-landing"
3. Settings → Environment Variables
4. COPIA/PEGA las 3 variables
5. Click "Save"
6. Vercel redeploy automático
```

---

## ✨ SECRETOS

Para `JWT_SECRET`, genera uno seguro:

### Opción 1: PowerShell

```powershell
[Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes((Get-Random -Count 32 | ForEach-Object {[char]$_}) -join ''))
```

### Opción 2: Usa un UUID Online

https://www.uuidgenerator.net/

Copia y pega 2-3 veces:
```
abc123def456-ghi789jkl012-mno345pqr678-stu901vwx234
```

### Opción 3: Simple (mínimo 32 caracteres)

```
myapp_secret_key_1234567890abcdefghij
```

---

## CHECKLIST DE VARIABLES

**Railway Backend:**
- [ ] NODE_ENV = production
- [ ] PORT = 3000
- [ ] API_URL = https://api-tuturno-production.up.railway.app
- [ ] JWT_SECRET = (seguro, 32+ chars)
- [ ] JWT_EXPIRATION = 900
- [ ] REFRESH_TOKEN_EXPIRATION = 604800
- [ ] FRONTEND_URL = https://tuturno.vercel.app
- [ ] LOG_LEVEL = info
- [ ] DB_* variables (auto-generadas)

**Vercel Frontend:**
- [ ] NEXT_PUBLIC_API_URL = https://api-tuturno-production.up.railway.app
- [ ] NEXT_PUBLIC_APP_URL = https://tuturno.vercel.app
- [ ] NEXT_PUBLIC_GA_ID = G-XXXXXX (opcional)

---

**Una vez configuradas**, tus apps estarán listas para producción. 🚀
