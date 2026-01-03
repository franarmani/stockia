# ✅ Checklist de Verifi caciónn - Foundation Completada

## 🎯 Verificación de Setup Local (PRE-DESARROLLO)

### Paso 1: Validar Estructura de Carpetas
```bash
# Desde c:\Users\franc\Desktop\turnos-landing
# Verificar que existen:
✅ packages/backend/
✅ packages/frontend/
✅ packages/database/
✅ docs/
✅ docker-compose.yml
✅ .env.example
✅ SETUP.md
✅ START_HERE.md
```

### Paso 2: Variables de Entorno
```bash
# Copiar template
cp .env.example .env

# Verificar que contiene:
✅ DB_HOST=localhost
✅ DB_USER=turnos_user
✅ DB_PASSWORD=turnos_password
✅ JWT_SECRET=dev-secret...
✅ API_PORT=3000
✅ NEXT_PUBLIC_API_URL=http://localhost:3000
```

### Paso 3: Docker Services
```bash
# Levantar servicios
docker-compose up -d

# Verificar que están corriendo:
docker-compose ps

# Output esperado:
✅ turnos-db     (postgres:16-alpine)
✅ turnos-redis  (redis:7-alpine)
```

### Paso 4: Database Initialization
```bash
# Crear schema + tablas
docker exec -i turnos-db psql -U turnos_user -d turnos_dev < packages/database/init.sql

# Verificar tablas creadas:
docker exec -it turnos-db psql -U turnos_user -d turnos_dev -c "\dt"

# Output esperado:
✅ appointments
✅ audit_logs
✅ clients
✅ companies
✅ employees
✅ payments
✅ services
✅ subscriptions
✅ users
```

### Paso 5: Backend - Instalación & Verificación
```bash
cd packages/backend

# Instalar dependencias
npm install
# ✅ Debe completar sin errores

# Verificar TypeScript compilation
npm run build
# ✅ Debe generar carpeta dist/

# Verificar que arranca
npm run dev
# ✅ Output: "🚀 Server running on http://localhost:3000"

# En otra terminal, verificar health
curl http://localhost:3000/health
# ✅ Response: { "status": "ok" }
```

### Paso 6: Frontend - Instalación & Verificación
```bash
cd packages/frontend

# Instalar dependencias
npm install
# ✅ Debe completar sin errores

# Verificar que arranca
npm run dev
# ✅ Output: "Local: http://localhost:3001"

# En navegador
http://localhost:3001
# ✅ Debe mostrar página "Turnos SaaS"
```

### Paso 7: Verificar Conexión Entre Servicios
```bash
# Backend puede conectar a BD
npm run dev (en packages/backend)
# Buscar en logs: sin errores de conexión
✅ "Database connection successful"

# Frontend puede llamar API
curl http://localhost:3000/
# ✅ Response: "Turnos SaaS API - Active ✅"
```

---

## 📋 Verificación de Documentación

```
✅ START_HERE.md              → Guía de inicio
✅ SETUP.md                   → Pasos detallados setup
✅ PROJECT_MAP.md             → Estructura visual
✅ README.md                  → Descripción proyecto
✅ docs/ARCHITECTURE.md       → Diseño multi-tenant
✅ docs/API.md                → Referencia endpoints
✅ docs/ROADMAP.md            → Plan 10 fases
✅ docs/DECISIONS.md          → Por qué cada tech
```

---

## 🔐 Verificación de Seguridad Base

```
✅ JWT_SECRET en .env es único
✅ .env está en .gitignore
✅ node_modules en .gitignore
✅ .next en .gitignore
✅ dist/ en .gitignore
✅ Helmet habilitado en backend
✅ CORS configurado
✅ Password hashing preparado
```

---

## 🗄️ Verificación de Base de Datos

```bash
# Conectar a BD
docker exec -it turnos-db psql -U turnos_user -d turnos_dev

# Dentro de psql:
\dt                 # Ver tablas
✅ Debe mostrar 9 tablas

SELECT COUNT(*) FROM companies;
✅ Debe mostrar 0 (vacío)

\d appointments     # Ver estructura tabla
✅ Verificar columnas: id, company_id, client_id, etc.

\q                  # Salir
```

---

## 🚀 Verificación de Build para Producción

### Backend
```bash
cd packages/backend

npm run build
# ✅ Debe compilar sin errores a dist/

npm run lint
# ✅ Debe completar (warnings OK, errors NO)
```

### Frontend
```bash
cd packages/frontend

npm run build
# ✅ Debe compilar sin errores a .next/

npm run type-check
# ✅ Debe completar sin errores TypeScript
```

---

## 📦 Verificación de Dependencias

### Backend
```bash
# Verificar versiones instaladas
npm list @nestjs/common
# ✅ Debe ser ^10.3.0+

npm list typeorm
# ✅ Debe estar presente

npm list passport-jwt
# ✅ Debe estar presente para auth
```

### Frontend
```bash
npm list next
# ✅ Debe ser ^14.1.0+

npm list tailwindcss
# ✅ Debe estar presente

npm list zustand
# ✅ Debe estar presente para state
```

---

## 🔄 Verificación de Flujos de Datos (Manual)

### Crear una Empresa (Cuando esté implementado Auth)
```
[ ] POST /api/auth/register
[ ] Body: { email, password, company_name, subdomain }
[ ] Response: { token, user, company }
[ ] Verificar empresa en BD: SELECT * FROM companies
```

### Crear un Turno (Cuando esté implementado)
```
[ ] POST /api/appointments (con JWT)
[ ] Verificar que filtra por company_id del JWT
[ ] Verificar que se crea con company_id
[ ] Verificar que cliente no puede ver turnos de otra empresa
```

### Página Pública (Cuando esté implementada)
```
[ ] GET /book/peluqueria-test
[ ] Cargar servicios de esa empresa
[ ] Crear turno sin auth
[ ] Verificar que se crea con company_id correcto
```

---

## ⚠️ Problemas Conocidos & Soluciones

### Puerto 3000/3001 en Uso
```bash
# Solución: Cambiar en .env
API_PORT=3002
FRONTEND_PORT=3003

# Reiniciar servicios
docker-compose restart
npm run dev (con puertos nuevos)
```

### BD no inicia
```bash
# Problema: PostgreSQL tarda en inicializarse
# Solución: Esperar 10 segundos
sleep 10
docker-compose up -d

# Verificar logs
docker-compose logs postgres
```

### Node Modules Corrupto
```bash
# Solución: Limpiar todo
rm -rf packages/*/node_modules
rm -f package-lock.json pnpm-lock.yaml

npm install
```

### TypeScript Errors
```bash
# Asegurarse que tsconfig.json existe en ambas carpetas
✅ packages/backend/tsconfig.json
✅ packages/frontend/tsconfig.json

# Rebuild
npm run build
```

---

## 🎯 Pre-Desarrollo Checklist Final

Antes de comenzar Fase 2 (Auth), verificar:

### Infrastructure
- [ ] Docker-compose levantado
- [ ] PostgreSQL accesible
- [ ] Redis accesible
- [ ] Backend compila sin errores
- [ ] Frontend compila sin errores

### Código
- [ ] Todos los módulos NestJS existen
- [ ] Estructura Next.js completa
- [ ] TypeScript sin errores
- [ ] No hay warnings críticos

### Documentación
- [ ] SETUP.md leído y entendido
- [ ] ARCHITECTURE.md leído y entendido
- [ ] ROADMAP.md revisado
- [ ] DECISIONS.md revisado (opcional pero recomendado)

### Git (Si aplica)
- [ ] Repo inicializado: `git init`
- [ ] .gitignore correcto
- [ ] Primer commit: `git add . && git commit -m "Initial foundation"`

### Tests Locales
- [ ] Puede hacer curl a http://localhost:3000/health
- [ ] Puede acceder a http://localhost:3001 en navegador
- [ ] No hay CORS errors
- [ ] Console sin red errors

---

## ✨ Si Todo Pasa ✅

¡Felicidades! Tu SaaS está listo para comenzar a codear.

Próximo comando: 👉 **"Ahora armá el sistema de autenticación y registro"**

---

## 🆘 Si Algo Falla

1. Revisar logs: `docker-compose logs -f`
2. Ir a [SETUP.md - Troubleshooting](./SETUP.md#troubleshooting)
3. Verificar puertos: `netstat -an | grep 5432` (BD), `grep 3000` (backend)
4. Reiniciar todo: `docker-compose restart && npm install`

---

**Última revisión**: 2 Enero 2026  
**Status**: ✅ Foundation Ready - Ready for Phase 2
