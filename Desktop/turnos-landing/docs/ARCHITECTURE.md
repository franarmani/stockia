# 🏗️ Arquitectura Multi-Tenant de Turnos SaaS

## 1. Conceptos Clave

### Multi-Tenancy
- **Single Database, Row-Level Isolation**: Todos los tenants en la misma BD, pero aislados por `company_id`
- **Security**: JWT incluye `company_id`, todas las queries filtran por tenant
- **Escalabilidad**: Fácil de escalar verticalmente

### Estructura de Datos
```
┌─────────────────────────────────────────┐
│         SHARED DATABASE                 │
├─────────────────────────────────────────┤
│ Companies (id, name, subdomain...)      │
│ Users (id, company_id, email...)        │
│ Services (id, company_id, name...)      │
│ Employees (id, company_id, name...)     │
│ Appointments (id, company_id, ...)      │
│ Clients (id, company_id, phone...)      │
│ Subscriptions (id, company_id, plan...) │
└─────────────────────────────────────────┘
```

## 2. Tablas Principales

### Companies (Tenants)
- `id`: UUID principal
- `name`: Nombre del negocio
- `subdomain`: mipeluqueria.tuelsistema.com
- `slug`: Identificador único
- `logo_url`: Logo del negocio
- `address`, `phone`, `email`
- `category`: Peluquería, estética, etc.
- `subscription_plan`: free, basic, pro
- `subscription_status`: active, trial, expired
- `trial_ends_at`: Fecha fin prueba
- `created_at`, `updated_at`

### Users (Trabajadores + Admin)
- `id`: UUID
- `company_id`: FK a Companies (isolación)
- `email`: Único por empresa
- `password_hash`
- `first_name`, `last_name`
- `role`: admin, employee
- `is_active`: Bool
- `created_at`

### Services (Servicios que ofrece el negocio)
- `id`: UUID
- `company_id`: FK (aislamiento)
- `name`: "Corte de cabello"
- `description`: HTML
- `price`: Decimal
- `duration_minutes`: 30, 60, etc
- `type`: presencial, online, domicilio
- `deposit_percent`: 20 (seña 20%)
- `is_active`: Bool

### Employees (Personal del negocio)
- `id`: UUID
- `company_id`: FK
- `first_name`, `last_name`
- `email`, `phone`
- `service_ids`: JSON array de servicios que hace
- `schedule`: JSON con horarios
- `is_active`: Bool

### Appointments (Turnos)
- `id`: UUID
- `company_id`: FK (crítico para queries)
- `client_id`: FK a Clients
- `employee_id`: FK a Employees
- `service_id`: FK a Services
- `start_time`: Datetime
- `end_time`: Datetime
- `status`: confirmed, pending, cancelled, no_show
- `notes`: Notas internas
- `created_at`

### Clients (Clientes del negocio)
- `id`: UUID
- `company_id`: FK
- `phone`: WhatsApp
- `email`: Para notificaciones
- `name`: Nombre cliente
- `total_spent`: Decimal
- `last_appointment_at`: Datetime

### Subscriptions
- `id`: UUID
- `company_id`: FK UNIQUE (1 suscripción por empresa)
- `plan`: free, basic, pro
- `status`: active, trial, expired
- `current_period_start`: Datetime
- `current_period_end`: Datetime
- `payment_method`: mercadopago, stripe
- `payment_id`: ID del pago externo
- `auto_renew`: Bool

## 3. Índices Críticos (Performance)

```sql
-- Queries más frecuentes
CREATE INDEX idx_appointments_company_date 
  ON appointments(company_id, start_time);
  
CREATE INDEX idx_appointments_client 
  ON appointments(company_id, client_id);
  
CREATE INDEX idx_services_company 
  ON services(company_id);
  
CREATE INDEX idx_employees_company 
  ON employees(company_id);
```

## 4. Seguridad Multi-Tenant

### JWT Payload
```json
{
  "sub": "user-id",
  "company_id": "company-uuid",
  "email": "admin@peluqueria.com",
  "role": "admin",
  "iat": 1234567890,
  "exp": 1234654290
}
```

### Regla de Oro en Backend
```typescript
// ❌ NUNCA hacer esto:
const appointments = await Appointment.find({ clientId: req.query.clientId });

// ✅ SIEMPRE filtrar por tenant:
const appointments = await Appointment.find({
  company_id: req.user.company_id,  // Del JWT
  client_id: req.query.clientId
});
```

## 5. Flujos de Datos

### Registro de Empresa
```
1. POST /auth/register
2. Crear Company
3. Crear User (admin)
4. Crear Subscription (plan: trial)
5. Retornar JWT con company_id
```

### Crear Turno (Vía Panel Admin)
```
1. POST /api/appointments (empresa autenticada)
2. Validar: empresa, cliente, empleado, servicio
3. Crear appointment con company_id del JWT
4. Enviar SMS/Email al cliente
```

### Crear Turno (Vía Link Público)
```
1. GET /book/peluqueria-juan (sin auth)
2. Mostrar servicios/empleados de esa empresa
3. POST /api/public/appointments/:company_slug
4. Crear appointment sin token (validar captcha)
5. Enviar confirmación
```

## 6. Base de Datos: Tabla de Aislamiento

Para queries complejas, siempre mantener `company_id`:

| Tabla | Tiene company_id | Filtrado obligatorio |
|-------|-------------------|---------------------|
| Companies | ID es PK | No (1 query por slug) |
| Users | FK | Sí |
| Services | FK | Sí |
| Employees | FK | Sí |
| Appointments | FK | Sí |
| Clients | FK | Sí |
| Subscriptions | FK UNIQUE | Sí |

## 7. Consideraciones de Escalabilidad

**Fase 1 (Ahora)**: Single database, row-level isolation

**Fase 2 (Futuro)**: Database-per-tenant si necesitas:
- Aislamiento total
- Performance garantizado
- Soporte para múltiples DBs

## 8. Diagrama ER Simplificado

```
┌──────────────┐
│  Companies   │
│  id (PK)     │
└──────┬───────┘
       │
       ├─────────────────┬──────────────┬──────────────┐
       │                 │              │              │
    ┌──┴──┐         ┌───┴───┐     ┌────┴───┐    ┌─────┴────┐
    │Users│         │Service │    │Employee│    │Subscription
    │     │         │        │    │        │    │
    └─────┘         └────┬───┘    └────┬───┘    └──────────┘
                         │             │
                    ┌────┴─────┐      │
                    │Appointments    │
                    │(FK service)    │
                    └────┬─────┘      │
                         │           │
                    ┌────┴─────┐     │
                    │  Clients      │
                    │(FK company)───┘
                    └───────────┘
```

## Próximos Pasos

1. ✅ Arquitectura definida
2. 🔄 Crear schema SQL completo
3. 🔄 Setup NestJS con TypeORM
4. 🔄 Setup Next.js + auth
5. 🔄 Docker compose
