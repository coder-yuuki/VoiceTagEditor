import {
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  X,
} from 'lucide-preact';
import { useI18n } from '../i18n';
import type { Track } from '../types';

interface AudioPreviewBarProps {
  track: Track;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  hasPrevious: boolean;
  hasNext: boolean;
  onTogglePlay: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onSeek: (time: number) => void;
  onSkipBy: (seconds: number) => void;
  onVolumeChange: (volume: number) => void;
  onToggleMute: () => void;
  onClose: () => void;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '0:00';
  }
  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

export function AudioPreviewBar({
  track,
  isPlaying,
  currentTime,
  duration,
  volume,
  muted,
  hasPrevious,
  hasNext,
  onTogglePlay,
  onPrevious,
  onNext,
  onSeek,
  onSkipBy,
  onVolumeChange,
  onToggleMute,
  onClose,
}: AudioPreviewBarProps) {
  const { t } = useI18n();
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const safeTime = Math.min(Math.max(0, currentTime), safeDuration || currentTime);
  const trackLabel = [track.diskNumber || '1', track.trackNumber || '1']
    .map((v) => v.padStart(2, '0'))
    .join('-');

  return (
    <div class="shrink-0 border-t border-zinc-200 bg-zinc-50/95 px-4 py-2.5 backdrop-blur-sm">
      <div class="flex flex-wrap items-center gap-3">
        {/* Track info */}
        <div class="flex min-w-0 flex-1 items-center gap-2.5 sm:max-w-[260px]">
          <span class={`inline-flex h-2 w-2 shrink-0 rounded-full ${isPlaying ? 'animate-pulse bg-blue-600' : 'bg-zinc-400'}`} />
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5">
              <span class="shrink-0 rounded bg-zinc-200/80 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-zinc-700">
                {trackLabel}
              </span>
              <span class="truncate text-xs font-semibold text-zinc-900" title={track.title || t.trackTable.untitledTrack}>
                {track.title || t.trackTable.untitledTrack}
              </span>
            </div>
            <div class="truncate text-[11px] text-zinc-500">
              {isPlaying ? t.player.nowPlaying : t.player.paused}
            </div>
          </div>
        </div>

        {/* Transport controls */}
        <div class="flex items-center gap-1">
          <button
            type="button"
            onClick={onPrevious}
            disabled={!hasPrevious}
            class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-600 transition-colors hover:bg-zinc-200/70 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-35"
            title={t.player.previousTrack}
            aria-label={t.player.previousTrack}
          >
            <SkipBack size={15} />
          </button>
          <button
            type="button"
            onClick={() => onSkipBy(-10)}
            disabled={safeDuration <= 0}
            class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-600 transition-colors hover:bg-zinc-200/70 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-35"
            title={t.player.rewind10}
            aria-label={t.player.rewind10}
          >
            <RotateCcw size={14} />
          </button>
          <button
            type="button"
            onClick={onTogglePlay}
            class="inline-flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm transition-colors hover:bg-blue-700"
            title={isPlaying ? t.player.pause : t.player.play}
            aria-label={isPlaying ? t.player.pause : t.player.play}
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} class="ml-0.5" />}
          </button>
          <button
            type="button"
            onClick={() => onSkipBy(10)}
            disabled={safeDuration <= 0}
            class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-600 transition-colors hover:bg-zinc-200/70 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-35"
            title={t.player.forward10}
            aria-label={t.player.forward10}
          >
            <RotateCw size={14} />
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={!hasNext}
            class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-600 transition-colors hover:bg-zinc-200/70 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-35"
            title={t.player.nextTrack}
            aria-label={t.player.nextTrack}
          >
            <SkipForward size={15} />
          </button>
        </div>

        {/* Seek bar */}
        <div class="flex min-w-[180px] flex-1 items-center gap-2.5">
          <span class="w-11 shrink-0 text-right font-mono text-[11px] tabular-nums text-zinc-500">
            {formatTime(safeTime)}
          </span>
          <input
            type="range"
            min={0}
            max={safeDuration || 100}
            step={0.1}
            value={safeDuration > 0 ? safeTime : 0}
            disabled={safeDuration <= 0}
            onInput={(event) => onSeek(Number(event.currentTarget.value))}
            aria-label={t.player.seek}
            class="h-1.5 flex-1 cursor-pointer accent-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
          />
          <span class="w-11 shrink-0 font-mono text-[11px] tabular-nums text-zinc-500">
            {formatTime(safeDuration)}
          </span>
        </div>

        {/* Volume & close */}
        <div class="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onToggleMute}
            class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-600 transition-colors hover:bg-zinc-200/70 hover:text-zinc-900"
            title={muted || volume === 0 ? t.player.unmute : t.player.mute}
            aria-label={muted || volume === 0 ? t.player.unmute : t.player.mute}
          >
            {muted || volume === 0 ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={muted ? 0 : volume}
            onInput={(event) => onVolumeChange(Number(event.currentTarget.value))}
            aria-label={t.player.volume}
            class="hidden h-1.5 w-20 cursor-pointer accent-blue-600 md:block"
          />
          <button
            type="button"
            onClick={onClose}
            class="ml-1 inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-200/70 hover:text-zinc-700"
            title={t.player.closePlayer}
            aria-label={t.player.closePlayer}
          >
            <X size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
