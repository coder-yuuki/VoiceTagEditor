import { Check } from 'lucide-preact';
import { useI18n } from '../i18n';

export type StepNumber = 1 | 2 | 3 | 4;

interface StepIndicatorProps {
  currentStep: StepNumber;
  onStepClick?: (step: StepNumber) => void;
}

export function StepIndicator({ currentStep, onStepClick }: StepIndicatorProps) {
  const { t } = useI18n();
  const steps = [
    { number: 1 as const, label: t.steps.selectAudio },
    { number: 2 as const, label: t.steps.workInfo },
    { number: 3 as const, label: t.steps.reviewTracks },
    { number: 4 as const, label: t.steps.save },
  ] as const;

  return (
    <div class="border-b border-zinc-200 bg-zinc-50 px-6 py-2.5">
      <div class="mx-auto flex max-w-4xl items-center">
        {steps.map((step, index) => {
          const completed = step.number < currentStep;
          const active = step.number === currentStep;
          const clickable = completed && onStepClick;

          return (
            <div class="contents" key={step.number}>
              {clickable ? (
                <button
                  type="button"
                  onClick={() => onStepClick(step.number)}
                  class="flex shrink-0 items-center gap-2 rounded-lg px-1.5 py-0.5 text-emerald-700 transition-colors hover:bg-emerald-50"
                >
                  <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
                    <Check size={14} />
                  </span>
                  <span class="whitespace-nowrap text-sm font-medium">{step.label}</span>
                </button>
              ) : (
                <div class={`flex shrink-0 items-center gap-2 ${active ? 'text-blue-700' : completed ? 'text-emerald-700' : 'text-zinc-400'}`}>
                  <span class={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    active
                      ? 'bg-blue-600 text-white shadow-sm'
                      : completed
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'border border-zinc-300 bg-white text-zinc-500'
                  }`}>
                    {completed ? <Check size={14} /> : step.number}
                  </span>
                  <span class={`whitespace-nowrap text-sm ${active ? 'font-semibold' : 'font-medium'}`}>{step.label}</span>
                </div>
              )}
              {index < steps.length - 1 && (
                <div class={`mx-2 h-px min-w-4 flex-1 sm:mx-3 ${completed ? 'bg-emerald-300' : 'bg-zinc-300'}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
