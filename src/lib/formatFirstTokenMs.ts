/** Formats a client-measured chat latency value. */
export function formatLatencyMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) {
    return '';
  }
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }
  const seconds = ms / 1000;
  const rounded = seconds >= 10 ? seconds.toFixed(0) : seconds.toFixed(1);
  return `${rounded}s`;
}

/** Formats client-measured time-to-first-token for chat metadata. */
export function formatFirstTokenMs(ms: number): string {
  const latency = formatLatencyMs(ms);
  return latency ? `${latency} to first token` : '';
}

/** Formats first-token and/or total response timing for chat metadata. */
export function formatChatTiming(timing: {
  firstTokenMs?: number;
  totalMs?: number;
}): string {
  const parts: string[] = [];
  if (timing.firstTokenMs != null) {
    const first = formatFirstTokenMs(timing.firstTokenMs);
    if (first) parts.push(first);
  }
  if (timing.totalMs != null) {
    const total = formatLatencyMs(timing.totalMs);
    if (total) parts.push(`${total} total`);
  }
  return parts.join(' · ');
}
