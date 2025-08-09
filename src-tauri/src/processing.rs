use tauri::{AppHandle, Emitter};
use futures::{stream, StreamExt};
use std::sync::{Arc, atomic::{AtomicUsize, Ordering}};

use crate::metadata::extract_metadata_internal;
use crate::models::{AudioFileResult, ProgressEvent};

#[tauri::command]
pub async fn process_audio_files(
    app_handle: AppHandle,
    file_paths: Vec<String>,
) -> Result<Vec<AudioFileResult>, String> {
    let total = file_paths.len();

    // 同時実行数を環境やCPUコア数から決める（上限を8に）
    let cpu_cores = std::thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(4);
    let default_concurrency = std::cmp::min(8, std::cmp::max(2, cpu_cores));
    let max_concurrency = std::env::var("VTE_PROCESSING_CONCURRENCY")
        .ok()
        .and_then(|v| v.parse::<usize>().ok())
        .map(|v| v.clamp(1, 64))
        .unwrap_or(default_concurrency);

    let app_handle = Arc::new(app_handle);
    let completed = Arc::new(AtomicUsize::new(0));

    let results: Vec<AudioFileResult> = stream::iter(file_paths.into_iter().enumerate())
        .map(|(index, file_path)| {
            let app_handle = Arc::clone(&app_handle);
            let completed = Arc::clone(&completed);
            async move {
                let current_index = index + 1; // 表示用の現在処理中インデックス

                // processing イベント
                let progress = ProgressEvent {
                    current: current_index,
                    total,
                    file_path: file_path.clone(),
                    status: "processing".to_string(),
                };
                let _ = app_handle.emit("audio-processing-progress", &progress);

                if !std::path::Path::new(&file_path).exists() {
                    return AudioFileResult {
                        file_path,
                        metadata: None,
                        error: Some("ファイルが見つかりません".to_string()),
                    };
                }

                match extract_metadata_internal(&file_path).await {
                    Ok(metadata) => {
                        let finished = completed.fetch_add(1, Ordering::SeqCst) + 1;
                        let final_progress = ProgressEvent {
                            current: finished,
                            total,
                            file_path: file_path.clone(),
                            status: "completed".to_string(),
                        };
                        let _ = app_handle.emit("audio-processing-progress", &final_progress);

                        AudioFileResult {
                            file_path,
                            metadata: Some(metadata),
                            error: None,
                        }
                    }
                    Err(error) => {
                        let finished = completed.fetch_add(1, Ordering::SeqCst) + 1;
                        let error_progress = ProgressEvent {
                            current: finished,
                            total,
                            file_path: file_path.clone(),
                            status: "error".to_string(),
                        };
                        let _ = app_handle.emit("audio-processing-progress", &error_progress);

                        AudioFileResult {
                            file_path,
                            metadata: None,
                            error: Some(error),
                        }
                    }
                }
            }
        })
        .buffered(max_concurrency)
        .collect()
        .await;

    Ok(results)
}
