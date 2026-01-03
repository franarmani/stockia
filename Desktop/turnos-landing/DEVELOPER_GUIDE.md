# 🎓 Guía para el Siguiente Developer

Bienvenido al proyecto Turnos SaaS. Si eres nuevo aquí, esta guía te ayudará a entender qué está pasando.

## 🎯 En 30 Segundos

Este es un SaaS multi-tenant de gestión de turnos (tipo Tuturno).

- **Frontend**: Next.js 14 + React + TailwindCSS
- **Backend**: NestJS + PostgreSQL
- **Estado**: Fase 1 completada (Architecture + Setup)
- **Próximo**: Fase 2 (Authentication)

## 📖 Leer en Orden

### 1️⃣ Entender el Proyecto (10 min)
```
START_HERE.md
└─ "Qué es esto? Por qué fue hecho?"
```

### 2️⃣ Entender la Arquitectura (30 min)
```
docs/ARCHITECTURE.md
└─ "Cómo están organizados los datos?"
└─ "Por qué multi-tenant?"
└─ "Cómo se asla cada empresa?"
```

### 3️⃣ Entender las Decisiones (20 min)
```
docs/DECISIONS.md
└─ "Por qué NestJS?"
└─ "Por qué Next.js?"
└─ "Por qué PostgreSQL?"
```

### 4️⃣ Ver el Código Organizado
```
PROJECT_MAP.md
└─ "Estructura visual del proyecto"
└─ "Dónde va cada cosa"
```

### 5️⃣ Entender el Plan (20 min)
```
docs/ROADMAP.md
└─ "10 fases del desarrollo"
└─ "Qué se hace en cada una"
└─ "Timeline total"
```

## 🚀 Setup Local en 10 Minutos

```bash
# 1. Copiar variables
cp .env.example .env

# 2. Levantar BD + Redis
docker-compose up -d

# 3. Backend (terminal 1)
cd packages/backend
npm install
npm run dev
# → http://localhost:3000

# 4. Frontend (terminal 2)
cd packages/frontend
npm install
npm run dev
# → http://localhost:3001

# 5. Verificar
curl http://localhost:3000/health
# Response: { "status": "ok" }
```

Más detalles: [SETUP.md](./SETUP.md)

## 💾 Base de Datos Entendida

**9 tablas con relaciones**:

```
companies (el tenant)
├── users (admin + employees)
├── services (qué venden)
├── employees (quién lo vende)
├── appointments (los turnos - LO MÁS IMPORTANTE)
├── clients (quién compra)
├── subscriptions (qué plan tiene)
├── payments (transacciones)
└── audit_logs (para debugging)
```

**Regla de Oro**: Cada fila tiene `company_id` para aislar.

Ver: [docs/ARCHITECTURE.md#2-tablas-principales](./docs/ARCHITECTURE.md#2-tablas-principales)

## 🧠 Concepto Clave: Multi-Tenancy

**Simple**: Un mismo software para 1000 empresas diferentes.

```
Peluquería A ──┐
Peluquería B ──┤─→ PostgreSQL (1 sola BD)
Peluquería C ──┘
(aisladas por company_id)
```

**Ventaja**: Escalable, económico, fácil de mantener.

**Riesgo**: Si hay bug en filtro `company_id`, una empresa ve datos de otra.

**Por eso**: TODOS los queries deben filtrar `WHERE company_id = ?`

## 🔍 Dónde Está Cada Cosa

| Necesitas... | Está en... |
|-------------|-----------|
| Entender el proyecto | [START_HERE.md](./START_HERE.md) |
| Setup local | [SETUP.md](./SETUP.md) |
| Ver estructura | [PROJECT_MAP.md](./PROJECT_MAP.md) |
| Arquitectura | [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) |
| APIs | [docs/API.md](./docs/API.md) |
| Plan desarrollo | [docs/ROADMAP.md](./docs/ROADMAP.md) |
| Tech choices | [docs/DECISIONS.md](./docs/DECISIONS.md) |
| Backend code | `packages/backend/src/` |
| Frontend code | `packages/frontend/src/` |
| DB schema | `packages/database/init.sql` |

## 🏗️ Backend (NestJS) - Estructura

```
packages/backend/src/
├── main.ts              ← Start here
├── app.module.ts        ← Imports everything
├── app.controller.ts    ← GET /health
└── modules/
    ├── auth/           ← Login + Register (🔄 TO DO)
    ├── companies/      ← Tenant management
    ├── users/          ← Admin + Employees
    ├── appointments/   ← Turnos (CORE)
    ├── services/       ← Servicios del negocio
    ├── employees/      ← Personal
    ├── clients/        ← Clientes
    └── subscriptions/  ← Planes + Pagos
```

**Cada módulo es independiente**. Así es fácil agregar features.

## 🎨 Frontend (Next.js) - Estructura

```
packages/frontend/src/
├── app/
│   ├── layout.tsx      ← HTML principal
│   ├── page.tsx        ← Home (/)
│   ├── (auth)/         ← /login, /register
│   ├── (dashboard)/    ← /dashboard/* (protegido)
│   └── [slug]/         ← /book/:slug (pública)
├── components/         ← Componentes React reutilizables
├── lib/
│   └── api.ts          ← Axios configurado
├── store/
│   └── authStore.ts    ← Zustand (estado global)
├── hooks/              ← Custom React hooks
├── types/              ← TypeScript interfaces
└── styles/
    └── globals.css     ← TailwindCSS
```

## 🔄 Flujo de Datos (Simplificado)

```
1. User llena formulario (React component)
   ↓
2. Envía POST request (Axios desde lib/api.ts)
   ↓
3. Backend NestJS recibe (controller)
   ↓
4. Valida datos (class-validator)
   ↓
5. Filtra por company_id del JWT (IMPORTANTE!)
   ↓
6. Guarda en PostgreSQL
   ↓
7. Devuelve respuesta JSON
   ↓
8. Frontend actualiza estado (Zustand)
   ↓
9. React re-renderiza
```

## ✅ Checklist para Empezar a Codear

- [ ] Leí [START_HERE.md](./START_HERE.md)
- [ ] Leí [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- [ ] Corrí `docker-compose up -d`
- [ ] Backend arranca (`npm run dev`)
- [ ] Frontend arranca (`npm run dev`)
- [ ] Puedo conectarme a BD (`docker exec ...`)
- [ ] Entiendo el concepto multi-tenant
- [ ] Entiendo las 9 tablas
- [ ] Revisé [docs/ROADMAP.md](./docs/ROADMAP.md)

Si pasaste todo ✅, ¡estás listo para codear!

## 🚨 Reglas de Oro (NO ROMPER)

### 1. Siempre filtrar por company_id

```typescript
// ❌ MAL - un hacker ve todos los appointments
const appointments = await Appointment.find();

// ✅ BIEN - solo de su empresa
const appointments = await Appointment.find({
  company_id: req.user.company_id,  // Del JWT
});
```

### 2. JWT incluye company_id

```json
{
  "sub": "user-id",
  "company_id": "empresa-uuid",  ← Crítico!
  "email": "admin@peluqueria.com",
  "role": "admin"
}
```

### 3. Endpoints públicos (SIN JWT) usan slug

```
GET /book/mi-peluqueria        ← Slug, no company_id
POST /public/appointments/:slug ← Búsca empresa por slug
```

### 4. Validar entrada del usuario

```typescript
// Siempre usar DTOs con validación
export class CreateAppointmentDto {
  @IsNotEmpty()
  @IsUUID()
  client_id: string;
  
  @IsDateString()
  start_time: string;
}
```

## 🎓 Concepto: TypeORM (ORM para BD)

```typescript
// En lugar de escribir SQL directo:
SELECT * FROM appointments WHERE company_id = $1

// Escribes TypeScript:
const appointments = await Appointment.find({
  where: { company_id: companyId }
});
```

**Ventaja**: Type-safe, menos SQL injection

## 🎓 Concepto: Decoradores de NestJS

```typescript
// NestJS usa decoradores para magia:

@Controller('appointments')           // Ruta: /appointments
@UseGuards(AuthGuard('jwt'))         // Requiere JWT
export class AppointmentsController {
  
  @Get()                              // GET /appointments
  @Public()                           // Salta el guard
  getPublic() { ... }
  
  @Post()                             // POST /appointments
  create(@Body() dto: CreateDto) { ... }
}
```

## 🎨 Concepto: TailwindCSS

```html
<!-- No escribes CSS, usas clases -->
<button class="px-4 py-2 bg-blue-600 text-white rounded-lg">
  Crear turno
</button>

<!-- Está pre-definido en tailwind.config.ts -->
```

## 📊 Concepto: Zustand (State Management)

```typescript
// En lugar de Redux (mucho boilerplate):
const useAuthStore = create((set) => ({
  user: null,
  setUser: (user) => set({ user }),
}));

// En un componente:
const { user } = useAuthStore();
```

## 🔐 Seguridad: JWT Flow

```
1. Usuario hace login (email + password)
2. Backend genera JWT (válido 15 min)
3. Frontend lo guarda en localStorage
4. Cada request incluye: "Authorization: Bearer JWT"
5. Backend valida JWT con secret
6. Extrae company_id del token
7. Filtra datos por company_id
```

## 🐛 Si Algo Falla

1. **BD no arranca**: `docker-compose logs postgres`
2. **Backend error**: `npm run build` (compila TypeScript)
3. **Frontend error**: `npm cache clean --force`
4. **Puerto ocupado**: Cambiar en `.env`

Ver [SETUP.md#troubleshooting](./SETUP.md#troubleshooting) para más.

## 🎯 Próxima Fase (Cuándo sea)

```
Fase 2: Autenticación (6-8 horas)
├─ AuthService completo
├─ Login page
├─ Register page
├─ JWT guards
└─ Protected routes

Luego:
├─ Fase 3: Landing page
├─ Fase 4: Dashboard (Agenda)
├─ Fase 5: Página pública
├─ ... (10 fases totales)
```

Ver [docs/ROADMAP.md](./docs/ROADMAP.md)

## 💬 Convenciones del Código

```typescript
// Naming:
// - variables: camelCase (userId)
// - constants: UPPER_SNAKE_CASE (API_URL)
// - classes: PascalCase (AppointmentService)
// - interfaces: IPascalCase o PascalCase (IUser)

// Estructura:
// - 1 clase por archivo
// - Archivos descriptivos (appointment.service.ts)
// - Carpetas por feature (auth/, appointments/)

// TypeScript:
// - Siempre tipado: const users: User[] = []
// - No usar any
// - Usar interfaces para objetos
```

## 📚 Recursos Útiles

- [NestJS Docs](https://docs.nestjs.com)
- [Next.js Docs](https://nextjs.org/docs)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)
- [TypeORM Docs](https://typeorm.io/)
- [TailwindCSS Docs](https://tailwindcss.com/docs)

## ❓ Preguntas Frecuentes

**P: ¿Dónde agrego una nueva tabla?**
R: `packages/database/init.sql` + Entidad TypeORM en backend

**P: ¿Dónde agrego una nueva página?**
R: `packages/frontend/src/app/` (Next.js App Router)

**P: ¿Cómo pruebo una API?**
R: `curl` o Postman. Headers: `Authorization: Bearer {jwt_token}`

**P: ¿Cómo veo los logs de BD?**
R: `docker-compose logs -f postgres`

**P: ¿Cómo reseteo la BD?**
R: `docker-compose down -v && docker-compose up -d`

## 🚀 Siguiente Paso

1. Leer [START_HERE.md](./START_HERE.md)
2. Hacer setup local ([SETUP.md](./SETUP.md))
3. Verificar todo funciona ([VERIFICATION.md](./VERIFICATION.md))
4. Explorar código
5. **Cuando el equipo diga**: "Ahora armá autenticación"

---

**¡Bienvenido al equipo!**

Cualquier duda, revisa la documentación o pide help. Todo está bien documentado.

**Now go build something awesome.** 🚀

---

**Last update**: 2 Enero 2026  
**Audience**: New developers starting the project  
**Reading time**: 20-30 min
