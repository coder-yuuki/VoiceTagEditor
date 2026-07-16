import { AlertTriangle, Clipboard, FileAudio, FolderOpen, Trash2, Upload, X } from 'lucide-preact';
import type { AppMode, ChipColor, Track } from '../types';

interface TrackTableProps {
  mode: AppMode;
  tracks: Track[];
  isProcessing: boolean;
  isFfmpegReady: boolean;
  getChipColor: (text: string) => ChipColor;
  onPickAudioFiles: () => void;
  onPickDirectories: () => void;
  onTrackDelete: (trackId: string) => void;
  onTrackChange: (trackId: string, field: keyof Track, value: string | boolean | string[]) => void;
  onNumberInput: (value: string) => string;
  onPadNumber: (value: string) => string;
  onArtistInput: (trackId: string, value: string) => void;
  onArtistPaste: (trackId: string, event: ClipboardEvent) => void;
  onArtistKeyDown: (trackId: string, event: KeyboardEvent) => void;
  onCopyArtist: (artist: string) => void;
  onRemoveArtist: (trackId: string, artist: string) => void;
  onCopyAllArtists: (artists: string[]) => void;
}

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
  getChipColor,
  onPickAudioFiles,
  onPickDirectories,
  onTrackDelete,
  onTrackChange,
  onNumberInput,
  onPadNumber,
  onArtistInput,
  onArtistPaste,
  onArtistKeyDown,
  onCopyArtist,
  onRemoveArtist,
  onCopyAllArtists,
}: TrackTableProps) {
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

  if (tracks.length === 0 && !isProcessing) {
    return (
      <div class="flex flex-1 items-center justify-center overflow-auto bg-gradient-to-b from-white to-zinc-50 p-8">
        <div class="w-full max-w-2xl rounded-3xl border border-zinc-200 bg-white px-8 py-10 text-center shadow-sm">
          <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
            <FileAudio size={32} />
          </div>
          <h2 class="mt-5 text-xl font-bold text-zinc-900">編集する音声を選びましょう</h2>
          <p class="mx-auto mt-2 max-w-lg text-sm leading-6 text-zinc-600">
            1つずつ選ぶことも、作品のフォルダをまとめて選ぶこともできます。
            フォルダ内にあるカバー画像も自動で探します。
          </p>

          <div class="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={onPickAudioFiles}
              disabled={!isFfmpegReady}
              class="inline-flex min-w-48 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-base font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Upload size={20} />
              ファイルを選ぶ
            </button>
            <button
              type="button"
              onClick={onPickDirectories}
              disabled={!isFfmpegReady}
              class="inline-flex min-w-48 items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-5 py-3 text-base font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FolderOpen size={20} />
              フォルダを選ぶ
            </button>
          </div>

          {!isFfmpegReady && (
            <p class="mt-4 text-sm font-medium text-blue-700">
              音声機能を準備しています。終わるまで少しお待ちください。
            </p>
          )}

          <div class="mt-7 border-t border-zinc-100 pt-5 text-sm text-zinc-500">
            ここへ音声ファイルやフォルダをドラッグ＆ドロップしても追加できます
            <div class="mt-1 text-xs text-zinc-400">対応形式：WAV / MP3 / FLAC / M4A</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div class="flex-1 overflow-auto bg-white">
      {simple && duplicateKeys.size > 0 && (
        <div class="sticky left-0 top-0 z-20 flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-5 py-2 text-sm text-amber-800">
          <AlertTriangle size={16} />
          同じディスク番号・トラック番号があります。黄色の行を確認してください。保存はそのまま続けられます。
        </div>
      )}
      <table class="w-full table-fixed divide-y divide-zinc-200">
        <thead class={`sticky z-10 bg-zinc-50 shadow-sm ${simple && duplicateKeys.size > 0 ? 'top-[41px]' : 'top-0'}`}>
          <tr>
            <th class="w-16 px-3 py-3 text-center text-xs font-semibold text-zinc-500">削除</th>
            <th class="w-24 px-3 py-3 text-center text-xs font-semibold text-zinc-500">ディスク番号</th>
            <th class="w-28 px-3 py-3 text-center text-xs font-semibold text-zinc-500">トラック番号</th>
            <th class="w-80 px-4 py-3 text-left text-xs font-semibold text-zinc-500">タイトル</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-zinc-500">アーティスト</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-zinc-100 bg-white">
          {tracks.map((track) => {
            const key = numberKey(track);
            const hasDuplicate = key ? duplicateKeys.has(key) : false;

            return (
              <tr
                key={track.id}
                class={`transition-colors ${hasDuplicate ? 'bg-amber-50/70 hover:bg-amber-50' : 'hover:bg-zinc-50'}`}
              >
                <td class="px-3 py-3 text-center align-top">
                  <button
                    type="button"
                    onClick={() => onTrackDelete(track.id)}
                    class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-red-50 hover:text-red-600"
                    title="この音声を一覧から削除"
                    aria-label={`${track.title}を削除`}
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
                <td class="px-3 py-3 align-top">
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
                    aria-label={`${track.title}のディスク番号`}
                    class={`w-full rounded-lg border px-2 py-2 text-center text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                      hasDuplicate ? 'border-amber-400 bg-white focus:border-amber-500' : 'border-zinc-300 focus:border-blue-500'
                    }`}
                  />
                </td>
                <td class="px-3 py-3 align-top">
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
                    aria-label={`${track.title}のトラック番号`}
                    class={`w-full rounded-lg border px-2 py-2 text-center text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                      hasDuplicate ? 'border-amber-400 bg-white focus:border-amber-500' : 'border-zinc-300 focus:border-blue-500'
                    }`}
                  />
                  {hasDuplicate && (
                    <div class="mt-1 flex items-center justify-center gap-1 text-[11px] font-medium text-amber-700">
                      <AlertTriangle size={11} />
                      重複
                    </div>
                  )}
                </td>
                <td class="px-4 py-3 align-top">
                  <textarea
                    value={track.title}
                    onInput={(event) => {
                      onTrackChange(track.id, 'title', event.currentTarget.value);
                      event.currentTarget.style.height = 'auto';
                      event.currentTarget.style.height = `${event.currentTarget.scrollHeight}px`;
                    }}
                    aria-label="タイトル"
                    class="min-h-10 w-full resize-none overflow-hidden rounded-lg border border-zinc-300 px-3 py-2 text-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    rows={1}
                    style={{ height: 'auto' }}
                  />
                </td>
                <td class="px-4 py-3 align-top">
                  <div class="flex items-start gap-2">
                    <div class="flex min-h-10 flex-1 flex-wrap items-start gap-1.5 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 transition-all focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20">
                      {track.artists.map((artist, index) => {
                        const chipColor = getChipColor(artist);
                        return (
                          <div
                            key={`${artist}-${index}`}
                            class="inline-flex max-w-full cursor-pointer items-center rounded-full border border-black/5 py-0.5 pl-2 pr-1 text-xs font-medium shadow-sm transition-opacity hover:opacity-80"
                            style={{ backgroundColor: chipColor.backgroundColor, color: chipColor.color }}
                            onClick={() => onCopyArtist(artist)}
                            title={`クリックして「${artist}」をコピー`}
                          >
                            <span class="break-words leading-tight">{artist}</span>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                onRemoveArtist(track.id, artist);
                              }}
                              class="ml-1 rounded-full p-0.5 hover:bg-black/10"
                              aria-label={`${artist}を削除`}
                            >
                              <X size={12} />
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
                        placeholder={track.artists.length === 0 ? 'アーティスト名を入力してEnter' : '続けて入力'}
                        class="min-w-[150px] flex-1 bg-transparent py-0.5 text-sm outline-none placeholder:text-zinc-400"
                      />
                    </div>

                    {track.artists.length > 0 && (
                      <button
                        type="button"
                        onClick={() => onCopyAllArtists(track.artists)}
                        class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-500 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600"
                        title="アーティスト名をまとめてコピー"
                      >
                        <Clipboard size={15} />
                      </button>
                    )}
                  </div>
                  {simple && (
                    <p class="mt-1 text-[11px] leading-4 text-zinc-500">
                      Enterで追加します。カンマで区切ると複数まとめて登録できます。
                    </p>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
