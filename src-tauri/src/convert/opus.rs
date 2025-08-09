use crate::models::{ConvertAlbumData, ConvertOutputSettings, ConvertTrack};
use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use base64::Engine;
use std::fs;
use std::path::Path;

pub fn append_format_specific_args(
    ffmpeg_args: &mut Vec<String>,
    track: &ConvertTrack,
    album_data: &ConvertAlbumData,
    output_settings: &ConvertOutputSettings,
    artwork_input_path: Option<&str>,
) {
    // Ogg Opusはvideo/attached_picストリームを受け付けないため、画像はマッピングしない
    ffmpeg_args.extend(vec!["-map".to_string(), "0:a".to_string()]);

    // メタデータ（VorbisCommentに準拠）
    ffmpeg_args.extend(vec![
        "-metadata".to_string(),
        format!("TITLE={}", track.title),
        "-metadata".to_string(),
        format!("ALBUM={}", album_data.album_title),
        "-metadata".to_string(),
        format!("ALBUMARTIST={}", album_data.album_artist),
        "-metadata".to_string(),
        format!("TRACKNUMBER={}", track.track_number),
        "-metadata".to_string(),
        format!("DISCNUMBER={}", track.disk_number),
        "-metadata".to_string(),
        format!("DATE={}", album_data.release_date),
        "-metadata".to_string(),
        format!("GENRE={}", album_data.tags.join(", ")),
    ]);

    if !track.artists.is_empty() {
        ffmpeg_args.extend(vec![
            "-metadata".to_string(),
            format!("ARTIST={}", track.artists.join(";")),
        ]);
    }

    if !album_data.tags.is_empty() {
        ffmpeg_args.extend(vec![
            "-metadata".to_string(),
            format!("TAG={}", album_data.tags.join(";")),
        ]);
    }

    // METADATA_BLOCK_PICTURE を生成して埋め込む（base64）。
    if let Some(img_path) = artwork_input_path {
        if !img_path.trim().is_empty() && Path::new(img_path).exists() {
            if let Ok(image_bytes) = fs::read(img_path) {
                // picture type = 3 (Cover front)
                let mime_bytes: &[u8] = if img_path.to_ascii_lowercase().ends_with(".png") {
                    b"image/png"
                } else {
                    b"image/jpeg"
                };
                let description: &[u8] = b"";
                let width: u32 = 0;
                let height: u32 = 0;
                let depth: u32 = 24; // bits-per-pixel (unknownでも可)
                let colors: u32 = 0; // indexed palette colors (0 for non-indexed)

                let mut block: Vec<u8> = Vec::new();
                block.extend_from_slice(&3u32.to_be_bytes());
                block.extend_from_slice(&(mime_bytes.len() as u32).to_be_bytes());
                block.extend_from_slice(mime_bytes);
                block.extend_from_slice(&(description.len() as u32).to_be_bytes());
                block.extend_from_slice(description);
                block.extend_from_slice(&width.to_be_bytes());
                block.extend_from_slice(&height.to_be_bytes());
                block.extend_from_slice(&depth.to_be_bytes());
                block.extend_from_slice(&colors.to_be_bytes());
                block.extend_from_slice(&(image_bytes.len() as u32).to_be_bytes());
                block.extend_from_slice(&image_bytes);

                let b64 = BASE64_STANDARD.encode(&block);
                ffmpeg_args.extend(vec![
                    "-metadata".to_string(),
                    format!("METADATA_BLOCK_PICTURE={}", b64),
                ]);
            }
        }
    }

    ffmpeg_args.extend(vec![
        "-c:a".to_string(),
        "libopus".to_string(),
    ]);

    // ビットレート（kbps）マッピング。UIでは highest/high/medium/low を数値へ変換済みとする（例: 256, 192, 128, 96）。
    // 未設定時は 160k を既定に。
    let br = match output_settings.quality.as_str() {
        // 直接kbps指定が来るパス
        "320" | "256" | "224" | "192" | "160" | "128" | "96" | "64" => {
            format!("{}k", output_settings.quality)
        }
        // 想定外は既定
        _ => "160k".to_string(),
    };
    ffmpeg_args.extend(vec!["-b:a".to_string(), br]);

    // 推奨フラグ
    ffmpeg_args.extend(vec![
        "-application".to_string(),
        "audio".to_string(),
        "-frame_duration".to_string(),
        "20".to_string(),
        "-vbr".to_string(),
        "on".to_string(),
    ]);
}


