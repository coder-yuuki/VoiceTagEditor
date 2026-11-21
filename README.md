<p align="center">
  <strong>日本語</strong> &nbsp;|&nbsp;
  <a href="./docs/README.en.md">English</a> &nbsp;|&nbsp;
  <a href="./docs/README.ko.md">한국어</a> &nbsp;|&nbsp;
  <a href="./docs/README.zh-TW.md">繁體中文（台灣）</a>
</p>

<p align="center">
  <img src="./src-tauri/icons/128x128@2x.png" alt="VoiceTagEditor icon" width="96" height="96" />
</p>

<h1 align="center">VoiceTagEditor</h1>

<p align="center">
  音声作品・ボイスドラマのタグ、カバー画像、トラック番号をかんたんに整えて保存できるデスクトップアプリ。<br />
  <sub>WAV / MP3 / FLAC / M4A 対応・完全ローカル動作・日本語 / English / 한국어 / 繁體中文（台灣）対応</sub>
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
    <img src="./docs/assets/download-macos.svg" alt="Download for macOS (.dmg)" width="268" />
  </a>
  &nbsp;&nbsp;
  <a href="https://github.com/coder-yuuki/VoiceTagEditor/releases/latest">
    <img src="./docs/assets/download-windows.svg" alt="Download for Windows (.exe / .msi)" width="268" />
  </a>
</p>

<br />

## ダウンロード・インストール方法（はじめての方へ）

GitHub に慣れていない方は、次の 3 ステップだけでインストールできます。

1. 上の **macOS** または **Windows** のボタンをクリックして、最新リリースページを開きます。
2. ページの下にある **Assets** から、お使いのパソコンに合うファイルを 1 つだけクリックしてダウンロードします。

| OS | 選ぶファイル | インストール方法 |
| --- | --- | --- |
| **macOS**（Apple Silicon） | 末尾が **`.dmg`** のファイル | ダウンロードした `.dmg` を開き、アプリを **Applications** フォルダへドラッグします |
| **Windows**（64-bit） | 末尾が **`-setup.exe`** または **`.msi`** のファイル | ダウンロードしたファイルをダブルクリックして画面の案内に従います |

> **ポイント**：`Assets` にある `Source code (zip)`、`.sig`、`.tar.gz`、`latest.json` などはダウンロード不要です。

<details>
<summary><strong>初回起動時に警告が出た場合（macOS / Windows）</strong></summary>

- **macOS（開発元を確認できない等のメッセージが出た場合）**
  1. Finder の「アプリケーション」フォルダで `VoiceTagEditor` を **右クリック →「開く」** を選びます。
  2. ダイアログでもう一度 **「開く」** をクリックします。
  - うまく開けない場合は、ターミナルで以下を実行してください：
    ```bash
    xattr -dr com.apple.quarantine /Applications/VoiceTagEditor.app
    ```
- **Windows（Windows によって PC が保護されました と出た場合）**
  - **「詳細情報」→「実行」** をクリックして進めてください。

</details>

<details>
<summary><strong>初回起動時の音声エンジン（FFmpeg）の自動準備について</strong></summary>

- VoiceTagEditor は音声の解析・保存に FFmpeg を使用します（アプリ本体には同梱していません）。
- 初回起動時に FFmpeg が見つからない場合は、**アプリが自動でダウンロードして準備します**（初回のみ。macOS 約 55MB / Windows 約 115MB）。Homebrew や winget などの事前準備は不要です。
  - 保存先はアプリ専用のデータフォルダで、システムの設定（PATH など）は変更しません。
    - macOS：`~/Library/Application Support/com.noguchiyuuki.voicetageditor/ffmpeg/`
    - Windows：`%LOCALAPPDATA%\com.noguchiyuuki.voicetageditor\ffmpeg\`
  - ダウンロードするのはバージョン固定のビルド（FFmpeg 9.1）で、SHA256 で改ざんがないことを確認してから使います。
    - macOS：[ffmpeg.martin-riedl.de](https://ffmpeg.martin-riedl.de/)（Apple Silicon / Intel）
    - Windows：[gyan.dev](https://www.gyan.dev/ffmpeg/builds/)（essentials build）
  - すでに FFmpeg がインストールされている場合は、そちらをそのまま使います。
  - 自動ダウンロード版は macOS 12 以降が必要です。それより古い macOS では Homebrew などで FFmpeg を入れてください。
  - ダウンロードに失敗した場合は、Homebrew / winget / Chocolatey / Scoop が使える環境ならそれを使ってインストールを試みます。
- FFmpeg は [FFmpeg プロジェクト](https://ffmpeg.org/) のソフトウェアで、LGPL / GPL ライセンスで配布されています。

</details>

---

## かんたん 4 ステップで使える

初めてでも迷わない **「かんたんモード」** と、1 画面で素早く編集できる **「詳細モード」** をいつでも切り替えられます。

1. **音声を選ぶ** — ファイルや作品フォルダをドラッグ＆ドロップ。フォルダ内のカバー画像も自動で読み込みます。
2. **作品情報を入力** — 作品名・サークル名・発売日・タグ・カバー画像を設定。
3. **トラックを確認** — プレビュー再生（シークバー付き）で中身を確認しながら、タイトル・番号・声優を整理。
4. **保存する** — 保存先フォルダを選ぶだけ。元のファイルを残したまま、`サークル名 / 作品名` フォルダに安全に書き出します。

---

## 主な機能

- **2 つの編集モード**：ガイド付きの「かんたんモード」と、全項目を一覧できる「詳細モード」
- **多言語 UI**：日本語 / English / 한국어 / 繁體中文（台灣）に対応（ヘッダーから即時切替）
- **ミニプレイヤーで試聴**：一覧からワンクリック再生、シークバー・±10 秒スキップ・前後トラック移動に対応
- **トラック整理ツール**：
  - ドラッグ＆ドロップや `↑↓` ボタンで並び替え
  - 1 クリックでディスクごとに `01` から連番を振り直し
  - **タイトル一括整形**（先頭の番号・記号除去、空白整理、検索して一括置換・削除）
  - 各トラックの再生時間＆作品合計時間を表示
- **声優の一括入力 & コピー**：全トラック一括適用、先頭トラックからコピー、上のトラックからコピー
- **安心設計**：Undo / Redo（`⌘Z` / `Ctrl+Z`）、前回の出力先フォルダ記憶、保存後の自動デコード検証、**完全ローカル処理（外部送信なし）**

---

## プライバシーとライセンス

- **プライバシー**：音声ファイルやタグ情報はすべてお使いのパソコン内だけで処理されます。詳細は [PRIVACY.md](./PRIVACY.md) をご覧ください。
- **ライセンス**：MIT License（[LICENSE](./LICENSE) / サードパーティ表記：[THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md)）

---

<details>
<summary><strong>開発者向け情報（ビルド・技術スタック・リリース）</strong></summary>

### 技術スタック
- **Frontend**: Preact + TypeScript + Vite + Tailwind CSS
- **Backend**: Rust (Tauri v2)
- **Package Manager**: pnpm (`10.14.0`)

### ローカル開発
```bash
pnpm install
pnpm tauri dev
```

### ビルド・検証
```bash
pnpm build       # TypeScript 型チェック + フロントエンドビルド
pnpm tauri build # 本番アプリビルド
```

### リリース
`v*` 形式のタグを push すると `.github/workflows/tauri-release.yml` が macOS / Windows 向けビルドと GitHub Release を自動作成します。

</details>
