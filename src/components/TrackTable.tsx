import { Clipboard, Music, Trash2, X } from 'lucide-preact';
import type { ChipColor, Track } from '../types';

interface TrackTableProps {
  tracks: Track[];
  isProcessing: boolean;
  getChipColor: (text: string) => ChipColor;
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

export function TrackTable({
  tracks,
  isProcessing,
  getChipColor,
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
  return (
    <div class="flex-1 overflow-auto bg-white">
      {tracks.length === 0 && !isProcessing && (
        <div class="flex items-center justify-center h-full text-zinc-400">
          <div class="text-center flex flex-col items-center gap-4">
            <div class="p-4 bg-zinc-50 rounded-full">
              <Music size={48} class="text-zinc-300" />
            </div>
            <div class="text-sm">
              <span class="font-medium text-zinc-600 block mb-1">音声ファイルまたはフォルダをドロップ</span>
              <span class="text-xs text-zinc-400">
                対応形式: WAV, MP3, FLAC, M4A<br />
                フォルダは再帰的にスキャンされます
              </span>
            </div>
          </div>
        </div>
      )}
      <table class="w-full table-fixed divide-y divide-zinc-200">
        <thead class="bg-zinc-50 sticky top-0 z-10 shadow-sm">
          <tr>
            <th class="w-16 px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">削除</th>
            <th class="w-24 px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap">ディスク</th>
            <th class="w-24 px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap">トラック</th>
            <th class="w-80 px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">タイトル</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">アーティスト</th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-zinc-100">
          {tracks.map((track) => (
            <tr key={track.id} class="hover:bg-zinc-50 transition-colors group">
              <td class="px-4 py-2 align-top pt-3">
                <button
                  onClick={() => onTrackDelete(track.id)}
                  class="p-1.5 border border-transparent rounded text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                  title="トラックを削除"
                >
                  <Trash2 size={14} />
                </button>
              </td>
              <td class="px-4 py-2 align-top pt-3">
                <input
                  type="text"
                  value={track.diskNumber}
                  onInput={(event) => {
                    const numericValue = onNumberInput(event.currentTarget.value);
                    onTrackChange(track.id, 'diskNumber', numericValue);
                  }}
                  onBlur={(event) => {
                    onTrackChange(track.id, 'diskNumber', onPadNumber(event.currentTarget.value));
                  }}
                  placeholder="1"
                  class="w-full px-2 py-1 border border-zinc-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-center"
                />
              </td>
              <td class="px-4 py-2 align-top pt-3">
                <input
                  type="text"
                  value={track.trackNumber}
                  onInput={(event) => {
                    const numericValue = onNumberInput(event.currentTarget.value);
                    onTrackChange(track.id, 'trackNumber', numericValue);
                  }}
                  onBlur={(event) => {
                    onTrackChange(track.id, 'trackNumber', onPadNumber(event.currentTarget.value));
                  }}
                  placeholder="1"
                  class="w-full px-2 py-1 border border-zinc-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-center"
                />
              </td>
              <td class="px-4 py-2 align-top pt-3">
                <textarea
                  value={track.title}
                  onInput={(event) => {
                    onTrackChange(track.id, 'title', event.currentTarget.value);
                    event.currentTarget.style.height = 'auto';
                    event.currentTarget.style.height = `${event.currentTarget.scrollHeight}px`;
                  }}
                  class="w-full px-2 py-1.5 border border-zinc-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none overflow-hidden min-h-[2rem] transition-all"
                  rows={1}
                  style={{ height: 'auto', minHeight: '2rem' }}
                />
              </td>
              <td class="px-4 py-2 align-top pt-3">
                <div class="flex items-start gap-2">
                  <div
                    class="flex-1 min-h-[2rem] px-2 py-1.5 border border-zinc-300 rounded text-xs bg-white focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all flex flex-wrap gap-1.5 items-start"
                    style={{ maxWidth: 'none', wordBreak: 'break-word' }}
                  >
                    {track.artists.map((artist, index) => {
                      const chipColor = getChipColor(artist);
                      return (
                        <div
                          key={`${artist}-${index}`}
                          class="inline-flex items-center pl-2 pr-1 py-0.5 rounded-full text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity border border-black/5 shadow-sm"
                          style={{
                            backgroundColor: chipColor.backgroundColor,
                            color: chipColor.color,
                            maxWidth: '100%',
                            wordBreak: 'break-word',
                          }}
                          onClick={() => onCopyArtist(artist)}
                          title={`クリックしてコピー "${artist}"`}
                        >
                          <span style={{
                            wordBreak: 'break-word',
                            overflowWrap: 'break-word',
                            whiteSpace: 'normal',
                            lineHeight: '1.2',
                          }}>{artist}</span>
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              onRemoveArtist(track.id, artist);
                            }}
                            class="ml-1 p-0.5 hover:bg-black/10 rounded-full transition-colors"
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
                      placeholder={track.artists.length === 0 ? 'アーティストを追加...' : ''}
                      class="flex-1 min-w-[80px] outline-none bg-transparent text-xs placeholder-zinc-400"
                    />
                  </div>

                  {track.artists.length > 0 && (
                    <button
                      onClick={() => onCopyAllArtists(track.artists)}
                      class="p-1.5 border border-zinc-200 rounded bg-white text-zinc-400 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 transition-all self-start flex-shrink-0"
                      title={`全アーティストをコピー: ${track.artists.join('; ')}`}
                    >
                      <Clipboard size={14} />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
