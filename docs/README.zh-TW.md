<p align="center">
  <a href="../README.md">日本語</a> &nbsp;|&nbsp;
  <a href="./README.en.md">English</a> &nbsp;|&nbsp;
  <a href="./README.ko.md">한국어</a> &nbsp;|&nbsp;
  <strong>繁體中文（台灣）</strong>
</p>

<p align="center">
  <img src="../src-tauri/icons/128x128@2x.png" alt="VoiceTagEditor icon" width="96" height="96" />
</p>

<h1 align="center">VoiceTagEditor</h1>

<p align="center">
  輕鬆整理並儲存音聲作品、廣播劇標籤、封面圖片與音軌編號的桌面應用程式。<br />
  <sub>支援 WAV / MP3 / FLAC / M4A · 完全本機執行 · 支援 日本語 / English / 한국어 / 繁體中文（台灣）</sub>
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

## 下載與安裝方式（第一次使用也能輕鬆上手）

就算不熟悉 GitHub，只要照著以下 3 個步驟即可完成安裝：

1. 點擊上方的 **macOS** 或 **Windows** 按鈕，開啟最新版本頁面。
2. 捲動到頁面下方的 **Assets**，點擊符合您電腦系統的檔案下載：

| 作業系統 | 要下載的檔案 | 安裝方式 |
| --- | --- | --- |
| **macOS**（Apple Silicon） | 檔名結尾為 **`.dmg`** 的檔案 | 開啟 `.dmg` 後，將 `VoiceTagEditor` 拖進 **Applications（應用程式）** 資料夾 |
| **Windows**（64-bit） | 檔名結尾為 **`-setup.exe`** 或 **`.msi`** 的檔案 | 連點兩下安裝檔，依畫面指示完成安裝 |

> **小提醒**：不需要下載 `Source code (zip)`、`.sig`、`.tar.gz` 或 `latest.json`。

<details>
<summary><strong>首次啟動時若出現系統安全性警告（macOS / Windows）</strong></summary>

- **macOS（無法驗證開發者等提示）**
  1. 在 Finder 的「應用程式」資料夾中，對 `VoiceTagEditor` 按 **右鍵 →「打開」**。
  2. 在跳出的視窗中再次點擊 **「打開」**。
  - 若仍無法開啟，請在終端機執行：
    ```bash
    xattr -dr com.apple.quarantine /Applications/VoiceTagEditor.app
    ```
- **Windows（Windows 已保護您的電腦）**
  - 點擊 **「其他資訊」→「仍要執行」**。

</details>

<details>
<summary><strong>首次啟動時的音訊引擎（FFmpeg）自動準備說明</strong></summary>

- 本應用程式使用 FFmpeg 進行音訊解析與轉換（未直接打包於安裝檔內）。
- 首次啟動若未偵測到 FFmpeg，系統會自動嘗試安裝：
  - **macOS**：需先安裝 [Homebrew](https://brew.sh/)。
  - **Windows**：使用 `winget`、`Chocolatey` 或 `Scoop`。

</details>

---

## 簡單 4 步驟完成整理

隨時可自由切換引導式的 **「簡易模式」** 與單一畫面快速作業的 **「進階模式」**。

1. **選擇音訊** — 直接拖放音訊檔案或作品資料夾，資料夾內的封面圖片也會自動偵測。
2. **填寫作品資訊** — 設定作品名稱、社團／創作者、發行日期、標籤與封面圖片。
3. **確認音軌** — 透過內建迷你播放器試聽並確認內容，快速整理名稱、編號與聲優。
4. **儲存** — 選擇輸出資料夾即可在不覆蓋原檔的情況下，自動整理進 `社團／創作者 / 作品名稱` 資料夾中。

---

## 主要功能

- **簡易 / 進階雙模式**：適合新手的步驟引導，以及可自訂格式與音質的進階模式
- **多語言介面**：支援 日本語 / English / 한국어 / 繁體中文（台灣），可於標題列即時切換
- **內建迷你播放器**：點一下即可試聽，支援拖曳進度條、快轉／倒轉 10 秒與上下軌切換
- **音軌整理工具**：
  - 拖曳與 `↑↓` 按鈕自由調整順序
  - 一鍵依每張光碟從 `01` 重新連續編號
  - **批次整理音軌名稱**（移除開頭編號與符號、整理多餘空白、即時預覽批次取代／移除）
  - 顯示單軌播放時間與作品總長度
- **聲優批次工具**：套用至全部音軌、複製首軌聲優、複製上一軌聲優
- **安心設計**：復原／重做（`⌘Z` / `Ctrl+Z`）、記住上次輸出資料夾、儲存後自動驗證完整性、**完全本機處理（不傳送至外部）**

---

## 隱私權與授權條款

- **隱私權**：所有音訊檔案與標籤資訊皆僅在您的電腦上處理，絕不會上傳至外部伺服器（詳見 [PRIVACY.md](../PRIVACY.md)）。
- **授權條款**：MIT License（[LICENSE](../LICENSE) · 第三方聲明：[THIRD-PARTY-NOTICES.md](../THIRD-PARTY-NOTICES.md)）

---

<details>
<summary><strong>開發者資訊（建置與技術架構）</strong></summary>

- **Frontend**: Preact + TypeScript + Vite + Tailwind CSS
- **Backend**: Rust (Tauri v2)
- **Package Manager**: pnpm (`10.14.0`)

```bash
pnpm install
pnpm tauri dev    # 啟動開發模式
pnpm build        # 型別檢查與前端建置
pnpm tauri build  # 建置正式版應用程式
```

</details>
