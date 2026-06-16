/**
 * Donna — tap to talk with the voice backend.
 *
 * Mic on → stream PCM to donna-server-go → client VAD commits turns →
 * play Donna's reply audio. Tap again to end the session.
 *
 * @format
 */

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { AddMemorySheet } from './src/components/AddMemorySheet';
import { IngestToast } from './src/components/IngestToast';
import { MicButton, type MicState } from './src/components/MicButton';
import { useAssetIngest } from './src/hooks/useAssetIngest';
import { useIncomingShare } from './src/hooks/useIncomingShare';
import { AuthProvider, useAuth } from './src/hooks/useAuth';
import { useVoiceSession } from './src/hooks/useVoiceSession';
import { ModeToggle } from './src/components/ModeToggle';
import type { DonnaMode } from './src/types/mode';
import { LoginScreen } from './src/screens/LoginScreen';
import { AIDataConsentScreen } from './src/screens/AIDataConsentScreen';
import { AccountScreen } from './src/screens/AccountScreen';
import { SCREENSHOT_MODE } from './src/config';
import { useAiDataConsent } from './src/hooks/useAiDataConsent';

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

function ScreenshotShell() {
  const safeAreaInsets = useSafeAreaInsets();

  if (SCREENSHOT_MODE === 'login') {
    return <LoginScreen onSuccess={() => {}} />;
  }

  const micState: MicState =
    SCREENSHOT_MODE === 'voice-listening' ? 'listening' : 'idle';
  const statusText =
    SCREENSHOT_MODE === 'voice-listening' ? 'Listening…' : 'Tap to talk with Donna';

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: safeAreaInsets.top,
          paddingBottom: safeAreaInsets.bottom,
        },
      ]}
    >
      <MicButton state={micState} onPress={() => {}} />
      <Text style={styles.status}>{statusText}</Text>
    </View>
  );
}

function AppShell() {
  if (SCREENSHOT_MODE) {
    return <ScreenshotShell />;
  }

  const { isAuthenticated, loading } = useAuth();
  const { accepted: consentAccepted, refresh: refreshConsent } =
    useAiDataConsent();

  if (loading || (isAuthenticated && consentAccepted === null)) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#9A7B2F" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen onSuccess={() => {}} />;
  }

  if (!consentAccepted) {
    return <AIDataConsentScreen onAccepted={() => void refreshConsent()} />;
  }

  return <AppContent />;
}

function AppContent() {
  const isDarkMode = useColorScheme() === 'dark';
  const safeAreaInsets = useSafeAreaInsets();
  const [mode, setMode] = useState<DonnaMode>('listen');
  const { state, toggleTalk, statusText, disabled } = useVoiceSession(mode);
  const sessionActive = state === 'listening' || state === 'processing';
  const [sheetOpen, setSheetOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const {
    toast,
    busy: ingestBusy,
    addLink,
    pickDocument,
    pickPhoto,
    ingestSharedPayload,
  } = useAssetIngest();

  const handleShare = useCallback(
    (payload: Parameters<typeof ingestSharedPayload>[0]) => {
      void ingestSharedPayload(payload);
    },
    [ingestSharedPayload],
  );

  useIncomingShare(handleShare);

  return (
    <View
      style={[
        styles.container,
        isDarkMode && styles.containerDark,
        {
          paddingTop: safeAreaInsets.top,
          paddingBottom: safeAreaInsets.bottom,
        },
      ]}
    >
      <Pressable
        style={[styles.accountButton, { top: safeAreaInsets.top + 12 }]}
        onPress={() => setAccountOpen(true)}
        accessibilityLabel="Account settings"
        accessibilityRole="button"
      >
        <Text style={styles.accountButtonText}>⚙</Text>
      </Pressable>

      <Pressable
        style={[styles.addButton, { top: safeAreaInsets.top + 12 }]}
        onPress={() => setSheetOpen(true)}
        accessibilityLabel="Add to memory"
        accessibilityRole="button"
        disabled={ingestBusy}
      >
        <Text style={styles.addButtonText}>+</Text>
      </Pressable>

      <ModeToggle
        mode={mode}
        onChange={setMode}
        disabled={sessionActive || disabled}
      />

      <MicButton state={state} onPress={toggleTalk} disabled={disabled} />
      {statusText ? (
        <Text
          style={[styles.status, isDarkMode && styles.statusDark]}
          accessibilityRole="text"
        >
          {statusText}
        </Text>
      ) : null}

      <AddMemorySheet
        visible={sheetOpen}
        busy={ingestBusy}
        onClose={() => setSheetOpen(false)}
        onAddLink={(url) => {
          void addLink(url);
        }}
        onPickDocument={() => {
          void pickDocument();
        }}
        onPickPhoto={() => {
          void pickPhoto();
        }}
      />
      <IngestToast toast={toast} />
      <AccountScreen
        visible={accountOpen}
        onClose={() => setAccountOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  containerDark: {
    backgroundColor: '#000000',
  },
  status: {
    marginTop: 16,
    paddingHorizontal: 24,
    color: '#666666',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  statusDark: {
    color: '#aaaaaa',
  },
  addButton: {
    position: 'absolute',
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f2efe6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e0d8c4',
  },
  accountButton: {
    position: 'absolute',
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f2efe6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e0d8c4',
  },
  accountButtonText: {
    fontSize: 20,
    lineHeight: 22,
    color: '#9A7B2F',
  },
  addButtonText: {
    fontSize: 24,
    lineHeight: 26,
    color: '#9A7B2F',
    fontWeight: '500',
  },
});

export default App;
