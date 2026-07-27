import { FolderOpen, Save, Settings2, ShieldCheck } from 'lucide-preact';
import type { AppMode, ExportSettings, QualityOption } from '../types';

interface ExportDialogProps {
  mode: AppMode;
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
  mode,
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

  const simple = mode === 'simple';
  const tagOnly = settings.encodeMode === 'copy';

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm">
      <div class="max-h-[90vh] w-full max-w-md overflow-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div class="flex items-start gap-3">
          <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <Save size={22} />
          </div>
          <div>
            <h2 class="text-xl font-bold text-zinc-900">編集した音声を保存</h2>
            {simple && (
              <p class="mt-1 text-sm leading-5 text-zinc-600">
                保存する場所を選ぶだけで、おすすめ設定を使って保存します。
              </p>
            )}
          </div>
        </div>

        <div class="mt-6">
          <label class="block text-sm font-semibold text-zinc-800">保存先フォルダ</label>
          <div class="mt-2 flex gap-2">
            <div class="min-w-0 flex-1 truncate rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-600">
              {settings.outputPath || 'まだ選ばれていません'}
            </div>
            <button
              type="button"
              onClick={onSelectOutputFolder}
              class="inline-flex shrink-0 items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
            >
              <FolderOpen size={17} />
              選ぶ
            </button>
          </div>
          {simple && settings.outputPath && (
            <p class="mt-2 text-xs leading-5 text-zinc-500">
              選んだ場所の中に、サークル名・音声作品名のフォルダを作って保存します。
            </p>
          )}
        </div>

        {simple ? (
          <div class="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div class="flex items-center gap-2 text-sm font-semibold text-emerald-800">
              <ShieldCheck size={18} />
              おすすめ設定
            </div>
            <dl class="mt-3 grid grid-cols-[7rem_1fr] gap-y-2 text-sm">
              <dt class="text-emerald-700">保存形式</dt>
              <dd class="font-medium text-emerald-950">MP3</dd>
              <dt class="text-emerald-700">音質</dt>
              <dd class="font-medium text-emerald-950">高</dd>
              <dt class="text-emerald-700">同名ファイル</dt>
              <dd class="font-medium text-emerald-950">元を残して別名で保存</dd>
            </dl>
          </div>
        ) : (
          <div class="mt-6 space-y-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <div class="flex items-center gap-2 text-sm font-semibold text-zinc-800">
              <Settings2 size={17} />
              詳細設定
            </div>

            <div>
              <label class="block text-xs font-semibold uppercase tracking-wider text-zinc-500">同名ファイルの処理</label>
              <select
                value={settings.overwriteMode}
                onChange={(event) => onSettingsChange({
                  ...settings,
                  overwriteMode: event.currentTarget.value as ExportSettings['overwriteMode'],
                })}
                class="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="rename">別名で保存</option>
                <option value="overwrite">上書き保存</option>
              </select>
            </div>

            <div>
              <label class="block text-xs font-semibold uppercase tracking-wider text-zinc-500">フォーマット</label>
              <select
                value={settings.format}
                onChange={(event) => onFormatChange(event.currentTarget.value as ExportSettings['format'])}
                class="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="MP3">MP3</option>
                <option value="M4A">M4A (AAC)</option>
              </select>
            </div>

            <div>
              <label class="block text-xs font-semibold uppercase tracking-wider text-zinc-500">保存方法</label>
              <select
                value={settings.encodeMode}
                onChange={(event) => onSettingsChange({
                  ...settings,
                  encodeMode: event.currentTarget.value as ExportSettings['encodeMode'],
                })}
                class="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="reencode">再エンコードする</option>
                <option value="copy">可能な場合はタグのみ更新</option>
              </select>
              <p class="mt-1.5 text-xs leading-5 text-zinc-500">
                {tagOnly
                  ? '元ファイルが保存形式と同じ場合、音声を再エンコードせずタグとカバーだけ更新します。形式が違う場合は通常どおり変換します。'
                  : '選択した音質で音声を変換して保存します。'}
              </p>
            </div>

            <div>
              <label class="block text-xs font-semibold uppercase tracking-wider text-zinc-500">音質</label>
              <select
                value={settings.quality}
                onChange={(event) => onSettingsChange({
                  ...settings,
                  quality: event.currentTarget.value as ExportSettings['quality'],
                })}
                disabled={tagOnly}
                class="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400"
              >
                {qualityOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {tagOnly && (
                <p class="mt-1.5 text-xs leading-5 text-zinc-500">
                  タグのみ更新時は元の音質を維持します。形式違いで変換する場合のみ、上記の音質が使われます。
                </p>
              )}
            </div>
          </div>
        )}

        <div class="mt-6 flex justify-end gap-3 border-t border-zinc-100 pt-4">
          <button
            type="button"
            onClick={onCancel}
            class="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={onExport}
            disabled={!settings.outputPath}
            class="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save size={17} />
            保存を開始
          </button>
        </div>
      </div>
    </div>
  );
}
