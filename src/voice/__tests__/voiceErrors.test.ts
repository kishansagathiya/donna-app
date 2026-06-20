import { voiceErrorMessage } from '../voiceErrors';

describe('voiceErrorMessage', () => {
  it('maps known error codes', () => {
    expect(voiceErrorMessage('empty_audio')).toBe(
      "I didn't catch that. Try speaking again.",
    );
    expect(voiceErrorMessage('not_started')).toBe(
      "Couldn't start listening. Please try again.",
    );
  });

  it('falls back for unknown codes', () => {
    expect(voiceErrorMessage('unknown_code')).toBe(
      'Something went wrong. Please try again.',
    );
  });
});
