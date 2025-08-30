use std::path::{Path, PathBuf};
use tokio::process::Command;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

fn is_file_executable(path: &Path) -> bool {
    if !path.is_file() {
        return false;
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if let Ok(meta) = std::fs::metadata(path) {
            let mode = meta.permissions().mode();
            return (mode & 0o111) != 0;
        }
        false
    }
    #[cfg(windows)]
    {
        // On Windows, existence with .exe is typically sufficient
        true
    }
}

fn env_override_path(var: &str) -> Option<PathBuf> { std::env::var_os(var).map(PathBuf::from) }

fn ffmpeg_candidates() -> Vec<PathBuf> {
    let mut cands: Vec<PathBuf> = Vec::new();

    // Environment override
    if let Some(p) = env_override_path("FFMPEG_PATH") {
        if p.is_dir() {
            #[cfg(windows)]
            { cands.push(p.join("ffmpeg.exe")); }
            #[cfg(not(windows))]
            { cands.push(p.join("ffmpeg")); }
        } else {
            cands.push(p);
        }
    }

    // PATH via which
    if let Ok(p) = which::which("ffmpeg") {
        cands.push(p);
    }

    // Platform-specific common install locations
    #[cfg(target_os = "macos")]
    {
        cands.push(PathBuf::from("/opt/homebrew/bin/ffmpeg")); // Apple Silicon Homebrew
        cands.push(PathBuf::from("/usr/local/bin/ffmpeg"));    // Intel Homebrew
        cands.push(PathBuf::from("/opt/local/bin/ffmpeg"));    // MacPorts
        cands.push(PathBuf::from("/usr/bin/ffmpeg"));
    }

    #[cfg(windows)]
    {
        // Program Files (common manual installs)
        if let Ok(program_files) = std::env::var("ProgramFiles") {
            cands.push(PathBuf::from(program_files).join("ffmpeg").join("bin").join("ffmpeg.exe"));
        }
        if let Ok(program_files_x86) = std::env::var("ProgramFiles(x86)") {
            cands.push(PathBuf::from(program_files_x86).join("ffmpeg").join("bin").join("ffmpeg.exe"));
        }
        // Chocolatey shim
        if let Ok(choco) = std::env::var("ChocolateyInstall") {
            cands.push(PathBuf::from(choco).join("bin").join("ffmpeg.exe"));
        } else {
            cands.push(PathBuf::from(r"C:\\ProgramData\\chocolatey\\bin\\ffmpeg.exe"));
        }
        // Scoop shim
        if let Ok(user_profile) = std::env::var("USERPROFILE") {
            cands.push(PathBuf::from(user_profile).join("scoop").join("shims").join("ffmpeg.exe"));
        }
        // Typical manual unzip location
        cands.push(PathBuf::from(r"C:\\ffmpeg\\bin\\ffmpeg.exe"));
    }

    cands
}

fn ffprobe_candidates() -> Vec<PathBuf> {
    let mut cands: Vec<PathBuf> = Vec::new();

    // Environment override
    if let Some(p) = env_override_path("FFPROBE_PATH") {
        if p.is_dir() {
            #[cfg(windows)]
            { cands.push(p.join("ffprobe.exe")); }
            #[cfg(not(windows))]
            { cands.push(p.join("ffprobe")); }
        } else {
            cands.push(p);
        }
    }

    // PATH via which
    if let Ok(p) = which::which("ffprobe") {
        cands.push(p);
    }

    // Platform-specific common install locations
    #[cfg(target_os = "macos")]
    {
        cands.push(PathBuf::from("/opt/homebrew/bin/ffprobe"));
        cands.push(PathBuf::from("/usr/local/bin/ffprobe"));
        cands.push(PathBuf::from("/opt/local/bin/ffprobe"));
        cands.push(PathBuf::from("/usr/bin/ffprobe"));
    }

    #[cfg(windows)]
    {
        if let Ok(program_files) = std::env::var("ProgramFiles") {
            cands.push(PathBuf::from(program_files).join("ffmpeg").join("bin").join("ffprobe.exe"));
        }
        if let Ok(program_files_x86) = std::env::var("ProgramFiles(x86)") {
            cands.push(PathBuf::from(program_files_x86).join("ffmpeg").join("bin").join("ffprobe.exe"));
        }
        if let Ok(choco) = std::env::var("ChocolateyInstall") {
            cands.push(PathBuf::from(choco).join("bin").join("ffprobe.exe"));
        } else {
            cands.push(PathBuf::from(r"C:\\ProgramData\\chocolatey\\bin\\ffprobe.exe"));
        }
        if let Ok(user_profile) = std::env::var("USERPROFILE") {
            cands.push(PathBuf::from(user_profile).join("scoop").join("shims").join("ffprobe.exe"));
        }
        cands.push(PathBuf::from(r"C:\\ffmpeg\\bin\\ffprobe.exe"));
    }

    cands
}

async fn verify_runs(path: &Path, arg: &str) -> bool {
    let mut cmd = Command::new(path);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd.arg(arg)
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null());
    match cmd.status().await {
        Ok(status) => status.success(),
        Err(_) => false,
    }
}

async fn find_working_executable(candidates: Vec<PathBuf>, version_arg: &str) -> Option<PathBuf> {
    for cand in candidates {
        if is_file_executable(&cand) && verify_runs(&cand, version_arg).await {
            return Some(cand);
        }
    }
    None
}

use std::sync::OnceLock;

static FFMPEG_PATH: OnceLock<PathBuf> = OnceLock::new();
static FFPROBE_PATH: OnceLock<PathBuf> = OnceLock::new();

pub async fn get_ffmpeg_path() -> Option<PathBuf> {
    if let Some(p) = FFMPEG_PATH.get() {
        return Some(p.clone());
    }
    let found = find_working_executable(ffmpeg_candidates(), "-version").await;
    if let Some(ref p) = found {
        let _ = FFMPEG_PATH.set(p.clone());
    }
    found
}

pub async fn get_ffprobe_path() -> Option<PathBuf> {
    if let Some(p) = FFPROBE_PATH.get() {
        return Some(p.clone());
    }
    let found = find_working_executable(ffprobe_candidates(), "-version").await;
    if let Some(ref p) = found {
        let _ = FFPROBE_PATH.set(p.clone());
    }
    found
}

#[tauri::command]
pub async fn check_ffmpeg() -> Result<bool, String> {
    // Try to locate and verify ffmpeg
    let ffmpeg_ok = get_ffmpeg_path().await.is_some();
    if !ffmpeg_ok {
        return Ok(false);
    }

    // Try to locate and verify ffprobe
    let ffprobe_ok = get_ffprobe_path().await.is_some();
    if !ffprobe_ok {
        return Ok(false);
    }

    Ok(true)
}
