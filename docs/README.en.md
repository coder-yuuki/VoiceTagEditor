<p align="center">
  <a href="../README.md">日本語</a> &nbsp;|&nbsp;
  <strong>English</strong> &nbsp;|&nbsp;
  <a href="./README.ko.md">한국어</a> &nbsp;|&nbsp;
  <a href="./README.zh-TW.md">繁體中文（台灣）</a>
</p>

<p align="center">
  <img src="../src-tauri/icons/128x128@2x.png" alt="VoiceTagEditor icon" width="96" height="96" />
</p>

<h1 align="center">VoiceTagEditor</h1>

<p align="center">
  A clean desktop app for organizing and tagging voice works, audio dramas, and albums.<br />
  <sub>WAV / MP3 / FLAC / M4A · 100% Local Processing · Japanese / English / Korean / Traditional Chinese (Taiwan)</sub>
</p>

<p align="center">
  <a href="https://github.com/coder-yuuki/VoiceTagEditor/releases/latest">
    <img alt="Latest Release" src="https://img.shields.io/github/v/release/coder-yuuki/VoiceTagEditor?label=Latest%20Version&style=flat-square&color=2563eb" />
  </a>
  <img alt="Platform" src="https://img.shields.io/badge/macOS%20%7C%20Windows-Desktop-52525b?style=flat-square" />
  <img alt="License" src="https://img.shields.io/badge/License-MIT-16a34a?style=flat-square" />
</p>

<br />

<p align="center">
  <a href="https://github.com/coder-yuuki/VoiceTagEditor/releases/latest">
    <img src="./assets/download-macos.svg" alt="Download for macOS (.dmg)" width="268" />
  </a>
  &nbsp;&nbsp;
  <a href="https://github.com/coder-yuuki/VoiceTagEditor/releases/latest">
    <img src="./assets/download-windows.svg" alt="Download for Windows (.exe / .msi)" width="268" />
  </a>
</p>

<br />

## How to Download & Install

New to GitHub? Just follow these 3 steps:

1. Click the **macOS** or **Windows** button above to open the latest release page.
2. Scroll down to **Assets** and click the installer for your OS:

| OS | File to download | How to install |
| --- | --- | --- |
| **macOS** (Apple Silicon) | File ending in **`.dmg`** | Open the `.dmg` file and drag `VoiceTagEditor` into **Applications** |
| **Windows** (64-bit) | File ending in **`-setup.exe`** or **`.msi`** | Double-click the downloaded installer and follow the prompts |

> **Tip**: You do **not** need `Source code (zip)`, `.sig`, `.tar.gz`, or `latest.json`.

<details>
<summary><strong>If your OS shows a security warning on first launch</strong></summary>

- **macOS (Gatekeeper)**
  1. Open **Applications** in Finder, **right-click `VoiceTagEditor` → Open**.
  2. Click **Open** again in the confirmation dialog.
  - Or remove the quarantine flag in Terminal:
    ```bash
    xattr -dr com.apple.quarantine /Applications/VoiceTagEditor.app
    ```
- **Windows (SmartScreen)**
  - Click **More info → Run anyway**.

</details>

<details>
<summary><strong>Automatic FFmpeg setup on first launch</strong></summary>

- VoiceTagEditor uses FFmpeg to inspect and convert audio (FFmpeg is not bundled).
- If FFmpeg is not found on first launch, the app automatically attempts to install it:
  - **macOS**: Requires [Homebrew](https://brew.sh/).
  - **Windows**: Uses `winget`, `Chocolatey`, or `Scoop`.

</details>

---

## Simple 4-Step Workflow

Switch freely between **Simple Mode** (guided 4-step wizard) and **Advanced Mode** (single-screen editor with format/bitrate controls).

1. **Select Audio** — Drag & drop audio files or a work folder. Cover images inside the folder are detected automatically.
2. **Work Info** — Edit work title, circle/creator, release date, tags, and cover artwork.
3. **Review Tracks** — Preview audio with the built-in mini player and organize titles, track numbers, and voice actors.
4. **Save** — Pick an output folder and save safely into `Creator / Work Title` subfolders while keeping your original files untouched.

---

## Key Features

- **Simple & Advanced Modes**: Guided wizard for quick edits or full-featured single-view workspace
- **Multilingual UI**: Japanese, English, Korean, and Traditional Chinese (Taiwan) with instant switching
- **Built-in Mini Player**: Preview tracks inline with seek bar, ±10s skip, previous/next track, and volume control
- **Smart Track Editing**:
  - Drag & drop row reordering and quick `↑↓` controls
  - One-click sequential renumbering (`01, 02, ...` per disc)
  - **Batch Title Formatter** (strip leading track numbers, clean spaces, find & replace with live preview)
  - Per-track duration and total work duration display
- **Voice Actor Tools**: Bulk apply to all tracks, copy from Track 1, or copy from the previous track
- **Safe & Local**: Undo / Redo (`⌘Z` / `Ctrl+Z`), remembered output folder, automatic post-save decode verification, and **100% offline local processing**

---

## Privacy & License

- **Privacy**: All audio files and metadata stay strictly on your computer and are never uploaded. See [PRIVACY.md](../PRIVACY.md).
- **License**: MIT License ([LICENSE](../LICENSE) · [THIRD-PARTY-NOTICES.md](../THIRD-PARTY-NOTICES.md))

---

<details>
<summary><strong>For Developers (Build & Stack)</strong></summary>

- **Frontend**: Preact + TypeScript + Vite + Tailwind CSS
- **Backend**: Rust (Tauri v2)
- **Package Manager**: pnpm (`10.14.0`)

```bash
pnpm install
pnpm tauri dev    # Start dev app
pnpm build        # Typecheck + build frontend
pnpm tauri build  # Build production bundle
```

</details>
