/**
 * Donna — tap to talk with the voice backend.
 *
 * Mic on → stream PCM to donna-server → client VAD commits turns →
 * play Donna's reply audio. Tap again to end the session.
 *
 * @format
 */

import React from 'react';
import {
  ActivityIndicator,
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
import { MicButton, type MicState } from './src/components/MicButton';
import { AuthProvider, useAuth } from './src/hooks/useAuth';
import { useVoiceSession } from './src/hooks/useVoiceSession';
import { LoginScreen } from './src/screens/LoginScreen';
import { SCREENSHOT_MODE } from './src/config';

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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#9A7B2F" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen onSuccess={() => {}} />;
  }

  return <AppContent />;
}

function AppContent() {
  const isDarkMode = useColorScheme() === 'dark';
  const safeAreaInsets = useSafeAreaInsets();
  const { state, toggleTalk, statusText, disabled } = useVoiceSession();

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
      <MicButton state={state} onPress={toggleTalk} disabled={disabled} />
      {statusText ? (
        <Text
          style={[styles.status, isDarkMode && styles.statusDark]}
          accessibilityRole="text"
        >
          {statusText}
        </Text>
      ) : null}
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
});

export default App;
