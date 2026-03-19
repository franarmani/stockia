# 🚀 NexoVentas

## Sistema de Gestión Comercial SaaS para Negocios de Argentina

NexoVentas es un sistema de ventas online simple, rápido y profesional para cualquier negocio argentino.

### Stack tecnológico

- **Frontend:** React + Vite + TypeScript + TailwindCSS
- **UI:** Componentes propios (estilo Shadcn) + Lucide Icons + Recharts
- **Estado:** Zustand
- **Forms:** React Hook Form + Zod
- **Backend:** Supabase (Auth + PostgreSQL + RLS)
- **Deploy:** Vercel (frontend) + Supabase (backend)

### Módulos

1. **Dashboard** - Resumen de ventas, stock bajo, gráficos
2. **Punto de Venta (POS)** - Interfaz rápida tipo caja registradora
3. **Productos** - CRUD, categorías, CSV import, alertas de stock
4. **Clientes** - Cuenta corriente, historial, pagos
5. **Reportes** - Ventas por fecha/producto/vendedor, ganancia bruta, CSV export
6. **Configuración** - Datos del negocio, usuarios, planes

### Setup

```bash
# 1. Clonar e instalar
cd nexoventas
npm install

# 2. Configurar Supabase
# Crear proyecto en supabase.com
# Ejecutar supabase/schema.sql en el SQL Editor
# Copiar .env.example a .env y completar las keys

cp .env.example .env

# 3. Iniciar dev server
npm run dev
```

### Base de datos

Ejecutá el archivo `supabase/schema.sql` en el SQL Editor de Supabase para crear todas las tablas, índices, RLS policies y funciones.

### Planes SaaS

| | Básico | Pro |
|---|---|---|
| Precio | $12.000/mes | $22.000/mes |
| Usuarios | 1 | Ilimitados |
| Productos | 500 | Ilimitados |
| Reportes | Básicos | Avanzados |
| Cuenta corriente | ❌ | ✅ |
| Export CSV | ❌ | ✅ |

### Arquitectura Multi-tenant

- Todas las tablas tienen `business_id`
- RLS activado en todas las tablas
- Cada negocio solo accede a sus datos
- Función `get_user_business_id()` centraliza la lógica de aislamiento

### Seguridad

- Row Level Security (RLS) en todas las tablas
- Validación backend de stock con funciones PostgreSQL
- Roles: admin | seller
- No se confía en el frontend para lógica crítica

### Deploy a producción

```bash
# Build
npm run build

# Deploy a Vercel
npx vercel --prod
```
