/**
 * @format
 */

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) => (
      <View>{children}</View>
    ),
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

jest.mock('../src/hooks/useVoiceSession', () => ({
  useVoiceSession: () => ({
    state: 'idle',
    toggleTalk: jest.fn(),
    turns: [],
    reply: null,
    phaseLabel: null,
    sessionLabel: null,
    errorMsg: null,
    disabled: false,
  }),
}));

jest.mock('../src/hooks/useAuth', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => ({
    isAuthenticated: true,
    loading: false,
    session: { user: { id: 'user-1' } },
    signOut: jest.fn(),
  }),
}));

jest.mock('../src/hooks/useAiDataConsent', () => ({
  useAiDataConsent: () => ({
    accepted: true,
    refresh: jest.fn(),
  }),
}));

jest.mock('../src/components/SearchContextModal', () => ({
  SearchContextModal: () => null,
}));

jest.mock('../src/services/auth', () => ({
  getAccessToken: jest.fn(async () => 'token'),
  signInWithApple: jest.fn(),
  signOut: jest.fn(),
  getSession: jest.fn(async () => ({ user: { id: 'user-1' } })),
  onAuthStateChange: jest.fn(() => jest.fn()),
}));

jest.mock('../src/screens/LoginScreen', () => ({
  LoginScreen: () => null,
}));

jest.mock('../src/screens/AIDataConsentScreen', () => ({
  AIDataConsentScreen: () => null,
}));

jest.mock('../src/screens/AccountScreen', () => ({
  AccountScreen: () => null,
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

jest.mock('../src/hooks/useAssetIngest', () => ({
  useAssetIngest: () => ({
    toast: null,
    busy: false,
    addLink: jest.fn(),
    pickDocument: jest.fn(),
    pickPhoto: jest.fn(),
    ingestSharedPayload: jest.fn(),
  }),
}));

jest.mock('../src/hooks/useIncomingShare', () => ({
  useIncomingShare: () => ({
    pendingShare: null,
    clearPendingShare: jest.fn(),
  }),
}));

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

test('renders correctly', async () => {
  let tree: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<App />);
  });
  expect(tree!.root.findByProps({ testID: 'mic-toggle' })).toBeTruthy();
  const json = JSON.stringify(tree!.toJSON());
  expect(json).toContain('Ask Donna anything');
  expect(json).not.toContain('Talk to Donna');
});
