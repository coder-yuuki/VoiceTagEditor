const LEADING_PATTERNS: RegExp[] = [
  // e.g. "Track 01 - ", "Tr.01_", "トラック01："
  /^(?:track|tr|トラック)\s*[._-]?\s*\d{1,3}(?:\s*[-_.]\s*\d{1,3})?\s*[\s._\-:：)）\]】]+/i,
  // e.g. "【01】", "[01]", "(01)", "（01）"
  /^[\[【(（]\s*(?:(?:track|tr|disc|disk|トラック|ディスク)\s*[._-]?\s*)?\d{1,3}(?:\s*[-_.]\s*\d{1,3})?\s*[\]】)）]\s*[-_.:：]?\s*/i,
  // e.g. "01-02 ", "01_02_", "01 - ", "01_", "1. ", "01："
  /^\d{1,3}(?:\s*[-_.]\s*\d{1,3})?\s*(?:[._\-:：、）)]+\s*|\s+)/,
];

export function stripLeadingTrackNumber(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) return title;

  let next = trimmed;
  for (const pattern of LEADING_PATTERNS) {
    const candidate = next.replace(pattern, '').trim();
    if (candidate !== next && candidate.length > 0) {
      next = candidate;
      break;
    }
  }

  return next.length > 0 ? next : title;
}

export function normalizeTitleWhitespace(title: string): string {
  const normalized = title.replace(/[\u3000\s]+/g, ' ').trim();
  return normalized.length > 0 ? normalized : title;
}

export function replaceInTitle(title: string, search: string, replacement: string): string {
  if (!search) return title;
  const next = title.split(search).join(replacement).trim();
  return next.length > 0 ? next : title;
}

export function parseDurationToSeconds(duration?: string): number {
  if (!duration) return 0;
  const parts = duration.trim().split(':').map((part) => Number.parseInt(part, 10));
  if (parts.some((n) => !Number.isFinite(n) || n < 0)) {
    return 0;
  }
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return 0;
}

export function formatTotalSeconds(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return '';
  }
  const rounded = Math.floor(totalSeconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const seconds = rounded % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
