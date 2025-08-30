use std::path::{Path, PathBuf};

#[cfg(windows)]
fn is_extended_prefix(p: &str) -> bool {
    p.starts_with(r"\\?\") || p.starts_with(r"\\.\")
}

#[cfg(windows)]
fn to_extended_internal(abs: &str) -> String {
    if is_extended_prefix(abs) {
        abs.to_string()
    } else if abs.starts_with(r"\\") {
        // UNC path: \\server\share -> \\?\UNC\server\share
        let rest = &abs[2..];
        format!(r"\\?\UNC\{}", rest)
    } else {
        format!(r"\\?\{}", abs)
    }
}

#[cfg(windows)]
fn maybe_absolute(path: &Path) -> PathBuf {
    if path.is_absolute() {
        path.to_path_buf()
    } else {
        if let Ok(cwd) = std::env::current_dir() {
            cwd.join(path)
        } else {
            PathBuf::from(path)
        }
    }
}

#[cfg(windows)]
fn needs_extended_prefix(p: &Path) -> bool {
    let s = p.to_string_lossy();
    s.len() >= 240 && !is_extended_prefix(&s)
}

#[cfg(not(windows))]
fn needs_extended_prefix(_p: &Path) -> bool { false }

#[cfg(windows)]
pub fn to_extended_length_path_if_needed<P: AsRef<Path>>(path: P) -> PathBuf {
    let p = path.as_ref();
    if needs_extended_prefix(p) {
        let abs = maybe_absolute(p);
        let s = abs.to_string_lossy();
        PathBuf::from(to_extended_internal(&s))
    } else {
        p.to_path_buf()
    }
}

#[cfg(not(windows))]
pub fn to_extended_length_path_if_needed<P: AsRef<Path>>(path: P) -> PathBuf {
    path.as_ref().to_path_buf()
}

pub fn path_exists<P: AsRef<Path>>(path: P) -> bool {
    let p = path.as_ref();
    let ep = to_extended_length_path_if_needed(p);
    Path::new(&ep).exists()
}

pub fn create_dir_all_extended<P: AsRef<Path>>(path: P) -> std::io::Result<()> {
    let ep = to_extended_length_path_if_needed(path.as_ref());
    std::fs::create_dir_all(&ep)
}

pub fn prepare_cmd_arg(path_str: &str) -> String {
    let p = Path::new(path_str);
    let ep = to_extended_length_path_if_needed(p);
    ep.to_string_lossy().to_string()
}

