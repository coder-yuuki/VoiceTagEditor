import { AlertCircle, CheckCircle2, Info, X } from 'lucide-preact';
import { useI18n } from '../i18n';

export interface ToastItem {
  id: string;
  message: string;
  tone?: 'info' | 'success' | 'warning';
}

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  const { t } = useI18n();

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div
      class="pointer-events-none fixed bottom-5 right-5 z-[65] flex max-w-sm flex-col gap-2"
      aria-live="polite"
    >
      {toasts.map((toast) => {
        const tone = toast.tone ?? 'info';
        const styles = {
          success: {
            wrapper: 'border-emerald-200 bg-white text-zinc-800',
            icon: <CheckCircle2 size={16} class="shrink-0 text-emerald-600" />,
          },
          warning: {
            wrapper: 'border-amber-200 bg-white text-zinc-800',
            icon: <AlertCircle size={16} class="shrink-0 text-amber-600" />,
          },
          info: {
            wrapper: 'border-zinc-200 bg-white text-zinc-800',
            icon: <Info size={16} class="shrink-0 text-blue-600" />,
          },
        }[tone];

        return (
          <div
            key={toast.id}
            class={`pointer-events-auto flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm shadow-lg ${styles.wrapper}`}
          >
            {styles.icon}
            <span class="min-w-0 flex-1 break-words text-xs font-medium leading-5 text-zinc-800">
              {toast.message}
            </span>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              class="shrink-0 rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
              aria-label={t.common.close}
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
