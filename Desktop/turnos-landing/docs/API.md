# 📚 API Reference - Turnos SaaS

Base URL: `http://localhost:3000/api`

## 🔐 Authentication

### Register Company
```http
POST /auth/register
Content-Type: application/json

{
  "email": "admin@peluqueria.com",
  "password": "SecurePassword123",
  "company_name": "Mi Peluquería",
  "company_subdomain": "mi-peluqueria",
  "category": "peluqueria"
}

Response 201:
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": { ... },
  "company": { ... }
}
```

### Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "admin@peluqueria.com",
  "password": "SecurePassword123"
}

Response 200:
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": { ... },
  "company": { ... }
}
```

---

## 📅 Appointments (Turnos)

### Get All Appointments
```http
GET /appointments
Authorization: Bearer {token}

Response 200:
[
  {
    "id": "uuid",
    "client_id": "uuid",
    "employee_id": "uuid",
    "service_id": "uuid",
    "start_time": "2024-01-15T10:00:00Z",
    "end_time": "2024-01-15T10:30:00Z",
    "status": "confirmed",
    "notes": "..."
  }
]
```

### Create Appointment (Admin)
```http
POST /appointments
Authorization: Bearer {token}
Content-Type: application/json

{
  "client_id": "uuid",
  "employee_id": "uuid",
  "service_id": "uuid",
  "start_time": "2024-01-15T10:00:00Z",
  "notes": "Optional notes"
}

Response 201:
{ ... appointment data ... }
```

### Create Appointment (Public)
```http
POST /public/appointments/:company_slug
Content-Type: application/json

{
  "client_name": "Juan García",
  "client_phone": "+549111234567",
  "client_email": "juan@gmail.com",
  "service_id": "uuid",
  "employee_id": "uuid",
  "start_time": "2024-01-15T14:00:00Z"
}

Response 201:
{ ... appointment data ... }
```

### Cancel Appointment
```http
PATCH /appointments/:id/cancel
Authorization: Bearer {token}

Response 200:
{ ... appointment data with status: "cancelled" ... }
```

---

## 👥 Clients

### Get All Clients
```http
GET /clients
Authorization: Bearer {token}

Response 200:
[
  {
    "id": "uuid",
    "name": "Juan García",
    "phone": "+549111234567",
    "email": "juan@gmail.com",
    "total_spent": 5000,
    "appointments_count": 3
  }
]
```

### Create Client
```http
POST /clients
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Juan García",
  "phone": "+549111234567",
  "email": "juan@gmail.com"
}

Response 201:
{ ... client data ... }
```

---

## 🛠 Services

### Get All Services
```http
GET /services
Authorization: Bearer {token}

Response 200:
[
  {
    "id": "uuid",
    "name": "Corte de cabello",
    "price": 500,
    "duration_minutes": 30,
    "type": "presencial",
    "deposit_percent": 20
  }
]
```

### Create Service
```http
POST /services
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Corte de cabello",
  "description": "Corte profesional",
  "price": 500,
  "duration_minutes": 30,
  "type": "presencial",
  "deposit_type": "percentage",
  "deposit_amount": 20
}

Response 201:
{ ... service data ... }
```

---

## 👨‍💼 Employees

### Get All Employees
```http
GET /employees
Authorization: Bearer {token}

Response 200:
[
  {
    "id": "uuid",
    "first_name": "Carlos",
    "last_name": "Pérez",
    "email": "carlos@peluqueria.com",
    "service_ids": ["service-uuid-1", "service-uuid-2"],
    "schedule": { "monday": { "start": "09:00", "end": "18:00" } }
  }
]
```

### Create Employee
```http
POST /employees
Authorization: Bearer {token}
Content-Type: application/json

{
  "first_name": "Carlos",
  "last_name": "Pérez",
  "email": "carlos@peluqueria.com",
  "phone": "+549111234567",
  "service_ids": ["service-uuid-1"],
  "schedule": {
    "monday": { "start": "09:00", "end": "18:00" },
    "tuesday": { "start": "09:00", "end": "18:00" }
  }
}

Response 201:
{ ... employee data ... }
```

---

## 💳 Subscriptions

### Get Company Subscription
```http
GET /subscriptions/current
Authorization: Bearer {token}

Response 200:
{
  "id": "uuid",
  "plan": "basic",
  "status": "active",
  "current_period_start": "2024-01-01T00:00:00Z",
  "current_period_end": "2024-02-01T00:00:00Z"
}
```

### Upgrade Plan
```http
POST /subscriptions/upgrade
Authorization: Bearer {token}
Content-Type: application/json

{
  "plan": "pro"
}

Response 200:
{ ... updated subscription data ... }
```

---

## 🔧 Company Settings

### Get Company Info
```http
GET /companies/me
Authorization: Bearer {token}

Response 200:
{
  "id": "uuid",
  "name": "Mi Peluquería",
  "subdomain": "mi-peluqueria",
  "email": "admin@peluqueria.com",
  "category": "peluqueria"
}
```

### Update Company Info
```http
PATCH /companies/me
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Mi Peluquería Actualizada",
  "logo_url": "https://...",
  "address": "Av. Siempre Viva 123"
}

Response 200:
{ ... updated company data ... }
```

---

## Error Responses

### 400 Bad Request
```json
{
  "statusCode": 400,
  "message": "Invalid input",
  "error": "Validation error details"
}
```

### 401 Unauthorized
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

### 403 Forbidden
```json
{
  "statusCode": 403,
  "message": "Access denied"
}
```

### 404 Not Found
```json
{
  "statusCode": 404,
  "message": "Resource not found"
}
```

### 500 Internal Server Error
```json
{
  "statusCode": 500,
  "message": "Internal server error"
}
```

---

## Rate Limiting

- Rate limit: 100 requests per minute
- Headers:
  - `X-RateLimit-Limit`: 100
  - `X-RateLimit-Remaining`: 99
  - `X-RateLimit-Reset`: Unix timestamp

---

## Authentication Headers

Incluir en todos los requests autenticados:
```
Authorization: Bearer {jwt_token}
```

El token contiene:
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
