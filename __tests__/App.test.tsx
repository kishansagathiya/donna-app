/**
 * @format
 */

jest.mock('react-native-blob-util', () => ({
  __esModule: true,
  default: {
    fs: {
      readFile: jest.fn(async () => ''),
      stat: jest.fn(async () => ({ size: 0 })),
    },
  },
}));

jest.mock('react-native-document-picker', () => ({
  __esModule: true,
  default: {
    pick: jest.fn(async () => []),
    isCancel: jest.fn(() => false),
  },
}));

jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: jest.fn(async () => ({ didCancel: true, assets: [] })),
}));

jest.mock('@react-native-clipboard/clipboard', () => ({
  setString: jest.fn(),
  getString: jest.fn(async () => ''),
}));

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
    clearChat: jest.fn(),
    turns: [],
    transcript: null,
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

jest.mock('../src/services/auth', () => ({
  getAccessToken: jest.fn(async () => 'token'),
  signInWithApple: jest.fn(),
  signInWithGoogle: jest.fn(),
  signOut: jest.fn(),
  getSession: jest.fn(async () => ({ user: { id: 'user-1' } })),
  onAuthStateChange: jest.fn(() => jest.fn()),
}));

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(async () => true),
    signIn: jest.fn(async () => ({ type: 'cancelled', data: null })),
  },
  isErrorWithCode: jest.fn(() => false),
  isSuccessResponse: jest.fn(() => false),
  statusCodes: {
    SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
    IN_PROGRESS: 'IN_PROGRESS',
    PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
  },
}));

jest.mock('../src/screens/LoginScreen', () => ({
  LoginScreen: () => null,
}));

jest.mock('../src/screens/AIDataConsentScreen', () => ({
  AIDataConsentScreen: () => null,
}));

jest.mock('../src/screens/ProfileScreen', () => ({
  ProfileScreen: () => null,
}));

jest.mock('../src/screens/NotesScreen', () => ({
  NotesScreen: () => null,
}));

jest.mock('../src/screens/ActionsScreen', () => ({
  ActionsScreen: () => null,
}));

jest.mock('../src/screens/TodayScreen', () => ({
  TodayScreen: () => null,
}));

jest.mock('../src/screens/MemoryScreen', () => ({
  MemoryScreen: () => null,
}));

jest.mock('../src/screens/PairDeviceScreen', () => ({
  PairDeviceScreen: () => null,
}));

jest.mock('../src/screens/PrivacyScreen', () => ({
  PrivacyScreen: () => null,
}));

jest.mock('../src/screens/SupportScreen', () => ({
  SupportScreen: () => null,
}));

jest.mock('../src/components/AddMemorySheet', () => ({
  AddMemorySheet: () => null,
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

jest.mock('../src/hooks/useDeviceSync', () => ({
  useDeviceSync: () => ({
    connected: false,
    deviceName: null,
    uploadState: 'idle',
    syncPath: 'idle',
    syncProgress: null,
    pendingCount: 0,
    notesRefreshToken: 0,
    lastMessage: null,
    forgetDevice: jest.fn(async () => {}),
    disconnectForProvisioning: jest.fn(async () => {}),
    reconnectDevice: jest.fn(async () => {}),
  }),
  listPairedDevices: jest.fn(async () => []),
}));

jest.mock('../src/config', () => ({
  ...jest.requireActual('../src/config'),
  // Tests always exercise the real app shell, never a screenshot/repro mode.
  SCREENSHOT_MODE: null,
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
