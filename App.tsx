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
  View,
} from 'react-native';
import { Text } from './src/components/ThemedText';
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
import { useDeviceSync } from './src/hooks/useDeviceSync';
import { useVoiceSession } from './src/hooks/useVoiceSession';
import { LoginScreen } from './src/screens/LoginScreen';
import { AIDataConsentScreen } from './src/screens/AIDataConsentScreen';
import { ChatScreen } from './src/screens/ChatScreen';
import { NotesScreen } from './src/screens/NotesScreen';
import { MemoryScreen } from './src/screens/MemoryScreen';
import { PairDeviceScreen } from './src/screens/PairDeviceScreen';
import { PrivacyScreen } from './src/screens/PrivacyScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { SupportScreen } from './src/screens/SupportScreen';
import { SCREENSHOT_MODE } from './src/config';
import { useAiDataConsent } from './src/hooks/useAiDataConsent';
import { ThemeProvider, useTheme } from './src/hooks/useTheme';
import { useThemedStyles } from './src/hooks/useThemedStyles';
import type { ThemeColors } from './src/theme/colors';

type LegalDoc = 'privacy' | 'support' | null;

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
  const [legalDoc, setLegalDoc] = useState<LegalDoc>(null);

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
    return (
      <>
        <LoginScreen
          onSuccess={() => {}}
          onOpenPrivacy={() => setLegalDoc('privacy')}
        />
        <PrivacyScreen
          visible={legalDoc === 'privacy'}
          onClose={() => setLegalDoc(null)}
        />
      </>
    );
  }

  if (!consentAccepted) {
    return (
      <>
        <AIDataConsentScreen
          onAccepted={() => void refreshConsent()}
          onOpenPrivacy={() => setLegalDoc('privacy')}
        />
        <PrivacyScreen
          visible={legalDoc === 'privacy'}
          onClose={() => setLegalDoc(null)}
        />
      </>
    );
  }

  return (
    <AppContent
      legalDoc={legalDoc}
      onOpenLegal={setLegalDoc}
      onCloseLegal={() => setLegalDoc(null)}
    />
  );
}

function AppContent({
  legalDoc,
  onOpenLegal,
  onCloseLegal,
}: {
  legalDoc: LegalDoc;
  onOpenLegal: (doc: LegalDoc) => void;
  onCloseLegal: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  const safeAreaInsets = useSafeAreaInsets();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [tab, setTab] = useState<AppTab>('chat');
  const {
    state,
    toggleTalk,
    clearChat,
    turns,
    transcript,
    reply,
    phaseLabel,
    sessionLabel,
    errorMsg,
    disabled,
  } = useVoiceSession();
  const deviceSync = useDeviceSync();
  const [pairSheetOpen, setPairSheetOpen] = useState(false);
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
            micState={state}
            onMicPress={toggleTalk}
            micDisabled={disabled}
            turns={turns}
            liveTranscript={transcript}
            liveReply={reply}
            phaseLabel={phaseLabel}
            sessionLabel={sessionLabel}
            errorMsg={errorMsg}
            onOpenProfile={() => setTab('profile')}
            onAttachPress={() => {
              void pickDocument();
            }}
            onClearVoiceChat={() => {
              void clearChat();
            }}
          />
        ) : null}

        <View style={{ flex: 1, display: tab === 'notes' ? 'flex' : 'none' }}>
          <NotesScreen
            isVisible={tab === 'notes'}
            notesRefreshToken={deviceSync.notesRefreshToken}
          />
        </View>

        {tab === 'memory' ? (
          <MemoryScreen onAddSourcePress={() => setSheetOpen(true)} />
        ) : null}

        {tab === 'profile' ? (
          <ProfileScreen
            deviceSync={deviceSync}
            onPairDevicePress={() => setPairSheetOpen(true)}
            onOpenPrivacy={() => onOpenLegal('privacy')}
            onOpenSupport={() => onOpenLegal('support')}
          />
        ) : null}

        {keyboardVisible ? null : (
          <BottomTabBar active={tab} onChange={setTab} />
        )}
      </KeyboardAvoidingView>

      {pairSheetOpen ? (
        <PairDeviceScreen
          onClose={() => setPairSheetOpen(false)}
          onBeforeBleProvision={deviceSync.disconnectForProvisioning}
          onAfterBleProvision={deviceSync.reconnectDevice}
        />
      ) : null}

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
      <PrivacyScreen
        visible={legalDoc === 'privacy'}
        onClose={onCloseLegal}
      />
      <SupportScreen
        visible={legalDoc === 'support'}
        onClose={onCloseLegal}
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
