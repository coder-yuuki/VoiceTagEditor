import { useEffect } from 'preact/hooks';
import { FolderOpen, Save, ShieldCheck } from 'lucide-preact';
import { useI18n } from '../i18n';
import type { AppMode, ExportSettings, QualityOption } from '../types';
import { InfoHint } from './Tooltip';

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
  const { t } = useI18n();

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) {
    return null;
  }

  const simple = mode === 'simple';
  const tagOnly = settings.encodeMode === 'copy';

  return (
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div class="max-h-[90vh] w-full max-w-md overflow-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div class="flex items-center gap-3">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <Save size={20} />
          </div>
          <h2 class="text-lg font-bold text-zinc-900">{t.exportDialog.title}</h2>
        </div>

        <div class="mt-5">
          <div class="flex items-center gap-1.5">
            <label class="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              {t.exportDialog.outputFolderLabel}
            </label>
            <InfoHint text={t.exportDialog.outputFolderHint} />
          </div>
          <div class="mt-1.5 flex gap-2">
            <div
              class="min-w-0 flex-1 truncate rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-600"
              title={settings.outputPath || undefined}
            >
              {settings.outputPath || t.exportDialog.outputFolderEmpty}
            </div>
            <button
              type="button"
              onClick={onSelectOutputFolder}
              class="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
            >
              <FolderOpen size={16} />
              {t.common.choose}
            </button>
          </div>
        </div>

        {simple ? (
          <div class="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3.5 py-3 text-xs font-medium text-emerald-800">
            <ShieldCheck size={15} class="shrink-0 text-emerald-600" />
            <span class="rounded-md bg-white/80 px-2 py-0.5 text-emerald-900">MP3</span>
            <span class="rounded-md bg-white/80 px-2 py-0.5 text-emerald-900">{t.wizard.step4.qualityHigh}</span>
            <span class="rounded-md bg-white/80 px-2 py-0.5 text-emerald-900">{t.exportDialog.duplicateRename}</span>
          </div>
        ) : (
          <div class="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <div>
              <label class="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                {t.exportDialog.formatLabel}
              </label>
              <select
                value={settings.format}
                onChange={(event) => onFormatChange(event.currentTarget.value as ExportSettings['format'])}
                class="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="MP3">MP3</option>
                <option value="M4A">M4A (AAC)</option>
              </select>
            </div>

            <div>
              <div class="flex items-center gap-1">
                <label class="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  {t.exportDialog.qualityLabel}
                </label>
                {tagOnly && <InfoHint text={t.exportDialog.qualityCopyHint} align="right" />}
              </div>
              <select
                value={settings.quality}
                onChange={(event) => onSettingsChange({
                  ...settings,
                  quality: event.currentTarget.value as ExportSettings['quality'],
                })}
                disabled={tagOnly}
                class="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400"
              >
                {qualityOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div class="col-span-2">
              <div class="flex items-center gap-1">
                <label class="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  {t.exportDialog.encodeModeLabel}
                </label>
                <InfoHint
                  text={tagOnly ? t.exportDialog.encodeCopyHint : t.exportDialog.encodeReencodeHint}
                />
              </div>
              <select
                value={settings.encodeMode}
                onChange={(event) => onSettingsChange({
                  ...settings,
                  encodeMode: event.currentTarget.value as ExportSettings['encodeMode'],
                })}
                class="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="reencode">{t.exportDialog.encodeReencode}</option>
                <option value="copy">{t.exportDialog.encodeCopy}</option>
              </select>
            </div>

            <div class="col-span-2">
              <label class="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                {t.exportDialog.duplicateModeLabel}
              </label>
              <select
                value={settings.overwriteMode}
                onChange={(event) => onSettingsChange({
                  ...settings,
                  overwriteMode: event.currentTarget.value as ExportSettings['overwriteMode'],
                })}
                class="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="rename">{t.exportDialog.duplicateRename}</option>
                <option value="overwrite">{t.exportDialog.duplicateOverwrite}</option>
              </select>
            </div>
          </div>
        )}

        <div class="mt-5 flex justify-end gap-2.5 border-t border-zinc-100 pt-4">
          <button
            type="button"
            onClick={onCancel}
            class="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            {t.common.cancel}
          </button>
          <button
            type="button"
            onClick={onExport}
            disabled={!settings.outputPath}
            class="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-xs hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save size={16} />
            {t.exportDialog.startSave}
          </button>
        </div>
      </div>
    </div>
  );
}
