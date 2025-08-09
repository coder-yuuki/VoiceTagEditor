use crate::models::{ConvertAlbumData, ConvertOutputSettings, ConvertTrack};

pub fn append_format_specific_args(
    ffmpeg_args: &mut Vec<String>,
    artwork_input_added: bool,
    track: &ConvertTrack,
    album_data: &ConvertAlbumData,
    output_settings: &ConvertOutputSettings,
) {
    if artwork_input_added {
        ffmpeg_args.extend(vec![
            "-map".to_string(),
            "0:a".to_string(),
            "-map".to_string(),
            "1:0".to_string(),
            "-c:v".to_string(),
            "copy".to_string(),
            "-disposition:v:0".to_string(),
            "attached_pic".to_string(),
        ]);
    } else {
        ffmpeg_args.extend(vec!["-map".to_string(), "0:a".to_string()]);
    }

    ffmpeg_args.extend(vec![
        "-metadata".to_string(),
        format!("title={}", track.title),
        "-metadata".to_string(),
        format!("album={}", album_data.album_title),
        "-metadata".to_string(),
        format!("album_artist={}", album_data.album_artist),
        "-metadata".to_string(),
        format!("track={}", track.track_number),
        "-metadata".to_string(),
        format!("disc={}", track.disk_number),
        "-metadata".to_string(),
        format!("date={}", album_data.release_date),
        "-metadata".to_string(),
        format!("genre={}", album_data.tags.join(", ")),
    ]);

    if !track.artists.is_empty() {
        ffmpeg_args.extend(vec![
            "-metadata".to_string(),
            format!("artist={}", track.artists.join(";")),
        ]);
    }

    if !album_data.tags.is_empty() {
        ffmpeg_args.extend(vec![
            "-metadata".to_string(),
            format!("TXXX=TAG={}", album_data.tags.join(";")),
        ]);
    }

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
}


