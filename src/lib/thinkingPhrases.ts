export const DONNA_THINKING_VERBS = [
  'thinking',
  'pondering',
  'wondering',
  'cooking',
  'contemplating',
  'brewing',
  'considering',
  'reflecting',
  'piecing it together',
  'connecting the dots',
  'gathering her thoughts',
  'noodling',
  'figuring it out',
  'mulling it over',
  'putting it together',
] as const;

export const DONNA_THINKING_PHASE = '__donna_thinking__';

export function isDonnaThinkingPhase(
  label: string | null | undefined,
): boolean {
  return label === DONNA_THINKING_PHASE;
}

export function randomThinkingVerbIndex(): number {
  return Math.floor(Math.random() * DONNA_THINKING_VERBS.length);
}
