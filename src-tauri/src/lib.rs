use tauri::ipc::{InvokeBody, Request};
use tauri::Manager;
use tauri_plugin_opener::OpenerExt;

/// Nombre de archivo seguro: sin carpetas ni caracteres que Windows no acepta.
fn clean_file_name(raw: &str) -> String {
  let cleaned: String = raw
    .chars()
    .map(|c| if c.is_control() || ['\\', '/', ':', '*', '?', '"', '<', '>', '|'].contains(&c) { '_' } else { c })
    .collect();
  let cleaned = cleaned.trim().trim_matches('.').to_string();
  if cleaned.is_empty() { "archivo".to_string() } else { cleaned.chars().take(120).collect() }
}

fn percent_decode(raw: &str) -> String {
  let bytes = raw.as_bytes();
  let mut out = Vec::with_capacity(bytes.len());
  let mut i = 0;
  while i < bytes.len() {
    if bytes[i] == b'%' && i + 2 < bytes.len() {
      if let Ok(v) = u8::from_str_radix(&raw[i + 1..i + 3], 16) {
        out.push(v);
        i += 3;
        continue;
      }
    }
    out.push(bytes[i]);
    i += 1;
  }
  String::from_utf8_lossy(&out).into_owned()
}

/// Guarda un archivo en la carpeta Descargas y lo abre con el programa del sistema (PDF, Excel, etc.).
#[tauri::command]
fn save_download(app: tauri::AppHandle, request: Request<'_>) -> Result<String, String> {
  let bytes = match request.body() {
    InvokeBody::Raw(bytes) => bytes.clone(),
    _ => return Err("No llegaron datos para guardar".into()),
  };
  if bytes.is_empty() || bytes.len() > 200 * 1024 * 1024 {
    return Err("El archivo está vacío o es demasiado grande".into());
  }
  let name = request
    .headers()
    .get("x-file-name")
    .and_then(|value| value.to_str().ok())
    .map(percent_decode)
    .unwrap_or_default();
  let name = clean_file_name(&name);

  let dir = app.path().download_dir().map_err(|e| format!("No se encontró la carpeta Descargas: {e}"))?;
  std::fs::create_dir_all(&dir).map_err(|e| format!("No se pudo abrir la carpeta Descargas: {e}"))?;

  let path = std::path::Path::new(&name);
  let stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or("archivo").to_string();
  let ext = path.extension().and_then(|s| s.to_str()).map(|e| format!(".{e}")).unwrap_or_default();
  let mut target = dir.join(&name);
  let mut n = 1;
  while target.exists() {
    target = dir.join(format!("{stem} ({n}){ext}"));
    n += 1;
  }
  std::fs::write(&target, &bytes).map_err(|e| format!("No se pudo guardar el archivo: {e}"))?;

  let shown = target.to_string_lossy().to_string();
  let _ = app.opener().open_path(shown.clone(), None::<&str>);
  Ok(shown)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![save_download])
    .plugin(tauri_plugin_sql::Builder::default().build())
    .plugin(tauri_plugin_autostart::init(
      tauri_plugin_autostart::MacosLauncher::LaunchAgent,
      Some(vec!["--autostart"]),
    ))
    .plugin(tauri_plugin_updater::Builder::new().build())
    .plugin(tauri_plugin_process::init())
    .plugin(tauri_plugin_opener::init())
    .setup(|app| {
      if let Some(window) = app.get_webview_window("main") {
        let _ = window.eval("window.isTauri = true; window.__IS_TAURI_DESKTOP__ = true; try { localStorage.setItem('cajago_desktop_mode', 'true'); } catch(e){}");
      }
      app.handle().plugin(
        tauri_plugin_log::Builder::default()
          .level(log::LevelFilter::Debug)
          .build(),
      )?;
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while building tauri application");
}
