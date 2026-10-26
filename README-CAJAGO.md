# CAJAGO — Sistema Integral de Ventas, Stock y Facturación

> **CajaGo** es un SaaS comercial moderno, local-first y multiplataforma para comercios de Argentina (kioscos, almacenes, indumentaria, gastronomía, ferreterías y minoristas).  
> Permite operar de forma ininterrumpida en **Web**, **PWA instalable** y **Aplicación Desktop nativa para Windows**.

---

## 1. Arquitectura General del Sistema

CajaGo utiliza una arquitectura **Local-First con Cloud como Single Source of Truth**:

```
                       ┌────────────────────────┐
                       │  CAJAGO CLOUD / AFIP   │
                       │  Supabase PostgreSQL   │
                       │  WS Realtime Engine    │
                       └───────────┬────────────┘
                                   │
                   ┌───────────────┴───────────────┐
                   │                               │
        Web / PWA (Direct Cloud)        Desktop Windows (Local-First)
        - React 19 + Vite 5             - Tauri 2 + Rust + WebView2
        - IndexedDB Cache Fallback      - ACID SQLite (`cajago.db`)
        - Service Worker Precaching     - Idempotent Sync Queue Engine
        - Realtime WS Subscriptions     - Signed Auto-Updater
```

### Principios Fundamentales:
1. **Cloud Source of Truth:** La base de datos central en Supabase administra autenticación, perfiles, planes y el histórico consolidado.
2. **Local-First en Desktop:** En Windows, CajaGo corre con frontend empaquetado localmente (`dist/`) y persistencia directa en **SQLite** local (`cajago.db`) mediante `@tauri-apps/plugin-sql`.
3. **Resiliencia Offline:** El mostrador no se detiene si se corta la conexión. Se emiten tickets locales, se descuenta el stock local inmediatamente y las operaciones se encolan con claves de idempotencia.
4. **Idempotencia Estricta:** Toda operación offline lleva un UUID único `idempotency_key`. Si la red falla durante la confirmación, el reintento jamás duplica la venta.
5. **Seguridad AFIP:** Ningún comprobante fiscal con CAE se finge offline. Las ventas sin conexión se guardan como `'ticket'` con `fiscal_status = 'pending'`. Al regresar la red, se homologan con un solo clic.

---

## 2. Superficies del Producto

### A. Aplicación Web
- **URL Dev:** `http://localhost:5173`
- Conexión directa a Supabase con fallback reactivo a IndexedDB ante microcortes.

### B. PWA Instalable
- Configuración en `vite.config.ts`:
  - `name`: `CajaGo`
  - `short_name`: `CajaGo`
  - `display`: `standalone`
  - `scope`: `/`
  - `start_url`: `/menu`
  - `theme_color`: `#070D1C`
  - `background_color`: `#070D1C`
- Precaching inteligente con Workbox para abrir el POS sin red.

### C. CajaGo Desktop para Windows (Tauri 2)
- Ejecutable nativo con WebView2 Evergreen.
- Frontend servido desde archivos locales compilados (no es una URL remota).
- Integración nativa con SQLite (`@tauri-apps/plugin-sql`).
- Inicio automático configurable con Windows (`@tauri-apps/plugin-autostart`).
- Actualizaciones automáticas con verificación de firma criptográfica (`@tauri-apps/plugin-updater`).

---

## 3. Base de Datos SQLite Local (`cajago.db`)

En entorno Desktop, CajaGo inicializa automáticamente las siguientes tablas:

```sql
-- Cola de sincronización idempotente
CREATE TABLE IF NOT EXISTS sync_queue (
  operation_id TEXT PRIMARY KEY,
  operation_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  idempotency_key TEXT UNIQUE NOT NULL,
  device_id TEXT NOT NULL,
  status TEXT NOT NULL, -- 'pending' | 'syncing' | 'synced' | 'failed'
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_attempt TEXT,
  created_at TEXT NOT NULL,
  last_error TEXT
);

-- Snapshot local de productos para búsqueda instantánea
CREATE TABLE IF NOT EXISTS local_products (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  name TEXT NOT NULL,
  sale_price REAL NOT NULL,
  purchase_price REAL NOT NULL,
  avg_cost REAL NOT NULL,
  barcode TEXT,
  unit TEXT NOT NULL,
  stock REAL NOT NULL,
  stock_min REAL NOT NULL,
  brand TEXT,
  category_id TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);

-- Registro local de ventas y tickets
CREATE TABLE IF NOT EXISTS local_sales (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  customer_id TEXT,
  total REAL NOT NULL,
  receipt_type TEXT NOT NULL,
  fiscal_status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  device_id TEXT NOT NULL,
  sync_status TEXT NOT NULL
);

-- Registro de conflictos de inventario
CREATE TABLE IF NOT EXISTS stock_conflicts (
  conflict_id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  requested_qty REAL NOT NULL,
  server_qty REAL NOT NULL,
  resolved INTEGER NOT NULL DEFAULT 0,
  resolved_at TEXT,
  created_at TEXT NOT NULL
);

-- Identidad de terminal y configuración
CREATE TABLE IF NOT EXISTS local_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

---

## 4. Motor de Sincronización e Idempotencia (`src/sync/syncEngine.ts`)

### Flujo de Sincronización:
1. **Venta Offline:**
   - Se crea la venta en `local_sales` con `receipt_type = 'ticket'` y `fiscal_status = 'pending'`.
   - Se genera `idempotency_key: crypto.randomUUID()`.
   - Se descuenta el stock en `local_products` inmediatamente para que el cajero vea el stock actualizado en el mostrador.
   - Se registra en `sync_queue` con `status = 'pending'`.
2. **Reconexión de Red:**
   - El motor detecta el evento `online` o el heartbeat cada 30 segundos.
   - Lee `sync_queue` ordenado cronológicamente (`created_at ASC`).
   - Pasa la operación a estado `syncing`.
   - Consulta si la venta ya existe en Supabase mediante el `id` o la firma de idempotencia `[idempotency:<UUID>]` en notas.
   - Si ya existe (ej. corte de luz justo después de insertar en nube), marca localmente `synced` sin duplicar.
   - Si no existe, realiza inserción atómica de `sales`, `sale_items`, `sale_payments`, y movimientos de stock.
   - Si el stock en el servidor era menor al vendido offline, se registra un `StockConflict` para auditoría del dueño.
   - Al confirmar, elimina la operación de la cola y actualiza el snapshot remoto.
3. **Manejo de Errores con Backoff Exponencial:**
   - Si el servidor devuelve error de red o timeout, incrementa `retry_count`.
   - Aplica espera exponencial: `min(1000 * 2^retry_count, 60000)` ms para no sobrecargar el backend.

---

## 5. Actualizaciones Automáticas Firmadas

Configuradas en `src-tauri/tauri.conf.json` y gestionadas por `src/desktop/updater.ts`:
- **Verificación criptográfica:** Toda actualización descargada es validada contra la clave pública del proyecto antes de aplicarse.
- **Chequeo no intrusivo:** Se consulta 5 segundos después del arranque y luego cada 4 horas (evita saturar ancho de banda).
- **Versión mínima soportada (`minimum_supported_version`):**
  - Si la versión instalada cumple el mínimo: actualización opcional ("Más tarde" disponible).
  - Si la versión instalada está deprecada por cambios de schema: actualización obligatoria modal bloqueante.

---

## 6. Variables de Entorno

Crear archivo `.env` en la raíz del proyecto:

```env
# Supabase Cloud
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key

# App Public Config
VITE_APP_URL=https://cajago.com
VITE_APP_NAME=CajaGo
```

> **IMPORTANTE DE SEGURIDAD:**  
> Jamás incluir `service_role`, credenciales de base de datos directas ni certificados privados de AFIP en el frontend o binario de Tauri. Las operaciones fiscales y de administración corren exclusivamente a través de endpoints seguros en el backend.

---

## 7. Comandos Principales

### Desarrollo Web & PWA
```bash
npm install
npm run dev
```

### Compilación Web
```bash
npm run build
```

### Ejecutar Pruebas Unitarias (Sync Engine, Idempotencia, Versionado)
```bash
npm test
```

### Compilar Aplicación Desktop Windows (Tauri 2)
```bash
# Debug build (generación de ejecutable en target/debug/)
npm run tauri build -- --debug --no-bundle

# Release build con instalador NSIS (.exe) y MSI
npm run tauri build
```

---

## 8. Atajos de Teclado & Impresión Térmica en POS

### Atajos:
- **`F2`**: Abrir modal de cobro / finalizar venta.
- **`F4`**: Enfocar instantáneamente el buscador de productos por código o nombre.
- **`ESC`**: Cancelar modal o limpiar carrito.
- **Lector de Código de Barras USB**: Buffer integrado que detecta ráfagas de teclado (< 40ms) y auto-agrega el producto al carrito sin perder el foco.

### Impresión Térmica:
- Módulo `src/desktop/printer.ts` optimizado para papel continuo de **58mm** y **80mm** compatible con impresoras térmicas ESC/POS (Epson, Hasar, Xprinter, etc.).
