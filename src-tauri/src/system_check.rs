#[tauri::command]
pub async fn check_ffmpeg() -> Result<bool, String> {
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
