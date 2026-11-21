import { useEffect } from 'preact/hooks';
import { AlertCircle, CheckCircle2, FolderOpen, Info, X } from 'lucide-preact';
import { useI18n } from '../i18n';
import type { AppMode } from '../types';

export interface AppDialogOptions {
  title: string;
  message: string;
  guidance?: string;
  technicalDetail?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  tone?: 'error' | 'warning' | 'info' | 'success';
}

interface AppDialogProps {
  options: AppDialogOptions | null;
  mode: AppMode;
  onResult: (confirmed: boolean) => void;
}

export function AppDialog({ options, mode, onResult }: AppDialogProps) {
  const { t } = useI18n();

  useEffect(() => {
    if (!options) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onResult(options.cancelLabel ? false : true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [options, onResult]);

  if (!options) {
    return null;
  }

  const tone = options.tone ?? 'error';
  const toneStyles = {
    error: {
      icon: <AlertCircle size={22} />,
      iconClass: 'bg-red-100 text-red-700',
      buttonClass: 'bg-red-600 hover:bg-red-700',
    },
    warning: {
      icon: <AlertCircle size={22} />,
      iconClass: 'bg-amber-100 text-amber-700',
      buttonClass: 'bg-amber-600 hover:bg-amber-700',
    },
    info: {
      icon: <Info size={22} />,
      iconClass: 'bg-blue-100 text-blue-700',
      buttonClass: 'bg-blue-600 hover:bg-blue-700',
    },
    success: {
      icon: <CheckCircle2 size={22} />,
      iconClass: 'bg-emerald-100 text-emerald-700',
      buttonClass: 'bg-emerald-600 hover:bg-emerald-700',
    },
  }[tone];

  return (
    <div
      class="fixed inset-0 z-[70] flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div class="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div class="flex items-start gap-4 p-6">
          <div class={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${toneStyles.iconClass}`}>
            {toneStyles.icon}
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-start justify-between gap-3">
              <h2 class="text-lg font-semibold text-zinc-900">{options.title}</h2>
              {!options.cancelLabel && (
                <button
                  type="button"
                  onClick={() => onResult(true)}
                  class="-mr-2 -mt-2 rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                  aria-label={t.common.close}
                >
                  <X size={17} />
                </button>
              )}
            </div>
            <p class="mt-2 whitespace-pre-line text-sm leading-6 text-zinc-700">{options.message}</p>
            {options.guidance && (
              <div class="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm leading-5 text-zinc-700">
                <span class="font-semibold">{t.appDialog.tryLabel}</span>
                {options.guidance}
              </div>
            )}
            {mode === 'advanced' && options.technicalDetail && (
              <details class="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                <summary class="cursor-pointer text-xs font-medium text-zinc-600">
                  {t.appDialog.showTechnicalDetails}
                </summary>
                <pre class="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all text-[11px] leading-5 text-zinc-600">
                  {options.technicalDetail}
                </pre>
              </details>
            )}
          </div>
        </div>

        <div class="flex flex-wrap items-center justify-end gap-2.5 border-t border-zinc-100 px-6 py-4">
          {options.secondaryAction && (
            <button
              type="button"
              onClick={options.secondaryAction.onClick}
              class="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              <FolderOpen size={15} />
              {options.secondaryAction.label}
            </button>
          )}
          {options.cancelLabel && (
            <button
              type="button"
              onClick={() => onResult(false)}
              class="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              {options.cancelLabel}
            </button>
          )}
          <button
            type="button"
            onClick={() => onResult(true)}
            class={`rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm ${toneStyles.buttonClass}`}
          >
            {options.confirmLabel ?? t.common.close}
          </button>
        </div>
      </div>
    </div>
  );
}
