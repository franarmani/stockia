# Release Compras + Contabilidad — 22/10/2026

Estado: preparación y preflight del despliegue autorizado.

## Autorización y alcance

El usuario autorizó el preflight y despliegue productivo de Compras + Contabilidad, confirmó a Bruno Ugolini y su usuario titular para las cuatro ventas, y excluyó expresamente Música del release.

- Supabase: `mrpenblsmooeqzegtcqp`.
- Única migración: `20261021000000_purchases_accounting.sql`.
- Edge Function: `arca-supplier-lookup`.
- Vercel: proyecto `stockia-main`, `prj_eRaEBBAUjUmr8H1wfBliWrzTJbTd`.
- Deployment anterior para rollback: `dpl_G95oC985eY78mdNcQGNvB4XUctQF`, `stockia-main-pqxwzjzdo-frantomarma-8737s-projects.vercel.app`.
- Frontend candidato: `1.12.19`, construido en una copia aislada de `20dc2d5c148ab2dda173d1022c792c888fcb9f6d` con únicamente Compras/Contabilidad y su integración de cuentas de clientes.
- Evidencia privada y artefactos: `backups.local/release-purchases-accounting-20261022`, excluido de Git.

La copia candidata conserva los módulos, servicio, tipos y aspecto de Música de la base desplegada; excluye las modificaciones pendientes de escritorio, branding y otras páginas. El parche `supabase/reconciliation/historical_gaps.sql` no forma parte del release. No se reparará el ledger ni se ejecutarán migraciones históricas.

## Verificaciones iniciales

La lectura productiva confirmó que las cuatro ventas ya tienen el vendedor aprobado, que ese usuario es administrador de su negocio y que no quedan referencias `sales -> seller` cruzadas. No fue necesario volver a modificar las ventas.

Se registró la huella del esquema de Música para compararla después del despliegue. Sus diferencias con el archivo histórico recuperado quedan fuera del alcance por instrucción explícita del usuario.

Los secretos `ARCA_PADRON_ENDPOINT` y `ARCA_PADRON_ACCESS_TOKEN` no están configurados en Supabase. El adaptador conserva su respuesta controlada `503` y la carga manual prevista por la aplicación. No se inventan credenciales ni se configura un proveedor externo. La consulta automática ARCA no se considerará operativa sin esos secretos.

## Secuencia

1. Compilar y revisar el artefacto frontend aislado.
2. Renovar backup, validar índice y hashes, y restaurarlo en una base local nueva.
3. Ejecutar el preflight completo en READ ONLY y el dry-run de una sola migración.
4. Aplicar únicamente la migración autorizada y verificar el estado de la base.
5. Desplegar únicamente la Edge Function y el frontend precompilado.
6. Ejecutar los controles funcionales/RLS en transacciones revertidas y verificar rutas públicas, versión y huella de Música.

No se usarán cuentas de servicio para simular permisos de usuarios. Las pruebas SQL de usuarios se ejecutan bajo `authenticated` en negocios ficticios dentro de una transacción revertida; esto no sustituye un login interactivo con contraseña de un cliente.
