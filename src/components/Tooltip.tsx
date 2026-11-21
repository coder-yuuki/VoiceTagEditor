import type { ComponentChildren } from 'preact';
import { Info } from 'lucide-preact';

interface TooltipProps {
  text: string;
  children: ComponentChildren;
  position?: 'top' | 'bottom';
  align?: 'center' | 'left' | 'right';
  multiline?: boolean;
}

export function Tooltip({
  text,
  children,
  position = 'bottom',
  align = 'center',
  multiline = false,
}: TooltipProps) {
  if (!text) {
    return <>{children}</>;
  }

  const posClass = position === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5';
  const alignClass = align === 'left'
    ? 'left-0'
    : align === 'right'
      ? 'right-0'
      : 'left-1/2 -translate-x-1/2';

  return (
    <span class="group/tip relative inline-flex">
      {children}
      <span
        role="tooltip"
        class={`pointer-events-none invisible absolute z-50 rounded-lg bg-zinc-900 px-2.5 py-1.5 text-[11px] font-medium leading-4 text-white opacity-0 shadow-lg transition-all duration-150 group-hover/tip:visible group-hover/tip:opacity-100 group-focus-within/tip:visible group-focus-within/tip:opacity-100 ${posClass} ${alignClass} ${
          multiline ? 'w-56 whitespace-normal text-left' : 'whitespace-nowrap'
        }`}
      >
        {text}
      </span>
    </span>
  );
}

interface InfoHintProps {
  text: string;
  position?: 'top' | 'bottom';
  align?: 'center' | 'left' | 'right';
}

export function InfoHint({ text, position = 'top', align = 'left' }: InfoHintProps) {
  return (
    <Tooltip text={text} position={position} align={align} multiline>
      <span
        tabIndex={0}
        class="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        aria-label={text}
      >
        <Info size={13} />
      </span>
    </Tooltip>
  );
}
