//! Downloads pinned FFmpeg / ffprobe builds into the app's local data directory,
//! so the app works without Homebrew, winget, admin rights, or PATH changes.

use sha2::{Digest, Sha256};
use std::fs::{self, File};
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::sync::{Arc, OnceLock};
use std::time::Duration;

/// Bump together with the asset URLs/hashes below.
pub const FFMPEG_VERSION: &str = "9.1";

static MANAGED_ROOT: OnceLock<PathBuf> = OnceLock::new();

/// Called once from Tauri `setup` with `app_local_data_dir()/ffmpeg`.
pub fn set_managed_root(root: PathBuf) {
    let _ = MANAGED_ROOT.set(root);
}

pub fn clean_up_interrupted_download(root: &Path) {
    if !root.is_dir() {
        return;
    }
    if let Ok(lock) = open_install_lock(root) {
        if lock.try_lock().is_ok() {
            remove_stale_staging_dirs(root);
        }
    }
}

fn managed_dir() -> Option<PathBuf> {
    MANAGED_ROOT.get().map(|root| root.join(FFMPEG_VERSION))
}

#[cfg(windows)]
fn exe_name(base: &str) -> String {
    format!("{}.exe", base)
}

#[cfg(not(windows))]
fn exe_name(base: &str) -> String {
    base.to_string()
}

/// Path where the managed copy of `ffmpeg` / `ffprobe` lives (may not exist yet).
pub fn managed_binary(base: &str) -> Option<PathBuf> {
    managed_dir().map(|dir| dir.join(exe_name(base)))
}

struct Asset {
    url: &'static str,
    sha256: &'static str,
    /// Binaries (without extension) to extract from this archive.
    binaries: &'static [&'static str],
}

// macOS: https://ffmpeg.martin-riedl.de/ (release builds, signed & notarized)
#[cfg(all(target_os = "macos", target_arch = "aarch64"))]
const ASSETS: &[Asset] = &[
    Asset {
        url: "https://ffmpeg.martin-riedl.de/download/macos/arm64/1795207104_9.1/ffmpeg.zip",
        sha256: "1f66e9a690a7f1c9e60b012379f8869c11818d1797f45b21dbb2f2564ba61ae1",
        binaries: &["ffmpeg"],
    },
    Asset {
        url: "https://ffmpeg.martin-riedl.de/download/macos/arm64/1795207104_9.1/ffprobe.zip",
        sha256: "6ef2df5f575042923a28537ab37adf936f28bf3e7b85de23a1447ed447ec1dbd",
        binaries: &["ffprobe"],
    },
];

#[cfg(all(target_os = "macos", target_arch = "x86_64"))]
const ASSETS: &[Asset] = &[
    Asset {
        url: "https://ffmpeg.martin-riedl.de/download/macos/amd64/1795212433_9.1/ffmpeg.zip",
        sha256: "35b3d82cccc2c1d644d49d15f5e57eb913a08ef68f798042c90eecec62c51f1e",
        binaries: &["ffmpeg"],
    },
    Asset {
        url: "https://ffmpeg.martin-riedl.de/download/macos/amd64/1795212433_9.1/ffprobe.zip",
        sha256: "41ca7b7cba7992e33f1da3f1bf54db8ec103a4d387b1bfac3162062e8b1074ad",
        binaries: &["ffprobe"],
    },
];

// Windows: https://github.com/GyanD/codexffmpeg (gyan.dev essentials build, x64; also runs on ARM64 via emulation)
#[cfg(windows)]
const ASSETS: &[Asset] = &[Asset {
    url: "https://github.com/GyanD/codexffmpeg/releases/download/9.1/ffmpeg-9.1-essentials_build.zip",
    sha256: "b9bbbb3acece000cbeec994f856649354e52c773807841e78908374b24d658fd",
    binaries: &["ffmpeg", "ffprobe"],
}];

#[cfg(not(any(
    all(target_os = "macos", any(target_arch = "aarch64", target_arch = "x86_64")),
    windows
)))]
const ASSETS: &[Asset] = &[];

pub fn is_supported() -> bool {
    if ASSETS.is_empty() {
        return false;
    }

    #[cfg(target_os = "macos")]
    {
        static SUPPORTED: OnceLock<bool> = OnceLock::new();
        *SUPPORTED.get_or_init(|| {
            std::process::Command::new("/usr/bin/sw_vers")
                .arg("-productVersion")
                .env("SYSTEM_VERSION_COMPAT", "0")
                .output()
                .is_ok_and(|output| {
                    output.status.success()
                        && supports_macos_version(&String::from_utf8_lossy(&output.stdout))
                })
        })
    }
    #[cfg(not(target_os = "macos"))]
    {
        true
    }
}

#[cfg(target_os = "macos")]
fn supports_macos_version(version: &str) -> bool {
    // The pinned macOS builds target macOS 12.0 and later.
    version
        .trim()
        .split('.')
        .next()
        .and_then(|major| major.parse::<u32>().ok())
        .is_some_and(|major| major >= 12)
}

fn to_hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

async fn download_to_file(
    client: &reqwest::Client,
    asset: &Asset,
    dest: &Path,
    progress: &(dyn Fn(String) + Sync),
) -> Result<(), String> {
    let file_name = asset.url.rsplit('/').next().unwrap_or(asset.url);
    progress(format!("ダウンロード中: {}", file_name));

    let mut response = client
        .get(asset.url)
        .send()
        .await
        .and_then(|r| r.error_for_status())
        .map_err(|e| format!("{} のダウンロードに失敗しました: {}", file_name, e))?;

    let total = response.content_length();
    let mut file = std::fs::File::create(dest)
        .map_err(|e| format!("一時ファイルを作成できませんでした: {}", e))?;
    let mut hasher = Sha256::new();
    let mut received: u64 = 0;
    let mut last_reported_step: u64 = 0;

    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|e| format!("{} のダウンロード中にエラーが発生しました: {}", file_name, e))?
    {
        hasher.update(&chunk);
        file.write_all(&chunk)
            .map_err(|e| format!("ダウンロードしたデータを保存できませんでした: {}", e))?;
        received += chunk.len() as u64;

        if let Some(total) = total.filter(|t| *t > 0) {
            let step = received * 10 / total; // report every 10%
            if step > last_reported_step {
                last_reported_step = step;
                progress(format!(
                    "ダウンロード中: {} {}% ({:.1} / {:.1} MB)",
                    file_name,
                    step * 10,
                    received as f64 / 1_048_576.0,
                    total as f64 / 1_048_576.0
                ));
            }
        }
    }
    file.flush()
        .map_err(|e| format!("ダウンロードしたデータを保存できませんでした: {}", e))?;

    let actual = to_hex(&hasher.finalize());
    if actual != asset.sha256 {
        return Err(format!(
            "{} の検証に失敗しました（SHA256 不一致）。\n期待値: {}\n実際: {}",
            file_name, asset.sha256, actual
        ));
    }
    progress(format!("検証OK: {}", file_name));
    Ok(())
}

fn extract_binaries(archive: &Path, binaries: &[&str], out_dir: &Path) -> Result<(), String> {
    let file = std::fs::File::open(archive)
        .map_err(|e| format!("アーカイブを開けませんでした: {}", e))?;
    let mut zip = zip::ZipArchive::new(file)
        .map_err(|e| format!("アーカイブを読み込めませんでした: {}", e))?;

    for base in binaries {
        let wanted = exe_name(base);
        let index = (0..zip.len())
            .find(|&i| {
                zip.by_index(i)
                    .ok()
                    .filter(|entry| entry.is_file())
                    .and_then(|entry| {
                        Path::new(entry.name())
                            .file_name()
                            .map(|n| n.to_string_lossy() == wanted.as_str())
                    })
                    .unwrap_or(false)
            })
            .ok_or_else(|| format!("アーカイブ内に {} が見つかりませんでした。", wanted))?;

        let mut entry = zip
            .by_index(index)
            .map_err(|e| format!("{} を展開できませんでした: {}", wanted, e))?;
        let out_path = out_dir.join(&wanted);
        let mut out = std::fs::File::create(&out_path)
            .map_err(|e| format!("{} を書き出せませんでした: {}", wanted, e))?;
        std::io::copy(&mut entry, &mut out)
            .map_err(|e| format!("{} を展開できませんでした: {}", wanted, e))?;

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&out_path, std::fs::Permissions::from_mode(0o755))
                .map_err(|e| format!("{} に実行権限を付与できませんでした: {}", wanted, e))?;
        }
    }
    Ok(())
}

fn open_install_lock(root: &Path) -> io::Result<File> {
    // Keep the lock file in place so every app instance locks the same file.
    File::options()
        .read(true)
        .write(true)
        .create(true)
        .truncate(false)
        .open(root.join("install.lock"))
}

fn remove_stale_staging_dirs(root: &Path) {
    let Ok(entries) = fs::read_dir(root) else {
        return;
    };
    for entry in entries.flatten() {
        let name = entry.file_name();
        let Some((version, pid)) = name.to_str().and_then(|name| name.split_once(".partial-")) else {
            continue;
        };
        if version.split('.').all(|part| part.parse::<u32>().is_ok())
            && pid.parse::<u32>().is_ok()
            && entry.file_type().is_ok_and(|kind| kind.is_dir())
        {
            let _ = fs::remove_dir_all(entry.path());
        }
    }
}

async fn lock_install(root: &Path, progress: &(dyn Fn(String) + Sync)) -> Result<Arc<File>, String> {
    let lock_error = |error| format!("FFmpegの準備をロックできませんでした: {}", error);
    let lock = open_install_lock(root).map_err(lock_error)?;
    let mut waiting = false;
    loop {
        match lock.try_lock() {
            Ok(()) => return Ok(Arc::new(lock)),
            Err(fs::TryLockError::WouldBlock) => {
                if !waiting {
                    progress("別のアプリ起動で進行中のFFmpegの準備を待っています。".to_string());
                    waiting = true;
                }
                tokio::time::sleep(Duration::from_millis(250)).await;
            }
            Err(fs::TryLockError::Error(error)) => return Err(lock_error(error)),
        }
    }
}

async fn binaries_work(dir: &Path) -> bool {
    let ffmpeg = dir.join(exe_name("ffmpeg"));
    let ffprobe = dir.join(exe_name("ffprobe"));
    ffmpeg.is_file()
        && ffprobe.is_file()
        && crate::system_check::verify_runs(&ffmpeg, "-version").await
        && crate::system_check::verify_runs(&ffprobe, "-version").await
}

/// Installs the pinned build, returning whether new binaries were downloaded.
pub async fn install(progress: &(dyn Fn(String) + Sync)) -> Result<bool, String> {
    if !is_supported() {
        return Err("このOS/CPUではFFmpegの自動ダウンロードに対応していません。".to_string());
    }
    let root = MANAGED_ROOT
        .get()
        .ok_or_else(|| "アプリのデータフォルダを取得できませんでした。".to_string())?;
    let target = root.join(FFMPEG_VERSION);
    fs::create_dir_all(root)
        .map_err(|e| format!("FFmpeg用フォルダを作成できませんでした ({}): {}", root.display(), e))?;
    let lock = lock_install(root, progress).await?;
    remove_stale_staging_dirs(root);
    if binaries_work(&target).await {
        return Ok(false);
    }

    let staging = root.join(format!("{}.partial-{}", FFMPEG_VERSION, std::process::id()));
    fs::create_dir(&staging)
        .map_err(|e| format!("FFmpeg用フォルダを作成できませんでした ({}): {}", staging.display(), e))?;

    let result = install_into(&staging, &lock, progress).await;
    if let Err(error) = result {
        let _ = fs::remove_dir_all(&staging);
        return Err(error);
    }
    if !binaries_work(&staging).await {
        let _ = fs::remove_dir_all(&staging);
        return Err("ダウンロードしたFFmpegを起動できませんでした。".to_string());
    }

    // Replace any previous (broken) copy, then move the verified files into place.
    match fs::remove_dir_all(&target) {
        Ok(()) => {}
        Err(e) if e.kind() == io::ErrorKind::NotFound => {}
        Err(e) => {
            let _ = fs::remove_dir_all(&staging);
            return Err(format!("古いFFmpegを削除できませんでした ({}): {}", target.display(), e));
        }
    }
    fs::rename(&staging, &target).map_err(|e| {
        let _ = fs::remove_dir_all(&staging);
        format!("FFmpegを配置できませんでした ({}): {}", target.display(), e)
    })?;

    progress(format!("FFmpeg {} を {} に準備しました。", FFMPEG_VERSION, target.display()));
    Ok(true)
}

async fn install_into(
    staging: &Path,
    lock: &Arc<File>,
    progress: &(dyn Fn(String) + Sync),
) -> Result<(), String> {
    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(30))
        .read_timeout(Duration::from_secs(60))
        .user_agent(concat!("VoiceTagEditor/", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|e| format!("HTTPクライアントを初期化できませんでした: {}", e))?;

    for (i, asset) in ASSETS.iter().enumerate() {
        let archive = staging.join(format!("download-{}.zip", i));
        download_to_file(&client, asset, &archive, progress).await?;

        progress("展開中…".to_string());
        let archive_for_task = archive.clone();
        let out_dir = staging.to_path_buf();
        let binaries = asset.binaries;
        let lock = Arc::clone(lock);
        tauri::async_runtime::spawn_blocking(move || {
            // Extraction can keep running if the async install is cancelled.
            let _lock = lock;
            extract_binaries(&archive_for_task, binaries, &out_dir)
        })
        .await
        .map_err(|e| format!("展開処理が中断されました: {}", e))??;
        let _ = std::fs::remove_file(&archive);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hashes_are_lowercase_sha256_hex() {
        for asset in ASSETS {
            assert_eq!(asset.sha256.len(), 64, "{}", asset.url);
            assert!(asset.sha256.chars().all(|c| matches!(c, '0'..='9' | 'a'..='f')));
            assert!(asset.url.starts_with("https://"));
        }
    }

    #[test]
    fn both_binaries_are_covered() {
        if ASSETS.is_empty() {
            return;
        }
        for base in ["ffmpeg", "ffprobe"] {
            assert!(ASSETS.iter().any(|a| a.binaries.contains(&base)), "{}", base);
        }
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn pinned_build_requires_macos_12() {
        assert!(!supports_macos_version("10.15.7\n"));
        assert!(!supports_macos_version("11.7.10\n"));
        assert!(supports_macos_version("12.0\n"));
        assert!(supports_macos_version("26.1\n"));
        assert!(!supports_macos_version(""));
    }

    #[test]
    fn startup_cleanup_leaves_staging_alone_while_install_is_locked() {
        let root = std::env::temp_dir().join(format!("vte-ffmpeg-cleanup-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        let staging = root.join("9.0.partial-123");
        let installed = root.join("9.0");
        fs::create_dir_all(&staging).unwrap();
        fs::create_dir_all(&installed).unwrap();

        let lock = open_install_lock(&root).unwrap();
        lock.try_lock().unwrap();
        clean_up_interrupted_download(&root);
        assert!(staging.is_dir());

        drop(lock);
        clean_up_interrupted_download(&root);
        assert!(!staging.exists());
        assert!(installed.is_dir());
        fs::remove_dir_all(&root).unwrap();
    }

    /// Real network download. Run with: cargo test --lib -- --ignored downloads_and_runs
    #[tokio::test]
    #[ignore]
    async fn downloads_and_runs() {
        let root = std::env::temp_dir().join(format!("vte-ffmpeg-test-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        set_managed_root(root.clone());
        let stale = root.join(format!("{}.partial-0", FFMPEG_VERSION));
        fs::create_dir_all(&stale).unwrap();
        fs::write(stale.join("download-0.zip"), b"partial download").unwrap();
        let progress = |m: String| println!("{}", m);
        let (first, second) = tokio::join!(install(&progress), install(&progress));
        assert!(first.expect("install"));
        assert!(!second.expect("reuse the installed binaries"));
        assert!(!stale.exists());
        let dir = managed_dir().unwrap();
        for base in ["ffmpeg", "ffprobe"] {
            let bin = managed_binary(base).unwrap();
            assert!(bin.starts_with(&dir));
            let out = std::process::Command::new(&bin).arg("-version").output().unwrap();
            assert!(out.status.success(), "{} failed to run", base);
        }
        let _ = std::fs::remove_dir_all(&root);
    }
}
