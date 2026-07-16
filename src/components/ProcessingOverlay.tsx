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
  if (!isProcessing || (!convertProgress && !processingProgress)) {
    return null;
  }

  return (
    <div class="fixed inset-0 flex items-center justify-center z-50 backdrop-blur-sm bg-black/30 animate-in fade-in duration-200">
      <div class="bg-white rounded-xl shadow-2xl p-8 w-[500px] max-w-[90vw] scale-100 animate-in zoom-in-95 duration-200">
        <div class="text-center">
          <div class="flex justify-center mb-6">
            <div class="animate-spin rounded-full h-12 w-12 border-4 border-zinc-200 border-t-blue-600"></div>
          </div>

          <h2 class="text-xl font-semibold mb-4 text-zinc-800">
            {convertProgress ? '変換中...' : 'ファイルを処理中...'}
          </h2>

          {convertProgress ? (
            <>
              <div class="w-full bg-zinc-100 rounded-full h-2 mb-4 overflow-hidden">
                <div
                  class="bg-blue-600 h-full rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${convertProgress.percent}%` }}
                ></div>
              </div>

              <div class="text-sm font-medium text-zinc-600 mb-2">
                {completedCount} / {convertProgress.total} ファイルを処理済み
                <span class="ml-2 text-blue-600">({Math.round(convertProgress.percent)}%)</span>
              </div>

              <div class="text-xs text-zinc-500 mt-4 break-all bg-zinc-50 p-2 rounded border border-zinc-100">
                <span class="font-medium mr-1">
                  {convertProgress.status === 'processing' ? '処理中: ' :
                    convertProgress.status === 'completed' ? '完了: ' : 'エラー: '}
                </span>
                <span class="text-zinc-700">{convertProgress.currentFile}</span>
              </div>
            </>
          ) : processingProgress ? (
            <>
              <div class="w-full bg-zinc-100 rounded-full h-2 mb-4 overflow-hidden">
                <div
                  class="bg-blue-600 h-full rounded-full transition-all duration-300 ease-out"
                  style={{
                    width: `${completedCount > 0 ? (completedCount / processingProgress.total) * 100 : 0}%`,
                  }}
                ></div>
              </div>

              <div class="text-sm font-medium text-zinc-600 mb-2">
                {completedCount} / {processingProgress.total} ファイルを処理済み
                <span class="ml-2 text-blue-600">
                  ({completedCount > 0 ? Math.round((completedCount / processingProgress.total) * 100) : 0}%)
                </span>
              </div>

              <div class="text-xs text-zinc-500 mt-4 break-all bg-zinc-50 p-2 rounded border border-zinc-100">
                <span class="font-medium mr-1">
                  {processingProgress.status === 'processing' ? '処理中: ' :
                    processingProgress.status === 'completed' ? '完了: ' : 'エラー: '}
                </span>
                <span class="text-zinc-700">
                  {processingProgress.file_path.split('/').pop() || processingProgress.file_path}
                </span>
              </div>
            </>
          ) : null}

          <div class="mt-6 text-xs text-zinc-400">
            処理が完了するまでお待ちください...
          </div>
        </div>
      </div>
    </div>
  );
}
