use base64::prelude::*;
use serde::{Deserialize, Serialize};
use std::process::Stdio;
use std::fs;
use std::path::Path;
use tauri::{AppHandle, Emitter};
use tokio::process::Command;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AudioMetadata {
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album_artist: Option<String>,
    pub album: Option<String>,
    pub track_number: Option<String>,
    pub disk_number: Option<String>,
    pub date: Option<String>,
    pub genre: Option<String>,
    pub comment: Option<String>,
    pub duration: Option<String>,
    pub bitrate: Option<String>,
    pub sample_rate: Option<String>,
    pub codec: Option<String>,
    pub album_art: Option<String>, // base64 encoded
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AudioFileResult {
    pub file_path: String,
    pub metadata: Option<AudioMetadata>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProgressEvent {
    pub current: usize,
    pub total: usize,
    pub file_path: String,
    pub status: String, // "processing" | "completed" | "error"
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn check_ffmpeg() -> Result<bool, String> {
    // Check for ffmpeg
    let ffmpeg_result = which::which("ffmpeg");
    if ffmpeg_result.is_err() {
        return Ok(false);
    }

    // Check for ffprobe
    let ffprobe_result = which::which("ffprobe");
    if ffprobe_result.is_err() {
        return Ok(false);
    }

    Ok(true)
}

#[tauri::command]
async fn scan_directory_for_audio_files(directory_path: String) -> Result<Vec<String>, String> {
    use std::path::Path;

    let path = Path::new(&directory_path);
    if !path.exists() {
        return Err("指定されたディレクトリが存在しません".to_string());
    }

    if !path.is_dir() {
        return Err("指定されたパスはディレクトリではありません".to_string());
    }

    let supported_extensions = ["mp3", "m4a", "flac", "ogg", "wav", "opus", "aac", "wma"];
    let mut audio_files = Vec::new();

    scan_directory_recursive(path, &supported_extensions, &mut audio_files)?;

    // ファイルパスをソート
    audio_files.sort();

    Ok(audio_files)
}

fn scan_directory_recursive(
    dir: &std::path::Path,
    supported_extensions: &[&str],
    audio_files: &mut Vec<String>,
) -> Result<(), String> {
    use std::fs;

    let entries = fs::read_dir(dir)
        .map_err(|e| format!("ディレクトリの読み込みに失敗しました: {}", e))?;

    for entry in entries {
        let entry = entry
            .map_err(|e| format!("ディレクトリエントリの処理に失敗しました: {}", e))?;
        let path = entry.path();

        if path.is_dir() {
            // サブディレクトリを再帰的に処理
            scan_directory_recursive(&path, supported_extensions, audio_files)?;
        } else if path.is_file() {
            // ファイルの拡張子をチェック
            if let Some(extension) = path.extension() {
                if let Some(ext_str) = extension.to_str() {
                    let ext_lower = ext_str.to_lowercase();
                    if supported_extensions.contains(&ext_lower.as_str()) {
                        if let Some(path_str) = path.to_str() {
                            audio_files.push(path_str.to_string());
                        }
                    }
                }
            }
        }
    }

    Ok(())
}

async fn extract_album_art(file_path: &str) -> Option<String> {
    let output = Command::new("ffmpeg")
        .args([
            "-i", file_path,
            "-an", // no audio
            "-vcodec", "copy",
            "-f", "image2pipe",
            "-"
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .output()
        .await;

    match output {
        Ok(output) => {
            if output.status.success() && !output.stdout.is_empty() {
                Some(base64::prelude::BASE64_STANDARD.encode(&output.stdout))
            } else {
                None
            }
        }
        Err(_) => None,
    }
}

async fn parse_duration(duration_str: &str) -> Option<String> {
    if let Ok(seconds) = duration_str.parse::<f64>() {
        let total_seconds = seconds as u64;
        let hours = total_seconds / 3600;
        let minutes = (total_seconds % 3600) / 60;
        let secs = total_seconds % 60;
        
        if hours > 0 {
            Some(format!("{:02}:{:02}:{:02}", hours, minutes, secs))
        } else {
            Some(format!("{:02}:{:02}", minutes, secs))
        }
    } else {
        None
    }
}

async fn extract_metadata_internal(file_path: &str) -> Result<AudioMetadata, String> {
    // Check if file exists and has supported extension
    let supported_extensions = ["mp3", "m4a", "flac", "ogg", "wav", "opus", "aac", "wma"];
    let extension = std::path::Path::new(file_path)
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_lowercase());
    
    match extension {
        Some(ext) if supported_extensions.contains(&ext.as_str()) => {},
        _ => return Err("サポートされていないファイル形式です".to_string()),
    }

    // Use ffprobe to extract metadata
    let output = Command::new("ffprobe")
        .args([
            "-v", "quiet",
            "-print_format", "json",
            "-show_format",
            "-show_streams",
            file_path
        ])
        .output()
        .await
        .map_err(|_| "ffprobeの実行に失敗しました".to_string())?;

    if !output.status.success() {
        return Err("メタデータの抽出に失敗しました".to_string());
    }

    let output_str = String::from_utf8(output.stdout)
        .map_err(|_| "ffprobeの出力を解析できませんでした".to_string())?;

    let json_data: serde_json::Value = serde_json::from_str(&output_str)
        .map_err(|_| "ffprobeの出力をJSONとして解析できませんでした".to_string())?;

    let format = json_data.get("format").ok_or("フォーマット情報が見つかりません")?;
    let tags = format.get("tags");
    let streams = json_data.get("streams").and_then(|s| s.as_array());

    // Extract audio stream info
    let audio_stream = streams
        .and_then(|streams| {
            streams.iter().find(|stream| {
                stream.get("codec_type")
                    .and_then(|t| t.as_str())
                    .map(|t| t == "audio")
                    .unwrap_or(false)
            })
        });

    let mut metadata = AudioMetadata {
        title: None,
        artist: None,
        album_artist: None,
        album: None,
        track_number: None,
        disk_number: None,
        date: None,
        genre: None,
        comment: None,
        duration: None,
        bitrate: None,
        sample_rate: None,
        codec: None,
        album_art: None,
    };

    // Extract metadata from tags
    if let Some(tags) = tags {
        metadata.title = get_tag_value(tags, &["title", "Title", "TITLE"]);
        metadata.artist = get_tag_value(tags, &["artist", "Artist", "ARTIST"]);
        metadata.album_artist = get_tag_value(tags, &["album_artist", "AlbumArtist", "ALBUMARTIST", "albumartist"]);
        metadata.album = get_tag_value(tags, &["album", "Album", "ALBUM"]);
        metadata.track_number = get_tag_value(tags, &["track", "Track", "TRACK", "TRACKNUMBER"]);
        metadata.disk_number = get_tag_value(tags, &["disc", "Disc", "DISC", "DISCNUMBER", "disk", "Disk", "DISK"]);
        metadata.date = get_tag_value(tags, &["date", "Date", "DATE", "year", "Year", "YEAR"]);
        metadata.genre = get_tag_value(tags, &["genre", "Genre", "GENRE"]);
        metadata.comment = get_tag_value(tags, &["comment", "Comment", "COMMENT"]);
    }

    // Extract duration
    if let Some(duration_str) = format.get("duration").and_then(|d| d.as_str()) {
        metadata.duration = parse_duration(duration_str).await;
    }

    // Extract bitrate
    if let Some(bitrate) = format.get("bit_rate").and_then(|b| b.as_str()) {
        if let Ok(bitrate_num) = bitrate.parse::<u64>() {
            metadata.bitrate = Some(format!("{} kbps", bitrate_num / 1000));
        }
    }

    // Extract codec and sample rate from audio stream
    if let Some(stream) = audio_stream {
        if let Some(codec) = stream.get("codec_name").and_then(|c| c.as_str()) {
            metadata.codec = Some(codec.to_string());
        }
        
        if let Some(sample_rate) = stream.get("sample_rate").and_then(|sr| sr.as_str()) {
            if let Ok(sr_num) = sample_rate.parse::<u64>() {
                metadata.sample_rate = Some(format!("{} Hz", sr_num));
            }
        }
    }

    // Extract album art
    metadata.album_art = extract_album_art(file_path).await;

    Ok(metadata)
}

fn get_tag_value(tags: &serde_json::Value, possible_keys: &[&str]) -> Option<String> {
    for key in possible_keys {
        if let Some(value) = tags.get(key).and_then(|v| v.as_str()) {
            if !value.trim().is_empty() {
                return Some(value.to_string());
            }
        }
    }
    None
}

#[tauri::command]
async fn extract_metadata(file_path: String) -> Result<AudioMetadata, String> {
    if !std::path::Path::new(&file_path).exists() {
        return Err("ファイルが見つかりません".to_string());
    }

    extract_metadata_internal(&file_path).await
}

#[tauri::command]
async fn process_audio_files(
    app_handle: AppHandle,
    file_paths: Vec<String>
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

#[tauri::command]
async fn save_album_art_to_cache(
    base64_data: String,
    album_title: String,
    album_artist: String,
) -> Result<String, String> {
    // キャッシュディレクトリのパスを取得
    let home_dir = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map_err(|_| "ホームディレクトリの取得に失敗しました")?;
    
    let cache_dir = Path::new(&home_dir)
        .join(".cache")
        .join("VoiceTagEditor")
        .join("album_art");
    
    // キャッシュディレクトリを作成
    fs::create_dir_all(&cache_dir)
        .map_err(|e| format!("キャッシュディレクトリの作成に失敗しました: {}", e))?;
    
    // ファイル名を生成（アルバム名とアーティスト名から）
    let file_name = format!("{}_{}.jpg", 
        sanitize_filename(&album_title),
        sanitize_filename(&album_artist)
    );
    
    let file_path = cache_dir.join(file_name);
    
    // Base64データをデコード
    let image_data = BASE64_STANDARD.decode(&base64_data)
        .map_err(|e| format!("Base64デコードに失敗しました: {}", e))?;
    
    // ファイルに書き込み
    fs::write(&file_path, image_data)
        .map_err(|e| format!("ファイルの書き込みに失敗しました: {}", e))?;
    
    // パスを文字列として返す
    Ok(file_path.to_string_lossy().to_string())
}


fn sanitize_filename(name: &str) -> String {
    // ファイル名に使えない文字を置換
    name.chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            _ => c,
        })
        .collect::<String>()
        .trim()
        .to_string()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            check_ffmpeg,
            extract_metadata,
            process_audio_files,
            scan_directory_for_audio_files,
            save_album_art_to_cache
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
