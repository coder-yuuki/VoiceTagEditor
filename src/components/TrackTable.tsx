import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { convertFileSrc } from '@tauri-apps/api/core';
import {
  AlertTriangle,
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpDown,
  Clipboard,
  Clock,
  Copy,
  CornerLeftUp,
  FileAudio,
  FolderOpen,
  FolderPlus,
  GripVertical,
  ListOrdered,
  Pause,
  Play,
  Redo2,
  Trash2,
  Undo2,
  Upload,
  Users,
  X,
} from 'lucide-preact';
import { useI18n } from '../i18n';
import type { AppMode, ChipColor, Track } from '../types';
import { formatTotalSeconds, parseDurationToSeconds } from '../utils/titleFormat';
import { AudioPreviewBar } from './AudioPreviewBar';
import { TitleFormatPopover } from './TitleFormatPopover';
import { InfoHint, Tooltip } from './Tooltip';

interface TrackTableProps {
  mode: AppMode;
  tracks: Track[];
  isProcessing: boolean;
  isFfmpegReady: boolean;
  canUndo: boolean;
  canRedo: boolean;
  getChipColor: (text: string) => ChipColor;
  onPickAudioFiles: () => void;
  onPickDirectories: () => void;
  onTrackDelete: (trackId: string) => void;
  onTrackChange: (trackId: string, field: keyof Track, value: string | boolean | string[]) => void;
  onMoveTrack: (trackId: string, direction: 'up' | 'down') => void;
  onReorderTrack: (fromIndex: number, toIndex: number) => void;
  onInternalDragChange: (dragging: boolean) => void;
  onRenumberTracks: () => void;
  onSortTracks: () => void;
  onBatchTransformTitles: (transform: (title: string) => string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onNumberInput: (value: string) => string;
  onPadNumber: (value: string) => string;
  onArtistInput: (trackId: string, value: string) => void;
  onArtistPaste: (trackId: string, event: ClipboardEvent) => void;
  onArtistKeyDown: (trackId: string, event: KeyboardEvent) => void;
  onCopyArtist: (artist: string) => void;
  onRemoveArtist: (trackId: string, artist: string) => void;
  onCopyAllArtists: (artists: string[]) => void;
  onApplyVoiceActorsToAll: (input: string) => void;
  onCopyVoiceActorsFromPrevious: (trackId: string) => void;
  onCopyFirstTrackVoiceActorsToAll: () => void;
}

const SUPPORTED_FORMATS = ['WAV', 'MP3', 'FLAC', 'M4A'] as const;

function numberKey(track: Track): string | null {
  const disk = Number.parseInt(track.diskNumber, 10);
  const trackNumber = Number.parseInt(track.trackNumber, 10);
  if (!Number.isFinite(disk) || !Number.isFinite(trackNumber)) {
    return null;
  }
  return `${disk}-${trackNumber}`;
}

export function TrackTable({
  mode,
  tracks,
  isProcessing,
  isFfmpegReady,
  canUndo,
  canRedo,
  getChipColor,
  onPickAudioFiles,
  onPickDirectories,
  onTrackDelete,
  onTrackChange,
  onMoveTrack,
  onReorderTrack,
  onInternalDragChange,
  onRenumberTracks,
  onSortTracks,
  onBatchTransformTitles,
  onUndo,
  onRedo,
  onNumberInput,
  onPadNumber,
  onArtistInput,
  onArtistPaste,
  onArtistKeyDown,
  onCopyArtist,
  onRemoveArtist,
  onCopyAllArtists,
  onApplyVoiceActorsToAll,
  onCopyVoiceActorsFromPrevious,
  onCopyFirstTrackVoiceActorsToAll,
}: TrackTableProps) {
  const { t, fmt } = useI18n();
  const [bulkVoiceActorInput, setBulkVoiceActorInput] = useState('');
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [previewErrorTrackId, setPreviewErrorTrackId] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<{ index: number; position: 'above' | 'below' } | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeTrackIdRef = useRef<string | null>(null);

  const simple = mode === 'simple';
  const numberCounts = new Map<string, number>();
  for (const track of tracks) {
    const key = numberKey(track);
    if (key) {
      numberCounts.set(key, (numberCounts.get(key) ?? 0) + 1);
    }
  }
  const duplicateKeys = new Set(
    [...numberCounts.entries()]
      .filter(([, count]) => count > 1)
      .map(([key]) => key),
  );
  const hasFirstTrackVoiceActors = tracks[0]?.artists.length > 0;

  const totalDurationLabel = useMemo(() => {
    const totalSecs = tracks.reduce((sum, track) => sum + parseDurationToSeconds(track.duration), 0);
    return formatTotalSeconds(totalSecs);
  }, [tracks]);

  useEffect(() => {
    activeTrackIdRef.current = activeTrackId;
  }, [activeTrackId]);

  const stopPreview = () => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    setIsPlaying(false);
    setActiveTrackId(null);
    setCurrentTime(0);
    setDuration(0);
  };

  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'metadata';

    const handleEnded = () => setIsPlaying(false);
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime || 0);
    const handleDurationChange = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
    };
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleError = () => {
      setIsPlaying(false);
      if (activeTrackIdRef.current) {
        setPreviewErrorTrackId(activeTrackIdRef.current);
      }
    };

    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleDurationChange);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('error', handleError);
    audioRef.current = audio;

    return () => {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleDurationChange);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('error', handleError);
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
    audio.muted = muted;
  }, [volume, muted]);

  useEffect(() => {
    if (isProcessing) {
      stopPreview();
      return;
    }
    if (activeTrackId && !tracks.some((track) => track.id === activeTrackId)) {
      stopPreview();
    }
  }, [tracks, activeTrackId, isProcessing]);

  const startPlayingTrack = async (track: Track) => {
    if (!track.filePath) return;
    const audio = audioRef.current;
    if (!audio) return;

    setPreviewErrorTrackId(null);

    try {
      audio.pause();
      audio.src = convertFileSrc(track.filePath);
      audio.currentTime = 0;
      setCurrentTime(0);
      setDuration(0);
      setActiveTrackId(track.id);
      await audio.play();
    } catch (error) {
      console.error('Preview playback failed:', error);
      setIsPlaying(false);
      setPreviewErrorTrackId(track.id);
    }
  };

  const togglePreview = async (track: Track) => {
    if (!track.filePath) return;
    const audio = audioRef.current;
    if (!audio) return;

    if (activeTrackId === track.id) {
      if (isPlaying) {
        audio.pause();
      } else {
        setPreviewErrorTrackId(null);
        try {
          await audio.play();
        } catch (error) {
          console.error('Preview resume failed:', error);
          setPreviewErrorTrackId(track.id);
        }
      }
      return;
    }

    await startPlayingTrack(track);
  };

  const activeTrackIndex = activeTrackId
    ? tracks.findIndex((track) => track.id === activeTrackId)
    : -1;
  const activeTrack = activeTrackIndex >= 0 ? tracks[activeTrackIndex] : null;

  const findAdjacentPlayableTrack = (direction: -1 | 1): Track | null => {
    if (activeTrackIndex < 0) return null;
    for (let i = activeTrackIndex + direction; i >= 0 && i < tracks.length; i += direction) {
      if (tracks[i].filePath) {
        return tracks[i];
      }
    }
    return null;
  };

  const previousPlayableTrack = findAdjacentPlayableTrack(-1);
  const nextPlayableTrack = findAdjacentPlayableTrack(1);

  const handleSeek = (time: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const clamped = Math.max(0, Math.min(time, Number.isFinite(audio.duration) ? audio.duration : time));
    audio.currentTime = clamped;
    setCurrentTime(clamped);
  };

  const handleSkipBy = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    handleSeek((audio.currentTime || 0) + seconds);
  };

  const handleVolumeChange = (nextVolume: number) => {
    setVolume(nextVolume);
    if (nextVolume > 0 && muted) {
      setMuted(false);
    }
  };

  const handleBulkApply = () => {
    onApplyVoiceActorsToAll(bulkVoiceActorInput);
    setBulkVoiceActorInput('');
  };

  const handleBulkKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleBulkApply();
    }
  };

  const clearDragState = () => {
    setDraggedIndex(null);
    setDropTarget(null);
    onInternalDragChange(false);
  };

  const handleRowDragStart = (index: number, event: DragEvent) => {
    setDraggedIndex(index);
    onInternalDragChange(true);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(index));
    }
  };

  const handleRowDragOver = (index: number, event: DragEvent) => {
    if (draggedIndex === null) return;
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const position: 'above' | 'below' = event.clientY < rect.top + rect.height / 2 ? 'above' : 'below';
    setDropTarget((prev) => (
      prev?.index === index && prev.position === position ? prev : { index, position }
    ));
  };

  const handleRowDrop = (index: number, event: DragEvent) => {
    if (draggedIndex === null) return;
    event.preventDefault();

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const insertBelow = event.clientY >= rect.top + rect.height / 2;
    let targetIndex = insertBelow ? index + 1 : index;
    if (draggedIndex < targetIndex) {
      targetIndex -= 1;
    }

    if (targetIndex !== draggedIndex) {
      onReorderTrack(draggedIndex, targetIndex);
    }
    clearDragState();
  };

  const iconBtnClass = 'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-300 bg-white text-zinc-600 transition-colors hover:border-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-40';

  if (tracks.length === 0 && !isProcessing) {
    return (
      <div class="flex flex-1 items-center justify-center overflow-auto bg-gradient-to-b from-white to-zinc-50 p-8">
        <div class="w-full max-w-lg rounded-3xl border-2 border-dashed border-zinc-200 bg-white px-8 py-12 text-center transition-colors hover:border-blue-300">
          <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
            <FileAudio size={28} />
          </div>
          <h2 class="mt-4 text-lg font-bold text-zinc-900">{t.trackTable.emptyTitle}</h2>

          <div class="mt-6 flex flex-col justify-center gap-2.5 sm:flex-row">
            <button
              type="button"
              onClick={onPickAudioFiles}
              disabled={!isFfmpegReady}
              class="inline-flex min-w-40 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Upload size={17} />
              {t.wizard.step1.pickFiles}
            </button>
            <button
              type="button"
              onClick={onPickDirectories}
              disabled={!isFfmpegReady}
              class="inline-flex min-w-40 items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-800 shadow-xs transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FolderOpen size={17} />
              {t.wizard.step1.pickFolder}
            </button>
          </div>

          {!isFfmpegReady && (
            <p class="mt-4 text-xs font-medium text-blue-700">
              {t.wizard.step1.preparingAudio}
            </p>
          )}

          <div class="mt-6 flex flex-wrap items-center justify-center gap-1.5">
            {SUPPORTED_FORMATS.map((fmtName) => (
              <span
                key={fmtName}
                class="rounded-md bg-zinc-100 px-2 py-0.5 font-mono text-[11px] font-medium text-zinc-500"
              >
                {fmtName}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div class="flex min-h-0 flex-1 flex-col bg-white">
      {/* Compact single-row utility bar */}
      <div class="relative z-20 flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-zinc-200 bg-zinc-50/90 px-4 py-2">
        {/* Left: track count + total duration + quick add + duplicate badge */}
        <div class="flex items-center gap-1.5">
          <Tooltip text={fmt(t.wizard.step3.trackCount, { count: tracks.length })} align="left">
            <span class="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 text-xs font-semibold text-zinc-700">
              <FileAudio size={14} class="text-blue-600" />
              <span class="tabular-nums">{tracks.length}</span>
            </span>
          </Tooltip>

          {totalDurationLabel && (
            <Tooltip text={fmt(t.trackTable.totalDuration, { duration: totalDurationLabel })} align="left">
              <span class="inline-flex h-8 items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2 font-mono text-xs tabular-nums text-zinc-600">
                <Clock size={13} class="text-zinc-400" />
                <span>{totalDurationLabel}</span>
              </span>
            </Tooltip>
          )}

          {duplicateKeys.size > 0 && (
            <Tooltip text={t.trackTable.duplicateWarning} align="left" multiline>
              <span class="inline-flex h-8 items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2 text-xs font-semibold text-amber-800">
                <AlertTriangle size={14} class="shrink-0" />
                <span>{t.trackTable.duplicateBadge}</span>
              </span>
            </Tooltip>
          )}

          {simple && (
            <>
              <div class="mx-0.5 h-5 w-px bg-zinc-200" />
              <Tooltip text={t.wizard.step3.addFiles} align="left">
                <button
                  type="button"
                  onClick={onPickAudioFiles}
                  disabled={!isFfmpegReady || isProcessing}
                  class={iconBtnClass}
                  aria-label={t.wizard.step3.addFiles}
                >
                  <Upload size={15} />
                </button>
              </Tooltip>
              <Tooltip text={t.wizard.step3.addFolder}>
                <button
                  type="button"
                  onClick={onPickDirectories}
                  disabled={!isFfmpegReady || isProcessing}
                  class={iconBtnClass}
                  aria-label={t.wizard.step3.addFolder}
                >
                  <FolderPlus size={15} />
                </button>
              </Tooltip>
            </>
          )}
        </div>

        {/* Center/Right: bulk voice actor input + title format + numbering + undo/redo */}
        <div class="flex min-w-0 flex-1 items-center justify-end gap-1.5">
          <div class="flex min-w-[13rem] max-w-sm flex-1 items-center rounded-lg border border-zinc-300 bg-white pl-2.5 pr-1 transition-all focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20">
            <Users size={14} class="shrink-0 text-zinc-400" />
            <input
              type="text"
              value={bulkVoiceActorInput}
              onInput={(event) => setBulkVoiceActorInput(event.currentTarget.value)}
              onKeyDown={handleBulkKeyDown}
              placeholder={t.trackTable.bulkVoiceActorsPlaceholder}
              aria-label={t.trackTable.bulkVoiceActorsLabel}
              class="h-8 min-w-0 flex-1 bg-transparent px-2 text-xs text-zinc-800 outline-none placeholder:text-zinc-400"
            />
            <Tooltip text={t.trackTable.applyToAll} align="right">
              <button
                type="button"
                onClick={handleBulkApply}
                disabled={!bulkVoiceActorInput.trim()}
                class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-blue-600 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400"
                aria-label={t.trackTable.applyToAll}
              >
                <ArrowDownToLine size={13} />
              </button>
            </Tooltip>
          </div>

          {hasFirstTrackVoiceActors && (
            <Tooltip text={t.trackTable.copyFirstToAllTooltip} align="right" multiline>
              <button
                type="button"
                onClick={onCopyFirstTrackVoiceActorsToAll}
                class={iconBtnClass}
                aria-label={t.trackTable.copyFirstToAll}
              >
                <Copy size={14} />
              </button>
            </Tooltip>
          )}

          <div class="mx-0.5 h-5 w-px bg-zinc-200" />

          <TitleFormatPopover
            tracks={tracks}
            onBatchTransformTitles={onBatchTransformTitles}
          />

          <Tooltip text={t.trackTable.renumberTooltip} align="right" multiline>
            <button
              type="button"
              onClick={onRenumberTracks}
              disabled={tracks.length === 0}
              class={iconBtnClass}
              aria-label={t.trackTable.renumber}
            >
              <ListOrdered size={15} />
            </button>
          </Tooltip>

          {simple && (
            <Tooltip text={t.trackTable.sortByNumberTooltip} align="right">
              <button
                type="button"
                onClick={onSortTracks}
                disabled={tracks.length < 2}
                class={iconBtnClass}
                aria-label={t.trackTable.sortByNumber}
              >
                <ArrowUpDown size={15} />
              </button>
            </Tooltip>
          )}

          <div class="mx-0.5 h-5 w-px bg-zinc-200" />

          <Tooltip text={t.trackTable.undo} align="right">
            <button
              type="button"
              onClick={onUndo}
              disabled={!canUndo}
              class={iconBtnClass}
              aria-label={t.trackTable.undo}
            >
              <Undo2 size={14} />
            </button>
          </Tooltip>

          <Tooltip text={t.trackTable.redo} align="right">
            <button
              type="button"
              onClick={onRedo}
              disabled={!canRedo}
              class={iconBtnClass}
              aria-label={t.trackTable.redo}
            >
              <Redo2 size={14} />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Scrollable track list */}
      <div class="min-h-0 flex-1 overflow-auto">
        <table class="w-full min-w-[760px] table-fixed divide-y divide-zinc-200">
          <thead class="sticky top-0 z-10 bg-zinc-50 shadow-xs">
            <tr>
              <th class="w-11 px-1.5 py-2 text-center text-[11px] font-semibold text-zinc-400" aria-label={t.trackTable.colPlay}>
                <Play size={12} class="mx-auto" />
              </th>
              <th class="w-20 px-1 py-2 text-center text-[11px] font-semibold text-zinc-400" aria-label={t.trackTable.colOrder}>
                <ArrowUpDown size={12} class="mx-auto" />
              </th>
              <th class="w-11 px-1.5 py-2 text-center text-[11px] font-semibold text-zinc-400" aria-label={t.trackTable.colDelete}>
                <Trash2 size={12} class="mx-auto" />
              </th>
              <th class="w-16 px-1.5 py-2 text-center text-xs font-semibold text-zinc-500">
                {t.trackTable.colDisc}
              </th>
              <th class="w-20 px-1.5 py-2 text-center text-xs font-semibold text-zinc-500">
                {t.trackTable.colTrack}
              </th>
              <th class="w-[36%] px-3 py-2 text-left text-xs font-semibold text-zinc-500">
                {t.trackTable.colTitle}
              </th>
              <th class="px-3 py-2 text-left text-xs font-semibold text-zinc-500">
                <div class="inline-flex items-center gap-1">
                  <span>{t.trackTable.colVoiceActors}</span>
                  <InfoHint text={t.trackTable.artistInputHint} position="bottom" align="right" />
                </div>
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-zinc-100 bg-white">
            {tracks.map((track, index) => {
              const key = numberKey(track);
              const hasDuplicate = key ? duplicateKeys.has(key) : false;
              const canCopyFromAbove = index > 0 && tracks[index - 1].artists.length > 0;
              const isCurrentTrack = activeTrackId === track.id;
              const isTrackPlaying = isCurrentTrack && isPlaying;
              const previewFailed = previewErrorTrackId === track.id;
              const canPreview = Boolean(track.filePath) && !isProcessing;
              const displayTitle = track.title || t.trackTable.untitledTrack;
              const rowTipPos = index === tracks.length - 1 && tracks.length > 1 ? 'top' : 'bottom';
              const isDragged = draggedIndex === index;
              const dropIndicatorStyle = dropTarget?.index === index && draggedIndex !== index
                ? {
                  boxShadow: dropTarget.position === 'above'
                    ? 'inset 0 2px 0 0 #2563eb'
                    : 'inset 0 -2px 0 0 #2563eb',
                }
                : undefined;

              return (
                <tr
                  key={track.id}
                  onDragOver={(event) => handleRowDragOver(index, event)}
                  onDrop={(event) => handleRowDrop(index, event)}
                  style={dropIndicatorStyle}
                  class={`transition-colors ${
                    isDragged
                      ? 'opacity-40'
                      : hasDuplicate
                        ? 'bg-amber-50/70 hover:bg-amber-50'
                        : isCurrentTrack
                          ? 'bg-blue-50/40 hover:bg-blue-50/60'
                          : 'hover:bg-zinc-50/80'
                  }`}
                >
                  <td class="px-1.5 py-2 text-center align-top">
                    <Tooltip
                      text={
                        !track.filePath
                          ? t.trackTable.noPreviewFile
                          : isTrackPlaying
                            ? t.trackTable.stopPreview
                            : previewFailed
                              ? t.trackTable.previewFailedRetry
                              : t.trackTable.playPreview
                      }
                      align="left"
                      position={rowTipPos}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          void togglePreview(track);
                        }}
                        disabled={!canPreview}
                        class={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                          isTrackPlaying
                            ? 'bg-blue-600 text-white hover:bg-blue-700'
                            : isCurrentTrack
                              ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                              : previewFailed
                                ? 'text-red-500 hover:bg-red-50 hover:text-red-600'
                                : 'text-zinc-500 hover:bg-blue-50 hover:text-blue-600'
                        }`}
                        aria-label={
                          isTrackPlaying
                            ? fmt(t.trackTable.stopPreviewAria, { title: displayTitle })
                            : fmt(t.trackTable.playPreviewAria, { title: displayTitle })
                        }
                      >
                        {isTrackPlaying ? <Pause size={14} /> : <Play size={14} />}
                      </button>
                    </Tooltip>
                  </td>

                  <td class="px-1 py-2 text-center align-top">
                    <div class="inline-flex h-8 items-center gap-0.5">
                      <span
                        draggable={tracks.length > 1}
                        onDragStart={(event) => handleRowDragStart(index, event)}
                        onDragEnd={clearDragState}
                        title={t.trackTable.dragToReorder}
                        class={`inline-flex h-7 w-5 items-center justify-center rounded text-zinc-400 transition-colors ${
                          tracks.length > 1
                            ? 'cursor-grab hover:bg-zinc-100 hover:text-zinc-700 active:cursor-grabbing'
                            : 'cursor-default opacity-25'
                        }`}
                      >
                        <GripVertical size={13} />
                      </span>
                      <button
                        type="button"
                        onClick={() => onMoveTrack(track.id, 'up')}
                        disabled={index === 0}
                        class="inline-flex h-7 w-5 items-center justify-center rounded text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-25"
                        title={fmt(t.trackTable.moveUpAria, { title: displayTitle })}
                        aria-label={fmt(t.trackTable.moveUpAria, { title: displayTitle })}
                      >
                        <ArrowUp size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onMoveTrack(track.id, 'down')}
                        disabled={index === tracks.length - 1}
                        class="inline-flex h-7 w-5 items-center justify-center rounded text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-25"
                        title={fmt(t.trackTable.moveDownAria, { title: displayTitle })}
                        aria-label={fmt(t.trackTable.moveDownAria, { title: displayTitle })}
                      >
                        <ArrowDown size={12} />
                      </button>
                    </div>
                  </td>

                  <td class="px-1.5 py-2 text-center align-top">
                    <Tooltip text={t.trackTable.deleteTrackTooltip} position={rowTipPos}>
                      <button
                        type="button"
                        onClick={() => {
                          if (activeTrackId === track.id) {
                            stopPreview();
                          }
                          onTrackDelete(track.id);
                        }}
                        class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600"
                        aria-label={fmt(t.trackTable.deleteTrackAria, { title: displayTitle })}
                      >
                        <Trash2 size={15} />
                      </button>
                    </Tooltip>
                  </td>

                  <td class="px-1.5 py-2 align-top">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={track.diskNumber}
                      onInput={(event) => {
                        onTrackChange(track.id, 'diskNumber', onNumberInput(event.currentTarget.value));
                      }}
                      onBlur={(event) => {
                        onTrackChange(track.id, 'diskNumber', onPadNumber(event.currentTarget.value));
                      }}
                      placeholder="1"
                      aria-label={fmt(t.trackTable.discNumberAria, { title: displayTitle })}
                      class={`h-8 w-full rounded-lg border px-1.5 text-center text-sm tabular-nums transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                        hasDuplicate ? 'border-amber-400 bg-white focus:border-amber-500' : 'border-zinc-300 focus:border-blue-500'
                      }`}
                    />
                  </td>

                  <td class="px-1.5 py-2 align-top">
                    <div class="relative">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={track.trackNumber}
                        onInput={(event) => {
                          onTrackChange(track.id, 'trackNumber', onNumberInput(event.currentTarget.value));
                        }}
                        onBlur={(event) => {
                          onTrackChange(track.id, 'trackNumber', onPadNumber(event.currentTarget.value));
                        }}
                        placeholder="1"
                        aria-label={fmt(t.trackTable.trackNumberAria, { title: displayTitle })}
                        class={`h-8 w-full rounded-lg border px-1.5 text-center text-sm tabular-nums transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                          hasDuplicate ? 'border-amber-400 bg-white pr-5 focus:border-amber-500' : 'border-zinc-300 focus:border-blue-500'
                        }`}
                      />
                      {hasDuplicate && (
                        <span
                          class="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-amber-600"
                          title={t.trackTable.duplicateBadge}
                        >
                          <AlertTriangle size={12} />
                        </span>
                      )}
                    </div>
                  </td>

                  <td class="px-3 py-2 align-top">
                    <div class="flex items-start gap-2">
                      <textarea
                        value={track.title}
                        onInput={(event) => {
                          onTrackChange(track.id, 'title', event.currentTarget.value);
                          event.currentTarget.style.height = 'auto';
                          event.currentTarget.style.height = `${event.currentTarget.scrollHeight}px`;
                        }}
                        ref={(el) => {
                          if (el) {
                            el.style.height = 'auto';
                            el.style.height = `${el.scrollHeight}px`;
                          }
                        }}
                        aria-label={t.trackTable.titleAria}
                        class="min-h-8 min-w-0 flex-1 resize-none overflow-hidden rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm leading-5 transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        rows={1}
                      />
                      {track.duration && (
                        <span class="shrink-0 pt-2 font-mono text-[11px] tabular-nums text-zinc-400">
                          {track.duration}
                        </span>
                      )}
                    </div>
                  </td>

                  <td class="px-3 py-2 align-top">
                    <div class="flex items-start gap-1.5">
                      <div class="flex min-h-8 flex-1 flex-wrap items-center gap-1 rounded-lg border border-zinc-300 bg-white px-2 py-1 transition-all focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20">
                        {track.artists.map((artist, artistIndex) => {
                          const chipColor = getChipColor(artist);
                          return (
                            <div
                              key={`${artist}-${artistIndex}`}
                              class="inline-flex max-w-full cursor-pointer items-center rounded-full border border-black/5 py-0.5 pl-2 pr-1 text-xs font-medium shadow-xs transition-opacity hover:opacity-80"
                              style={{ backgroundColor: chipColor.backgroundColor, color: chipColor.color }}
                              onClick={() => onCopyArtist(artist)}
                              title={fmt(t.trackTable.clickToCopyArtist, { artist })}
                            >
                              <span class="break-words leading-tight">{artist}</span>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  onRemoveArtist(track.id, artist);
                                }}
                                class="ml-1 rounded-full p-0.5 hover:bg-black/10"
                                aria-label={fmt(t.trackTable.removeArtistAria, { artist })}
                              >
                                <X size={11} />
                              </button>
                            </div>
                          );
                        })}

                        <input
                          type="text"
                          value={track.currentArtistInput}
                          onInput={(event) => onArtistInput(track.id, event.currentTarget.value)}
                          onPaste={(event) => onArtistPaste(track.id, event)}
                          onKeyDown={(event) => onArtistKeyDown(track.id, event)}
                          placeholder={
                            track.artists.length === 0
                              ? t.trackTable.artistPlaceholderEmpty
                              : t.trackTable.artistPlaceholderMore
                          }
                          class="min-w-[110px] flex-1 bg-transparent text-xs outline-none placeholder:text-zinc-400"
                        />
                      </div>

                      {canCopyFromAbove && (
                        <Tooltip text={t.trackTable.sameAsAboveLong} align="right" position={rowTipPos}>
                          <button
                            type="button"
                            onClick={() => onCopyVoiceActorsFromPrevious(track.id)}
                            class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-500 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600"
                            aria-label={t.trackTable.sameAsAboveLong}
                          >
                            <CornerLeftUp size={14} />
                          </button>
                        </Tooltip>
                      )}

                      {track.artists.length > 0 && (
                        <Tooltip text={t.trackTable.copyAllArtistsTooltip} align="right" position={rowTipPos}>
                          <button
                            type="button"
                            onClick={() => onCopyAllArtists(track.artists)}
                            class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-500 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600"
                            aria-label={t.trackTable.copyAllArtistsTooltip}
                          >
                            <Clipboard size={14} />
                          </button>
                        </Tooltip>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Bottom mini player bar */}
      {activeTrack && (
        <AudioPreviewBar
          track={activeTrack}
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          volume={volume}
          muted={muted}
          hasPrevious={Boolean(previousPlayableTrack)}
          hasNext={Boolean(nextPlayableTrack)}
          onTogglePlay={() => {
            void togglePreview(activeTrack);
          }}
          onPrevious={() => {
            if (previousPlayableTrack) {
              void startPlayingTrack(previousPlayableTrack);
            }
          }}
          onNext={() => {
            if (nextPlayableTrack) {
              void startPlayingTrack(nextPlayableTrack);
            }
          }}
          onSeek={handleSeek}
          onSkipBy={handleSkipBy}
          onVolumeChange={handleVolumeChange}
          onToggleMute={() => setMuted((prev) => !prev)}
          onClose={stopPreview}
        />
      )}
    </div>
  );
}
