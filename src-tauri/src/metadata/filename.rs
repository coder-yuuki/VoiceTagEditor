use std::sync::OnceLock;

use regex::Regex;

use crate::models::AudioMetadata;

#[derive(Debug, PartialEq, Eq)]
struct FilenameInference {
    title: String,
    track_number: Option<String>,
    disk_number: Option<String>,
}

fn labeled_disk_track_pattern() -> &'static Regex {
    static PATTERN: OnceLock<Regex> = OnceLock::new();
    PATTERN.get_or_init(|| {
        Regex::new(
            r"(?ix)
            ^\s*[\[(]?\s*
            (?:disc|disk|cd|ディスク)\s*0*([1-9][0-9]?)
            \s*[\])]?\s*[-_.\s]+
            [\[(]?\s*(?:track|trk|tr|t|トラック)?\s*0*([1-9][0-9]{0,2})
            \s*[\])]?\s*[-_.\s]+
            (.+?)\s*$
            ",
        )
        .expect("labeled disk and track pattern must be valid")
    })
}

fn compact_disk_track_pattern() -> &'static Regex {
    static PATTERN: OnceLock<Regex> = OnceLock::new();
    PATTERN.get_or_init(|| {
        Regex::new(
            r"(?ix)
            ^\s*[\[(]?\s*
            d(?:isc|isk)?\s*0*([1-9][0-9]?)
            \s*t(?:rack|rk|r)?\s*0*([1-9][0-9]{0,2})
            \s*[\])]?\s*[-_.\s]+
            (.+?)\s*$
            ",
        )
        .expect("compact disk and track pattern must be valid")
    })
}

fn numeric_disk_track_pattern() -> &'static Regex {
    static PATTERN: OnceLock<Regex> = OnceLock::new();
    PATTERN.get_or_init(|| {
        Regex::new(
            r"(?x)
            ^\s*[\[(]?\s*0*([1-9][0-9]?)\s*[\])]?
            \s*[-_.]\s*
            [\[(]?\s*0*([1-9][0-9]{0,2})\s*[\])]?
            \s*[-_.\s]+
            (.+?)\s*$
            ",
        )
        .expect("numeric disk and track pattern must be valid")
    })
}

fn spaced_disk_track_pattern() -> &'static Regex {
    static PATTERN: OnceLock<Regex> = OnceLock::new();
    PATTERN.get_or_init(|| {
        Regex::new(
            r"(?x)
            ^\s*[\[(]?\s*0*([1-9][0-9]?)\s*[\])]?
            \s+
            [\[(]?\s*0*([1-9][0-9]{0,2})\s*[\])]?
            \s+
            (.+?)\s*$
            ",
        )
        .expect("spaced disk and track pattern must be valid")
    })
}

fn disk_only_pattern() -> &'static Regex {
    static PATTERN: OnceLock<Regex> = OnceLock::new();
    PATTERN.get_or_init(|| {
        Regex::new(
            r"(?ix)
            ^\s*[\[(]?\s*
            (?:disc|disk|cd|ディスク)\s*0*([1-9][0-9]?)
            \s*[\])]?\s*[-_.\s]+
            (.+?)\s*$
            ",
        )
        .expect("disk-only pattern must be valid")
    })
}

fn labeled_track_pattern() -> &'static Regex {
    static PATTERN: OnceLock<Regex> = OnceLock::new();
    PATTERN.get_or_init(|| {
        Regex::new(
            r"(?ix)
            ^\s*[\[(]?\s*
            (?:track|trk|tr|トラック|\#)\s*0*([1-9][0-9]{0,2})
            \s*[\])]?\s*[-_.\s]+
            (.+?)\s*$
            ",
        )
        .expect("labeled track pattern must be valid")
    })
}

fn bracketed_track_pattern() -> &'static Regex {
    static PATTERN: OnceLock<Regex> = OnceLock::new();
    PATTERN.get_or_init(|| {
        Regex::new(
            r"(?x)
            ^\s*[\[(]\s*0*([1-9][0-9]{0,2})\s*[\])]
            \s*[-_.\s]*
            (.+?)\s*$
            ",
        )
        .expect("bracketed track pattern must be valid")
    })
}

fn numeric_track_pattern() -> &'static Regex {
    static PATTERN: OnceLock<Regex> = OnceLock::new();
    PATTERN.get_or_init(|| {
        Regex::new(
            r"(?x)
            ^\s*0*([1-9][0-9]{0,2})
            \s*[-_.\s]+
            (.+?)\s*$
            ",
        )
        .expect("numeric track pattern must be valid")
    })
}

fn track_number_only_pattern() -> &'static Regex {
    static PATTERN: OnceLock<Regex> = OnceLock::new();
    PATTERN.get_or_init(|| {
        Regex::new(
            r"(?ix)
            ^\s*(?:track|trk|tr|トラック)\s*0*([1-9][0-9]{0,2})\s*$
            ",
        )
        .expect("track-number-only pattern must be valid")
    })
}

fn numeric_only_pattern() -> &'static Regex {
    static PATTERN: OnceLock<Regex> = OnceLock::new();
    PATTERN.get_or_init(|| {
        Regex::new(r"(?x)^\s*0*([1-9][0-9]{0,2})\s*$").expect("numeric-only pattern must be valid")
    })
}

fn directory_disk_pattern() -> &'static Regex {
    static PATTERN: OnceLock<Regex> = OnceLock::new();
    PATTERN.get_or_init(|| {
        Regex::new(
            r"(?ix)
            (?:^|[\s_\-\[(])
            (?:disc|disk|cd|ディスク)\s*[-_.\s]*0*([1-9][0-9]?)
            ",
        )
        .expect("directory disk pattern must be valid")
    })
}

fn normalize_for_parsing(value: &str) -> String {
    value
        .chars()
        .map(|character| {
            if ('！'..='～').contains(&character) {
                return char::from_u32(character as u32 - 0xfee0).unwrap_or(character);
            }

            match character {
                '　' => ' ',
                '‐' | '‑' | '‒' | '–' | '—' | '―' | '−' => '-',
                '【' | '「' => '[',
                '】' | '」' => ']',
                _ => character,
            }
        })
        .collect()
}

fn path_parts(file_path: &str) -> Vec<&str> {
    file_path
        .split(|character| character == '/' || character == '\\')
        .filter(|part| !part.is_empty())
        .collect()
}

fn file_stem(file_name: &str) -> &str {
    match file_name.rsplit_once('.') {
        Some((stem, _extension)) if !stem.is_empty() => stem,
        _ => file_name,
    }
}

fn clean_title(value: &str) -> String {
    value
        .trim_matches(|character: char| {
            character.is_whitespace() || matches!(character, '-' | '_' | '.')
        })
        .trim()
        .to_string()
}

fn captured_number(captures: &regex::Captures<'_>, index: usize) -> Option<String> {
    captures
        .get(index)
        .and_then(|value| value.as_str().parse::<u16>().ok())
        .filter(|value| *value > 0)
        .map(|value| value.to_string())
}

fn infer_disk_from_directories(parts: &[&str]) -> Option<String> {
    parts.iter().rev().skip(1).take(3).find_map(|directory| {
        let normalized = normalize_for_parsing(directory);
        directory_disk_pattern()
            .captures(&normalized)
            .and_then(|captures| captured_number(&captures, 1))
    })
}

fn infer_from_path(file_path: &str) -> FilenameInference {
    let parts = path_parts(file_path);
    let file_name = parts.last().copied().unwrap_or(file_path);
    let original_stem = file_stem(file_name).trim();
    let normalized_stem = normalize_for_parsing(original_stem);
    let directory_disk = infer_disk_from_directories(&parts);

    for pattern in [
        labeled_disk_track_pattern(),
        compact_disk_track_pattern(),
        numeric_disk_track_pattern(),
        spaced_disk_track_pattern(),
    ] {
        if let Some(captures) = pattern.captures(&normalized_stem) {
            let title = captures
                .get(3)
                .map(|value| clean_title(value.as_str()))
                .unwrap_or_default();
            if !title.is_empty() {
                return FilenameInference {
                    title,
                    track_number: captured_number(&captures, 2),
                    disk_number: captured_number(&captures, 1).or(directory_disk),
                };
            }
        }
    }

    if let Some(captures) = disk_only_pattern().captures(&normalized_stem) {
        let title = captures
            .get(2)
            .map(|value| clean_title(value.as_str()))
            .unwrap_or_default();
        if !title.is_empty() {
            return FilenameInference {
                title,
                track_number: None,
                disk_number: captured_number(&captures, 1).or(directory_disk),
            };
        }
    }

    for pattern in [
        labeled_track_pattern(),
        bracketed_track_pattern(),
        numeric_track_pattern(),
    ] {
        if let Some(captures) = pattern.captures(&normalized_stem) {
            let title = captures
                .get(2)
                .map(|value| clean_title(value.as_str()))
                .unwrap_or_default();
            if !title.is_empty() {
                return FilenameInference {
                    title,
                    track_number: captured_number(&captures, 1),
                    disk_number: directory_disk,
                };
            }
        }
    }

    for pattern in [track_number_only_pattern(), numeric_only_pattern()] {
        if let Some(captures) = pattern.captures(&normalized_stem) {
            return FilenameInference {
                title: original_stem.to_string(),
                track_number: captured_number(&captures, 1),
                disk_number: directory_disk,
            };
        }
    }

    FilenameInference {
        title: original_stem.to_string(),
        track_number: None,
        disk_number: directory_disk,
    }
}

fn is_missing(value: &Option<String>) -> bool {
    value
        .as_deref()
        .map(str::trim)
        .map(str::is_empty)
        .unwrap_or(true)
}

pub(super) fn fill_missing_metadata_from_filename(metadata: &mut AudioMetadata, file_path: &str) {
    let inference = infer_from_path(file_path);

    if is_missing(&metadata.title) && !inference.title.is_empty() {
        metadata.title = Some(inference.title);
    }
    if is_missing(&metadata.track_number) {
        metadata.track_number = inference.track_number;
    }
    if is_missing(&metadata.disk_number) {
        metadata.disk_number = inference.disk_number;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn empty_metadata() -> AudioMetadata {
        AudioMetadata {
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
        }
    }

    #[test]
    fn infers_track_number_and_title_from_common_filename() {
        let inferred = infer_from_path("/作品/01 - はじまり.mp3");

        assert_eq!(inferred.title, "はじまり");
        assert_eq!(inferred.track_number.as_deref(), Some("1"));
        assert_eq!(inferred.disk_number, None);
    }

    #[test]
    fn infers_disk_and_track_from_number_pair() {
        let inferred = infer_from_path("/作品/02-07 後編.flac");

        assert_eq!(inferred.title, "後編");
        assert_eq!(inferred.track_number.as_deref(), Some("7"));
        assert_eq!(inferred.disk_number.as_deref(), Some("2"));
    }

    #[test]
    fn infers_disk_from_parent_directory_and_track_from_filename() {
        let inferred = infer_from_path(r"C:\作品\Disc 2\Track 03 - 本編.m4a");

        assert_eq!(inferred.title, "本編");
        assert_eq!(inferred.track_number.as_deref(), Some("3"));
        assert_eq!(inferred.disk_number.as_deref(), Some("2"));
    }

    #[test]
    fn supports_compact_and_full_width_names() {
        let inferred = infer_from_path("/作品/Ｄ２Ｔ０７＿エピローグ.wav");

        assert_eq!(inferred.title, "エピローグ");
        assert_eq!(inferred.track_number.as_deref(), Some("7"));
        assert_eq!(inferred.disk_number.as_deref(), Some("2"));
    }

    #[test]
    fn supports_bracketed_track_without_separator() {
        let inferred = infer_from_path("/作品/【０４】ボーナス.mp3");

        assert_eq!(inferred.title, "ボーナス");
        assert_eq!(inferred.track_number.as_deref(), Some("4"));
    }

    #[test]
    fn infers_track_number_when_filename_is_only_track_label() {
        let inferred = infer_from_path("/作品/WAV/track5.wav");

        assert_eq!(inferred.title, "track5");
        assert_eq!(inferred.track_number.as_deref(), Some("5"));
        assert_eq!(inferred.disk_number, None);
    }

    #[test]
    fn infers_track_number_when_filename_is_only_a_number() {
        let inferred = infer_from_path("/作品/CD2/008.wav");

        assert_eq!(inferred.title, "008");
        assert_eq!(inferred.track_number.as_deref(), Some("8"));
        assert_eq!(inferred.disk_number.as_deref(), Some("2"));
    }

    #[test]
    fn leaves_ambiguous_title_untouched() {
        let inferred = infer_from_path("/作品/2024年版.mp3");

        assert_eq!(inferred.title, "2024年版");
        assert_eq!(inferred.track_number, None);
        assert_eq!(inferred.disk_number, None);
    }

    #[test]
    fn existing_embedded_tags_take_priority() {
        let mut metadata = empty_metadata();
        metadata.title = Some("埋め込みタイトル".to_string());
        metadata.track_number = Some("9".to_string());
        metadata.disk_number = Some("3".to_string());

        fill_missing_metadata_from_filename(&mut metadata, "/Disc 1/01 - ファイル名.mp3");

        assert_eq!(metadata.title.as_deref(), Some("埋め込みタイトル"));
        assert_eq!(metadata.track_number.as_deref(), Some("9"));
        assert_eq!(metadata.disk_number.as_deref(), Some("3"));
    }

    #[test]
    fn fills_only_missing_embedded_tags() {
        let mut metadata = empty_metadata();
        metadata.title = Some("埋め込みタイトル".to_string());

        fill_missing_metadata_from_filename(&mut metadata, "/CD2/05 - ファイル名.mp3");

        assert_eq!(metadata.title.as_deref(), Some("埋め込みタイトル"));
        assert_eq!(metadata.track_number.as_deref(), Some("5"));
        assert_eq!(metadata.disk_number.as_deref(), Some("2"));
    }
}
