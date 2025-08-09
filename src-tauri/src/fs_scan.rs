use std::path::Path;

#[tauri::command]
pub async fn scan_directory_for_audio_files(directory_path: String) -> Result<Vec<String>, String> {
    let path = Path::new(&directory_path);
    if !path.exists() {
        return Err("指定されたディレクトリが存在しません".to_string());
    }

    if !path.is_dir() {
        return Err("指定されたパスはディレクトリではありません".to_string());
    }

    let supported_extensions = ["wav", "mp3", "flac", "opus"];
    let mut audio_files = Vec::new();

    scan_directory_recursive(path, &supported_extensions, &mut audio_files)?;

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
            scan_directory_recursive(&path, supported_extensions, audio_files)?;
        } else if path.is_file() {
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
