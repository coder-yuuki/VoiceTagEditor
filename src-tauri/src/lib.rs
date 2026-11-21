use std::path::Path;
use tauri_plugin_dialog::init as init_dialog;
use tauri_plugin_fs::init as init_fs;
use tauri_plugin_opener::{init as init_opener, OpenerExt};

mod models;
mod metadata;
mod fs_scan;
mod system_check;
mod utils;
mod processing;
mod cache;
mod convert;
mod path_utils;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn restart_app(app: tauri::AppHandle) {
    app.restart();
}

#[tauri::command]
fn open_folder(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("Folder path is empty".to_string());
    }

    let raw_path = Path::new(trimmed);
    let target_dir = if raw_path.is_file() {
        raw_path.parent().unwrap_or(raw_path)
    } else {
        raw_path
    };

    if !target_dir.exists() {
        return Err(format!("Folder does not exist: {}", target_dir.display()));
    }

    app.opener()
        .open_path(target_dir.to_string_lossy().to_string(), None::<&str>)
        .map_err(|e| format!("Failed to open folder: {}", e))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            #[cfg(desktop)]
            app.handle()
                .plugin(tauri_plugin_updater::Builder::new().build())?;
            Ok(())
        })
        .plugin(init_fs())
        .plugin(init_dialog())
        .plugin(init_opener())
        .invoke_handler(tauri::generate_handler![
            greet,
            restart_app,
            open_folder,
            system_check::check_ffmpeg,
            system_check::ensure_ffmpeg_installed,
            metadata::extract_metadata,
            processing::process_audio_files,
            fs_scan::scan_directory_for_audio_files,
            fs_scan::scan_directory_for_image_files,
            cache::save_album_art_to_cache,
            convert::convert_audio_files
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
