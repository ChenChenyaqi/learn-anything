mod config;
mod keychain;
mod project;
pub mod sidecar;

use config::{get_config, set_config};
use keychain::{delete_key, has_key, load_key, save_key};
use project::{create_project, open_project, pick_project_dir};
use sidecar::{
    agent_cancel, agent_list_sessions, agent_load_session, agent_new_session, agent_reply_ui,
    agent_send,
};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            match sidecar::boot_sidecar(app.handle()) {
                Ok(handle) => {
                    app.manage(sidecar::SidecarBoot::Ready(handle));
                }
                Err(e) => {
                    eprintln!("Failed to boot agent sidecar: {e}");
                    app.manage(sidecar::SidecarBoot::Failed(e));
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // keychain (OS keychain)
            save_key,
            load_key,
            has_key,
            delete_key,
            // appData config (non-secret)
            get_config,
            set_config,
            // working-folder selection / validation / creation
            pick_project_dir,
            open_project,
            create_project,
            // agent sidecar commands
            agent_new_session,
            agent_send,
            agent_cancel,
            agent_list_sessions,
            agent_load_session,
            agent_reply_ui,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
