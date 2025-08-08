use std::{fs, path::Path};
use tokio::process::Command;
use tauri::{AppHandle, Emitter};

use crate::models::{ConvertAlbumData, ConvertError, ConvertOutputSettings, ConvertProgress, ConvertRequest, ConvertResult, ConvertTrack};
use crate::utils::sanitize_filename;

async fn convert_single_file(
    app_handle: &AppHandle,
    track: &ConvertTrack,
    album_data: &ConvertAlbumData,
    output_settings: &ConvertOutputSettings,
    current: usize,
    total: usize,
) -> Result<String, String> {
    let source_path = &track.source_path;

    // 出力ファイル名を生成（現状は MP3 固定）
    let file_extension = "mp3";

    let output_filename = format!(
        "{:02}-{:02} {}.{}",
        track.disk_number.parse::<u32>().unwrap_or(1),
        track.track_number.parse::<u32>().unwrap_or(1),
        sanitize_filename(&track.title),
        file_extension
    );

    // アルバムアーティスト/アルバムタイトルのディレクトリパスを構築
    let album_dir = Path::new(&output_settings.output_path)
        .join(sanitize_filename(&album_data.album_artist))
        .join(sanitize_filename(&album_data.album_title));

    // ディレクトリが存在しない場合は作成
    if !album_dir.exists() {
        fs::create_dir_all(&album_dir)
            .map_err(|e| format!("出力ディレクトリの作成に失敗しました: {}", e))?;
    }

    let mut output_path = album_dir.join(&output_filename);

    // 同名ファイルの処理
    if output_path.exists() && output_settings.overwrite_mode == "rename" {
        let mut counter = 1;
        let stem = output_path.file_stem().unwrap().to_string_lossy().into_owned();
        let extension = output_path.extension().unwrap().to_string_lossy().into_owned();

        loop {
            let new_filename = format!("{}_{}.{}", stem, counter, extension);
            output_path = album_dir.join(&new_filename);
            if !output_path.exists() {
                break;
            }
            counter += 1;
        }
    }

    // 進捗通知（開始）
    let progress = ConvertProgress {
        current,
        total,
        current_file: track.title.clone(),
        status: "processing".to_string(),
        progress_percent: (current as f64 / total as f64) * 100.0,
    };

    let _ = app_handle.emit("convert-progress", &progress);

    // ffmpegコマンドを構築
    let mut ffmpeg_args = vec!["-i".to_string(), source_path.clone()];

    // アルバムアートを追加（入力ファイルとして）
    let mut artwork_input_added = false;

    // 外部アルバムアートファイルの追加を試行
    if let Some(artwork_path) = &album_data.album_artwork_path {
        if !artwork_path.trim().is_empty() && std::path::Path::new(artwork_path).exists() {
            ffmpeg_args.extend(vec!["-i".to_string(), artwork_path.clone()]);
            artwork_input_added = true;
        }
    }

    // 外部アルバムアートがない場合はキャッシュを試行
    if !artwork_input_added {
        if let Some(cache_path) = &album_data.album_artwork_cache_path {
            if !cache_path.trim().is_empty() && std::path::Path::new(cache_path).exists() {
                ffmpeg_args.extend(vec!["-i".to_string(), cache_path.clone()]);
                artwork_input_added = true;
            }
        }
    }

    // 上書き許可
    ffmpeg_args.push("-y".to_string());

    // マッピング設定（MP3専用）
    if artwork_input_added {
        // 音声 + 外部アルバムアート
        ffmpeg_args.extend(vec![
            "-map".to_string(),
            "0:a".to_string(), // 音声ストリームのみ
            "-map".to_string(),
            "1:0".to_string(), // 外部アルバムアート
            "-c:v".to_string(),
            "copy".to_string(),
            "-disposition:v:0".to_string(),
            "attached_pic".to_string(),
        ]);
    } else {
        // アルバムアートがない場合は音声のみ
        ffmpeg_args.extend(vec!["-map".to_string(), "0:a".to_string()]);
    }

    // メタデータを設定
    ffmpeg_args.extend(vec![
        "-metadata".to_string(),
        format!("title={}", track.title),
        "-metadata".to_string(),
        format!("album={}", album_data.album_title),
        "-metadata".to_string(),
        format!("albumartist={}", album_data.album_artist),
        "-metadata".to_string(),
        format!("track={}", track.track_number),
        "-metadata".to_string(),
        format!("disc={}", track.disk_number),
        "-metadata".to_string(),
        format!("date={}", album_data.release_date),
        "-metadata".to_string(),
        format!("genre={}", album_data.tags.join(", ")),
    ]);

    // アーティストをセミコロン区切りで追加
    if !track.artists.is_empty() {
        ffmpeg_args.extend(vec![
            "-metadata".to_string(),
            format!("artist={}", track.artists.join(";")),
        ]);
    }

    // タグをTXXXフレームとして追加
    if !album_data.tags.is_empty() {
        ffmpeg_args.extend(vec![
            "-metadata".to_string(),
            format!("TXXX=TAG={}", album_data.tags.join(";")),
        ]);
    }

    // MP3エンコード設定
    ffmpeg_args.extend(vec![
        "-c:a".to_string(),
        "libmp3lame".to_string(),
        "-id3v2_version".to_string(),
        "3".to_string(),
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
pub async fn convert_audio_files(
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
        )
        .await
        {
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
