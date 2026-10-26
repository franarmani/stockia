# Compras y Contabilidad

## Estado

Implementación aditiva para CajaGo sobre React 19, Vite, Tauri y Supabase/PostgreSQL. No elimina tablas ni datos existentes. La migración principal es `supabase/migrations/20261021000000_purchases_accounting.sql` y debe aplicarse antes de habilitar las rutas nuevas en producción.

> **REQUIERE VALIDACIÓN DEL CONTADOR:** el plan de cuentas inicial, las cuentas de contrapartida y las reglas automáticas incluidas son configurables y no constituyen asesoramiento contable o impositivo.

## Auditoría del sistema original

- Autenticación: Supabase Auth y perfiles en `users`, aislados por `business_id` mediante RLS.
- Roles: `admin` y `seller`, más `is_superadmin`. La ampliación usa permisos granulares sin cambiar el constraint de roles existente.
- Ventas: `sales`, `sale_items`, `sale_payments`, stock y caja se actualizaban desde el frontend.
- Clientes: convivían `customers.balance`, `customer_payments`, `customer_accounts` y `account_movements`. El POS y los cobros se ajustaron para usar las RPC de cuenta corriente y sincronizar ambos saldos.
- Compras: ya existían `suppliers`, `purchases` y `purchase_items`, con actualización de stock desde el frontend y sin comprobantes fiscales, impuestos, deuda ni transacción única.
- Caja: `cash_sessions` y `cash_movements`. No existía entidad bancaria; se agregó `bank_accounts`.
- Facturación: AFIP/ARCA para ventas mediante Edge Functions y tablas fiscales. No existía consulta de padrón de proveedores.
- Auditoría y contabilidad: no existían estructuras generales.

## Arquitectura

La lógica crítica vive en PostgreSQL para asegurar atomicidad. El frontend prepara importes con centavos enteros y la base persiste `NUMERIC(18,2)`.

```text
React / Tauri
   ├─ Compras → purchasesService → create_purchase_document()
   ├─ Pagos   → purchasesService → record_supplier_payment()
   └─ Contab. → accountingService → RPC y vistas
                                  │
PostgreSQL transaction            ├─ comprobante + items + impuestos
                                  ├─ cuenta corriente proveedor/cliente
                                  ├─ caja o banco
                                  ├─ asiento y líneas balanceadas
                                  └─ auditoría
```

## Modelo de datos

### Tablas ampliadas

- `suppliers`: razón social, nombre comercial, condición IVA, localidad, provincia, CP y fecha de modificación. CUIT normalizado y único por negocio.
- `purchases`: tipo/letra/PV/número, fechas, moneda, condición de pago, desglose, saldo, estado, indicadores fiscal/interno, stock y asiento relacionado.
- `purchase_items`: producto opcional, concepto, descripción, IVA e importes.

### Tablas nuevas

- Compras: `purchase_concepts`, `tax_types`, `purchase_taxes`, `payment_methods`, `document_attachments`.
- Proveedores: `supplier_accounts`, `supplier_ledger`, `supplier_payments`, `supplier_payment_allocations`.
- Bancos: `bank_accounts`.
- Clientes: `customer_collections`, reutilizando `customer_accounts` y `account_movements`.
- Contabilidad: `accounting_accounts`, `accounting_entries`, `accounting_entry_lines`, `accounting_rules`.
- Seguridad: `user_permissions` y `audit_logs`.

## Integridad y transacciones

### Compra

`create_purchase_document()` ejecuta en una sola transacción:

1. valida negocio, usuario, proveedor, permiso e items;
2. aplica unicidad proveedor + tipo + PV + número;
3. crea comprobante, items e impuestos;
4. actualiza stock sólo cuando se solicita explícitamente y hay producto asociado;
5. genera mayor de proveedor y saldo;
6. genera y confirma el asiento automático;
7. para contado, registra el pago y deja saldo cero;
8. registra auditoría.

Un error revierte toda la operación.

### Pago

`record_supplier_payment()` valida imputaciones, descuenta saldos, registra cuenta corriente, caja/banco y genera el asiento Proveedores contra Caja/Banco. Admite pagos parciales, totales y anticipos no imputados.

### Cobro

`record_customer_collection()` reutiliza la cuenta corriente existente, sincroniza `customers.balance`, registra caja/banco y genera el asiento Caja/Banco contra Deudores por ventas.

### Reversión

`reverse_accounting_entry()` no borra el asiento confirmado: crea uno nuevo con Debe/Haber invertidos, marca el original como revertido y audita la acción.

## Impuestos

`tax_types` permite IVA 10,5%, 21% y 27%, percepciones IVA/IIBB, retenciones y otros conceptos. Cada comprobante admite múltiples filas en `purchase_taxes`. La vista `purchase_vat_summary` excluye documentos no fiscales y expone neto, alícuotas, percepciones, otros impuestos y total.

Las jurisdicciones, alícuotas nuevas y tratamiento contable son editables. **REQUIERE VALIDACIÓN DEL CONTADOR.**

## Contabilidad

- Plan jerárquico editable con cuentas agrupadoras o imputables.
- Asientos con número correlativo protegido por advisory lock.
- Confirmación obligatoria mediante `confirm_accounting_entry()`: Debe debe ser igual a Haber y distinto de cero.
- Origen trazable mediante `source_type` y `source_id`.
- Libro diario desde asientos y líneas.
- Libro mayor mediante vista `general_ledger`, con saldo acumulado para cualquier cuenta.
- Reglas futuras centralizadas en `accounting_rules`; no se dispersa criterio contable en componentes.

La compra y el pago ya generan asientos automáticos. Ventas y cobros cuentan con cuentas y estructura preparada; el cobro transaccional está implementado. La separación de IVA Débito Fiscal en ventas debe conectarse al resultado fiscal definitivo una vez validadas las reglas y el momento de contabilización.

## ARCA

La Edge Function `arca-supplier-lookup` recibe un CUIT autenticado y consulta exclusivamente el endpoint oficial configurado con secretos del servidor:

- `ARCA_PADRON_ENDPOINT`
- `ARCA_PADRON_ACCESS_TOKEN`

Sin esas variables responde que el servicio no está configurado y el formulario continúa en modo manual. No hay scraping ni secretos en el frontend.

## Archivos

La migración crea el bucket privado `purchase-documents`, limitado a PDF/JPG/PNG y 10 MB, con carpeta raíz por `business_id`. `document_attachments` guarda sólo metadatos y ruta; los binarios no se guardan en PostgreSQL.

## Permisos

- Administradores y superadministradores obtienen permisos implícitos.
- Usuarios adicionales pueden recibir `purchases.read`, `purchases.manage`, `accounting.read` y `accounting.manage` en `user_permissions`.
- Las rutas usan `PermissionGuard` y las tablas/RPC críticas vuelven a validar permisos mediante RLS o `has_permission()`.
- Un vendedor sin permiso vuelve al menú y no puede operar directamente contra la API.

## Auditoría

Se registran creación de compras, pagos, cobros, asientos manuales, reversión de asientos y cambios de proveedores. Los documentos internos quedan identificados con `is_internal = true` e `is_fiscal = false`; no existe mecanismo para ocultar operaciones.

## UI

### Compras

- Dashboard con compras del mes, IVA, deuda, pendientes y vencimientos.
- Comprobantes con estado fiscal, total y saldo.
- Proveedores con búsqueda, orden, edición, activación y cuenta corriente.
- Pagos parciales/totales e imputación.
- IVA Compras por período.
- Catálogo de conceptos.

### Contabilidad

- Dashboard.
- Plan de cuentas editable.
- Asientos automáticos y manuales.
- Reversión.
- Libro diario.
- Libro mayor por cuenta y período.

## Migración y despliegue

1. Respaldar la base de producción.
2. Revisar la migración con el contador y responsable fiscal.
3. Aplicar `supabase/migrations/20261021000000_purchases_accounting.sql` en staging.
4. Desplegar `supabase/functions/arca-supplier-lookup`.
5. Configurar secretos ARCA sólo si existen credenciales oficiales.
6. Regenerar los tipos Supabase para eliminar la deuda de tipos histórica del repositorio.
7. Probar compra, pago, reversión y RLS con usuarios admin y seller.
8. Promover a producción sin ejecutar scripts destructivos.

## Testing

- `npm test -- --run src/features/purchases/__tests__/cuit.test.ts`: CUIT, normalización, formato y dinero por centavos.
- `npm run build`: build productivo validado.
- El typecheck global sigue bloqueado por errores preexistentes en los tipos Supabase generados y archivos no relacionados; los módulos nuevos no agregan errores en su filtro específico.

Antes de producción faltan pruebas de integración contra una instancia Supabase de staging para constraints, rollback, RLS, pagos parciales/totales, notas de crédito/débito, alícuotas, asiento/reversión y mayor. No se ejecutó la migración contra la base enlazada para evitar modificar datos externos sin un despliegue controlado.

## Riesgos y pendientes controlados

- Validar plan de cuentas, imputación de percepciones/retenciones y reglas de IVA con un contador.
- Conectar contabilización automática de venta al momento fiscal acordado (venta creada versus comprobante autorizado).
- Exponer en Configuración una matriz visual para administrar `user_permissions` y `accounting_rules`.
- Agregar carga visual de adjuntos; storage y metadatos ya están preparados.
- Completar exportación Excel/PDF; CSV puede construirse directamente desde `purchase_vat_summary`.
- Regenerar `src/types/database.ts` después de aplicar la migración.

## Fase de validación preproducción

### Resultado de la auditoría de migración

La migración es **aditiva respecto de los datos**: no contiene `DROP TABLE`, `DROP COLUMN`, `TRUNCATE` ni `DELETE`, y ya no ejecuta backfills que reescriban proveedores o compras existentes. Sí reemplaza políticas RLS, triggers y funciones mediante `DROP ... IF EXISTS`/`CREATE OR REPLACE`; esto no elimina filas, pero significa que no es DDL estrictamente “sólo CREATE”.

Cambios seguros sobre estructuras existentes:

- agrega columnas con `ADD COLUMN IF NOT EXISTS`;
- relaja `purchase_items.product_id` para permitir servicios sin producto, sin perder valores;
- agrega foreign keys `ON DELETE RESTRICT` para trazabilidad financiera;
- reemplaza las RPC históricas de cuenta corriente para sincronizar `customers.balance` y `customer_accounts.balance`;
- detiene la migración antes de crear índices únicos si detecta CUIT o comprobantes existentes duplicados.

Todas las tablas financieras usan `NUMERIC`, no `FLOAT`, `REAL` ni `DOUBLE PRECISION`. Las relaciones operativas incluyen timestamps y referencias a usuario, origen, comprobante o asiento.

### Problemas encontrados y corregidos

1. La versión inicial normalizaba CUIT y completaba compras mediante `UPDATE`; se eliminaron esos cambios sobre datos reales.
2. El IVA de cada item no se insertaba en `purchase_taxes`; ahora se registra automáticamente y alimenta `purchase_vat_summary`.
3. El total podía ser enviado arbitrariamente por un cliente; ahora la RPC lo recalcula desde cantidad, costo, IVA e impuestos y rechaza diferencias.
4. Una nota de crédito no tenía vínculo al comprobante original; ahora `original_purchase_id` es obligatorio y se valida contra negocio y proveedor.
5. Las notas de crédito aparecían positivas en IVA Compras; la vista ahora invierte neto, IVA e impuestos.
6. Los comprobantes pagados desaparecían de IVA Compras; la vista incluye estados `confirmed` y `paid`.
7. El pago final no marcaba el comprobante; ahora saldo cero cambia el estado a `paid`.
8. La reversión sólo afectaba el asiento; `void_purchase_document()` conserva el comprobante, crea reversión contable, revierte saldo/stock y audita. Rechaza documentos con pagos aplicados.
9. Varias RPC aceptaban UUID de otro negocio; ahora validan proveedor, producto, concepto, impuesto, cliente, venta, caja y banco.
10. Las RLS permitían escritura directa en tablas derivadas; impuestos, mayor, pagos, asignaciones y líneas contables ahora se escriben únicamente mediante RPC transaccionales.
11. Las funciones `SECURITY DEFINER` conservaban `EXECUTE` para `PUBLIC`; los permisos públicos se revocaron y sólo se concedieron las entradas necesarias a `authenticated`.
12. ARCA no tenía timeout; ahora aborta a los 10 segundos y distingue CUIT inexistente, servicio caído, falta de configuración y timeout sin exponer secretos.
13. Los formularios contables permitían doble submit; ahora bloquean acciones mientras guardan y muestran estado de confirmación.

### Riesgos todavía abiertos

- La interfaz de nota de crédito todavía debe incorporar el selector explícito de comprobante original; el backend y la suite SQL ya lo exigen.
- La pantalla carga productos para compras, pero el selector de asociación producto/item todavía no está expuesto; no activar actualización de stock desde UI hasta corregirlo.
- El formulario visual aún no expone percepciones, retenciones y otros impuestos, aunque modelo, RPC y tests de IVA están preparados.
- Comprobantes y asientos necesitan filtros adicionales para volúmenes altos; las tablas ya tienen scroll horizontal e índices.
- No existe Docker en este equipo, por lo que la suite SQL no pudo ejecutarse localmente.
- La baseline y los scripts históricos ya fueron ordenados dentro de `supabase/migrations`, pero todavía deben ejecutarse de punta a punta en PostgreSQL local cuando Docker Desktop esté disponible.

Estos puntos bloquean el pase a producción, pero no impiden validar backend y migración en un proyecto de staging clonado.

### Validaciones ejecutadas el 21/10/2026

- `npm test -- --run src/features/purchases/__tests__`: 3 archivos y 18 tests aprobados.
- `npm run build`: build productivo aprobado; Vite sólo informó advertencias no bloqueantes por chunks mayores a 500 kB y datos de Browserslist desactualizados.
- `git diff --check` sobre los archivos del módulo: aprobado.
- parser de PowerShell sobre `scripts/run-purchases-accounting-staging.ps1`: aprobado sin errores.
- `tsc --noEmit`: el repositorio conserva errores globales preexistentes fuera del alcance de esta fase; no reporta errores en `features/accounting`, `features/purchases`, `pages/accounting` ni `pages/purchases`.
- suite SQL de integración: preparada, pero no ejecutada por ausencia de Docker, `psql` y una base aislada de staging.

## Procedimiento de staging

### Opción recomendada: proyecto Supabase separado

1. Crear un proyecto Supabase exclusivo de staging, sin usuarios ni datos productivos.
2. Restaurar allí una copia **schema-only** o un backup anonimizado del esquema productivo actual. La migración depende de las tablas existentes de CajaGo.
3. Confirmar que el host de staging no sea el host productivo.
4. Instalar PostgreSQL client para disponer de `psql`.
5. Ejecutar desde la raíz:

```powershell
pwsh -File .\scripts\run-purchases-accounting-staging.ps1 `
  -StagingDatabaseUrl 'postgresql://postgres:CLAVE@HOST-STAGING:5432/postgres' `
  -ExpectedHost 'HOST-STAGING' `
  -Confirmation STAGING_ONLY
```

El script aplica la migración en una transacción, carga fixtures ficticios y ejecuta la suite. Las operaciones creadas por los tests se revierten; los fixtures quedan sólo en staging.

### Opción local

Requiere Docker Desktop y Supabase CLI. En este equipo Docker no está instalado. Antes de usar `supabase db reset`, debe agregarse una baseline versionada del esquema actual o restaurarse un dump schema-only en la base local; de lo contrario las migraciones históricas empiezan después de las tablas base y fallarán.

No usar el proyecto enlazado actual como sustituto de local/staging.

## Datos ficticios

`supabase/tests/fixtures/purchases_accounting_seed.sql` crea:

- Negocio Test A y Negocio Test B;
- ADMIN, COMPRAS, CONTADOR y VENDEDOR;
- Proveedor Test S.A., CUIT ficticio válido `20-12345678-6`;
- proveedor privado del negocio B;
- productos, clientes, banco, impuestos, medios de pago y plan de cuentas;
- permisos granulares para COMPRAS y CONTADOR.

Nunca ejecutar este archivo en producción.

## Suite de integración SQL

`supabase/tests/purchases_accounting.test.sql` verifica:

- factura A 100.000 + IVA 21.000 = 121.000;
- impuesto, saldo proveedor y asiento 100.000/21.000/121.000;
- comprobante y CUIT duplicados;
- pago parcial 60.000 y saldo 61.000 sin alterar el total original;
- pago final 61.000, saldo cero y estado `paid`;
- nota de crédito vinculada e impacto fiscal/contable inverso;
- IVA 10,5%, 21%, 27% y múltiples alícuotas;
- rechazo y rollback de asiento desbalanceado;
- anulación sin DELETE y vínculo original/reversión;
- reconstrucción de saldo desde `supplier_ledger`;
- libro mayor para Proveedores, Banco, Compras e IVA Crédito Fiscal;
- rollback ante referencia cross-tenant;
- aislamiento RLS directo para proveedores, compras, pagos, cuentas, asientos y mayor;
- permisos backend para ADMIN, COMPRAS, CONTADOR y VENDEDOR.

## Rollback

### Durante la migración

El runner usa `psql --single-transaction -v ON_ERROR_STOP=1`. Cualquier error revierte todo el archivo y evita una instalación parcial.

### Después de una migración exitosa

No crear una “down migration” que borre tablas financieras. El procedimiento seguro es:

1. desactivar las rutas nuevas o volver a la versión anterior de la aplicación;
2. revocar temporalmente permisos `purchases.*` y `accounting.*`;
3. conservar tablas y movimientos para auditoría;
4. restaurar el backup/PITR sólo si la migración dañó datos preexistentes;
5. corregir mediante una nueva migración versionada y aditiva.

En staging puede recrearse el proyecto completo. En producción nunca hacer `DROP` de movimientos contables como rollback operativo.

## Configuración ARCA

Secrets exclusivos de Edge Functions:

```text
ARCA_PADRON_ENDPOINT
ARCA_PADRON_ACCESS_TOKEN
```

No existen valores ni credenciales en `src/`. Sin ambos secrets, la función responde `503` y la UI conserva carga manual. Timeout: `504`; CUIT inexistente: `404`; caída/respuesta inválida del servicio: `502`.

No inventar endpoint, token, certificado ni homologación. Deben provenir de credenciales oficiales del contribuyente y validarse en staging.

## Validaciones pendientes con contador

- plan de cuentas inicial y jerarquías;
- imputación de mercadería versus gastos por concepto;
- tratamiento de percepciones y retenciones en total/saldo;
- momento de reconocimiento de IVA Crédito Fiscal;
- reglas para notas de crédito y débito;
- cuentas de Caja/Banco por medio de pago;
- contabilización de ventas e IVA Débito Fiscal;
- numeración, períodos cerrados y política de reversión.

## Checklist exacto para producción

- [ ] Backup verificado o PITR habilitado.
- [ ] Staging clonado desde el esquema productivo actual.
- [ ] Migración aplicada con `--single-transaction` y sin errores en el preflight de duplicados.
- [ ] Seed ficticio ejecutado sólo en staging.
- [ ] Suite SQL completa en verde.
- [ ] Tests Vitest y build productivo en verde.
- [ ] RLS probado con tokens reales de Negocio A y B por REST API.
- [ ] Permisos ADMIN/COMPRAS/CONTADOR/VENDEDOR validados por backend.
- [ ] Selector de comprobante original resuelto en UI de nota de crédito.
- [ ] Asociación producto/item resuelta antes de habilitar impacto de stock.
- [ ] Impuestos adicionales revisados en UI.
- [ ] Plan y reglas aprobados por contador.
- [ ] Secrets y homologación ARCA verificados, o consulta ARCA deshabilitada con carga manual.
- [ ] Tipos Supabase regenerados desde staging.
- [ ] Ventana de mantenimiento y responsable de rollback definidos.
- [ ] Aprobación explícita para producción.

**Estado actual: NO APTO PARA PRODUCCIÓN hasta completar staging, suite SQL y bloqueos UI/contables indicados.**
