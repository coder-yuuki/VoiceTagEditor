# VoiceTagEditor

音声ファイルのメタデータ・タグ編集を簡単に行えるデスクトップアプリケーションです。

## 主な機能

### メタデータ編集
- **アルバム情報の編集**: タイトル、アーティスト、リリース日の設定
- **トラック情報の管理**: 各楽曲のディスク番号、トラック番号、タイトル、アーティストの編集
- **タグ管理**: アルバムやアーティストにタグを追加・削除
- **アルバムアートワーク**: 画像ファイルをドラッグ&ドロップで簡単設定

### 音声ファイル対応
- **メタデータ抽出**: 音声ファイルから既存のメタデータを自動読み込み
- **FFmpeg連携**: 高精度な音声ファイル処理
- **進捗表示**: 処理状況をリアルタイムで確認

### 使いやすさ
- **ドラッグ&ドロップ対応**: 直感的なファイル操作
- **タグベースUI**: チップ形式で視覚的にタグを管理
- **自動ソート**: ディスク・トラック番号順に自動整列
- **日本語インターフェース**: 完全日本語対応

## 対象ユーザー

- 音楽ライブラリを整理したい方
- 音声ファイルのメタデータを効率的に編集したい方
- アルバム単位での楽曲管理を行いたい方
- 音声コンテンツ制作者

## 技術仕様

- **フロントエンド**: Preact + TypeScript + Vite
- **バックエンド**: Rust (Tauri v2)
- **パッケージマネージャー**: pnpm
- **対応OS**: Windows、macOS（Linuxは現状ソースからビルドして利用）

## 必要要件 / 注意事項

- 本アプリは音声の変換・埋め込み処理で FFmpeg を使用します。FFmpeg は同梱していないため、各OSにインストールしてください。
  - macOS (Homebrew): `brew install ffmpeg`
  - Windows: winget / Chocolatey などでインストール
  - Linux: ディストリビューションのパッケージからインストール
- OPUS のカバーアートは METADATA_BLOCK_PICTURE で埋め込みます。再生ソフトによっては表示されない場合があります。

## 開発環境セットアップ

### 必要な環境
- Node.js (>= 18) と pnpm
- Rust toolchain
- Tauri CLI
- FFmpeg（音声処理用）

### 開発開始手順

```bash
# 依存関係のインストール
pnpm install

# 開発サーバー起動（フロントエンド + Tauri）
pnpm tauri dev

# フロントエンドのみ起動
pnpm dev
```

### ビルド

```bash
# 本番用ビルド
pnpm tauri build

# フロントエンドのみビルド
pnpm build

# 型チェック
pnpm tsc
```

## リリース

- GitHub Actions の `Tauri Release` ワークフローは、`v*` 形式のタグを push すると実行されます。
- 署名/公証を行う場合は、必要な秘密情報（証明書、Apple Developer 関連）を GitHub Secrets に登録します。
  - macOS（任意だが推奨）
    - `APPLE_CERTIFICATE`: Developer ID Application の `.p12` をBase64化した文字列
    - `APPLE_CERTIFICATE_PASSWORD`: 証明書パスワード
    - `APPLE_TEAM_ID`: チームID
    - 公証はいずれかを使用
      - Apple ID: `APPLE_ID`, `APPLE_PASSWORD`（App-specific password）
      - App Store Connect API Key: `APPLE_API_KEY`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`
  - Windows（任意）
    - `WINDOWS_CERTIFICATE`: コードサイン用 `.pfx` をBase64化
    - `WINDOWS_CERTIFICATE_PASSWORD`: PFXパスワード

## ライセンス

このプロジェクトは MIT ライセンスで提供されます。詳細は `LICENSE` を参照してください。

サードパーティのライセンスは `THIRD-PARTY-NOTICES.md` を参照してください。

プライバシーポリシーは `PRIVACY.md` を参照してください。

## ダウンロード

- 最新版は GitHub Releases から入手できます: https://github.com/iLickeyPro/VoiceTagEditor/releases/latest
- GitHub Actions の自動リリース対象OS: macOS / Windows（Linuxは現状未配布）
- macOSでの初回起動確認（公証・署名の検証）:
  - 署名・公証なしビルドの場合、初回はGatekeeperでブロックされることがあります。
  - 開く手順（2通り）
    - Finderで右クリック → 開く → ダイアログで「開く」
    - もしくは隔離属性を外す: `xattr -dr com.apple.quarantine /Applications/voicetageditor.app`

## プロジェクト構造

- `/src/` - フロントエンドコード（Preact + TypeScript）
  - `main.tsx` - アプリケーションエントリーポイント
  - `App.tsx` - メインアプリケーションコンポーネント
- `/src-tauri/` - バックエンドコード（Rust/Tauri）
  - `src/lib.rs` - Tauri アプリケーションロジックとコマンド
  - `src/main.rs` - デスクトップアプリケーションエントリーポイント

## 推奨IDE設定

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
