/** Human-readable labels for chat SSE phase events. */
export function chatPhaseLabel(phase: string | null | undefined): string | null {
  if (!phase) return null;
  switch (phase) {
    case 'fetching':
      return 'Reading page…';
    case 'browsing':
      return 'Browsing page…';
    case 'generating':
      return 'generating';
    default:
      return phase;
  }
}
