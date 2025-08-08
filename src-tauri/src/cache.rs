use base64::prelude::*;
use std::{fs, path::Path};

use crate::utils::sanitize_filename;

#[tauri::command]
pub async fn save_album_art_to_cache(
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
    let file_name = format!(
        "{}_{}.jpg",
        sanitize_filename(&album_title),
        sanitize_filename(&album_artist)
    );

    let file_path = cache_dir.join(file_name);

    // Base64データをデコード
    let image_data = BASE64_STANDARD
        .decode(&base64_data)
        .map_err(|e| format!("Base64デコードに失敗しました: {}", e))?;

    // ファイルに書き込み
    fs::write(&file_path, image_data)
        .map_err(|e| format!("ファイルの書き込みに失敗しました: {}", e))?;

    // パスを文字列として返す
    Ok(file_path.to_string_lossy().to_string())
}
