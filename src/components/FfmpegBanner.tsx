import { AlertCircle, RefreshCw } from 'lucide-preact';
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
  if (setup.status === 'idle' || setup.status === 'ready') {
    return null;
  }

  return (
    <div class={`px-5 py-2 border-b text-xs flex items-start justify-between gap-3 ${setup.status === 'failed'
      ? 'bg-amber-50 border-amber-200 text-amber-800'
      : 'bg-blue-50 border-blue-100 text-blue-800'
      }`}>
      <div class="flex items-start gap-2 min-w-0 flex-1">
        <div class="pt-0.5">
          {setup.status === 'checking' ? (
            <RefreshCw size={14} class="animate-spin shrink-0" />
          ) : (
            <AlertCircle size={14} class="shrink-0" />
          )}
        </div>
        <div class="min-w-0 flex-1">
          <div class="font-medium">{setup.message}</div>
          {showTechnicalDetails && (setup.technicalDetail || installLog.length > 0) && (
            <details class="mt-1">
              <summary class="cursor-pointer select-none opacity-80">技術情報を表示</summary>
              <div class="mt-1 space-y-0.5 font-mono text-[11px] leading-4 break-all">
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
          onClick={onRetry}
          class="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 border border-amber-300 rounded-md bg-white text-amber-800 hover:bg-amber-100 transition-colors"
        >
          <RefreshCw size={13} />
          <span>再試行</span>
        </button>
      )}
    </div>
  );
}
