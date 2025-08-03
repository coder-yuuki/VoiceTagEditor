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
- **対応OS**: Windows、macOS、Linux

## 開発環境セットアップ

### 必要な環境
- Node.js と pnpm
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

## プロジェクト構造

- `/src/` - フロントエンドコード（Preact + TypeScript）
  - `main.tsx` - アプリケーションエントリーポイント
  - `App.tsx` - メインアプリケーションコンポーネント
- `/src-tauri/` - バックエンドコード（Rust/Tauri）
  - `src/lib.rs` - Tauri アプリケーションロジックとコマンド
  - `src/main.rs` - デスクトップアプリケーションエントリーポイント

## 推奨IDE設定

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
