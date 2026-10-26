# Informe de validación local — Compras y Contabilidad

Fecha: 22/10/2026  
Entorno: Windows + WSL 2 + Docker Desktop + Supabase local  
Resultado técnico: **GO**  
Producción: **NO DESPLEGADA / NO AUTORIZADA**

## Resumen ejecutivo

La validación se realizó exclusivamente contra PostgreSQL y servicios Supabase locales. No se ejecutaron `supabase link`, `db push`, despliegues de Edge Functions, consultas a una base remota ni modificaciones de datos reales.

La base vacía se reconstruyó completamente desde las migraciones versionadas. El runner local aprobó las **52/52 aserciones SQL**, las pruebas RLS directas con usuarios `authenticated`, el lint sin errores, los **24/24 tests de aplicación** y el build productivo.

Durante la ejecución real se encontraron y corrigieron tres problemas que la revisión estática no podía demostrar:

1. faltaban columnas históricas AFIP requeridas por `20260228000000_fiscal.sql`;
2. políticas RLS históricas permisivas coexistían con las nuevas y habilitaban acceso de vendedores a proveedores/compras;
3. el request JSON malformado de ARCA devolvía `502` en vez de `400`.

La aprobación formal del contador permanece pendiente como bloqueo funcional separado. También se requieren credenciales reales o de homologación para validar una consulta ARCA exitosa.

## Matriz solicitada

| Área | Estado real |
| --- | --- |
| APPLICATION TESTS | **24/24 PASS** |
| DATABASE SQL TESTS | **52/52 PASS** |
| RLS | **PASS** |
| MULTITENANT | **PASS** |
| TRANSACTIONS | **PASS** |
| ROLLBACK | **PASS** |
| ACCOUNTING | **PASS** |
| IVA | **PASS** |
| BUILD | **PASS** |
| TYPESCRIPT | **PREEXISTING ISSUES** — 117 errores globales; 0 en Compras/Contabilidad |
| ARCA | **READY / BLOCKED BY CREDENTIALS** |
| ACCOUNTANT VALIDATION | **PENDING** |

## Versiones verificadas

| Componente | Versión |
| --- | --- |
| Node.js | `v24.14.0` |
| Supabase CLI | `2.121.0` |
| Docker Engine | `29.9.2` |
| Docker Compose | `v5.6.1` |
| WSL | `3.0.3.0` |
| PostgreSQL local | `17.11` |
| Supabase Edge Runtime | `1.77.4` |
| Supabase Auth | `2.197.0` |

## Servicios locales

| Servicio | Resultado |
| --- | --- |
| PostgreSQL | **HEALTHY** |
| Auth | **HEALTHY** |
| REST API | **UP** |
| Realtime | **HEALTHY** |
| Storage | **HEALTHY** |
| Studio | **HEALTHY** |
| Edge Runtime | **UP** |
| Kong | **HEALTHY** |
| Mailpit/Inbucket | **HEALTHY** |

Endpoints locales utilizados:

- API: `http://127.0.0.1:55321`
- PostgreSQL: `127.0.0.1:55322`
- Studio: `http://127.0.0.1:55323`
- Mailpit: `http://127.0.0.1:55324`

No se documentan claves locales en este informe. Analytics/Vector, Imgproxy y Pooler permanecieron detenidos o deshabilitados porque no forman parte del flujo validado y excedían los recursos asignados a Docker Desktop.

## Auditoría de migraciones

Las migraciones tienen versiones únicas y orden cronológico ascendente. Los siete scripts históricos incorporados originalmente preservan su orden. Además se agregó `20250105500000_afip_invoice_columns.sql`, porque la ejecución real demostró que la migración fiscal dependía de columnas de una migración histórica ausente (`cbte_tipo`, `doc_tipo`, `doc_nro` y datos AFIP relacionados).

No se aplicó ningún parche manual a PostgreSQL. Cada corrección quedó versionada y se volvió a comprobar mediante reconstrucción desde cero.

Hallazgos de auditoría:

- no existen `DROP TABLE`, `DROP COLUMN`, `TRUNCATE` ni borrados masivos accidentales en la migración nueva;
- los importes financieros usan `NUMERIC(18,2)`, no tipos flotantes;
- los cambios destructivos de objetos se limitan a reemplazos intencionales de constraints y policies;
- `is_superadmin()` ahora se define antes de crear la policy que la usa;
- se eliminan las policies legacy `suppliers_*`, `purchases_*` y `purchase_items_*` que PostgreSQL combinaba de forma permisiva mediante OR;
- los chequeos previos de CUIT y comprobantes duplicados detienen la migración en vez de destruir o normalizar datos silenciosamente;
- `migrationSafety.test.ts`: **7/7 PASS**.

### Ejecución real

| Orden | Migración | Resultado |
| ---: | --- | --- |
| 1 | `20250101000000_baseline.sql` | PASS |
| 2 | `20250102000000_core_v2.sql` | PASS |
| 3 | `20250103000000_payment_method_discounts.sql` | PASS |
| 4 | `20250104000000_payment_requests.sql` | PASS |
| 5 | `20250105000000_units_purchases.sql` | PASS |
| 6 | `20250105500000_afip_invoice_columns.sql` | PASS |
| 7 | `20250106000000_afip_complete.sql` | PASS |
| 8 | `20250107000000_stockia_pro.sql` | PASS |
| 9 | `20260228000000_fiscal.sql` | PASS |
| 10 | `20260301000000_storage_bucket.sql` | PASS |
| 11 | `20260302000000_businesses_branding.sql` | PASS |
| 12 | `20260302000001_superadmin.sql` | PASS |
| 13 | `20260303000000_import_log.sql` | PASS |
| 14 | `20260413000000_music.sql` | PASS |
| 15 | `20260414000000_fix_plan_constraint.sql` | PASS |
| 16 | `20260703000000_referrals.sql` | PASS |
| 17 | `20260819000000_quotes.sql` | PASS |
| 18 | `20260908000000_add_material_to_products.sql` | PASS |
| 19 | `20261002000000_billing_group.sql` | PASS |
| 20 | `20261003000000_sales_note.sql` | PASS |
| 21 | `20261021000000_purchases_accounting.sql` | PASS |

La secuencia completa pasó en `supabase start`, en un `supabase db reset --local --no-seed` independiente y nuevamente dentro del runner.

## Seguridad del runner

Runner ejecutado: `scripts/run-purchases-accounting-local.ps1 -SkipStart` mediante Windows PowerShell 5.1, porque `pwsh` 7 no está instalado en PATH.

Controles confirmados:

- usa el contenedor fijo `supabase_db_nexoventas`;
- ejecuta `supabase db reset --local --no-seed`;
- rechaza `SUPABASE_DB_URL`, `DATABASE_URL` o `POSTGRES_URL` si el host no es loopback;
- valida que `supabase status` devuelva `127.0.0.1`/`localhost`;
- aborta si el directorio está enlazado a un proyecto remoto;
- prueba con URL remota simulada: **REMOTE_GUARD PASS**;
- proyecto enlazado durante la ejecución: `null`.

## Suite SQL — 52/52

Fixture: `supabase/tests/fixtures/purchases_accounting_seed.sql`  
Suite: `supabase/tests/purchases_accounting.test.sql`

El runner cuenta las llamadas `assert_true` antes de ejecutar y aborta si el total no es exactamente 52.

| Caso | Resultado |
| --- | --- |
| Factura A: neto 100.000 + IVA 21.000 = 121.000 | PASS |
| Asiento: Compras 100.000 / IVA crédito 21.000 / Proveedores 121.000 | PASS |
| Debe = Haber | PASS |
| Pago parcial 60.000; saldo 61.000 | PASS |
| Pago final 61.000; saldo 0 | PASS |
| Nota de crédito vinculada e impacto inverso | PASS |
| Nota de débito e impacto positivo | PASS |
| IVA 10,5%, 21%, 27% y múltiples alícuotas | PASS |
| CUIT normalizado duplicado rechazado | PASS |
| Comprobante duplicado rechazado | PASS |
| Asiento manual desbalanceado rechazado | PASS |
| Rollback integral de compra fallida | PASS |
| Rollback integral de pago fallido | PASS |
| Anulación sin borrar asiento original | PASS |
| Asiento inverso y relación original → reversión | PASS |
| Cuenta corriente reconstruible desde movimientos | PASS |
| Libro mayor de Compras, IVA, Proveedores y Banco | PASS |
| Roles ADMIN, COMPRAS, CONTADOR y VENDEDOR | PASS |

Todas las operaciones de prueba se ejecutaron dentro de transacciones y finalizaron con `ROLLBACK`.

## RLS y multiempresa

Suite adicional: `supabase/tests/purchases_accounting_rls.test.sql`.

Se usaron dos empresas, dos usuarios reales presentes en `auth.users`, `SET LOCAL ROLE authenticated` y claims JWT de usuario normal. No se utilizó `service_role`.

Se ejecutaron **44 comprobaciones directas cross-tenant**: 11 `SELECT`, 11 `INSERT`, 11 `UPDATE` y 11 `DELETE`.

Tablas cubiertas:

- `suppliers`
- `purchases`
- `purchase_items`
- `purchase_taxes`
- `supplier_accounts`
- `supplier_payments`
- `supplier_payment_allocations`
- `supplier_ledger`
- `accounting_accounts`
- `accounting_entries`
- `accounting_entry_lines`

Resultado: Usuario A no pudo leer, crear, editar ni eliminar filas de Empresa B. **RLS PASS / MULTITENANT PASS**.

## Lint de base

`supabase db lint --local --level warning --fail-on error`: **PASS**, sin errores.

Warnings preexistentes no bloqueantes:

- `public.is_valid_cuit`: variable `index_value` sombreada/no usada;
- `public.ensure_referral_code`: camino de ejecución sin `RETURN`.

## Edge Function ARCA

Prueba HTTP real sobre `arca-supplier-lookup` con un usuario creado e iniciado mediante Auth local; no se usó `service_role`.

| Caso | HTTP | Resultado |
| --- | ---: | --- |
| CUIT inválido | `400` | PASS |
| JSON malformado | `400` | PASS |
| Credenciales ausentes | `503` | PASS |
| Endpoint local deliberadamente lento | `504` en 10.921 ms | PASS |

Para el timeout se usaron únicamente un token ficticio y un mock local que demoraba 15 segundos. No se inventaron credenciales ARCA reales. Los procesos, archivos temporales y variables `ARCA_*` ficticias se eliminaron; `docker inspect` confirmó que no quedaron en el runtime.

Estado: manejo de errores **READY**. La consulta exitosa contra ARCA permanece **BLOCKED BY CREDENTIALS** hasta disponer de credenciales reales o de homologación.

Advertencia ambiental: una llamada redundante posterior al reinicio frío alcanzó el límite blando de CPU del Edge Runtime en Docker con recursos reducidos. Los cuatro casos exigidos ya habían pasado y todos los contenedores requeridos permanecieron saludables.

## Aplicación

| Validación | Resultado |
| --- | --- |
| Vitest | **24/24 PASS**, 4 archivos |
| Build Vite/PWA | **PASS** |
| TypeScript Compras/Contabilidad | **0 errores** |
| TypeScript global | **117 errores preexistentes en 30 archivos** |

Warnings no bloqueantes del build:

- chunks mayores a 500 kB;
- base `caniuse-lite` desactualizada.

## TypeScript — clasificación exacta

**Grupo A — provocado por Compras/Contabilidad:** `0`.

No aparecen diagnósticos en:

- `src/features/purchases/**`
- `src/pages/purchases/**`
- `src/features/accounting/**`
- `src/pages/accounting/**`

**Grupo B — preexistente/no relacionado:** `117` diagnósticos en 30 archivos.

| Archivo | Diagnósticos `línea:columna código` |
| --- | --- |
| `src/App.tsx` | `296:23 TS2345` |
| `src/components/ImportProductsModal.tsx` | `152:28 TS2322` |
| `src/components/layout/AppShellLauncher.tsx` | `65:44 TS2339` |
| `src/components/layout/MiniPlayer.tsx` | `4:24 TS2307` |
| `src/components/TicketPrintModal.tsx` | `99:25 TS18047` |
| `src/features/accounts/accountsService.ts` | `16:6 TS2769`; `44:71 TS2345`; `62:73 TS2345`; `76:6 TS2769` |
| `src/features/basic_mode/basicModeStore.ts` | `21:23 TS2353`; `32:41 TS2339` |
| `src/features/daily_summary/dailySummaryService.ts` | `8:72 TS2345` |
| `src/features/health/HealthPage.tsx` | `103:70 TS2339`; `104:65 TS2339`; `107:69 TS2339` |
| `src/features/insights/insightsService.ts` | `9:70 TS2345`; `23:76 TS2345` |
| `src/features/notifications/notificationsStore.ts` | `52:49 TS2345`; `61:15 TS2345`; `77:50 TS2345` |
| `src/lib/import/exportWriter.ts` | `83:31 TS2322`; `90:15 TS2322` |
| `src/lib/import/importApi.ts` | `205:40 TS2769`; `243:62 TS2339`; `297:34 TS2367` |
| `src/lib/invoicePdf.ts` | `325:5 TS2304` |
| `src/main.tsx` | `7:28 TS2307`; `19:20 TS7006`; `19:26 TS7006` |
| `src/pages/admin/AdminPage.tsx` | `112:45 TS2345`; `113:45 TS2345` |
| `src/pages/auth/RegisterPage.tsx` | `56:33 TS2339`; `65:79 TS2345`; `67:35 TS2339`; `69:23 TS2339` |
| `src/pages/cash-register/CashRegisterPage.tsx` | `57:42 TS2339`; `58:25 TS2345`; `59:18 TS2345`; `59:42 TS2339`; `65:34 TS2339`; `69:22 TS2345` |
| `src/pages/comprobantes/ComprobantesPage.tsx` | `79:17 TS2345`; `92:20 TS2345`; `176:33 TS2339`; `184:33 TS2339`; `213:16 TS2339`; `215:18 TS2339`; `222:24 TS2339`; `233:24 TS2339`; `235:20 TS2339`; `236:17 TS2339` |
| `src/pages/customers/CustomersPage.tsx` | `76:18 TS2345`; `104:22 TS2345` |
| `src/pages/dashboard/DashboardPage.tsx` | `103:39 TS2339`; `107:35 TS2339`; `131:7 TS2322` |
| `src/pages/music/MusicPage.tsx` | `24:5 TS2353`; `35:5 TS2353`; `113:8 TS2339`; `195:38 TS2345`; `286:48 TS2345`; `399:133 TS2339` |
| `src/pages/pos/POSPage.tsx` | `259:21 TS2352`; `273:18 TS2345`; `574:39 TS2339`; `601:23 TS2339`; `612:44 TS2339`; `616:27 TS2339`; `628:30 TS2339`; `637:27 TS2339`; `649:29 TS2339`; `656:26 TS2339` |
| `src/pages/products/ProductDetailPage.tsx` | `57:17 TS2345`; `64:16 TS2345`; `65:24 TS2339`; `69:70 TS2339`; `70:69 TS2339`; `72:19 TS2345`; `73:18 TS2345` |
| `src/pages/products/ProductsPage.tsx` | `76:19 TS2345`; `77:18 TS2345` |
| `src/pages/reports/ProfitabilityPage.tsx` | `161:21 TS2345`; `162:20 TS2345` |
| `src/pages/settings/SettingsPage.tsx` | `130:14 TS2345`; `137:73 TS2345`; `146:37 TS2339`; `149:39 TS2698`; `149:66 TS2339` |
| `src/services/music.service.ts` | `19:15 TS2769`; `29:15 TS2345`; `78:8 TS2769`; `103:8 TS2769`; `123:16 TS2322`; `149:15 TS2769` |
| `src/stores/businessStore.ts` | `30:11 TS2740`; `41:21 TS2740` |
| `src/sync/syncEngine.ts` | `222:23 TS2339`; `223:23 TS2339`; `229:17 TS2769`; `237:34 TS2339`; `245:78 TS2769`; `257:79 TS2769`; `277:15 TS2322`; `338:15 TS2339`; `339:24 TS2339`; `340:17 TS2339`; `341:30 TS2339`; `342:34 TS2339`; `343:28 TS2339`; `344:20 TS2339`; `345:17 TS2339`; `346:25 TS2339`; `347:29 TS2339`; `348:18 TS2339`; `349:24 TS2339`; `350:27 TS2339`; `351:23 TS2339` |

No se modificaron esos módulos para fabricar un contador global de cero.

## Pendientes funcionales y de producción

- aprobación formal del plan de cuentas, jerarquías e imputaciones por un contador;
- revisión contable de percepciones, retenciones, cierres y política de reversión;
- credenciales ARCA reales o de homologación para probar respuesta exitosa;
- preflight autorizado sobre datos reales para detectar CUIT/comprobantes duplicados antes de cualquier migración productiva;
- autorización explícita del usuario antes de vincular o desplegar producción.

## Decisión

Se cumplen los criterios técnicos solicitados:

- 24/24 tests de aplicación;
- 52/52 aserciones SQL;
- RLS y aislamiento multiempresa;
- transacciones y rollback;
- contabilidad, reversión e IVA;
- reconstrucción completa desde migraciones;
- build productivo;
- cero errores TypeScript nuevos del módulo.

**Resultado técnico: GO.**

**Producción: NO TOCAR hasta autorización explícita.**
