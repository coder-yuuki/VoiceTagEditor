import { useState } from "preact/hooks";
import "./App.css";

interface Track {
  id: string;
  diskNumber: string;
  trackNumber: string;
  title: string;
  artist: string;
  hasArtist: boolean;
}

interface AlbumData {
  albumArtwork: string | null;
  albumTitle: string;
  albumArtist: string;
  releaseDate: string;
  hasTag: boolean;
}

function App() {
  const [albumData, setAlbumData] = useState<AlbumData>({
    albumArtwork: null,
    albumTitle: "Album Title",
    albumArtist: "Album Artist",
    releaseDate: "2000-01-01",
    hasTag: false,
  });

  const [tracks, setTracks] = useState<Track[]>([
    {
      id: "1",
      diskNumber: "01",
      trackNumber: "01",
      title: "Sample Track Title 01",
      artist: "Sample Artist Name 01",
      hasArtist: true,
    },
    {
      id: "2",
      diskNumber: "01",
      trackNumber: "02",
      title: "Sample Track Title 02",
      artist: "Sample Artist Name 01",
      hasArtist: true,
    },
  ]);

  const handleAlbumFieldChange = (field: keyof AlbumData, value: string | boolean) => {
    setAlbumData({ ...albumData, [field]: value });
  };

  const handleTrackChange = (trackId: string, field: keyof Track, value: string | boolean) => {
    setTracks(tracks.map(track => 
      track.id === trackId ? { ...track, [field]: value } : track
    ));
  };

  const handleArtworkDrop = (e: DragEvent) => {
    e.preventDefault();
    // モックアップなので実際のファイル処理はしない
    console.log("Artwork dropped");
  };

  return (
    <div class="flex h-screen bg-gray-100">
      {/* サイドバー */}
      <div class="w-80 bg-gray-200 p-5 flex flex-col gap-5 border-r border-gray-300">
        <div 
          class="w-full aspect-square bg-white border-2 border-dashed border-gray-400 rounded-lg flex items-center justify-center cursor-pointer hover:border-gray-600 transition-colors"
          onDrop={handleArtworkDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          {albumData.albumArtwork ? (
            <img src={albumData.albumArtwork} alt="Album Artwork" class="w-full h-full object-cover rounded-md" />
          ) : (
            <div class="text-center text-gray-500 text-sm">
              Album Artwork<br />
              Drop in this box
            </div>
          )}
        </div>

        <div class="flex flex-col gap-4">
          <div class="flex flex-col gap-1">
            <label class="text-xs text-gray-600 font-medium">アルバム名</label>
            <input
              type="text"
              value={albumData.albumTitle}
              onInput={(e) => handleAlbumFieldChange('albumTitle', e.currentTarget.value)}
              placeholder="Album Title"
              class="px-2 py-1.5 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:border-green-500"
            />
          </div>

          <div class="flex flex-col gap-1">
            <label class="text-xs text-gray-600 font-medium">アルバムアーティスト</label>
            <input
              type="text"
              value={albumData.albumArtist}
              onInput={(e) => handleAlbumFieldChange('albumArtist', e.currentTarget.value)}
              placeholder="Album Artist"
              class="px-2 py-1.5 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:border-green-500"
            />
          </div>

          <div class="flex flex-col gap-1">
            <label class="text-xs text-gray-600 font-medium">リリース日</label>
            <input
              type="text"
              value={albumData.releaseDate}
              onInput={(e) => handleAlbumFieldChange('releaseDate', e.currentTarget.value)}
              placeholder="2000-01-01"
              class="px-2 py-1.5 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:border-green-500"
            />
          </div>

          <div class="flex flex-col gap-2">
            <label class="text-xs text-gray-600 font-medium">タグ</label>
            <span class="text-xs text-gray-500">カンマで区切り</span>
            <div class="flex gap-2">
              <button 
                class={`flex-1 px-3 py-1.5 border rounded text-xs transition-colors ${
                  albumData.hasTag 
                    ? "bg-green-500 text-white border-green-500" 
                    : "bg-white border-gray-300 hover:bg-gray-50"
                }`}
                onClick={() => handleAlbumFieldChange('hasTag', true)}
              >
                戻し ✓
              </button>
              <button 
                class={`flex-1 px-3 py-1.5 border rounded text-xs transition-colors ${
                  !albumData.hasTag 
                    ? "bg-red-500 text-white border-red-500" 
                    : "bg-white border-gray-300 hover:bg-gray-50"
                }`}
                onClick={() => handleAlbumFieldChange('hasTag', false)}
              >
                あまあま ✕
              </button>
            </div>
          </div>

          <button class="px-3 py-2 border border-blue-500 rounded bg-blue-500 text-white text-sm hover:bg-blue-600 transition-colors">
            DLSiteから取得
          </button>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div class="flex-1 flex flex-col bg-white">
        <div class="px-5 py-4 bg-gray-50 border-b border-gray-300 flex items-center gap-5">
          <div class="flex items-center gap-2">
            <label class="text-sm text-gray-600">ソート</label>
            <button class="px-3 py-1 border border-gray-300 rounded bg-white text-xs hover:bg-gray-50 transition-colors">
              Disk
            </button>
            <button class="px-3 py-1 border border-gray-300 rounded bg-white text-xs hover:bg-gray-50 transition-colors">
              Track
            </button>
          </div>
        </div>

        <div class="flex-1 overflow-auto">
          <table class="w-full">
            <thead class="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th class="w-10 px-2 py-2 text-left text-xs text-gray-600 font-semibold border-b-2 border-gray-300">×</th>
                <th class="w-20 px-2 py-2 text-left text-xs text-gray-600 font-semibold border-b-2 border-gray-300">Disk</th>
                <th class="w-20 px-2 py-2 text-left text-xs text-gray-600 font-semibold border-b-2 border-gray-300">Track</th>
                <th class="px-2 py-2 text-left text-xs text-gray-600 font-semibold border-b-2 border-gray-300">タイトル</th>
                <th class="px-2 py-2 text-left text-xs text-gray-600 font-semibold border-b-2 border-gray-300">アーティスト</th>
              </tr>
            </thead>
            <tbody>
              {tracks.map((track) => (
                <tr key={track.id} class="hover:bg-gray-50">
                  <td class="px-2 py-2 border-b border-gray-200">
                    <button class="w-6 h-6 border border-gray-300 rounded bg-white text-gray-500 text-xs hover:bg-red-500 hover:text-white hover:border-red-500 transition-all flex items-center justify-center">
                      ×
                    </button>
                  </td>
                  <td class="px-2 py-2 border-b border-gray-200">
                    <input
                      type="text"
                      value={track.diskNumber}
                      onInput={(e) => handleTrackChange(track.id, 'diskNumber', e.currentTarget.value)}
                      class="w-12 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:border-blue-500"
                    />
                  </td>
                  <td class="px-2 py-2 border-b border-gray-200">
                    <input
                      type="text"
                      value={track.trackNumber}
                      onInput={(e) => handleTrackChange(track.id, 'trackNumber', e.currentTarget.value)}
                      class="w-12 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:border-blue-500"
                    />
                  </td>
                  <td class="px-2 py-2 border-b border-gray-200">
                    <input
                      type="text"
                      value={track.title}
                      onInput={(e) => handleTrackChange(track.id, 'title', e.currentTarget.value)}
                      class="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:border-blue-500"
                    />
                  </td>
                  <td class="px-2 py-2 border-b border-gray-200">
                    <div class="flex items-center gap-2">
                      <input
                        type="text"
                        value={track.artist}
                        onInput={(e) => handleTrackChange(track.id, 'artist', e.currentTarget.value)}
                        class={`flex-1 max-w-xs px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:border-blue-500 ${
                          track.hasArtist ? "bg-yellow-50" : ""
                        }`}
                      />
                      <button 
                        class={`w-6 h-6 border rounded text-xs flex items-center justify-center transition-all ${
                          track.hasArtist 
                            ? "bg-orange-500 text-white border-orange-500" 
                            : "bg-white border-gray-300 hover:bg-gray-50"
                        }`}
                        onClick={() => handleTrackChange(track.id, 'hasArtist', !track.hasArtist)}
                      >
                        {track.hasArtist ? "✕" : "○"}
                      </button>
                      <span class="text-gray-500 text-xs whitespace-nowrap">カンマで区切り</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default App;