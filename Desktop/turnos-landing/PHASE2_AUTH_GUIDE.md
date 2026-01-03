# Sistema de Autenticación - Guía de Prueba

## ✅ Backend Completado

### Archivos Creados:
- `src/entities/user.entity.ts` - Modelo de Usuario con TypeORM
- `src/entities/company.entity.ts` - Modelo de Empresa/Tenant
- `src/modules/auth/auth.dto.ts` - DTOs de validación
- `src/modules/auth/auth.service.ts` - Lógica de negocio (register, login, refresh)
- `src/modules/auth/jwt.strategy.ts` - Estrategia Passport JWT
- `src/modules/auth/auth.controller.ts` - Endpoints HTTP
- `src/modules/auth/jwt-auth.guard.ts` - Guard para rutas protegidas
- `src/modules/auth/public.decorator.ts` - Decorador para rutas públicas
- `src/app.module.ts` - Actualizado con JwtAuthGuard global

### Endpoints Disponibles:

#### 1. Registro (Crear Nueva Empresa)
```bash
POST /auth/register
Content-Type: application/json

{
  "email": "admin@ejemplo.com",
  "password": "Password123",
  "company_name": "Mi Peluquería",
  "company_subdomain": "mi-peluqueria",
  "first_name": "Juan",
  "last_name": "Pérez"
}

# Respuesta (201 Created):
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "admin@ejemplo.com",
    "first_name": "Juan",
    "last_name": "Pérez",
    "role": "admin",
    "company_id": "uuid"
  },
  "company": {
    "id": "uuid",
    "name": "Mi Peluquería",
    "subdomain": "mi-peluqueria",
    "subscription_plan": "trial",
    "subscription_status": "active",
    "trial_ends_at": "2024-02-15T...",
    "is_active": true
  }
}
```

#### 2. Login
```bash
POST /auth/login
Content-Type: application/json

{
  "email": "admin@ejemplo.com",
  "password": "Password123"
}

# Respuesta (200 OK):
# Misma estructura que register
```

#### 3. Refresh Token
```bash
POST /auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}

# Respuesta (200 OK):
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### 4. Logout
```bash
POST /auth/logout
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Respuesta (200 OK):
{
  "message": "Logout successful"
}
```

### Seguridad:
- ✅ Contraseñas hasheadas con bcryptjs (salt: 10)
- ✅ JWT con expiración de 15 minutos
- ✅ Refresh tokens con expiración de 7 días
- ✅ Validación de email y subdomain únicos
- ✅ Multi-tenancy: company_id en token para aislamiento de datos
- ✅ Empresa creada automáticamente con periodo de prueba (14 días)

---

## ✅ Frontend Completado

### Páginas Creadas:
- `src/app/(auth)/login/page.tsx` - Formulario de login
- `src/app/(auth)/register/page.tsx` - Formulario de registro
- `src/app/dashboard/page.tsx` - Panel de control protegido

### Store (Zustand):
- `src/store/authStore.ts` - Gestión de estado de autenticación
  - `setAuth()` - Guardar usuario, empresa y tokens
  - `logout()` - Limpiar estado y localStorage
  - `loadFromStorage()` - Recuperar datos del localStorage al cargar la app

### API Client:
- `src/lib/api.ts` - Cliente Axios con:
  - Interceptor de request para agregar JWT automáticamente
  - Interceptor de response para manejar token expirado y refrescar
  - Manejo automático de logout si fallo del refresh

### Middleware:
- `src/middleware.ts` - Protección de rutas:
  - Redirige a /login si no hay token en rutas protegidas
  - Redirige a /dashboard si hay token en rutas públicas

---

## 🧪 Cómo Probar

### 1. Configurar Variables de Entorno

**Backend (.env):**
```
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=tuturno

JWT_SECRET=your-super-secret-key-change-in-production
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

NODE_ENV=development
```

**Frontend (.env.local):**
```
NEXT_PUBLIC_API_URL=http://localhost:3000
```

### 2. Iniciar Servicios

```bash
# Terminal 1: Base de datos
docker-compose up -d postgresql

# Terminal 2: Backend NestJS
cd packages/backend
npm run start:dev

# Terminal 3: Frontend Next.js
cd packages/frontend
npm run dev
```

### 3. Probar en el Navegador

1. Ir a `http://localhost:3001` (o puerto configurado)
2. Hacer clic en "Crear Cuenta"
3. Llenar formulario:
   - Email: `test@ejemplo.com`
   - Contraseña: `Password123`
   - Empresa: `Test Company`
   - Subdominio: `test-company`
4. Clic en "Crear Cuenta"
5. Debería redirigir al dashboard
6. Ver datos de empresa y usuario
7. Clic en "Cerrar Sesión"
8. Debería redirigir a login
9. Hacer clic en "Inicia sesión aquí"
10. Entrar con email y contraseña
11. Debería volver al dashboard

### 4. Probar con cURL (Backend)

```bash
# Registrar
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@ejemplo.com",
    "password": "Password123",
    "company_name": "Test Company",
    "company_subdomain": "test-company"
  }'

# Guardar el token del response...

# Login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@ejemplo.com",
    "password": "Password123"
  }'

# Usar token en ruta protegida (ej: GET /users)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/users
```

---

## 📊 Flujo de Autenticación

```
┌─────────────────────────────────────────────────────────┐
│                   REGISTRO (Sign Up)                     │
├─────────────────────────────────────────────────────────┤
│ 1. Usuario completa formulario (email, password, empresa)│
│ 2. Frontend valida contraseña (8+ chars, mayús, minús, #)│
│ 3. POST /auth/register con RegisterDto                   │
│ 4. Backend valida email único globalmente                │
│ 5. Backend valida subdominio único globalmente           │
│ 6. Backend crea Company (14 días trial)                  │
│ 7. Backend crea User (admin role, password hasheado)     │
│ 8. Backend genera JWT (15m) + Refresh (7d)               │
│ 9. Frontend guarda tokens en localStorage                │
│ 10. Frontend redirige a /dashboard                       │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                     LOGIN (Sign In)                      │
├─────────────────────────────────────────────────────────┤
│ 1. Usuario completa formulario (email, password)         │
│ 2. POST /auth/login con LoginDto                         │
│ 3. Backend encuentra User por email                      │
│ 4. Backend valida contraseña (bcrypt.compare)            │
│ 5. Backend verifica que Company está activa              │
│ 6. Backend actualiza last_login                          │
│ 7. Backend genera JWT (15m) + Refresh (7d)               │
│ 8. Frontend guarda tokens en localStorage                │
│ 9. Frontend redirige a /dashboard                        │
│ 10. Middleware verifica token en cada request            │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│              ACCESO A RUTAS PROTEGIDAS                   │
├─────────────────────────────────────────────────────────┤
│ 1. Frontend hace request a ruta protegida                │
│ 2. Middleware verifica token en cookies                  │
│ 3. API client agrega "Authorization: Bearer TOKEN"       │
│ 4. Backend valida JWT con JwtStrategy                    │
│ 5. Backend extrae user_id y company_id del token         │
│ 6. Backend ejecuta endpoint con multi-tenancy aislada    │
│ 7. Respuesta retorna datos del usuario/empresa           │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│          REFRESH TOKEN (Token Expirado)                  │
├─────────────────────────────────────────────────────────┤
│ 1. API client recibe 401 Unauthorized                    │
│ 2. API client interceptor detecta que es 401             │
│ 3. API client hace POST /auth/refresh                    │
│ 4. Backend valida refresh token                          │
│ 5. Backend genera nuevo access token (15m)               │
│ 6. API client reintenta request original con nuevo token │
│ 7. Solicitud se completa correctamente                   │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│              LOGOUT (Cerrar Sesión)                      │
├─────────────────────────────────────────────────────────┤
│ 1. Usuario hace clic en "Cerrar Sesión"                  │
│ 2. Frontend llama useAuthStore.logout()                  │
│ 3. Store limpia user, company, token, refreshToken       │
│ 4. localStorage.removeItem('token', 'refreshToken')      │
│ 5. Frontend redirige a /login                            │
│ 6. Middleware verifica sin token y permite acceso        │
└─────────────────────────────────────────────────────────┘
```

---

## 🔐 Seguridad Implementada

| Aspecto | Implementación |
|--------|-----------------|
| **Contraseñas** | Bcryptjs con salt 10 |
| **JWT Access Token** | Expiración 15 minutos |
| **JWT Refresh Token** | Expiración 7 días |
| **Multi-tenancy** | company_id en token + filtro en DB |
| **Email Único** | Constraint global en tabla users |
| **Subdominio Único** | Constraint global en tabla companies |
| **Validación de Email** | Regex RFC 5322 simplified |
| **Validación de Contraseña** | Min 8 chars, mayús, minús, dígito |
| **Validación de Subdominio** | Solo a-z0-9- |
| **CORS** | Configurado en NestJS (a ajustar) |
| **HTTPS** | Recomendado en producción |
| **Secure Cookies** | HttpOnly + Secure flags en producción |

---

## ⏭️ Próximos Pasos (Fase 3+)

1. **Landing Page** - Página pública con información del producto
2. **Public Booking** - Página pública para que clientes agendan turnos
3. **Dashboard Completo** - Gestión de servicios, empleados, turnos
4. **Notificaciones** - Email/SMS de confirmación de turnos
5. **Pagos** - Integración con Stripe/Mercado Pago
6. **Reportes** - Gráficas de revenue, ocupación, etc.

---

## 📝 Notas Importantes

- **Período de Trial**: 14 días automáticos al registrar
- **Roles**: admin (acceso total), employee (agenda propia), customer_service
- **Company ID**: Todos los datos filtrados por company_id para aislamiento
- **Token en Payload**: Incluye `sub` (user_id), `company_id`, `email`, `role`
- **Refresh Token**: Se pasa en body, no en cookies (actualización: agregar HttpOnly cookies)

---

## 🚀 Verificación Rápida

```bash
# 1. Ver estructura creada
tree packages/backend/src/modules/auth
tree packages/frontend/src/app

# 2. Verificar imports en auth.module.ts
cat packages/backend/src/modules/auth/auth.module.ts

# 3. Verificar Guard en app.module.ts
grep -n "JwtAuthGuard" packages/backend/src/app.module.ts

# 4. Verificar tipos en frontend
cat packages/frontend/src/types/index.ts | grep -A 20 "RegisterDto"
```

¡Sistema de autenticación completamente implementado! 🎉
