# 🚀 DEPLOYMENT COMPLETO - TUTURNO

**Tiempo estimado**: 2-3 horas  
**Plataformas**: Railway (backend) + Vercel (frontend)  
**Costo**: Gratis en tier gratuito, ~$7/mes production-ready

---

## 📋 Pre-Requisitos

### Cuentas Necesarias
- [ ] GitHub (para repositorio) - https://github.com
- [ ] Railway (para backend) - https://railway.app
- [ ] Vercel (para frontend) - https://vercel.com
- [ ] Dominio (opcional) - GoDaddy, Namecheap, Cloudflare

### Información a Preparar
- [ ] GitHub repository URL
- [ ] Dominio (si tienes)
- [ ] MercadoPago tokens (si usas)
- [ ] Google Analytics ID
- [ ] SendGrid/Twilio keys (si integras)

---

## ✅ PASO 1: Preparar Backend para Railway

### 1.1 Verificar Estructura
```
packages/backend/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── entities/
│   ├── modules/
│   └── database/
├── package.json
├── tsconfig.json
├── nest-cli.json
└── Dockerfile (crearemos)
```

### 1.2 Crear Archivo railway.json

Crea `packages/backend/railway.json`:
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "nixpacks"
  },
  "deploy": {
    "restartPolicyType": "on_failure",
    "restartPolicyMaxRetries": 5
  }
}
```

### 1.3 Actualizar package.json Backend

```bash
# En packages/backend/package.json, asegurar que existe:
{
  "name": "tuturno-backend",
  "version": "1.0.0",
  "description": "Tuturno API - Appointment Management SaaS",
  "author": "Tu nombre",
  "license": "MIT",
  "scripts": {
    "prebuild": "rimraf dist",
    "build": "nest build",
    "start": "node dist/main",
    "start:dev": "nest start --watch",
    "start:debug": "nest start --debug --watch",
    "start:prod": "node dist/main",
    "lint": "eslint \"{src,apps,libs,test}/**/*.ts\" --fix"
  },
  "dependencies": {
    "@nestjs/common": "^10.0.0",
    "@nestjs/core": "^10.0.0",
    "@nestjs/jwt": "^11.0.0",
    "@nestjs/passport": "^10.0.0",
    "@nestjs/typeorm": "^9.0.0",
    "typeorm": "^0.3.0",
    "pg": "^8.0.0",
    "bcryptjs": "^2.4.3",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.0.0",
    "@nestjs/schematics": "^10.0.0",
    "@types/node": "^20.0.0",
    "typescript": "^5.1.0"
  },
  "engines": {
    "node": "18.x",
    "npm": "9.x"
  }
}
```

### 1.4 Crear .env.example Backend

```bash
# En packages/backend/.env.example
NODE_ENV=production
PORT=3000
API_URL=https://api.tuturno.app

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_password
DB_DATABASE=tuturno

# JWT
JWT_SECRET=your_super_secret_key_min_32_chars
JWT_EXPIRATION=900
REFRESH_TOKEN_EXPIRATION=604800

# Frontend
FRONTEND_URL=https://tuturno.app

# Optional
MERCADOPAGO_ACCESS_TOKEN=your_token
SENDGRID_API_KEY=your_key
LOG_LEVEL=info
```

### 1.5 Actualizar main.ts

```typescript
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Validación global
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  // CORS para producción
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Health check
  app.get('/health', () => ({ status: 'ok' }));

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`✅ Server running on port ${port}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV}`);
}

bootstrap();
```

### 1.6 Crear database/data-source.ts (si no existe)

```typescript
// src/database/data-source.ts
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { User } from '../entities/user.entity';
import { Company } from '../entities/company.entity';
import { Appointment } from '../entities/appointment.entity';
import { Service } from '../entities/service.entity';
import { Employee } from '../entities/employee.entity';
import { CompanySchedule } from '../entities/company-schedule.entity';
import { Payment } from '../entities/payment.entity';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE || 'tuturno',
  entities: [User, Company, Appointment, Service, Employee, CompanySchedule, Payment],
  migrations: ['src/migrations/*.ts'],
  synchronize: process.env.NODE_ENV !== 'production',
  logging: process.env.NODE_ENV !== 'production',
});
```

---

## ✅ PASO 2: Preparar Frontend para Vercel

### 2.1 Verificar next.config.js

```javascript
// packages/frontend/next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    unoptimized: false,
    domains: ['images.unsplash.com', 'api.tuturno.app'],
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_GA_ID: process.env.NEXT_PUBLIC_GA_ID,
  },
  // Permitir trailing slashes
  trailingSlash: true,
  // Reescrituras para API
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: '/api/:path*',
          destination: `${process.env.NEXT_PUBLIC_API_URL}/api/:path*`,
        },
      ],
    };
  },
};

module.exports = nextConfig;
```

### 2.2 Crear .env.example Frontend

```bash
# En packages/frontend/.env.example
NEXT_PUBLIC_API_URL=https://api.tuturno.app
NEXT_PUBLIC_GA_ID=G-YOUR_GOOGLE_ANALYTICS_ID
NEXT_PUBLIC_APP_URL=https://tuturno.app
NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY=your_mercadopago_public_key
```

### 2.3 Actualizar package.json Frontend

```json
{
  "name": "tuturno-frontend",
  "version": "1.0.0",
  "description": "Tuturno - Appointment Management SaaS",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "export": "next export",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "framer-motion": "^10.0.0",
    "zustand": "^4.4.0",
    "axios": "^1.6.0",
    "class-validator": "^0.14.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/react": "^18.0.0",
    "@types/node": "^20.0.0",
    "tailwindcss": "^3.3.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0"
  },
  "engines": {
    "node": "18.x",
    "npm": "9.x"
  }
}
```

### 2.4 Crear vercel.json

```json
{
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "nextjs",
  "outputDirectory": ".next",
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "$NEXT_PUBLIC_API_URL/api/:path*"
    }
  ],
  "env": {
    "NEXT_PUBLIC_API_URL": "@next_public_api_url",
    "NEXT_PUBLIC_GA_ID": "@next_public_ga_id"
  }
}
```

---

## 🚀 PASO 3: Deploy a Railway (Backend)

### 3.1 Conectar GitHub a Railway

1. Ir a https://railway.app
2. Click "New Project"
3. Elegir "Deploy from GitHub"
4. Autorizar GitHub
5. Seleccionar tu repositorio `turnos-landing`

### 3.2 Configurar Variables de Entorno

En Railway Dashboard:
1. Click en tu proyecto
2. Variables → Add Variable

**Agregar estas variables:**

```
NODE_ENV=production
PORT=3000
API_URL=https://api.tuturno.app

DB_HOST=${{Postgres.PGHOST}}
DB_PORT=${{Postgres.PGPORT}}
DB_USERNAME=${{Postgres.PGUSER}}
DB_PASSWORD=${{Postgres.PGPASSWORD}}
DB_DATABASE=${{Postgres.PGDATABASE}}

JWT_SECRET=generate_strong_random_key_here
JWT_EXPIRATION=900
REFRESH_TOKEN_EXPIRATION=604800

FRONTEND_URL=https://tuturno.app

LOG_LEVEL=info
```

### 3.3 Agregar PostgreSQL Add-on

1. En Railway: "Add Service" → "PostgreSQL"
2. Espera a que inicialice
3. Las variables `${{Postgres.*}}` se llenarán automáticamente

### 3.4 Configurar Deploy Settings

1. Settings → Deploy
   - **Build Command**: `npm run build`
   - **Start Command**: `npm start`
   - **Root Directory**: `packages/backend`
   - **Watch Paths**: `packages/backend/**`

2. Click Deploy

**Espera 5-10 minutos mientras instala dependencias y construye**

### 3.5 Obtener URL del Backend

Después del deploy exitoso:
1. Click en la aplicación
2. Ir a "Settings"
3. Encontrar "Domain"
4. Railway asignará algo como: `api-tuturno-production.up.railway.app`

**Copia esta URL** - la necesitarás para el frontend.

---

## 🌐 PASO 4: Deploy a Vercel (Frontend)

### 4.1 Conectar GitHub a Vercel

1. Ir a https://vercel.com
2. Click "New Project"
3. Buscar y seleccionar `turnos-landing`
4. Framework: **Next.js**
5. Root Directory: **packages/frontend**
6. Click "Deploy"

### 4.2 Configurar Variables de Entorno

En Vercel, ir a Settings → Environment Variables

**Agregar:**
```
NEXT_PUBLIC_API_URL=https://api-tuturno-production.up.railway.app
NEXT_PUBLIC_GA_ID=G-YOUR_ACTUAL_ID
NEXT_PUBLIC_APP_URL=https://tuturno.app
NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY=your_actual_key
```

**Para Development:**
```
Staging: https://staging-api.tuturno.app
Preview: https://staging-api.tuturno.app
```

### 4.3 Deployment Configuration

En Vercel Settings:
- Framework: Next.js ✓
- Build Command: `npm run build` ✓
- Output Directory: `.next` ✓
- Install Command: `npm install` ✓

### 4.4 Trigger Deployment

1. Vercel Auto-deployment está habilitado
2. Cada push a `main` dispara un deploy
3. **O** Click "Deploy" manualmente

**Espera 5-10 minutos para build completo**

### 4.5 Obtener URL de Vercel

Después del deploy:
- URL automática: `tuturno-landing.vercel.app`
- O tu dominio personalizado (próximo paso)

---

## 🌍 PASO 5: Configurar Dominio Personalizado

### Opción A: Dominio con Vercel (Recomendado)

#### 5.A.1 En Vercel
1. Project Settings → Domains
2. Click "Add"
3. Ingresa tu dominio: `tuturno.app`

#### 5.A.2 En tu Registrador (GoDaddy, Namecheap, etc)

Actualizar **DNS records** a:
```
Type    Name              Value
CNAME   @                 cname.vercel-dns.com
CNAME   www               cname.vercel-dns.com
CNAME   api               tu-backend-railway.up.railway.app
```

#### 5.A.3 Esperar Propagación
- Puede tomar 24-48 horas
- Vercel generará SSL automáticamente
- Tu sitio estará en https://tuturno.app

---

### Opción B: Usar Cloudflare (Avanzado pero mejor)

#### 5.B.1 Registrar Dominio en Cloudflare
1. Ir a cloudflare.com
2. "Add Site"
3. Siguiente tu dominio: `tuturno.app`
4. Elegir plan Free
5. Cambiar nameservers en tu registrador

#### 5.B.2 Apuntar Recordsens a Vercel/Railway

En Cloudflare DNS:
```
Type    Name    Value                   TTL
CNAME   @       cname.vercel-dns.com    Auto
CNAME   www     cname.vercel-dns.com    Auto
CNAME   api     tu-railway-app.app      Auto
A       *       1.2.3.4 (Vercel IP)     Auto
```

#### 5.B.3 SSL/TLS en Cloudflare
1. Ir a SSL/TLS
2. Overview → Full (Strict)
3. Esperar 5 min para validación
4. ¡Listo! Automático HTTPS

---

## 🔒 PASO 6: SSL Automático

### Railway SSL
✅ Automático - Railway proporciona SSL gratis para dominios *.up.railway.app

### Vercel SSL
✅ Automático - Vercel proporciona SSL gratis con Let's Encrypt

### Dominio Personalizado
✅ Automático - Ambos servicios generan certificados automáticamente

**Tu sitio estará en HTTPS automáticamente una vez configure el dominio** 🔐

---

## ✅ PASO 7: Verificación Post-Deployment

### 7.1 Verificar Backend

```bash
# Probar health check
curl https://api.tuturno.app/health

# Respuesta esperada:
{"status":"ok"}

# Probar conexión DB
curl https://api.tuturno.app/api/appointments/stats
# Debe retornar JSON con stats
```

### 7.2 Verificar Frontend

1. Abre https://tuturno.app
2. Verifica que carga correctamente
3. Abre DevTools → Network
4. Verifica que las llamadas API van a backend correcto
5. Verifica Google Analytics está capturando (si está configured)

### 7.3 Verificar CORS

En DevTools Console:
```javascript
fetch('https://api.tuturno.app/api/appointments/stats')
  .then(r => r.json())
  .then(d => console.log('✅ CORS OK', d))
  .catch(e => console.error('❌ CORS Error', e))
```

### 7.4 Prueba de Login

1. Ve a https://tuturno.app/auth/login
2. Intenta login/registro
3. Verifica tokens en localStorage
4. Verifica redirección a dashboard

---

## 🔧 PASO 8: Configuraciones Opcionales

### 8.1 Configurar Email (SendGrid)

Si quieres enviar emails:

**En Railway:**
1. Variables → Add
2. `SENDGRID_API_KEY=SG.xxxxx`
3. Redeploy

**En tu código (ya hecho):**
```typescript
// emails.service.ts ya existe
@Injectable()
export class EmailService {
  constructor(private configService: ConfigService) {}
  
  async sendWelcome(email: string, name: string) {
    const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(this.configService.get('SENDGRID_API_KEY'));
    
    await sgMail.send({
      to: email,
      from: 'noreply@tuturno.app',
      subject: `¡Bienvenido ${name}!`,
      html: '<h1>Gracias por registrarte</h1>',
    });
  }
}
```

### 8.2 Configurar SMS (Twilio)

Si quieres enviar SMS:

**En Railway:**
```
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1234567890
```

### 8.3 Configurar MercadoPago

**En Railway:**
```
MERCADOPAGO_ACCESS_TOKEN=APP_USR_...
MERCADOPAGO_PUBLIC_KEY=APP_USR_...
```

### 8.4 Configurar Google Analytics

**En Vercel:**
```
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
```

---

## 🚨 TROUBLESHOOTING

### Backend no arranca

```bash
# Verificar logs en Railway
railway logs -s backend

# Errores comunes:
# 1. DB_PASSWORD mal: Verificar ${{Postgres.PGPASSWORD}}
# 2. PORT en uso: Railway asigna automáticamente
# 3. Dependencias: npm install en Railway
```

### Frontend no se conecta al backend

```bash
# Verificar en DevTools
fetch('https://api.tuturno.app/health')

# Si hay CORS error:
# 1. Verificar FRONTEND_URL en Railway
# 2. Verificar enableCors() en main.ts
# 3. Reiniciar ambos servicios
```

### Dominio no resuelve

```bash
# Esperar 24-48 horas
# O verificar DNS con:
nslookup tuturno.app

# Resultado esperado:
# Name: tuturno.app
# Address: (IP de Vercel)
```

### SSL certificate error

```bash
# Generalmente resuelto automáticamente en 5 min
# Si persiste:
# 1. Limpiar caché (Ctrl+Shift+Del)
# 2. Esperar propagación DNS
# 3. Contactar a Vercel/Railway support
```

---

## 📊 Resumen de Deployment

| Componente | Plataforma | Costo | Estado |
|-----------|-----------|-------|--------|
| Backend | Railway | $5-10/mo | ✅ Pronto |
| Frontend | Vercel | Free | ✅ Pronto |
| PostgreSQL | Railway | Included | ✅ Pronto |
| SSL | Automático | Free | ✅ Pronto |
| CDN | Vercel | Free | ✅ Pronto |
| Dominio | Registrador | $10-15/yr | - |

**Costo estimado**: $5-25/mes en producción

---

## ✅ Checklist Final

### Antes de Publicar
- [ ] Todos los .env.example configurados
- [ ] Code pushed a GitHub main branch
- [ ] Tests pasando localmente
- [ ] Build local sin errores
- [ ] Documentación actualizada

### Durante Deployment
- [ ] Backend deployed a Railway ✓
- [ ] Frontend deployed a Vercel ✓
- [ ] PostgreSQL creado en Railway ✓
- [ ] Variables de entorno configuradas ✓
- [ ] Dominio apuntando correctamente ✓

### Después de Publicar
- [ ] Health check responde (backend) ✓
- [ ] Frontend carga sin errores ✓
- [ ] Login/registro funciona ✓
- [ ] API calls funcionan ✓
- [ ] SSL funciona (https) ✓
- [ ] Email/SMS (si aplica) ✓
- [ ] Analytics tracking (si aplica) ✓
- [ ] Backups automáticos configurados ✓

---

## 🎯 Próximos Pasos

### Inmediatos (Después del Deploy)
1. [ ] Probar toda la aplicación en producción
2. [ ] Verificar que todos los usuarios pueden registrarse
3. [ ] Probar booking flow completo
4. [ ] Verificar dashboard admin

### Semana 1
1. [ ] Monitoreo de errores (Sentry)
2. [ ] Logs centralizados
3. [ ] Alertas de uptime
4. [ ] Backups diarios

### Semana 2+
1. [ ] Optimización de performance
2. [ ] A/B testing
3. [ ] Marketing landing
4. [ ] Invitar primeros usuarios

---

## 📞 Soporte

**Railway**: https://railway.app/support  
**Vercel**: https://vercel.com/support  
**Documentación**: Incluida en DEPLOYMENT_GUIDE.md

---

**¡Tu aplicación estará en producción en 2-3 horas! 🚀**

Próximo: Ir a [PASO 1](#paso-1-preparar-backend-para-railway) y empezar ⬇️
