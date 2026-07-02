mod commands;
mod config;
mod keychain;

use commands::test_key;
use config::{get_config, set_config};
use keychain::{delete_key, has_key, load_key, save_key};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            // keychain (OS keychain)
            save_key,
            load_key,
            has_key,
            delete_key,
            // appData config (non-secret)
            get_config,
            set_config,
            // model verification
            test_key,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
