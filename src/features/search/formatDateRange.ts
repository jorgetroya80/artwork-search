import type { Artwork } from '../../api/rijksmuseum';

// ISO dates may carry a sign for years before the common era ("-0500-01-01").
const readYear = (isoDate: string | null) =>
  isoDate?.match(/^-?\d+/)?.[0] ?? null;

export function formatDateRange(date: Artwork['date']): string | null {
  const start = readYear(date.start);
  const end = readYear(date.end);
  if (start && end && start !== end) return `${start}–${end}`;
  return start ?? end;
}
