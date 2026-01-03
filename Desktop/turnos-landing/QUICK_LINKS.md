# 🔗 Quick Links & Command Reference

**Rápido**: Acceso inmediato a lo que necesitas

---

## 🎯 Por Propósito

### Quiero Entender el Proyecto
```
→ START_HERE.md              (5 min) Visión general
→ PHASE1_SUMMARY.md          (10 min) Qué se completó hoy
→ docs/ARCHITECTURE.md       (30 min) Diseño detallado
→ docs/ROADMAP.md            (20 min) Plan de desarrollo
```

### Quiero Empezar a Codear
```
→ SETUP.md                   (20 min) Setup paso-a-paso
→ VERIFICATION.md            (15 min) Checklist
→ PROJECT_MAP.md             (10 min) Dónde está todo
→ DEVELOPER_GUIDE.md         (20 min) Para nuevos devs
```

### Quiero Entender la Arquitectura
```
→ docs/ARCHITECTURE.md       (30 min) Multi-tenant
→ docs/DECISIONS.md          (20 min) Por qué cada tech
→ packages/database/init.sql (15 min) Schema SQL
→ PROJECT_MAP.md             (10 min) Estructura visual
```

### Quiero Integrar APIs
```
→ docs/API.md                (40 min) 40+ endpoints
→ packages/backend/src/      (browse) Ejemplos de código
→ DEVELOPER_GUIDE.md         (15 min) Cómo agregar endpoints
```

### Quiero Desplegar
```
→ SETUP.md#docker            (10 min) Docker setup
→ docs/DECISIONS.md#16       (5 min) Hosting strategy
→ docker-compose.yml         (browse) Config actual
```

---

## 📁 Estructura de Carpetas Rápida

```
turnos-landing/
├── 📄 Documentos principales
│   ├── START_HERE.md                ← Primero!
│   ├── SETUP.md                     ← Segundo: setup
│   ├── README.md                    ← Overview
│   ├── PROJECT_MAP.md               ← Estructura visual
│   ├── VERIFICATION.md              ← Checklist
│   ├── DEVELOPER_GUIDE.md           ← Para nuevos devs
│   ├── PHASE1_SUMMARY.md            ← Qué se hizo hoy
│   └── COMPLETION_REPORT.md         ← Reporte detallado
│
├── 📚 docs/ (Documentación técnica)
│   ├── ARCHITECTURE.md              ← Diseño
│   ├── API.md                       ← Endpoints
│   ├── ROADMAP.md                   ← 10 fases
│   └── DECISIONS.md                 ← Tech choices
│
├── 💻 packages/backend/             ← NestJS
│   ├── src/
│   │   ├── main.ts                  ← Entry point
│   │   ├── app.module.ts            ← Main module
│   │   └── modules/                 ← Features
│   ├── package.json
│   └── tsconfig.json
│
├── 🎨 packages/frontend/            ← Next.js
│   ├── src/
│   │   ├── app/                     ← Pages
│   │   ├── components/              ← React components
│   │   ├── store/                   ← Zustand state
│   │   └── lib/api.ts               ← API client
│   ├── package.json
│   └── tailwind.config.ts
│
├── 🗄️ packages/database/            ← PostgreSQL
│   └── init.sql                     ← Schema (1500+ lines)
│
├── 🐳 docker-compose.yml            ← Services
├── .env.example                     ← Template
└── pnpm-workspace.yaml              ← Monorepo
```

---

## ⚡ Comandos Comunes

### Setup Inicial
```bash
# Copiar variables
cp .env.example .env

# Levantar BD + Redis
docker-compose up -d

# Verificar servicios
docker-compose ps
```

### Backend
```bash
cd packages/backend

# Instalar + correr
npm install && npm run dev

# Build producción
npm run build

# Linter
npm run lint

# Tests
npm test
```

### Frontend
```bash
cd packages/frontend

# Instalar + correr
npm install && npm run dev

# Build + start producción
npm run build && npm run start

# Type check
npm run type-check
```

### Base de Datos
```bash
# Entrar a psql
docker exec -it turnos-db psql -U turnos_user -d turnos_dev

# Ver tablas
\dt

# Ver estructura tabla
\d appointments

# Salir
\q
```

### Docker
```bash
# Ver logs
docker-compose logs -f postgres
docker-compose logs -f redis
docker-compose logs -f backend

# Restart
docker-compose restart

# Parar
docker-compose down

# Parar + borrar data
docker-compose down -v
```

### Testing
```bash
# Backend
cd packages/backend && npm test

# Frontend
cd packages/frontend && npm test

# Coverage
npm test -- --coverage
```

---

## 🔍 Búsquedas Rápidas

### ¿Dónde está...?

**El schema de la BD?**  
→ `packages/database/init.sql`

**El código del backend?**  
→ `packages/backend/src/`

**El código del frontend?**  
→ `packages/frontend/src/`

**La configuración de Docker?**  
→ `docker-compose.yml`

**Las variables de entorno?**  
→ `.env.example`

**El roadmap completo?**  
→ `docs/ROADMAP.md`

**Las decisiones técnicas?**  
→ `docs/DECISIONS.md`

**La referencia de APIs?**  
→ `docs/API.md`

**La guía para nuevos devs?**  
→ `DEVELOPER_GUIDE.md`

---

## 🎯 Comandos por Etapa

### Etapa 1: Setup
```bash
cp .env.example .env
docker-compose up -d
docker exec -i turnos-db psql -U turnos_user -d turnos_dev < packages/database/init.sql
```

### Etapa 2: Backend
```bash
cd packages/backend
npm install
npm run dev
# → http://localhost:3000
```

### Etapa 3: Frontend
```bash
cd packages/frontend
npm install
npm run dev
# → http://localhost:3001
```

### Etapa 4: Verificar
```bash
curl http://localhost:3000/health
curl http://localhost:3001
```

---

## 📊 Links a Documentos

| Necesito | Documento |
|----------|-----------|
| Empezar rápido | [START_HERE.md](./START_HERE.md) |
| Setup paso-a-paso | [SETUP.md](./SETUP.md) |
| Entender diseño | [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) |
| Ver APIs | [docs/API.md](./docs/API.md) |
| Roadmap | [docs/ROADMAP.md](./docs/ROADMAP.md) |
| Tech choices | [docs/DECISIONS.md](./docs/DECISIONS.md) |
| Estructura proyecto | [PROJECT_MAP.md](./PROJECT_MAP.md) |
| Checklist | [VERIFICATION.md](./VERIFICATION.md) |
| Nuevo dev | [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md) |
| Summary Fase 1 | [PHASE1_SUMMARY.md](./PHASE1_SUMMARY.md) |
| Reporte completo | [COMPLETION_REPORT.md](./COMPLETION_REPORT.md) |

---

## 🚀 Comandos One-Liners

```bash
# Setup completo en una línea
cp .env.example .env && docker-compose up -d && sleep 5 && docker exec -i turnos-db psql -U turnos_user -d turnos_dev < packages/database/init.sql

# Ver status de todo
docker-compose ps && curl http://localhost:3000/health && curl http://localhost:3001

# Resetear todo
docker-compose down -v && docker-compose up -d && docker exec -i turnos-db psql -U turnos_user -d turnos_dev < packages/database/init.sql

# Logs en vivo
docker-compose logs -f

# Limpieza
docker system prune -a --volumes
```

---

## 🔐 Seguridad - Checklist Rápido

```bash
# Verificar que .env NO está en git
git check-ignore .env
# ✅ Debe decir: .env

# Verificar que secrets no están en código
grep -r "password" packages/backend/src/ | grep -v "password_hash"
# ✅ Mejor: no encontrar nada

# Verificar CORS está configurado
grep -r "CORS" packages/backend/src/
# ✅ Debe haber configuración
```

---

## 🐛 Troubleshooting Rápido

| Problema | Solución |
|----------|----------|
| **Puerto 3000 ocupado** | `API_PORT=3002` en `.env` |
| **BD no arranca** | `docker-compose logs postgres` |
| **Node modules corrupt** | `rm -rf packages/*/node_modules && npm install` |
| **TypeScript error** | `npm run build` (ve el error completo) |
| **Conexión a BD rechazada** | Esperar 10s, `docker-compose restart` |

---

## 📞 Próximos Pasos

### Si es tu primer día
1. Leer [START_HERE.md](./START_HERE.md) (5 min)
2. Hacer [SETUP.md](./SETUP.md) (20 min)
3. Verificar [VERIFICATION.md](./VERIFICATION.md) (15 min)
4. Explorar código

### Si vas a desarrollar Fase 2
1. Leer [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
2. Entender JWT flow ([docs/DECISIONS.md#5](./docs/DECISIONS.md#5-autenticación-jwt-vs-session-vs-oauth))
3. Ver [docs/API.md](./docs/API.md) - endpoints de auth
4. Empezar a codear

### Si quieres entender todo
1. Leer [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md) (20 min)
2. Leer [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) (30 min)
3. Leer [docs/DECISIONS.md](./docs/DECISIONS.md) (20 min)
4. Leer [docs/ROADMAP.md](./docs/ROADMAP.md) (20 min)

---

## ⏱️ Tiempo de Lectura por Documento

| Documento | Tiempo |
|-----------|--------|
| START_HERE.md | 5 min |
| SETUP.md | 20 min |
| README.md | 5 min |
| PROJECT_MAP.md | 10 min |
| VERIFICATION.md | 15 min |
| DEVELOPER_GUIDE.md | 20 min |
| PHASE1_SUMMARY.md | 10 min |
| **docs/ARCHITECTURE.md** | 30 min |
| **docs/API.md** | 40 min |
| **docs/ROADMAP.md** | 20 min |
| **docs/DECISIONS.md** | 20 min |
| **TOTAL** | ~3 horas |

---

## 🎯 Path Recomendado por Rol

### Frontend Developer
```
START_HERE.md (5 min)
  ↓
SETUP.md (20 min)
  ↓
packages/frontend/src/ (explore)
  ↓
docs/API.md (endpoints a consumir)
  ↓
Start coding!
```

### Backend Developer
```
START_HERE.md (5 min)
  ↓
docs/ARCHITECTURE.md (30 min)
  ↓
packages/database/init.sql (15 min)
  ↓
packages/backend/src/ (explore)
  ↓
docs/API.md (endpoints a crear)
  ↓
Start coding!
```

### Full Stack Developer
```
DEVELOPER_GUIDE.md (20 min)
  ↓
docs/ARCHITECTURE.md (30 min)
  ↓
PROJECT_MAP.md (10 min)
  ↓
Explore both packages/
  ↓
Start coding!
```

### DevOps / Infrastructure
```
SETUP.md (20 min)
  ↓
docker-compose.yml (5 min)
  ↓
docs/DECISIONS.md#16 (5 min)
  ↓
Deployment strategy
```

### Product Manager / Stakeholder
```
START_HERE.md (5 min)
  ↓
PHASE1_SUMMARY.md (10 min)
  ↓
docs/ROADMAP.md (20 min)
  ↓
Understand timeline
```

---

## 🔗 URLs Locales

```
Frontend:  http://localhost:3001
Backend:   http://localhost:3000
API Health: http://localhost:3000/health
Database:  localhost:5432 (from docker)
Redis:     localhost:6379 (from docker)
```

---

## 📦 Instalaciones Rápidas

```bash
# Si necesitas instalar una dependencia
cd packages/backend
npm install nombre-paquete

cd ../frontend
npm install nombre-paquete
```

---

## 🎓 Conceptos Clave

**Multi-tenancy**  
→ [docs/ARCHITECTURE.md#1-conceptos-clave](./docs/ARCHITECTURE.md#1-conceptos-clave)

**JWT Auth**  
→ [docs/DECISIONS.md#5](./docs/DECISIONS.md#5-autenticación-jwt-vs-session-vs-oauth)

**TypeORM**  
→ [DEVELOPER_GUIDE.md#-concepto-typeorm](./DEVELOPER_GUIDE.md#-concepto-typeorm-orm-para-bd)

**NestJS**  
→ [docs/DECISIONS.md#2](./docs/DECISIONS.md#2-stack-backend-nestjs-vs-express-vs-fastify)

**Next.js App Router**  
→ [DEVELOPER_GUIDE.md#-frontend](./DEVELOPER_GUIDE.md#-frontend-nextjs---estructura)

---

## ✨ TL;DR (Too Long; Didn't Read)

```
What: SaaS appointment scheduling (like Tuturno)
When: Phase 1 complete (today)
Where: c:\Users\franc\Desktop\turnos-landing
How: Docker + PostgreSQL + NestJS + Next.js
Next: Phase 2 - Authentication

Quick start: 
1. cp .env.example .env
2. docker-compose up -d
3. Read START_HERE.md

Questions? See DEVELOPER_GUIDE.md
```

---

**Last updated**: 2 January 2026  
**Audience**: Everyone on the project  
**Usefulness**: 5/5 ⭐

---

**¡Ahora a codear!** 🚀
