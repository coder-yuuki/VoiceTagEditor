use tauri::{AppHandle, Emitter};

use crate::metadata::extract_metadata_internal;
use crate::models::{AudioFileResult, ProgressEvent};

#[tauri::command]
pub async fn process_audio_files(
    app_handle: AppHandle,
    file_paths: Vec<String>,
) -> Result<Vec<AudioFileResult>, String> {
    let total = file_paths.len();
    let mut results = Vec::new();

    for (index, file_path) in file_paths.iter().enumerate() {
        let current = index + 1;

        // Emit progress event - processing
        let progress = ProgressEvent {
            current,
            total,
            file_path: file_path.clone(),
            status: "processing".to_string(),
        };

        if let Err(e) = app_handle.emit("audio-processing-progress", &progress) {
            eprintln!("進捗イベントの送信に失敗しました: {}", e);
        }

        let result = if !std::path::Path::new(file_path).exists() {
            AudioFileResult {
                file_path: file_path.clone(),
                metadata: None,
                error: Some("ファイルが見つかりません".to_string()),
            }
        } else {
            match extract_metadata_internal(file_path).await {
                Ok(metadata) => {
                    let final_progress = ProgressEvent {
                        current,
                        total,
                        file_path: file_path.clone(),
                        status: "completed".to_string(),
                    };

                    if let Err(e) = app_handle.emit("audio-processing-progress", &final_progress) {
                        eprintln!("進捗イベントの送信に失敗しました: {}", e);
                    }

                    AudioFileResult {
                        file_path: file_path.clone(),
                        metadata: Some(metadata),
                        error: None,
                    }
                }
                Err(error) => {
                    let error_progress = ProgressEvent {
                        current,
                        total,
                        file_path: file_path.clone(),
                        status: "error".to_string(),
                    };

                    if let Err(e) = app_handle.emit("audio-processing-progress", &error_progress) {
                        eprintln!("進捗イベントの送信に失敗しました: {}", e);
                    }

                    AudioFileResult {
                        file_path: file_path.clone(),
                        metadata: None,
                        error: Some(error),
                    }
                }
            }
        };

        results.push(result);
    }

    Ok(results)
}
