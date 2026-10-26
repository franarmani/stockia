# Reconciliación de migraciones — 22/10/2026

**Resultado actual: NO-GO para producción.** Persisten cuatro ventas con vendedor de otro negocio y diferencias de esquema histórico. Storage y los CUIT ya no generan blockers. En esta ejecución no se realizó `migration repair` ni SQL de escritura en producción.

## Revalidación actual

La lectura productiva posterior mostró 22 versiones históricas registradas y la migración de Compras/Contabilidad pendiente. Ese cambio del ledger ocurrió fuera de las acciones de esta ejecución: no demuestra que se hayan aplicado todos sus efectos. La auditoría ahora comprueba también objetos de versiones registradas.

El dry-run se ejecutó con `default_transaction_read_only=on`, terminó con código `0` y propuso únicamente `20261021000000_purchases_accounting.sql`. No se aplicó ninguna migración productiva.

### Corrección de falsos resultados del preflight

- Storage: producción tiene una concesión explícita de `supautils.policy_grants` para que `postgres` administre policies de `storage.objects`. Se verificó en READ ONLY y se ensayó la migración local usando `postgres`, conservando propietarios y ACL originales. El runbook admite esa capacidad únicamente para las policies de esa tabla. No se cambió su propietario ni se otorgaron permisos productivos. Referencia: [Supautils — Manage Policies](https://github.com/supabase/supautils#manage-policies).
- Ventas: una modificación del runbook agregaba una excepción por `billing_group`. Cuando sólo uno de los grupos era nulo, `NOT (...)` devolvía NULL y ocultaba ventas cruzadas. Se restableció la comparación estricta de negocios. Compartir facturación no demuestra autorización para cambiar la referencia de vendedor de una venta.
- La salida anterior `production-full-preflight.txt` con cero blockers queda **SUPERADA POR UN FALSO NEGATIVO**. El preflight corregido terminó con `ROLLBACK` y detectó exactamente un tipo de blocker: `sales -> seller`, cuatro filas. CUIT inválidos: cero. La copia restaurada del respaldo más nuevo confirmó también esas cuatro ventas pendientes.

La comprobación de regresión usa el SQL real del runbook y lo compara con un conteo independiente en la copia local:

```powershell
node scripts/check-preflight-cross-tenant.mjs cajago_audit_20261022151137
```

### Respaldo y evidencia conservados

- Carpeta excluida de Git: `backups.local/preflight-20261022-150949`.
- Dump SHA-256: `54f3ffdfd622fe2d63a021e6a3ae72a9816e60c886f3ffede1617b6f94036f61`.
- Esquema SHA-256: `ef0c9b9c77746dbdc98a422afc1e2b280569f48ae5bb991d947c4cb6c71656d9`.
- `pg_restore --list` y restore real en `cajago_audit_20261022151137`: PASS. Esta copia usa `--no-owner --no-acl`; el ensayo separado de permisos usó otra copia con propietarios/ACL, excluyendo los event triggers administrados incompatibles con el restore local.
- `production-full-preflight-corrected.txt` conserva el resultado productivo válido. `data-review.json` identifica las cuatro ventas y los usuarios actuales de sus negocios; sus datos no se incluyen en archivos versionables.

### Parche propuesto y validación local

`supabase/reconciliation/historical_gaps.sql` queda fuera de `supabase/migrations`, para que no entre automáticamente al release. Propone cuatro índices ausentes: los dos de `customer_payments`, `idx_invoices_credit_note_for` y `idx_invoices_business_cbte`; también agrega `frequently_bought_together` con RLS del invocador, filtro de negocio y ejecución restringida a usuarios autenticados. La función no reproduce el `SECURITY DEFINER` sin aislamiento del archivo histórico; es una corrección forward-only propuesta, no evidencia de equivalencia textual.

La auditoría detectó además dos índices esperados de Música ausentes. El esquema real no tiene la columna `music_tracks.is_active` que exige el archivo recuperado: no se incluyeron esos índices en el parche ni se modificó Música. Esa deriva requiere revisión separada.

Validación: 52 aserciones SQL y 44 controles RLS existentes pasaron en la copia con permisos; 18 pruebas de Compras en Vitest pasaron. Las cinco pruebas adicionales verifican recomendaciones propias, denegación a `anon`, aislamiento entre negocios, un producto cruzado inconsistente y límite cero. El ensayo local no autoriza aplicar el parche ni reparar el ledger productivo.

### Decisión pendiente

Hace falta confirmar qué vendedor corresponde a las cuatro ventas, o aportar evidencia de su contexto histórico antes de decidir una corrección. Los CUIT ya están resueltos y no requieren respuesta a la planilla antigua. Después se debe revisar la deriva histórica y aprobar expresamente el plan productivo completo. No se reasignaron ventas ni se inventaron identidades.

Los apartados siguientes describen el backup original y los hallazgos anteriores; no reemplazan esta revalidación.

## Evidencia independiente

La base `cajago_restore_admin_20261022141341` recibió inserciones manuales en el ledger y un cambio de ownership. Es útil como entorno de trabajo, pero su historial modificado no prueba qué había en producción.

Se restauró nuevamente el dump original en `cajago_audit_20261022143721`. Esta copia conserva las ocho versiones originales del ledger. La auditoría consulta únicamente esa copia y no lee credenciales:

```powershell
node scripts/audit-migration-reconciliation.mjs cajago_audit_20261022143721
```

El script verifica presencia de tablas, columnas, nombres de funciones e índices. No demuestra equivalencia de definiciones, firmas, datos, constraints, policies, grants ni propietarios, y no autoriza reparar el ledger.

Los artefactos completos están en `C:\Users\franc\AppData\Local\Temp\cajago-preflight-20261022-141315`. Esa ubicación es temporal y debe preservarse antes de limpiar temporales.

## Historial

Las versiones recuperadas `20260303000001_category_suggest.sql`, `20260304000000_whatsapp.sql` y `20260305000000_music.sql` coinciden exactamente con la concatenación de sus statements originales, normalizando solamente finales de línea y espacios exteriores. Ya no hay versiones remotas sin archivo local.

Quedan catorce versiones históricas locales sin registro en el ledger original. No se recomienda insertar registros para todas ellas: la inspección ya demuestra que algunos efectos esperados están ausentes.

| Versión | Objeto esperado ausente en la copia original |
| --- | --- |
| `20250102000000` | Índices `idx_customer_payments_customer` e `idx_customer_payments_business` |
| `20250105500000` | Índice `idx_invoices_credit_note_for` |
| `20250107000000` | Función `frequently_bought_together` |

Las migraciones registradas de fiscal y superadmin no coinciden textualmente con su export original. Una diferencia de texto no demuestra diferencia semántica; se requiere revisar los statements antes de decidir cómo preservar su historia.

## Ensayo de Compras/Contabilidad

Se creó `cajago_rehearsal_20261022143916` desde la copia limpia y se aplicó `20261021000000_purchases_accounting.sql` con `psql -1 -v ON_ERROR_STOP=1`, exclusivamente en local. Resultado: código `0`.

El ensayo usó `supabase_admin`, sin propietarios ni ACL originales restaurados. Por lo tanto, confirma ejecución SQL sobre esos datos, pero no resuelve el permiso productivo sobre `storage.objects`, ni sustituye pruebas funcionales o RLS.

## Datos que impiden el GO

Los bloques 3.4 a 3.10 del runbook se ejecutaron sobre la copia limpia en una transacción READ ONLY cerrada con `ROLLBACK`:

- Dos proveedores tienen CUIT incompatible con la validación nueva. No se modificó ni inventó un CUIT. El ensayo puede completar porque la nueva constraint se crea como `NOT VALID`; eso no elimina el blocker de calidad de datos.
- Cuatro ventas apuntan a un vendedor cuyo negocio actual difiere del negocio de la venta. Los vendedores afectados no son superadministradores y los negocios no comparten un `billing_group` no nulo. Falta establecer la causa histórica y la corrección válida antes de cambiar referencias.
- Los 34 registros globales de `categories` y 170 de `category_aliases` con `business_id` nulo están permitidos por la migración recuperada de categorías. El runbook los informa ahora como `INFO_GLOBAL_CATEGORY_ROWS`, sin excluir las demás tablas de la comprobación.

Los identificadores de filas y los CUIT quedan únicamente en la evidencia local restringida; no se incorporan a este documento.

## Próximos pasos concretos

1. Comparar definiciones y efectos de cada versión sin ledger; preparar una migración forward-only para diferencias reales. No reejecutar indiscriminadamente archivos históricos con backfills o policies existentes.
2. Revisar los CUIT contra documentación válida y las cuatro ventas contra su historial de usuarios/negocios. Preparar correcciones individualizadas, sin inferir dígitos verificadores ni reasignar ventas automáticamente.
3. Resolver el mecanismo de ejecución autorizado para policies de `storage.objects`, conservando su propietario administrado. El ensayo como administrador local no prueba ese permiso en producción.
4. Validar la propuesta completa en otra copia local, incluyendo las pruebas funcionales y RLS. Repetir backup y preflight productivo antes de cualquier release.
5. Sólo después de demostrar equivalencia y revisar los cambios, plantear el repair mínimo de ledger y el despliegue. Los registros agregados manualmente en una copia local no cuentan como evidencia de equivalencia.
