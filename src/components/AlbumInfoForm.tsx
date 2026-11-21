import { Image as ImageIcon, X } from 'lucide-preact';
import { useI18n } from '../i18n';
import type { AlbumData, AppMode, ChipColor } from '../types';
import { InfoHint, Tooltip } from './Tooltip';

interface AlbumInfoFormProps {
  mode: AppMode;
  albumData: AlbumData;
  artworkSourceLabel: string;
  getChipColor: (text: string) => ChipColor;
  onSelectArtwork: () => void;
  onClearArtwork: () => void;
  onAlbumFieldChange: (field: keyof AlbumData, value: string | boolean | string[]) => void;
  onTagInput: (value: string) => void;
  onTagKeyDown: (event: KeyboardEvent) => void;
  onRemoveTag: (tag: string) => void;
  artworkClassName?: string;
  compactLayout?: boolean;
}

export function AlbumInfoForm({
  mode,
  albumData,
  artworkSourceLabel,
  getChipColor,
  onSelectArtwork,
  onClearArtwork,
  onAlbumFieldChange,
  onTagInput,
  onTagKeyDown,
  onRemoveTag,
  artworkClassName = 'w-full',
  compactLayout = false,
}: AlbumInfoFormProps) {
  const { t, fmt } = useI18n();
  const simple = mode === 'simple';
  const labelClass = simple
    ? 'text-xs font-semibold text-zinc-700'
    : 'text-[11px] font-semibold uppercase tracking-wider text-zinc-500';

  const artworkBlock = (
    <div class="flex flex-col gap-2">
      <Tooltip text={`${t.albumForm.dropOrClickLine1} ${t.albumForm.dropOrClickLine2}`} position="bottom">
        <button
          type="button"
          onClick={onSelectArtwork}
          class={`group relative flex aspect-square ${compactLayout ? 'w-44' : artworkClassName} cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-zinc-300 bg-white transition-colors hover:border-blue-400 hover:bg-blue-50/30 focus:outline-none focus:ring-2 focus:ring-blue-500/30`}
          aria-label={t.albumForm.selectCoverAria}
        >
          {albumData.albumArtwork ? (
            <>
              <img src={albumData.albumArtwork} alt={t.albumForm.coverAlt} class="h-full w-full object-contain" />
              <span class="absolute inset-x-0 bottom-0 bg-black/60 px-3 py-1.5 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                {t.albumForm.changeCover}
              </span>
            </>
          ) : (
            <div class="flex flex-col items-center gap-2 px-3 text-center text-zinc-400">
              <ImageIcon size={compactLayout ? 34 : 40} class="text-zinc-300 transition-colors group-hover:text-blue-400" />
              <div class="text-xs font-semibold text-zinc-500">{t.albumForm.addCover}</div>
            </div>
          )}
        </button>
      </Tooltip>

      {albumData.albumArtwork && (
        <div class="flex items-center justify-between gap-2">
          <span class="min-w-0 truncate rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[11px] text-zinc-500">
            {artworkSourceLabel || t.albumForm.coverSet}
          </span>
          <Tooltip text={t.albumForm.removeCover} position="top" align="right">
            <button
              type="button"
              onClick={onClearArtwork}
              class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-200 hover:text-zinc-700"
              aria-label={t.albumForm.removeCover}
            >
              <X size={13} />
            </button>
          </Tooltip>
        </div>
      )}
    </div>
  );

  const fieldsBlock = (
    <div class="flex flex-col gap-3.5">
      <div class="flex flex-col gap-1">
        <div class="flex items-center gap-1.5">
          <label class={labelClass}>{t.albumForm.workTitleLabel}</label>
          <InfoHint text={t.albumForm.workTitleHint} />
        </div>
        <input
          type="text"
          value={albumData.albumTitle}
          onInput={(event) => onAlbumFieldChange('albumTitle', event.currentTarget.value)}
          placeholder={t.albumForm.workTitlePlaceholder}
          class="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm transition-all placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
      </div>

      <div class="flex flex-col gap-1">
        <div class="flex items-center gap-1.5">
          <label class={labelClass}>{t.albumForm.circleLabel}</label>
          <InfoHint text={t.albumForm.circleHint} />
        </div>
        <input
          type="text"
          value={albumData.albumArtist}
          onInput={(event) => onAlbumFieldChange('albumArtist', event.currentTarget.value)}
          placeholder={t.albumForm.circlePlaceholder}
          class="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm transition-all placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
      </div>

      <div class="flex flex-col gap-1">
        <div class="flex items-center gap-1.5">
          <label class={labelClass}>
            {simple ? t.albumForm.releaseDateSimple : t.albumForm.releaseDateAdvanced}
          </label>
          <InfoHint text={t.albumForm.releaseDateHint} />
        </div>
        <input
          type="date"
          value={albumData.releaseDate}
          onInput={(event) => onAlbumFieldChange('releaseDate', event.currentTarget.value)}
          class="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
      </div>

      <div class="flex flex-col gap-1">
        <div class="flex items-center gap-1.5">
          <label class={labelClass}>{t.albumForm.tagsAdvanced}</label>
          <InfoHint text={t.albumForm.tagsHint} />
        </div>
        <div class="flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 transition-all focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20">
          {albumData.tags.map((tag, index) => {
            const chipColor = getChipColor(tag);
            return (
              <div
                key={`${tag}-${index}`}
                class="inline-flex items-center rounded-full border border-black/5 py-0.5 pl-2 pr-1 text-xs font-medium shadow-xs"
                style={{ backgroundColor: chipColor.backgroundColor, color: chipColor.color }}
              >
                <span>{tag}</span>
                <button
                  type="button"
                  onClick={() => onRemoveTag(tag)}
                  class="ml-1 rounded-full p-0.5 hover:bg-black/10"
                  aria-label={fmt(t.albumForm.removeTagAria, { tag })}
                >
                  <X size={12} />
                </button>
              </div>
            );
          })}

          <input
            type="text"
            value={albumData.currentTagInput}
            onInput={(event) => onTagInput(event.currentTarget.value)}
            onKeyDown={(event) => onTagKeyDown(event)}
            placeholder={
              albumData.tags.length === 0
                ? t.albumForm.tagsPlaceholderEmpty
                : t.albumForm.tagsPlaceholderMore
            }
            class="min-w-[110px] flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-400"
          />
        </div>
      </div>
    </div>
  );

  if (compactLayout) {
    return (
      <div class="grid grid-cols-1 items-start gap-7 sm:grid-cols-[11rem_minmax(0,1fr)]">
        {artworkBlock}
        {fieldsBlock}
      </div>
    );
  }

  return (
    <div class="flex flex-col gap-3.5">
      {artworkBlock}
      {fieldsBlock}
    </div>
  );
}
