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

#[derive(Debug, Serialize, Deserialize)]
pub struct ConvertRequest {
    pub tracks: Vec<ConvertTrack>,
    pub album_data: ConvertAlbumData,
    pub output_settings: ConvertOutputSettings,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ConvertTrack {
    pub source_path: String,
    pub disk_number: String,
    pub track_number: String,
    pub title: String,
    pub artists: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ConvertAlbumData {
    pub album_title: String,
    pub album_artist: String,
    pub release_date: String,
    pub tags: Vec<String>,
    pub album_artwork_path: Option<String>,
    pub album_artwork_cache_path: Option<String>,
    pub album_artwork: Option<String>, // base64
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ConvertOutputSettings {
    pub output_path: String,
    pub format: String, // "MP3", "M4A", "FLAC", etc.
    pub quality: String,
    pub overwrite_mode: String, // "overwrite" | "rename"
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ConvertProgress {
    pub current: usize,
    pub total: usize,
    pub current_file: String,
    pub status: String, // "processing" | "completed" | "error"
    pub progress_percent: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ConvertResult {
    pub success: bool,
    pub converted_files: Vec<String>,
    pub failed_files: Vec<ConvertError>,
    pub total_processed: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ConvertError {
    pub source_path: String,
    pub error_message: String,
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

    let supported_extensions = ["mp3", "m4a", "flac", "ogg", "wav", "aac", "wma"];
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
    let supported_extensions = ["mp3", "m4a", "flac", "ogg", "wav", "aac", "wma"];
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

// METADATA_BLOCK_PICTUREフォーマットでアルバムアートをエンコード（FLAC/OGG用）
fn create_metadata_block_picture(image_path: &str) -> Result<String, String> {
    use std::io::Read;
    
    // 画像ファイルを読み込み
    let mut file = std::fs::File::open(image_path)
        .map_err(|e| format!("画像ファイルの読み込みに失敗: {}", e))?;
    
    let mut image_data = Vec::new();
    file.read_to_end(&mut image_data)
        .map_err(|e| format!("画像データの読み込みに失敗: {}", e))?;
    
    // MIMEタイプを判定
    let mime_type = if image_path.to_lowercase().ends_with(".png") {
        "image/png"
    } else if image_path.to_lowercase().ends_with(".jpg") || image_path.to_lowercase().ends_with(".jpeg") {
        "image/jpeg"
    } else {
        "image/jpeg" // デフォルト
    };
    
    // METADATA_BLOCK_PICTURE構造を構築
    let mut block_data = Vec::new();
    
    // Picture type (3 = Cover (front))
    block_data.extend_from_slice(&3u32.to_be_bytes());
    
    // MIME type length and string
    let mime_bytes = mime_type.as_bytes();
    block_data.extend_from_slice(&(mime_bytes.len() as u32).to_be_bytes());
    block_data.extend_from_slice(mime_bytes);
    
    // Description (空)
    block_data.extend_from_slice(&0u32.to_be_bytes());
    
    // Width (0 = 不明)
    block_data.extend_from_slice(&0u32.to_be_bytes());
    
    // Height (0 = 不明)
    block_data.extend_from_slice(&0u32.to_be_bytes());
    
    // Color depth (0 = 不明)
    block_data.extend_from_slice(&0u32.to_be_bytes());
    
    // Number of colors (0 = 不明)
    block_data.extend_from_slice(&0u32.to_be_bytes());
    
    // Picture data length and data
    block_data.extend_from_slice(&(image_data.len() as u32).to_be_bytes());
    block_data.extend_from_slice(&image_data);
    
    // Base64エンコード
    Ok(BASE64_STANDARD.encode(&block_data))
}

async fn convert_single_file(
    app_handle: &AppHandle,
    track: &ConvertTrack,
    album_data: &ConvertAlbumData,
    output_settings: &ConvertOutputSettings,
    current: usize,
    total: usize,
) -> Result<String, String> {
    let source_path = &track.source_path;
    
    // 出力ファイル名を生成
    // AACの場合はm4a拡張子を使用
    let file_extension = if output_settings.format == "AAC" {
        "m4a"
    } else {
        &output_settings.format.to_lowercase()
    };
    
    let output_filename = format!(
        "{:02}-{:02} {}.{}",
        track.track_number.parse::<u32>().unwrap_or(1),
        track.disk_number.parse::<u32>().unwrap_or(1),
        sanitize_filename(&track.title),
        file_extension
    );
    
    let mut output_path = Path::new(&output_settings.output_path).join(&output_filename);
    
    // 同名ファイルの処理
    if output_path.exists() && output_settings.overwrite_mode == "rename" {
        let mut counter = 1;
        let stem = output_path.file_stem().unwrap().to_string_lossy().into_owned();
        let extension = output_path.extension().unwrap().to_string_lossy().into_owned();
        
        loop {
            let new_filename = format!("{}_{}.{}", stem, counter, extension);
            output_path = Path::new(&output_settings.output_path).join(&new_filename);
            if !output_path.exists() {
                break;
            }
            counter += 1;
        }
    }
    
    // 進捗通知
    let progress = ConvertProgress {
        current,
        total,
        current_file: track.title.clone(),
        status: "processing".to_string(),
        progress_percent: (current as f64 / total as f64) * 100.0,
    };
    
    let _ = app_handle.emit("convert-progress", &progress);
    
    // ffmpegコマンドを構築
    let mut ffmpeg_args = vec![
        "-i".to_string(),
        source_path.clone(),
    ];
    
    // アルバムアートを追加（入力ファイルとして）
    let has_artwork = album_data.album_artwork_path.is_some() || album_data.album_artwork_cache_path.is_some();
    if let Some(artwork_path) = &album_data.album_artwork_path {
        ffmpeg_args.extend(vec![
            "-i".to_string(),
            artwork_path.clone(),
        ]);
    } else if let Some(cache_path) = &album_data.album_artwork_cache_path {
        ffmpeg_args.extend(vec![
            "-i".to_string(),
            cache_path.clone(),
        ]);
    }
    
    // 上書き許可
    ffmpeg_args.push("-y".to_string());
    
    // マッピング設定
    if has_artwork {
        // M4A/AACの場合、PNGアルバムアートをJPEGに変換
        if output_settings.format == "AAC" || output_settings.format == "M4A" {
            ffmpeg_args.extend(vec![
                "-map".to_string(), "0:a".to_string(),  // 音声ストリームのみ
                "-map".to_string(), "1:0".to_string(),  // 外部アルバムアート
                "-c:a".to_string(), "aac".to_string(),  // オーディオコーデック
                "-c:v".to_string(), "mjpeg".to_string(), // アルバムアートをJPEGに変換
                "-disposition:v:0".to_string(), "attached_pic".to_string(),
            ]);
        } else {
            // FLAC/OGG形式は音声のみマッピング（METADATA_BLOCK_PICTUREで後から埋め込み）
            if output_settings.format == "FLAC" || output_settings.format == "OGG" {
                ffmpeg_args.extend(vec![
                    "-map".to_string(), "0:a".to_string(),  // 音声ストリームのみ
                ]);
            } else {
                ffmpeg_args.extend(vec![
                    "-map".to_string(), "0:a".to_string(),  // 音声ストリームのみ
                    "-map".to_string(), "1:0".to_string(),  // 外部アルバムアート
                    "-c:v".to_string(), "copy".to_string(),
                    "-disposition:v:0".to_string(), "attached_pic".to_string(),
                ]);
            }
        }
    } else {
        // アルバムアートがない場合は音声のみ
        ffmpeg_args.extend(vec![
            "-map".to_string(), "0:a".to_string(),  // 音声ストリームのみ
        ]);
    }
    
    // メタデータを設定
    ffmpeg_args.extend(vec![
        "-metadata".to_string(), format!("title={}", track.title),
        "-metadata".to_string(), format!("artist={}", track.artists.join(", ")),
        "-metadata".to_string(), format!("album={}", album_data.album_title),
        "-metadata".to_string(), format!("albumartist={}", album_data.album_artist),
        "-metadata".to_string(), format!("track={}", track.track_number),
        "-metadata".to_string(), format!("disc={}", track.disk_number),
        "-metadata".to_string(), format!("date={}", album_data.release_date),
        "-metadata".to_string(), format!("genre={}", album_data.tags.join(", ")),
    ]);
    
    // FLAC/OGG形式の場合、METADATA_BLOCK_PICTURE形式でアルバムアートを埋め込み
    if has_artwork && (output_settings.format == "FLAC" || output_settings.format == "OGG") {
        let artwork_path = album_data.album_artwork_path.as_ref()
            .or(album_data.album_artwork_cache_path.as_ref());
        
        if let Some(art_path) = artwork_path {
            match create_metadata_block_picture(art_path) {
                Ok(block_picture) => {
                    ffmpeg_args.extend(vec![
                        "-metadata:s:a:0".to_string(),
                        format!("METADATA_BLOCK_PICTURE={}", block_picture),
                    ]);
                },
                Err(e) => {
                    eprintln!("METADATA_BLOCK_PICTUREの作成に失敗: {}", e);
                }
            }
        }
    }
    
    // フォーマット別のエンコード設定
    match output_settings.format.as_str() {
        "MP3" => {
            ffmpeg_args.extend(vec![
                "-c:a".to_string(), "libmp3lame".to_string(),
            ]);
            match output_settings.quality.as_str() {
                "320" => ffmpeg_args.extend(vec!["-b:a".to_string(), "320k".to_string()]),
                "256" => ffmpeg_args.extend(vec!["-b:a".to_string(), "256k".to_string()]),
                "192" => ffmpeg_args.extend(vec!["-b:a".to_string(), "192k".to_string()]),
                "128" => ffmpeg_args.extend(vec!["-b:a".to_string(), "128k".to_string()]),
                "V0" => ffmpeg_args.extend(vec!["-q:a".to_string(), "0".to_string()]),
                "V2" => ffmpeg_args.extend(vec!["-q:a".to_string(), "2".to_string()]),
                _ => ffmpeg_args.extend(vec!["-b:a".to_string(), "192k".to_string()]),
            }
        },
        "M4A" => {
            ffmpeg_args.extend(vec![
                "-c:a".to_string(), "aac".to_string(),
            ]);
            match output_settings.quality.as_str() {
                "320" => ffmpeg_args.extend(vec!["-b:a".to_string(), "320k".to_string()]),
                "256" => ffmpeg_args.extend(vec!["-b:a".to_string(), "256k".to_string()]),
                "192" => ffmpeg_args.extend(vec!["-b:a".to_string(), "192k".to_string()]),
                "128" => ffmpeg_args.extend(vec!["-b:a".to_string(), "128k".to_string()]),
                _ => ffmpeg_args.extend(vec!["-b:a".to_string(), "192k".to_string()]),
            }
        },
        "FLAC" => {
            ffmpeg_args.extend(vec![
                "-c:a".to_string(), "flac".to_string(),
            ]);
            match output_settings.quality.as_str() {
                "0" => ffmpeg_args.extend(vec!["-compression_level".to_string(), "0".to_string()]),
                "5" => ffmpeg_args.extend(vec!["-compression_level".to_string(), "5".to_string()]),
                "8" => ffmpeg_args.extend(vec!["-compression_level".to_string(), "8".to_string()]),
                _ => ffmpeg_args.extend(vec!["-compression_level".to_string(), "5".to_string()]),
            }
        },
        "OGG" => {
            ffmpeg_args.extend(vec![
                "-c:a".to_string(), "libvorbis".to_string(),
            ]);
            match output_settings.quality.as_str() {
                "q10" => ffmpeg_args.extend(vec!["-q:a".to_string(), "10".to_string()]),
                "q6" => ffmpeg_args.extend(vec!["-q:a".to_string(), "6".to_string()]),
                "q3" => ffmpeg_args.extend(vec!["-q:a".to_string(), "3".to_string()]),
                _ => ffmpeg_args.extend(vec!["-q:a".to_string(), "6".to_string()]),
            }
        },
        "AAC" => {
            // AACの場合、M4Aコンテナを使用（オーディオコーデックは既にマッピング設定で指定済み）
            ffmpeg_args.extend(vec![
                "-f".to_string(), "mp4".to_string(),  // MP4コンテナを強制
            ]);
            match output_settings.quality.as_str() {
                "320" => ffmpeg_args.extend(vec!["-b:a".to_string(), "320k".to_string()]),
                "256" => ffmpeg_args.extend(vec!["-b:a".to_string(), "256k".to_string()]),
                "192" => ffmpeg_args.extend(vec!["-b:a".to_string(), "192k".to_string()]),
                "128" => ffmpeg_args.extend(vec!["-b:a".to_string(), "128k".to_string()]),
                _ => ffmpeg_args.extend(vec!["-b:a".to_string(), "192k".to_string()]),
            }
        },
        _ => {
            return Err(format!("サポートされていないフォーマットです: {}", output_settings.format));
        }
    }
    
    // 出力ファイルパスを追加
    ffmpeg_args.push(output_path.to_string_lossy().to_string());
    
    // ffmpegコマンドを実行
    let output = Command::new("ffmpeg")
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
async fn convert_audio_files(
    app_handle: AppHandle,
    request: ConvertRequest,
) -> Result<ConvertResult, String> {
    let total = request.tracks.len();
    let mut converted_files = Vec::new();
    let mut failed_files = Vec::new();
    
    // 出力ディレクトリの存在確認・作成
    let output_dir = Path::new(&request.output_settings.output_path);
    if !output_dir.exists() {
        fs::create_dir_all(output_dir)
            .map_err(|e| format!("出力ディレクトリの作成に失敗しました: {}", e))?;
    }
    
    for (index, track) in request.tracks.iter().enumerate() {
        let current = index + 1;
        
        match convert_single_file(
            &app_handle,
            track,
            &request.album_data,
            &request.output_settings,
            current,
            total,
        ).await {
            Ok(output_path) => {
                converted_files.push(output_path);
                
                // 成功通知
                let progress = ConvertProgress {
                    current,
                    total,
                    current_file: track.title.clone(),
                    status: "completed".to_string(),
                    progress_percent: (current as f64 / total as f64) * 100.0,
                };
                let _ = app_handle.emit("convert-progress", &progress);
            }
            Err(error) => {
                failed_files.push(ConvertError {
                    source_path: track.source_path.clone(),
                    error_message: error,
                });
                
                // エラー通知
                let progress = ConvertProgress {
                    current,
                    total,
                    current_file: track.title.clone(),
                    status: "error".to_string(),
                    progress_percent: (current as f64 / total as f64) * 100.0,
                };
                let _ = app_handle.emit("convert-progress", &progress);
            }
        }
    }
    
    Ok(ConvertResult {
        success: failed_files.is_empty(),
        converted_files,
        failed_files,
        total_processed: total,
    })
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
            save_album_art_to_cache,
            convert_audio_files
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
