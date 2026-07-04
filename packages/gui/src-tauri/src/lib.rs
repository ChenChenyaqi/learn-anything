mod agent;
mod commands;
mod config;
mod keychain;
mod project;

use agent::chat_create_topic;
use commands::test_key;
use config::{get_config, set_config};
use keychain::{delete_key, has_key, load_key, save_key};
use project::{create_project, open_project, pick_project_dir};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
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
            // working-folder selection / validation / creation
            pick_project_dir,
            open_project,
            create_project,
            // agent workflow
            chat_create_topic,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
