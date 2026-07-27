import { useState, useEffect, useCallback, useRef } from "preact/hooks";
import { confirm, message, open } from "@tauri-apps/plugin-dialog";
import { getName, getVersion } from "@tauri-apps/api/app";
import { listen } from '@tauri-apps/api/event'
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { check } from "@tauri-apps/plugin-updater";
import { AboutDialog, type AboutTab } from './components/AboutDialog';
import { AppDialog, type AppDialogOptions } from './components/AppDialog';
import { AppToolbar } from './components/AppToolbar';
import { ExportDialog } from './components/ExportDialog';
import { FfmpegBanner } from './components/FfmpegBanner';
import { OnboardingModal } from './components/OnboardingModal';
import { ProcessingOverlay } from './components/ProcessingOverlay';
import { Sidebar } from './components/Sidebar';
import { SimpleWizard } from './components/SimpleWizard';
import { TrackTable } from './components/TrackTable';
import type {
  AlbumData,
  AppMode,
  AudioFileResult,
  ConvertProgress,
  ConvertResult,
  ExportSettings,
  FfmpegInstallProgress,
  FfmpegInstallResult,
  FfmpegSetupState,
  OnboardingStep,
  ProgressEvent,
  QualityOption,
  Track,
  WizardStep,
} from './types';
import "./App.css";

const MODE_STORAGE_KEY = 'vte_display_mode_v1';

const compareTracksByNumber = (a: Track, b: Track): number => {
  const diskDifference = (Number.parseInt(a.diskNumber, 10) || 0)
    - (Number.parseInt(b.diskNumber, 10) || 0);
  if (diskDifference !== 0) {
    return diskDifference;
  }

  return (Number.parseInt(a.trackNumber, 10) || 0)
    - (Number.parseInt(b.trackNumber, 10) || 0);
};

function App() {
  const [mode, setMode] = useState<AppMode>(() => {
    try {
      return localStorage.getItem(MODE_STORAGE_KEY) === 'advanced' ? 'advanced' : 'simple';
    } catch {
      return 'simple';
    }
  });
  const [wizardStep, setWizardStep] = useState<WizardStep>(1);
  const [savedCount, setSavedCount] = useState(0);
  const [albumData, setAlbumData] = useState<AlbumData>({
    albumArtwork: null,
    albumTitle: "",
    albumArtist: "",
    releaseDate: "",
    tags: [],
    currentTagInput: "",
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState<ProgressEvent | null>(null);
  const [convertProgress, setConvertProgress] = useState<ConvertProgress | null>(null);

  // 完了数を追跡（並列処理でイベントが前後するため）
  const [completedCount, setCompletedCount] = useState(0);

  const [tracks, setTracks] = useState<Track[]>([]);

  // 出力設定の状態管理
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportSettings, setExportSettings] = useState<ExportSettings>({
    outputPath: '',
    overwriteMode: 'rename',
    format: 'MP3',
    quality: 'high'
  });

  // オンボーディング
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);
  const [onboardingStep, setOnboardingStep] = useState<number>(0);
  const onboardingSteps: OnboardingStep[] = [
    {
      title: '音声を選ぶ',
      desc: '「ファイルを選ぶ」または「フォルダを選ぶ」から音声を追加します。画面へドラッグ＆ドロップしても追加できます。'
    },
    {
      title: '音声作品の情報を入力する',
      desc: 'カバー画像・音声作品名・サークル名など、作品全体の情報を入力します。分かるところだけで大丈夫です。'
    },
    {
      title: 'トラックを確認する',
      desc: '各トラックのタイトルや番号を確認し、必要なところだけ書き換えます。'
    },
    {
      title: '保存する',
      desc: '保存先フォルダを選んで「保存を開始」を押します。おすすめ設定が自動で使われます。'
    }
  ];

  // About / Legal
  const [showAbout, setShowAbout] = useState<boolean>(false);
  const [aboutTab, setAboutTab] = useState<AboutTab>('overview');
  const [appName, setAppName] = useState<string>('VoiceTagEditor');
  const [appVersion, setAppVersion] = useState<string>('');
  const [appDialog, setAppDialog] = useState<AppDialogOptions | null>(null);
  const appDialogResolver = useRef<((confirmed: boolean) => void) | null>(null);

  // Updater
  const [isUpdateChecking, setIsUpdateChecking] = useState<boolean>(false);
  const isUpdateCheckingRef = useRef(false);
  const [ffmpegSetup, setFfmpegSetup] = useState<FfmpegSetupState>({
    status: 'idle',
    message: ''
  });
  const [ffmpegInstallLog, setFfmpegInstallLog] = useState<FfmpegInstallProgress[]>([]);
  const ffmpegSetupPromise = useRef<Promise<FfmpegInstallResult> | null>(null);
  const ffmpegReadyRef = useRef(false);
  const isFfmpegReady = ffmpegSetup.status === 'ready';

  const showAppDialog = useCallback((options: AppDialogOptions): Promise<boolean> => {
    if (appDialogResolver.current) {
      appDialogResolver.current(false);
    }
    setAppDialog(options);
    return new Promise<boolean>((resolve) => {
      appDialogResolver.current = resolve;
    });
  }, []);

  const handleAppDialogResult = (confirmed: boolean) => {
    const resolver = appDialogResolver.current;
    appDialogResolver.current = null;
    setAppDialog(null);
    resolver?.(confirmed);
  };

  useEffect(() => {
    (async () => {
      try { setAppName(await getName()); } catch { }
      try { setAppVersion(await getVersion()); } catch { }
    })();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(MODE_STORAGE_KEY, mode);
    } catch {
      // localStorageが使えない場合も、現在の起動中は選択したモードを維持する
    }
  }, [mode]);

  const handleModeChange = (newMode: AppMode) => {
    if (newMode === 'simple' && mode === 'advanced') {
      setWizardStep(tracks.length > 0 ? 3 : 1);
    }
    setMode(newMode);
  };

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setupListener = async () => {
      try {
        unlisten = await listen<FfmpegInstallProgress>('ffmpeg-install-progress', (event) => {
          const message = event.payload.message.replace(/\s+/g, ' ').trim();
          if (!message) return;

          const progress = {
            stream: event.payload.stream,
            message
          };

          setFfmpegInstallLog(prev => [...prev.slice(-5), progress]);
        });
      } catch (error) {
        console.error('FFmpegインストール進捗リスナーの設定に失敗:', error);
      }
    };

    setupListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  const ensureFfmpegReady = useCallback(async (): Promise<boolean> => {
    const preparingMessage = '音声を扱うための準備中です…（初回のみ、数分かかることがあります）';
    const failedMessage = '音声変換機能の準備に失敗しました。インターネット接続を確認して、もう一度お試しください。';

    const markReady = (technicalDetail?: string) => {
      ffmpegReadyRef.current = true;
      setFfmpegSetup({
        status: 'ready',
        message: '音声を扱う準備ができました。',
        technicalDetail,
      });
    };

    const markFailed = (error: unknown) => {
      ffmpegReadyRef.current = false;
      ffmpegSetupPromise.current = null;
      setFfmpegSetup({
        status: 'failed',
        message: failedMessage,
        technicalDetail: String(error),
      });
    };

    if (ffmpegReadyRef.current) {
      return true;
    }

    setFfmpegSetup({
      status: 'checking',
      message: preparingMessage,
    });

    if (ffmpegSetupPromise.current) {
      try {
        const result = await ffmpegSetupPromise.current;
        if (!result.available) {
          markFailed(result.message);
          return false;
        }
        markReady(result.message);
        return result.available;
      } catch (error) {
        markFailed(error);
        return false;
      }
    }

    setFfmpegInstallLog([]);

    try {
      const alreadyAvailable = await invoke<boolean>('check_ffmpeg');
      if (alreadyAvailable) {
        setFfmpegInstallLog([]);
        markReady('FFmpeg / ffprobe を確認しました。');
        return true;
      }
    } catch (error) {
      markFailed(error);
      return false;
    }

    setFfmpegInstallLog([{ stream: 'status', message: 'FFmpegの自動インストールを開始します。' }]);

    if (!ffmpegSetupPromise.current) {
      ffmpegSetupPromise.current = invoke<FfmpegInstallResult>('ensure_ffmpeg_installed');
    }

    try {
      const result = await ffmpegSetupPromise.current;
      if (!result.available) {
        markFailed(result.message);
        return false;
      }
      markReady(result.message);
      return result.available;
    } catch (error) {
      markFailed(error);
      return false;
    }
  }, []);

  const checkForUpdates = useCallback(async (showNoUpdateDialog: boolean) => {
    if (isUpdateCheckingRef.current) return;
    isUpdateCheckingRef.current = true;
    setIsUpdateChecking(true);
    try {
      const update = await check();
      if (!update) {
        if (showNoUpdateDialog) {
          await confirm('現在のバージョンは最新です。', {
            title: 'アップデート',
            kind: 'info'
          });
        }
        return;
      }

      const releaseNote = (update.body && String(update.body).trim().length > 0)
        ? `\n\n変更内容:\n${String(update.body).trim()}`
        : '';

      const ok = await confirm(
        `新しいバージョンが利用可能です。\n\n現在: v${update.currentVersion}\n最新: v${update.version}${releaseNote}\n\nアップデートしますか？`,
        { title: 'アップデート', kind: 'info' }
      );
      if (!ok) return;

      await update.downloadAndInstall((event) => {
        // ダイアログ中に進捗を更新できないため、ログに出す（必要なら後でUI化）
        if ('data' in event) {
          console.log('[updater]', event.event, event.data);
        } else {
          console.log('[updater]', event.event);
        }
      });

      await message('アップデートを適用しました。アプリを再起動します。', {
        title: 'アップデート完了',
        kind: 'info'
      });
      try {
        await invoke<void>('restart_app');
      } catch (restartError) {
        console.warn('アップデート適用後の自動再起動に失敗:', restartError);
        await message(
          'アップデートは適用されていますが、自動で再起動できませんでした。アプリを一度終了し、もう一度起動してください。',
          { title: '再起動が必要です', kind: 'warning' }
        );
      }
    } catch (e) {
      // 更新確認に失敗してもアプリは継続（ネットワーク不可/設定未整備など）
      console.warn('アップデート確認に失敗:', e);
      if (showNoUpdateDialog) {
        await showAppDialog({
          title: '更新を確認できませんでした',
          message: '新しいバージョンがあるか確認できませんでした。アプリはそのまま使えます。',
          guidance: 'インターネット接続を確認して、時間を置いてからもう一度お試しください。',
          technicalDetail: String(e),
          tone: 'warning',
        });
      }
    } finally {
      isUpdateCheckingRef.current = false;
      setIsUpdateChecking(false);
    }
  }, [showAppDialog]);

  // 起動時にアップデート確認（更新があるときだけ案内）
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await checkForUpdates(false);
    })();
    return () => { cancelled = true; };
  }, [checkForUpdates]);

  useEffect(() => {
    void ensureFfmpegReady();
  }, [ensureFfmpegReady]);

  const closeOnboarding = () => {
    setShowOnboarding(false);
  };

  // フォーマットに応じた音質設定のオプションを取得
  const getQualityOptions = (format: ExportSettings['format']): QualityOption[] => {
    switch (format) {
      case 'MP3':
      case 'M4A':
      default:
        return [
          { value: 'highest', label: '最高' },
          { value: 'high', label: '高' },
          { value: 'medium', label: '中' },
          { value: 'low', label: '低' }
        ];
    }
  };

  // フォーマット変更時に音質設定をリセット
  const handleFormatChange = (newFormat: ExportSettings['format']) => {
    setExportSettings(prev => ({
      ...prev,
      format: newFormat,
      quality: 'high' // デフォルトに戻す
    }));
  };

  // ゼロ埋めした数値文字列を返す
  const padNumber = (value: string): string => {
    if (!value) return '';
    const numeric = value.replace(/[^0-9]/g, '');
    return numeric ? numeric.padStart(2, '0') : '';
  };

  // 配列をトリム＆重複排除（順序維持）
  const trimAndDedup = (items: string[]) => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const raw of items) {
      const item = raw.trim();
      if (!item || seen.has(item)) continue;
      seen.add(item);
      result.push(item);
    }
    return result;
  };

  // 数字変換関数（"02" → "2", "2/12" → "2", 非数字 → ""）
  const normalizeNumberString = (value: string): string => {
    const firstNumber = value.normalize('NFKC').match(/[0-9]+/)?.[0];
    if (!firstNumber) {
      return '';
    }

    const numberValue = parseInt(firstNumber, 10);
    if (isNaN(numberValue)) {
      return '';
    }

    return numberValue.toString();
  };

  // 数字のみ入力を受け付ける関数
  const handleNumberInput = (value: string): string => {
    // 数字以外の文字を除去
    return value.replace(/[^0-9]/g, '');
  };

  // ファイルタイプを判定する関数
  const getFileType = (filePath: string): 'image' | 'audio' | 'unsupported' => {
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp'];
    const audioExtensions = ['.wav', '.mp3', '.flac', '.m4a'];
    const fileExtension = filePath.toLowerCase().substring(filePath.lastIndexOf('.'));

    if (imageExtensions.includes(fileExtension)) {
      return 'image';
    } else if (audioExtensions.includes(fileExtension)) {
      return 'audio';
    } else {
      return 'unsupported';
    }
  };
  // ファイルパスからファイル名（拡張子なし）を取得
  const getFileNameWithoutExtension = (filePath: string): string => {
    const fileName = filePath.split('/').pop() || filePath;
    const lastDotIndex = fileName.lastIndexOf('.');
    return lastDotIndex > 0 ? fileName.substring(0, lastDotIndex) : fileName;
  };

  // 新しいトラックIDを生成
  const generateTrackId = (): string => {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  };

  // オーディオファイルを処理する関数
  const processAudioFiles = useCallback(async (filePaths: string[], preferExternalArtwork: boolean = false) => {
    try {
      setIsProcessing(true);

      // 最新のトラック状態を取得して重複チェック
      setTracks(currentTracks => {
        // 既存のファイルパスをチェックして重複を除外
        const existingPaths = new Set(currentTracks.map(track => track.filePath).filter(Boolean));

        console.log('既存のファイルパス:', existingPaths);
        console.log(`既存のトラック: ${currentTracks.map(track => track.title).join(', ')}`);
        console.log('ドロップされたファイルパス:', filePaths);

        const newFilePaths = filePaths.filter(path => !existingPaths.has(path));

        console.log('重複除外後のファイルパス:', newFilePaths);

        if (newFilePaths.length === 0) {
          console.log('すべてのファイルは既に読み込み済みです');
          confirm('選択されたファイルはすべて既に読み込み済みです。', {
            title: '重複ファイル',
            kind: 'info'
          });
          setIsProcessing(false);
          return currentTracks; // 状態変更なし
        }

        if (newFilePaths.length < filePaths.length) {
          const skippedCount = filePaths.length - newFilePaths.length;
          console.log(`${skippedCount}個のファイルは既に読み込み済みのためスキップします`);
        }

        // 非同期処理を開始（状態は後で更新）。外部画像を優先するかフラグを渡す
        processNewFiles(newFilePaths, preferExternalArtwork === true);

        return currentTracks; // 現時点では状態変更なし
      });
    } catch (error) {
      console.error('オーディオファイルの処理エラー:', error);
      setIsProcessing(false);
      await showAppDialog({
        title: '音声を追加できませんでした',
        message: '選んだ音声を一覧へ追加できませんでした。',
        guidance: '同じ音声をすでに読み込んでいないか確認し、もう一度お試しください。',
        technicalDetail: String(error),
        tone: 'error',
      });
    }
  }, [mode, showAppDialog]);

  // 実際のファイル処理を行う関数
  const processNewFiles = async (newFilePaths: string[], hasExternalImageCandidate: boolean) => {
    try {
      // 完了数をリセット
      setCompletedCount(0);

      // FFmpegの確認と自動セットアップ
      const ffmpegAvailable = await ensureFfmpegReady();
      if (!ffmpegAvailable) {
        return;
      }

      // 重複していないオーディオファイルのみを処理
      const results = await invoke<AudioFileResult[]>('process_audio_files', {
        filePaths: newFilePaths
      });

      // 結果を処理してトラックリストに追加
      const newTracks: Track[] = [];
      let hasAlbumArt = false;
      let albumArtData = '';
      let allTags: string[] = [];
      let hasAlbumInfo = false;
      const readErrors: Array<{ filePath: string; detail: string }> = [];

      for (const result of results) {
        if (result.error) {
          console.error(`ファイル ${result.file_path} の処理エラー: ${result.error}`);
          readErrors.push({ filePath: result.file_path, detail: result.error });
          continue;
        }

        if (result.metadata) {
          const metadata = result.metadata;

          // アルバムアートを取得（最初のファイルからのみ）。
          // ただし、フォルダ/ドロップに画像候補が含まれている場合は埋め込みを使わない。
          if (!hasExternalImageCandidate && !hasAlbumArt && metadata.album_art) {
            hasAlbumArt = true;
            albumArtData = `data:image/jpeg;base64,${metadata.album_art}`;

            // アルバムアートをキャッシュに保存
            try {
              const cachePath = await invoke<string>('save_album_art_to_cache', {
                base64Data: metadata.album_art,
                albumTitle: metadata.album || 'Unknown Album',
                albumArtist: metadata.album_artist || 'Unknown Artist'
              });

              setAlbumData(prev => ({
                ...prev,
                albumArtwork: albumArtData,
                albumArtworkCachePath: cachePath,
                albumTitle: metadata.album || prev.albumTitle,
                albumArtist: metadata.album_artist || prev.albumArtist,
                releaseDate: metadata.date || prev.releaseDate
              }));
              hasAlbumInfo = true;
            } catch (error) {
              console.error('アルバムアートキャッシュ保存エラー:', error);
              // キャッシュ保存に失敗してもアルバムアートは表示
              setAlbumData(prev => ({
                ...prev,
                albumArtwork: albumArtData,
                albumTitle: metadata.album || prev.albumTitle,
                albumArtist: metadata.album_artist || prev.albumArtist,
                releaseDate: metadata.date || prev.releaseDate
              }));
              hasAlbumInfo = true;
            }
          }

          // アルバムアートが無い場合でも、最初の1回はアルバム情報を反映
          if (!hasAlbumInfo && (metadata.album || metadata.album_artist || metadata.date)) {
            setAlbumData(prev => ({
              ...prev,
              albumTitle: metadata.album || prev.albumTitle,
              albumArtist: metadata.album_artist || prev.albumArtist,
              releaseDate: metadata.date || prev.releaseDate
            }));
            hasAlbumInfo = true;
          }

          // タグを収集（重複を避けて追加）
          if (metadata.tags && metadata.tags.length > 0) {
            for (const tag of metadata.tags) {
              if (!allTags.includes(tag)) {
                allTags.push(tag);
              }
            }
          }
          // ジャンルをタグとして取り込む（MP3/FLACは genre に入る場合が多い）
          if (metadata.genre && metadata.genre.trim().length > 0) {
            const genreParts = metadata.genre
              .split(/[;,／、\/]/)
              .map((t) => t.trim())
              .filter((t) => t.length > 0);
            for (const g of genreParts) {
              if (!allTags.includes(g)) {
                allTags.push(g);
              }
            }
          }

          // トラック情報を作成
          const newTrack: Track = {
            id: generateTrackId(),
            diskNumber: normalizeNumberString(metadata.disk_number || '1'),
            trackNumber: metadata.track_number ? normalizeNumberString(metadata.track_number) : '',
            title: metadata.title || getFileNameWithoutExtension(result.file_path),
            artists: metadata.artist ? trimAndDedup(metadata.artist.split(';')) : [],
            currentArtistInput: '',
            filePath: result.file_path
          };

          newTracks.push(newTrack);
        }
      }

      // トラックリストに追加
      if (newTracks.length > 0) {
        setTracks(prev => {
          const nextTrackByDisk = new Map<number, number>();
          for (const track of prev) {
            const diskNumber = Number.parseInt(track.diskNumber, 10) || 1;
            const trackNumber = Number.parseInt(track.trackNumber, 10) || 0;
            nextTrackByDisk.set(
              diskNumber,
              Math.max(nextTrackByDisk.get(diskNumber) ?? 1, trackNumber + 1),
            );
          }

          const numberedTracks = newTracks.map((track) => {
            const diskNumber = Number.parseInt(track.diskNumber, 10) || 1;
            if (track.trackNumber) {
              const trackNumber = Number.parseInt(track.trackNumber, 10) || 0;
              nextTrackByDisk.set(
                diskNumber,
                Math.max(nextTrackByDisk.get(diskNumber) ?? 1, trackNumber + 1),
              );
              return track;
            }
            const nextTrackNumber = nextTrackByDisk.get(diskNumber) ?? 1;
            const numberedTrack = {
              ...track,
              trackNumber: String(nextTrackNumber),
            };
            nextTrackByDisk.set(diskNumber, nextTrackNumber + 1);
            return numberedTrack;
          });

          const combinedTracks = [...prev, ...numberedTracks];
          return mode === 'simple'
            ? combinedTracks.sort(compareTracksByNumber)
            : combinedTracks;
        });
      }

      // 収集したタグをアルバムデータに追加
      if (allTags.length > 0) {
        setAlbumData(prev => {
          const existingTags = new Set(prev.tags);
          const newTags = allTags.filter(tag => !existingTags.has(tag));
          if (newTags.length > 0) {
            return {
              ...prev,
              tags: [...prev.tags, ...newTags]
            };
          }
          return prev;
        });
      }

      if (readErrors.length > 0) {
        const fileNames = readErrors
          .map(({ filePath }) => filePath.split(/[\\/]/).pop() || filePath)
          .join('\n');
        await showAppDialog({
          title: '一部の音声を読み込めませんでした',
          message: `${readErrors.length}件の音声を読み込めませんでした。\n\n${fileNames}`,
          guidance: 'ファイルがほかのアプリで開かれていないか、対応形式かを確認してから追加し直してください。',
          technicalDetail: readErrors
            .map(({ filePath, detail }) => `${filePath}\n${detail}`)
            .join('\n\n'),
          tone: 'warning',
        });
      }

      if (mode === 'simple' && newTracks.length > 0) {
        setWizardStep((current) => (current === 1 ? 2 : current));
      }

    } catch (error) {
      console.error('オーディオファイルの処理エラー:', error);
      await showAppDialog({
        title: '音声を読み込めませんでした',
        message: '選んだ音声を読み込んでいる途中で問題が起きました。',
        guidance: 'ファイルを開いているほかのアプリを閉じてから、もう一度お試しください。',
        technicalDetail: String(error),
        tone: 'error',
      });
    } finally {
      setIsProcessing(false);
      setProcessingProgress(null);
    }
  };

  // プログレスイベントリスナー
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setupProgressListener = async () => {
      try {
        unlisten = await listen<ProgressEvent>('audio-processing-progress', (event) => {
          const progress = event.payload;

          // 完了数を更新（並列処理でイベントが前後するため、最大値を記録）
          if (progress.status === 'completed' || progress.status === 'error') {
            setCompletedCount(prev => Math.max(prev, progress.current));
          }

          setProcessingProgress(progress);
        });
      } catch (error) {
        console.error('プログレスリスナーの設定に失敗:', error);
      }
    };

    setupProgressListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  // Tauriのファイルドロップイベントリスナー
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setupListener = async () => {
      console.log('Setting up file drop listener...');

      try {
        unlisten = await listen('tauri://drag-drop', async (event) => {
          console.log('File drop event received:', event);
          const { paths } = event.payload as { paths: string[] };
          console.log('Dropped paths:', paths);
          console.log('Number of paths dropped:', paths.length);

          if (paths.length === 0) return;

          // ファイルタイプで分類
          const imagePaths: string[] = [];
          const audioPaths: string[] = [];
          const directoryPaths: string[] = [];
          const unsupportedPaths: string[] = [];

          // パスが拡張子を持つかどうかで判断（拡張子なし=フォルダ）
          for (const path of paths) {
            const hasExtension = path.includes('.') && path.lastIndexOf('.') > path.lastIndexOf('/');

            if (!hasExtension) {
              // 拡張子がない場合はディレクトリとして扱う
              console.log(`Found directory: ${path}`);
              directoryPaths.push(path);
              continue;
            }

            // ファイルの場合はタイプで分類
            const fileType = getFileType(path);
            switch (fileType) {
              case 'image':
                imagePaths.push(path);
                break;
              case 'audio':
                audioPaths.push(path);
                break;
              default:
                unsupportedPaths.push(path);
                break;
            }
          }

          // ディレクトリから音声/画像ファイルを取得
          let directoryAudioFiles: string[] = [];
          let directoryImageFiles: string[] = [];
          if (directoryPaths.length > 0) {
            console.log('Processing directories:', directoryPaths);

            for (const dirPath of directoryPaths) {
              try {
                const files = await invoke<string[]>('scan_directory_for_audio_files', {
                  directoryPath: dirPath
                });
                directoryAudioFiles.push(...files);
                console.log(`Found ${files.length} audio files in ${dirPath}`);
                // 画像もスキャン
                try {
                  const imgs = await invoke<string[]>('scan_directory_for_image_files', {
                    directoryPath: dirPath
                  });
                  directoryImageFiles.push(...imgs);
                  console.log(`Found ${imgs.length} image files in ${dirPath}`);
                } catch (imgErr) {
                  console.error(`Error scanning images in ${dirPath}:`, imgErr);
                }
              } catch (error) {
                console.error(`Error scanning directory ${dirPath}:`, error);
                await showAppDialog({
                  title: 'フォルダを読み込めませんでした',
                  message: 'ドロップしたフォルダの中を確認できませんでした。',
                  guidance: 'フォルダへのアクセス権があるか確認して、もう一度お試しください。',
                  technicalDetail: `${dirPath}\n\n${String(error)}`,
                  tone: 'error',
                });
              }
            }
          }

          // すべての音声ファイルパスを結合
          const allAudioPaths = [...audioPaths, ...directoryAudioFiles];
          // すべての画像ファイルパスを結合
          const allImagePaths = [...imagePaths, ...directoryImageFiles];

          // サポートされていないファイルがある場合は警告
          if (unsupportedPaths.length > 0) {
            console.warn('サポートされていないファイル:', unsupportedPaths);
          }

          // オーディオファイルの処理（先に処理する）。画像候補の有無を渡す
          if (allAudioPaths.length > 0) {
            console.log('Processing audio files:', allAudioPaths);
            console.log(`Total audio files found: ${allAudioPaths.length}`);
            await processAudioFiles(allAudioPaths, allImagePaths.length > 0);
          }

          // 画像ファイルは最後に処理し、アルバムアートとして優先的に使用
          if (allImagePaths.length > 0) {
            // 優先度: ファイル名に 'cover' を含む > 'album' を含む > その他
            const score = (p: string) => {
              const name = getFileNameWithoutExtension(p).toLowerCase();
              if (name.includes('cover')) return 0;
              if (name.includes('album')) return 1;
              return 2;
            };
            const sorted = [...allImagePaths].sort((a, b) => score(a) - score(b));
            const bestImage = sorted[0];
            console.log('Selected album artwork image:', bestImage);
            const artworkUrl = convertFileSrc(bestImage);
            setAlbumData(prev => ({
              ...prev,
              albumArtwork: artworkUrl,
              albumArtworkPath: bestImage,
              // メタデータからのキャッシュ画像よりフォルダ内画像を優先（キャッシュはクリア）
              albumArtworkCachePath: undefined
            }));
          }

          // 処理結果を表示
          if (directoryPaths.length > 0) {
            const totalFound = directoryAudioFiles.length;
            if (totalFound > 0) {
              console.log(`ディレクトリから${totalFound}個の音声ファイルを発見しました`);
            } else {
              await confirm('ドロップされたフォルダに音声ファイルが見つかりませんでした。', {
                title: '音声ファイルなし',
                kind: 'info'
              });
            }
          }
        });
      } catch (error) {
        console.error('Failed to set up file drop listener:', error);
      }
    };

    setupListener();

    return () => {
      console.log('Cleaning up file drop listener...');
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  const handleAlbumFieldChange = (field: keyof AlbumData, value: string | boolean | string[]) => {
    setAlbumData({ ...albumData, [field]: value });
  };

  // 文字列をハッシュ化してユニークな色を生成
  const stringToHash = (str: string): number => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 32bit整数に変換
    }
    return Math.abs(hash);
  };

  const hashToColor = (hash: number): string => {
    // HSLを使って彩度と明度を固定し、色相のみを変化させる
    const hue = hash % 360;
    const saturation = 65; // 適度な彩度
    const lightness = 85; // 明るい背景色

    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  };

  const getTextColor = (backgroundColor: string): string => {
    // 背景色から色相を抽出して文字色を生成
    const hueMatch = backgroundColor.match(/hsl\((\d+),/);
    if (hueMatch) {
      const hue = parseInt(hueMatch[1]);
      return `hsl(${hue}, 65%, 25%)`;
    }
    return '#1f2937'; // フォールバック
  };

  // 文字列から一意な色を生成
  const getChipColor = (text: string) => {
    const hash = stringToHash(text);
    const backgroundColor = hashToColor(hash);
    const textColor = getTextColor(backgroundColor);

    return {
      backgroundColor,
      color: textColor
    };
  };

  // タグ入力処理（カンマ入力時にチップ化）
  const handleTagInput = (value: string) => {
    if (value.includes(',') || value.includes('，')) {
      const parts = value.split(/[,，]/);
      const newTags = trimAndDedup(parts.slice(0, -1));
      const remainingInput = parts[parts.length - 1].trim();

      if (newTags.length > 0) {
        const merged = trimAndDedup([...albumData.tags, ...newTags]);
        setAlbumData({
          ...albumData,
          tags: merged,
          currentTagInput: remainingInput
        });
      }
    } else {
      handleAlbumFieldChange('currentTagInput', value);
    }
  };

  // タグチップを削除
  const removeTag = (tagToRemove: string) => {
    const updatedTags = albumData.tags.filter(tag => tag !== tagToRemove);
    handleAlbumFieldChange('tags', updatedTags);
  };

  // アーティスト入力処理（カンマ入力時にチップ化）
  const handleArtistInput = (trackId: string, value: string) => {
    if (value.includes(',') || value.includes('，')) {
      const parts = value.split(/[,，]/);
      const newArtists = parts.slice(0, -1).map(artist => artist.trim()).filter(artist => artist.length > 0);
      const remainingInput = parts[parts.length - 1].trim();

      if (newArtists.length > 0) {
        const track = tracks.find(t => t.id === trackId);
        if (track) {
          const merged = trimAndDedup([...track.artists, ...newArtists]);
          setTracks(tracks.map(t =>
            t.id === trackId
              ? {
                ...t,
                artists: merged,
                currentArtistInput: remainingInput
              }
              : t
          ));
        }
      } else {
        handleTrackChange(trackId, 'currentArtistInput', remainingInput);
      }
    } else {
      handleTrackChange(trackId, 'currentArtistInput', value);
    }
  };

  // アーティストチップを削除
  const removeArtistTag = (trackId: string, artistToRemove: string) => {
    const track = tracks.find(t => t.id === trackId);
    if (!track) return;

    const updatedArtists = track.artists.filter(artist => artist !== artistToRemove);
    handleTrackChange(trackId, 'artists', updatedArtists);
  };

  const parseVoiceActorList = (input: string): string[] => {
    return trimAndDedup(
      input.split(/[,，;；]/).map((name) => name.trim()).filter((name) => name.length > 0),
    );
  };

  const applyVoiceActorsToAllTracks = (input: string) => {
    const artists = parseVoiceActorList(input);
    if (artists.length === 0) return;
    setTracks(tracks.map((track) => ({
      ...track,
      artists,
      currentArtistInput: '',
    })));
  };

  const copyVoiceActorsFromPreviousTrack = (trackId: string) => {
    const index = tracks.findIndex((track) => track.id === trackId);
    if (index <= 0) return;
    const artists = [...tracks[index - 1].artists];
    setTracks(tracks.map((track) => (
      track.id === trackId
        ? { ...track, artists, currentArtistInput: '' }
        : track
    )));
  };

  const copyFirstTrackVoiceActorsToAll = () => {
    if (tracks.length === 0 || tracks[0].artists.length === 0) return;
    const artists = [...tracks[0].artists];
    setTracks(tracks.map((track) => ({
      ...track,
      artists: [...artists],
      currentArtistInput: '',
    })));
  };

  // クリップボードにコピー
  const copyToClipboard = async (text: string, source: string = '') => {
    try {
      await navigator.clipboard.writeText(text);
      console.log(`Copied to clipboard: ${text} (from ${source})`);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      // フォールバック: 古いブラウザ向け
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        console.log(`Copied to clipboard (fallback): ${text} (from ${source})`);
      } catch (fallbackError) {
        console.error('Fallback copy failed:', fallbackError);
      }
    }
  };

  // 単一アーティストをコピー
  const copyArtist = (artist: string) => {
    copyToClipboard(artist, 'single artist');
  };

  // 全アーティストを一括コピー（セミコロン区切り）
  const copyAllArtists = (artists: string[]) => {
    const artistsText = artists.join('; ');
    copyToClipboard(artistsText, 'all artists');
  };

  // ペーストイベントハンドラー（複数アーティスト対応）
  const handleArtistPaste = (trackId: string, event: ClipboardEvent) => {
    event.preventDefault();

    const pastedText = event.clipboardData?.getData('text') || '';
    if (!pastedText.trim()) return;

    // セミコロンとカンマの両方で分割（全角も対応）
    const separatorRegex = /[;；,，]/;
    let newArtists: string[] = [];

    if (separatorRegex.test(pastedText)) {
      // 区切り文字がある場合は分割
      newArtists = pastedText
        .split(separatorRegex)
        .map(artist => artist.trim())
        .filter(artist => artist.length > 0);
    } else {
      // 区切り文字がない場合は単一アーティストとして扱う
      const trimmed = pastedText.trim();
      if (trimmed) {
        newArtists = [trimmed];
      }
    }

    if (newArtists.length > 0) {
      const track = tracks.find(t => t.id === trackId);
      if (track) {
        // 重複を除去して追加
        const existingArtists = new Set(track.artists);
        const uniqueNewArtists = newArtists.filter(artist => !existingArtists.has(artist));

        if (uniqueNewArtists.length > 0) {
          setTracks(tracks.map(t =>
            t.id === trackId
              ? {
                ...t,
                artists: [...t.artists, ...uniqueNewArtists],
                currentArtistInput: '' // ペースト後は入力フィールドをクリア
              }
              : t
          ));
          console.log(`Pasted artists: ${uniqueNewArtists.join(', ')}`);
        } else {
          console.log('All pasted artists already exist');
        }
      }
    }
  };

  // アーティスト入力のエンターキーハンドラー
  const handleArtistKeyDown = (trackId: string, event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();

      const track = tracks.find(t => t.id === trackId);
      if (!track || !track.currentArtistInput.trim()) return;

      const newArtist = track.currentArtistInput.trim();

      // 重複チェック
      if (track.artists.includes(newArtist)) {
        console.log('Artist already exists');
        return;
      }

      // アーティストを追加して入力フィールドをクリア
      const merged = trimAndDedup([...track.artists, newArtist]);
      setTracks(tracks.map(t =>
        t.id === trackId
          ? {
            ...t,
            artists: merged,
            currentArtistInput: ''
          }
          : t
      ));
      console.log(`Added artist: ${newArtist}`);
    }
  };

  // タグ入力のエンターキーハンドラー
  const handleTagKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();

      if (!albumData.currentTagInput.trim()) return;

      const newTag = albumData.currentTagInput.trim();

      // 重複チェック
      if (albumData.tags.includes(newTag)) {
        console.log('Tag already exists');
        return;
      }

      // タグを追加（順序維持しつつ重複排除）して入力フィールドをクリア
      const merged = trimAndDedup([...albumData.tags, newTag]);
      setAlbumData({
        ...albumData,
        tags: merged,
        currentTagInput: ''
      });
      console.log(`Added tag: ${newTag}`);
    }
  };

  const handleTrackChange = (trackId: string, field: keyof Track, value: string | boolean | string[]) => {
    setTracks(tracks.map(track =>
      track.id === trackId ? { ...track, [field]: value } : track
    ));
  };
  // トラック削除処理（確認ポップアップ付き）
  // トラックソート処理（Disk → Track順）
  const handleSort = () => {
    setTracks([...tracks].sort(compareTracksByNumber));
  };
  const handleTrackDelete = async (trackId: string) => {
    console.log("Deleting track:", trackId);
    console.log("Available tracks:", tracks.map(t => ({ id: t.id, title: t.title })));
    const track = tracks.find(t => t.id === trackId);
    console.log("Found track:", track);
    if (!track) {
      console.log("Track not found!");
      return;
    }

    const confirmMessage = `「${track.title}」を一覧から外しますか？

パソコンにある元の音声ファイルは削除されません。`;
    console.log("Showing confirm dialog:", confirmMessage);

    try {
      const userConfirmed = await confirm(confirmMessage, {
        title: "一覧から外す",
        kind: "warning"
      });
      console.log("User confirmed:", userConfirmed);

      if (userConfirmed) {
        console.log("Deleting track from array");
        const newTracks = tracks.filter(t => t.id !== trackId);
        console.log("New tracks array:", newTracks);
        setTracks(newTracks);
        console.log("Track deleted successfully");
      } else {
        console.log("User cancelled deletion");
      }
    } catch (error) {
      console.error("Error showing dialog:", error);
    }
  };
  // 出力設定ダイアログを表示（詳細モード専用）
  const handleExport = async () => {
    if (tracks.length === 0) {
      return;
    }
    setShowExportDialog(true);
  };

  // かんたんモードのウィザード保存（ステップ4から直接実行）
  const handleSimpleExport = async () => {
    if (tracks.length === 0) {
      return;
    }
    setExportSettings(prev => ({
      ...prev,
      overwriteMode: 'rename',
      format: 'MP3',
      quality: 'high',
    }));
    await handleActualExport(true);
  };

  // フォルダ選択処理
  const handleSelectOutputFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: '出力先フォルダを選択'
      });

      if (selected && typeof selected === 'string') {
        setExportSettings(prev => ({ ...prev, outputPath: selected }));
      }
    } catch (error) {
      console.error('フォルダ選択エラー:', error);
      await showAppDialog({
        title: '保存先を選べませんでした',
        message: '保存先フォルダを開けませんでした。',
        guidance: 'もう一度「選ぶ」を押し、書き込みできるフォルダを選んでください。',
        technicalDetail: String(error),
        tone: 'error',
      });
    }
  };

  // アートワーク選択
  const handleSelectArtworkFile = async () => {
    try {
      const selected = await open({
        multiple: false,
        title: 'カバー画像を選択',
        filters: [
          { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }
        ]
      });

      if (selected) {
        const artworkPath = Array.isArray(selected) ? selected[0] : selected;
        setAlbumData(prev => ({
          ...prev,
          albumArtwork: convertFileSrc(artworkPath),
          albumArtworkPath: artworkPath,
          albumArtworkCachePath: undefined
        }));
      }
    } catch (error) {
      console.error('アートワーク選択エラー:', error);
      await showAppDialog({
        title: '画像を選べませんでした',
        message: 'カバー画像を開けませんでした。',
        guidance: 'PNG、JPG、JPEG、WebP形式の画像を選び直してください。',
        technicalDetail: String(error),
        tone: 'error',
      });
    }
  };

  const handleClearAlbumArtwork = () => {
    setAlbumData(prev => ({
      ...prev,
      albumArtwork: null,
      albumArtworkPath: undefined,
      albumArtworkCachePath: undefined
    }));
  };

  const getArtworkSourceLabel = () => {
    if (albumData.albumArtworkPath) return 'フォルダの画像';
    if (albumData.albumArtworkCachePath) {
      return mode === 'simple' ? '音声に含まれていた画像' : '埋め込みアート';
    }
    if (albumData.albumArtwork) return mode === 'simple' ? '選んだ画像' : '手動追加';
    return '';
  };

  // ディレクトリ経由の読み込み（ドロップと同等の挙動）
  const processSelectedDirectories = async (directoryPaths: string[]) => {
    if (!directoryPaths || directoryPaths.length === 0) return;

    let directoryAudioFiles: string[] = [];
    let directoryImageFiles: string[] = [];

    for (const dirPath of directoryPaths) {
      try {
        const files = await invoke<string[]>('scan_directory_for_audio_files', {
          directoryPath: dirPath
        });
        directoryAudioFiles.push(...files);
      } catch (error) {
        console.error(`Error scanning directory ${dirPath}:`, error);
        await showAppDialog({
          title: 'フォルダを読み込めませんでした',
          message: '選んだフォルダの中を確認できませんでした。',
          guidance: 'フォルダへのアクセス権があるか確認して、もう一度お試しください。',
          technicalDetail: `${dirPath}\n\n${String(error)}`,
          tone: 'error',
        });
      }

      try {
        const imgs = await invoke<string[]>('scan_directory_for_image_files', {
          directoryPath: dirPath
        });
        directoryImageFiles.push(...imgs);
      } catch (imgErr) {
        console.error(`Error scanning images in ${dirPath}:`, imgErr);
      }
    }

    if (directoryAudioFiles.length === 0 && directoryImageFiles.length === 0) {
      await confirm('選択されたフォルダに音声/画像ファイルが見つかりませんでした。', {
        title: 'ファイルなし',
        kind: 'info'
      });
      return;
    }

    if (directoryAudioFiles.length > 0) {
      await processAudioFiles(directoryAudioFiles, directoryImageFiles.length > 0);
    }

    if (directoryImageFiles.length > 0) {
      const score = (p: string) => {
        const name = getFileNameWithoutExtension(p).toLowerCase();
        if (name.includes('cover')) return 0;
        if (name.includes('album')) return 1;
        return 2;
      };
      const sorted = [...directoryImageFiles].sort((a, b) => score(a) - score(b));
      const bestImage = sorted[0];
      const artworkUrl = convertFileSrc(bestImage);
      setAlbumData(prev => ({
        ...prev,
        albumArtwork: artworkUrl,
        albumArtworkPath: bestImage,
        albumArtworkCachePath: undefined
      }));
    }
  };

  // ファイル/フォルダ選択ダイアログ
  const handlePickAudioFiles = async () => {
    try {
      const selected = await open({
        multiple: true,
        title: '音声ファイルを選択',
        filters: [
          { name: 'Audio', extensions: ['wav', 'mp3', 'flac', 'm4a'] }
        ]
      });
      if (!selected) return;
      const paths = Array.isArray(selected) ? selected : [selected];
      if (paths.length > 0) {
        await processAudioFiles(paths, false);
      }
    } catch (error) {
      console.error('ファイル選択エラー:', error);
      await showAppDialog({
        title: '音声ファイルを選べませんでした',
        message: 'ファイル選択画面を開けませんでした。',
        guidance: '少し待ってから、もう一度お試しください。',
        technicalDetail: String(error),
        tone: 'error',
      });
    }
  };

  const handlePickDirectories = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: true,
        title: 'フォルダを選択'
      });
      if (!selected) return;
      const dirs = Array.isArray(selected) ? selected : [selected];
      await processSelectedDirectories(dirs);
    } catch (error) {
      console.error('フォルダ選択エラー:', error);
      await showAppDialog({
        title: 'フォルダを選べませんでした',
        message: 'フォルダ選択画面を開けませんでした。',
        guidance: '少し待ってから、もう一度お試しください。',
        technicalDetail: String(error),
        tone: 'error',
      });
    }
  };

  // 音質設定をバックエンド形式に変換
  const convertQuality = (format: string, quality: string): string => {
    switch (format) {
      case 'MP3':
        switch (quality) {
          case 'highest': return '320';
          case 'high': return '256';
          case 'medium': return '192';
          case 'low': return '128';
          default: return '192';
        }
      case 'M4A':
        // AACの目安ビットレート
        switch (quality) {
          case 'highest': return '320';
          case 'high': return '256';
          case 'medium': return '192';
          case 'low': return '128';
          default: return '192';
        }
      default:
        return '192';
    }
  };

  // 変換処理を実行する関数（失敗したファイルのみの再試行にも使用）
  const performConversion = async (tracksToConvert: any[], albumData: any, outputSettings: any): Promise<ConvertResult> => {
    console.log('=== 変換処理開始 ===');
    console.log('変換対象:', tracksToConvert.length, 'ファイル');

    // 完了数をリセット
    setCompletedCount(0);

    // 進捗イベントリスナーを設定
    const unlistenProgress = await listen('convert-progress', (event: any) => {
      const progress = event.payload;
      console.log(`進捗: ${progress.current}/${progress.total} - ${progress.current_file} (${progress.status})`);

      // 完了数を更新（並列処理でイベントが前後するため、最大値を記録）
      if (progress.status === 'completed' || progress.status === 'error') {
        setCompletedCount(prev => Math.max(prev, progress.current));
      }

      // ここで進捗表示UIを更新可能
      setConvertProgress({
        current: progress.current,
        total: progress.total,
        currentFile: progress.current_file,
        status: progress.status,
        percent: progress.progress_percent,
      });
    });

    try {
      // 変換リクエストを作成
      const convertRequest = {
        tracks: tracksToConvert,
        album_data: albumData,
        output_settings: outputSettings,
      };

      // Tauriコマンドを呼び出し
      const result = await invoke<ConvertResult>('convert_audio_files', { request: convertRequest });
      console.log('変換結果:', result);

      unlistenProgress();
      return result;

    } catch (invokeError) {
      console.error('Tauri invoke エラー:', invokeError);
      unlistenProgress();
      throw invokeError;
    }
  };

  // 実際の出力処理
  const handleActualExport = async (fromSimpleWizard = false) => {
    try {
      const effectiveExportSettings: ExportSettings = mode === 'simple'
        ? {
          ...exportSettings,
          overwriteMode: 'rename',
          format: 'MP3',
          quality: 'high',
        }
        : exportSettings;

      // バリデーション
      if (!effectiveExportSettings.outputPath) {
        await showAppDialog({
          title: '保存先を選んでください',
          message: '音声を保存するフォルダがまだ選ばれていません。',
          guidance: '「選ぶ」ボタンから保存先フォルダを選んでください。',
          tone: 'warning',
        });
        return;
      }

      const ffmpegAvailable = await ensureFfmpegReady();
      if (!ffmpegAvailable) {
        return;
      }

      setShowExportDialog(false);
      setIsProcessing(true);

      // トラックデータを変換用の形式に変換
      const convertTracks = tracks.map(track => ({
        source_path: track.filePath || '',
        disk_number: track.diskNumber || '1',
        track_number: track.trackNumber || '1',
        title: track.title,
        artists: track.artists,
      }));

      // アルバムデータを変換用の形式に変換
      const convertAlbumData = {
        album_title: albumData.albumTitle,
        album_artist: albumData.albumArtist,
        release_date: albumData.releaseDate,
        tags: albumData.tags,
        album_artwork_path: albumData.albumArtworkPath,
        album_artwork_cache_path: albumData.albumArtworkCachePath,
        album_artwork: albumData.albumArtwork,
      };

      // 出力設定を変換用の形式に変換
      const convertOutputSettings = {
        output_path: effectiveExportSettings.outputPath,
        format: effectiveExportSettings.format,
        quality: convertQuality(effectiveExportSettings.format, effectiveExportSettings.quality),
        overwrite_mode: effectiveExportSettings.overwriteMode,
      };

      try {
        let currentTracksToConvert = convertTracks;
        let allConvertedFiles: string[] = [];
        let retryCount = 0;
        const maxRetries = 3; // 最大再試行回数

        while (retryCount <= maxRetries) {
          // 変換実行
          const result = await performConversion(currentTracksToConvert, convertAlbumData, convertOutputSettings);

          // 成功したファイルを記録
          allConvertedFiles = [...allConvertedFiles, ...result.converted_files];

          setIsProcessing(false);
          setConvertProgress(null);

          // エラーがあった場合
          if (result.failed_files.length > 0) {
            const errorDetails = result.failed_files
              .map(f => {
                const fileName = f.source_path.split(/[\\/]/).pop() || f.source_path;
                return `${fileName}\n${f.error_message}`;
              })
              .join('\n\n');
            const failedNames = result.failed_files
              .map(f => f.source_path.split(/[\\/]/).pop() || f.source_path)
              .join('\n');

            const shouldRetry = await showAppDialog({
              title: '一部の音声を保存できませんでした',
              message: `保存できた音声：${result.converted_files.length}件\n保存できなかった音声：${result.failed_files.length}件\n\n${failedNames}`,
              guidance: '保存先に空き容量があるか、元の音声がほかのアプリで開かれていないか確認してください。',
              technicalDetail: errorDetails,
              confirmLabel: 'もう一度試す',
              cancelLabel: '今回は終了',
              tone: 'warning',
            });

            if (shouldRetry) {
              retryCount++;
              if (retryCount > maxRetries) {
                await showAppDialog({
                  title: '繰り返し保存できませんでした',
                  message: `${maxRetries}回試しましたが、保存できない音声が残っています。`,
                  guidance: '元の音声と保存先を確認してから、アプリの一覧に戻ってもう一度保存してください。',
                  tone: 'warning',
                });
                break;
              }

              // 失敗したファイルのみを再変換対象にする
              currentTracksToConvert = result.failed_files.map(failedFile => {
                // 元のトラック情報を探す
                const originalTrack = tracks.find(t => t.filePath === failedFile.source_path);
                return {
                  source_path: failedFile.source_path,
                  disk_number: originalTrack?.diskNumber || '1',
                  track_number: originalTrack?.trackNumber || '1',
                  title: originalTrack?.title || 'タイトル不明',
                  artists: originalTrack?.artists || [],
                };
              });

              setIsProcessing(true);
              console.log(`=== 再試行 ${retryCount}/${maxRetries} ===`);
              continue; // 再試行ループ
            } else {
              // 再試行しない場合は終了
              break;
            }
          } else {
            // すべて成功した場合
            if (fromSimpleWizard || mode === 'simple') {
              setSavedCount(allConvertedFiles.length);
              setWizardStep('complete');
            } else {
              await showAppDialog({
                title: '保存が完了しました',
                message: `${allConvertedFiles.length}件の音声を保存しました。\n保存した音声が最後まで正しく読み取れることも確認済みです。`,
                confirmLabel: '完了',
                tone: 'success',
              });
            }
            break;
          }
        }

      } catch (invokeError) {
        console.error('Tauri invoke エラー:', invokeError);
        setIsProcessing(false);
        setConvertProgress(null);

        await showAppDialog({
          title: '音声を保存できませんでした',
          message: '保存処理を続けられない問題が起きました。',
          guidance: '保存先の空き容量とアクセス権を確認して、もう一度お試しください。',
          technicalDetail: String(invokeError),
          tone: 'error',
        });
      }

    } catch (error) {
      console.error('出力処理エラー:', error);
      setIsProcessing(false);
      setConvertProgress(null);

      await showAppDialog({
        title: '保存を開始できませんでした',
        message: '保存の準備中に問題が起きました。',
        guidance: '保存先を選び直して、もう一度お試しください。',
        technicalDetail: String(error),
        tone: 'error',
      });
    }
  };

  // 一括削除処理
  const handleClearAll = async () => {
    if (tracks.length === 0) {
      return; // データがない場合は何もしない
    }

    const confirmMessage = mode === 'simple'
      ? `読み込んだ内容をすべて消しますか？

音声の一覧、音声作品の情報、カバー画像が画面から消えます。
パソコンにある元の音声ファイルは削除されません。`
      : `すべての編集内容を削除しますか？

この操作により以下がリセットされます：
• すべてのトラック
• 音声作品の情報
• カバー画像

元の音声ファイルは削除されません。`;

    try {
      const userConfirmed = await confirm(confirmMessage, {
        title: "読み込んだ内容を消す",
        kind: "warning"
      });

      if (userConfirmed) {
        // 全データをリセット
        setTracks([]);
        setAlbumData({
          albumTitle: '',
          albumArtist: '',
          releaseDate: '',
          tags: [],
          currentTagInput: '',
          albumArtwork: null,
          albumArtworkPath: undefined,
          albumArtworkCachePath: undefined
        });
        if (mode === 'simple') {
          setWizardStep(1);
          setSavedCount(0);
        }
        console.log("All data cleared successfully");
      }
    } catch (error) {
      console.error("Error showing clear all dialog:", error);
    }
  };


  const handleStartOver = () => {
    setTracks([]);
    setAlbumData({
      albumTitle: '',
      albumArtist: '',
      releaseDate: '',
      tags: [],
      currentTagInput: '',
      albumArtwork: null,
      albumArtworkPath: undefined,
      albumArtworkCachePath: undefined,
    });
    setExportSettings(prev => ({ ...prev, outputPath: '' }));
    setSavedCount(0);
    setWizardStep(1);
  };


  return (
    <div class={`flex h-screen bg-zinc-100 ${mode === 'advanced' ? 'min-w-[980px]' : ''}`}>
      {mode === 'advanced' && (
        <Sidebar
          mode={mode}
          albumData={albumData}
          artworkSourceLabel={getArtworkSourceLabel()}
          getChipColor={getChipColor}
          onSelectArtwork={handleSelectArtworkFile}
          onClearArtwork={handleClearAlbumArtwork}
          onAlbumFieldChange={handleAlbumFieldChange}
          onTagInput={handleTagInput}
          onTagKeyDown={handleTagKeyDown}
          onRemoveTag={removeTag}
        />
      )}

      {/* メインコンテンツ */}
      <main class="flex min-w-0 flex-1 flex-col bg-white">
        <AppToolbar
          mode={mode}
          hasTracks={tracks.length > 0}
          isFfmpegReady={isFfmpegReady}
          isUpdateChecking={isUpdateChecking}
          onModeChange={handleModeChange}
          onSort={handleSort}
          onPickAudioFiles={handlePickAudioFiles}
          onPickDirectories={handlePickDirectories}
          onCheckForUpdates={() => { void checkForUpdates(true); }}
          onShowAbout={() => { setAboutTab('overview'); setShowAbout(true); }}
          onShowGuide={() => { setOnboardingStep(0); setShowOnboarding(true); }}
          onClearAll={handleClearAll}
          onExport={handleExport}
        />

        <FfmpegBanner
          setup={ffmpegSetup}
          installLog={ffmpegInstallLog}
          showTechnicalDetails={mode === 'advanced'}
          onRetry={() => { void ensureFfmpegReady(); }}
        />

        {mode === 'simple' ? (
          <SimpleWizard
            wizardStep={wizardStep}
            tracks={tracks}
            albumData={albumData}
            exportSettings={exportSettings}
            artworkSourceLabel={getArtworkSourceLabel()}
            isProcessing={isProcessing}
            isFfmpegReady={isFfmpegReady}
            savedCount={savedCount}
            getChipColor={getChipColor}
            onStepChange={setWizardStep}
            onPickAudioFiles={handlePickAudioFiles}
            onPickDirectories={handlePickDirectories}
            onSelectArtwork={handleSelectArtworkFile}
            onClearArtwork={handleClearAlbumArtwork}
            onAlbumFieldChange={handleAlbumFieldChange}
            onTagInput={handleTagInput}
            onTagKeyDown={handleTagKeyDown}
            onRemoveTag={removeTag}
            onTrackDelete={handleTrackDelete}
            onTrackChange={handleTrackChange}
            onNumberInput={handleNumberInput}
            onPadNumber={padNumber}
            onArtistInput={handleArtistInput}
            onArtistPaste={handleArtistPaste}
            onArtistKeyDown={handleArtistKeyDown}
            onCopyArtist={copyArtist}
            onRemoveArtist={removeArtistTag}
            onCopyAllArtists={copyAllArtists}
            onApplyVoiceActorsToAll={applyVoiceActorsToAllTracks}
            onCopyVoiceActorsFromPrevious={copyVoiceActorsFromPreviousTrack}
            onCopyFirstTrackVoiceActorsToAll={copyFirstTrackVoiceActorsToAll}
            onSelectOutputFolder={handleSelectOutputFolder}
            onExport={() => { void handleSimpleExport(); }}
            onStartOver={handleStartOver}
          />
        ) : (
          <TrackTable
            mode={mode}
            tracks={tracks}
            isProcessing={isProcessing}
            isFfmpegReady={isFfmpegReady}
            getChipColor={getChipColor}
            onPickAudioFiles={handlePickAudioFiles}
            onPickDirectories={handlePickDirectories}
            onTrackDelete={handleTrackDelete}
            onTrackChange={handleTrackChange}
            onNumberInput={handleNumberInput}
            onPadNumber={padNumber}
            onArtistInput={handleArtistInput}
            onArtistPaste={handleArtistPaste}
            onArtistKeyDown={handleArtistKeyDown}
            onCopyArtist={copyArtist}
            onRemoveArtist={removeArtistTag}
            onCopyAllArtists={copyAllArtists}
            onApplyVoiceActorsToAll={applyVoiceActorsToAllTracks}
            onCopyVoiceActorsFromPrevious={copyVoiceActorsFromPreviousTrack}
            onCopyFirstTrackVoiceActorsToAll={copyFirstTrackVoiceActorsToAll}
          />
        )}
      </main>

      {/* 出力設定ダイアログ（詳細モード専用） */}
      {mode === 'advanced' && (
        <ExportDialog
          mode={mode}
          isOpen={showExportDialog}
          settings={exportSettings}
          qualityOptions={getQualityOptions(exportSettings.format)}
          onSettingsChange={setExportSettings}
          onFormatChange={handleFormatChange}
          onSelectOutputFolder={handleSelectOutputFolder}
          onCancel={() => setShowExportDialog(false)}
          onExport={() => { void handleActualExport(false); }}
        />
      )}

      {/* About / Legal ダイアログ */}
      <AboutDialog
        mode={mode}
        isOpen={showAbout}
        activeTab={aboutTab}
        appName={appName}
        appVersion={appVersion}
        onTabChange={setAboutTab}
        onClose={() => setShowAbout(false)}
      />

      {/* 処理中オーバーレイ */}
      <ProcessingOverlay
        isProcessing={isProcessing}
        convertProgress={convertProgress}
        processingProgress={processingProgress}
        completedCount={completedCount}
      />

      {/* オンボーディングオーバーレイ */}
      <OnboardingModal
        isOpen={showOnboarding}
        steps={onboardingSteps}
        currentStep={onboardingStep}
        onStepChange={setOnboardingStep}
        onClose={closeOnboarding}
      />

      <AppDialog
        options={appDialog}
        mode={mode}
        onResult={handleAppDialogResult}
      />
    </div>
  );
}

export default App;
