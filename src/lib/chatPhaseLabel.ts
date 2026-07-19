/** Human-readable labels for chat SSE phase events. */
export function chatPhaseLabel(
  phase: string | null | undefined,
  host?: string | null,
): string | null {
  if (!phase) return null;
  const h = host?.trim();
  switch (phase) {
    case 'analyzing':
      return 'Looking at your image…';
    case 'fetching':
      return h ? `Reading ${h}…` : 'Reading the page…';
    case 'browsing':
      return h ? `Scraping ${h}…` : 'Scraping the page…';
    case 'finishing':
      return 'Putting finishing touches…';
    case 'generating':
      return 'generating';
    default:
      return phase;
  }
}
