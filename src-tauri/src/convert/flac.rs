use crate::models::{ConvertAlbumData, ConvertOutputSettings, ConvertTrack};

// FFmpegでのFLAC出力は可逆圧縮のため、典型的には -compression_level でコントロール
// 0(速い/大きい)〜12(遅い/小さい)。一般には 5〜8 が現実的。
// ここでは UI の "highest" 等を backend の numeric に既に変換せず、
// output_settings.quality の想定値を次の文字列にする: "0".."12" または "5" を既定。
// UI 側でマッピングする。

pub fn append_format_specific_args(
    ffmpeg_args: &mut Vec<String>,
    artwork_input_added: bool,
    track: &ConvertTrack,
    album_data: &ConvertAlbumData,
    output_settings: &ConvertOutputSettings,
    artwork_input_path: Option<&str>,
) {
    // FLACはVorbisComment。画像の埋め込みは -map で追加可能だが、
    // attached_pic はMP3/M4A向けの概念。FLACではMETADATA_BLOCK_PICTUREを使う。
    // ffmpegでは画像入力を追加し、-disposition:v:0 attached_pic の代わりに
    // -metadata:s:v:0 title="Album cover" -metadata:s:v:0 comment="Cover (front)" を付与。
    // ただしFLACでは画像を埋め込みできるが、一部プレイヤー互換のため -map 設定を行う。

    if artwork_input_added {
        ffmpeg_args.extend(vec![
            "-map".to_string(),
            "0:a".to_string(),
            "-map".to_string(),
            "1:v:0".to_string(),
        ]);

        // FLACの画像はMETADATA_BLOCK_PICTUREとして格納される。
        // 入力拡張子に応じてコーデックを選択（png/jpg想定）。
        let vcodec = match artwork_input_path.and_then(|p| std::path::Path::new(p).extension().and_then(|e| e.to_str()).map(|s| s.to_ascii_lowercase())) {
            Some(ext) if ext == "png" => "png".to_string(),
            _ => "mjpeg".to_string(),
        };
        ffmpeg_args.extend(vec![
            "-c:v:0".to_string(),
            vcodec,
            "-disposition:v:0".to_string(),
            "attached_pic".to_string(),
            "-metadata:s:v:0".to_string(),
            "title=Album cover".to_string(),
            "-metadata:s:v:0".to_string(),
            "comment=Cover (front)".to_string(),
        ]);
    } else {
        ffmpeg_args.extend(vec!["-map".to_string(), "0:a".to_string()]);
    }

    // メタデータ（VorbisComment）
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
        // VorbisCommentにフラット格納。TXXXはID3の概念なのでFLACでは通常使わない。
        ffmpeg_args.extend(vec![
            "-metadata".to_string(),
            format!("TAG={}", album_data.tags.join(";")),
        ]);
    }

    // エンコードコーデック
    ffmpeg_args.extend(vec![
        "-c:a".to_string(),
        "flac".to_string(),
    ]);

    // 圧縮レベル。未指定は5にフォールバック
    let level = match output_settings.quality.as_str() {
        "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "11" | "12" => output_settings.quality.as_str(),
        _ => "5",
    };
    ffmpeg_args.extend(vec!["-compression_level".to_string(), level.to_string()]);
}


