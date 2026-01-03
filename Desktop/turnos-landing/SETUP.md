# 🚀 Setup Local - Turnos SaaS

## Requisitos Previos

- Node.js 18+ (recomendado 20)
- npm, yarn o pnpm
- Docker y Docker Compose
- Git

## 1️⃣ Instalación Inicial

### Clonar repositorio
```bash
cd c:\Users\franc\Desktop\turnos-landing
```

### Instalar dependencias
```bash
# Con pnpm (recomendado)
pnpm install

# O con npm
npm install
```

## 2️⃣ Configurar Variables de Entorno

### Crear archivo .env en la raíz
```bash
cp .env.example .env
```

### Editar `.env` con valores locales
```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=turnos_user
DB_PASSWORD=turnos_password
DB_NAME=turnos_dev
DATABASE_URL=postgresql://turnos_user:turnos_password@localhost:5432/turnos_dev

# Redis
REDIS_URL=redis://localhost:6379

# Backend
NODE_ENV=development
API_PORT=3000
JWT_SECRET=dev-secret-key-change-in-production

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3001
FRONTEND_PORT=3001
```

## 3️⃣ Levantar Base de Datos + Redis (Docker)

```bash
# En la raíz del proyecto
docker-compose up -d
```

Verificar que los contenedores estén activos:
```bash
docker-compose ps
```

Esperado:
```
NAME              STATUS
turnos-db         Up
turnos-redis      Up
```

## 4️⃣ Inicializar Base de Datos

### Crear schema y tablas
```bash
# Conectar a PostgreSQL y ejecutar init.sql
docker exec -i turnos-db psql -U turnos_user -d turnos_dev < packages/database/init.sql
```

O manualmente:
```bash
# Entrar a psql
docker exec -it turnos-db psql -U turnos_user -d turnos_dev

# Dentro de psql, ejecutar:
\i /docker-entrypoint-initdb.d/init.sql
```

## 5️⃣ Iniciar Backend (NestJS)

```bash
cd packages/backend
npm install
npm run dev
```

Esperado:
```
🚀 Server running on http://localhost:3000
```

Probar health:
```bash
curl http://localhost:3000/health
```

Respuesta:
```json
{ "status": "ok" }
```

## 6️⃣ Iniciar Frontend (Next.js)

En otra terminal:
```bash
cd packages/frontend
npm install
npm run dev
```

Esperado:
```
Local:        http://localhost:3001
```

Abrir en navegador:
```
http://localhost:3001
```

## 7️⃣ Verificar Que Todo Funcione

### Backend
- ✅ Health check: http://localhost:3000/health
- ✅ API root: http://localhost:3000/

### Frontend
- ✅ Home page: http://localhost:3001/

### Database
```bash
# Conectar a BD y listar tablas
docker exec -it turnos-db psql -U turnos_user -d turnos_dev -c "\dt"
```

## 🔥 Troubleshooting

### Puerto ya en uso
```bash
# Cambiar puerto en .env
API_PORT=3001
FRONTEND_PORT=3002
```

### Docker no inicia
```bash
# Ver logs
docker-compose logs postgres
docker-compose logs redis

# Reiniciar
docker-compose restart
```

### Conexión a BD rechazada
```bash
# Verificar que BD esté lista
docker exec turnos-db pg_isready -U turnos_user

# Esperar 10 segundos y reintentar
```

### Node modules corrupto
```bash
rm -rf packages/*/node_modules package-lock.json
npm install
```

## 📦 Comandos Útiles

```bash
# Ver todos los contenedores
docker-compose ps

# Ver logs
docker-compose logs -f postgres

# Entrar a la BD
docker exec -it turnos-db psql -U turnos_user -d turnos_dev

# Detener servicios
docker-compose down

# Detener y eliminar volumes
docker-compose down -v
```

## 🚀 Próximos Pasos

1. ✅ Setup básico completado
2. 🔄 Implementar autenticación (Auth module)
3. 🔄 Crear Landing Page
4. 🔄 Implementar Dashboard de Agenda
5. 🔄 Sistema de Suscripciones y Pagos

---

**¿Problemas?** Ver `/docs/ARCHITECTURE.md` para más detalles de arquitectura.
