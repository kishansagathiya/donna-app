import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppHeader } from '../components/AppHeader';
import { ChatHero } from '../components/ChatHero';
import { ChatInput } from '../components/ChatInput';
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
  statusText?: string | null;
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
  statusText,
  onOpenSettings,
  onOpenProfile,
  onOpenMemory,
}: Props) {
  const styles = useThemedStyles(createStyles);
  const [draftReply, setDraftReply] = useState<string | null>(null);

  function handleSend(text: string) {
    setDraftReply(text);
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
        <ChatHero
          micState={micState}
          onMicPress={onMicPress}
          micDisabled={micDisabled}
          onSuggestionPress={handleSend}
        />
        {statusText ? (
          <Text style={styles.status} accessibilityRole="text">
            {statusText}
          </Text>
        ) : null}
        {draftReply ? (
          <View style={styles.draftBubble}>
            <Text style={styles.draftText}>{draftReply}</Text>
          </View>
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
    status: {
      position: 'absolute',
      bottom: 12,
      left: 24,
      right: 24,
      color: colors.muted,
      fontSize: 14,
      textAlign: 'center',
      lineHeight: 20,
    },
    draftBubble: {
      position: 'absolute',
      bottom: 48,
      right: 24,
      maxWidth: '75%',
      backgroundColor: colors.primary,
      borderRadius: 16,
      borderBottomRightRadius: 4,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    draftText: {
      color: colors.white,
      fontSize: 15,
      lineHeight: 20,
    },
  });
}
