/** Normalize SSE phase payloads, including accidental raw JSON strings. */
export function coerceChatPhase(
  phase: string | null | undefined,
  host?: string | null,
): { phase: string; host?: string } | null {
  if (!phase) return null;
  const trimmed = phase.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as { phase?: unknown; host?: unknown };
      if (typeof parsed.phase === 'string' && parsed.phase.trim()) {
        const fromJson = parsed.host;
        return {
          phase: parsed.phase.trim(),
          host:
            (typeof host === 'string' && host.trim()) ||
            (typeof fromJson === 'string' && fromJson.trim()) ||
            undefined,
        };
      }
    } catch {
      return null;
    }
    return null;
  }

  return {
    phase: trimmed,
    host: host?.trim() || undefined,
  };
}

/**
 * Concrete wait-status labels only (site / images).
 * Vague protocol phases return null so the UI can rotate thinking verbs.
 */
export function chatPhaseLabel(
  phase: string | null | undefined,
  host?: string | null,
): string | null {
  const coerced = coerceChatPhase(phase, host);
  if (!coerced) return null;
  const h = coerced.host;
  switch (coerced.phase) {
    case 'analyzing':
      return 'Analyzing images…';
    case 'fetching':
      return h ? `Reading ${h}…` : 'Reading this page…';
    case 'browsing':
      return h ? `Browsing ${h}…` : 'Browsing this site…';
    case 'generating':
    case 'thinking':
    case 'finishing':
    case 'idle':
    case 'done':
    case 'busy':
      return null;
    default:
      return null;
  }
}

export function isGeneratingPhase(
  phase: string | null | undefined,
): boolean {
  return coerceChatPhase(phase)?.phase === 'generating';
}
