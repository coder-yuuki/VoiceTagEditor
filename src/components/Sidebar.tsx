import type { AlbumData, AppMode, ChipColor } from '../types';
import { AlbumInfoForm } from './AlbumInfoForm';

interface SidebarProps {
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
}

export function Sidebar({
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
}: SidebarProps) {
  const simple = mode === 'simple';

  return (
    <aside class={`${simple ? 'w-[340px]' : 'w-80'} flex shrink-0 flex-col gap-4 overflow-y-auto border-r border-zinc-200 bg-zinc-50 p-4`}>
      <div>
        <h2 class="text-sm font-bold text-zinc-900">音声作品の情報</h2>
        {simple && (
          <p class="mt-1 text-xs leading-5 text-zinc-500">
            読み込んだ音声すべてに共通する情報です。分かるところだけ入力すれば大丈夫です。
          </p>
        )}
      </div>

      <AlbumInfoForm
        mode={mode}
        albumData={albumData}
        artworkSourceLabel={artworkSourceLabel}
        getChipColor={getChipColor}
        onSelectArtwork={onSelectArtwork}
        onClearArtwork={onClearArtwork}
        onAlbumFieldChange={onAlbumFieldChange}
        onTagInput={onTagInput}
        onTagKeyDown={onTagKeyDown}
        onRemoveTag={onRemoveTag}
      />
    </aside>
  );
}
