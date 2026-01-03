```
🎯 TURNOS SAAS - PROJECT STRUCTURE
═══════════════════════════════════════════════════════════════

turnos-landing/
│
├── 📦 PACKAGES (Workspace monorepo)
│   │
│   ├── packages/backend/
│   │   ├── src/
│   │   │   ├── main.ts                    # Entry point
│   │   │   ├── app.module.ts              # Main module
│   │   │   ├── app.controller.ts          # Health check
│   │   │   │
│   │   │   └── modules/                   # Feature modules
│   │   │       ├── auth/                  # Login, register, JWT
│   │   │       ├── companies/             # Tenant management
│   │   │       ├── users/                 # Admin + employees
│   │   │       ├── appointments/          # Core: turnos
│   │   │       ├── services/              # Servicios del negocio
│   │   │       ├── employees/             # Personal
│   │   │       ├── clients/               # Clientes
│   │   │       └── subscriptions/         # Planes y pagos
│   │   │
│   │   ├── dist/                          # Compiled output
│   │   ├── Dockerfile                     # Docker image
│   │   ├── package.json                   # Dependencies
│   │   ├── tsconfig.json                  # TypeScript config
│   │   └── .env                           # Environment (ignored)
│   │
│   ├── packages/frontend/
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── layout.tsx             # Root layout
│   │   │   │   ├── page.tsx               # Home page
│   │   │   │   ├── (auth)/                # Auth routes
│   │   │   │   ├── (dashboard)/           # Protected routes
│   │   │   │   └── [slug]/                # Dynamic routes (public booking)
│   │   │   │
│   │   │   ├── components/                # Reusable React components
│   │   │   │   ├── Header.tsx
│   │   │   │   ├── Navigation.tsx
│   │   │   │   ├── Calendar.tsx
│   │   │   │   └── ...
│   │   │   │
│   │   │   ├── lib/
│   │   │   │   └── api.ts                 # Axios instance + interceptors
│   │   │   │
│   │   │   ├── store/
│   │   │   │   └── authStore.ts           # Zustand auth state
│   │   │   │
│   │   │   ├── hooks/                     # Custom React hooks
│   │   │   ├── types/                     # TypeScript interfaces
│   │   │   └── styles/
│   │   │       └── globals.css            # Global + TailwindCSS
│   │   │
│   │   ├── public/                        # Static assets
│   │   ├── .next/                         # Build output (ignored)
│   │   ├── next.config.js                 # Next.js config
│   │   ├── tailwind.config.ts             # Tailwind config
│   │   ├── postcss.config.js              # PostCSS config
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── .env.local                     # Environment (ignored)
│   │
│   └── packages/database/
│       ├── init.sql                       # SQL schema + tables
│       ├── migrations/                    # Future: TypeORM migrations
│       └── seeds/                         # Future: test data
│
├── 📚 DOCS (Documentation)
│   ├── ARCHITECTURE.md                    # Multi-tenant design
│   ├── API.md                             # All endpoints reference
│   ├── ROADMAP.md                         # 10-phase development plan
│   ├── DECISIONS.md                       # Why each tech was chosen
│   └── (more guides in future)
│
├── 🐳 DOCKER
│   ├── docker-compose.yml                 # Services: postgres, redis, backend
│   └── .dockerignore
│
├── ⚙️ CONFIG
│   ├── .env.example                       # Template for all env vars
│   ├── .gitignore                         # Git ignore rules
│   ├── pnpm-workspace.yaml                # Monorepo config
│   └── .github/
│       └── workflows/                     # Future: CI/CD
│
├── 📖 GUIDES
│   ├── START_HERE.md                      # 👈 Read this first!
│   ├── SETUP.md                           # Step-by-step local setup
│   └── README.md                          # Project overview
│
└── 📄 PROJECT METADATA
    ├── package.json                       # Root workspace
    └── (all config at package level)

═══════════════════════════════════════════════════════════════

🎯 KEY FEATURES (What's Ready)

✅ Multi-tenant architecture (single DB, row-level isolation)
✅ 9 database tables with full relations
✅ TypeORM integration (ready for migrations)
✅ NestJS modular structure (8 modules pre-created)
✅ Next.js App Router (modern React 18)
✅ TailwindCSS + component structure
✅ Zustand state management
✅ JWT auth pattern (ready to implement)
✅ Docker dev environment
✅ PostgreSQL + Redis
✅ API route examples
✅ Complete documentation

═══════════════════════════════════════════════════════════════

🔄 DATA FLOW (High Level)

┌──────────────┐
│   Browser    │ (Next.js frontend)
└──────┬───────┘
       │ HTTP + JWT in Headers
       ↓
┌──────────────────┐
│  NestJS API      │ (Backend port 3000)
│  - Validates JWT │
│  - Filters by    │
│    company_id    │
└────────┬─────────┘
         │ SQL
         ↓
┌─────────────────────────┐
│   PostgreSQL DB         │
│ (One DB, all companies) │
│ (Isolated by company_id)│
└──────────┬──────────────┘
           │
           ↓
┌──────────────────┐
│  Redis Cache     │
│ - Session tokens │
│ - Rate limiting  │
│ - Temp data      │
└──────────────────┘

═══════════════════════════════════════════════════════════════

🗄️ DATABASE TABLES (PostgreSQL)

1. companies          [id, name, subdomain, slug, subscription_plan, ...]
2. users             [id, company_id FK, email, role, ...]
3. services          [id, company_id FK, name, price, duration, ...]
4. employees         [id, company_id FK, name, service_ids[], schedule JSONB, ...]
5. clients           [id, company_id FK, name, phone, email, ...]
6. appointments      [id, company_id FK, client_id FK, employee_id FK, ...]
7. subscriptions     [id, company_id FK UNIQUE, plan, status, ...]
8. payments          [id, company_id FK, subscription_id FK, ...]
9. audit_logs        [id, company_id FK, action, entity_type, ...]

All queries MUST filter by company_id from JWT token ⚠️

═══════════════════════════════════════════════════════════════

📡 COMMUNICATION PATTERN (Simplified)

User registers company:
1. POST /auth/register
2. NestJS validates & creates Companies row
3. Creates Users row (admin user)
4. Creates Subscriptions row (trial plan)
5. Returns JWT with company_id + user data
6. Frontend stores JWT in Zustand + localStorage

User creates appointment:
1. POST /api/appointments (with JWT)
2. NestJS guard extracts company_id from JWT
3. Only fetches employees/clients/services of that company_id
4. Creates appointment with company_id
5. Sends SMS + Email notification
6. Returns created appointment

Public booking (no JWT):
1. User visits: /book/mi-peluqueria
2. Next.js fetches company by slug
3. Shows available times
4. POST /public/appointments/:slug (no auth, reCAPTCHA instead)
5. Creates appointment (company found by slug)

═══════════════════════════════════════════════════════════════

✨ NEXT STEPS (Priority Order)

Phase 1 (Done ✅): Foundation
  ✅ Architecture
  ✅ Database
  ✅ Project structure
  ✅ Documentation

Phase 2 (Next 🔄): Authentication
  🔄 Implement AuthService
  🔄 Create login page
  🔄 Create register page
  🔄 JWT guards

Phase 3: Landing Page
  🔄 Hero section
  🔄 Features showcase
  🔄 Pricing plans
  🔄 CTA buttons

Phase 4: Dashboard
  🔄 Appointments calendar
  🔄 Clients management
  🔄 Services CRUD
  🔄 Employees management

... (8 more phases, see ROADMAP.md)

═══════════════════════════════════════════════════════════════

🚀 QUICK START

1. Copy .env
   cp .env.example .env

2. Start database
   docker-compose up -d

3. Backend
   cd packages/backend
   npm install && npm run dev

4. Frontend (new terminal)
   cd packages/frontend
   npm install && npm run dev

5. Open http://localhost:3001

═══════════════════════════════════════════════════════════════

📊 STACK AT A GLANCE

Frontend  → Next.js 14 + React 18 + TailwindCSS + Zustand
Backend   → NestJS + TypeScript + TypeORM
Database  → PostgreSQL 16 + Redis 7
Auth      → JWT (15m) + Refresh Token (7d) + Secure Cookie
Payments  → MercadoPago + Stripe (ready)
Deploy    → Docker + VPS/Cloud (ready for any provider)
Testing   → Jest + Playwright (configured)

═══════════════════════════════════════════════════════════════

📝 IMPORTANT FILES TO READ

1. START_HERE.md       ← Read this first! Quick overview
2. SETUP.md            ← Step-by-step to get running
3. docs/ARCHITECTURE.md ← Understand the system design
4. docs/ROADMAP.md     ← See the full development plan
5. docs/API.md         ← All API endpoints documented
6. docs/DECISIONS.md   ← Why each tech choice

═══════════════════════════════════════════════════════════════

⚡ COMMANDS REFERENCE

Backend:
  npm run dev         → Start development server
  npm run build       → Build for production
  npm run lint        → Check code style
  npm test            → Run tests

Frontend:
  npm run dev         → Start Next.js dev server
  npm run build       → Build for production
  npm run start       → Start production server
  npm run type-check  → TypeScript check

Docker:
  docker-compose up -d    → Start services
  docker-compose down     → Stop services
  docker-compose logs -f  → View logs

Database:
  docker exec -it turnos-db psql -U turnos_user -d turnos_dev

═══════════════════════════════════════════════════════════════

Ready to build the next Tuturno? 🚀

The foundation is solid. Time to code!

═══════════════════════════════════════════════════════════════
```
