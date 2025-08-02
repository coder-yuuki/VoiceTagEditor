import { useState, useEffect } from "preact/hooks";
import { confirm } from "@tauri-apps/plugin-dialog";
import { listen } from '@tauri-apps/api/event'
import { convertFileSrc } from '@tauri-apps/api/core';
import "./App.css";

interface Track {
  id: string;
  diskNumber: string;
  trackNumber: string;
  title: string;
  artists: string[];
  currentArtistInput: string;
}

interface AlbumData {
  albumArtwork: string | null;
  albumTitle: string;
  albumArtist: string;
  releaseDate: string;
  tags: string[];
  currentTagInput: string;
}

function App() {
  const [albumData, setAlbumData] = useState<AlbumData>({
    albumArtwork: null,
    albumTitle: "Album Title",
    albumArtist: "Album Artist",
    releaseDate: "2000-01-01",
    tags: ["戻し", "あまあま"],
    currentTagInput: "",
  });

  const [tracks, setTracks] = useState<Track[]>([
    {
      id: "1",
      diskNumber: "01",
      trackNumber: "01",
      title: "Sample Track Title 01",
      artists: ["Sample Artist Name 01", "アーティスト２"],
      currentArtistInput: "",
    },
    {
      id: "2",
      diskNumber: "01",
      trackNumber: "02",
      title: "Sample Track Title 02",
      artists: ["Sample Artist Name 01"],
      currentArtistInput: "",
    },
  ]);

  // Tauriのファイルドロップイベントリスナー
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setupListener = async () => {
      console.log('Setting up file drop listener...');
      
      try {
        unlisten = await listen('tauri://drag-drop', async (event) => {
          console.log('File drop event received:', event);
          const { paths } = event.payload as { paths: string[] };
          console.log('Dropped paths:', paths);
          console.log('Number of paths dropped:', paths.length);
          
          if (paths.length > 0) {
            const filePath = paths[0];
            console.log('Processing file path:', filePath);
          
            // ファイル拡張子をチェック
            const supportedExtensions = ['.png', '.jpg', '.jpeg', '.webp'];
            const fileExtension = filePath.toLowerCase().substring(filePath.lastIndexOf('.'));
            
            if (!supportedExtensions.includes(fileExtension)) {
              console.error('サポートされていないファイル形式:', fileExtension);
              return;
            } else{
              console.log('Supported file format:', fileExtension);
            }

            const artworkUrl = convertFileSrc(filePath);
            handleAlbumFieldChange('albumArtwork', artworkUrl);
          }
        });
      } catch (error) {
        console.error('Failed to set up file drop listener:', error);
      }
    };

    setupListener();

    return () => {
      console.log('Cleaning up file drop listener...');
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  const handleAlbumFieldChange = (field: keyof AlbumData, value: string | boolean | string[]) => {
    setAlbumData({ ...albumData, [field]: value });
  };

  // 文字列をハッシュ化してユニークな色を生成
  const stringToHash = (str: string): number => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 32bit整数に変換
    }
    return Math.abs(hash);
  };

  const hashToColor = (hash: number): string => {
    // HSLを使って彩度と明度を固定し、色相のみを変化させる
    const hue = hash % 360;
    const saturation = 65; // 適度な彩度
    const lightness = 85; // 明るい背景色
    
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  };

  const getTextColor = (backgroundColor: string): string => {
    // 背景色から色相を抽出して文字色を生成
    const hueMatch = backgroundColor.match(/hsl\((\d+),/);
    if (hueMatch) {
      const hue = parseInt(hueMatch[1]);
      return `hsl(${hue}, 65%, 25%)`;
    }
    return '#1f2937'; // フォールバック
  };

  // 文字列から一意な色を生成
  const getChipColor = (text: string) => {
    const hash = stringToHash(text);
    const backgroundColor = hashToColor(hash);
    const textColor = getTextColor(backgroundColor);
    
    return {
      backgroundColor,
      color: textColor
    };
  };

  // タグ入力処理（カンマ入力時にチップ化）
  const handleTagInput = (value: string) => {
    if (value.includes(',') || value.includes('，')) {
      const parts = value.split(/[,，]/);
      const newTags = parts.slice(0, -1).map(tag => tag.trim()).filter(tag => tag.length > 0);
      const remainingInput = parts[parts.length - 1].trim();
      
      if (newTags.length > 0) {
        setAlbumData({
          ...albumData,
          tags: [...albumData.tags, ...newTags],
          currentTagInput: remainingInput
        });
      }
    } else {
      handleAlbumFieldChange('currentTagInput', value);
    }
  };

  // タグチップを削除
  const removeTag = (tagToRemove: string) => {
    const updatedTags = albumData.tags.filter(tag => tag !== tagToRemove);
    handleAlbumFieldChange('tags', updatedTags);
  };

  // アーティスト入力処理（カンマ入力時にチップ化）
  const handleArtistInput = (trackId: string, value: string) => {
    if (value.includes(',') || value.includes('，')) {
      const parts = value.split(/[,，]/);
      const newArtists = parts.slice(0, -1).map(artist => artist.trim()).filter(artist => artist.length > 0);
      const remainingInput = parts[parts.length - 1].trim();
      
      if (newArtists.length > 0) {
        const track = tracks.find(t => t.id === trackId);
        if (track) {
          setTracks(tracks.map(t => 
            t.id === trackId 
              ? { 
                  ...t, 
                  artists: [...t.artists, ...newArtists],
                  currentArtistInput: remainingInput
                }
              : t
          ));
        }
      } else {
        handleTrackChange(trackId, 'currentArtistInput', remainingInput);
      }
    } else {
      handleTrackChange(trackId, 'currentArtistInput', value);
    }
  };

  // アーティストチップを削除
  const removeArtistTag = (trackId: string, artistToRemove: string) => {
    const track = tracks.find(t => t.id === trackId);
    if (!track) return;
    
    const updatedArtists = track.artists.filter(artist => artist !== artistToRemove);
    handleTrackChange(trackId, 'artists', updatedArtists);
  };

  const handleTrackChange = (trackId: string, field: keyof Track, value: string | boolean | string[]) => {
    setTracks(tracks.map(track => 
      track.id === trackId ? { ...track, [field]: value } : track
    ));
  };
  // トラック削除処理（確認ポップアップ付き）
  // トラックソート処理（Disk → Track順）
  const handleSort = () => {
    const sortedTracks = [...tracks].sort((a, b) => {
      // 第1ソート: Disk番号
      const diskA = parseInt(a.diskNumber) || 0;
      const diskB = parseInt(b.diskNumber) || 0;
      
      if (diskA !== diskB) {
        return diskA - diskB;
      }
      
      // 第2ソート: Track番号
      const trackA = parseInt(a.trackNumber) || 0;
      const trackB = parseInt(b.trackNumber) || 0;
      
      return trackA - trackB;
    });
    
    setTracks(sortedTracks);
  };
  const handleTrackDelete = async (trackId: string) => {
    console.log("Deleting track:", trackId);
    console.log("Available tracks:", tracks.map(t => ({id: t.id, title: t.title})));
    const track = tracks.find(t => t.id === trackId);
    console.log("Found track:", track);
    if (!track) {
      console.log("Track not found!");
      return;
    }
    
    const confirmMessage = `「${track.title}」を削除しますか？
この操作は取り消せません。`;
    console.log("Showing confirm dialog:", confirmMessage);
    
    try {
      const userConfirmed = await confirm(confirmMessage, {
        title: "トラック削除の確認",
        kind: "warning"
      });
      console.log("User confirmed:", userConfirmed);
      
      if (userConfirmed) {
        console.log("Deleting track from array");
        const newTracks = tracks.filter(t => t.id !== trackId);
        console.log("New tracks array:", newTracks);
        setTracks(newTracks);
        console.log("Track deleted successfully");
      } else {
        console.log("User cancelled deletion");
      }
    } catch (error) {
      console.error("Error showing dialog:", error);
    }
  };


  return (
    <div class="flex h-screen bg-gray-100">
      {/* サイドバー */}
      <div class="w-80 bg-gray-200 p-3 flex flex-col gap-3 border-r border-gray-300">
        <div 
          class="w-full aspect-square bg-white border-2 border-dashed border-gray-400 rounded-lg flex items-center justify-center cursor-pointer hover:border-gray-600 transition-colors"
        >
          {albumData.albumArtwork ? (
            <img src={albumData.albumArtwork} alt="Album Artwork" class="max-w-full max-h-full object-contain rounded-md" />
          ) : (
            <div class="text-center text-gray-500 text-sm">
              Album Artwork<br />
              Drop in this box
            </div>
          )}
        </div>

        <div class="flex flex-col gap-2">
          <div class="flex flex-col gap-0.5">
            <label class="text-xs text-gray-600 font-medium">アルバム名</label>
            <input
              type="text"
              value={albumData.albumTitle}
              onInput={(e) => handleAlbumFieldChange('albumTitle', e.currentTarget.value)}
              placeholder="Album Title"
              class="px-2 py-1 border border-gray-300 rounded text-xs bg-white focus:outline-none focus:border-green-500"
            />
          </div>

          <div class="flex flex-col gap-0.5">
            <label class="text-xs text-gray-600 font-medium">アルバムアーティスト</label>
            <input
              type="text"
              value={albumData.albumArtist}
              onInput={(e) => handleAlbumFieldChange('albumArtist', e.currentTarget.value)}
              placeholder="Album Artist"
              class="px-2 py-1 border border-gray-300 rounded text-xs bg-white focus:outline-none focus:border-green-500"
            />
          </div>

          <div class="flex flex-col gap-0.5">
            <label class="text-xs text-gray-600 font-medium">リリース日</label>
            <input
              type="text"
              value={albumData.releaseDate}
              onInput={(e) => handleAlbumFieldChange('releaseDate', e.currentTarget.value)}
              placeholder="2000-01-01"
              class="px-2 py-1 border border-gray-300 rounded text-xs bg-white focus:outline-none focus:border-green-500"
            />
          </div>

          <div class="flex flex-col gap-1">
            <label class="text-xs text-gray-600 font-medium">タグ</label>
            <span class="text-xs text-gray-500">カンマで区切り</span>
            
            {/* タグ入力フィールド（チップ内蔵） */}
            <div class="min-h-[2rem] px-2 py-1 border border-gray-300 rounded text-xs bg-white focus-within:border-blue-500 flex flex-wrap gap-1 items-center">
              {/* タグチップ表示 */}
              {albumData.tags.map((tag, index) => {
                const chipColor = getChipColor(tag);
                return (
                  <div 
                    key={`${tag}-${index}`}
                    class="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium"
                    style={{ backgroundColor: chipColor.backgroundColor, color: chipColor.color }}
                  >
                    <span>{tag}</span>
                    <button
                      onClick={() => removeTag(tag)}
                      class="ml-1 text-current hover:bg-black hover:bg-opacity-20 rounded-full w-3 h-3 flex items-center justify-center transition-colors text-xs"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
              
              {/* 入力フィールド */}
              <input
                type="text"
                value={albumData.currentTagInput}
                onInput={(e) => handleTagInput(e.currentTarget.value)}
                placeholder={albumData.tags.length === 0 ? "タグをカンマで区切って入力" : ""}
                class="flex-1 min-w-[100px] outline-none bg-transparent text-xs"
              />
            </div>
          </div>

          <button class="px-3 py-1.5 border border-blue-500 rounded bg-blue-500 text-white text-xs hover:bg-blue-600 transition-colors">
            DLSiteから取得
          </button>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div class="flex-1 flex flex-col bg-white">
        <div class="px-5 py-4 bg-gray-50 border-b border-gray-300 flex items-center gap-5">
          <div class="flex items-center gap-2">
            <button 
              onClick={handleSort}
              class="px-3 py-1 border border-gray-300 rounded bg-white text-xs hover:bg-gray-50 transition-colors"
            >
              ソート
            </button>
          </div>
        </div>

        <div class="flex-1 overflow-auto">
          <table class="w-full">
            <thead class="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th class="w-16 px-2 py-2 text-left text-xs text-gray-600 font-semibold border-b-2 border-gray-300">削除</th>
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
                    <button 
                      onClick={() => handleTrackDelete(track.id)}
                      class="px-2 py-1 border border-red-300 rounded bg-red-50 text-red-600 text-xs hover:bg-red-500 hover:text-white hover:border-red-500 transition-all flex items-center justify-center gap-1 font-medium"
                    >
                      🗑️ 削除
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
                      {/* アーティスト入力フィールド（チップ内蔵） */}
                      <div class="flex-1 max-w-xs min-h-[1.75rem] px-2 py-1 border border-gray-300 rounded text-xs bg-white focus-within:border-blue-500 flex flex-wrap gap-1 items-center">
                        {/* アーティストチップ表示 */}
                        {track.artists.map((artist, index) => {
                          const chipColor = getChipColor(artist);
                          return (
                            <div 
                              key={`${artist}-${index}`}
                              class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                              style={{ backgroundColor: chipColor.backgroundColor, color: chipColor.color }}
                            >
                              <span>{artist}</span>
                              <button
                                onClick={() => removeArtistTag(track.id, artist)}
                                class="ml-1 text-current hover:bg-black hover:bg-opacity-20 rounded-full w-3 h-3 flex items-center justify-center transition-colors text-xs"
                              >
                                ×
                              </button>
                            </div>
                          );
                        })}
                        
                        {/* 入力フィールド */}
                        <input
                          type="text"
                          value={track.currentArtistInput}
                          onInput={(e) => handleArtistInput(track.id, e.currentTarget.value)}
                          placeholder={track.artists.length === 0 ? "アーティストをカンマで区切って入力" : ""}
                          class="flex-1 min-w-[80px] outline-none bg-transparent text-xs"
                        />
                      </div>
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