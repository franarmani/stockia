# ⚡ DEPLOYMENT RÁPIDO - 15 MINUTOS

**Tiempo**: ~15 minutos si tienes todo listo  
**Dificultad**: Fácil  
**Resultado**: App en producción con SSL 🔒

---

## 📝 CHECKLIST RÁPIDO

- [ ] Cuentas creadas: GitHub, Railway, Vercel
- [ ] Código pusheado a `main` en GitHub
- [ ] Variables de entorno preparadas
- [ ] Dominio registrado (opcional)

---

## 🚀 PASO A PASO

### ⏱️ MINUTO 1-2: Railway Backend

1. Ve a https://railway.app
2. **Sign in** con GitHub
3. Click **"New Project"**
4. Selecciona **"Deploy from GitHub"**
5. Autoriza y selecciona `turnos-landing`
6. Espera a que cargue
7. Click en tu proyecto cuando aparezca
8. Click **"Add Service"** → **"PostgreSQL"**
9. Espera configuración (~30 seg)

### ⏱️ MINUTO 3-5: Variables del Backend

En Railway:

1. Click en tu proyecto
2. **Variables** (tab)
3. Agrega estas variables:

```
NODE_ENV=production
PORT=3000
API_URL=https://api.tuturno.app
JWT_SECRET=your_secret_here_min_32_chars
JWT_EXPIRATION=900
REFRESH_TOKEN_EXPIRATION=604800
FRONTEND_URL=https://tuturno.app
LOG_LEVEL=info
```

Las variables `DB_*` se auto-completarán con PostgreSQL.

### ⏱️ MINUTO 6: Configurar Deploy Backend

1. Click **"Deployments"** en tu servicio
2. Espera a que muestre la opción de configurar
3. **Root Directory**: `packages/backend`
4. **Build Command**: `npm run build`
5. **Start Command**: `npm start`
6. Click **Deploy**
7. Espera 5-10 minutos (primera vez es lenta)

**Señal de éxito**: Ves "✅ Success" y una URL como `api-tuturno-production.up.railway.app`

---

### ⏱️ MINUTO 7-9: Vercel Frontend

1. Ve a https://vercel.com
2. **Sign in** con GitHub
3. Click **"New Project"**
4. Busca y selecciona `turnos-landing`
5. **Root Directory**: `packages/frontend`
6. Click **Deploy**
7. Espera 5-10 minutos

**Señal de éxito**: Ves "✅ Production" y una URL como `tuturno-landing.vercel.app`

### ⏱️ MINUTO 10-11: Variables del Frontend

En Vercel, en la página del proyecto:

1. **Settings** → **Environment Variables**
2. Agrega:

```
NEXT_PUBLIC_API_URL = https://api-tuturno-production.up.railway.app
NEXT_PUBLIC_GA_ID = G-YOUR_ID (opcional)
NEXT_PUBLIC_APP_URL = https://tuturno.app
```

3. Redeploy automático se dispara

---

### ⏱️ MINUTO 12-15: Dominio (Opcional)

#### En Vercel:
1. **Domains** (tab)
2. Agrega tu dominio
3. Vercel te da instrucciones DNS

#### En tu Registrador (GoDaddy, Namecheap, etc):
1. Va a DNS settings
2. Copia los records que Vercel sugiere
3. Espera 24-48 horas (o actualiza)

---

## ✅ VERIFICACIÓN

### Probar Backend
```bash
curl https://api-tuturno-production.up.railway.app/health
# Debe retornar: {"status":"ok"}
```

### Probar Frontend
1. Abre https://tuturno-landing.vercel.app
2. Verifica que carga
3. Abre Console → verifica que no hay errores
4. Intenta login

### Probar API Connection
En Console del navegador:
```javascript
fetch('https://api-tuturno-production.up.railway.app/api/appointments/stats')
  .then(r => r.json())
  .then(d => console.log('✅ Conectado:', d))
  .catch(e => console.error('❌ Error:', e))
```

---

## 🎯 Resultado Final

✅ **Backend**: https://api-tuturno-production.up.railway.app  
✅ **Frontend**: https://tuturno-landing.vercel.app  
✅ **SSL**: Automático en ambas  
✅ **CDN**: Incluido en Vercel  
✅ **Database**: PostgreSQL en Railway  

**Costo**: Free tier con Vercel, $5/mes Railway (o más si crece)

---

## 🆘 Problemas Comunes

### Frontend no se conecta a Backend
1. Verificar variable `NEXT_PUBLIC_API_URL` en Vercel
2. Ir a Vercel → Deployments → mostrar logs
3. Buscar errores CORS o 404

### Backend no arranca
1. Ir a Railway → logs
2. Buscar error rojo
3. Verificar variables DB (deben auto-completarse)
4. Reintentar deploy

### Dominio no funciona
1. Esperar 24-48 horas
2. Verificar DNS con: `nslookup tuturno.app`
3. Limpiar caché: Ctrl+Shift+Del

---

## 📚 Recursos

- **Railway docs**: https://docs.railway.app
- **Vercel docs**: https://vercel.com/docs
- **Guía completa**: DEPLOYMENT_STEP_BY_STEP.md

---

## 🎉 ¡Listo!

Tu app está en producción. Ahora:

1. Compartir link con usuarios
2. Monitorear logs regularmente
3. Hacer backups de datos
4. Actualizar regularmente

**¡Felicidades! 🚀**
