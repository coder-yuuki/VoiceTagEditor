use std::{fs, path::Path};

use tauri::{AppHandle, Emitter};
use tokio::process::Command;
use futures::{stream, StreamExt};
use std::sync::{Arc, atomic::{AtomicUsize, Ordering}};

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

mod mp3;
mod m4a;

use crate::models::{
    ConvertAlbumData, ConvertError, ConvertOutputSettings, ConvertProgress, ConvertRequest,
    ConvertResult, ConvertTrack,
};
use crate::utils::sanitize_filename;

fn resolve_output_extension(format: &str) -> &'static str {
    match format.to_ascii_uppercase().as_str() {
        "M4A" => "m4a",
        _ => "mp3",
    }
}

fn resolve_artwork_input_path(album_data: &ConvertAlbumData) -> Option<String> {
    if let Some(artwork_path) = &album_data.album_artwork_path {
        let trimmed = artwork_path.trim();
        if !trimmed.is_empty() && std::path::Path::new(trimmed).exists() {
            return Some(trimmed.to_string());
        }
    }

    if let Some(cache_path) = &album_data.album_artwork_cache_path {
        let trimmed = cache_path.trim();
        if !trimmed.is_empty() && std::path::Path::new(trimmed).exists() {
            return Some(trimmed.to_string());
        }
    }

    None
}

async fn convert_single_file(
    app_handle: &AppHandle,
    track: &ConvertTrack,
    album_data: &ConvertAlbumData,
    output_settings: &ConvertOutputSettings,
    current: usize,
    total: usize,
    finished_counter: &Arc<AtomicUsize>,
) -> Result<String, String> {
    let source_path = &track.source_path;

    let file_extension = resolve_output_extension(&output_settings.format);

    let output_filename = format!(
        "{:02}-{:02} {}.{}",
        track
            .disk_number
            .parse::<u32>()
            .unwrap_or(1),
        track
            .track_number
            .parse::<u32>()
            .unwrap_or(1),
        sanitize_filename(&track.title),
        file_extension
    );

    let album_dir = Path::new(&output_settings.output_path)
        .join(sanitize_filename(&album_data.album_artist))
        .join(sanitize_filename(&album_data.album_title));

    if !album_dir.exists() {
        fs::create_dir_all(&album_dir)
            .map_err(|e| format!("出力ディレクトリの作成に失敗しました: {}", e))?;
    }

    let mut output_path = album_dir.join(&output_filename);

    if output_path.exists() && output_settings.overwrite_mode == "rename" {
        let mut counter = 1;
        let stem = output_path
            .file_stem()
            .unwrap()
            .to_string_lossy()
            .into_owned();
        let extension = output_path
            .extension()
            .unwrap()
            .to_string_lossy()
            .into_owned();

        loop {
            let new_filename = format!("{}_{}.{}", stem, counter, extension);
            output_path = album_dir.join(&new_filename);
            if !output_path.exists() {
                break;
            }
            counter += 1;
        }
    }

    let progress = ConvertProgress {
        current,
        total,
        current_file: track.title.clone(),
        status: "processing".to_string(),
        // 進捗率は完了数ベース（処理開始時点では完了数）
        progress_percent: (finished_counter.load(Ordering::SeqCst) as f64 / total as f64) * 100.0,
    };
    let _ = app_handle.emit("convert-progress", &progress);

    let mut ffmpeg_args: Vec<String> = vec!["-i".to_string(), source_path.clone()];

    let artwork_input_path = resolve_artwork_input_path(album_data);
    let artwork_input_added = if let Some(path) = &artwork_input_path {
        ffmpeg_args.push("-i".to_string());
        ffmpeg_args.push(path.clone());
        true
    } else {
        false
    };

    // allow overwrite
    ffmpeg_args.push("-y".to_string());

    match output_settings.format.to_ascii_uppercase().as_str() {
        "M4A" => {
            m4a::append_format_specific_args(
                &mut ffmpeg_args,
                artwork_input_added,
                track,
                album_data,
                output_settings,
            );
        }
        _ => {
            mp3::append_format_specific_args(
                &mut ffmpeg_args,
                artwork_input_added,
                track,
                album_data,
                output_settings,
            );
        }
    }

    ffmpeg_args.push(output_path.to_string_lossy().to_string());

    let mut cmd = Command::new("ffmpeg");
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    let output = cmd
        .args(&ffmpeg_args)
        .output()
        .await
        .map_err(|e| format!("ffmpegの実行に失敗しました: {}", e))?;

    if !output.status.success() {
        let error_msg = String::from_utf8_lossy(&output.stderr);
        return Err(format!("ファイル変換に失敗しました: {}", error_msg));
    }

    Ok(output_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn convert_audio_files(
    app_handle: AppHandle,
    request: ConvertRequest,
) -> Result<ConvertResult, String> {
    let total = request.tracks.len();

    let output_dir = Path::new(&request.output_settings.output_path);
    if !output_dir.exists() {
        fs::create_dir_all(output_dir)
            .map_err(|e| format!("出力ディレクトリの作成に失敗しました: {}", e))?;
    }

    // 同時実行数: CPUコア数をベースに最大2～4に制限（ffmpeg は重いので小さめ）
    let cpu_cores = std::thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(4);
    let default_concurrency = std::cmp::min(4, std::cmp::max(1, cpu_cores.saturating_sub(1)));
    let max_concurrency = std::env::var("VTE_CONVERT_CONCURRENCY")
        .ok()
        .and_then(|v| v.parse::<usize>().ok())
        .map(|v| v.clamp(1, 8))
        .unwrap_or(default_concurrency);

    let app_handle = Arc::new(app_handle);
    let album_data = Arc::new(request.album_data);
    let output_settings = Arc::new(request.output_settings);
    let finished_counter = Arc::new(AtomicUsize::new(0));

    let mut converted_files: Vec<String> = Vec::new();
    let mut failed_files: Vec<ConvertError> = Vec::new();

    // 並列変換
    let results: Vec<Result<String, (String, String, usize)>> = stream::iter(request.tracks.into_iter().enumerate())
        .map(|(index, track)| {
            let app_handle = Arc::clone(&app_handle);
            let album_data = Arc::clone(&album_data);
            let output_settings = Arc::clone(&output_settings);
            let finished_counter = Arc::clone(&finished_counter);
            async move {
                let current = index + 1;
                match convert_single_file(
                    &app_handle,
                    &track,
                    &album_data,
                    &output_settings,
                    current,
                    total,
                    &finished_counter,
                )
                .await {
                    Ok(path) => {
                        let finished = finished_counter.fetch_add(1, Ordering::SeqCst) + 1;
                        let progress = ConvertProgress {
                            current: finished,
                            total,
                            current_file: track.title.clone(),
                            status: "completed".to_string(),
                            progress_percent: (finished as f64 / total as f64) * 100.0,
                        };
                        let _ = app_handle.emit("convert-progress", &progress);
                        Ok(path)
                    }
                    Err(err) => {
                        let finished = finished_counter.fetch_add(1, Ordering::SeqCst) + 1;
                        let progress = ConvertProgress {
                            current: finished,
                            total,
                            current_file: track.title.clone(),
                            status: "error".to_string(),
                            progress_percent: (finished as f64 / total as f64) * 100.0,
                        };
                        let _ = app_handle.emit("convert-progress", &progress);
                        Err((track.source_path.clone(), err, current))
                    }
                }
            }
        })
        .buffered(max_concurrency)
        .collect()
        .await;

    for r in results {
        match r {
            Ok(path) => converted_files.push(path),
            Err((source_path, error_message, _current)) => failed_files.push(ConvertError { source_path, error_message }),
        }
    }

    Ok(ConvertResult {
        success: failed_files.is_empty(),
        converted_files,
        failed_files,
        total_processed: total,
    })
}

