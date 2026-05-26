use serde::Serialize;
use std::path::{Path, PathBuf};
use tauri::Emitter;
use tokio::io::{AsyncBufReadExt, AsyncRead, BufReader};
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

fn env_override_path(var: &str) -> Option<PathBuf> {
    std::env::var_os(var).map(PathBuf::from)
}

fn ffmpeg_candidates() -> Vec<PathBuf> {
    let mut cands: Vec<PathBuf> = Vec::new();

    // Environment override
    if let Some(p) = env_override_path("FFMPEG_PATH") {
        if p.is_dir() {
            #[cfg(windows)]
            {
                cands.push(p.join("ffmpeg.exe"));
            }
            #[cfg(not(windows))]
            {
                cands.push(p.join("ffmpeg"));
            }
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
        cands.push(PathBuf::from("/usr/local/bin/ffmpeg")); // Intel Homebrew
        cands.push(PathBuf::from("/opt/local/bin/ffmpeg")); // MacPorts
        cands.push(PathBuf::from("/usr/bin/ffmpeg"));
    }

    #[cfg(windows)]
    {
        // Program Files (common manual installs)
        if let Ok(program_files) = std::env::var("ProgramFiles") {
            cands.push(
                PathBuf::from(program_files)
                    .join("ffmpeg")
                    .join("bin")
                    .join("ffmpeg.exe"),
            );
        }
        if let Ok(program_files_x86) = std::env::var("ProgramFiles(x86)") {
            cands.push(
                PathBuf::from(program_files_x86)
                    .join("ffmpeg")
                    .join("bin")
                    .join("ffmpeg.exe"),
            );
        }
        // Chocolatey shim
        if let Ok(choco) = std::env::var("ChocolateyInstall") {
            cands.push(PathBuf::from(choco).join("bin").join("ffmpeg.exe"));
        } else {
            cands.push(PathBuf::from(
                r"C:\\ProgramData\\chocolatey\\bin\\ffmpeg.exe",
            ));
        }
        // Scoop shim
        if let Ok(user_profile) = std::env::var("USERPROFILE") {
            cands.push(
                PathBuf::from(user_profile)
                    .join("scoop")
                    .join("shims")
                    .join("ffmpeg.exe"),
            );
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
            {
                cands.push(p.join("ffprobe.exe"));
            }
            #[cfg(not(windows))]
            {
                cands.push(p.join("ffprobe"));
            }
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
            cands.push(
                PathBuf::from(program_files)
                    .join("ffmpeg")
                    .join("bin")
                    .join("ffprobe.exe"),
            );
        }
        if let Ok(program_files_x86) = std::env::var("ProgramFiles(x86)") {
            cands.push(
                PathBuf::from(program_files_x86)
                    .join("ffmpeg")
                    .join("bin")
                    .join("ffprobe.exe"),
            );
        }
        if let Ok(choco) = std::env::var("ChocolateyInstall") {
            cands.push(PathBuf::from(choco).join("bin").join("ffprobe.exe"));
        } else {
            cands.push(PathBuf::from(
                r"C:\\ProgramData\\chocolatey\\bin\\ffprobe.exe",
            ));
        }
        if let Ok(user_profile) = std::env::var("USERPROFILE") {
            cands.push(
                PathBuf::from(user_profile)
                    .join("scoop")
                    .join("shims")
                    .join("ffprobe.exe"),
            );
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

#[derive(Serialize)]
pub struct FfmpegInstallResult {
    available: bool,
    installed: bool,
    message: String,
    package_manager: Option<String>,
}

#[derive(Clone, Serialize)]
pub struct FfmpegInstallProgress {
    stream: String,
    message: String,
}

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

fn command_candidates(name: &str, extra_paths: &[&str]) -> Vec<PathBuf> {
    let mut cands = Vec::new();

    if let Ok(path) = which::which(name) {
        cands.push(path);
    }

    for path in extra_paths {
        cands.push(PathBuf::from(path));
    }

    cands
}

fn find_command(name: &str, extra_paths: &[&str]) -> Option<PathBuf> {
    command_candidates(name, extra_paths)
        .into_iter()
        .find(|path| is_file_executable(path))
}

fn command_line(program: &Path, args: &[&str]) -> String {
    let mut parts = vec![program.display().to_string()];
    parts.extend(args.iter().map(|arg| arg.to_string()));
    parts.join(" ")
}

fn emit_install_progress(app: &tauri::AppHandle, stream: &str, message: impl Into<String>) {
    let _ = app.emit(
        "ffmpeg-install-progress",
        FfmpegInstallProgress {
            stream: stream.to_string(),
            message: message.into(),
        },
    );
}

async fn collect_installer_output<R>(
    reader: R,
    stream: &'static str,
    app: tauri::AppHandle,
) -> Vec<String>
where
    R: AsyncRead + Unpin,
{
    let mut lines = BufReader::new(reader).lines();
    let mut output = Vec::new();

    while let Ok(Some(line)) = lines.next_line().await {
        let message = line.trim().to_string();
        if message.is_empty() {
            continue;
        }
        emit_install_progress(&app, stream, message.clone());
        output.push(message);
    }

    output
}

async fn run_installer(
    app: &tauri::AppHandle,
    program: &Path,
    args: &[&str],
) -> Result<(), String> {
    let command = command_line(program, args);
    emit_install_progress(app, "status", format!("実行中: {}", command));

    let mut cmd = Command::new(program);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let mut child = cmd
        .args(args)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("{} の実行に失敗しました: {}", command, e))?;

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();
    let stdout_app = app.clone();
    let stderr_app = app.clone();

    let stdout_lines = async move {
        match stdout {
            Some(pipe) => collect_installer_output(pipe, "stdout", stdout_app).await,
            None => Vec::new(),
        }
    };
    let stderr_lines = async move {
        match stderr {
            Some(pipe) => collect_installer_output(pipe, "stderr", stderr_app).await,
            None => Vec::new(),
        }
    };

    let (status, stdout, stderr) = futures::join!(child.wait(), stdout_lines, stderr_lines);
    let status = status.map_err(|e| format!("{} の終了待機に失敗しました: {}", command, e))?;

    if status.success() {
        emit_install_progress(app, "status", "FFmpegのインストール処理が完了しました。");
        return Ok(());
    }

    let stderr_detail = stderr.join("\n");
    let stdout_detail = stdout.join("\n");
    let detail = if !stderr_detail.is_empty() {
        stderr_detail
    } else if !stdout_detail.is_empty() {
        stdout_detail
    } else {
        format!("終了コード: {:?}", status.code())
    };

    Err(format!("{} が失敗しました。\n{}", command, detail))
}

#[cfg(target_os = "macos")]
async fn install_ffmpeg_with_package_manager(app: &tauri::AppHandle) -> Result<String, String> {
    let brew = find_command("brew", &["/opt/homebrew/bin/brew", "/usr/local/bin/brew"])
        .ok_or_else(|| {
            "FFmpegを自動インストールするにはHomebrewが必要です。\nhttps://brew.sh/ をインストールしてからアプリを再起動してください。"
                .to_string()
        })?;

    run_installer(app, &brew, &["install", "ffmpeg"]).await?;
    Ok("Homebrew".to_string())
}

#[cfg(windows)]
async fn install_ffmpeg_with_package_manager(app: &tauri::AppHandle) -> Result<String, String> {
    let mut failures = Vec::new();

    if let Some(winget) = find_command("winget", &[]) {
        match run_installer(
            app,
            &winget,
            &[
                "install",
                "--id",
                "Gyan.FFmpeg",
                "-e",
                "--accept-package-agreements",
                "--accept-source-agreements",
            ],
        )
        .await
        {
            Ok(()) => return Ok("winget".to_string()),
            Err(error) => failures.push(error),
        }
    }

    if let Some(choco) = find_command("choco", &[r"C:\ProgramData\chocolatey\bin\choco.exe"]) {
        match run_installer(app, &choco, &["install", "ffmpeg", "-y"]).await {
            Ok(()) => return Ok("Chocolatey".to_string()),
            Err(error) => failures.push(error),
        }
    }

    if let Some(scoop) = find_command("scoop", &[]) {
        match run_installer(app, &scoop, &["install", "ffmpeg"]).await {
            Ok(()) => return Ok("Scoop".to_string()),
            Err(error) => failures.push(error),
        }
    }

    if !failures.is_empty() {
        return Err(format!(
            "FFmpegの自動インストールに失敗しました。\n{}",
            failures.join("\n\n")
        ));
    }

    Err("FFmpegを自動インストールできるパッケージマネージャーが見つかりませんでした。winget、Chocolatey、Scoop のいずれかを利用できる状態にしてください。".to_string())
}

#[cfg(target_os = "linux")]
async fn install_ffmpeg_with_package_manager(app: &tauri::AppHandle) -> Result<String, String> {
    if let Some(apt_get) = find_command("apt-get", &["/usr/bin/apt-get"]) {
        run_installer(app, &apt_get, &["install", "-y", "ffmpeg"]).await?;
        return Ok("apt-get".to_string());
    }

    if let Some(dnf) = find_command("dnf", &["/usr/bin/dnf"]) {
        run_installer(app, &dnf, &["install", "-y", "ffmpeg"]).await?;
        return Ok("dnf".to_string());
    }

    if let Some(yum) = find_command("yum", &["/usr/bin/yum"]) {
        run_installer(app, &yum, &["install", "-y", "ffmpeg"]).await?;
        return Ok("yum".to_string());
    }

    if let Some(pacman) = find_command("pacman", &["/usr/bin/pacman"]) {
        run_installer(app, &pacman, &["-S", "--noconfirm", "ffmpeg"]).await?;
        return Ok("pacman".to_string());
    }

    Err("FFmpegを自動インストールできるパッケージマネージャーが見つかりませんでした。".to_string())
}

#[cfg(not(any(target_os = "macos", windows, target_os = "linux")))]
async fn install_ffmpeg_with_package_manager(_app: &tauri::AppHandle) -> Result<String, String> {
    Err("このOSではFFmpegの自動インストールに対応していません。".to_string())
}

#[tauri::command]
pub async fn ensure_ffmpeg_installed(app: tauri::AppHandle) -> Result<FfmpegInstallResult, String> {
    if check_ffmpeg().await? {
        return Ok(FfmpegInstallResult {
            available: true,
            installed: false,
            message: "FFmpegは利用可能です。".to_string(),
            package_manager: None,
        });
    }

    emit_install_progress(&app, "status", "FFmpeg / ffprobe が見つかりませんでした。");
    let package_manager = install_ffmpeg_with_package_manager(&app).await?;

    if !check_ffmpeg().await? {
        return Err(format!(
            "{}でFFmpegをインストールしましたが、ffmpegまたはffprobeを検出できませんでした。アプリを再起動してください。",
            package_manager
        ));
    }

    Ok(FfmpegInstallResult {
        available: true,
        installed: true,
        message: format!("{}でFFmpegをインストールしました。", package_manager),
        package_manager: Some(package_manager),
    })
}
