import { useState, useEffect, useCallback } from "preact/hooks";
import { confirm } from "@tauri-apps/plugin-dialog";
import { open } from "@tauri-apps/plugin-dialog";
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
  tags?: string[]; // TXXX tags
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

interface ConvertProgress {
  current: number;
  total: number;
  currentFile: string;
  status: string;
  percent: number;
}

interface ConvertResult {
  success: boolean;
  converted_files: string[];
  failed_files: ConvertError[];
  total_processed: number;
}

interface ConvertError {
  source_path: string;
  error_message: string;
}

interface AlbumData {
  albumArtwork: string | null;
  albumArtworkPath?: string; // アルバムアートのファイルパスを追加
  albumArtworkCachePath?: string; // キャッシュされたアルバムアートのパス
  albumTitle: string;
  albumArtist: string;
  releaseDate: string;
  tags: string[];
  currentTagInput: string;
}

interface ExportSettings {
  outputPath: string;
  overwriteMode: 'overwrite' | 'rename'; // 上書き or 別名
  format: 'MP3';
  quality: 'highest' | 'high' | 'medium' | 'low';
}

function App() {
  const [albumData, setAlbumData] = useState<AlbumData>({
    albumArtwork: null,
    albumTitle: "Album Title",
    albumArtist: "Album Artist",
    releaseDate: "2000-01-01",
    tags: [],
    currentTagInput: "",
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState<ProgressEvent | null>(null);
  const [convertProgress, setConvertProgress] = useState<ConvertProgress | null>(null);

  const [tracks, setTracks] = useState<Track[]>([]);

  // 出力設定の状態管理
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportSettings, setExportSettings] = useState<ExportSettings>({
    outputPath: '',
    overwriteMode: 'rename',
    format: 'MP3',
    quality: 'high'
  });

  // フォーマットに応じた音質設定のオプションを取得
  const getQualityOptions = (format: ExportSettings['format']) => {
    switch (format) {
      case 'MP3':
      default:
        return [
          { value: 'highest', label: '最高' },
          { value: 'high', label: '高' },
          { value: 'medium', label: '中' },
          { value: 'low', label: '低' }
        ];
    }
  };

  // フォーマット変更時に音質設定をリセット
  const handleFormatChange = (newFormat: ExportSettings['format']) => {
    setExportSettings(prev => ({
      ...prev,
      format: newFormat,
      quality: 'high' // デフォルトに戻す
    }));
  };

  // 数字変換関数（"02" → "2", 非数字 → ""）
  const normalizeNumberString = (value: string): string => {
    // 数字以外の文字を除去
    const digitsOnly = value.replace(/[^0-9]/g, '');
    
    if (digitsOnly === '') {
      return '';
    }
    
    // 先頭の0を除去して数字に変換、再度文字列に
    const numberValue = parseInt(digitsOnly, 10);
    // NaNチェックと0の場合の処理
    if (isNaN(numberValue)) {
      return '';
    }
    
    return numberValue.toString();
  };

  // 数字のみ入力を受け付ける関数
  const handleNumberInput = (value: string): string => {
    // 数字以外の文字を除去
    return value.replace(/[^0-9]/g, '');
  };

  // ファイルタイプを判定する関数
  const getFileType = (filePath: string): 'image' | 'audio' | 'unsupported' => {
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp'];
    const audioExtensions = ['.mp3', '.m4a', '.flac', '.ogg', '.wav', '.aac', '.wma'];
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
      let allTags: string[] = [];

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
            
            // アルバムアートをキャッシュに保存
            try {
              const cachePath = await invoke<string>('save_album_art_to_cache', {
                base64Data: metadata.album_art,
                albumTitle: metadata.album || 'Unknown Album',
                albumArtist: metadata.album_artist || 'Unknown Artist'
              });
              
              setAlbumData(prev => ({
                ...prev,
                albumArtwork: albumArtData,
                albumArtworkCachePath: cachePath,
                albumTitle: metadata.album || prev.albumTitle,
                albumArtist: metadata.album_artist || prev.albumArtist,
                releaseDate: metadata.date || prev.releaseDate
              }));
            } catch (error) {
              console.error('アルバムアートキャッシュ保存エラー:', error);
              // キャッシュ保存に失敗してもアルバムアートは表示
              setAlbumData(prev => ({
                ...prev,
                albumArtwork: albumArtData,
                albumTitle: metadata.album || prev.albumTitle,
                albumArtist: metadata.album_artist || prev.albumArtist,
                releaseDate: metadata.date || prev.releaseDate
              }));
            }
          }
          
          // タグを収集（重複を避けて追加）
          if (metadata.tags && metadata.tags.length > 0) {
            for (const tag of metadata.tags) {
              if (!allTags.includes(tag)) {
                allTags.push(tag);
              }
            }
          }

          // トラック情報を作成
          const newTrack: Track = {
            id: generateTrackId(),
            diskNumber: normalizeNumberString(metadata.disk_number || '1'),
            trackNumber: normalizeNumberString(metadata.track_number || '1'),
            title: metadata.title || getFileNameWithoutExtension(result.file_path),
            artists: metadata.artist ? metadata.artist.split(';').map(a => a.trim()).filter(a => a.length > 0) : [],
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
      
      // 収集したタグをアルバムデータに追加
      if (allTags.length > 0) {
        setAlbumData(prev => {
          const existingTags = new Set(prev.tags);
          const newTags = allTags.filter(tag => !existingTags.has(tag));
          if (newTags.length > 0) {
            return {
              ...prev,
              tags: [...prev.tags, ...newTags]
            };
          }
          return prev;
        });
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
  // 出力設定ダイアログを表示
  const handleExport = async () => {
    if (tracks.length === 0) {
      return; // データがない場合は何もしない
    }
    setShowExportDialog(true);
  };

  // フォルダ選択処理
  const handleSelectOutputFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: '出力先フォルダを選択'
      });
      
      if (selected && typeof selected === 'string') {
        setExportSettings(prev => ({ ...prev, outputPath: selected }));
      }
    } catch (error) {
      console.error('フォルダ選択エラー:', error);
    }
  };

  // 実際の出力処理
  const handleActualExport = async () => {
    try {
      // バリデーション
      if (!exportSettings.outputPath) {
        await confirm('出力先フォルダを選択してください。', {
          title: '入力エラー',
          kind: 'warning'
        });
        return;
      }

      setShowExportDialog(false);
      setIsProcessing(true);
      
      // トラックデータを変換用の形式に変換
      const convertTracks = tracks.map(track => ({
        source_path: track.filePath || '',
        disk_number: track.diskNumber || '1',
        track_number: track.trackNumber || '1',
        title: track.title,
        artists: track.artists,
      }));
      
      // アルバムデータを変換用の形式に変換
      const convertAlbumData = {
        album_title: albumData.albumTitle,
        album_artist: albumData.albumArtist,
        release_date: albumData.releaseDate,
        tags: albumData.tags,
        album_artwork_path: albumData.albumArtworkPath,
        album_artwork_cache_path: albumData.albumArtworkCachePath,
        album_artwork: albumData.albumArtwork,
      };
      
      // 音質設定をバックエンド形式に変換
      const convertQuality = (format: string, quality: string): string => {
        switch (format) {
          case 'MP3':
            switch (quality) {
              case 'highest': return '320';
              case 'high': return '256';
              case 'medium': return '192';
              case 'low': return '128';
              default: return '192';
            }
          default:
            return '192';
        }
      };
      
      // 出力設定を変換用の形式に変換
      const convertOutputSettings = {
        output_path: exportSettings.outputPath,
        format: exportSettings.format,
        quality: convertQuality(exportSettings.format, exportSettings.quality),
        overwrite_mode: exportSettings.overwriteMode,
      };
      
      // 変換リクエストを作成
      const convertRequest = {
        tracks: convertTracks,
        album_data: convertAlbumData,
        output_settings: convertOutputSettings,
      };
      
      console.log('=== 変換処理開始 ===');
      console.log('リクエストデータ:', convertRequest);
      
      // 進捗イベントリスナーを設定
      const unlistenProgress = await listen('convert-progress', (event: any) => {
        const progress = event.payload;
        console.log(`進捗: ${progress.current}/${progress.total} - ${progress.current_file} (${progress.status})`);
        
        // ここで進捗表示UIを更新可能
        setConvertProgress({
          current: progress.current,
          total: progress.total,
          currentFile: progress.current_file,
          status: progress.status,
          percent: progress.progress_percent,
        });
      });
      
      try {
        // Tauriコマンドを呼び出し
        const result = await invoke<ConvertResult>('convert_audio_files', { request: convertRequest });
        console.log('変換結果:', result);
        
        setIsProcessing(false);
        setConvertProgress(null);
        
        // 結果ダイアログを表示
        const resultMessage = result.success 
          ? `変換が完了しました！\n成功: ${result.converted_files.length}ファイル\n失敗: ${result.failed_files.length}ファイル`
          : `変換が完了しましたが、一部エラーがありました。\n成功: ${result.converted_files.length}ファイル\n失敗: ${result.failed_files.length}ファイル\nエラー詳細:${result.failed_files.map(f => `• ${f.source_path}: ${f.error_message}`).join('')}`;
          
        await confirm(resultMessage, {
          title: result.success ? '変換完了' : '変換完了（一部エラー）',
          kind: result.success ? 'info' : 'warning'
        });
        
        unlistenProgress();
        
      } catch (invokeError) {
        console.error('Tauri invoke エラー:', invokeError);
        setIsProcessing(false);
        setConvertProgress(null);
        unlistenProgress();
        
        await confirm(`変換処理中にエラーが発生しました。

エラー: ${invokeError}`, {
          title: 'エラー',
          kind: 'error'
        });
      }
      
    } catch (error) {
      console.error('出力処理エラー:', error);
      setIsProcessing(false);
      setConvertProgress(null);
      
      await confirm(`出力処理中にエラーが発生しました。

エラー: ${error}`, {
        title: 'エラー',
        kind: 'error'
      });
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
          albumArtworkPath: '',
          albumArtworkCachePath: ''
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
                  {convertProgress ? 
                    `変換中... ${convertProgress.current}/${convertProgress.total} - ${convertProgress.currentFile} (${Math.round(convertProgress.percent)}%)` :
                    processingProgress ? 
                      `処理中... ${processingProgress.current}/${processingProgress.total} (${processingProgress.file_path.split('/').pop() || processingProgress.file_path})` : 
                      'オーディオファイルを処理中...'
                  }
                </span>
              </div>
            )}
          </div>
          
          <div class="flex items-center gap-2">
            {/* 一括削除ボタン */}
            <button 
              onClick={handleClearAll}
              disabled={tracks.length === 0}
              class="px-3 py-1 border border-red-300 rounded bg-red-500 text-white text-xs hover:bg-red-600 hover:border-red-400 transition-colors disabled:bg-gray-300 disabled:border-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed"
            >
              🗑️ すべて削除
            </button>
            
            {/* 出力ボタン */}
            <button 
              onClick={handleExport}
              disabled={tracks.length === 0}
              class="px-3 py-1 border border-green-300 rounded bg-green-500 text-white text-xs hover:bg-green-600 hover:border-green-400 transition-colors disabled:bg-gray-300 disabled:border-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed"
            >
              📤 出力
            </button>
          </div>
        </div>

        <div class="flex-1 overflow-auto">
          {tracks.length === 0 && !isProcessing && (
            <div class="flex items-center justify-center h-64 text-gray-500">
              <div class="text-center">
                <div class="text-lg mb-2">🎵</div>
                <div class="text-sm">
                  音声ファイルまたはフォルダをここにドロップしてください<br />
                  <span class="text-xs text-gray-400">
                    サポートファイル: MP3, M4A, FLAC, OGG, WAV, AAC, WMA<br />
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
                      onInput={(e) => {
                        const numericValue = handleNumberInput(e.currentTarget.value);
                        handleTrackChange(track.id, 'diskNumber', numericValue);
                      }}
                      placeholder="1"
                      class="w-12 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:border-blue-500"
                    />
                  </td>
                  <td class="px-2 py-2 border-b border-gray-200">
                    <input
                      type="text"
                      value={track.trackNumber}
                      onInput={(e) => {
                        const numericValue = handleNumberInput(e.currentTarget.value);
                        handleTrackChange(track.id, 'trackNumber', numericValue);
                      }}
                      placeholder="1"
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

      {/* 出力設定ダイアログ */}
      {showExportDialog && (
        <div class="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
          <div class="bg-white rounded-lg p-6 w-96 max-w-[90vw] max-h-[90vh] overflow-auto">
            <h2 class="text-lg font-semibold mb-4 text-gray-800">出力設定</h2>
            
            {/* 保存先フォルダ */}
            <div class="mb-4">
              <label class="block text-sm font-medium text-gray-700 mb-2">保存先フォルダ</label>
              <div class="flex gap-2">
                <input
                  type="text"
                  value={exportSettings.outputPath}
                  placeholder="フォルダを選択してください"
                  readonly
                  class="flex-1 px-3 py-2 border border-gray-300 rounded text-sm bg-gray-50 focus:outline-none"
                />
                <button
                  onClick={handleSelectOutputFolder}
                  class="px-3 py-2 border border-blue-300 rounded bg-blue-500 text-white text-sm hover:bg-blue-600 transition-colors whitespace-nowrap"
                >
                  📁 選択
                </button>
              </div>
            </div>

            {/* 同名ファイル処理 */}
            <div class="mb-4">
              <label class="block text-sm font-medium text-gray-700 mb-2">同名ファイルの処理</label>
              <select
                value={exportSettings.overwriteMode}
                onChange={(e) => setExportSettings(prev => ({ 
                  ...prev, 
                  overwriteMode: e.currentTarget.value as 'overwrite' | 'rename' 
                }))}
                class="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="rename">別名で保存</option>
                <option value="overwrite">上書き保存</option>
              </select>
            </div>

            {/* ファイル形式 */}
            <div class="mb-4">
              <label class="block text-sm font-medium text-gray-700 mb-2">ファイル形式</label>
              <select
                value={exportSettings.format}
                onChange={(e) => handleFormatChange(e.currentTarget.value as ExportSettings['format'])}
                class="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="MP3">MP3</option>
              </select>
            </div>

            {/* 音質設定 */}
            <div class="mb-6">
              <label class="block text-sm font-medium text-gray-700 mb-2">音質設定</label>
              <select
                value={exportSettings.quality}
                onChange={(e) => setExportSettings(prev => ({ 
                  ...prev, 
                  quality: e.currentTarget.value as ExportSettings['quality']
                }))}
                class="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500"
              >
                {getQualityOptions(exportSettings.format).map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* ボタン */}
            <div class="flex gap-3 justify-end">
              <button
                onClick={() => setShowExportDialog(false)}
                class="px-4 py-2 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleActualExport}
                disabled={!exportSettings.outputPath}
                class="px-4 py-2 border border-green-300 rounded bg-green-500 text-white text-sm hover:bg-green-600 transition-colors disabled:bg-gray-300 disabled:border-gray-300 disabled:cursor-not-allowed"
              >
                📤 出力実行
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;