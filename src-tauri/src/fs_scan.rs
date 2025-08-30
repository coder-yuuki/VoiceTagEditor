use std::path::Path;
use walkdir::WalkDir;

#[tauri::command]
pub async fn scan_directory_for_audio_files(directory_path: String) -> Result<Vec<String>, String> {
    let path = Path::new(&directory_path);
    if !crate::path_utils::path_exists(path) {
        return Err("指定されたディレクトリが存在しません".to_string());
    }

    if !path.is_dir() {
        return Err("指定されたパスはディレクトリではありません".to_string());
    }

    let supported_extensions = ["wav", "mp3", "flac", "m4a"];

    // WalkDir で高速・安全に再帰走査（シンボリックリンクを追わない）
    let mut audio_files: Vec<String> = WalkDir::new(path)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
        .filter_map(|e| {
            let p = e.path();
            let ext = p.extension()?.to_str()?.to_lowercase();
            if supported_extensions.contains(&ext.as_str()) {
                Some(p.to_string_lossy().to_string())
            } else {
                None
            }
        })
        .collect();

    audio_files.sort();
    Ok(audio_files)
}

#[tauri::command]
pub async fn scan_directory_for_image_files(directory_path: String) -> Result<Vec<String>, String> {
    let path = Path::new(&directory_path);
    if !crate::path_utils::path_exists(path) {
        return Err("指定されたディレクトリが存在しません".to_string());
    }

    if !path.is_dir() {
        return Err("指定されたパスはディレクトリではありません".to_string());
    }

    let supported_extensions = ["png", "jpg", "jpeg", "webp"];

    let mut image_files: Vec<String> = WalkDir::new(path)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
        .filter_map(|e| {
            let p = e.path();
            let ext = p.extension()?.to_str()?.to_lowercase();
            if supported_extensions.contains(&ext.as_str()) {
                Some(p.to_string_lossy().to_string())
            } else {
                None
            }
        })
        .collect();

    image_files.sort();
    Ok(image_files)
}
