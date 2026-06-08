const USER_ERROR_MESSAGES: Record<string, string> = {
  not_started: "Couldn't start listening. Please try again.",
  empty_audio: "I didn't catch that. Try speaking again.",
  invalid_message: 'Something went wrong. Please try again.',
  unknown_type: 'Something went wrong. Please try again.',
  turn_failed: "Something went wrong. Please try again.",
};

export function voiceErrorMessage(code: string): string {
  return USER_ERROR_MESSAGES[code] ?? 'Something went wrong. Please try again.';
}
