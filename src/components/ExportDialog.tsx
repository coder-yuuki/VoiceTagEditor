import { FolderOpen, Settings, Upload } from 'lucide-preact';
import type { ExportSettings, QualityOption } from '../types';

interface ExportDialogProps {
  isOpen: boolean;
  settings: ExportSettings;
  qualityOptions: QualityOption[];
  onSettingsChange: (settings: ExportSettings) => void;
  onFormatChange: (format: ExportSettings['format']) => void;
  onSelectOutputFolder: () => void;
  onCancel: () => void;
  onExport: () => void;
}

export function ExportDialog({
  isOpen,
  settings,
  qualityOptions,
  onSettingsChange,
  onFormatChange,
  onSelectOutputFolder,
  onCancel,
  onExport,
}: ExportDialogProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div class="fixed inset-0 flex items-center justify-center z-50 backdrop-blur-sm bg-black/30 animate-in fade-in duration-200">
      <div class="bg-white rounded-xl shadow-2xl p-6 w-96 max-w-[90vw] max-h-[90vh] overflow-auto scale-100 animate-in zoom-in-95 duration-200">
        <h2 class="text-lg font-semibold mb-4 text-zinc-800 flex items-center gap-2">
          <Settings size={20} />
          出力設定
        </h2>

        <div class="mb-4">
          <label class="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">保存先フォルダ</label>
          <div class="flex gap-2">
            <input
              type="text"
              value={settings.outputPath}
              placeholder="フォルダを選択..."
              readOnly
              class="flex-1 px-3 py-2 border border-zinc-300 rounded-md text-sm bg-zinc-50 focus:outline-none text-zinc-600"
            />
            <button
              onClick={onSelectOutputFolder}
              class="px-3 py-2 border border-zinc-300 rounded-md bg-white text-zinc-700 text-sm hover:bg-zinc-50 hover:border-zinc-400 transition-colors whitespace-nowrap flex items-center gap-2"
            >
              <FolderOpen size={16} />
            </button>
          </div>
        </div>

        <div class="mb-4">
          <label class="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">同名ファイルの処理</label>
          <select
            value={settings.overwriteMode}
            onChange={(event) => onSettingsChange({
              ...settings,
              overwriteMode: event.currentTarget.value as ExportSettings['overwriteMode'],
            })}
            class="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          >
            <option value="rename">別名で保存</option>
            <option value="overwrite">上書き保存</option>
          </select>
        </div>

        <div class="mb-4">
          <label class="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">フォーマット</label>
          <select
            value={settings.format}
            onChange={(event) => onFormatChange(event.currentTarget.value as ExportSettings['format'])}
            class="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          >
            <option value="MP3">MP3</option>
            <option value="M4A">M4A (AAC)</option>
          </select>
        </div>

        <div class="mb-6">
          <label class="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">音質</label>
          <select
            value={settings.quality}
            onChange={(event) => onSettingsChange({
              ...settings,
              quality: event.currentTarget.value as ExportSettings['quality'],
            })}
            class="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          >
            {qualityOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div class="flex gap-3 justify-end pt-2 border-t border-zinc-100">
          <button
            onClick={onCancel}
            class="px-4 py-2 border border-zinc-300 rounded-md text-sm text-zinc-700 hover:bg-zinc-50 transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={onExport}
            disabled={!settings.outputPath}
            class="px-4 py-2 border border-transparent rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex items-center gap-2"
          >
            <Upload size={16} />
            出力
          </button>
        </div>
      </div>
    </div>
  );
}
