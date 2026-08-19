import {
  isComposerMode,
  parseComposerMode,
} from '../composerMode';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

describe('composerMode', () => {
  it('accepts chat and agent', () => {
    expect(isComposerMode('chat')).toBe(true);
    expect(isComposerMode('agent')).toBe(true);
    expect(isComposerMode('voice')).toBe(false);
  });

  it('falls back to chat', () => {
    expect(parseComposerMode('agent')).toBe('agent');
    expect(parseComposerMode('nope')).toBe('chat');
  });
});
