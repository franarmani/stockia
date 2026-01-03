# 🚀 GUÍA DE DEPLOYMENT - Tuturno SaaS

## Índice
1. [Requisitos Previos](#requisitos-previos)
2. [Preparar la Aplicación](#preparar-la-aplicación)
3. [Deploy Backend (NestJS) a Heroku/Railway](#deploy-backend)
4. [Deploy Frontend (Next.js) a Vercel](#deploy-frontend)
5. [Configurar Base de Datos PostgreSQL](#configurar-base-de-datos)
6. [Configurar Dominio y SSL](#configurar-dominio)
7. [Monitoring y Mantenimiento](#monitoring)

---

## 📋 Requisitos Previos

### Herramientas Necesarias
```bash
# Node.js v18+
node --version

# npm v9+
npm --version

# Git
git --version

# Docker (opcional pero recomendado)
docker --version
```

### Cuentas Necesarias
- [ ] GitHub (para repositorio)
- [ ] Vercel (para frontend)
- [ ] Heroku o Railway (para backend)
- [ ] PostgreSQL Cloud (Supabase, Neon, Railway)
- [ ] Cloudflare o GoDaddy (para dominio)

---

## 🔧 Preparar la Aplicación

### 1. Actualizar Variables de Entorno

**Backend (.env)**
```bash
# Database
DATABASE_URL=postgresql://user:password@db.example.com:5432/tuturno
DB_HOST=db.example.com
DB_PORT=5432
DB_USERNAME=user
DB_PASSWORD=your_password
DB_DATABASE=tuturno

# JWT
JWT_SECRET=your_super_secret_jwt_key_min_32_chars
JWT_EXPIRATION=900 # 15 minutes
REFRESH_TOKEN_EXPIRATION=604800 # 7 days

# API
API_URL=https://api.tuturno.app
API_PORT=3000

# Frontend
FRONTEND_URL=https://tuturno.app

# MercadoPago (cuando esté listo)
MERCADOPAGO_ACCESS_TOKEN=your_mercadopago_token
MERCADOPAGO_PUBLIC_KEY=your_mercadopago_public_key

# Email (SendGrid)
SENDGRID_API_KEY=your_sendgrid_key
SENDGRID_FROM_EMAIL=noreply@tuturno.app

# SMS (Twilio)
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_PHONE_NUMBER=+1234567890

# Logging
LOG_LEVEL=info
NODE_ENV=production
```

**Frontend (.env.local)**
```bash
NEXT_PUBLIC_API_URL=https://api.tuturno.app
NEXT_PUBLIC_GA_ID=G-YOUR_GOOGLE_ANALYTICS_ID
NEXT_PUBLIC_APP_URL=https://tuturno.app
NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY=your_mercadopago_public_key
```

### 2. Actualizar package.json

**Backend**
```json
{
  "name": "tuturno-backend",
  "version": "1.0.0",
  "scripts": {
    "build": "nest build",
    "start": "node dist/main",
    "start:dev": "nest start --watch",
    "db:migrate": "typeorm migration:run -d src/database/data-source.ts",
    "db:generate": "typeorm migration:generate -d src/database/data-source.ts"
  },
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=9.0.0"
  }
}
```

**Frontend**
```json
{
  "name": "tuturno-frontend",
  "version": "1.0.0",
  "scripts": {
    "build": "next build",
    "start": "next start",
    "export": "next export"
  },
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=9.0.0"
  }
}
```

---

## 🐳 Deploy Backend (NestJS)

### Opción A: Railway.app (Recomendado - MÁS FÁCIL)

1. **Conectar GitHub**
   ```bash
   # En railway.app, clickear "New Project"
   # Seleccionar "Deploy from GitHub"
   # Autorizar GitHub y seleccionar repositorio
   ```

2. **Configurar Variables de Entorno**
   ```bash
   # En Railway Dashboard → Variables
   DATABASE_URL=postgresql://...
   JWT_SECRET=...
   MERCADOPAGO_ACCESS_TOKEN=...
   ```

3. **Configurar Build**
   ```bash
   # Root Directory: packages/backend
   # Start Command: npm start
   # Build Command: npm run build
   ```

4. **Deploy Automático**
   ```bash
   # Cada push a main/master dispara deploy automático
   git push origin main
   ```

### Opción B: Heroku

1. **Instalar Heroku CLI**
   ```bash
   npm install -g heroku
   heroku login
   ```

2. **Crear Aplicación**
   ```bash
   heroku create tuturno-backend
   heroku addons:create heroku-postgresql:hobby-dev
   ```

3. **Configurar Buildpack**
   ```bash
   heroku buildpacks:set heroku/nodejs -a tuturno-backend
   heroku config:set NODE_ENV=production -a tuturno-backend
   ```

4. **Deploy**
   ```bash
   git subtree push --prefix packages/backend heroku main
   ```

### Opción C: Docker + AWS/DigitalOcean

1. **Crear Dockerfile**
   ```dockerfile
   FROM node:18-alpine
   WORKDIR /app
   COPY package*.json ./
   RUN npm install
   COPY . .
   RUN npm run build
   EXPOSE 3000
   CMD ["npm", "start"]
   ```

2. **Build y Push**
   ```bash
   docker build -t tuturno-backend .
   docker run -p 3000:3000 tuturno-backend
   ```

---

## 🌐 Deploy Frontend (Next.js) a Vercel

### Opción A: Vercel (RECOMENDADO)

1. **Conectar GitHub a Vercel**
   ```bash
   # En vercel.com → New Project
   # Importar repositorio
   # Seleccionar project root: packages/frontend
   ```

2. **Configurar Variables de Entorno**
   ```bash
   # En Vercel Dashboard → Settings → Environment Variables
   NEXT_PUBLIC_API_URL=https://api.tuturno.app
   NEXT_PUBLIC_GA_ID=G-YOUR_GA_ID
   ```

3. **Deploy Automático**
   ```bash
   # Cada push a main/master = deploy automático
   git push origin main
   ```

4. **Custom Domain**
   ```bash
   # En Vercel → Domains
   # Agregar dominio: tuturno.app
   # Apuntar DNS records según instrucciones
   ```

### Opción B: Netlify

```bash
# Conectar repositorio
netlify init

# Variables de entorno
netlify env:set NEXT_PUBLIC_API_URL https://api.tuturno.app

# Deploy
netlify deploy --prod
```

---

## 📊 Configurar Base de Datos PostgreSQL

### Opción A: Supabase (RECOMENDADO)

1. **Crear Proyecto**
   ```bash
   # En supabase.com → New Project
   # Elegir región cercana
   # Crear base de datos
   ```

2. **Obtener Conexión**
   ```
   postgresql://user:password@db.supabase.co:5432/postgres
   ```

3. **Ejecutar Migraciones**
   ```bash
   DATABASE_URL="postgresql://..." npm run db:migrate
   ```

### Opción B: Neon (Sin servidor)

```bash
# Crear proyecto en neon.tech
# Obtener connection string
# Usar en DATABASE_URL
```

### Opción C: Railway

```bash
# En Railway → Create New → PostgreSQL
# Copiar DATABASE_URL
# Setear en variables de entorno
```

---

## 🔐 Configurar Dominio y SSL

### 1. Comprar Dominio

- Opciones: GoDaddy, Namecheap, Route53, Cloudflare

### 2. Apuntar DNS

**Para Frontend (Vercel)**
```
CNAME: tuturno.app → cname.vercel-dns.com
```

**Para Backend (Railway/Heroku)**
```
CNAME: api.tuturno.app → railway.app (o heroku.com)
```

### 3. SSL Automático

- Vercel: Automático
- Railway: Automático
- Heroku: Automático

### 4. Cloudflare (Opcional)

```bash
# En cloudflare.com
# Agregar sitio: tuturno.app
# Apuntar nameservers
# SSL/TLS → Full (strict)
```

---

## 📈 Monitoring y Mantenimiento

### 1. Logs

**Backend (Railway)**
```bash
railway logs -s backend
```

**Frontend (Vercel)**
```bash
# En Vercel Dashboard → Deployments → Logs
```

### 2. Alertas

```bash
# Configurar en Railway/Heroku/Vercel
# Email alerts para errores
```

### 3. Backups Automáticos

```bash
# Supabase = automático
# Configurar en settings
```

### 4. Performance Monitoring

**Sentry**
```bash
npm install @sentry/nextjs @sentry/node

# En .env
SENTRY_DSN=your_sentry_url
```

---

## ✅ Checklist Pre-Producción

- [ ] Variables de entorno configuradas en todos los servicios
- [ ] Base de datos migrada y testeada
- [ ] SSL/HTTPS activo
- [ ] Dominio apuntado correctamente
- [ ] CORS configurado correctamente
- [ ] Logs configurados
- [ ] Backups automáticos activos
- [ ] Monitoreo de errores (Sentry)
- [ ] Analytics (Google Analytics 4)
- [ ] Email transaccional (SendGrid)
- [ ] Pruebas end-to-end ejecutadas

---

## 🐛 Troubleshooting

### Error: CORS

```typescript
// En backend main.ts
app.enableCors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
});
```

### Error: Base de Datos

```bash
# Verificar conexión
psql postgresql://user:pass@host/db

# Ejecutar migraciones
npm run db:migrate
```

### Error: Variables de Entorno

```bash
# Verificar que todas las variables están seteadas
# En plataforma de deployment (Railway/Vercel/Heroku)
```

---

## 📞 Soporte

- Documentación: https://docs.tuturno.app
- Email: support@tuturno.app
- Chat: https://tuturno.app/chat

---

**¡Tu aplicación está lista para producción! 🎉**
