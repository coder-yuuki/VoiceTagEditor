import { useState } from 'preact/hooks';
import {
  ChevronDown,
  FolderOpen,
  HelpCircle,
  Info,
  MoreHorizontal,
  RefreshCw,
  Save,
  SortAsc,
  Trash2,
  Upload,
} from 'lucide-preact';
import type { AppMode } from '../types';

interface AppToolbarProps {
  mode: AppMode;
  hasTracks: boolean;
  isFfmpegReady: boolean;
  isUpdateChecking: boolean;
  onModeChange: (mode: AppMode) => void;
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
  mode,
  hasTracks,
  isFfmpegReady,
  isUpdateChecking,
  onModeChange,
  onSort,
  onPickAudioFiles,
  onPickDirectories,
  onCheckForUpdates,
  onShowAbout,
  onShowGuide,
  onClearAll,
  onExport,
}: AppToolbarProps) {
  const [showMenu, setShowMenu] = useState(false);
  const commonButtonClass = 'inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm transition-colors hover:border-zinc-400 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50';

  const runMenuAction = (action: () => void) => {
    setShowMenu(false);
    action();
  };

  return (
    <header class="shrink-0 border-b border-zinc-200 bg-white px-4 py-3">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex min-w-0 flex-wrap items-center gap-2">
          <div class="mr-2 hidden min-w-0 xl:block">
            <div class="truncate text-sm font-bold text-zinc-900">VoiceTagEditor</div>
            {mode === 'simple' && (
              <div class="truncate text-[11px] text-zinc-500">音声の情報を整えて保存</div>
            )}
          </div>

          <button
            type="button"
            onClick={onPickAudioFiles}
            disabled={!isFfmpegReady}
            class={commonButtonClass}
            title={isFfmpegReady ? '音声ファイルを追加' : '音声機能の準備が終わるまでお待ちください'}
          >
            <Upload size={16} />
            <span>ファイルを追加</span>
          </button>
          <button
            type="button"
            onClick={onPickDirectories}
            disabled={!isFfmpegReady}
            class={commonButtonClass}
            title={isFfmpegReady ? 'フォルダ内の音声をまとめて追加' : '音声機能の準備が終わるまでお待ちください'}
          >
            <FolderOpen size={16} />
            <span>フォルダを追加</span>
          </button>

          {(mode === 'advanced' || hasTracks) && (
            <button type="button" onClick={onSort} disabled={!hasTracks} class={commonButtonClass}>
              <SortAsc size={16} />
              <span>{mode === 'simple' ? '番号順に並べ替え' : 'ソート'}</span>
            </button>
          )}
        </div>

        <div class="flex shrink-0 flex-wrap items-center gap-2">
          {mode === 'advanced' && (
            <>
              <button
                type="button"
                onClick={onCheckForUpdates}
                disabled={isUpdateChecking}
                class={commonButtonClass}
                title="更新を確認"
              >
                <RefreshCw size={15} class={isUpdateChecking ? 'animate-spin' : ''} />
                <span>更新確認</span>
              </button>
              <button type="button" onClick={onShowAbout} class={commonButtonClass}>
                <Info size={15} />
                <span>情報</span>
              </button>
              <button
                type="button"
                onClick={onClearAll}
                disabled={!hasTracks}
                class={`${commonButtonClass} text-red-600 hover:border-red-300 hover:bg-red-50`}
              >
                <Trash2 size={15} />
                <span>すべて削除</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={onShowGuide}
            class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-300 bg-white text-zinc-600 shadow-sm hover:bg-zinc-50"
            aria-label="使い方を見る"
            title="使い方を見る"
          >
            <HelpCircle size={17} />
          </button>

          {mode === 'simple' && (
            <div class="relative">
              <button
                type="button"
                onClick={() => setShowMenu((current) => !current)}
                class="inline-flex h-9 items-center gap-1 rounded-lg border border-zinc-300 bg-white px-2.5 text-zinc-600 shadow-sm hover:bg-zinc-50"
                aria-expanded={showMenu}
                aria-label="その他の操作"
              >
                <MoreHorizontal size={18} />
                <ChevronDown size={13} />
              </button>
              {showMenu && (
                <div class="absolute right-0 top-11 z-30 w-52 overflow-hidden rounded-xl border border-zinc-200 bg-white py-1 shadow-xl">
                  <button
                    type="button"
                    onClick={() => runMenuAction(onCheckForUpdates)}
                    disabled={isUpdateChecking}
                    class="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                  >
                    <RefreshCw size={15} />
                    更新を確認
                  </button>
                  <button
                    type="button"
                    onClick={() => runMenuAction(onShowAbout)}
                    class="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-zinc-700 hover:bg-zinc-50"
                  >
                    <Info size={15} />
                    このアプリについて
                  </button>
                  <div class="my-1 border-t border-zinc-100" />
                  <button
                    type="button"
                    onClick={() => runMenuAction(onClearAll)}
                    disabled={!hasTracks}
                    class="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 disabled:opacity-40"
                  >
                    <Trash2 size={15} />
                    読み込んだ内容をすべて消す
                  </button>
                </div>
              )}
            </div>
          )}

          <div class="ml-1 flex rounded-lg border border-zinc-300 bg-zinc-100 p-0.5" aria-label="表示モード">
            <button
              type="button"
              onClick={() => onModeChange('simple')}
              class={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                mode === 'simple' ? 'bg-white text-blue-700 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              かんたん
            </button>
            <button
              type="button"
              onClick={() => onModeChange('advanced')}
              class={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                mode === 'advanced' ? 'bg-white text-blue-700 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              詳細
            </button>
          </div>

          <button
            type="button"
            onClick={onExport}
            disabled={!hasTracks || !isFfmpegReady}
            class="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            title={!isFfmpegReady ? '音声機能の準備が終わるまでお待ちください' : !hasTracks ? '先に音声ファイルを追加してください' : '編集した音声を保存'}
          >
            <Save size={17} />
            <span>保存</span>
          </button>
        </div>
      </div>
    </header>
  );
}
