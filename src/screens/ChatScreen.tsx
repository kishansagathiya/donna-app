import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppHeader } from '../components/AppHeader';
import { ChatHero } from '../components/ChatHero';
import { ChatInput } from '../components/ChatInput';
import { ChatMessages, type ChatTurn } from '../components/ChatMessages';
import type { MicState } from '../components/MicButton';
import { useThemedStyles } from '../hooks/useThemedStyles';
import type { ThemeColors } from '../theme/colors';
import type { DonnaMode } from '../types/mode';

type Props = {
  mode: DonnaMode;
  onModeChange: (mode: DonnaMode) => void;
  modeDisabled?: boolean;
  micState: MicState;
  onMicPress: () => void;
  micDisabled?: boolean;
  turns: ChatTurn[];
  liveTranscript?: string | null;
  liveReply?: string | null;
  phaseLabel?: string | null;
  sessionLabel?: string | null;
  errorMsg?: string | null;
  onOpenSettings: () => void;
  onOpenProfile: () => void;
  onOpenMemory: () => void;
};

export function ChatScreen({
  mode,
  onModeChange,
  modeDisabled,
  micState,
  onMicPress,
  micDisabled,
  turns,
  liveTranscript,
  liveReply,
  phaseLabel,
  sessionLabel,
  errorMsg,
  onOpenSettings,
  onOpenProfile,
  onOpenMemory,
}: Props) {
  const styles = useThemedStyles(createStyles);
  const [textMessages, setTextMessages] = useState<ChatTurn[]>([]);

  const messages: ChatTurn[] = [...textMessages, ...turns];

  if (liveTranscript || liveReply) {
    messages.push({
      id: 'live',
      user: liveTranscript ?? '',
      assistant: liveReply ?? null,
    });
  }

  const hasMessages = messages.length > 0;

  function handleSend(text: string) {
    setTextMessages(prev => [
      ...prev,
      { id: `text-${prev.length}`, user: text, assistant: null },
    ]);
  }

  return (
    <View style={styles.container}>
      <AppHeader
        mode={mode}
        onModeChange={onModeChange}
        modeDisabled={modeDisabled}
        onAvatarPress={onOpenProfile}
        onSettingsPress={onOpenSettings}
      />

      <View style={styles.main}>
        {hasMessages ? (
          <ChatMessages
            turns={messages}
            phaseLabel={phaseLabel}
          />
        ) : null}

        <ChatHero
          micState={micState}
          onMicPress={onMicPress}
          micDisabled={micDisabled}
          compact={hasMessages}
          sessionLabel={sessionLabel}
        />

        {errorMsg ? (
          <Text style={styles.error} accessibilityRole="alert">
            {errorMsg}
          </Text>
        ) : null}
      </View>

      <ChatInput
        onSend={handleSend}
        onMemoryPress={onOpenMemory}
        disabled={micDisabled}
      />
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    main: {
      flex: 1,
      backgroundColor: colors.surface,
    },
    error: {
      paddingHorizontal: 24,
      paddingBottom: 8,
      color: colors.destructive,
      fontSize: 14,
      textAlign: 'center',
      lineHeight: 20,
    },
  });
}
