/**
 * Donna — chat with text or voice.
 *
 * Voice mic captures speech, the server transcribes it, and the transcript
 * goes through the same text chat harness as typed messages.
 *
 * @format
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
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
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { IngestToast } from './src/components/IngestToast';
import { MicButton, type MicState } from './src/components/MicButton';
import { useAssetIngest } from './src/hooks/useAssetIngest';
import {
  useIntegrationOAuthReturn,
  type IntegrationOAuthResult,
} from './src/hooks/useIntegrationOAuthReturn';
import { useIncomingShare } from './src/hooks/useIncomingShare';
import { AuthProvider, useAuth } from './src/hooks/useAuth';
import { NotesQueryProvider } from './src/hooks/NotesQueryProvider';
import { useDeviceSync } from './src/hooks/useDeviceSync';
import { LoginScreen } from './src/screens/LoginScreen';
import { AIDataConsentScreen } from './src/screens/AIDataConsentScreen';
import { ChatScreen } from './src/screens/ChatScreen';
import { NotesScreen } from './src/screens/NotesScreen';
import { ActionsScreen } from './src/screens/ActionsScreen';
import { MemoryScreen } from './src/screens/MemoryScreen';
import { PairDeviceScreen } from './src/screens/PairDeviceScreen';
import { PrivacyScreen } from './src/screens/PrivacyScreen';
import { EmployeesScreen } from './src/screens/EmployeesScreen';
import { SkillsScreen } from './src/screens/SkillsScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { SupportScreen } from './src/screens/SupportScreen';
import { TodayScreen } from './src/screens/TodayScreen';
import { VoiceScreen } from './src/screens/VoiceScreen';
import { SCREENSHOT_MODE } from './src/config';
import { useAiDataConsent } from './src/hooks/useAiDataConsent';
import { ThemeProvider, useTheme } from './src/hooks/useTheme';
import { useThemedStyles } from './src/hooks/useThemedStyles';
import { initErrorReporting } from './src/services/errorReporting';
import type { ThemeColors } from './src/theme/colors';

initErrorReporting();

type LegalDoc = 'privacy' | 'support' | null;

function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ErrorBoundary>
          <ThemedApp />
        </ErrorBoundary>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function ThemedApp() {
  return (
    <>
      <StatusBar barStyle="dark-content" />
      <AuthProvider>
        <NotesQueryProvider>
          <AppShell />
        </NotesQueryProvider>
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
  const [openNoteId, setOpenNoteId] = useState<string | null>(null);
  const [integrationsRefreshToken, setIntegrationsRefreshToken] = useState(0);
  const [integrationOauthResult, setIntegrationOauthResult] =
    useState<IntegrationOAuthResult | null>(null);
  const deviceSync = useDeviceSync();
  const [pairSheetOpen, setPairSheetOpen] = useState(false);
  const [employeesOpen, setEmployeesOpen] = useState(false);
  const [skillsOpen, setSkillsOpen] = useState(false);
  const [pendingAgentRunId, setPendingAgentRunId] = useState<string | null>(
    null,
  );
  const [pendingAgentSkill, setPendingAgentSkill] = useState<string | null>(
    null,
  );
  const [sheetOpen, setSheetOpen] = useState(false);
  const [ingestRefreshToken, setIngestRefreshToken] = useState(0);
  const {
    toast,
    showToast,
    busy: ingestBusy,
    addLink,
    pickDocument,
    pickPhoto,
    ingestSharedPayload,
  } = useAssetIngest();

  const bumpNotesRefresh = useCallback(() => {
    setIngestRefreshToken(token => token + 1);
  }, []);

  const openNote = useCallback((noteId: string) => {
    setOpenNoteId(noteId);
    setTab('notes');
  }, []);

  const handleAddLink = useCallback(() => {
    if (typeof Alert.prompt === 'function') {
      Alert.prompt(
        'Add link',
        'Donna will save this URL to your notes and memory.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Save',
            onPress: (value?: string) => {
              const trimmed = (value ?? '').trim();
              if (!trimmed) return;
              void addLink(trimmed).then(() => bumpNotesRefresh());
            },
          },
        ],
        'plain-text',
        'https://',
      );
      return;
    }
    setSheetOpen(true);
  }, [addLink, bumpNotesRefresh]);

  const handleSaveToMemory = useCallback(() => {
    const options = ['Choose file', 'Choose photo', 'Cancel'];
    const cancelButtonIndex = 2;

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex,
          title: 'Save to memory',
          message: 'Choose a file or photo to keep in Donna’s knowledge.',
        },
        buttonIndex => {
          if (buttonIndex === 0) {
            void pickDocument().then(() => bumpNotesRefresh());
          } else if (buttonIndex === 1) {
            void pickPhoto().then(() => bumpNotesRefresh());
          }
        },
      );
      return;
    }

    Alert.alert(
      'Save to memory',
      'Choose a file or photo to keep in Donna’s knowledge.',
      [
        {
          text: 'Choose file',
          onPress: () => {
            void pickDocument().then(() => bumpNotesRefresh());
          },
        },
        {
          text: 'Choose photo',
          onPress: () => {
            void pickPhoto().then(() => bumpNotesRefresh());
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  }, [bumpNotesRefresh, pickDocument, pickPhoto]);

  const handleShare = useCallback(
    (payload: Parameters<typeof ingestSharedPayload>[0]) => {
      setTab('notes');
      void ingestSharedPayload(payload).then(didSave => {
        if (didSave) bumpNotesRefresh();
      });
    },
    [bumpNotesRefresh, ingestSharedPayload],
  );

  useIncomingShare(handleShare);

  const handleIntegrationOAuthReturn = useCallback(
    (result: IntegrationOAuthResult) => {
      setTab('profile');
      setIntegrationOauthResult(result);
      setIntegrationsRefreshToken(token => token + 1);
    },
    [],
  );

  const handleIntegrationOAuthResultConsumed = useCallback(() => {
    setIntegrationOauthResult(null);
  }, []);

  useIntegrationOAuthReturn(handleIntegrationOAuthReturn);

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
            onOpenProfile={() => setTab('profile')}
            onOpenNote={openNote}
            onToast={showToast}
            pendingAgentRunId={pendingAgentRunId}
            pendingAgentSkill={pendingAgentSkill}
            onPendingAgentConsumed={() => {
              setPendingAgentRunId(null);
              setPendingAgentSkill(null);
            }}
          />
        ) : null}

        {tab === 'voice' ? <VoiceScreen /> : null}

        <View style={{ flex: 1, display: tab === 'notes' ? 'flex' : 'none' }}>
          <NotesScreen
            isVisible={tab === 'notes'}
            notesRefreshToken={
              deviceSync.notesRefreshToken + ingestRefreshToken
            }
            openNoteId={openNoteId}
            onOpenNoteConsumed={() => setOpenNoteId(null)}
            onAddLink={handleAddLink}
            onSaveToMemory={handleSaveToMemory}
          />
        </View>

        <View style={{ flex: 1, display: tab === 'actions' ? 'flex' : 'none' }}>
          <ActionsScreen
            isVisible={tab === 'actions'}
            onOpenProfile={() => setTab('profile')}
            onOpenAgent={runId => {
              setPendingAgentRunId(runId);
              setTab('chat');
            }}
          />
        </View>

        {tab === 'today' ? (
          <TodayScreen embedded onOpenNote={openNote} />
        ) : null}

        {tab === 'memory' ? <MemoryScreen onOpenNote={openNote} /> : null}

        {tab === 'profile' ? (
          <ProfileScreen
            deviceSync={deviceSync}
            onPairDevicePress={() => setPairSheetOpen(true)}
            onOpenPrivacy={() => onOpenLegal('privacy')}
            onOpenSupport={() => onOpenLegal('support')}
            onOpenMemory={() => setTab('memory')}
            onOpenEmployees={() => setEmployeesOpen(true)}
            onOpenSkills={() => setSkillsOpen(true)}
            integrationsRefreshToken={integrationsRefreshToken}
            integrationOauthResult={integrationOauthResult}
            onIntegrationOauthResultConsumed={
              handleIntegrationOAuthResultConsumed
            }
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

      <EmployeesScreen
        visible={employeesOpen}
        onClose={() => setEmployeesOpen(false)}
        onOpenShift={runId => {
          setEmployeesOpen(false);
          if (runId) {
            setPendingAgentRunId(runId);
          }
          setTab('chat');
        }}
      />

      <SkillsScreen
        visible={skillsOpen}
        onClose={() => setSkillsOpen(false)}
        onUseInAgent={name => {
          setSkillsOpen(false);
          setPendingAgentSkill(name);
          setTab('chat');
        }}
      />

      <AddMemorySheet
        visible={sheetOpen}
        busy={ingestBusy}
        onClose={() => setSheetOpen(false)}
        onAddLink={url => {
          void addLink(url).then(() => bumpNotesRefresh());
        }}
        onPickDocument={() => {
          void pickDocument().then(() => bumpNotesRefresh());
        }}
        onPickPhoto={() => {
          void pickPhoto().then(() => bumpNotesRefresh());
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
