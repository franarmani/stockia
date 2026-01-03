# 📋 Decisiones Arquitectónicas

Este documento explica el **POR QUÉ** detrás de cada decisión arquitectónica.

---

## 1. Multi-Tenancy: Single Database vs Database per Tenant

### Decisión: **Single Database con Row-Level Isolation**

### Pros ✅
- Más fácil de mantener (1 sola BD)
- Escalabilidad vertical simple
- Backups unificados
- Más económico en hosting
- Migración de datos más simple

### Contras ❌
- Riesgo de data leak si SQL injection
- Performance puede degradarse con muchos tenants
- Menos isolación física

### Alternativa Rechazada: Database per Tenant
```
Sería:
- Peluqueria1_DB
- Peluqueria2_DB
- Peluqueria3_DB
```

**Por qué NO**: Overkill para fase 1, mantenimiento complejo, más caro.

**Cuando Migrar**: Si tenés 10000+ tenants activos o SLA críticos.

---

## 2. Stack Backend: NestJS vs Express vs Fastify

### Decisión: **NestJS**

### Por qué NestJS ✅
- **Arquitectura modular**: Parfecto para multi-tenancy
- **TypeScript first**: Type safety garantizado
- **Middleware/Guards/Interceptors**: Control fino de seguridad
- **Built-in decorators**: @UseGuards, @Public, etc.
- **Enterprise ready**: Usado en startups grandes
- **Documentación excelente**: Comunidad activa

### Express (Rechazado)
```typescript
// Express: Código desorganizado
app.get('/appointments', authenticateJWT, (req, res) => {
  // Fácil olvidar validar company_id aquí
  const appointments = await db.appointments.find();
});
```

NestJS obliga estructura:
```typescript
@Controller('appointments')
@UseGuards(AuthGuard)
export class AppointmentsController {
  // company_id del JWT inyectado automáticamente
}
```

---

## 3. Frontend: Next.js vs Vue vs Svelte

### Decisión: **Next.js 14 con App Router**

### Por qué Next.js ✅
- **SSR + SSG**: SEO y performance
- **File-based routing**: Estructura clara
- **API routes**: Backend + Frontend en 1 repo (opcional)
- **Image optimization**: Automático
- **Deploy simple**: Vercel, otros
- **Community**: Ecosistema gigante

### Alternativas Rechazadas
- **Vue**: Más pequeño, menos enterprise
- **Svelte**: Nuevo, comunidad menor, testing complicado
- **CRA (Create React App)**: Deprecado, Next.js es mejor

---

## 4. Base de Datos: PostgreSQL vs MongoDB vs MySQL

### Decisión: **PostgreSQL**

### Por qué PostgreSQL ✅
- **ACID garantizado**: Transacciones seguras
- **JSONB support**: Campos JSON con índices
- **Row-level security**: Multi-tenancy nativa (RLS)
- **Full-text search**: Builtin
- **Window functions**: Reportes complejos
- **PostGIS**: Si necesitas geolocalización
- **Trigger support**: Auditoría automática

### MongoDB (Rechazado)
```javascript
// Sin foreign keys = problema para multi-tenancy
db.appointments.find({ companyId: "X", clientId: "Y" })
// Fácil errar y mezclar datos entre empresas
```

PostgreSQL obliga integridad:
```sql
FOREIGN KEY (company_id) REFERENCES companies(id)
-- Imposible crear turno sin empresa válida
```

---

## 5. Autenticación: JWT vs Session + Cookie vs OAuth

### Decisión: **JWT + Refresh Token + Secure Cookie**

### Estructura
```
┌─────────────────────┐
│   Access Token      │
│   JWT (15 min)      │ → Headers
│   Corta duración    │
└─────────────────────┘

┌─────────────────────┐
│  Refresh Token      │
│   JWT (7 días)      │ → Secure Cookie
│   Larga duración    │
└─────────────────────┘
```

### Por qué esta combinación ✅
- **JWT**: Stateless, escalable
- **Refresh Token**: Seguridad mejorada (no guardamos sesión)
- **Secure Cookie**: No susceptible a XSS
- **company_id en token**: Aislamiento automático
- **Role en token**: RBAC sin queries

### Alternativa: Pure OAuth
```
✗ Dependencia de terceros
✗ Más lento (redirección)
✗ Overkill para SaaS interno
```

---

## 6. State Management Frontend: Zustand vs Redux vs Context

### Decisión: **Zustand**

### Por qué Zustand ✅
- **Minimalista**: ~1KB vs Redux ~8KB
- **Boilerplate minimal**: Menos código
- **TypeScript native**: Full type safety
- **Fácil testing**: No mockers complejos
- **Hook-based**: Moderno

```typescript
// Zustand: Simple
const useAuthStore = create((set) => ({
  user: null,
  setUser: (user) => set({ user }),
}));

// Redux: Tedioso
// actions, reducers, selectors...
```

---

## 7. Styling: TailwindCSS vs styled-components vs CSS Modules

### Decisión: **TailwindCSS**

### Por qué TailwindCSS ✅
- **Utility-first**: Rápido de prototipar
- **Pequeño bundle**: ~50KB
- **Consistencia visual**: Design system integrado
- **Dark mode**: Built-in
- **Performance**: Purga de CSS automática
- **Community**: Templates, librerías

### Alternativa rechazada: styled-components
```javascript
// Bonito pero overkill para SaaS
const Button = styled.button`
  padding: ${props => props.padding};
`;
// 1. Runtime overhead
// 2. Más bundle
// 3. Menos performance
```

---

## 8. Validación: class-validator vs Zod vs Yup

### Backend (NestJS): **class-validator**

```typescript
// Integrado con NestJS pipes
export class CreateAppointmentDto {
  @IsUUID()
  @IsNotEmpty()
  client_id: string;

  @IsDateString()
  start_time: string;

  @Min(0)
  duration_minutes: number;
}
```

**Por qué**: NestJS built-in, auto-documentación Swagger

### Frontend: **Zod** (o native HTML5)

```typescript
const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
```

**Por qué**: Más ligero que Yup, TypeScript first

---

## 9. Testing: Jest vs Vitest vs Mocha

### Decisión: **Jest**

### Por qué Jest ✅
- **NestJS default**: Ya configurado
- **Coverage built-in**: `--coverage`
- **Mocking automático**: Jest.mock()
- **Snapshot testing**: Para UI

```bash
# Backend
npm test

# Frontend
npm run test
```

---

## 10. Hosting: VPS vs Heroku vs Vercel vs AWS

### Decisión: **Fase 1-2: Simple (VPS)** → **Fase 3+: Cloud**

### Fase Inicial (hasta 100 empresas)
```
Provider: DigitalOcean / Linode / Hetzner
- Backend + Frontend: Ubuntu 22.04 VPS
- PostgreSQL: Managed o local
- Redis: Local o managed
- Costo: ~$50-100/mes
```

### Escalado (más de 100 empresas)
```
Provider: AWS / GCP / Azure
- Backend: ECS/Kubernetes
- Frontend: Vercel
- DB: RDS PostgreSQL
- Cache: ElastiCache
- CDN: CloudFront
- Costo: $500-2000+/mes
```

### Por qué NO Heroku Ahora
```
✗ $150+ mínimo
✗ Cold starts
✗ Más caro a escala
→ Para MVP, overkill
```

---

## 11. Payments: MercadoPago vs Stripe vs Paypal

### Decisión: **MercadoPago + Opción Stripe**

### MercadoPago (Primario)
```
✅ 70% de LATAM usa MP
✅ Menor comisión para LATAM
✅ Documentación en español
✅ Sin necesidad de banco en USA
✅ Billetera MP integrada
```

### Stripe (Fallback)
```
✅ Para clientes internacionales
✅ Mejor soporte técnico
✅ Más pagos aceptados
```

### Integración
```
🔄 Webhook → confirma pago
🔄 Si pago OK → empresa activa
🔄 Si falla → bloquea acceso
```

---

## 12. Email: SendGrid vs Mailgun vs AWS SES

### Decisión: **SendGrid**

### Por qué SendGrid ✅
- **API simple**: 1 endpoint = 1 email
- **Templates**: HTML visual builder
- **Deliverability**: 99.99% uptime
- **Pricing**: $20/mes → 40K emails
- **Integración**: npm sendgrid muy fácil

---

## 13. SMS/WhatsApp: Twilio vs Bandwidth vs vonage

### Decisión: **Twilio**

### Por qué Twilio ✅
- **WhatsApp oficial**: Integración nativa
- **Global**: SMS en 200+ países
- **SDKs**: Node.js super simple
- **Reliability**: 99.95% SLA

---

## 14. File Storage: AWS S3 vs Cloudinary vs local

### Decisión: **AWS S3** (o DigitalOcean Spaces)

```
Casos de uso:
- Logo de empresa
- Imágenes de servicios
- Documentos (facturas)
```

### Por qué S3 ✅
- **Escalable**: Upload ilimitado
- **CDN**: CloudFront integrado
- **Cheap**: $0.023 por GB
- **Durable**: 99.999999999% durability

### Local Storage (NO)
```
✗ Limitado en VPS
✗ No escalable
✗ Backups manuales
→ Solo para dev
```

---

## 15. Logging & Monitoring: Sentry vs Datadog vs New Relic

### Decisión: **Sentry (Fase 1)** → **Datadog (Fase 3+)**

### Sentry (Ahora)
```
Plan Free:
✅ Error tracking automático
✅ Stack traces con source maps
✅ Performance monitoring básico
✅ Integración 1-click con Next.js

Implementación:
npm install @sentry/nextjs
npm install @sentry/node
```

### Datadog (Escalado)
```
Cuando tengas 1000+ usuarios:
✅ Análisis de performance
✅ APM (Application Performance Monitoring)
✅ Infrastructure monitoring
✅ Custom dashboards
```

---

## 16. CI/CD: GitHub Actions vs CircleCI vs GitLab

### Decisión: **GitHub Actions**

### Por qué GitHub Actions ✅
- **Free**: 2000 minutos/mes
- **Integrado**: Mismo repo
- **Sintaxis YAML**: Simple
- **Workflows**: Tests + Deploy automático

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm test
```

---

## Resumen de Decisiones Clave

| Decisión | Elegido | Alternativa | Score |
|----------|---------|------------|-------|
| Multi-tenancy | Single DB | Per-tenant | ⭐⭐⭐⭐⭐ |
| Backend | NestJS | Express | ⭐⭐⭐⭐⭐ |
| Frontend | Next.js | Vue/Svelte | ⭐⭐⭐⭐⭐ |
| Database | PostgreSQL | MongoDB | ⭐⭐⭐⭐⭐ |
| Auth | JWT + Refresh | OAuth | ⭐⭐⭐⭐ |
| State | Zustand | Redux | ⭐⭐⭐⭐⭐ |
| Styling | Tailwind | styled-comp | ⭐⭐⭐⭐⭐ |
| Testing | Jest | Vitest | ⭐⭐⭐⭐ |
| Hosting | VPS → Cloud | Heroku | ⭐⭐⭐⭐ |
| Payments | MercadoPago | Stripe | ⭐⭐⭐⭐ |

---

## Cambios Futuros Posibles

### 🔄 Si llega a 10K+ empresas
- Migrar a database-per-tenant
- Kubernetes + Auto-scaling
- Caché distribuido (Redis Cluster)

### 🔄 Si necesitas geo-redundancia
- Multi-region PostgreSQL
- Global CDN
- Edge functions

### 🔄 Si requieren compliance especial
- Encriptación end-to-end
- HIPAA/PCI-DSS compliance
- Audit logging avanzado

---

**Última actualización**: 2 Enero 2026  
**Status**: Architecture locked, ready for development
