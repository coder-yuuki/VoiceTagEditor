use crate::models::{ConvertAlbumData, ConvertOutputSettings, ConvertTrack};

pub fn append_format_specific_args(
    ffmpeg_args: &mut Vec<String>,
    artwork_input_added: bool,
    track: &ConvertTrack,
    album_data: &ConvertAlbumData,
    output_settings: &ConvertOutputSettings,
) {
    // Ogg Opusはvideo/attached_picストリームを受け付けないため、画像はマッピングしない
    let _ = artwork_input_added; // 画像入力があっても無視
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


