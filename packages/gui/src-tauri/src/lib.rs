mod config;
mod project;
pub mod sidecar;
mod site_api;

use config::{get_config, set_config};
use project::{create_project, open_project, pick_project_dir};
use sidecar::{
    agent_cancel, agent_list_sessions, agent_load_session, agent_new_session,
    agent_send, agent_switch_session,
};
use site_api::{
    site_file_content, site_quiz_deck, site_quiz_list, site_search_index,
    site_set_watcher_folder, site_topic_data, site_topic_summaries,
};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            app.manage(sidecar::SidecarBoot::default());
            // Boot the file watcher for `<last_working_folder>/.learn/topics`
            // so the dashboard's `site://reload` events fire from launch.
            // If no folder has been chosen yet, the watcher is deferred until
            // the frontend calls `site_set_watcher_folder`.
            site_api::boot_watcher(app.handle().clone());
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
            // site dashboard backend (replaces serve.mjs)
            site_topic_summaries,
            site_topic_data,
            site_file_content,
            site_quiz_list,
            site_quiz_deck,
            site_search_index,
            site_set_watcher_folder,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
