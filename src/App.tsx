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
    <div class="app-container">
      <div class="sidebar">
        <div 
          class="artwork-box"
          onDrop={handleArtworkDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          {albumData.albumArtwork ? (
            <img src={albumData.albumArtwork} alt="Album Artwork" />
          ) : (
            <div class="artwork-placeholder">
              Album Artwork<br />
              Drop in this box
            </div>
          )}
        </div>

        <div class="album-info">
          <div class="field-group">
            <label>アルバム名</label>
            <input
              type="text"
              value={albumData.albumTitle}
              onInput={(e) => handleAlbumFieldChange('albumTitle', e.currentTarget.value)}
              placeholder="Album Title"
            />
          </div>

          <div class="field-group">
            <label>アルバムアーティスト</label>
            <input
              type="text"
              value={albumData.albumArtist}
              onInput={(e) => handleAlbumFieldChange('albumArtist', e.currentTarget.value)}
              placeholder="Album Artist"
            />
          </div>

          <div class="field-group">
            <label>リリース日</label>
            <input
              type="text"
              value={albumData.releaseDate}
              onInput={(e) => handleAlbumFieldChange('releaseDate', e.currentTarget.value)}
              placeholder="2000-01-01"
            />
          </div>

          <div class="field-group">
            <label>タグ</label>
            <div class="tag-status">
              <span>カンマで区切り</span>
              <div class="tag-buttons">
                <button 
                  class={albumData.hasTag ? "tag-button active" : "tag-button"}
                  onClick={() => handleAlbumFieldChange('hasTag', true)}
                >
                  戻し ✓
                </button>
                <button 
                  class={!albumData.hasTag ? "tag-button active remove" : "tag-button"}
                  onClick={() => handleAlbumFieldChange('hasTag', false)}
                >
                  あまあま ✕
                </button>
              </div>
            </div>
          </div>

          <button class="dlsite-button">DLSiteから取得</button>
        </div>
      </div>

      <div class="main-content">
        <div class="controls-bar">
          <div class="sort-controls">
            <label>ソート</label>
            <button class="sort-button">Disk</button>
            <button class="sort-button">Track</button>
          </div>
        </div>

        <div class="tracks-table">
          <table>
            <thead>
              <tr>
                <th class="checkbox-column">×</th>
                <th class="disk-column">Disk</th>
                <th class="track-column">Track</th>
                <th class="title-column">タイトル</th>
                <th class="artist-column">アーティスト</th>
              </tr>
            </thead>
            <tbody>
              {tracks.map((track) => (
                <tr key={track.id}>
                  <td class="checkbox-column">
                    <button class="remove-button">×</button>
                  </td>
                  <td class="disk-column">
                    <input
                      type="text"
                      value={track.diskNumber}
                      onInput={(e) => handleTrackChange(track.id, 'diskNumber', e.currentTarget.value)}
                      class="small-input"
                    />
                  </td>
                  <td class="track-column">
                    <input
                      type="text"
                      value={track.trackNumber}
                      onInput={(e) => handleTrackChange(track.id, 'trackNumber', e.currentTarget.value)}
                      class="small-input"
                    />
                  </td>
                  <td class="title-column">
                    <input
                      type="text"
                      value={track.title}
                      onInput={(e) => handleTrackChange(track.id, 'title', e.currentTarget.value)}
                      class="title-input"
                    />
                  </td>
                  <td class="artist-column">
                    <div class="artist-field">
                      <input
                        type="text"
                        value={track.artist}
                        onInput={(e) => handleTrackChange(track.id, 'artist', e.currentTarget.value)}
                        class={track.hasArtist ? "artist-input has-artist" : "artist-input"}
                      />
                      <button 
                        class={track.hasArtist ? "artist-toggle active" : "artist-toggle"}
                        onClick={() => handleTrackChange(track.id, 'hasArtist', !track.hasArtist)}
                      >
                        {track.hasArtist ? "✕" : "○"}
                      </button>
                      <span class="separator">カンマで区切り</span>
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