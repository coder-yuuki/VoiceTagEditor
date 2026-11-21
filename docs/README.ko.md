<p align="center">
  <a href="../README.md">日本語</a> &nbsp;|&nbsp;
  <a href="./README.en.md">English</a> &nbsp;|&nbsp;
  <strong>한국어</strong> &nbsp;|&nbsp;
  <a href="./README.zh-TW.md">繁體中文（台灣）</a>
</p>

<p align="center">
  <img src="../src-tauri/icons/128x128@2x.png" alt="VoiceTagEditor icon" width="96" height="96" />
</p>

<h1 align="center">VoiceTagEditor</h1>

<p align="center">
  음성 작품·보이스 드라마의 태그, 커버 이미지, 트랙 번호를 손쉽게 정리하고 저장하는 데스크톱 앱.<br />
  <sub>WAV / MP3 / FLAC / M4A 지원 · 완전 로컬 실행 · 日本語 / English / 한국어 / 繁體中文（台灣） 지원</sub>
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

## 다운로드 및 설치 방법 (처음 오신 분께)

GitHub가 익숙하지 않으셔도 아래 3단계만으로 쉽게 설치할 수 있습니다.

1. 위의 **macOS** 또는 **Windows** 버튼을 클릭하여 최신 릴리스 페이지를 엽니다.
2. 페이지 아래쪽 **Assets** 목록에서 사용 중인 OS에 맞는 파일 1개만 클릭해 다운로드합니다.

| OS | 다운로드할 파일 | 설치 방법 |
| --- | --- | --- |
| **macOS** (Apple Silicon) | **`.dmg`** 로 끝나는 파일 | `.dmg` 파일을 열어 `VoiceTagEditor`를 **Applications** 폴더로 드래그합니다 |
| **Windows** (64-bit) | **`-setup.exe`** 또는 **`.msi`** 로 끝나는 파일 | 다운로드한 파일을 더블클릭하여 안내에 따라 설치합니다 |

> **참고**: `Source code (zip)`, `.sig`, `.tar.gz`, `latest.json` 파일은 다운로드하지 않으셔도 됩니다.

<details>
<summary><strong>첫 실행 시 보안 경고가 표시되는 경우 (macOS / Windows)</strong></summary>

- **macOS (확인되지 않은 개발자 경고)**
  1. Finder의 응용 프로그램 폴더에서 `VoiceTagEditor`를 **우클릭 → 열기** 합니다.
  2. 대화상자에서 다시 **열기**를 클릭합니다.
  - 열리지 않을 경우 터미널에서 아래 명령어를 실행해 주세요:
    ```bash
    xattr -dr com.apple.quarantine /Applications/VoiceTagEditor.app
    ```
- **Windows (SmartScreen 경고)**
  - **추가 정보 → 실행**을 클릭합니다.

</details>

<details>
<summary><strong>첫 실행 시 오디오 엔진(FFmpeg) 자동 설치 안내</strong></summary>

- 오디오 분석 및 변환을 위해 FFmpeg를 사용합니다(앱 내부에는 포함되어 있지 않습니다).
- 첫 실행 시 FFmpeg가 없으면 자동으로 설치를 시도합니다.
  - **macOS**: [Homebrew](https://brew.sh/)가 필요합니다.
  - **Windows**: `winget`, `Chocolatey`, `Scoop` 중 하나를 사용합니다.

</details>

---

## 간편한 4단계 사용법

처음 사용해도 헷갈리지 않는 **간편 모드**와 한 화면에서 빠르게 편집하는 **상세 모드**를 언제든 전환할 수 있습니다.

1. **음성 선택** — 오디오 파일이나 작품 폴더를 드래그 앤 드롭합니다. 폴더 안의 커버 이미지도 자동으로 불러옵니다.
2. **작품 정보 입력** — 작품명, 서클명/제작자, 발매일, 태그, 커버 이미지를 설정합니다.
3. **트랙 확인** — 내장 미니 플레이어로 미리듣기하며 트랙명, 번호, 성우 정보를 정리합니다.
4. **저장** — 저장 폴더만 선택하면 원본 파일을 유지한 채 `제작자 / 작품명` 폴더에 안전하게 저장합니다.

---

## 주요 기능

- **간편 / 상세 모드 전환**: 단계별 가이드 모드와 전체 편집 화면 모드 지원
- **다국어 인터페이스**: 日本語 / English / 한국어 / 繁體中文（台灣） 즉시 전환
- **내장 미니 플레이어**: 목록에서 바로 재생, 탐색 바·10초 앞/뒤 이동·이전/다음 트랙 전환 지원
- **편리한 트랙 정리**:
  - 드래그 앤 드롭 및 `↑↓` 버튼으로 순서 변경
  - 클릭 한 번으로 디스크별 `01`부터 번호 다시 매기기
  - **제목 일괄 정리** (앞쪽 번호·기호 제거, 공백 정리, 실시간 미리보기 일괄 바꾸기/삭제)
  - 각 트랙 재생 시간 및 작품 총 재생 시간 표시
- **성우 일괄 입력 및 복사**: 모든 트랙에 적용, 첫 트랙 복사, 바로 위 트랙 복사
- **안심 설계**: 실행 취소/다시 실행(`⌘Z` / `Ctrl+Z`), 이전 저장 폴더 기억, 저장 후 자동 디코딩 검증, **100% 로컬 처리(외부 전송 없음)**

---

## 개인정보 보호 및 라이선스

- **개인정보 보호**: 모든 오디오 파일과 태그 정보는 사용자의 컴퓨터 내부에서만 처리되며 외부로 전송되지 않습니다([PRIVACY.md](../PRIVACY.md)).
- **라이선스**: MIT License ([LICENSE](../LICENSE) · [THIRD-PARTY-NOTICES.md](../THIRD-PARTY-NOTICES.md))

---

<details>
<summary><strong>개발자 정보 (빌드 및 기술 스택)</strong></summary>

- **Frontend**: Preact + TypeScript + Vite + Tailwind CSS
- **Backend**: Rust (Tauri v2)
- **Package Manager**: pnpm (`10.14.0`)

```bash
pnpm install
pnpm tauri dev    # 개발 서버 실행
pnpm build        # 타입 체크 + 프론트엔드 빌드
pnpm tauri build  # 배포용 앱 빌드
```

</details>
