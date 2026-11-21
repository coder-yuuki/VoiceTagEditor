import { Upload } from 'lucide-preact';
import { useI18n } from '../i18n';

interface DragDropOverlayProps {
  visible: boolean;
}

export function DragDropOverlay({ visible }: DragDropOverlayProps) {
  const { t } = useI18n();

  if (!visible) {
    return null;
  }

  return (
    <div
      class="pointer-events-none fixed inset-0 z-[80] flex items-center justify-center bg-blue-950/25 p-6 backdrop-blur-[2px] transition-opacity"
      aria-live="polite"
    >
      <div class="flex w-full max-w-lg flex-col items-center rounded-3xl border-2 border-dashed border-blue-500 bg-white/95 px-10 py-12 text-center shadow-2xl">
        <div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 shadow-inner">
          <Upload size={32} />
        </div>
        <h2 class="mt-5 text-xl font-bold text-zinc-900">{t.dragDrop.title}</h2>
        <p class="mt-2 text-sm leading-6 text-zinc-600">{t.dragDrop.subtitle}</p>
        <div class="mt-4 rounded-full bg-zinc-100 px-3.5 py-1 text-xs font-medium text-zinc-500">
          {t.dragDrop.formats}
        </div>
      </div>
    </div>
  );
}
