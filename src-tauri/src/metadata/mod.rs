use base64::prelude::*;
use serde_json;
use std::process::Stdio;
use tokio::process::Command;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

use crate::models::AudioMetadata;

mod mp3;
mod flac;
mod opus;
mod wav;

const SUPPORTED_EXTENSIONS: [&str; 4] = ["mp3", "flac", "opus", "wav"];

#[tauri::command]
pub async fn extract_metadata(file_path: String) -> Result<AudioMetadata, String> {
    if !std::path::Path::new(&file_path).exists() {
        return Err("ファイルが見つかりません".to_string());
    }

    extract_metadata_internal(&file_path).await
}

pub(crate) async fn extract_metadata_internal(file_path: &str) -> Result<AudioMetadata, String> {
    let extension = std::path::Path::new(file_path)
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_lowercase());

    let ext = match extension {
        Some(ext) if SUPPORTED_EXTENSIONS.contains(&ext.as_str()) => ext,
        _ => return Err("サポートされていないファイル形式です".to_string()),
    };

    match ext.as_str() {
        "mp3" => mp3::extract(file_path).await,
        "flac" => flac::extract(file_path).await,
        "opus" => opus::extract(file_path).await,
        "wav" => wav::extract(file_path).await,
        _ => Err("サポートされていないファイル形式です".to_string()),
    }
}

pub(super) async fn run_ffprobe(file_path: &str) -> Result<serde_json::Value, String> {
    let mut cmd = Command::new("ffprobe");
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    let output = cmd
        .args([
            "-v",
            "quiet",
            "-print_format",
            "json",
            "-show_format",
            "-show_streams",
            file_path,
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

    Ok(json_data)
}

pub(super) fn get_tag_value(tags: &serde_json::Value, possible_keys: &[&str]) -> Option<String> {
    for key in possible_keys {
        if let Some(value) = tags.get(key).and_then(|v| v.as_str()) {
            if !value.trim().is_empty() {
                return Some(value.to_string());
            }
        }
    }
    None
}

pub(super) fn extract_txxx_tags(tags: &serde_json::Value) -> Option<Vec<String>> {
    // TXXXフレームを探す（大文字小文字の違いに対応）
    let txxx_keys = ["TXXX", "txxx", "Txxx"];

    for key in txxx_keys {
        if let Some(txxx_value) = tags.get(key).and_then(|v| v.as_str()) {
            // "TAG="で始まるTXXXフレームを探す
            if txxx_value.starts_with("TAG=") {
                let tag_content = &txxx_value[4..]; // "TAG="を除去
                if !tag_content.trim().is_empty() {
                    // セミコロンで分割してタグリストを作成
                    let tag_list: Vec<String> = tag_content
                        .split(';')
                        .map(|tag| tag.trim().to_string())
                        .filter(|tag| !tag.is_empty())
                        .collect();

                    if !tag_list.is_empty() {
                        return Some(tag_list);
                    }
                }
            }
        }
    }

    None
}

pub(super) async fn extract_album_art(file_path: &str) -> Option<String> {
    let mut cmd = Command::new("ffmpeg");
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    let output = cmd
        .args(["-i", file_path, "-an", "-vcodec", "copy", "-f", "image2pipe", "-"])
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .output()
        .await;

    match output {
        Ok(output) => {
            if output.status.success() && !output.stdout.is_empty() {
                Some(BASE64_STANDARD.encode(&output.stdout))
            } else {
                None
            }
        }
        Err(_) => None,
    }
}

pub(super) async fn parse_duration(duration_str: &str) -> Option<String> {
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

pub(super) async fn parse_common_metadata(json_data: &serde_json::Value) -> AudioMetadata {
    let format = json_data.get("format");
    let format_tags = format.and_then(|f| f.get("tags"));
    let streams = json_data.get("streams").and_then(|s| s.as_array());

    // オーディオストリーム
    let audio_stream = streams.and_then(|streams| {
        streams.iter().find(|stream| {
            stream
                .get("codec_type")
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
        tags: None,
    };

    // OGG(=Opus)では stream.tags 側に主要タグがあることが多い。優先順位: stream.tags → format.tags
    let stream_tags = audio_stream.and_then(|stream| stream.get("tags"));
    let tags_to_use = stream_tags.or(format_tags);

    if let Some(tags) = tags_to_use {
        metadata.title = get_tag_value(tags, &["title", "Title", "TITLE", "TRACKTITLE"]);
        metadata.artist = get_tag_value(tags, &["artist", "Artist", "ARTIST", "PERFORMER"]);
        metadata.album_artist = get_tag_value(
            tags,
            &[
                "album_artist",
                "AlbumArtist",
                "ALBUMARTIST",
                "albumartist",
                "ALBUM_ARTIST",
            ],
        );
        metadata.album = get_tag_value(tags, &["album", "Album", "ALBUM"]);
        metadata.track_number = get_tag_value(
            tags,
            &["track", "Track", "TRACK", "TRACKNUMBER", "tracknumber"],
        );
        metadata.disk_number = get_tag_value(
            tags,
            &["disc", "Disc", "DISC", "DISCNUMBER", "disk", "Disk", "DISK", "discnumber"],
        );
        metadata.date = get_tag_value(tags, &["date", "Date", "DATE", "year", "Year", "YEAR"]);
        metadata.genre = get_tag_value(tags, &["genre", "Genre", "GENRE"]);
        metadata.comment = get_tag_value(tags, &["comment", "Comment", "COMMENT", "DESCRIPTION"]);

        // TXXXフレームからカスタムタグを抽出（MP3向け）。他形式では存在しないことが多い
        let txxx = extract_txxx_tags(tags);
        // さらに Vorbis/OGG 系では TAG キーにセミコロン区切りで入ってくることがある
        let ogg_tag = get_tag_value(tags, &["TAG", "Tag", "tag"])
            .map(|s| s.split(';').map(|t| t.trim().to_string()).filter(|t| !t.is_empty()).collect::<Vec<_>>());
        metadata.tags = match (txxx, ogg_tag) {
            (Some(mut a), Some(b)) => { a.extend(b); Some(a) },
            (Some(a), None) => Some(a),
            (None, Some(b)) => if b.is_empty() { None } else { Some(b) },
            (None, None) => None,
        };
    }

    if let Some(f) = format {
        if let Some(duration_str) = f.get("duration").and_then(|d| d.as_str()) {
            metadata.duration = parse_duration(duration_str).await;
        }
        if let Some(bitrate) = f.get("bit_rate").and_then(|b| b.as_str()) {
            if let Ok(bitrate_num) = bitrate.parse::<u64>() {
                metadata.bitrate = Some(format!("{} kbps", bitrate_num / 1000));
            }
        }
    }

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

    // stream.tagsとformat.tagsの不足分を補完（stream優先を崩さずに空欄を埋める）
    if let Some(f_tags) = format_tags {
        let fill = |cur: &mut Option<String>, keyset: &[&str]| {
            if cur.is_none() {
                *cur = get_tag_value(f_tags, keyset);
            }
        };
        fill(&mut metadata.title, &["title", "Title", "TITLE", "TRACKTITLE"]);
        fill(&mut metadata.artist, &["artist", "Artist", "ARTIST", "PERFORMER"]);
        fill(&mut metadata.album_artist, &["album_artist", "AlbumArtist", "ALBUMARTIST", "albumartist", "ALBUM_ARTIST"]);
        fill(&mut metadata.album, &["album", "Album", "ALBUM"]);
        fill(&mut metadata.track_number, &["track", "Track", "TRACK", "TRACKNUMBER", "tracknumber"]);
        fill(&mut metadata.disk_number, &["disc", "Disc", "DISC", "DISCNUMBER", "disk", "Disk", "DISK", "discnumber"]);
        fill(&mut metadata.date, &["date", "Date", "DATE", "year", "Year", "YEAR"]);
        fill(&mut metadata.genre, &["genre", "Genre", "GENRE"]);
        fill(&mut metadata.comment, &["comment", "Comment", "COMMENT", "DESCRIPTION"]);
        if metadata.tags.is_none() {
            let ogg_tag = get_tag_value(f_tags, &["TAG", "Tag", "tag"]).map(|s| s.split(';').map(|t| t.trim().to_string()).filter(|t| !t.is_empty()).collect::<Vec<_>>());
            metadata.tags = ogg_tag.filter(|v| !v.is_empty());
        }
    }

    metadata
}
