// Prevents additional console window on Windows, DO NOT REMOVE!!
#![windows_subsystem = "windows"]

fn main() {
  std::panic::set_hook(Box::new(|info| {
    let _ = std::fs::write("cajago_panic.txt", format!("PANIC: {:#?}\n", info));
  }));
  app_lib::run();
}
