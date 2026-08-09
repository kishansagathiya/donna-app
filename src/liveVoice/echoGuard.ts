function normalizeTranscript(text: string): string {
  return text
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * True when a "user" caption is likely Donna's own speech picked up by the mic.
 * Classic failure: assistant "I'm ready when you are!" → user "I ready when you are".
 */
export function looksLikeEcho(userText: string, assistantText: string): boolean {
  const user = normalizeTranscript(userText);
  const assistant = normalizeTranscript(assistantText);
  if (!user || !assistant) return false;
  if (user === assistant) return true;

  const userWords = user.split(" ").filter(Boolean);
  const assistantWords = assistant.split(" ").filter(Boolean);
  if (userWords.length < 3) return false;

  if (assistant.includes(user)) return true;
  if (user.includes(assistant) && assistantWords.length >= 3) return true;

  const assistantSet = new Set(assistantWords);
  let overlap = 0;
  for (const word of userWords) {
    if (assistantSet.has(word)) overlap += 1;
  }
  const ratio = overlap / Math.max(userWords.length, assistantWords.length);
  return overlap >= 3 && ratio >= 0.65;
}
