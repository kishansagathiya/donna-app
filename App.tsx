/**
 * Donna — tap to talk with the voice backend.
 *
 * Mic on → stream PCM to donna-server-go → client VAD commits turns →
 * play Donna's reply audio. Tap again to end the session.
 *
 * @format
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { AddMemorySheet } from './src/components/AddMemorySheet';
import { BottomTabBar, type AppTab } from './src/components/BottomTabBar';
import { IngestToast } from './src/components/IngestToast';
import { MicButton, type MicState } from './src/components/MicButton';
import { useAssetIngest } from './src/hooks/useAssetIngest';
import { useIncomingShare } from './src/hooks/useIncomingShare';
import { AuthProvider, useAuth } from './src/hooks/useAuth';
import { useVoiceSession } from './src/hooks/useVoiceSession';
import type { DonnaMode } from './src/types/mode';
import { LoginScreen } from './src/screens/LoginScreen';
import { AIDataConsentScreen } from './src/screens/AIDataConsentScreen';
import { ChatScreen } from './src/screens/ChatScreen';
import { MemoryScreen } from './src/screens/MemoryScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { SCREENSHOT_MODE } from './src/config';
import { useAiDataConsent } from './src/hooks/useAiDataConsent';
import { ThemeProvider, useTheme } from './src/hooks/useTheme';
import { useThemedStyles } from './src/hooks/useThemedStyles';
import type { ThemeColors } from './src/theme/colors';

function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ThemedApp />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function ThemedApp() {
  return (
    <>
      <StatusBar barStyle="dark-content" />
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </>
  );
}

function ScreenshotShell() {
  const safeAreaInsets = useSafeAreaInsets();
  const styles = useThemedStyles(createStyles);

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
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  if (SCREENSHOT_MODE) {
    return <ScreenshotShell />;
  }

  const { isAuthenticated, loading } = useAuth();
  const { accepted: consentAccepted, refresh: refreshConsent } =
    useAiDataConsent();

  if (loading || (isAuthenticated && consentAccepted === null)) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
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
  const styles = useThemedStyles(createStyles);
  const safeAreaInsets = useSafeAreaInsets();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [tab, setTab] = useState<AppTab>('chat');
  const [mode, setMode] = useState<DonnaMode>('talk');
  const {
    state,
    toggleTalk,
    turns,
    transcript,
    reply,
    phaseLabel,
    sessionLabel,
    errorMsg,
    disabled,
  } = useVoiceSession(mode);
  const sessionActive = state === 'listening' || state === 'processing';
  const [sheetOpen, setSheetOpen] = useState(false);
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

  useEffect(() => {
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () =>
      setKeyboardVisible(true),
    );
    const hideSub = Keyboard.addListener(hideEvent, () =>
      setKeyboardVisible(false),
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: safeAreaInsets.top,
          paddingBottom: keyboardVisible ? 0 : safeAreaInsets.bottom,
        },
      ]}
    >
      <KeyboardAvoidingView
        style={styles.keyboardAvoiding}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {tab === 'chat' ? (
          <ChatScreen
            mode={mode}
            onModeChange={setMode}
            modeDisabled={sessionActive || disabled}
            micState={state}
            onMicPress={toggleTalk}
            micDisabled={disabled}
            turns={turns}
            liveTranscript={transcript}
            liveReply={reply}
            phaseLabel={phaseLabel}
            sessionLabel={sessionLabel}
            errorMsg={errorMsg}
            onOpenSettings={() => setTab('profile')}
            onOpenProfile={() => setTab('profile')}
            onAttachPress={() => setSheetOpen(true)}
          />
        ) : null}

        {tab === 'memory' ? (
          <MemoryScreen onAddSourcePress={() => setSheetOpen(true)} />
        ) : null}

        {tab === 'profile' ? <ProfileScreen /> : null}

        {keyboardVisible ? null : (
          <BottomTabBar active={tab} onChange={setTab} />
        )}
      </KeyboardAvoidingView>

      <AddMemorySheet
        visible={sheetOpen}
        busy={ingestBusy}
        onClose={() => setSheetOpen(false)}
        onAddLink={url => {
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
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
    },
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    keyboardAvoiding: {
      flex: 1,
    },
    status: {
      marginTop: 16,
      paddingHorizontal: 24,
      color: colors.muted,
      fontSize: 14,
      textAlign: 'center',
      lineHeight: 20,
    },
  });
}

export default App;
