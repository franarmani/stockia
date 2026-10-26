# Releases de CajaGo en Supabase Storage

## Arquitectura

- El código fuente permanece privado.
- El bucket público `releases` contiene únicamente instaladores firmados y `latest.json`.
- CajaGo descarga el manifiesto desde Supabase Storage.
- Tauri verifica cada instalador con la clave pública incluida en la aplicación.
- La clave privada de firma y `SUPABASE_SERVICE_ROLE_KEY` nunca se incluyen en el frontend ni en el instalador.

## Activación pendiente en Supabase

Esta preparación no crea ni modifica recursos productivos. Para activar el canal:

1. Abrir el proyecto `mrpenblsmooeqzegtcqp` en Supabase Dashboard.
2. Ir a **Storage** y crear un bucket llamado `releases`.
3. Marcar el bucket como **Public** para permitir descargas anónimas.
4. No crear policies públicas de `INSERT`, `UPDATE` o `DELETE`.
5. Conservar la publicación como operación administrativa desde Dashboard o desde el script local.

## Construcción firmada

Primero verificar que `package.json`, `public/version.json`, Tauri y Cargo tengan exactamente la misma versión y que el canal de actualización siga apuntando al proyecto correcto:

```powershell
npm.cmd run release:validate
```

Configurar únicamente en el proceso de build:

```powershell
$env:TAURI_SIGNING_PRIVATE_KEY = '<clave privada>'
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = '<contraseña>'
npm.cmd run tauri build
```

No guardar estas variables en `.env`, Git o el frontend.

CajaGo genera únicamente el instalador Windows NSIS (`.exe`). El instalador usa el perfil del usuario actual, impide downgrades automáticos y produce el artefacto firmado requerido por el updater.

La firma de actualizaciones de Tauri evita instalar binarios manipulados. Es independiente de la firma Authenticode del ejecutable: para reducir SmartScreen también se necesita adquirir e instalar un certificado de firma de código de Windows.

## Preparar una publicación

Usar el instalador generado por Tauri y su archivo `.sig`:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\prepare-supabase-release.ps1 `
  -Version 1.12.19 `
  -ArtifactPath '<ruta-al-instalador.exe>' `
  -SignaturePath '<ruta-al-instalador.exe.sig>' `
  -Notes 'Resumen breve de cambios.'
```

El script genera en `%TEMP%`:

- el instalador renombrado;
- una copia de su firma Tauri;
- `latest.json` compatible con Tauri v2;
- `SHA256SUMS.txt`.

El script se detiene si las versiones no coinciden, la clave pública no es válida, el endpoint no pertenece al proyecto esperado o la carpeta de salida contiene archivos de una publicación anterior.

## Publicar

La opción más simple es subir desde Dashboard:

1. Subir el instalador dentro de `releases/<version>/`.
2. Verificar que la URL pública del instalador responda correctamente.
3. Subir `latest.json` en la raíz del bucket como último paso.

También puede utilizarse el script administrativo local. Requiere `SUPABASE_SERVICE_ROLE_KEY` solamente en el proceso actual:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\publish-supabase-release.ps1 `
  -ReleaseDirectory "$env:TEMP\cajago-release-1.12.19"
```

Antes de subir, el script recalcula los hashes del instalador y del manifiesto, y rechaza URLs que no correspondan al project ref, bucket y versión esperados. El instalador se carga primero y `latest.json` siempre al final.

## Rollback

Los binarios publicados son inmutables por versión. Para detener una publicación defectuosa, restaurar el `latest.json` anterior. Tauri no instala versiones inferiores automáticamente; un rollback de aplicación requiere publicar una versión SemVer superior que contenga el código estable.
