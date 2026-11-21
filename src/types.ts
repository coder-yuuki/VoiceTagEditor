export interface Track {
  id: string;
  diskNumber: string;
  trackNumber: string;
  title: string;
  artists: string[];
  currentArtistInput: string;
  filePath?: string;
  duration?: string;
}

export interface AudioMetadata {
  title?: string;
  artist?: string;
  album_artist?: string;
  album?: string;
  track_number?: string;
  disk_number?: string;
  date?: string;
  genre?: string;
  comment?: string;
  duration?: string;
  bitrate?: string;
  sample_rate?: string;
  codec?: string;
  album_art?: string;
  tags?: string[];
}

export interface AudioFileResult {
  file_path: string;
  metadata?: AudioMetadata;
  error?: string;
}

export interface ProgressEvent {
  current: number;
  total: number;
  file_path: string;
  status: string;
}

export interface ConvertProgress {
  current: number;
  total: number;
  currentFile: string;
  status: string;
  percent: number;
}

export interface ConvertResult {
  success: boolean;
  converted_files: string[];
  failed_files: ConvertError[];
  total_processed: number;
}

export interface ConvertError {
  source_path: string;
  error_message: string;
}

export interface FfmpegInstallResult {
  available: boolean;
  installed: boolean;
  message: string;
  package_manager?: string | null;
}

export interface FfmpegInstallProgress {
  stream: string;
  message: string;
}

export type FfmpegSetupStatus = 'idle' | 'checking' | 'ready' | 'failed';

export interface FfmpegSetupState {
  status: FfmpegSetupStatus;
  message: string;
  technicalDetail?: string;
}

export interface AlbumData {
  albumArtwork: string | null;
  albumArtworkPath?: string;
  albumArtworkCachePath?: string;
  albumTitle: string;
  albumArtist: string;
  releaseDate: string;
  tags: string[];
  currentTagInput: string;
}

export interface ExportSettings {
  outputPath: string;
  overwriteMode: 'overwrite' | 'rename';
  format: 'MP3' | 'M4A';
  quality: 'highest' | 'high' | 'medium' | 'low';
  /** reencode: 常に再エンコード / copy: 同形式ならストリームコピー */
  encodeMode: 'reencode' | 'copy';
}

export interface QualityOption {
  value: ExportSettings['quality'];
  label: string;
}

export interface OnboardingStep {
  title: string;
  desc: string;
}

export interface ChipColor {
  backgroundColor: string;
  color: string;
}

export type AppMode = 'simple' | 'advanced';

export type WizardStep = 1 | 2 | 3 | 4 | 'complete';
