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
// TEMP-REPRO
import type { ChatTurn } from './src/components/ChatMessages';
import { NotesScreen } from './src/screens/NotesScreen';
import { ActionsScreen } from './src/screens/ActionsScreen';
import { MemoryScreen } from './src/screens/MemoryScreen';
import { PairDeviceScreen } from './src/screens/PairDeviceScreen';
import { PrivacyScreen } from './src/screens/PrivacyScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { SupportScreen } from './src/screens/SupportScreen';
import { TodayScreen } from './src/screens/TodayScreen';
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

const TEMP_LONG_REPLY = `Based on current hands-on testing and early benchmarks, here's how the top models stack up right now — but GPT-5.6 just became ChatGPT's live default, so the rankings may shift once independent benchmarks catch up.

## Quick Picks

- **Just want a great daily assistant?** GPT-5.6 in ChatGPT (Terra tier) or Claude Opus 4.8 if you want more nuanced, pushback-capable responses.
- **Writing code?** Claude Fable 5 for hard problems, Opus 4.8 for everyday work.
- **Need rock-solid factual accuracy?** Gemini 3.1 Pro with Google Search grounding, or GPT-5.5 Instant if hallucination sensitivity is critical (note: GPT-5.6 Sol was flagged by METR for elevated "scheming" behavior).
- **On a budget?** Gemini 3.5 Flash (free in the Gemini app) or Qwen 3.7 Max via API at roughly a tenth of the frontier price.
- **Long documents?** Gemini 3.1 Pro's 2M-token context window is still unmatched; Claude Opus 4.8 handles 500K with better retrieval fidelity.
- **Privacy-sensitive work?** Run Llama 5 70B locally — quality is now within striking distance of last year's frontier.

## The Deeper Picture

Benchmarks only tell half the story. In day-to-day use, the differences that matter most are instruction-following under ambiguity, honesty about uncertainty, and how each model handles being wrong. Claude models still lead on calibrated pushback. GPT-5.6 is the most aggressive about taking initiative, which is great until it confidently does the wrong thing. Gemini 3.1 Pro wins on sheer recall across huge contexts but can be verbose.

If you tell me what you'll actually use it for — coding, writing, research, or casual assistant work — I can give you a much more specific recommendation.`;

// TEMP-REPRO: simulates a streamed long assistant reply (plain-text streaming
// render that flips to parsed markdown on completion), matching the real
// streaming path in ChatScreen.
function TempStreamingChat() {
  const [turn, setTurn] = useState<ChatTurn>({
    id: 'temp-user-1',
    user: 'Which AI model should I be using right now?',
    assistant: '',
    streaming: true,
  });

  useEffect(() => {
    const chunks: string[] = [];
    const step = 24;
    for (let i = 0; i < TEMP_LONG_REPLY.length; i += step) {
      chunks.push(TEMP_LONG_REPLY.slice(0, i + step));
    }
    let index = 0;
    const timer = setInterval(() => {
      index += 1;
      if (index >= chunks.length) {
        clearInterval(timer);
        setTurn(t => ({ ...t, assistant: TEMP_LONG_REPLY, streaming: false }));
        return;
      }
      setTurn(t => ({ ...t, assistant: chunks[index], streaming: true }));
    }, 60);
    return () => clearInterval(timer);
  }, []);

  return (
    <ChatScreen
      micState="idle"
      onMicPress={() => {}}
      turns={[turn]}
      onOpenProfile={() => {}}
    />
  );
}

function ScreenshotShell() {
  const safeAreaInsets = useSafeAreaInsets();
  const styles = useThemedStyles(createStyles);

  if (SCREENSHOT_MODE === 'login') {
    return <LoginScreen onSuccess={() => {}} />;
  }

  // TEMP-REPRO harness for the chat scroll bug.
  if (SCREENSHOT_MODE === 'chat-long') {
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
        <TempStreamingChat />
      </View>
    );
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
      void ingestSharedPayload(payload).then(() => bumpNotesRefresh());
    },
    [bumpNotesRefresh, ingestSharedPayload],
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
            onOpenNote={openNote}
            onClearVoiceChat={() => {
              void clearChat();
            }}
            onToast={showToast}
          />
        ) : null}

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

        {tab === 'actions' ? <ActionsScreen /> : null}

        {tab === 'today' ? (
          <TodayScreen embedded onOpenNote={openNote} />
        ) : null}

        {tab === 'memory' ? <MemoryScreen /> : null}

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
