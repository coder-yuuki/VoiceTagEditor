use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AudioMetadata {
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album_artist: Option<String>,
    pub album: Option<String>,
    pub track_number: Option<String>,
    pub disk_number: Option<String>,
    pub date: Option<String>,
    pub genre: Option<String>,
    pub comment: Option<String>,
    pub duration: Option<String>,
    pub bitrate: Option<String>,
    pub sample_rate: Option<String>,
    pub codec: Option<String>,
    pub album_art: Option<String>,
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AudioFileResult {
    pub file_path: String,
    pub metadata: Option<AudioMetadata>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProgressEvent {
    pub current: usize,
    pub total: usize,
    pub file_path: String,
    pub status: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ConvertRequest {
    pub tracks: Vec<ConvertTrack>,
    pub album_data: ConvertAlbumData,
    pub output_settings: ConvertOutputSettings,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ConvertTrack {
    pub source_path: String,
    pub disk_number: String,
    pub track_number: String,
    pub title: String,
    pub artists: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ConvertAlbumData {
    pub album_title: String,
    pub album_artist: String,
    pub release_date: String,
    pub tags: Vec<String>,
    pub album_artwork_path: Option<String>,
    pub album_artwork_cache_path: Option<String>,
    pub album_artwork: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ConvertOutputSettings {
    pub output_path: String,
    pub format: String,
    pub quality: String,
    pub overwrite_mode: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ConvertProgress {
    pub current: usize,
    pub total: usize,
    pub current_file: String,
    pub status: String,
    pub progress_percent: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ConvertResult {
    pub success: bool,
    pub converted_files: Vec<String>,
    pub failed_files: Vec<ConvertError>,
    pub total_processed: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ConvertError {
    pub source_path: String,
    pub error_message: String,
}
