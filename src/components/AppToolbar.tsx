import {
  FolderOpen,
  HelpCircle,
  Info,
  RefreshCw,
  SortAsc,
  Trash2,
  Upload,
} from 'lucide-preact';

interface AppToolbarProps {
  hasTracks: boolean;
  isFfmpegReady: boolean;
  isUpdateChecking: boolean;
  onSort: () => void;
  onPickAudioFiles: () => void;
  onPickDirectories: () => void;
  onCheckForUpdates: () => void;
  onShowAbout: () => void;
  onShowGuide: () => void;
  onClearAll: () => void;
  onExport: () => void;
}

export function AppToolbar({
  hasTracks,
  isFfmpegReady,
  isUpdateChecking,
  onSort,
  onPickAudioFiles,
  onPickDirectories,
  onCheckForUpdates,
  onShowAbout,
  onShowGuide,
  onClearAll,
  onExport,
}: AppToolbarProps) {
  return (
    <div class="px-5 py-3 bg-white border-b border-zinc-200 flex items-center justify-between shrink-0">
      <div class="flex items-center gap-2">
        <button
          onClick={onSort}
          class="inline-flex items-center gap-1.5 px-3 py-1.5 border border-zinc-300 rounded-md bg-white text-zinc-700 text-xs font-medium hover:bg-zinc-50 hover:border-zinc-400 transition-all shadow-sm"
        >
          <SortAsc size={14} />
          <span>ソート</span>
        </button>
        <button
          onClick={onPickAudioFiles}
          disabled={!isFfmpegReady}
          class="inline-flex items-center gap-1.5 px-3 py-1.5 border border-zinc-300 rounded-md bg-white text-zinc-700 text-xs font-medium hover:bg-zinc-50 hover:border-zinc-400 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Upload size={14} />
          <span>ファイル追加</span>
        </button>
        <button
          onClick={onPickDirectories}
          disabled={!isFfmpegReady}
          class="inline-flex items-center gap-1.5 px-3 py-1.5 border border-zinc-300 rounded-md bg-white text-zinc-700 text-xs font-medium hover:bg-zinc-50 hover:border-zinc-400 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FolderOpen size={14} />
          <span>フォルダ追加</span>
        </button>
      </div>

      <div class="flex items-center gap-2">
        <button
          onClick={onCheckForUpdates}
          disabled={isUpdateChecking}
          class="inline-flex items-center gap-1.5 px-3 py-1.5 border border-zinc-300 rounded-md bg-white text-zinc-600 text-xs font-medium hover:bg-zinc-50 hover:text-zinc-900 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          title="更新を確認"
        >
          <RefreshCw size={14} />
          <span>更新確認</span>
        </button>
        <button
          onClick={onShowAbout}
          class="inline-flex items-center gap-1.5 px-3 py-1.5 border border-zinc-300 rounded-md bg-white text-zinc-600 text-xs font-medium hover:bg-zinc-50 hover:text-zinc-900 transition-all shadow-sm"
        >
          <Info size={14} />
          <span>情報</span>
        </button>
        <button
          onClick={onShowGuide}
          class="inline-flex items-center gap-1.5 px-3 py-1.5 border border-zinc-300 rounded-md bg-white text-zinc-600 text-xs font-medium hover:bg-zinc-50 hover:text-zinc-900 transition-all shadow-sm"
        >
          <HelpCircle size={14} />
          <span>ガイド</span>
        </button>
        <button
          onClick={onClearAll}
          disabled={!hasTracks}
          class="inline-flex items-center gap-1.5 px-3 py-1.5 border border-zinc-300 rounded-md bg-white text-red-600 text-xs font-medium hover:bg-red-50 hover:border-red-300 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:border-zinc-300"
        >
          <Trash2 size={14} />
          <span>すべて削除</span>
        </button>
        <button
          onClick={onExport}
          disabled={!hasTracks || !isFfmpegReady}
          class="inline-flex items-center gap-1.5 px-3 py-1.5 border border-transparent rounded-md bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600"
        >
          <Upload size={14} />
          <span>出力</span>
        </button>
      </div>
    </div>
  );
}
