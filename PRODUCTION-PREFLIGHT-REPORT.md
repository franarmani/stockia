# Informe de preflight de producción — Compras + Contabilidad

**Primer intento:** 22/10/2026 11:41:27 ART / 14:41:27Z  
**Última verificación:** 22/10/2026 — ver revalidación final y evidencia conservada  
**Commit auditado:** `20dc2d5c148ab2dda173d1022c792c888fcb9f6d`  
**Supabase CLI:** `2.121.0`  
**Decisión:** **PRE-FLIGHT NO-GO**  
**Motivo de detención actual:** cuatro ventas con referencia a vendedor de otro negocio y deriva histórica pendiente. Conexión, backup, restore, CUIT y capacidad de policies de Storage verificados. El ledger productivo pasó a registrar las 22 versiones históricas por acciones ajenas a esta ejecución; no se realizaron escrituras productivas aquí.

**Revalidación final:** el preflight productivo estricto terminó con `ROLLBACK` y detectó cuatro filas `sales -> seller`. Una salida previa sin blockers era un falso negativo causado por una excepción de `billing_group` con valores nulos; esa condición se retiró y la salida previa quedó superada. El dry-run forzado a solo lectura propuso únicamente `20261021000000_purchases_accounting.sql`, sin aplicar cambios. Backup actual y evidencia válida: `backups.local/preflight-20261022-150949`. Ver el estado completo en `MIGRATION-RECONCILIATION-REPORT.md`; los intentos anteriores son evidencia histórica.

**Reconciliación posterior:** ver `MIGRATION-RECONCILIATION-REPORT.md`. Las tres migraciones remotas recuperadas coinciden con los statements originales. Una nueva copia limpia confirmó que insertar versiones en el ledger de una copia de trabajo no demuestra equivalencia histórica. El ensayo local de Compras/Contabilidad terminó con código `0`, pero no elimina los blockers de datos ni prueba permisos productivos. El runbook actualizado distingue las categorías globales válidas de los nulos indebidos; su revalidación local terminó con `ROLLBACK`.

## Reanudación del preflight — segundo intento

Se reanudó exclusivamente la verificación de los tres gates previos solicitados. Resultado:

| Gate previo obligatorio | Resultado |
| --- | --- |
| Backup/snapshot administrado con ID o recovery point verificable | **FAIL** — `completed=0`, PITR deshabilitado y sin recovery point |
| `PRODUCTION_DATABASE_URL` disponible en variable segura | **FAIL** — variable ausente en scopes Process/User/Machine |
| `RESTORE_TEST_DATABASE_URL` disponible y distinta de producción | **FAIL** — variable ausente; aislamiento no verificable |

Las URLs permanecieron totalmente redactadas: no se imprimieron, persistieron ni incorporaron al reporte. Al fallar los tres gates se detuvo el intento antes de dump, restore, conexión PostgreSQL, `BEGIN READ ONLY` y dry-run.

## Reanudación del preflight — tercer intento

Después de completar la configuración local del frontend, se reanudó únicamente el preflight autorizado y se volvieron a evaluar los gates obligatorios.

| Gate previo obligatorio | Resultado |
| --- | --- |
| Backup/snapshot administrado con ID o recovery point verificable | **FAIL** — la consulta actual devolvió nuevamente `backups: null`, `physical_backup_data: {}` y `pitr_enabled: false` |
| `PRODUCTION_DATABASE_URL` disponible en variable segura | **FAIL** — ausente en el proceso actual; la URL compartida contiene el placeholder `[YOUR-PASSWORD]` y no fue utilizada ni almacenada |
| `RESTORE_TEST_DATABASE_URL` disponible y distinta de producción | **FAIL** — ausente en el proceso actual; aislamiento no verificable |

La consulta READ-ONLY de backups confirmó `region: sa-east-1` y `walg_enabled: true`, pero no enumeró un backup ni recovery point restaurable. Se detuvo el intento antes de dump, hash, restore, SQL, auditoría del ledger y dry-run. No se modificó producción.

## Reanudación del preflight — cuarto intento

Se autorizó reemplazar excepcionalmente el requisito de backup administrado/PITR por esta cadena obligatoria de recuperación: dump lógico completo, dump de schema, hashes SHA-256, validación mediante `pg_restore --list`, restore real en Supabase/PostgreSQL local aislado y validación del restore.

| Gate actualizado | Resultado |
| --- | --- |
| Estrategia alternativa de backup autorizada | **PASS — autorización explícita recibida** |
| `PRODUCTION_DATABASE_URL` disponible en variable segura | **FAIL — FALTA en el proceso actual** |
| Destino de restore local aislado | **NOT EVALUATED — detención previa al inicio de Docker/Supabase local** |

No se imprimió, guardó ni buscó la URL productiva en archivos. Al faltar la variable obligatoria se detuvo el intento antes de iniciar el entorno local, crear dumps, conectarse a producción, ejecutar SQL o realizar el dry-run.

## Reanudación del preflight — quinto intento

Se verificó exclusivamente el gate inicial solicitado, sin imprimir ni persistir credenciales.

| Control inicial | Resultado |
| --- | --- |
| `PRODUCTION_DATABASE_URL` | **FALTA** |
| URL PostgreSQL válida | **FAIL — no evaluable sin variable** |
| Project ref `mrpenblsmooeqzegtcqp` | **FAIL — no evaluable sin variable** |
| Ausencia de placeholder | **FAIL — no evaluable sin variable** |

**STOP CONDITION activada:** se detuvo el intento antes de obtener/configurar el destino local, iniciar Supabase local, generar dumps, conectarse a producción, ejecutar SQL o realizar el dry-run. No se expuso ningún secreto ni se modificó producción.

## Reanudación del preflight — sexto intento

`PRODUCTION_DATABASE_URL`: **FALTA** en el proceso actual. No fue posible validar formato, project ref ni ausencia de placeholder. Se activó nuevamente la condición de detención antes de Docker, dumps, conexiones, SQL y dry-run. No se imprimieron ni persistieron credenciales y no se modificó producción.

## Reanudación del preflight — séptimo intento

`PRODUCTION_DATABASE_URL`: **FALTA** en el proceso actual. La credencial expuesta previamente en el chat no fue utilizada ni almacenada y debe considerarse comprometida. Se detuvo el intento antes de cualquier conexión o modificación.

## Reanudación del preflight — octavo intento

`PRODUCTION_DATABASE_URL`: **FALTA** en el entorno recibido por el ejecutor. Se detuvo antes de validar el destino local o realizar conexiones. No se utilizó la credencial previamente expuesta, no se imprimieron secretos y no se modificó producción.

## Reanudación del preflight — noveno intento

- `PRODUCTION_DATABASE_URL`: disponible; formato PostgreSQL, project ref esperado y ausencia de placeholders verificados sin imprimir la credencial.
- Docker: accesible fuera del sandbox; stack local `nexoventas` activo con PostgreSQL 17.
- Backup lógico: intentado en modo de lectura con `pg_dump`; no se obtuvo un backup válido.
- El host directo de producción sólo resolvió una dirección AAAA desde Windows. Docker no pudo resolverlo; al proporcionar la IPv6 verificada mediante `PGHOSTADDR`, la conexión falló con `Network is unreachable`.
- Bloqueo actual: el entorno Docker carece de conectividad IPv6 hacia el endpoint directo. Se necesita habilitar esa conectividad o suministrar una URL del session pooler compatible con IPv4 mediante la misma variable segura, conservando el project ref. No usar el transaction pooler para este procedimiento.
- Restore, auditoría SQL y dry-run: no ejecutados, porque todavía no existe un backup validado. No se aplicaron migraciones ni se modificaron datos productivos. No se imprimió ni persistió la URL.

## Reanudación del preflight — Session pooler configurado en .env

Se leyó exclusivamente `PRODUCTION_DATABASE_URL` desde `.env`, sin mostrar ni persistir la credencial en evidencia. Se validaron esquema PostgreSQL, usuario del proyecto esperado, host de Session pooler y puerto 5432. Se utilizó este valor en lugar del host directo todavía presente en el entorno del proceso.

El intento de `pg_dump` con TLS obligatorio no produjo un backup válido. El pooler resolvió direcciones IPv4; una conexión agotó el tiempo de espera y la otra devolvió `FATAL: password authentication failed for user "postgres"`. El bloqueo actual es la autenticación de la conexión configurada. Es necesario corregir la credencial en la URL segura antes de reintentar.

No se ejecutaron restore, auditoría SQL, dry-run, migraciones ni despliegues. No se modificaron datos productivos.

## Reintento posterior — transporte Windows y fallo de Docker

La conexión de `.env` continúa validando como Session pooler del proyecto esperado. En la comprobación con `psql`, el servidor respondió que la base `postgres\r` no existe: el transporte por stdin desde PowerShell agregó un retorno de carro. Este resultado no demuestra que la contraseña actual sea incorrecta; el rechazo de contraseña anterior corresponde a otro intento.

Se intentó corregir el transporte eliminando el retorno de carro y limitando la consulta con `timeout 45`. Docker Desktop devolvió HTTP 500 al crear la ejecución dentro de `supabase_db_nexoventas` mediante `dockerDesktopLinuxEngine`. No se obtuvo una consulta satisfactoria ni un backup válido. El siguiente paso requiere recuperar Docker y repetir la conexión con el transporte corregido. No se aplicaron migraciones ni se realizaron escrituras productivas.

## Último resultado — backup y restore aprobados; preflight NO-GO

Esta sección reemplaza el estado de los intentos anteriores: la conexión del Session pooler de `.env` autenticó correctamente después de corregir el transporte de comillas y retornos de carro de Windows. Docker volvió a responder.

### Recuperación validada

- Dump completo: `3.338.364` bytes; `pg_restore --list` satisfactorio.
- SHA-256 del dump: `5205b13a21fd8e741613947f958f4dd582bde978a124acb66fb75b0389bdc4dd`.
- SHA-256 del esquema: `6d15273660822975eacb0803f4c80952b1de2bab391b9c819e9990f4267d1ed4`.
- Copia fuera del contenedor: `C:\Users\franc\AppData\Local\Temp\cajago-preflight-20261022-141315`. Contiene dump, esquema, índice y evidencia del preflight; no contiene la URL de conexión. La carpeta temporal no constituye almacenamiento permanente del backup.
- Restore completo con `--exit-on-error`, sin propietarios ni ACL, en la base local nueva `cajago_restore_admin_20261022141341`, usando `supabase_admin`: PASS. Un primer intento con el rol local `postgres` quedó incompleto por un permiso de una función interna de Realtime y no se utilizó para validar.
- Lectura de la copia restaurada: `sales=1231`, `products=2499`, `businesses=3`, `auth.users=4`. Esto valida presencia y lectura de datos, no login de aplicación ni equivalencia de permisos, propietarios o ACL.

### Preflight inicial READ ONLY

Los bloques 3.1, 3.2 y 3.3 del runbook se ejecutaron en una única transacción `REPEATABLE READ READ ONLY`, terminaron con `ROLLBACK` y código de salida `0`. La evidencia íntegra está en `production-initial-preflight.txt`, dentro de la carpeta de backup.

Blockers encontrados:

- `BLOCKER_NOT_OWNER_FOR_DDL_OR_POLICIES`: `storage.objects` pertenece a `supabase_storage_admin`; la sesión `postgres` no supera la comprobación de ownership del runbook.
- `BLOCKER_LOCAL_HISTORY_MISSING_REMOTE`: faltan en el ledger remoto `20250101000000`, `20250102000000`, `20250103000000`, `20250104000000`, `20250105000000`, `20250105500000`, `20250106000000`, `20250107000000`, `20260413000000`, `20260414000000`, `20260703000000`, `20260819000000`, `20260908000000`, `20261002000000` y `20261003000000`.
- `BLOCKER_REMOTE_MIGRATION_NOT_IN_RELEASE_REPO`: el ledger remoto contiene `20260303000001`, `20260304000000` y `20260305000000`, ausentes del historial local del release.

Decisión actual: **NO-GO**. Conforme al runbook, se detuvo el preflight ante estos blockers estructurales. No se ejecutaron los bloques posteriores, dry-run, `migration repair`, migraciones, cambios de permisos, despliegues ni escrituras productivas. El siguiente paso es reconciliar el esquema real y ambos historiales con evidencia, y revisar el permiso de Storage; no marcar migraciones como aplicadas sin demostrar equivalencia.

## 1. Cumplimiento del alcance autorizado

La ejecución se detuvo en el primer blocker obligatorio, antes de conectarse a PostgreSQL productivo.

No se ejecutó:

- `supabase link`;
- SQL contra producción;
- SQL de saneamiento;
- `db push` real;
- `migration repair`;
- modificación del ledger de migraciones;
- despliegue de Edge Functions;
- lectura o cambio de secretos;
- despliegue/promoción de frontend;
- escrituras smoke;
- uso de `service_role`;
- modificación de datos productivos.

Acciones remotas realizadas:

- consulta READ-ONLY del catálogo de proyectos mediante Supabase Management API/CLI;
- consulta READ-ONLY del estado de backups mediante Supabase Management API/CLI.

## 2. Identificación segura de producción

| Control | Resultado |
| --- | --- |
| Proyecto | `stockia` |
| Project ref | `mrpenblsmooeqzegtcqp` |
| Estado | `ACTIVE_HEALTHY` |
| Región | `sa-east-1` |
| Host informado por Supabase | `db.mrpenblsmooeqzegtcqp.supabase.co` |
| PostgreSQL productivo | `17.6.1.063` |
| PostgreSQL engine/major | `17` |
| Release channel | `ga` |
| Proyecto enlazado localmente | no (`linked: false`) |

El project ref fue confirmado por tres fuentes coincidentes:

1. `supabase projects list --output json`;
2. `.env`, exclusivamente a partir del host de `VITE_SUPABASE_URL`;
3. `vercel.json`, a partir del rewrite productivo de Supabase.

No se ejecutó `supabase link`.

## 3. Backup/snapshot administrado

Comando READ-ONLY ejecutado:

```powershell
npx.cmd --no-install supabase backups list `
  --project-ref mrpenblsmooeqzegtcqp `
  --output json
```

Respuesta relevante:

```json
{
  "backups": null,
  "physical_backup_data": {},
  "pitr_enabled": false,
  "region": "sa-east-1",
  "walg_enabled": true
}
```

| Control | Resultado |
| --- | --- |
| Backup físico disponible | **FAIL — ninguno informado** |
| Último recovery point | **NO DISPONIBLE** |
| PITR | deshabilitado |
| Rango de backup físico | vacío/no informado |
| WAL-G | habilitado, pero sin backup restaurable enumerado |
| Snapshot nuevo creado | no; la CLI `2.121.0` sólo ofrece `list` y `restore`, no `create` |

**Blocker B-01:** no se pudo demostrar un punto administrado restaurable previo al release. Conforme a la condición “cualquier BLOCKER → detenerse”, no se avanzó al dump ni a la base productiva.

## 4. Dump lógico, hashes y restore

| Etapa | Resultado | Motivo |
| --- | --- | --- |
| Dump lógico | **NOT EXECUTED** | detención por B-01 |
| Dump de esquema | **NOT EXECUTED** | detención por B-01 |
| SHA-256 | **NOT EXECUTED** | no existe artefacto de dump |
| `pg_restore --list` | **NOT EXECUTED** | no existe artefacto de dump |
| Restore en base aislada | **NOT EXECUTED** | no existe backup restaurable |
| Restore de prueba | **FAIL / NO REALIZADO** | gate de backup incumplido |

Además, no se encontró una credencial de PostgreSQL productivo en las variables estándar disponibles al proceso:

- `PRODUCTION_DATABASE_URL`;
- `SUPABASE_DB_URL`;
- `DATABASE_URL`;
- `POSTGRES_URL`;
- `RESTORE_TEST_DATABASE_URL`.

No se buscó ni extrajo una contraseña desde almacenes de credenciales no estándar. No se imprimieron secretos.

**Blocker B-02:** para un futuro intento autorizado será necesario suministrar `PRODUCTION_DATABASE_URL` mediante un canal seguro y una variable explícita, sin pegarla en el reporte ni en logs.

**Blocker B-03:** también será necesario suministrar `RESTORE_TEST_DATABASE_URL`; su host/base deberán ser distintos de producción y verificables antes de cualquier restore.

## 5. Resultado de los 11 bloques de preflight

El preflight SQL no se inició. Por lo tanto, no existe un `BEGIN ... READ ONLY` abierto ni una transacción pendiente. En un próximo intento, los 11 bloques deberán ejecutarse en una única transacción que comience con `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY` y termine con `ROLLBACK`.

| # | Bloque | Resultado |
| ---: | --- | --- |
| 1 | Apertura `BEGIN ... READ ONLY` e identidad de sesión | **NOT EXECUTED — STOP B-01** |
| 2 | Versión, permisos, ownership y actividad/locks | **NOT EXECUTED — STOP B-01** |
| 3 | Historial remoto de migraciones | **NOT EXECUTED — STOP B-01** |
| 4 | Dependencias, columnas y colisiones de schema/functions | **NOT EXECUTED — STOP B-01** |
| 5 | CUIT duplicados e incompatibles | **NOT EXECUTED — STOP B-01** |
| 6 | Comprobantes duplicados | **NOT EXECUTED — STOP B-01** |
| 7 | `business_id` nulos | **NOT EXECUTED — STOP B-01** |
| 8 | Foreign keys y referencias huérfanas | **NOT EXECUTED — STOP B-01** |
| 9 | Foreign keys compuestas | **NOT EXECUTED — STOP B-01** |
| 10 | Cruces multiempresa | **NOT EXECUTED — STOP B-01** |
| 11 | Snapshot de policies/functions/triggers/grants y `ROLLBACK` | **NOT EXECUTED — STOP B-01** |

## 6. Historial de migraciones

### 6.1 Migraciones locales encontradas

Se encontraron 21 migraciones locales, en este orden:

1. `20250101000000_baseline.sql`
2. `20250102000000_core_v2.sql`
3. `20250103000000_payment_method_discounts.sql`
4. `20250104000000_payment_requests.sql`
5. `20250105000000_units_purchases.sql`
6. `20250105500000_afip_invoice_columns.sql`
7. `20250106000000_afip_complete.sql`
8. `20250107000000_stockia_pro.sql`
9. `20260228000000_fiscal.sql`
10. `20260301000000_storage_bucket.sql`
11. `20260302000000_businesses_branding.sql`
12. `20260302000001_superadmin.sql`
13. `20260303000000_import_log.sql`
14. `20260413000000_music.sql`
15. `20260414000000_fix_plan_constraint.sql`
16. `20260703000000_referrals.sql`
17. `20260819000000_quotes.sql`
18. `20260908000000_add_material_to_products.sql`
19. `20261002000000_billing_group.sql`
20. `20261003000000_sales_note.sql`
21. `20261021000000_purchases_accounting.sql`

### 6.2 Historial remoto

| Control | Resultado |
| --- | --- |
| Ledger `supabase_migrations.schema_migrations` leído | no |
| Versiones remotas encontradas | **NO DETERMINADAS** |
| Comparación local vs remoto | **NO EJECUTADA** |
| Estado de `20250105500000` | **NO DETERMINADO** |
| Estado de `20261021000000` | **NO DETERMINADO** |
| `migration repair` necesario | **NO EVALUADO; NO EJECUTADO** |

No se modificó el ledger.

## 7. Datos y schema solicitados

No se reporta “sin problemas” para controles que no fueron ejecutados.

| Control | Resultado | Hallazgos |
| --- | --- | --- |
| CUIT duplicados | **NOT EXECUTED** | no evaluado |
| CUIT incompatibles | **NOT EXECUTED** | no evaluado |
| Comprobantes duplicados | **NOT EXECUTED** | no evaluado |
| `business_id` nulos | **NOT EXECUTED** | no evaluado |
| Referencias huérfanas | **NOT EXECUTED** | no evaluado |
| Cruces de tenant | **NOT EXECUTED** | no evaluado |
| Colisiones de schema | **NOT EXECUTED** | no evaluado |
| Policies existentes | **NOT EXECUTED** | no evaluado |
| Functions existentes | **NOT EXECUTED** | no evaluado |
| Permisos necesarios | **NOT EXECUTED** | no evaluado |

### Listas solicitadas

- CUIT problemáticos: **no determinados**.
- Duplicados: **no determinados**.
- Referencias huérfanas: **no determinadas**.
- Cruces de tenant: **no determinados**.
- Colisiones: **no determinadas**.

## 8. Dry-run de Supabase

| Control | Resultado |
| --- | --- |
| `supabase db push --dry-run` | **NOT EXECUTED — STOP B-01** |
| Lista exacta que aplicaría | **NO DETERMINADA** |
| Única migración esperada | `20261021000000_purchases_accounting.sql` |
| Condición de aceptación verificada | no |

No se ejecutó `db push` real.

## 9. Warnings y blockers

### Blockers

| ID | Blocker | Impacto |
| --- | --- | --- |
| B-01 | Supabase devolvió `backups: null`, `physical_backup_data: {}` y `pitr_enabled: false` | no existe evidencia de un punto administrado restaurable previo |
| B-02 | `PRODUCTION_DATABASE_URL` no está disponible en Process/User/Machine | no se puede generar el dump, ejecutar SQL READ-ONLY ni hacer dry-run autenticado |
| B-03 | `RESTORE_TEST_DATABASE_URL` no está disponible en Process/User/Machine | no se puede verificar aislamiento ni ejecutar el restore de prueba |

### Warnings

- `walg_enabled: true` no se tomó como prueba suficiente de un backup restaurable porque la misma respuesta no enumeró backups ni rango físico.
- El proyecto está deliberadamente sin link local; esto es consistente con la prohibición de ejecutar `supabase link`.
- El restore de prueba no puede marcarse PASS hasta restaurar el dump completo en una base aislada y verificarlo.
- No debe inferirse que los datos están limpios: todos los controles de datos continúan pendientes.

## 10. Decisión

# PRE-FLIGHT NO-GO

La fase se detuvo correctamente en ambos intentos antes del dump, antes del acceso SQL productivo y antes del dry-run, cumpliendo la regla de detenerse ante cualquier blocker.

Para reanudar exclusivamente el preflight se requiere:

1. disponer de un backup/snapshot administrado con ID o recovery point verificable, o una decisión explícita que redefina el gate y acepte el dump lógico como único backup;
2. proporcionar la credencial PostgreSQL mediante una variable segura explícitamente autorizada;
3. definir la base aislada de restore o autorizar una base aislada local dedicada;
4. volver a ejecutar desde el inicio: backup, dump, hash, restore, 11 bloques READ-ONLY y dry-run.

Incluso si un próximo intento concluye **PRE-FLIGHT GO**, seguirá prohibido aplicar la migración sin una segunda autorización explícita.
