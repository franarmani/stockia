# 🎯 Turnos SaaS - Plataforma Multi-Tenant de Gestión de Turnos

**Versión**: 0.0.1 - Foundation Phase ✅  
**Estado**: Listo para Fase 2 (Autenticación)  
**Tiempo invertido**: ~4 horas  
**Próxima Fase**: 6-8 horas (Auth + Register)

---

Plataforma multi-tenant SaaS tipo **Tuturno/TurnoNow** para que negocios (peluquerías, estética, gimnasios, consultórios) paguen suscripción y gestionen turnos, clientes y servicios.

## 🚀 Comenzar (5 minutos)

1. **Leer**: [START_HERE.md](./START_HERE.md) ← Comienza aquí!
2. **Setup**: [SETUP.md](./SETUP.md)
3. **Verificar**: [VERIFICATION.md](./VERIFICATION.md)

## 📋 Documentación Completa

| Documento | Propósito | Tiempo |
|-----------|-----------|--------|
| **[START_HERE.md](./START_HERE.md)** | Guía de inicio rápido | 5 min |
| **[SETUP.md](./SETUP.md)** | Setup paso a paso | 20 min |
| **[PROJECT_MAP.md](./PROJECT_MAP.md)** | Estructura visual | 10 min |
| **[VERIFICATION.md](./VERIFICATION.md)** | Checklist verificación | 15 min |
| **[COMPLETION_REPORT.md](./COMPLETION_REPORT.md)** | Qué se completó en Fase 1 | 10 min |
| **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)** | Diseño multi-tenant | 30 min |
| **[docs/API.md](./docs/API.md)** | Endpoints (40+) | 40 min |
| **[docs/ROADMAP.md](./docs/ROADMAP.md)** | Plan 10 fases | 20 min |
| **[docs/DECISIONS.md](./docs/DECISIONS.md)** | Tech decisions | 20 min |

## 🏗️ Estructura del Proyecto

```
turnos-landing/
├── packages/
│   ├── backend/          # NestJS + TypeORM (ready to code)
│   ├── frontend/         # Next.js 14 + React 18 (ready to code)
│   └── database/         # PostgreSQL schema (9 tablas)
├── docs/
│   ├── ARCHITECTURE.md   # Design multi-tenant
│   ├── API.md            # Endpoints reference
│   ├── ROADMAP.md        # 10-phase plan
│   └── DECISIONS.md      # Tech choices
├── docker-compose.yml    # PostgreSQL + Redis + Backend
├── .env.example          # Template variables
├── START_HERE.md         # 👈 Leer primero!
├── SETUP.md              # Step-by-step
├── PROJECT_MAP.md        # Visual structure
├── VERIFICATION.md       # Checklist
└── COMPLETION_REPORT.md  # Phase 1 summary
```

## 🚀 Stack Tecnológico

| Componente | Tech | Razón |
|-----------|------|-------|
| **Frontend** | Next.js 14 + React 18 | SSR, SEO, performance |
| **Backend** | NestJS + TypeScript | Modular, enterprise, scalable |
| **Database** | PostgreSQL 16 | ACID, JSON, multi-tenancy native |
| **Cache** | Redis 7 | Sessions, rate limiting |
| **Auth** | JWT + Refresh Token | Stateless, escalable |
| **Styling** | TailwindCSS | Utility-first, professional |
| **State** | Zustand | Minimal, fast |
| **Validation** | class-validator + Zod | Type-safe |
| **Payments** | MercadoPago + Stripe | LATAM + Global |
| **Deploy** | Docker + VPS/Cloud | Flexible, reproducible |

## 🏛️ Arquitectura Multi-Tenant

**Modelo**: Single Database, Row-Level Isolation

```
┌────────────────────────────────────┐
│      PostgreSQL (1 Database)       │
├────────────────────────────────────┤
│ Companies (Tenants)                │
├── Empresa 1 → Users, Services...   │
├── Empresa 2 → Users, Services...   │
├── Empresa 3 → Users, Services...   │
│ (aisladas por company_id)          │
└────────────────────────────────────┘
```

**Beneficios**:
- ✅ Escalable desde el inicio
- ✅ Fácil de mantener
- ✅ Más económico
- ✅ Backups unificados

## 🗄️ Base de Datos (9 Tablas)

```
companies           (tenants)
├── users          (admin + employees)
├── services       (servicios)
├── employees      (personal)
├── appointments   (turnos - CORE)
├── clients        (clientes)
├── subscriptions  (planes)
├── payments       (historial)
└── audit_logs     (debugging)
```

Todas las tablas aisladas por `company_id`.

## 📋 Qué está listo (Fase 1 - COMPLETADO ✅)

- ✅ Arquitectura multi-tenant definida
- ✅ Schema PostgreSQL completo (1500+ líneas SQL)
- ✅ Backend NestJS scaffolding (8 módulos)
- ✅ Frontend Next.js scaffolding (estructura profesional)
- ✅ Docker Compose (PostgreSQL + Redis)
- ✅ Documentación completa (8,000+ palabras)
- ✅ Environment variables configured
- ✅ TypeScript setup
- ✅ TailwindCSS + base components
- ✅ Zustand state management

## 🔜 Próxima Fase: Autenticación (6-8 horas)

- [ ] AuthService (login, register, JWT)
- [ ] Login page
- [ ] Register page
- [ ] Protected routes
- [ ] JWT guards
- [ ] Email verification

Cuando esté listo: **"Ahora armá el sistema de autenticación"**

## 📈 Roadmap Completo (80-100 horas)

1. ✅ **Foundation** (3-4h) - Today
2. 🔄 **Auth & Register** (6-8h) - Next
3. **Landing Page** (8-10h)
4. **Dashboard Core** (12-15h) - Agenda, Servicios, Clientes
5. **Página Pública** (6-8h) - Reservas online
6. **Pagos & Suscripciones** (10-12h) - MercadoPago
7. **Notificaciones** (6-8h) - Email + SMS
8. **Reportes** (6-8h) - Analytics
9. **Integraciones** (8-10h) - Google Cal, WhatsApp
10. **Polish & Deploy** (8-10h) - Production

Ver [docs/ROADMAP.md](./docs/ROADMAP.md) para detalles.

## 🔐 Seguridad Base

- ✅ JWT + Refresh Token
- ✅ Helmet (HTTP headers)
- ✅ CORS configured
- ✅ Input validation (class-validator)
- ✅ Password hashing ready (bcryptjs)
- ✅ .env.example for secrets
- ✅ Foreign keys en BD
- ✅ SQL injection prevention (TypeORM)

## 🎯 Decisiones Arquitectónicas

16 decisiones técnicas explicadas en [docs/DECISIONS.md](./docs/DECISIONS.md):
- Por qué NestJS (no Express)
- Por qué Next.js (no Vue)
- Por qué PostgreSQL (no MongoDB)
- Por qué Zustand (no Redux)
- Por qué TailwindCSS
- Por qué MercadoPago primario
- Y más...

## ⚡ Quick Commands

```bash
# Setup local
cp .env.example .env
docker-compose up -d
cd packages/backend && npm install && npm run dev
cd packages/frontend && npm install && npm run dev

# Verify
curl http://localhost:3000/health      # Backend
curl http://localhost:3001             # Frontend

# Database
docker exec -it turnos-db psql -U turnos_user -d turnos_dev
\dt                                    # List tables
```

## 📞 Próximo Paso

👉 **Leer**: [START_HERE.md](./START_HERE.md)

O directamente:

```bash
cp .env.example .env
docker-compose up -d
```

## 👨‍💻 Desarrollado con

- Node.js 20
- TypeScript 5
- NestJS 10
- Next.js 14
- PostgreSQL 16
- Docker 24
- Git

## 📄 Licencia

UNLICENSED - Proyecto privado

---

**Status**: Phase 1 ✅ - Ready for Phase 2  
**Iniciado**: 2 Enero 2026  
**Próxima revisión**: Después de Auth implementation
