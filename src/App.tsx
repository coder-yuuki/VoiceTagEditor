import { useState, useEffect, useCallback } from "preact/hooks";
import { confirm } from "@tauri-apps/plugin-dialog";
import { listen } from '@tauri-apps/api/event'
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import "./App.css";

interface Track {
  id: string;
  diskNumber: string;
  trackNumber: string;
  title: string;
  artists: string[];
  currentArtistInput: string;
  filePath?: string; // ファイルパスを追加
}

interface AudioMetadata {
  title?: string;
  artist?: string;
  album_artist?: string;
  album?: string;
  track_number?: string;
  disk_number?: string;
  date?: string;
  genre?: string;
  comment?: string;
  duration?: string;
  bitrate?: string;
  sample_rate?: string;
  codec?: string;
  album_art?: string; // base64 encoded
}

interface AudioFileResult {
  file_path: string;
  metadata?: AudioMetadata;
  error?: string;
}

interface ProgressEvent {
  current: number;
  total: number;
  file_path: string;
  status: string; // "processing" | "completed" | "error"
}

interface AlbumData {
  albumArtwork: string | null;
  albumArtworkPath?: string; // アルバムアートのファイルパスを追加
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

  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState<ProgressEvent | null>(null);

  const [tracks, setTracks] = useState<Track[]>([]);

  // ファイルタイプを判定する関数
  const getFileType = (filePath: string): 'image' | 'audio' | 'unsupported' => {
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp'];
    const audioExtensions = ['.mp3', '.m4a', '.flac', '.ogg', '.wav', '.opus', '.aac', '.wma'];
    const fileExtension = filePath.toLowerCase().substring(filePath.lastIndexOf('.'));
    
    if (imageExtensions.includes(fileExtension)) {
      return 'image';
    } else if (audioExtensions.includes(fileExtension)) {
      return 'audio';
    } else {
      return 'unsupported';
    }
  };
  // ファイルパスからファイル名（拡張子なし）を取得
  const getFileNameWithoutExtension = (filePath: string): string => {
    const fileName = filePath.split('/').pop() || filePath;
    const lastDotIndex = fileName.lastIndexOf('.');
    return lastDotIndex > 0 ? fileName.substring(0, lastDotIndex) : fileName;
  };

  // 新しいトラックIDを生成
  const generateTrackId = (): string => {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  };

  // オーディオファイルを処理する関数
  const processAudioFiles = useCallback(async (filePaths: string[]) => {
    try {
      setIsProcessing(true);
      
      // 最新のトラック状態を取得して重複チェック
      setTracks(currentTracks => {
        // 既存のファイルパスをチェックして重複を除外
        const existingPaths = new Set(currentTracks.map(track => track.filePath).filter(Boolean));

        console.log('既存のファイルパス:', existingPaths);
        console.log(`既存のトラック: ${currentTracks.map(track => track.title).join(', ')}`);
        console.log('ドロップされたファイルパス:', filePaths);
        
        const newFilePaths = filePaths.filter(path => !existingPaths.has(path));
        
        console.log('重複除外後のファイルパス:', newFilePaths);
        
        if (newFilePaths.length === 0) {
          console.log('すべてのファイルは既に読み込み済みです');
          confirm('選択されたファイルはすべて既に読み込み済みです。', {
            title: '重複ファイル',
            kind: 'info'
          });
          setIsProcessing(false);
          return currentTracks; // 状態変更なし
        }
        
        if (newFilePaths.length < filePaths.length) {
          const skippedCount = filePaths.length - newFilePaths.length;
          console.log(`${skippedCount}個のファイルは既に読み込み済みのためスキップします`);
        }

        // 非同期処理を開始（状態は後で更新）
        processNewFiles(newFilePaths);
        
        return currentTracks; // 現時点では状態変更なし
      });
    } catch (error) {
      console.error('オーディオファイルの処理エラー:', error);
      setIsProcessing(false);
    }
  }, []);

  // 実際のファイル処理を行う関数
  const processNewFiles = async (newFilePaths: string[]) => {
    try {
      
      // FFmpegのチェック
      const ffmpegAvailable = await invoke<boolean>('check_ffmpeg');
      if (!ffmpegAvailable) {
        await confirm('オーディオファイルの処理にはFFmpegが必要です。\n\nFFmpegをインストールしてください。\nhttps://ffmpeg.org/download.html', {
          title: 'FFmpegがインストールされていません',
          kind: 'warning'
        });
        return;
      }

      // 重複していないオーディオファイルのみを処理
      const results = await invoke<AudioFileResult[]>('process_audio_files', {
        filePaths: newFilePaths
      });

      // 結果を処理してトラックリストに追加
      const newTracks: Track[] = [];
      let hasAlbumArt = false;
      let albumArtData = '';

      for (const result of results) {
        if (result.error) {
          console.error(`ファイル ${result.file_path} の処理エラー: ${result.error}`);
          continue;
        }

        if (result.metadata) {
          const metadata = result.metadata;
          
          // アルバムアートを取得（最初のファイルからのみ）
          if (!hasAlbumArt && metadata.album_art) {
            hasAlbumArt = true;
            albumArtData = `data:image/jpeg;base64,${metadata.album_art}`;
            setAlbumData(prev => ({
              ...prev,
              albumArtwork: albumArtData,
              albumTitle: metadata.album || prev.albumTitle,
              albumArtist: metadata.album_artist || prev.albumArtist,
              releaseDate: metadata.date || prev.releaseDate
            }));
          }

          // トラック情報を作成
          const newTrack: Track = {
            id: generateTrackId(),
            diskNumber: metadata.disk_number || '01',
            trackNumber: metadata.track_number || '01',
            title: metadata.title || getFileNameWithoutExtension(result.file_path),
            artists: metadata.artist ? [metadata.artist] : [],
            currentArtistInput: '',
            filePath: result.file_path
          };

          newTracks.push(newTrack);
        }
      }

      // トラックリストに追加
      if (newTracks.length > 0) {
        setTracks(prev => [...prev, ...newTracks]);
      }

    } catch (error) {
      console.error('オーディオファイルの処理エラー:', error);
      await confirm(`オーディオファイルの処理中にエラーが発生しました。\n\nエラー: ${error}`, {
        title: 'エラー',
        kind: 'error'
      });
    } finally {
      setIsProcessing(false);
      setProcessingProgress(null);
    }
  };

  // プログレスイベントリスナー
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setupProgressListener = async () => {
      try {
        unlisten = await listen<ProgressEvent>('audio-processing-progress', (event) => {
          setProcessingProgress(event.payload);
        });
      } catch (error) {
        console.error('プログレスリスナーの設定に失敗:', error);
      }
    };

    setupProgressListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

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
          
          if (paths.length === 0) return;

          // ファイルタイプで分類
          const imagePaths: string[] = [];
          const audioPaths: string[] = [];
          const directoryPaths: string[] = [];
          const unsupportedPaths: string[] = [];

          // パスが拡張子を持つかどうかで判断（拡張子なし=フォルダ）
          for (const path of paths) {
            const hasExtension = path.includes('.') && path.lastIndexOf('.') > path.lastIndexOf('/');
            
            if (!hasExtension) {
              // 拡張子がない場合はディレクトリとして扱う
              console.log(`Found directory: ${path}`);
              directoryPaths.push(path);
              continue;
            }

            // ファイルの場合はタイプで分類
            const fileType = getFileType(path);
            switch (fileType) {
              case 'image':
                imagePaths.push(path);
                break;
              case 'audio':
                audioPaths.push(path);
                break;
              default:
                unsupportedPaths.push(path);
                break;
            }
          }

          // ディレクトリから音声ファイルを取得
          let directoryAudioFiles: string[] = [];
          if (directoryPaths.length > 0) {
            console.log('Processing directories:', directoryPaths);
            
            for (const dirPath of directoryPaths) {
              try {
                const files = await invoke<string[]>('scan_directory_for_audio_files', {
                  directoryPath: dirPath
                });
                directoryAudioFiles.push(...files);
                console.log(`Found ${files.length} audio files in ${dirPath}`);
              } catch (error) {
                console.error(`Error scanning directory ${dirPath}:`, error);
                await confirm(`ディレクトリの処理中にエラーが発生しました:
${dirPath}

エラー: ${error}`, {
                  title: 'ディレクトリスキャンエラー',
                  kind: 'error'
                });
              }
            }
          }

          // すべての音声ファイルパスを結合
          const allAudioPaths = [...audioPaths, ...directoryAudioFiles];

          // サポートされていないファイルがある場合は警告
          if (unsupportedPaths.length > 0) {
            console.warn('サポートされていないファイル:', unsupportedPaths);
          }

          // 画像ファイルの処理（最初の1つだけ）
          if (imagePaths.length > 0) {
            const filePath = imagePaths[0];
            console.log('Processing image file:', filePath);
            const artworkUrl = convertFileSrc(filePath);
            setAlbumData(prev => ({
              ...prev,
              albumArtwork: artworkUrl,
              albumArtworkPath: filePath
            }));
          }

          // オーディオファイルの処理
          if (allAudioPaths.length > 0) {
            console.log('Processing audio files:', allAudioPaths);
            console.log(`Total audio files found: ${allAudioPaths.length}`);
            await processAudioFiles(allAudioPaths);
          }

          // 処理結果を表示
          if (directoryPaths.length > 0) {
            const totalFound = directoryAudioFiles.length;
            if (totalFound > 0) {
              console.log(`ディレクトリから${totalFound}個の音声ファイルを発見しました`);
            } else {
              await confirm('ドロップされたフォルダに音声ファイルが見つかりませんでした。', {
                title: '音声ファイルなし',
                kind: 'info'
              });
            }
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
  // 一括削除処理
  const handleClearAll = async () => {
    if (tracks.length === 0) {
      return; // データがない場合は何もしない
    }

    const confirmMessage = `すべてのデータを削除しますか？

この操作により以下がリセットされます：
• すべてのトラック
• アルバム情報
• アルバムアートワーク

この操作は取り消せません。`;

    try {
      const userConfirmed = await confirm(confirmMessage, {
        title: "全データ削除の確認",
        kind: "warning"
      });

      if (userConfirmed) {
        // 全データをリセット
        setTracks([]);
        setAlbumData({
          albumTitle: '',
          albumArtist: '',
          releaseDate: '',
          tags: [],
          currentTagInput: '',
          albumArtwork: '',
          albumArtworkPath: ''
        });
        console.log("All data cleared successfully");
      }
    } catch (error) {
      console.error("Error showing clear all dialog:", error);
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
              Drop image file here
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
        <div class="px-5 py-4 bg-gray-50 border-b border-gray-300 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <button 
              onClick={handleSort}
              class="px-3 py-1 border border-gray-300 rounded bg-white text-xs hover:bg-gray-50 transition-colors"
            >
              ソート
            </button>
            {isProcessing && (
              <div class="flex items-center gap-2 text-sm text-blue-600">
                <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span>
                  {processingProgress ? 
                    `処理中... ${processingProgress.current}/${processingProgress.total} (${processingProgress.file_path.split('/').pop() || processingProgress.file_path})` : 
                    'オーディオファイルを処理中...'
                  }
                </span>
              </div>
            )}
          </div>
          
          {/* 一括削除ボタン */}
          <button 
            onClick={handleClearAll}
            disabled={tracks.length === 0}
            class="px-3 py-1 border border-red-300 rounded bg-red-500 text-white text-xs hover:bg-red-600 hover:border-red-400 transition-colors disabled:bg-gray-300 disabled:border-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed"
          >
            🗑️ すべて削除
          </button>
        </div>

        <div class="flex-1 overflow-auto">
          {tracks.length === 0 && !isProcessing && (
            <div class="flex items-center justify-center h-64 text-gray-500">
              <div class="text-center">
                <div class="text-lg mb-2">🎵</div>
                <div class="text-sm">
                  音声ファイルまたはフォルダをここにドロップしてください<br />
                  <span class="text-xs text-gray-400">
                    サポートファイル: MP3, M4A, FLAC, OGG, WAV, OPUS, AAC, WMA<br />
                    フォルダをドロップすると、サブフォルダも含めて音声ファイルを自動検索します
                  </span>
                </div>
              </div>
            </div>
          )}
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