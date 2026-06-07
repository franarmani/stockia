## Sistema de Gestión Comercial SaaS para Negocios de Argentina

**Stockia** es un sistema de ventas y gestión comercial online, simple, rápido y profesional, diseñado para ayudar a negocios argentinos a controlar su stock, vender más y tomar decisiones con datos reales.

---

## 🧠 Stack tecnológico

* **Frontend:** React + Vite + TypeScript + TailwindCSS
* **UI:** Componentes propios (estilo Shadcn) + Lucide Icons + Recharts
* **Estado:** Zustand
* **Forms:** React Hook Form + Zod
* **Backend:** Supabase (Auth + PostgreSQL + RLS)
* **Deploy:** Vercel (frontend) + Supabase (backend)

---

## 📦 Módulos principales

### 1. 📊 Dashboard

* Resumen general del negocio
* Ventas del día / mes
* Alertas de stock bajo
* Gráficos de rendimiento

### 2. 💳 Punto de Venta (POS)

* Interfaz rápida tipo caja registradora
* Venta en segundos
* Control automático de stock
* Soporte para distintos medios de pago

### 3. 📦 Productos

* CRUD completo
* Categorías inteligentes
* Importación masiva (Excel / CSV)
* Alertas de stock mínimo

### 4. 👥 Clientes

* Historial de compras
* Cuenta corriente
* Registro de pagos
* Gestión de deudas

### 5. 📈 Reportes

* Ventas por fecha, producto o vendedor
* Ganancia real del negocio
* Exportación a CSV
* Insights automáticos

### 6. ⚙️ Configuración

* Datos del negocio
* Usuarios y roles
* Planes y suscripciones

---

## ⚙️ Setup

```bash
# 1. Clonar e instalar
cd stockia
npm install

# 2. Configurar Supabase
# Crear proyecto en supabase.com
# Ejecutar supabase/schema.sql en el SQL Editor
# Copiar .env.example a .env y completar las keys

cp .env.example .env

# 3. Iniciar entorno de desarrollo
npm run dev
```

---

## 🗄️ Base de datos

Ejecutar el archivo:

```text
supabase/schema.sql
```

en el SQL Editor de Supabase para crear:

* Tablas
* Índices
* Políticas RLS
* Funciones necesarias

---

## 💰 Planes SaaS

|                  | Básico      | Pro         |
| ---------------- | ----------- | ----------- |
| Precio           | $12.000/mes | $22.000/mes |
| Usuarios         | 1           | Ilimitados  |
| Productos        | 500         | Ilimitados  |
| Reportes         | Básicos     | Avanzados   |
| Cuenta corriente | ❌           | ✅           |
| Export CSV       | ❌           | ✅           |

---

## 🏗️ Arquitectura Multi-tenant

* Todas las tablas incluyen `business_id`
* RLS activado en toda la base
* Cada negocio accede solo a sus datos
* Función `get_user_business_id()` centraliza la lógica

---

## 🔐 Seguridad

* Row Level Security (RLS) en todas las tablas
* Validación backend de stock (PostgreSQL)
* Roles: `admin` | `seller`
* El frontend no maneja lógica crítica

---

## 🚀 Deploy a producción

```bash
# Build
npm run build

# Deploy en Vercel
npx vercel --prod
```

---
