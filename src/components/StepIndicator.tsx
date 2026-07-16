import { Check } from 'lucide-preact';

interface StepIndicatorProps {
  currentStep: 1 | 2 | 3;
}

const steps = [
  { number: 1, label: '音声を読み込む' },
  { number: 2, label: '情報を確認・編集' },
  { number: 3, label: '保存する' },
] as const;

export function StepIndicator({ currentStep }: StepIndicatorProps) {
  return (
    <div class="border-b border-zinc-200 bg-zinc-50 px-6 py-3">
      <div class="mx-auto flex max-w-4xl items-center">
        {steps.map((step, index) => {
          const completed = step.number < currentStep;
          const active = step.number === currentStep;

          return (
            <div class="contents" key={step.number}>
              <div class={`flex items-center gap-2 ${active ? 'text-blue-700' : completed ? 'text-emerald-700' : 'text-zinc-400'}`}>
                <span class={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  active
                    ? 'bg-blue-600 text-white shadow-sm'
                    : completed
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'border border-zinc-300 bg-white text-zinc-500'
                }`}>
                  {completed ? <Check size={14} /> : step.number}
                </span>
                <span class={`text-sm ${active ? 'font-semibold' : 'font-medium'}`}>{step.label}</span>
              </div>
              {index < steps.length - 1 && (
                <div class={`mx-4 h-px min-w-8 flex-1 ${completed ? 'bg-emerald-300' : 'bg-zinc-300'}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
