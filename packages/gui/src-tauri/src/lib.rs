mod config;
mod project;
pub mod sidecar;

use config::{get_config, set_config};
use project::{create_project, open_project, pick_project_dir};
use sidecar::{
    agent_cancel, agent_list_sessions, agent_load_session, agent_new_session,
    agent_send, agent_switch_session,
};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            app.manage(sidecar::SidecarBoot::default());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // appData config (provider, model, base_url, working folder, api_key)
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
            agent_switch_session,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
