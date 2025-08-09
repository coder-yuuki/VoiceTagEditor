# THIRD-PARTY NOTICES

このプロジェクトでは以下のサードパーティソフトウェアを利用しています。各ライセンスの正確な条文は公式配布物に従います。

- Tauri (tauri, tauri-build, @tauri-apps/cli, @tauri-apps/api, tauri plugins)
  - License: MIT
  - Site: https://tauri.app/

- Preact
  - License: MIT
  - Site: https://preactjs.com/

- Vite
  - License: MIT
  - Site: https://vitejs.dev/

- TypeScript
  - License: Apache-2.0
  - Site: https://www.typescriptlang.org/

- Tailwind CSS
  - License: MIT
  - Site: https://tailwindcss.com/

- Tokio
  - License: MIT OR Apache-2.0
  - Site: https://tokio.rs/

- Serde / Serde JSON
  - License: MIT OR Apache-2.0
  - Site: https://serde.rs/

- base64 (Rust)
  - License: MIT OR Apache-2.0

- which (Rust)
  - License: MIT

- その他、各に記載の依存はそれぞれのライセンスに従います。

注意事項:
- 本アプリはOSにインストール済みのFFmpegを外部プロセスとして利用します（同梱しません）。
- FFmpegの配布ライセンスは取得元のビルドオプションに依存します（Homebrew配布は多くがGPL構成）。本アプリはFFmpegを同梱していないため、FFmpegのライセンスは本アプリには波及しません。FFmpegを同梱する場合はLGPLビルドを推奨し、LGPL/GPLに従った配布が必要です。
