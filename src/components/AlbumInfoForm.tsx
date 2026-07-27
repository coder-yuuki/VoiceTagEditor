import { Image as ImageIcon, X } from 'lucide-preact';
import type { AlbumData, AppMode, ChipColor } from '../types';

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
  /** ウィザード用: 各欄に補足説明を表示 */
  showFieldHints?: boolean;
  /** カバー画像の最大幅 (デフォルト: w-full) */
  artworkClassName?: string;
  /** ウィザード用: カバー画像を左に小さく配置 */
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
  showFieldHints = false,
  artworkClassName = 'w-full',
  compactLayout = false,
}: AlbumInfoFormProps) {
  const simple = mode === 'simple';
  const labelClass = simple
    ? 'text-sm font-semibold text-zinc-800'
    : 'text-xs font-semibold uppercase tracking-wider text-zinc-500';
  const hintClass = 'text-xs leading-5 text-zinc-500';

  const artworkBlock = (
    <div class="flex flex-col gap-2">
      <button
        type="button"
        onClick={onSelectArtwork}
        class={`group relative flex aspect-square ${compactLayout ? 'w-full max-w-[11rem]' : artworkClassName} cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-zinc-300 bg-white transition-colors hover:border-blue-400 hover:bg-blue-50/30 focus:outline-none focus:ring-2 focus:ring-blue-500/30`}
        aria-label="カバー画像を選択"
      >
        {albumData.albumArtwork ? (
          <>
            <img src={albumData.albumArtwork} alt="カバー画像" class="h-full w-full object-contain" />
            <span class="absolute inset-x-0 bottom-0 bg-black/60 px-3 py-2 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
              クリックして画像を変更
            </span>
          </>
        ) : (
          <div class="flex flex-col items-center gap-2 px-4 text-center text-zinc-500">
            <ImageIcon size={compactLayout ? 32 : 48} class="text-zinc-300 transition-colors group-hover:text-blue-400" />
            <div class="text-sm font-semibold">カバー画像を追加</div>
            {!compactLayout && (
              <div class="text-xs leading-5 text-zinc-400">
                画像をここにドロップ
                <br />
                またはクリックして選択
              </div>
            )}
          </div>
        )}
      </button>

      <div class="flex min-h-7 items-center justify-between gap-3">
        <div class="min-w-0 text-xs text-zinc-500">
          {albumData.albumArtwork && (
            <span class="inline-block max-w-full truncate rounded-full border border-zinc-200 bg-white px-2 py-1">
              {artworkSourceLabel || '画像を設定済み'}
            </span>
          )}
        </div>
        {albumData.albumArtwork && (
          <button
            type="button"
            onClick={onClearArtwork}
            class="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-200"
          >
            <X size={12} />
            画像を外す
          </button>
        )}
      </div>
    </div>
  );

  const fieldsBlock = (
    <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-1.5">
          <label class={labelClass}>音声作品名</label>
          {showFieldHints && (
            <p class={hintClass}>音声作品の名前です。保存時にフォルダ名にも使われます。</p>
          )}
          <input
            type="text"
            value={albumData.albumTitle}
            onInput={(event) => onAlbumFieldChange('albumTitle', event.currentTarget.value)}
            placeholder="例：ボイスドラマ作品名"
            class="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm transition-all placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        <div class="flex flex-col gap-1.5">
          <label class={labelClass}>サークル名</label>
          {showFieldHints && (
            <p class={hintClass}>作品を制作したサークル名や制作者名です。</p>
          )}
          <input
            type="text"
            value={albumData.albumArtist}
            onInput={(event) => onAlbumFieldChange('albumArtist', event.currentTarget.value)}
            placeholder="例：サークル名"
            class="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm transition-all placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        <div class="flex flex-col gap-1.5">
          <label class={labelClass}>{simple ? '発売日' : 'リリース日'}</label>
          {showFieldHints && (
            <p class={hintClass}>分かる場合だけ入力してください。空欄でも保存できます。</p>
          )}
          <input
            type="date"
            value={albumData.releaseDate}
            onInput={(event) => onAlbumFieldChange('releaseDate', event.currentTarget.value)}
            class="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        <div class="flex flex-col gap-1.5">
          <label class={labelClass}>{simple ? 'タグ（ジャンルなど）' : 'タグ'}</label>
          {showFieldHints && (
            <p class={hintClass}>ジャンルやキーワードを追加できます。Enterで追加、カンマで複数登録できます。</p>
          )}
          <div class="flex min-h-11 flex-wrap items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 transition-all focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20">
            {albumData.tags.map((tag, index) => {
              const chipColor = getChipColor(tag);
              return (
                <div
                  key={`${tag}-${index}`}
                  class="inline-flex items-center rounded-full border border-black/5 py-0.5 pl-2 pr-1 text-xs font-medium shadow-sm"
                  style={{ backgroundColor: chipColor.backgroundColor, color: chipColor.color }}
                >
                  <span>{tag}</span>
                  <button
                    type="button"
                    onClick={() => onRemoveTag(tag)}
                    class="ml-1 rounded-full p-0.5 hover:bg-black/10"
                    aria-label={`${tag}を削除`}
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
              placeholder={albumData.tags.length === 0 ? 'タグを入力してEnter' : '続けて入力'}
              class="min-w-[120px] flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-400"
            />
          </div>
          {simple && !showFieldHints && (
            <p class={hintClass}>
              Enterで追加します。カンマで区切ると複数まとめて登録できます。
            </p>
          )}
        </div>
      </div>
  );

  if (compactLayout) {
    return (
      <div class="grid grid-cols-1 gap-6 sm:grid-cols-[11rem_minmax(0,1fr)]">
        {artworkBlock}
        {fieldsBlock}
      </div>
    );
  }

  return (
    <div class="flex flex-col gap-4">
      {artworkBlock}
      {fieldsBlock}
    </div>
  );
}
