use crate::models::AudioMetadata;

pub async fn extract(file_path: &str) -> Result<AudioMetadata, String> {
    let json = super::run_ffprobe(file_path).await?;
    let mut metadata = super::parse_common_metadata(&json).await;
    metadata.album_art = super::extract_album_art(file_path).await;
    Ok(metadata)
}
