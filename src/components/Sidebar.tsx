import { useI18n } from '../i18n';
import type { AlbumData, AppMode, ChipColor } from '../types';
import { AlbumInfoForm } from './AlbumInfoForm';
import { InfoHint } from './Tooltip';

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
  const { t } = useI18n();

  return (
    <aside class="flex w-72 shrink-0 flex-col gap-3.5 overflow-y-auto border-r border-zinc-200 bg-zinc-50 p-4">
      <div class="flex items-center gap-1.5">
        <h2 class="text-xs font-bold uppercase tracking-wider text-zinc-600">{t.sidebar.title}</h2>
        <InfoHint text={t.sidebar.simpleDescription} position="bottom" align="left" />
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
