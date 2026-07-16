import { Calendar, Image as ImageIcon, X } from 'lucide-preact';
import type { AlbumData, ChipColor } from '../types';

interface SidebarProps {
  albumData: AlbumData;
  artworkSourceLabel: string;
  getChipColor: (text: string) => ChipColor;
  onSelectArtwork: () => void;
  onClearArtwork: () => void;
  onAlbumFieldChange: (field: keyof AlbumData, value: string | boolean | string[]) => void;
  onTagInput: (value: string) => void;
  onTagKeyDown: (event: KeyboardEvent) => void;
  onRemoveTag: (tag: string) => void;
  sanitizeDateInput: (value: string) => string;
}

export function Sidebar({
  albumData,
  artworkSourceLabel,
  getChipColor,
  onSelectArtwork,
  onClearArtwork,
  onAlbumFieldChange,
  onTagInput,
  onTagKeyDown,
  onRemoveTag,
  sanitizeDateInput,
}: SidebarProps) {
  return (
    <div class="w-80 bg-zinc-50 p-4 flex flex-col gap-4 border-r border-zinc-200 shrink-0">
      <div
        class="w-full aspect-square bg-white border-2 border-dashed border-zinc-300 rounded-xl flex items-center justify-center cursor-pointer hover:border-zinc-400 transition-colors group relative overflow-hidden"
      >
        {albumData.albumArtwork ? (
          <img src={albumData.albumArtwork} alt="Album Artwork" class="w-full h-full object-contain" />
        ) : (
          <div class="text-center text-zinc-400 flex flex-col items-center gap-2">
            <ImageIcon size={48} class="text-zinc-300 group-hover:text-zinc-400 transition-colors" />
            <div class="text-sm font-medium">アルバムアートワーク</div>
            <div class="text-xs opacity-70">画像をドロップ</div>
          </div>
        )}
      </div>
      <div class="flex items-center justify-between gap-3">
        <div class="text-xs text-zinc-500 flex items-center gap-2">
          {albumData.albumArtwork && (
            <span class="px-2 py-1 rounded-full bg-zinc-100 text-zinc-600 border border-zinc-200">
              {artworkSourceLabel || 'アートワーク設定済み'}
            </span>
          )}
        </div>
        <div class="flex items-center gap-2">
          <button
            onClick={onSelectArtwork}
            class="px-2.5 py-1 border border-zinc-300 rounded-md text-xs text-zinc-700 bg-white hover:bg-zinc-50 hover:border-zinc-400 transition-colors inline-flex items-center gap-1.5"
          >
            <ImageIcon size={14} />
            <span>画像を選択</span>
          </button>
          <button
            onClick={onClearArtwork}
            disabled={!albumData.albumArtwork}
            class="px-2.5 py-1 border border-zinc-300 rounded-md text-xs text-zinc-600 bg-white hover:bg-zinc-50 hover:border-zinc-400 transition-colors inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X size={12} />
            <span>クリア</span>
          </button>
        </div>
      </div>

      <div class="flex flex-col gap-3">
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-semibold text-zinc-500 uppercase tracking-wider ml-0.5">アルバムタイトル</label>
          <input
            type="text"
            value={albumData.albumTitle}
            onInput={(event) => onAlbumFieldChange('albumTitle', event.currentTarget.value)}
            placeholder="アルバムタイトル"
            class="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder-zinc-400"
          />
        </div>

        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-semibold text-zinc-500 uppercase tracking-wider ml-0.5">アルバムアーティスト</label>
          <input
            type="text"
            value={albumData.albumArtist}
            onInput={(event) => onAlbumFieldChange('albumArtist', event.currentTarget.value)}
            placeholder="アルバムアーティスト"
            class="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder-zinc-400"
          />
        </div>

        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-semibold text-zinc-500 uppercase tracking-wider ml-0.5">リリース日</label>
          <div class="relative">
            <input
              type="text"
              value={albumData.releaseDate}
              onInput={(event) => onAlbumFieldChange('releaseDate', sanitizeDateInput(event.currentTarget.value))}
              placeholder="YYYY-MM-DD"
              class="w-full pl-9 pr-3 py-2 border border-zinc-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder-zinc-400"
            />
            <Calendar size={14} class="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          </div>
        </div>

        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-semibold text-zinc-500 uppercase tracking-wider ml-0.5">タグ</label>
          <div class="min-h-[2.5rem] px-2 py-1.5 border border-zinc-300 rounded-md text-sm bg-white focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all flex flex-wrap gap-1.5 items-center">
            {albumData.tags.map((tag, index) => {
              const chipColor = getChipColor(tag);
              return (
                <div
                  key={`${tag}-${index}`}
                  class="inline-flex items-center pl-2 pr-1 py-0.5 rounded-full text-xs font-medium border border-black/5 shadow-sm"
                  style={{ backgroundColor: chipColor.backgroundColor, color: chipColor.color }}
                >
                  <span>{tag}</span>
                  <button
                    onClick={() => onRemoveTag(tag)}
                    class="ml-1 p-0.5 hover:bg-black/10 rounded-full transition-colors"
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
              placeholder={albumData.tags.length === 0 ? 'タグを追加...' : ''}
              class="flex-1 min-w-[80px] outline-none bg-transparent text-sm placeholder-zinc-400"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
