import { useState, useEffect, useCallback, useRef } from "preact/hooks";
import { open } from "@tauri-apps/plugin-dialog";
import { getName, getVersion } from "@tauri-apps/api/app";
import { listen } from '@tauri-apps/api/event';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { check } from "@tauri-apps/plugin-updater";
import { AboutDialog, type AboutTab } from './components/AboutDialog';
import { AppDialog, type AppDialogOptions } from './components/AppDialog';
import { AppToolbar } from './components/AppToolbar';
import { DragDropOverlay } from './components/DragDropOverlay';
import { ExportDialog } from './components/ExportDialog';
import { FfmpegBanner } from './components/FfmpegBanner';
import { OnboardingModal } from './components/OnboardingModal';
import { ProcessingOverlay } from './components/ProcessingOverlay';
import { Sidebar } from './components/Sidebar';
import { SimpleWizard } from './components/SimpleWizard';
import { ToastContainer, type ToastItem } from './components/ToastContainer';
import { TrackTable } from './components/TrackTable';
import { useI18n } from './i18n';
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
  ProgressEvent,
  QualityOption,
  Track,
  WizardStep,
} from './types';
import "./App.css";

const MODE_STORAGE_KEY = 'vte_display_mode_v1';
const EXPORT_SETTINGS_STORAGE_KEY = 'vte_export_settings_v1';
const MAX_HISTORY_SIZE = 50;

interface EditorSnapshot {
  tracks: Track[];
  albumData: AlbumData;
  wizardStep?: WizardStep;
}

const cloneSnapshot = (tracks: Track[], albumData: AlbumData, wizardStep?: WizardStep): EditorSnapshot => ({
  tracks: tracks.map((track) => ({ ...track, artists: [...track.artists] })),
  albumData: { ...albumData, tags: [...albumData.tags] },
  wizardStep,
});

const loadInitialExportSettings = (): ExportSettings => {
  const defaults: ExportSettings = {
    outputPath: '',
    overwriteMode: 'rename',
    format: 'MP3',
    quality: 'high',
    encodeMode: 'reencode',
  };
  try {
    const raw = localStorage.getItem(EXPORT_SETTINGS_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<ExportSettings>;
    return {
      outputPath: typeof parsed.outputPath === 'string' ? parsed.outputPath : defaults.outputPath,
      overwriteMode: defaults.overwriteMode,
      format: parsed.format === 'MP3' || parsed.format === 'M4A'
        ? parsed.format
        : defaults.format,
      quality: parsed.quality === 'highest' || parsed.quality === 'high' || parsed.quality === 'medium' || parsed.quality === 'low'
        ? parsed.quality
        : defaults.quality,
      encodeMode: parsed.encodeMode === 'reencode' || parsed.encodeMode === 'copy'
        ? parsed.encodeMode
        : defaults.encodeMode,
    };
  } catch {
    return defaults;
  }
};

const compareTracksByNumber = (a: Track, b: Track): number => {
  const diskDifference = (Number.parseInt(a.diskNumber, 10) || 0)
    - (Number.parseInt(b.diskNumber, 10) || 0);
  if (diskDifference !== 0) {
    return diskDifference;
  }

  return (Number.parseInt(a.trackNumber, 10) || 0)
    - (Number.parseInt(b.trackNumber, 10) || 0);
};

const getParentDirectory = (filePath: string): string => {
  const normalized = filePath.replace(/[\\/]+$/, '');
  const lastSep = Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('\\'));
  return lastSep > 0 ? normalized.slice(0, lastSep) : normalized;
};

function App() {
  const { t, fmt } = useI18n();
  const tRef = useRef(t);
  const fmtRef = useRef(fmt);
  tRef.current = t;
  fmtRef.current = fmt;

  const [mode, setMode] = useState<AppMode>(() => {
    try {
      return localStorage.getItem(MODE_STORAGE_KEY) === 'advanced' ? 'advanced' : 'simple';
    } catch {
      return 'simple';
    }
  });
  const [wizardStep, setWizardStep] = useState<WizardStep>(1);
  const [savedCount, setSavedCount] = useState(0);
  const [lastSavedFolderPath, setLastSavedFolderPath] = useState('');
  const [albumData, setAlbumData] = useState<AlbumData>({
    albumArtwork: null,
    albumTitle: "",
    albumArtist: "",
    releaseDate: "",
    tags: [],
    currentTagInput: "",
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [processingProgress, setProcessingProgress] = useState<ProgressEvent | null>(null);
  const [convertProgress, setConvertProgress] = useState<ConvertProgress | null>(null);
  const [completedCount, setCompletedCount] = useState(0);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Export settings (persisted across sessions)
  const [exportDraft, setExportDraft] = useState<ExportSettings | null>(null);
  const [exportSettings, setExportSettings] = useState<ExportSettings>(loadInitialExportSettings);

  // Undo / Redo history
  const tracksRef = useRef(tracks);
  const albumDataRef = useRef(albumData);
  const wizardStepRef = useRef(wizardStep);
  const isImportingRef = useRef(false);
  tracksRef.current = tracks;
  albumDataRef.current = albumData;
  wizardStepRef.current = wizardStep;
  const pastHistoryRef = useRef<EditorSnapshot[]>([]);
  const futureHistoryRef = useRef<EditorSnapshot[]>([]);
  const lastHistoryGroupRef = useRef<{ key: string; timestamp: number } | null>(null);
  const [historyAvailability, setHistoryAvailability] = useState({ canUndo: false, canRedo: false });

  // Onboarding
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);
  const [onboardingStep, setOnboardingStep] = useState<number>(0);

  // About / Legal
  const [showAbout, setShowAbout] = useState<boolean>(false);
  const [aboutTab, setAboutTab] = useState<AboutTab>('overview');
  const [appName, setAppName] = useState<string>('VoiceTagEditor');
  const [appVersion, setAppVersion] = useState<string>('');
  const [appDialog, setAppDialog] = useState<AppDialogOptions | null>(null);
  const appDialogResolver = useRef<((confirmed: boolean) => void) | null>(null);

  // Updater & FFmpeg
  const [isUpdateChecking, setIsUpdateChecking] = useState<boolean>(false);
  const isUpdateCheckingRef = useRef(false);
  const [ffmpegSetup, setFfmpegSetup] = useState<FfmpegSetupState>({
    status: 'idle',
    message: '',
  });
  const [ffmpegInstallLog, setFfmpegInstallLog] = useState<FfmpegInstallProgress[]>([]);
  const ffmpegSetupPromise = useRef<Promise<FfmpegInstallResult> | null>(null);
  const ffmpegReadyRef = useRef(false);
  const isFfmpegReady = ffmpegSetup.status === 'ready';

  const toastTimersRef = useRef<Map<string, number>>(new Map());

  const dismissToast = useCallback((id: string) => {
    const timer = toastTimersRef.current.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      toastTimersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const showToast = useCallback((messageText: string, tone: ToastItem['tone'] = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev.slice(-2), { id, message: messageText, tone }]);
    const timer = window.setTimeout(() => {
      toastTimersRef.current.delete(id);
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 2800);
    toastTimersRef.current.set(id, timer);
  }, []);

  useEffect(() => {
    return () => {
      for (const timer of toastTimersRef.current.values()) {
        window.clearTimeout(timer);
      }
      toastTimersRef.current.clear();
    };
  }, []);

  const showAppDialog = useCallback((options: AppDialogOptions): Promise<boolean> => {
    if (appDialogResolver.current) {
      appDialogResolver.current(false);
    }
    setAppDialog(options);
    return new Promise<boolean>((resolve) => {
      appDialogResolver.current = resolve;
    });
  }, []);

  const handleAppDialogResult = useCallback((confirmed: boolean) => {
    const resolver = appDialogResolver.current;
    appDialogResolver.current = null;
    setAppDialog(null);
    resolver?.(confirmed);
  }, []);

  const handleOpenOutputFolder = useCallback(async (folderPath: string) => {
    if (!folderPath) return;
    try {
      await invoke<void>('open_folder', { path: folderPath });
    } catch (error) {
      console.error('Failed to open output folder:', error);
      showToast(tRef.current.toast.openFolderFailed, 'warning');
    }
  }, [showToast]);

  useEffect(() => {
    (async () => {
      try { setAppName(await getName()); } catch { }
      try { setAppVersion(await getVersion()); } catch { }
    })();
  }, []);

  const syncHistoryAvailability = useCallback(() => {
    setHistoryAvailability({
      canUndo: pastHistoryRef.current.length > 0,
      canRedo: futureHistoryRef.current.length > 0,
    });
  }, []);

  const pushHistory = useCallback((groupKey?: string, step?: WizardStep) => {
    const now = Date.now();
    if (groupKey && lastHistoryGroupRef.current) {
      const { key, timestamp } = lastHistoryGroupRef.current;
      if (key === groupKey && now - timestamp < 800) {
        lastHistoryGroupRef.current = { key: groupKey, timestamp: now };
        return;
      }
    }

    const snapshot = cloneSnapshot(tracksRef.current, albumDataRef.current, step);
    pastHistoryRef.current = [...pastHistoryRef.current.slice(-(MAX_HISTORY_SIZE - 1)), snapshot];
    futureHistoryRef.current = [];
    lastHistoryGroupRef.current = groupKey ? { key: groupKey, timestamp: now } : null;
    syncHistoryAvailability();
  }, [syncHistoryAvailability]);

  const handleUndo = useCallback(() => {
    if (isImportingRef.current) return;
    const previous = pastHistoryRef.current.pop();
    if (!previous) return;

    const current = cloneSnapshot(
      tracksRef.current,
      albumDataRef.current,
      previous.wizardStep === undefined ? undefined : wizardStepRef.current,
    );
    futureHistoryRef.current.push(current);
    lastHistoryGroupRef.current = null;
    setTracks(previous.tracks);
    setAlbumData(previous.albumData);
    if (previous.wizardStep !== undefined) setWizardStep(previous.wizardStep);
    syncHistoryAvailability();
    showToast(tRef.current.toast.undone, 'info');
  }, [showToast, syncHistoryAvailability]);

  const handleRedo = useCallback(() => {
    if (isImportingRef.current) return;
    const next = futureHistoryRef.current.pop();
    if (!next) return;

    const current = cloneSnapshot(
      tracksRef.current,
      albumDataRef.current,
      next.wizardStep === undefined ? undefined : wizardStepRef.current,
    );
    pastHistoryRef.current.push(current);
    lastHistoryGroupRef.current = null;
    setTracks(next.tracks);
    setAlbumData(next.albumData);
    if (next.wizardStep !== undefined) setWizardStep(next.wizardStep);
    syncHistoryAvailability();
    showToast(tRef.current.toast.redone, 'info');
  }, [showToast, syncHistoryAvailability]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) {
        return;
      }
      const target = event.target as HTMLElement | null;
      const isEditableField = Boolean(
        target
        && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable),
      );
      if (isEditableField) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey) {
        if (pastHistoryRef.current.length > 0) {
          event.preventDefault();
          handleUndo();
        }
      } else if ((key === 'z' && event.shiftKey) || (key === 'y' && !event.metaKey)) {
        if (futureHistoryRef.current.length > 0) {
          event.preventDefault();
          handleRedo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  useEffect(() => {
    try {
      localStorage.setItem(MODE_STORAGE_KEY, mode);
    } catch {
      // Ignore storage errors
    }
  }, [mode]);

  useEffect(() => {
    try {
      localStorage.setItem(EXPORT_SETTINGS_STORAGE_KEY, JSON.stringify(exportSettings));
    } catch {
      // Ignore storage errors
    }
  }, [exportSettings]);

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
          const msg = event.payload.message.replace(/\s+/g, ' ').trim();
          if (!msg) return;

          setFfmpegInstallLog((prev) => [...prev.slice(-5), {
            stream: event.payload.stream,
            message: msg,
          }]);
        });
      } catch (error) {
        console.error('Failed to set up FFmpeg progress listener:', error);
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
    const tr = tRef.current;

    const markReady = (technicalDetail?: string) => {
      ffmpegReadyRef.current = true;
      setFfmpegSetup({
        status: 'ready',
        message: tr.ffmpegBanner.ready,
        technicalDetail,
      });
    };

    const markFailed = (error: unknown) => {
      ffmpegReadyRef.current = false;
      ffmpegSetupPromise.current = null;
      setFfmpegSetup({
        status: 'failed',
        message: tr.ffmpegBanner.failed,
        technicalDetail: String(error),
      });
    };

    if (ffmpegReadyRef.current) {
      return true;
    }

    setFfmpegSetup({
      status: 'checking',
      message: tr.ffmpegBanner.preparing,
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
        markReady(tr.ffmpegBanner.verifiedDetail);
        return true;
      }
    } catch (error) {
      markFailed(error);
      return false;
    }

    setFfmpegInstallLog([{ stream: 'status', message: tr.ffmpegBanner.autoInstallStart }]);

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
    const tr = tRef.current;
    const format = fmtRef.current;
    try {
      const update = await check();
      if (!update) {
        if (showNoUpdateDialog) {
          await showAppDialog({
            title: tr.dialogs.updateUpToDateTitle,
            message: tr.dialogs.updateUpToDateMessage,
            confirmLabel: tr.common.ok,
            tone: 'info',
          });
        }
        return;
      }

      const releaseNote = (update.body && String(update.body).trim().length > 0)
        ? format(tr.dialogs.updateReleaseNotesHeader, { notes: String(update.body).trim() })
        : '';

      const ok = await showAppDialog({
        title: tr.dialogs.updateAvailableTitle,
        message: format(tr.dialogs.updateAvailableMessage, {
          current: update.currentVersion,
          latest: update.version,
          notes: releaseNote,
        }),
        confirmLabel: tr.dialogs.updateInstallConfirm,
        cancelLabel: tr.dialogs.updateLater,
        tone: 'info',
      });
      if (!ok) return;

      await update.downloadAndInstall((event) => {
        if ('data' in event) {
          console.log('[updater]', event.event, event.data);
        } else {
          console.log('[updater]', event.event);
        }
      });

      await showAppDialog({
        title: tr.dialogs.updateDoneTitle,
        message: tr.dialogs.updateDoneMessage,
        confirmLabel: tr.common.ok,
        tone: 'success',
      });
      try {
        await invoke<void>('restart_app');
      } catch (restartError) {
        console.warn('Auto-restart failed after update:', restartError);
        await showAppDialog({
          title: tr.dialogs.updateRestartRequiredTitle,
          message: tr.dialogs.updateRestartRequiredMessage,
          confirmLabel: tr.common.ok,
          tone: 'warning',
        });
      }
    } catch (e) {
      console.warn('Update check failed:', e);
      if (showNoUpdateDialog) {
        await showAppDialog({
          title: tr.dialogs.updateCheckFailedTitle,
          message: tr.dialogs.updateCheckFailedMessage,
          guidance: tr.dialogs.updateCheckFailedGuidance,
          technicalDetail: String(e),
          tone: 'warning',
        });
      }
    } finally {
      isUpdateCheckingRef.current = false;
      setIsUpdateChecking(false);
    }
  }, [showAppDialog]);

  // Check for updates silently on startup
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

  const getQualityOptions = (_format: ExportSettings['format']): QualityOption[] => [
    { value: 'highest', label: t.exportDialog.qualityHighest },
    { value: 'high', label: t.exportDialog.qualityHigh },
    { value: 'medium', label: t.exportDialog.qualityMedium },
    { value: 'low', label: t.exportDialog.qualityLow },
  ];

  const handleFormatChange = (newFormat: ExportSettings['format']) => {
    setExportDraft((prev) => prev && { ...prev, format: newFormat, quality: 'high' });
  };

  const padNumber = (value: string): string => {
    if (!value) return '';
    const numeric = value.replace(/[^0-9]/g, '');
    return numeric ? numeric.padStart(2, '0') : '';
  };

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

  const handleNumberInput = (value: string): string => {
    return value.replace(/[^0-9]/g, '');
  };

  const getFileType = (filePath: string): 'image' | 'audio' | 'unsupported' => {
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp'];
    const audioExtensions = ['.wav', '.mp3', '.flac', '.m4a'];
    const lastDot = filePath.lastIndexOf('.');
    if (lastDot < 0) return 'unsupported';
    const fileExtension = filePath.toLowerCase().substring(lastDot);

    if (imageExtensions.includes(fileExtension)) {
      return 'image';
    }
    if (audioExtensions.includes(fileExtension)) {
      return 'audio';
    }
    return 'unsupported';
  };

  const getFileNameWithoutExtension = (filePath: string): string => {
    const fileName = filePath.split(/[\\/]/).pop() || filePath;
    const lastDotIndex = fileName.lastIndexOf('.');
    return lastDotIndex > 0 ? fileName.substring(0, lastDotIndex) : fileName;
  };

  const generateTrackId = (): string => {
    return Date.now().toString() + Math.random().toString(36).slice(2, 11);
  };

  const processNewFiles = useCallback(async (newFilePaths: string[], artworkPath?: string) => {
    const tr = tRef.current;
    const format = fmtRef.current;
    try {
      setCompletedCount(0);

      let results: AudioFileResult[] = [];
      if (newFilePaths.length > 0 && await ensureFfmpegReady()) {
        results = await invoke<AudioFileResult[]>('process_audio_files', {
          filePaths: newFilePaths,
        });
      }

      const newTracks: Track[] = [];
      const albumUpdates: Partial<AlbumData> = {};
      const allTags: string[] = [];
      let hasAlbumInfo = false;
      if (artworkPath) {
        albumUpdates.albumArtwork = convertFileSrc(artworkPath);
        albumUpdates.albumArtworkPath = artworkPath;
        albumUpdates.albumArtworkCachePath = undefined;
      }
      const readErrors: Array<{ filePath: string; detail: string }> = [];

      for (const result of results) {
        if (result.error) {
          console.error(`Error processing ${result.file_path}: ${result.error}`);
          readErrors.push({ filePath: result.file_path, detail: result.error });
          continue;
        }

        if (result.metadata) {
          const metadata = result.metadata;

          const embeddedArtwork = !albumUpdates.albumArtwork ? metadata.album_art : undefined;
          if (embeddedArtwork) {
            albumUpdates.albumArtwork = `data:image/jpeg;base64,${embeddedArtwork}`;
            albumUpdates.albumArtworkPath = undefined;
            albumUpdates.albumArtworkCachePath = undefined;
            try {
              albumUpdates.albumArtworkCachePath = await invoke<string>('save_album_art_to_cache', {
                base64Data: embeddedArtwork,
                albumTitle: metadata.album || 'Unknown Album',
                albumArtist: metadata.album_artist || 'Unknown Artist',
              });
            } catch (error) {
              console.error('Failed to cache album art:', error);
            }
          }

          const hasMetadata = metadata.album || metadata.album_artist || metadata.date;
          if (embeddedArtwork || (!hasAlbumInfo && hasMetadata)) {
            if (metadata.album) albumUpdates.albumTitle = metadata.album;
            if (metadata.album_artist) albumUpdates.albumArtist = metadata.album_artist;
            if (metadata.date) albumUpdates.releaseDate = metadata.date;
            hasAlbumInfo = true;
          }

          if (metadata.tags && metadata.tags.length > 0) {
            for (const tag of metadata.tags) {
              if (!allTags.includes(tag)) {
                allTags.push(tag);
              }
            }
          }
          if (metadata.genre && metadata.genre.trim().length > 0) {
            const genreParts = metadata.genre
              .split(/[;,／、\/]/)
              .map((tag) => tag.trim())
              .filter((tag) => tag.length > 0);
            for (const g of genreParts) {
              if (!allTags.includes(g)) {
                allTags.push(g);
              }
            }
          }

          const newTrack: Track = {
            id: generateTrackId(),
            diskNumber: normalizeNumberString(metadata.disk_number || '1'),
            trackNumber: metadata.track_number ? normalizeNumberString(metadata.track_number) : '',
            title: metadata.title || getFileNameWithoutExtension(result.file_path),
            artists: metadata.artist ? trimAndDedup(metadata.artist.split(';')) : [],
            currentArtistInput: '',
            filePath: result.file_path,
            duration: metadata.duration,
          };

          newTracks.push(newTrack);
        }
      }

      const advancesWizard = mode === 'simple' && newTracks.length > 0 && wizardStepRef.current === 1;
      if (newTracks.length > 0 || artworkPath) {
        pushHistory(undefined, advancesWizard ? 1 : undefined);
        setAlbumData((prev) => ({
          ...prev,
          ...albumUpdates,
          tags: [...new Set([...prev.tags, ...allTags])],
        }));
        if (advancesWizard) setWizardStep(2);
      }

      if (newTracks.length > 0) {
        setTracks((prev) => {
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

      if (readErrors.length > 0) {
        const fileNames = readErrors
          .map(({ filePath }) => filePath.split(/[\\/]/).pop() || filePath)
          .join('\n');
        await showAppDialog({
          title: tr.dialogs.partialReadFailedTitle,
          message: format(tr.dialogs.partialReadFailedMessage, {
            count: readErrors.length,
            files: fileNames,
          }),
          guidance: tr.dialogs.partialReadFailedGuidance,
          technicalDetail: readErrors
            .map(({ filePath, detail }) => `${filePath}\n${detail}`)
            .join('\n\n'),
          tone: 'warning',
        });
      }
    } catch (error) {
      console.error('Error processing audio files:', error);
      await showAppDialog({
        title: tr.dialogs.readAudioFailedTitle,
        message: tr.dialogs.readAudioFailedMessage,
        guidance: tr.dialogs.readAudioFailedGuidance,
        technicalDetail: String(error),
        tone: 'error',
      });
    }
  }, [ensureFfmpegReady, mode, pushHistory, showAppDialog]);

  const importFiles = useCallback(async (filePaths: string[], imagePaths: string[] = []) => {
    if (isImportingRef.current || isProcessing) return;
    isImportingRef.current = true;
    const tr = tRef.current;
    const format = fmtRef.current;
    try {
      setIsProcessing(true);
      const existingPaths = new Set(tracksRef.current.map((track) => track.filePath));
      const newFilePaths = [...new Set(filePaths)].filter((path) => !existingPaths.has(path));
      const score = (path: string) => {
        const name = getFileNameWithoutExtension(path).toLowerCase();
        if (name.includes('cover')) return 0;
        if (name.includes('album')) return 1;
        return 2;
      };
      const artworkPath = [...imagePaths].sort((a, b) => score(a) - score(b))[0];
      if (newFilePaths.length > 0 || artworkPath) {
        await processNewFiles(newFilePaths, artworkPath);
      }

      if (filePaths.length > 0 && newFilePaths.length === 0) {
        await showAppDialog({
          title: tr.dialogs.duplicateFilesTitle,
          message: tr.dialogs.duplicateFilesMessage,
          confirmLabel: tr.common.ok,
          tone: 'info',
        });
      } else if (newFilePaths.length < filePaths.length) {
        showToast(format(tr.toast.skippedDuplicates, { count: filePaths.length - newFilePaths.length }), 'info');
      }
    } catch (error) {
      console.error('Error adding audio files:', error);
      await showAppDialog({
        title: tr.dialogs.addAudioFailedTitle,
        message: tr.dialogs.addAudioFailedMessage,
        guidance: tr.dialogs.addAudioFailedGuidance,
        technicalDetail: String(error),
        tone: 'error',
      });
    } finally {
      isImportingRef.current = false;
      setIsProcessing(false);
      setProcessingProgress(null);
    }
  }, [isProcessing, processNewFiles, showAppDialog, showToast]);

  // Audio processing progress listener
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setupProgressListener = async () => {
      try {
        unlisten = await listen<ProgressEvent>('audio-processing-progress', (event) => {
          const progress = event.payload;
          if (progress.status === 'completed' || progress.status === 'error') {
            setCompletedCount((prev) => Math.max(prev, progress.current));
          }
          setProcessingProgress(progress);
        });
      } catch (error) {
        console.error('Failed to set up progress listener:', error);
      }
    };

    setupProgressListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  const handleDroppedPaths = useCallback(async (paths: string[]) => {
    if (paths.length === 0) return;

    const tr = tRef.current;
    const imagePaths: string[] = [];
    const audioPaths: string[] = [];
    const directoryPaths: string[] = [];
    const unsupportedPaths: string[] = [];

    for (const path of paths) {
      const lastSep = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
      const hasExtension = path.includes('.') && path.lastIndexOf('.') > lastSep;

      if (!hasExtension) {
        directoryPaths.push(path);
        continue;
      }

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

    let directoryAudioFiles: string[] = [];
    let directoryImageFiles: string[] = [];
    if (directoryPaths.length > 0) {
      for (const dirPath of directoryPaths) {
        try {
          const files = await invoke<string[]>('scan_directory_for_audio_files', {
            directoryPath: dirPath,
          });
          directoryAudioFiles.push(...files);

          try {
            const imgs = await invoke<string[]>('scan_directory_for_image_files', {
              directoryPath: dirPath,
            });
            directoryImageFiles.push(...imgs);
          } catch (imgErr) {
            console.error(`Error scanning images in ${dirPath}:`, imgErr);
          }
        } catch (error) {
          console.error(`Error scanning directory ${dirPath}:`, error);
          await showAppDialog({
            title: tr.dialogs.readFolderFailedTitle,
            message: tr.dialogs.readFolderFailedDroppedMessage,
            guidance: tr.dialogs.readFolderFailedGuidance,
            technicalDetail: `${dirPath}\n\n${String(error)}`,
            tone: 'error',
          });
        }
      }
    }

    const allAudioPaths = [...audioPaths, ...directoryAudioFiles];
    const allImagePaths = [...imagePaths, ...directoryImageFiles];

    if (unsupportedPaths.length > 0) {
      console.warn('Unsupported files:', unsupportedPaths);
    }

    if (allAudioPaths.length > 0 || allImagePaths.length > 0) {
      await importFiles(allAudioPaths, allImagePaths);
    }

    if (directoryPaths.length > 0 && directoryAudioFiles.length === 0 && allImagePaths.length === 0) {
      await showAppDialog({
        title: tr.dialogs.noAudioInDroppedFolderTitle,
        message: tr.dialogs.noAudioInDroppedFolderMessage,
        confirmLabel: tr.common.ok,
        tone: 'info',
      });
    }
  }, [importFiles, showAppDialog]);

  const handleDroppedPathsRef = useRef(handleDroppedPaths);
  handleDroppedPathsRef.current = handleDroppedPaths;

  // Tauri drag-and-drop listeners (including visual feedback overlay)
  useEffect(() => {
    const unlisteners: Array<() => void> = [];
    let disposed = false;

    const setupListeners = async () => {
      try {
        const unlistenEnter = await listen('tauri://drag-enter', () => {
          setIsDraggingOver(true);
        });
        const unlistenLeave = await listen('tauri://drag-leave', () => {
          setIsDraggingOver(false);
        });
        const unlistenDrop = await listen('tauri://drag-drop', async (event) => {
          setIsDraggingOver(false);
          const payload = event.payload as { paths?: string[] } | null;
          if (payload?.paths && payload.paths.length > 0) {
            await handleDroppedPathsRef.current(payload.paths);
          }
        });

        if (disposed) {
          unlistenEnter();
          unlistenLeave();
          unlistenDrop();
          return;
        }
        unlisteners.push(unlistenEnter, unlistenLeave, unlistenDrop);
      } catch (error) {
        console.error('Failed to set up file drop listeners:', error);
      }
    };

    void setupListeners();

    return () => {
      disposed = true;
      for (const unlisten of unlisteners) {
        unlisten();
      }
    };
  }, []);

  const handleAlbumFieldChange = (field: keyof AlbumData, value: string | boolean | string[]) => {
    if (field !== 'currentTagInput') {
      pushHistory(`album:${field}`);
    }
    setAlbumData((prev) => ({ ...prev, [field]: value }));
  };

  const stringToHash = (str: string): number => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  };

  const getChipColor = (text: string) => {
    const hash = stringToHash(text);
    const hue = hash % 360;
    return {
      backgroundColor: `hsl(${hue}, 65%, 85%)`,
      color: `hsl(${hue}, 65%, 25%)`,
    };
  };

  const handleTagInput = (value: string) => {
    if (value.includes(',') || value.includes('，')) {
      const parts = value.split(/[,，]/);
      const newTags = trimAndDedup(parts.slice(0, -1));
      const remainingInput = parts[parts.length - 1].trim();

      if (newTags.length > 0) {
        pushHistory();
        const merged = trimAndDedup([...albumData.tags, ...newTags]);
        setAlbumData((prev) => ({
          ...prev,
          tags: merged,
          currentTagInput: remainingInput,
        }));
      }
    } else {
      handleAlbumFieldChange('currentTagInput', value);
    }
  };

  const removeTag = (tagToRemove: string) => {
    pushHistory();
    setAlbumData((prev) => ({
      ...prev,
      tags: prev.tags.filter((tag) => tag !== tagToRemove),
    }));
  };

  const handleArtistInput = (trackId: string, value: string) => {
    if (value.includes(',') || value.includes('，')) {
      const parts = value.split(/[,，]/);
      const newArtists = parts.slice(0, -1).map((artist) => artist.trim()).filter((artist) => artist.length > 0);
      const remainingInput = parts[parts.length - 1].trim();

      if (newArtists.length > 0) {
        pushHistory();
        setTracks((prev) => prev.map((track) => {
          if (track.id !== trackId) return track;
          return {
            ...track,
            artists: trimAndDedup([...track.artists, ...newArtists]),
            currentArtistInput: remainingInput,
          };
        }));
      } else {
        handleTrackChange(trackId, 'currentArtistInput', remainingInput);
      }
    } else {
      handleTrackChange(trackId, 'currentArtistInput', value);
    }
  };

  const removeArtistTag = (trackId: string, artistToRemove: string) => {
    pushHistory();
    setTracks((prev) => prev.map((track) => (
      track.id === trackId
        ? { ...track, artists: track.artists.filter((artist) => artist !== artistToRemove) }
        : track
    )));
  };

  const parseVoiceActorList = (input: string): string[] => {
    return trimAndDedup(
      input.split(/[,，;；]/).map((name) => name.trim()).filter((name) => name.length > 0),
    );
  };

  const applyVoiceActorsToAllTracks = (input: string) => {
    const artists = parseVoiceActorList(input);
    if (artists.length === 0) return;
    pushHistory();
    setTracks((prev) => prev.map((track) => ({
      ...track,
      artists: [...artists],
      currentArtistInput: '',
    })));
    showToast(t.toast.appliedVoiceActors, 'success');
  };

  const copyVoiceActorsFromPreviousTrack = (trackId: string) => {
    const index = tracks.findIndex((track) => track.id === trackId);
    if (index <= 0) return;
    pushHistory();
    const artists = [...tracks[index - 1].artists];
    setTracks((prev) => prev.map((track) => (
      track.id === trackId
        ? { ...track, artists, currentArtistInput: '' }
        : track
    )));
    showToast(t.toast.copiedPreviousVoiceActors, 'info');
  };

  const copyFirstTrackVoiceActorsToAll = () => {
    if (tracks.length === 0 || tracks[0].artists.length === 0) return;
    pushHistory();
    const artists = [...tracks[0].artists];
    setTracks((prev) => prev.map((track) => ({
      ...track,
      artists: [...artists],
      currentArtistInput: '',
    })));
    showToast(t.toast.copiedFirstTrackVoiceActors, 'success');
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(fmt(t.toast.copied, { text }), 'info');
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast(fmt(t.toast.copied, { text }), 'info');
      } catch (fallbackError) {
        console.error('Fallback copy failed:', fallbackError);
      }
    }
  };

  const copyArtist = (artist: string) => {
    void copyToClipboard(artist);
  };

  const copyAllArtists = (artists: string[]) => {
    void copyToClipboard(artists.join('; '));
  };

  const handleArtistPaste = (trackId: string, event: ClipboardEvent) => {
    event.preventDefault();

    const pastedText = event.clipboardData?.getData('text') || '';
    if (!pastedText.trim()) return;

    const separatorRegex = /[;；,，]/;
    const newArtists = separatorRegex.test(pastedText)
      ? pastedText.split(separatorRegex).map((artist) => artist.trim()).filter((artist) => artist.length > 0)
      : [pastedText.trim()];

    if (newArtists.length > 0) {
      pushHistory();
      setTracks((prev) => prev.map((track) => {
        if (track.id !== trackId) return track;
        const merged = trimAndDedup([...track.artists, ...newArtists]);
        return {
          ...track,
          artists: merged,
          currentArtistInput: '',
        };
      }));
    }
  };

  const handleArtistKeyDown = (trackId: string, event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      const track = tracks.find((item) => item.id === trackId);
      if (!track || !track.currentArtistInput.trim()) return;

      const newArtist = track.currentArtistInput.trim();
      if (track.artists.includes(newArtist)) {
        return;
      }

      pushHistory();
      const merged = trimAndDedup([...track.artists, newArtist]);
      setTracks((prev) => prev.map((item) => (
        item.id === trackId
          ? { ...item, artists: merged, currentArtistInput: '' }
          : item
      )));
    }
  };

  const handleTagKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (!albumData.currentTagInput.trim()) return;

      const newTag = albumData.currentTagInput.trim();
      if (albumData.tags.includes(newTag)) {
        return;
      }

      pushHistory();
      const merged = trimAndDedup([...albumData.tags, newTag]);
      setAlbumData((prev) => ({
        ...prev,
        tags: merged,
        currentTagInput: '',
      }));
    }
  };

  const handleTrackChange = (trackId: string, field: keyof Track, value: string | boolean | string[]) => {
    if (field !== 'currentArtistInput') {
      pushHistory(`track:${trackId}:${field}`);
    }
    setTracks((prev) => prev.map((track) => (
      track.id === trackId ? { ...track, [field]: value } : track
    )));
  };

  const handleSort = () => {
    if (tracks.length < 2) return;
    pushHistory();
    setTracks((prev) => [...prev].sort(compareTracksByNumber));
    showToast(t.toast.sortedTracks, 'info');
  };

  const handleMoveTrack = (trackId: string, direction: 'up' | 'down') => {
    const index = tracks.findIndex((track) => track.id === trackId);
    if (index < 0) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= tracks.length) return;

    pushHistory();
    setTracks((prev) => {
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  };

  const handleReorderTrack = (fromIndex: number, toIndex: number) => {
    if (
      fromIndex === toIndex
      || fromIndex < 0
      || toIndex < 0
      || fromIndex >= tracks.length
      || toIndex >= tracks.length
    ) {
      return;
    }

    pushHistory();
    setTracks((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  const handleBatchTransformTitles = (transform: (title: string) => string) => {
    let changedCount = 0;
    const nextTracks = tracks.map((track) => {
      const nextTitle = transform(track.title);
      if (nextTitle !== track.title) {
        changedCount++;
        return { ...track, title: nextTitle };
      }
      return track;
    });
    if (changedCount === 0) return;

    pushHistory();
    setTracks(nextTracks);
    showToast(fmt(t.toast.formattedTitles, { count: changedCount }), 'success');
  };

  const handleRenumberTracks = () => {
    if (tracks.length === 0) return;
    pushHistory();
    setTracks((prev) => {
      const counters = new Map<number, number>();
      return prev.map((track) => {
        const diskNum = Number.parseInt(track.diskNumber, 10) || 1;
        const nextNum = (counters.get(diskNum) ?? 0) + 1;
        counters.set(diskNum, nextNum);
        return {
          ...track,
          diskNumber: String(diskNum).padStart(2, '0'),
          trackNumber: String(nextNum).padStart(2, '0'),
        };
      });
    });
    showToast(t.toast.renumberedTracks, 'success');
  };

  const handleTrackDelete = async (trackId: string) => {
    const track = tracks.find((item) => item.id === trackId);
    if (!track) return;

    const userConfirmed = await showAppDialog({
      title: t.dialogs.removeTrackTitle,
      message: fmt(t.dialogs.removeTrackMessage, {
        title: track.title || t.trackTable.untitledTrack,
      }),
      confirmLabel: t.dialogs.removeTrackConfirm,
      cancelLabel: t.common.cancel,
      tone: 'warning',
    });

    if (userConfirmed) {
      pushHistory();
      setTracks((prev) => prev.filter((item) => item.id !== trackId));
    }
  };

  const handleExport = async () => {
    if (tracks.length === 0) return;
    setExportDraft({ ...exportSettings });
  };

  const handleSimpleExport = async () => {
    if (tracks.length === 0) return;
    await handleActualExport({
      ...exportSettings,
      overwriteMode: 'rename',
      format: 'MP3',
      quality: 'high',
      encodeMode: 'reencode',
    }, true);
  };

  const handleSelectOutputFolder = async (forExportDialog = false) => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: t.fileDialogs.selectOutputFolder,
      });

      if (selected && typeof selected === 'string') {
        if (forExportDialog) {
          setExportDraft((prev) => prev && { ...prev, outputPath: selected });
        } else {
          setExportSettings((prev) => ({ ...prev, outputPath: selected }));
        }
      }
    } catch (error) {
      console.error('Failed to pick output folder:', error);
      await showAppDialog({
        title: t.dialogs.selectOutputFailedTitle,
        message: t.dialogs.selectOutputFailedMessage,
        guidance: t.dialogs.selectOutputFailedGuidance,
        technicalDetail: String(error),
        tone: 'error',
      });
    }
  };

  const handleSelectArtworkFile = async () => {
    try {
      const selected = await open({
        multiple: false,
        title: t.fileDialogs.selectCoverImage,
        filters: [
          { name: t.fileDialogs.filterImages, extensions: ['png', 'jpg', 'jpeg', 'webp'] },
        ],
      });

      if (selected) {
        pushHistory();
        const artworkPath = Array.isArray(selected) ? selected[0] : selected;
        setAlbumData((prev) => ({
          ...prev,
          albumArtwork: convertFileSrc(artworkPath),
          albumArtworkPath: artworkPath,
          albumArtworkCachePath: undefined,
        }));
      }
    } catch (error) {
      console.error('Failed to pick cover image:', error);
      await showAppDialog({
        title: t.dialogs.selectImageFailedTitle,
        message: t.dialogs.selectImageFailedMessage,
        guidance: t.dialogs.selectImageFailedGuidance,
        technicalDetail: String(error),
        tone: 'error',
      });
    }
  };

  const handleClearAlbumArtwork = () => {
    pushHistory();
    setAlbumData((prev) => ({
      ...prev,
      albumArtwork: null,
      albumArtworkPath: undefined,
      albumArtworkCachePath: undefined,
    }));
  };

  const getArtworkSourceLabel = () => {
    if (albumData.albumArtworkPath) return t.albumForm.sourceFolderImage;
    if (albumData.albumArtworkCachePath) {
      return mode === 'simple'
        ? t.albumForm.sourceEmbeddedSimple
        : t.albumForm.sourceEmbeddedAdvanced;
    }
    if (albumData.albumArtwork) {
      return mode === 'simple'
        ? t.albumForm.sourceManualSimple
        : t.albumForm.sourceManualAdvanced;
    }
    return '';
  };

  const processSelectedDirectories = async (directoryPaths: string[]) => {
    if (!directoryPaths || directoryPaths.length === 0) return;

    let directoryAudioFiles: string[] = [];
    let directoryImageFiles: string[] = [];

    for (const dirPath of directoryPaths) {
      try {
        const files = await invoke<string[]>('scan_directory_for_audio_files', {
          directoryPath: dirPath,
        });
        directoryAudioFiles.push(...files);
      } catch (error) {
        console.error(`Error scanning directory ${dirPath}:`, error);
        await showAppDialog({
          title: t.dialogs.readFolderFailedTitle,
          message: t.dialogs.readFolderFailedSelectedMessage,
          guidance: t.dialogs.readFolderFailedGuidance,
          technicalDetail: `${dirPath}\n\n${String(error)}`,
          tone: 'error',
        });
      }

      try {
        const imgs = await invoke<string[]>('scan_directory_for_image_files', {
          directoryPath: dirPath,
        });
        directoryImageFiles.push(...imgs);
      } catch (imgErr) {
        console.error(`Error scanning images in ${dirPath}:`, imgErr);
      }
    }

    if (directoryAudioFiles.length === 0 && directoryImageFiles.length === 0) {
      await showAppDialog({
        title: t.dialogs.noFilesInSelectedFolderTitle,
        message: t.dialogs.noFilesInSelectedFolderMessage,
        confirmLabel: t.common.ok,
        tone: 'info',
      });
      return;
    }

    await importFiles(directoryAudioFiles, directoryImageFiles);
  };

  const handlePickAudioFiles = async () => {
    try {
      const selected = await open({
        multiple: true,
        title: t.fileDialogs.selectAudioFiles,
        filters: [
          { name: t.fileDialogs.filterAudio, extensions: ['wav', 'mp3', 'flac', 'm4a'] },
        ],
      });
      if (!selected) return;
      const paths = Array.isArray(selected) ? selected : [selected];
      if (paths.length > 0) {
        await importFiles(paths);
      }
    } catch (error) {
      console.error('Failed to pick audio files:', error);
      await showAppDialog({
        title: t.dialogs.selectAudioFailedTitle,
        message: t.dialogs.selectAudioFailedMessage,
        guidance: t.dialogs.selectAudioFailedGuidance,
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
        title: t.fileDialogs.selectFolders,
      });
      if (!selected) return;
      const dirs = Array.isArray(selected) ? selected : [selected];
      await processSelectedDirectories(dirs);
    } catch (error) {
      console.error('Failed to pick folders:', error);
      await showAppDialog({
        title: t.dialogs.selectFolderFailedTitle,
        message: t.dialogs.selectFolderFailedMessage,
        guidance: t.dialogs.selectFolderFailedGuidance,
        technicalDetail: String(error),
        tone: 'error',
      });
    }
  };

  const convertQuality = (format: string, quality: string): string => {
    switch (format) {
      case 'MP3':
      case 'M4A':
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

  const performConversion = async (
    tracksToConvert: unknown[],
    convertAlbumData: unknown,
    outputSettings: unknown,
  ): Promise<ConvertResult> => {
    setCompletedCount(0);

    const unlistenProgress = await listen('convert-progress', (event: { payload: {
      current: number;
      total: number;
      current_file: string;
      status: string;
      progress_percent: number;
    } }) => {
      const progress = event.payload;
      if (progress.status === 'completed' || progress.status === 'error') {
        setCompletedCount((prev) => Math.max(prev, progress.current));
      }

      setConvertProgress({
        current: progress.current,
        total: progress.total,
        currentFile: progress.current_file,
        status: progress.status,
        percent: progress.progress_percent,
      });
    });

    try {
      const convertRequest = {
        tracks: tracksToConvert,
        album_data: convertAlbumData,
        output_settings: outputSettings,
      };
      const result = await invoke<ConvertResult>('convert_audio_files', { request: convertRequest });
      unlistenProgress();
      return result;
    } catch (invokeError) {
      unlistenProgress();
      throw invokeError;
    }
  };

  const handleActualExport = async (effectiveExportSettings: ExportSettings, fromSimpleWizard = false) => {
    try {
      if (!effectiveExportSettings.outputPath) {
        await showAppDialog({
          title: t.dialogs.missingOutputFolderTitle,
          message: t.dialogs.missingOutputFolderMessage,
          guidance: t.dialogs.missingOutputFolderGuidance,
          tone: 'warning',
        });
        return;
      }

      const ffmpegAvailable = await ensureFfmpegReady();
      if (!ffmpegAvailable) {
        return;
      }

      if (!fromSimpleWizard) {
        setExportSettings({ ...effectiveExportSettings, overwriteMode: 'rename' });
        setExportDraft(null);
      }
      setIsProcessing(true);

      const convertTracks = tracks.map((track) => ({
        source_path: track.filePath || '',
        disk_number: track.diskNumber || '1',
        track_number: track.trackNumber || '1',
        title: track.title,
        artists: track.artists,
      }));

      const convertAlbumData = {
        album_title: albumData.albumTitle,
        album_artist: albumData.albumArtist,
        release_date: albumData.releaseDate,
        tags: albumData.tags,
        album_artwork_path: albumData.albumArtworkPath,
        album_artwork_cache_path: albumData.albumArtworkCachePath,
        album_artwork: albumData.albumArtwork,
      };

      const convertOutputSettings = {
        output_path: effectiveExportSettings.outputPath,
        format: effectiveExportSettings.format,
        quality: convertQuality(effectiveExportSettings.format, effectiveExportSettings.quality),
        overwrite_mode: effectiveExportSettings.overwriteMode,
        encode_mode: effectiveExportSettings.encodeMode,
      };

      try {
        let currentTracksToConvert = convertTracks;
        let allConvertedFiles: string[] = [];
        let retryCount = 0;
        const maxRetries = 3;

        while (retryCount <= maxRetries) {
          const result = await performConversion(currentTracksToConvert, convertAlbumData, convertOutputSettings);
          allConvertedFiles = [...allConvertedFiles, ...result.converted_files];

          setIsProcessing(false);
          setConvertProgress(null);

          if (result.failed_files.length > 0) {
            const errorDetails = result.failed_files
              .map((f) => {
                const fileName = f.source_path.split(/[\\/]/).pop() || f.source_path;
                return `${fileName}\n${f.error_message}`;
              })
              .join('\n\n');
            const failedNames = result.failed_files
              .map((f) => f.source_path.split(/[\\/]/).pop() || f.source_path)
              .join('\n');

            const shouldRetry = await showAppDialog({
              title: t.dialogs.partialSaveFailedTitle,
              message: fmt(t.dialogs.partialSaveFailedMessage, {
                succeeded: result.converted_files.length,
                failed: result.failed_files.length,
                files: failedNames,
              }),
              guidance: t.dialogs.partialSaveFailedGuidance,
              technicalDetail: errorDetails,
              confirmLabel: t.dialogs.partialSaveRetry,
              cancelLabel: t.dialogs.partialSaveFinish,
              tone: 'warning',
            });

            if (shouldRetry) {
              retryCount++;
              if (retryCount > maxRetries) {
                await showAppDialog({
                  title: t.dialogs.maxRetriesTitle,
                  message: fmt(t.dialogs.maxRetriesMessage, { count: maxRetries }),
                  guidance: t.dialogs.maxRetriesGuidance,
                  tone: 'warning',
                });
                break;
              }

              currentTracksToConvert = result.failed_files.map((failedFile) => {
                const originalTrack = tracks.find((item) => item.filePath === failedFile.source_path);
                return {
                  source_path: failedFile.source_path,
                  disk_number: originalTrack?.diskNumber || '1',
                  track_number: originalTrack?.trackNumber || '1',
                  title: originalTrack?.title || t.trackTable.untitledTrack,
                  artists: originalTrack?.artists || [],
                };
              });

              setIsProcessing(true);
              continue;
            } else {
              break;
            }
          } else {
            const savedFolder = allConvertedFiles[0]
              ? getParentDirectory(allConvertedFiles[0])
              : effectiveExportSettings.outputPath;
            setLastSavedFolderPath(savedFolder);

            if (fromSimpleWizard || mode === 'simple') {
              setSavedCount(allConvertedFiles.length);
              setWizardStep('complete');
            } else {
              await showAppDialog({
                title: t.dialogs.saveCompleteTitle,
                message: fmt(t.dialogs.saveCompleteMessage, { count: allConvertedFiles.length }),
                confirmLabel: t.common.done,
                secondaryAction: savedFolder
                  ? {
                    label: t.common.openFolder,
                    onClick: () => {
                      void handleOpenOutputFolder(savedFolder);
                    },
                  }
                  : undefined,
                tone: 'success',
              });
            }
            break;
          }
        }
      } catch (invokeError) {
        console.error('Tauri invoke error:', invokeError);
        setIsProcessing(false);
        setConvertProgress(null);

        await showAppDialog({
          title: t.dialogs.saveFailedTitle,
          message: t.dialogs.saveFailedMessage,
          guidance: t.dialogs.saveFailedGuidance,
          technicalDetail: String(invokeError),
          tone: 'error',
        });
      }
    } catch (error) {
      console.error('Export error:', error);
      setIsProcessing(false);
      setConvertProgress(null);

      await showAppDialog({
        title: t.dialogs.saveStartFailedTitle,
        message: t.dialogs.saveStartFailedMessage,
        guidance: t.dialogs.saveStartFailedGuidance,
        technicalDetail: String(error),
        tone: 'error',
      });
    }
  };

  const handleClearAll = async () => {
    if (tracks.length === 0) return;

    const userConfirmed = await showAppDialog({
      title: t.dialogs.clearAllTitle,
      message: mode === 'simple'
        ? t.dialogs.clearAllSimpleMessage
        : t.dialogs.clearAllAdvancedMessage,
      confirmLabel: t.dialogs.clearAllConfirm,
      cancelLabel: t.common.cancel,
      tone: 'warning',
    });

    if (userConfirmed) {
      pushHistory(undefined, mode === 'simple' ? wizardStep : undefined);
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
      setLastSavedFolderPath('');
      if (mode === 'simple') {
        setWizardStep(1);
        setSavedCount(0);
      }
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
    pastHistoryRef.current = [];
    futureHistoryRef.current = [];
    lastHistoryGroupRef.current = null;
    syncHistoryAvailability();
    setLastSavedFolderPath('');
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
          onClearAll={() => { void handleClearAll(); }}
          onExport={() => { void handleExport(); }}
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
            lastSavedFolderPath={lastSavedFolderPath}
            artworkSourceLabel={getArtworkSourceLabel()}
            isProcessing={isProcessing}
            isFfmpegReady={isFfmpegReady}
            canUndo={historyAvailability.canUndo}
            canRedo={historyAvailability.canRedo}
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
            onTrackDelete={(trackId) => { void handleTrackDelete(trackId); }}
            onTrackChange={handleTrackChange}
            onMoveTrack={handleMoveTrack}
            onReorderTrack={handleReorderTrack}
            onRenumberTracks={handleRenumberTracks}
            onSortTracks={handleSort}
            onBatchTransformTitles={handleBatchTransformTitles}
            onUndo={handleUndo}
            onRedo={handleRedo}
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
            onSelectOutputFolder={() => { void handleSelectOutputFolder(); }}
            onOpenOutputFolder={(path) => { void handleOpenOutputFolder(path); }}
            onExport={() => { void handleSimpleExport(); }}
            onStartOver={handleStartOver}
          />
        ) : (
          <TrackTable
            mode={mode}
            tracks={tracks}
            isProcessing={isProcessing}
            isFfmpegReady={isFfmpegReady}
            canUndo={historyAvailability.canUndo}
            canRedo={historyAvailability.canRedo}
            getChipColor={getChipColor}
            onPickAudioFiles={handlePickAudioFiles}
            onPickDirectories={handlePickDirectories}
            onTrackDelete={(trackId) => { void handleTrackDelete(trackId); }}
            onTrackChange={handleTrackChange}
            onMoveTrack={handleMoveTrack}
            onReorderTrack={handleReorderTrack}
            onRenumberTracks={handleRenumberTracks}
            onSortTracks={handleSort}
            onBatchTransformTitles={handleBatchTransformTitles}
            onUndo={handleUndo}
            onRedo={handleRedo}
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

      {mode === 'advanced' && exportDraft && (
        <ExportDialog
          mode={mode}
          isOpen
          settings={exportDraft}
          qualityOptions={getQualityOptions(exportDraft.format)}
          onSettingsChange={setExportDraft}
          onFormatChange={handleFormatChange}
          onSelectOutputFolder={() => { void handleSelectOutputFolder(true); }}
          onCancel={() => setExportDraft(null)}
          onExport={() => { void handleActualExport(exportDraft); }}
        />
      )}

      <AboutDialog
        mode={mode}
        isOpen={showAbout}
        activeTab={aboutTab}
        appName={appName}
        appVersion={appVersion}
        onTabChange={setAboutTab}
        onClose={() => setShowAbout(false)}
      />

      <ProcessingOverlay
        isProcessing={isProcessing}
        convertProgress={convertProgress}
        processingProgress={processingProgress}
        completedCount={completedCount}
      />

      <OnboardingModal
        isOpen={showOnboarding}
        currentStep={onboardingStep}
        onStepChange={setOnboardingStep}
        onClose={closeOnboarding}
      />

      <AppDialog
        options={appDialog}
        mode={mode}
        onResult={handleAppDialogResult}
      />

      <DragDropOverlay visible={isDraggingOver} />
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

export default App;
