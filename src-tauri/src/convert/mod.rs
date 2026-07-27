use std::{
    collections::HashSet,
    fs,
    path::{Path, PathBuf},
};

use futures::{stream, StreamExt};
use serde::Deserialize;
use std::sync::{
    atomic::{AtomicUsize, Ordering},
    Arc,
};
use tauri::{AppHandle, Emitter};
use tokio::process::Command;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

mod m4a;
mod mp3;

use crate::models::{
    ConvertAlbumData, ConvertError, ConvertOutputSettings, ConvertProgress, ConvertRequest,
    ConvertResult, ConvertTrack,
};
use crate::utils::sanitize_filename;

/// ffprobeの出力形式（必要な部分のみ）
#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct FFProbeOutput {
    streams: Option<Vec<FFProbeStream>>,
    format: Option<FFProbeFormat>,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct FFProbeStream {
    codec_type: Option<String>,
    codec_name: Option<String>,
    duration: Option<String>,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct FFProbeFormat {
    duration: Option<String>,
    size: Option<String>,
    format_name: Option<String>,
}

fn resolve_output_extension(format: &str) -> &'static str {
    match format.to_ascii_uppercase().as_str() {
        "M4A" => "m4a",
        _ => "mp3",
    }
}

/// ソースの拡張子が出力コンテナへストリームコピー可能か判定する
fn source_supports_stream_copy(source_path: &str, format: &str) -> bool {
    let extension = Path::new(source_path)
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();

    match format.to_ascii_uppercase().as_str() {
        "M4A" => matches!(extension.as_str(), "m4a" | "mp4" | "aac" | "m4b"),
        _ => extension == "mp3",
    }
}

fn wants_stream_copy(output_settings: &ConvertOutputSettings) -> bool {
    output_settings.encode_mode.eq_ignore_ascii_case("copy")
}

fn resolve_artwork_input_path(album_data: &ConvertAlbumData) -> Option<String> {
    if let Some(artwork_path) = &album_data.album_artwork_path {
        let trimmed = artwork_path.trim();
        if !trimmed.is_empty() && crate::path_utils::path_exists(trimmed) {
            return Some(trimmed.to_string());
        }
    }

    if let Some(cache_path) = &album_data.album_artwork_cache_path {
        let trimmed = cache_path.trim();
        if !trimmed.is_empty() && crate::path_utils::path_exists(trimmed) {
            return Some(trimmed.to_string());
        }
    }

    None
}

fn expected_audio_codec(format: &str) -> &'static str {
    match format.to_ascii_uppercase().as_str() {
        "M4A" => "aac",
        _ => "mp3",
    }
}

fn container_matches(format_name: &str, requested_format: &str) -> bool {
    let names: Vec<&str> = format_name.split(',').collect();
    match requested_format.to_ascii_uppercase().as_str() {
        "M4A" => names
            .iter()
            .any(|name| matches!(*name, "mov" | "mp4" | "m4a")),
        _ => names.contains(&"mp3"),
    }
}

fn parse_positive_duration(value: Option<&String>) -> Option<f64> {
    value
        .and_then(|duration| duration.parse::<f64>().ok())
        .filter(|duration| duration.is_finite() && *duration > 0.0)
}

fn command_error_detail(stderr: &[u8]) -> String {
    let detail = String::from_utf8_lossy(stderr).trim().to_string();
    if detail.is_empty() {
        return "詳しいエラー情報を取得できませんでした".to_string();
    }

    const MAX_CHARS: usize = 2000;
    let mut chars = detail.chars();
    let shortened: String = chars.by_ref().take(MAX_CHARS).collect();
    if chars.next().is_some() {
        format!("{}…", shortened)
    } else {
        shortened
    }
}

async fn verify_audio_can_be_decoded(output_path: &Path) -> Result<(), String> {
    let ffmpeg_path = crate::system_check::get_ffmpeg_path()
        .await
        .unwrap_or_else(|| PathBuf::from("ffmpeg"));

    let mut cmd = Command::new(ffmpeg_path);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let output = cmd
        .args([
            "-nostdin",
            "-v",
            "error",
            "-xerror",
            "-i",
            &crate::path_utils::prepare_cmd_arg(&output_path.to_string_lossy()),
            "-map",
            "0:a:0",
            "-f",
            "null",
            "-",
        ])
        .output()
        .await
        .map_err(|e| format!("再生確認処理を開始できませんでした: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "音声データを最後まで読み取れませんでした: {}",
            command_error_detail(&output.stderr)
        ));
    }

    Ok(())
}

/// ffmpegで生成された出力ファイルが、期待した形式で最後まで読み取れるか検証する
async fn verify_output_file(output_path: &Path, requested_format: &str) -> Result<(), String> {
    // 1. ファイルの存在チェック
    if !crate::path_utils::path_exists(output_path) {
        return Err("出力ファイルが存在しません".to_string());
    }

    // 2. ファイルサイズチェック（0バイトでないこと）
    let fs_output_path = crate::path_utils::to_extended_length_path_if_needed(output_path);
    let metadata = fs::metadata(&fs_output_path)
        .map_err(|e| format!("ファイル情報の取得に失敗しました: {}", e))?;

    let file_size = metadata.len();
    if file_size == 0 {
        return Err("出力ファイルのサイズが0バイトです".to_string());
    }

    // 最小サイズチェック（1KB未満は異常と判断）
    if file_size < 1024 {
        return Err(format!(
            "出力ファイルのサイズが異常に小さいです（{}バイト）",
            file_size
        ));
    }

    // 3. ffprobeでコンテナ、コーデック、再生時間を検証
    let ffprobe_path = crate::system_check::get_ffprobe_path()
        .await
        .unwrap_or_else(|| PathBuf::from("ffprobe"));

    let mut cmd = Command::new(ffprobe_path);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let output = cmd
        .args([
            "-v",
            "error",
            "-print_format",
            "json",
            "-show_streams",
            "-show_format",
            "-show_entries",
            "stream=codec_type,codec_name,duration:format=format_name,duration,size",
            &crate::path_utils::prepare_cmd_arg(&output_path.to_string_lossy()),
        ])
        .output()
        .await
        .map_err(|e| format!("ffprobeの実行に失敗しました: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "出力ファイルの情報を読み取れませんでした: {}",
            command_error_detail(&output.stderr)
        ));
    }

    // 4. JSON出力をパース
    let stdout = String::from_utf8_lossy(&output.stdout);
    let probe_result: FFProbeOutput = serde_json::from_str(&stdout)
        .map_err(|e| format!("ffprobeの出力解析に失敗しました: {}", e))?;

    // 5. オーディオストリームとコーデックの確認
    let audio_stream = probe_result.streams.as_ref().and_then(|streams| {
        streams
            .iter()
            .find(|stream| stream.codec_type.as_deref() == Some("audio"))
    });

    let audio_stream =
        audio_stream.ok_or_else(|| "出力ファイルに音声データが含まれていません".to_string())?;

    let expected_codec = expected_audio_codec(requested_format);
    if audio_stream.codec_name.as_deref() != Some(expected_codec) {
        return Err(format!(
            "音声形式が期待と異なります（期待: {}, 実際: {}）",
            expected_codec,
            audio_stream.codec_name.as_deref().unwrap_or("不明")
        ));
    }

    // 6. コンテナ形式と再生時間の確認
    let format = probe_result
        .format
        .as_ref()
        .ok_or_else(|| "出力ファイルの形式情報を取得できませんでした".to_string())?;

    let format_name = format
        .format_name
        .as_deref()
        .ok_or_else(|| "出力ファイルの形式を判定できませんでした".to_string())?;
    if !container_matches(format_name, requested_format) {
        return Err(format!(
            "保存形式が期待と異なります（期待: {}, 実際: {}）",
            requested_format, format_name
        ));
    }

    let duration = parse_positive_duration(format.duration.as_ref())
        .or_else(|| parse_positive_duration(audio_stream.duration.as_ref()))
        .ok_or_else(|| "出力ファイルの再生時間を確認できませんでした".to_string())?;
    if duration <= 0.0 {
        return Err("出力ファイルの再生時間が0秒です".to_string());
    }

    if let Some(probe_size) = format
        .size
        .as_ref()
        .and_then(|size| size.parse::<u64>().ok())
    {
        if probe_size == 0 || probe_size > file_size.saturating_add(16) {
            return Err("出力ファイルのサイズ情報が一致しません".to_string());
        }
    }

    // 7. 実際に音声データを先頭から末尾までデコードできることを確認
    verify_audio_can_be_decoded(output_path).await?;

    Ok(())
}

fn build_output_filename(track: &ConvertTrack, file_extension: &str) -> String {
    format!(
        "{:02}-{:02} {}.{}",
        track.disk_number.parse::<u32>().unwrap_or(1),
        track.track_number.parse::<u32>().unwrap_or(1),
        sanitize_filename(&track.title),
        file_extension
    )
}

fn append_counter(path: &Path, counter: usize) -> PathBuf {
    let parent = path.parent().unwrap_or_else(|| Path::new(""));
    let stem = path
        .file_stem()
        .map(|value| value.to_string_lossy())
        .unwrap_or_default();
    let extension = path
        .extension()
        .map(|value| value.to_string_lossy())
        .unwrap_or_default();

    if extension.is_empty() {
        parent.join(format!("{}_{}", stem, counter))
    } else {
        parent.join(format!("{}_{}.{}", stem, counter, extension))
    }
}

fn reserve_output_paths(
    tracks: &[ConvertTrack],
    album_data: &ConvertAlbumData,
    output_settings: &ConvertOutputSettings,
) -> Result<Vec<PathBuf>, String> {
    let file_extension = resolve_output_extension(&output_settings.format);
    let album_dir = Path::new(&output_settings.output_path)
        .join(sanitize_filename(&album_data.album_artist))
        .join(sanitize_filename(&album_data.album_title));

    if !crate::path_utils::path_exists(&album_dir) {
        crate::path_utils::create_dir_all_extended(&album_dir)
            .map_err(|e| format!("出力ディレクトリの作成に失敗しました: {}", e))?;
    }

    let mut reserved = HashSet::new();
    let mut paths = Vec::with_capacity(tracks.len());

    for track in tracks {
        let base_path = album_dir.join(build_output_filename(track, file_extension));
        let mut output_path = base_path.clone();
        let must_avoid_existing = output_settings.overwrite_mode == "rename";

        if reserved.contains(&output_path)
            || (must_avoid_existing && crate::path_utils::path_exists(&output_path))
        {
            let mut counter = 1;
            loop {
                let candidate = append_counter(&base_path, counter);
                if !reserved.contains(&candidate) && !crate::path_utils::path_exists(&candidate) {
                    output_path = candidate;
                    break;
                }
                counter += 1;
            }
        }

        reserved.insert(output_path.clone());
        paths.push(output_path);
    }

    Ok(paths)
}

fn temporary_path_for(output_path: &Path, current: usize, label: &str) -> PathBuf {
    let parent = output_path.parent().unwrap_or_else(|| Path::new(""));
    let stem = output_path
        .file_stem()
        .map(|value| value.to_string_lossy())
        .unwrap_or_default();
    let extension = output_path
        .extension()
        .map(|value| value.to_string_lossy())
        .unwrap_or_default();
    let process_id = std::process::id();

    let mut counter = 0;
    loop {
        let suffix = if counter == 0 {
            format!("{}.{}-{}-{}", stem, label, process_id, current)
        } else {
            format!("{}.{}-{}-{}-{}", stem, label, process_id, current, counter)
        };
        let candidate = if extension.is_empty() {
            parent.join(format!(".{}", suffix))
        } else {
            parent.join(format!(".{}.{}", suffix, extension))
        };
        if !crate::path_utils::path_exists(&candidate) {
            return candidate;
        }
        counter += 1;
    }
}

fn remove_file_if_present(path: &Path) {
    if crate::path_utils::path_exists(path) {
        let extended = crate::path_utils::to_extended_length_path_if_needed(path);
        let _ = fs::remove_file(extended);
    }
}

fn commit_verified_output(
    temporary_path: &Path,
    output_path: &Path,
    overwrite: bool,
    current: usize,
) -> Result<(), String> {
    let temporary_extended = crate::path_utils::to_extended_length_path_if_needed(temporary_path);
    let output_extended = crate::path_utils::to_extended_length_path_if_needed(output_path);

    if !crate::path_utils::path_exists(output_path) {
        return fs::rename(&temporary_extended, &output_extended)
            .map_err(|e| format!("検証済みファイルの保存に失敗しました: {}", e));
    }

    if !overwrite {
        return Err(
            "保存先に同名ファイルが作成されたため、安全のため保存を中止しました".to_string(),
        );
    }

    let backup_path = temporary_path_for(output_path, current, "vte-backup");
    let backup_extended = crate::path_utils::to_extended_length_path_if_needed(&backup_path);
    fs::rename(&output_extended, &backup_extended)
        .map_err(|e| format!("既存ファイルの一時退避に失敗しました: {}", e))?;

    match fs::rename(&temporary_extended, &output_extended) {
        Ok(()) => {
            remove_file_if_present(&backup_path);
            Ok(())
        }
        Err(save_error) => {
            let restore_result = fs::rename(&backup_extended, &output_extended);
            if let Err(restore_error) = restore_result {
                return Err(format!(
                    "新しいファイルの保存に失敗し、元のファイルも復元できませんでした: {} / {}",
                    save_error, restore_error
                ));
            }
            Err(format!(
                "新しいファイルの保存に失敗したため、元のファイルを保持しました: {}",
                save_error
            ))
        }
    }
}

async fn convert_single_file(
    app_handle: &AppHandle,
    track: &ConvertTrack,
    album_data: &ConvertAlbumData,
    output_settings: &ConvertOutputSettings,
    output_path: PathBuf,
    current: usize,
    total: usize,
    finished_counter: &Arc<AtomicUsize>,
) -> Result<String, String> {
    let source_path = &track.source_path;
    let temporary_path = temporary_path_for(&output_path, current, "vte-part");

    let progress = ConvertProgress {
        current,
        total,
        current_file: track.title.clone(),
        status: "processing".to_string(),
        // 進捗率は完了数ベース（処理開始時点では完了数）
        progress_percent: (finished_counter.load(Ordering::SeqCst) as f64 / total as f64) * 100.0,
    };
    let _ = app_handle.emit("convert-progress", &progress);

    let mut ffmpeg_args: Vec<String> = vec![
        "-i".to_string(),
        crate::path_utils::prepare_cmd_arg(source_path),
    ];

    let artwork_input_path = resolve_artwork_input_path(album_data);
    let artwork_input_added = if let Some(path) = &artwork_input_path {
        ffmpeg_args.push("-i".to_string());
        ffmpeg_args.push(crate::path_utils::prepare_cmd_arg(path));
        true
    } else {
        false
    };

    // allow overwrite
    ffmpeg_args.push("-y".to_string());

    // 同じ形式なら再エンコードせずタグ／カバーのみ更新。形式が違う場合は通常変換へフォールバック。
    let stream_copy = wants_stream_copy(output_settings)
        && source_supports_stream_copy(source_path, &output_settings.format);

    match output_settings.format.to_ascii_uppercase().as_str() {
        "M4A" => {
            m4a::append_format_specific_args(
                &mut ffmpeg_args,
                artwork_input_added,
                track,
                album_data,
                output_settings,
                stream_copy,
            );
        }
        _ => {
            mp3::append_format_specific_args(
                &mut ffmpeg_args,
                artwork_input_added,
                track,
                album_data,
                output_settings,
                stream_copy,
            );
        }
    }

    ffmpeg_args.push(crate::path_utils::prepare_cmd_arg(
        &temporary_path.to_string_lossy(),
    ));

    let ffmpeg_path = crate::system_check::get_ffmpeg_path()
        .await
        .unwrap_or_else(|| std::path::PathBuf::from("ffmpeg"));
    let mut cmd = Command::new(ffmpeg_path);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    let output = cmd.args(&ffmpeg_args).output().await;

    let output = match output {
        Ok(output) => output,
        Err(error) => {
            remove_file_if_present(&temporary_path);
            return Err(format!("音声変換処理を開始できませんでした: {}", error));
        }
    };

    if !output.status.success() {
        remove_file_if_present(&temporary_path);
        return Err(format!(
            "音声ファイルを変換できませんでした: {}",
            command_error_detail(&output.stderr)
        ));
    }

    // 一時ファイルを検証し、合格したものだけを最終ファイルとして反映する
    if let Err(verification_error) =
        verify_output_file(&temporary_path, &output_settings.format).await
    {
        remove_file_if_present(&temporary_path);
        return Err(format!(
            "変換後のファイルを安全に確認できませんでした: {}",
            verification_error
        ));
    }

    if let Err(commit_error) = commit_verified_output(
        &temporary_path,
        &output_path,
        output_settings.overwrite_mode == "overwrite",
        current,
    ) {
        remove_file_if_present(&temporary_path);
        return Err(commit_error);
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
    if !crate::path_utils::path_exists(output_dir) {
        crate::path_utils::create_dir_all_extended(output_dir)
            .map_err(|e| format!("出力ディレクトリの作成に失敗しました: {}", e))?;
    }

    // 並列変換を始める前に保存先を予約し、同名トラック同士の競合を防ぐ
    let output_paths = reserve_output_paths(
        &request.tracks,
        &request.album_data,
        &request.output_settings,
    )?;

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
    let work_items = request.tracks.into_iter().zip(output_paths).enumerate();
    let results: Vec<Result<String, (String, String, usize)>> = stream::iter(work_items)
        .map(|(index, (track, output_path))| {
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
                    output_path,
                    current,
                    total,
                    &finished_counter,
                )
                .await
                {
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
            Err((source_path, error_message, _current)) => failed_files.push(ConvertError {
                source_path,
                error_message,
            }),
        }
    }

    Ok(ConvertResult {
        success: failed_files.is_empty(),
        converted_files,
        failed_files,
        total_processed: total,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn test_directory(label: &str) -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock should be available")
            .as_nanos();
        std::env::temp_dir().join(format!(
            "voice-tag-editor-{}-{}-{}",
            label,
            std::process::id(),
            unique
        ))
    }

    async fn create_test_audio(output_path: &Path, requested_format: &str) -> bool {
        let Some(ffmpeg_path) = crate::system_check::get_ffmpeg_path().await else {
            return false;
        };

        let codec = if requested_format.eq_ignore_ascii_case("M4A") {
            "aac"
        } else {
            "libmp3lame"
        };
        let output = Command::new(ffmpeg_path)
            .args([
                "-nostdin",
                "-v",
                "error",
                "-f",
                "lavfi",
                "-i",
                "sine=frequency=1000:duration=0.25",
                "-c:a",
                codec,
                "-y",
                &output_path.to_string_lossy(),
            ])
            .output()
            .await
            .expect("ffmpeg should start");

        output.status.success()
    }

    #[tokio::test]
    async fn generated_mp3_and_m4a_pass_full_verification() {
        if crate::system_check::get_ffprobe_path().await.is_none() {
            return;
        }

        let directory = test_directory("verify-valid");
        fs::create_dir_all(&directory).expect("test directory should be created");

        for (format, extension) in [("MP3", "mp3"), ("M4A", "m4a")] {
            let output_path = directory.join(format!("sample.{}", extension));
            if !create_test_audio(&output_path, format).await {
                remove_file_if_present(&output_path);
                let _ = fs::remove_dir_all(&directory);
                return;
            }
            verify_output_file(&output_path, format)
                .await
                .expect("generated audio should pass verification");
        }

        let _ = fs::remove_dir_all(directory);
    }

    #[tokio::test]
    async fn invalid_audio_is_rejected() {
        if crate::system_check::get_ffprobe_path().await.is_none() {
            return;
        }

        let directory = test_directory("verify-invalid");
        fs::create_dir_all(&directory).expect("test directory should be created");
        let output_path = directory.join("broken.mp3");
        fs::write(&output_path, vec![0_u8; 2048]).expect("broken test file should be written");

        let result = verify_output_file(&output_path, "MP3").await;
        assert!(result.is_err(), "invalid audio must not pass verification");

        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn stream_copy_is_allowed_only_for_compatible_containers() {
        assert!(source_supports_stream_copy("/tmp/a.mp3", "MP3"));
        assert!(source_supports_stream_copy("/tmp/a.MP3", "mp3"));
        assert!(!source_supports_stream_copy("/tmp/a.wav", "MP3"));
        assert!(!source_supports_stream_copy("/tmp/a.flac", "MP3"));
        assert!(source_supports_stream_copy("/tmp/a.m4a", "M4A"));
        assert!(source_supports_stream_copy("/tmp/a.mp4", "M4A"));
        assert!(!source_supports_stream_copy("/tmp/a.mp3", "M4A"));
    }

    #[test]
    fn verified_output_replaces_existing_file_without_losing_old_data_on_failure_path() {
        let directory = test_directory("atomic-replace");
        fs::create_dir_all(&directory).expect("test directory should be created");
        let output_path = directory.join("output.mp3");
        let temporary_path = directory.join(".output.vte-part.mp3");
        fs::write(&output_path, b"old audio").expect("old file should be written");
        fs::write(&temporary_path, b"new audio").expect("temporary file should be written");

        commit_verified_output(&temporary_path, &output_path, true, 1)
            .expect("verified file should replace the old file");

        assert_eq!(
            fs::read(&output_path).expect("output file should be readable"),
            b"new audio"
        );
        assert!(!temporary_path.exists());

        let _ = fs::remove_dir_all(directory);
    }
}
