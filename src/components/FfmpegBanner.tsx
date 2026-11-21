import { AlertCircle, RefreshCw } from 'lucide-preact';
import { useI18n } from '../i18n';
import type { FfmpegInstallProgress, FfmpegSetupState } from '../types';

interface FfmpegBannerProps {
  setup: FfmpegSetupState;
  installLog: FfmpegInstallProgress[];
  showTechnicalDetails?: boolean;
  onRetry: () => void;
}

export function FfmpegBanner({
  setup,
  installLog,
  showTechnicalDetails = false,
  onRetry,
}: FfmpegBannerProps) {
  const { t } = useI18n();

  if (setup.status === 'idle' || setup.status === 'ready') {
    return null;
  }

  const bannerMessage = setup.status === 'failed'
    ? t.ffmpegBanner.failed
    : t.ffmpegBanner.preparing;

  return (
    <div class={`flex items-start justify-between gap-3 border-b px-5 py-2 text-xs ${setup.status === 'failed'
      ? 'border-amber-200 bg-amber-50 text-amber-800'
      : 'border-blue-100 bg-blue-50 text-blue-800'
      }`}>
      <div class="flex min-w-0 flex-1 items-start gap-2">
        <div class="pt-0.5">
          {setup.status === 'checking' ? (
            <RefreshCw size={14} class="shrink-0 animate-spin" />
          ) : (
            <AlertCircle size={14} class="shrink-0" />
          )}
        </div>
        <div class="min-w-0 flex-1">
          <div class="font-medium">{bannerMessage}</div>
          {showTechnicalDetails && (setup.technicalDetail || installLog.length > 0) && (
            <details class="mt-1">
              <summary class="cursor-pointer select-none opacity-80">
                {t.ffmpegBanner.showTechnicalDetails}
              </summary>
              <div class="mt-1 space-y-0.5 break-all font-mono text-[11px] leading-4">
                {setup.technicalDetail && (
                  <div class="text-amber-900">{setup.technicalDetail}</div>
                )}
                {installLog.slice(-5).map((entry, index) => (
                  <div
                    key={`${entry.stream}-${index}-${entry.message}`}
                    class={entry.stream === 'stderr' ? 'text-amber-900' : 'opacity-80'}
                  >
                    <span class="mr-1 opacity-70">{entry.stream === 'stderr' ? '!' : '>'}</span>
                    {entry.message}
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      </div>
      {setup.status === 'failed' && (
        <button
          type="button"
          onClick={onRetry}
          class="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-amber-300 bg-white px-2.5 py-1 text-amber-800 transition-colors hover:bg-amber-100"
        >
          <RefreshCw size={13} />
          <span>{t.common.retry}</span>
        </button>
      )}
    </div>
  );
}
