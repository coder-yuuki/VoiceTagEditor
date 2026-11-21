import { useEffect } from 'preact/hooks';
import { AlertCircle, Check, X } from 'lucide-preact';
import { useI18n } from '../i18n';

interface OnboardingModalProps {
  isOpen: boolean;
  currentStep: number;
  onStepChange: (step: number) => void;
  onClose: () => void;
}

export function OnboardingModal({
  isOpen,
  currentStep,
  onStepChange,
  onClose,
}: OnboardingModalProps) {
  const { t, fmt } = useI18n();
  const steps = t.onboarding.steps;
  const safeStep = Math.min(Math.max(0, currentStep), steps.length - 1);
  const stepData = steps[safeStep];

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !stepData) {
    return null;
  }

  return (
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      <div class="relative w-[640px] max-w-[92vw] scale-100 rounded-2xl bg-white p-8 shadow-2xl animate-in zoom-in-95 duration-200">
        <button
          type="button"
          onClick={onClose}
          class="absolute right-4 top-4 rounded-full p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
          aria-label={t.common.close}
          title={t.common.close}
        >
          <X size={20} />
        </button>

        <div class="mb-6">
          <div class="mb-2 text-xs font-semibold uppercase tracking-wider text-blue-600">
            {fmt(t.onboarding.badge, { current: safeStep + 1, total: steps.length })}
          </div>
          <h2 class="text-2xl font-bold text-zinc-800">{stepData.title}</h2>
        </div>

        <div class="mb-6 whitespace-pre-line text-base leading-relaxed text-zinc-600">
          {stepData.desc}
        </div>

        <div class="mb-8 rounded-xl border border-zinc-200 bg-zinc-50 p-5 text-sm text-zinc-600">
          <div class="mb-2 flex items-center gap-2 font-semibold text-zinc-700">
            <AlertCircle size={16} class="text-blue-500" />
            {t.onboarding.hintTitle}
          </div>
          <ul class="list-disc space-y-1.5 pl-5 marker:text-zinc-400">
            {stepData.hints.map((hint, idx) => (
              <li key={idx}>{hint}</li>
            ))}
          </ul>
        </div>

        <div class="mb-8 flex items-center justify-center gap-2">
          {steps.map((step, index) => (
            <button
              key={index}
              type="button"
              onClick={() => onStepChange(index)}
              aria-label={`${index + 1}. ${step.title}`}
              class={`h-2.5 rounded-full transition-all ${
                index === safeStep ? 'w-6 bg-blue-600' : 'w-2.5 bg-zinc-200 hover:bg-zinc-300'
              }`}
            />
          ))}
        </div>

        <div class="flex items-center justify-between border-t border-zinc-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            class="px-4 py-2 text-sm text-zinc-500 transition-colors hover:text-zinc-800"
          >
            {t.common.close}
          </button>
          <div class="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onStepChange(Math.max(0, safeStep - 1))}
              disabled={safeStep === 0}
              class="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-700 transition-all hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t.common.back}
            </button>
            {safeStep < steps.length - 1 ? (
              <button
                type="button"
                onClick={() => onStepChange(Math.min(steps.length - 1, safeStep + 1))}
                class="rounded-lg border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-blue-700"
              >
                {t.common.next}
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                class="flex items-center gap-2 rounded-lg border border-transparent bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-emerald-700"
              >
                <Check size={16} />
                {t.onboarding.startButton}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
