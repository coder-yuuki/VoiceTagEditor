import { useI18n } from '../i18n';
import type { ConvertProgress, ProgressEvent } from '../types';

interface ProcessingOverlayProps {
  isProcessing: boolean;
  convertProgress: ConvertProgress | null;
  processingProgress: ProgressEvent | null;
  completedCount: number;
}

export function ProcessingOverlay({
  isProcessing,
  convertProgress,
  processingProgress,
  completedCount,
}: ProcessingOverlayProps) {
  const { t, fmt } = useI18n();

  if (!isProcessing || (!convertProgress && !processingProgress)) {
    return null;
  }

  const getStatusLabel = (status: string) => {
    if (status === 'processing') return t.processing.statusProcessing;
    if (status === 'completed') return t.processing.statusCompleted;
    return t.processing.statusError;
  };

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm animate-in fade-in duration-200">
      <div class="w-[500px] max-w-[90vw] scale-100 rounded-2xl bg-white p-8 shadow-2xl animate-in zoom-in-95 duration-200">
        <div class="text-center">
          <div class="mb-6 flex justify-center">
            <div class="h-12 w-12 animate-spin rounded-full border-4 border-zinc-200 border-t-blue-600" />
          </div>

          <h2 class="mb-4 text-xl font-semibold text-zinc-800">
            {convertProgress ? t.processing.savingTitle : t.processing.loadingTitle}
          </h2>

          {convertProgress ? (
            <>
              <div class="mb-4 h-2 w-full overflow-hidden rounded-full bg-zinc-100">
                <div
                  class="h-full rounded-full bg-blue-600 transition-all duration-300 ease-out"
                  style={{ width: `${convertProgress.percent}%` }}
                />
              </div>

              <div class="mb-2 text-sm font-medium text-zinc-600">
                {fmt(t.processing.processedCount, {
                  current: completedCount,
                  total: convertProgress.total,
                })}
                <span class="ml-2 text-blue-600">({Math.round(convertProgress.percent)}%)</span>
              </div>

              <div class="mt-4 break-all rounded-lg border border-zinc-100 bg-zinc-50 p-2.5 text-xs text-zinc-500">
                <span class="mr-1 font-medium">{getStatusLabel(convertProgress.status)}</span>
                <span class="text-zinc-700">{convertProgress.currentFile}</span>
              </div>
            </>
          ) : processingProgress ? (
            <>
              <div class="mb-4 h-2 w-full overflow-hidden rounded-full bg-zinc-100">
                <div
                  class="h-full rounded-full bg-blue-600 transition-all duration-300 ease-out"
                  style={{
                    width: `${completedCount > 0 ? (completedCount / processingProgress.total) * 100 : 0}%`,
                  }}
                />
              </div>

              <div class="mb-2 text-sm font-medium text-zinc-600">
                {fmt(t.processing.processedCount, {
                  current: completedCount,
                  total: processingProgress.total,
                })}
                <span class="ml-2 text-blue-600">
                  ({completedCount > 0 ? Math.round((completedCount / processingProgress.total) * 100) : 0}%)
                </span>
              </div>

              <div class="mt-4 break-all rounded-lg border border-zinc-100 bg-zinc-50 p-2.5 text-xs text-zinc-500">
                <span class="mr-1 font-medium">{getStatusLabel(processingProgress.status)}</span>
                <span class="text-zinc-700">
                  {processingProgress.file_path.split(/[\\/]/).pop() || processingProgress.file_path}
                </span>
              </div>
            </>
          ) : null}

          <div class="mt-6 text-xs text-zinc-400">
            {t.processing.pleaseWait}
          </div>
        </div>
      </div>
    </div>
  );
}
