//! The `#[tauri::command]` entry points exposed to the frontend.

use tauri::{AppHandle, Manager};
use tokio::sync::oneshot;

use crate::config::{self, Provider};

use super::cwd::resolve_cwd;
use super::log::log;
use super::state::{get_or_boot, require_state, SidecarBoot};
use super::types::{ActiveSession, ChatRow, NewSessionResult, SessionMeta};
use super::wire::{next_request_id, write_frame, BootFrame, CommandFrame};

#[tauri::command]
pub async fn agent_new_session(
    app: AppHandle,
    boot: tauri::State<'_, SidecarBoot>,
    working_folder: Option<String>,
) -> Result<NewSessionResult, String> {
    log("cmd agent_new_session");
    let state = get_or_boot(&boot, &app).await?;

    let (tx, rx) = oneshot::channel();
    {
        let mut boot_tx = state.boot_tx.lock().await;
        if boot_tx.is_some() {
            return Err("A session creation is already in progress".into());
        }
        *boot_tx = Some(tx);
    }

    let mut booted = state.booted.lock().await;
    if !*booted {
        let config = config::load_config(&app).map_err(|e| e.to_string())?;
        let api_key = config
            .api_key
            .clone()
            .ok_or("No API key set. Add your key in Settings first.")?;
        let cwd = resolve_cwd(&app, working_folder)?;
        let app_data_dir = app
            .path()
            .app_data_dir()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();
        let provider = match config.provider {
            Provider::OpenAi => "openai".to_string(),
            Provider::Anthropic => "anthropic".to_string(),
        };
        let frame = BootFrame {
            api_key,
            provider,
            base_url: config.base_url,
            model: config.model,
            cwd,
            session_id: None,
            app_data_dir,
        };
        write_frame(&state, frame).await?;
        *booted = true;
    } else {
        drop(booted);
        let frame = CommandFrame::SlashCommand {
            text: "/new".into(),
        };
        write_frame(&state, frame).await?;
    }

    let session_id = tokio::time::timeout(std::time::Duration::from_secs(30), rx)
        .await
        .map_err(|_| "Sidecar did not announce a session_id within 30s".to_string())?
        .map_err(|_| "Sidecar boot channel was dropped".to_string())?;

    state.sessions.lock().await.insert(
        session_id.clone(),
        ActiveSession {
            id: session_id.clone(),
        },
    );

    Ok(NewSessionResult { session_id })
}

#[tauri::command]
pub async fn agent_send(
    boot: tauri::State<'_, SidecarBoot>,
    session_id: String,
    text: String,
) -> Result<(), String> {
    log(format!("cmd agent_send (sid={session_id}, text={text:?})"));
    let state = require_state(&boot).await?;
    {
        let sessions = state.sessions.lock().await;
        if !sessions.contains_key(&session_id) {
            return Err(format!("Session {session_id} is not active"));
        }
    }
    let frame = CommandFrame::UserMessage { session_id, text };
    write_frame(&state, frame).await
}

#[tauri::command]
pub async fn agent_cancel(
    boot: tauri::State<'_, SidecarBoot>,
    session_id: String,
) -> Result<(), String> {
    log(format!("cmd agent_cancel (sid={session_id})"));
    let state = require_state(&boot).await?;
    let frame = CommandFrame::Cancel { session_id };
    write_frame(&state, frame).await
}

#[tauri::command]
pub async fn agent_list_sessions(
    app: AppHandle,
    boot: tauri::State<'_, SidecarBoot>,
    working_folder: Option<String>,
) -> Result<Vec<SessionMeta>, String> {
    log("cmd agent_list_sessions");
    let state = require_state(&boot).await?;
    let cwd = match resolve_cwd(&app, working_folder) {
        Ok(cwd) => cwd,
        Err(_) => return Ok(vec![]),
    };

    let request_id = next_request_id(&state.reply_counter);
    let (tx, rx) = oneshot::channel();
    state
        .pending_list
        .lock()
        .await
        .insert(request_id.clone(), tx);

    let frame = CommandFrame::ListSessions { cwd, request_id };
    write_frame(&state, frame).await?;

    let sessions = tokio::time::timeout(std::time::Duration::from_secs(15), rx)
        .await
        .map_err(|_| "Sidecar did not reply to list_sessions within 15s".to_string())?
        .map_err(|_| "Reply channel was dropped".to_string())?;

    Ok(sessions)
}

#[tauri::command]
pub async fn agent_load_session(
    app: AppHandle,
    boot: tauri::State<'_, SidecarBoot>,
    session_id: String,
    working_folder: Option<String>,
) -> Result<Vec<ChatRow>, String> {
    log(format!("cmd agent_load_session (sid={session_id})"));
    let state = require_state(&boot).await?;
    let cwd = resolve_cwd(&app, working_folder)?;

    let request_id = next_request_id(&state.reply_counter);
    let (tx, rx) = oneshot::channel();
    state
        .pending_load
        .lock()
        .await
        .insert(request_id.clone(), tx);

    let frame = CommandFrame::LoadSession {
        session_id: session_id.clone(),
        cwd,
        request_id,
    };
    write_frame(&state, frame).await?;

    let result = tokio::time::timeout(std::time::Duration::from_secs(15), rx)
        .await
        .map_err(|_| "Sidecar did not reply to load_session within 15s".to_string())?
        .map_err(|_| "Reply channel was dropped".to_string())?;

    if !result.found {
        return Err(format!("Session {session_id} was not found"));
    }

    Ok(result.rows)
}

#[tauri::command]
pub async fn agent_switch_session(
    app: AppHandle,
    boot: tauri::State<'_, SidecarBoot>,
    session_id: String,
    working_folder: Option<String>,
) -> Result<(), String> {
    log(format!("cmd agent_switch_session (sid={session_id})"));
    let state = require_state(&boot).await?;
    let cwd = resolve_cwd(&app, working_folder)?;

    let request_id = next_request_id(&state.reply_counter);
    let (tx, rx) = oneshot::channel();
    state
        .pending_switch
        .lock()
        .await
        .insert(request_id.clone(), tx);

    let frame = CommandFrame::SwitchSession {
        session_id: session_id.clone(),
        cwd,
        request_id,
    };
    write_frame(&state, frame).await?;

    let ok = tokio::time::timeout(std::time::Duration::from_secs(15), rx)
        .await
        .map_err(|_| "Sidecar did not reply to switch_session within 15s".to_string())?
        .map_err(|_| "Reply channel was dropped".to_string())?;

    if !ok {
        return Err(format!(
            "Session {session_id} was not found or could not be switched"
        ));
    }

    Ok(())
}
