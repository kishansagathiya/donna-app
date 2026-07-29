/** Formats client-measured time-to-first-token for chat metadata. */
export function formatFirstTokenMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) {
    return '';
  }
  if (ms < 1000) {
    return `${Math.round(ms)}ms to first token`;
  }
  const seconds = ms / 1000;
  const rounded = seconds >= 10 ? seconds.toFixed(0) : seconds.toFixed(1);
  return `${rounded}s to first token`;
}
