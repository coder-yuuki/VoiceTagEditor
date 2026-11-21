import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { ArrowRight, Hash, Replace, Space, Wand2 } from 'lucide-preact';
import { useI18n } from '../i18n';
import type { Track } from '../types';
import {
  normalizeTitleWhitespace,
  replaceInTitle,
  stripLeadingTrackNumber,
} from '../utils/titleFormat';
import { Tooltip } from './Tooltip';

interface TitleFormatPopoverProps {
  tracks: Track[];
  onBatchTransformTitles: (transform: (title: string) => string) => void;
}

export function TitleFormatPopover({
  tracks,
  onBatchTransformTitles,
}: TitleFormatPopoverProps) {
  const { t, fmt } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (containerRef.current && target && !containerRef.current.contains(target)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const stripPreview = useMemo(() => {
    let count = 0;
    let sample: { before: string; after: string } | null = null;
    for (const track of tracks) {
      const next = stripLeadingTrackNumber(track.title);
      if (next !== track.title) {
        count++;
        if (!sample) sample = { before: track.title, after: next };
      }
    }
    return { count, sample };
  }, [tracks]);

  const whitespacePreview = useMemo(() => {
    let count = 0;
    for (const track of tracks) {
      if (normalizeTitleWhitespace(track.title) !== track.title) {
        count++;
      }
    }
    return { count };
  }, [tracks]);

  const replacePreview = useMemo(() => {
    if (!findText) {
      return { count: 0, sample: null as { before: string; after: string } | null };
    }
    let count = 0;
    let sample: { before: string; after: string } | null = null;
    for (const track of tracks) {
      const next = replaceInTitle(track.title, findText, replaceText);
      if (next !== track.title) {
        count++;
        if (!sample) sample = { before: track.title, after: next };
      }
    }
    return { count, sample };
  }, [tracks, findText, replaceText]);

  const handleApplyReplace = () => {
    if (!findText || replacePreview.count === 0) return;
    onBatchTransformTitles((title) => replaceInTitle(title, findText, replaceText));
    setFindText('');
    setReplaceText('');
    setIsOpen(false);
  };

  return (
    <div class="relative" ref={containerRef}>
      <Tooltip text={t.trackTable.titleTools} align="right">
        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          disabled={tracks.length === 0}
          class={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
            isOpen
              ? 'border-blue-500 bg-blue-50 text-blue-700'
              : 'border-zinc-300 bg-white text-zinc-600 hover:border-zinc-400 hover:bg-zinc-100 hover:text-zinc-900'
          }`}
          aria-expanded={isOpen}
          aria-label={t.trackTable.titleTools}
        >
          <Wand2 size={15} />
        </button>
      </Tooltip>

      {isOpen && (
        <div class="absolute right-0 top-10 z-50 w-80 rounded-2xl border border-zinc-200 bg-white p-3.5 shadow-xl">
          <div class="space-y-1.5">
            <button
              type="button"
              disabled={stripPreview.count === 0}
              onClick={() => {
                onBatchTransformTitles(stripLeadingTrackNumber);
                setIsOpen(false);
              }}
              class="flex w-full items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-zinc-50/70 px-3 py-2 text-left text-xs font-medium text-zinc-700 transition-colors hover:border-blue-300 hover:bg-blue-50/60 hover:text-blue-800 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <span class="flex items-center gap-2">
                <Hash size={14} class="shrink-0 text-blue-600" />
                <span>{t.trackTable.stripLeadingNumbers}</span>
              </span>
              <span class="shrink-0 rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold tabular-nums text-zinc-600 shadow-2xs">
                {stripPreview.count > 0
                  ? fmt(t.trackTable.matchCount, { count: stripPreview.count })
                  : t.trackTable.noChanges}
              </span>
            </button>

            {stripPreview.sample && (
              <div class="flex items-center gap-1.5 px-2 text-[11px] text-zinc-500">
                <span class="max-w-[44%] truncate line-through decoration-zinc-300">
                  {stripPreview.sample.before}
                </span>
                <ArrowRight size={11} class="shrink-0 text-zinc-400" />
                <span class="min-w-0 flex-1 truncate font-medium text-zinc-700">
                  {stripPreview.sample.after}
                </span>
              </div>
            )}

            <button
              type="button"
              disabled={whitespacePreview.count === 0}
              onClick={() => {
                onBatchTransformTitles(normalizeTitleWhitespace);
                setIsOpen(false);
              }}
              class="flex w-full items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-zinc-50/70 px-3 py-2 text-left text-xs font-medium text-zinc-700 transition-colors hover:border-blue-300 hover:bg-blue-50/60 hover:text-blue-800 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <span class="flex items-center gap-2">
                <Space size={14} class="shrink-0 text-blue-600" />
                <span>{t.trackTable.cleanWhitespace}</span>
              </span>
              <span class="shrink-0 rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold tabular-nums text-zinc-600 shadow-2xs">
                {whitespacePreview.count > 0
                  ? fmt(t.trackTable.matchCount, { count: whitespacePreview.count })
                  : t.trackTable.noChanges}
              </span>
            </button>
          </div>

          <div class="my-3 border-t border-zinc-100" />

          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <span class="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                <Replace size={12} />
                {t.trackTable.replaceTitleSection}
              </span>
              {findText && (
                <span class={`text-[11px] font-medium tabular-nums ${replacePreview.count > 0 ? 'text-blue-600' : 'text-zinc-400'}`}>
                  {replacePreview.count > 0
                    ? fmt(t.trackTable.matchCount, { count: replacePreview.count })
                    : t.trackTable.noChanges}
                </span>
              )}
            </div>

            <input
              type="text"
              value={findText}
              onInput={(event) => setFindText(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleApplyReplace();
                }
              }}
              placeholder={t.trackTable.findPlaceholder}
              class="w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <div class="flex gap-1.5">
              <input
                type="text"
                value={replaceText}
                onInput={(event) => setReplaceText(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    handleApplyReplace();
                  }
                }}
                placeholder={t.trackTable.replacePlaceholder}
                class="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <button
                type="button"
                onClick={handleApplyReplace}
                disabled={!findText || replacePreview.count === 0}
                class="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {t.trackTable.applyReplace}
              </button>
            </div>

            {replacePreview.sample && (
              <div class="flex items-center gap-1.5 rounded-lg bg-zinc-50 px-2.5 py-1.5 text-[11px] text-zinc-500">
                <span class="max-w-[44%] truncate line-through decoration-zinc-300">
                  {replacePreview.sample.before}
                </span>
                <ArrowRight size={11} class="shrink-0 text-zinc-400" />
                <span class="min-w-0 flex-1 truncate font-medium text-zinc-800">
                  {replacePreview.sample.after}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
