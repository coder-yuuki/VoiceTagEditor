import { AlertCircle, Check, X } from 'lucide-preact';
import type { OnboardingStep } from '../types';

interface OnboardingModalProps {
  isOpen: boolean;
  steps: OnboardingStep[];
  currentStep: number;
  onStepChange: (step: number) => void;
  onClose: () => void;
}

export function OnboardingModal({
  isOpen,
  steps,
  currentStep,
  onStepChange,
  onClose,
}: OnboardingModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/30 animate-in fade-in duration-200">
      <div class="bg-white rounded-xl shadow-2xl w-[640px] max-w-[92vw] p-8 relative scale-100 animate-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          class="absolute right-4 top-4 text-zinc-400 hover:text-zinc-600 transition-colors p-1 hover:bg-zinc-100 rounded-full"
          aria-label="閉じる"
          title="閉じる"
        >
          <X size={20} />
        </button>

        <div class="mb-6">
          <div class="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-2">
            かんたんガイド　{currentStep + 1} / {steps.length}
          </div>
          <h2 class="text-2xl font-bold text-zinc-800">{steps[currentStep].title}</h2>
        </div>

        <div class="text-base text-zinc-600 leading-relaxed whitespace-pre-line mb-8">
          {steps[currentStep].desc}
        </div>

        <div class="bg-zinc-50 border border-zinc-200 rounded-lg p-5 text-sm text-zinc-600 mb-8">
          {currentStep === 0 && (
            <>
              <div class="font-semibold text-zinc-700 mb-2 flex items-center gap-2">
                <AlertCircle size={16} class="text-blue-500" />
                ヒント
              </div>
              <ul class="list-disc pl-5 space-y-1.5 marker:text-zinc-400">
                <li>「ファイルを選ぶ」か「フォルダを選ぶ」から追加できます。</li>
                <li>フォルダを選ぶと、中にある音声とカバー画像をまとめて読み込みます。</li>
              </ul>
            </>
          )}
          {currentStep === 1 && (
            <>
              <div class="font-semibold text-zinc-700 mb-2 flex items-center gap-2">
                <AlertCircle size={16} class="text-blue-500" />
                ヒント
              </div>
              <ul class="list-disc pl-5 space-y-1.5 marker:text-zinc-400">
                <li>曲名やアーティスト名は、一覧の入力欄をそのまま書き換えられます。</li>
                <li>同じ番号がある場合は、該当する行が黄色で表示されます。</li>
              </ul>
            </>
          )}
          {currentStep === 2 && (
            <>
              <div class="font-semibold text-zinc-700 mb-2 flex items-center gap-2">
                <AlertCircle size={16} class="text-blue-500" />
                ヒント
              </div>
              <ul class="list-disc pl-5 space-y-1.5 marker:text-zinc-400">
                <li>かんたんモードでは保存先を選ぶだけで、おすすめ設定を使用します。</li>
                <li>保存後は、音声が最後まで正しく読み取れることも自動で確認します。</li>
              </ul>
            </>
          )}
        </div>

        <div class="flex items-center justify-center gap-2 mb-8">
          {steps.map((_, index) => (
            <div
              key={index}
              class={`w-2.5 h-2.5 rounded-full transition-all ${index === currentStep ? 'bg-blue-600 scale-110' : 'bg-zinc-200'}`}
            ></div>
          ))}
        </div>

        <div class="flex items-center justify-between pt-4 border-t border-zinc-100">
          <button
            onClick={onClose}
            class="px-4 py-2 text-sm text-zinc-500 hover:text-zinc-800 transition-colors"
          >
            閉じる
          </button>
          <div class="flex items-center gap-3">
            <button
              onClick={() => onStepChange(Math.max(0, currentStep - 1))}
              disabled={currentStep === 0}
              class="px-4 py-2 border border-zinc-300 rounded-md text-sm text-zinc-700 bg-white hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              戻る
            </button>
            {currentStep < steps.length - 1 ? (
              <button
                onClick={() => onStepChange(Math.min(steps.length - 1, currentStep + 1))}
                class="px-4 py-2 border border-transparent rounded-md text-sm bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition-all"
              >
                次へ
              </button>
            ) : (
              <button
                onClick={onClose}
                class="px-4 py-2 border border-transparent rounded-md text-sm bg-green-600 text-white hover:bg-green-700 shadow-sm transition-all flex items-center gap-2"
              >
                <Check size={16} />
                はじめる
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
