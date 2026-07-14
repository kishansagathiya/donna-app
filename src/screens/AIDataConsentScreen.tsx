import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '../components/ThemedText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { grantAiDataConsent } from '../services/privacyConsent';
import type { ThemeColors } from '../theme/colors';

type Props = {
  onAccepted: () => void;
  onOpenPrivacy?: () => void;
};

export function AIDataConsentScreen({ onAccepted, onOpenPrivacy }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [saving, setSaving] = useState(false);

  async function handleAccept() {
    setSaving(true);
    try {
      await grantAiDataConsent();
      onAccepted();
    } finally {
      setSaving(false);
    }
  }

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
      ]}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>How Donna uses your data</Text>
        <Text style={styles.lead}>
          Donna sends some of your information to third-party AI services so it
          can listen, think, and talk back. Please review before continuing.
        </Text>

        <Text style={styles.sectionTitle}>What we send</Text>
        <View style={styles.bulletList}>
          <Text style={styles.bullet}>
            • Voice audio while the mic is active — for example, when you ask
            "Remind me what I saved about that trip"
          </Text>
          <Text style={styles.bullet}>
            • Transcripts of what you say and Donna's text replies
          </Text>
          <Text style={styles.bullet}>
            • Links, documents, and photos you add to memory
          </Text>
          <Text style={styles.bullet}>
            • Your account identifier so Donna can keep your data separate from
            other users
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Who receives it</Text>
        <View style={styles.bulletList}>
          <Text style={styles.bullet}>
            • OpenRouter — speech transcription and AI responses
          </Text>
          <Text style={styles.bullet}>
            • Speech synthesis providers (such as OpenAI, Cartesia, or
            ElevenLabs) — to speak Donna's replies aloud
          </Text>
          <Text style={styles.bullet}>
            • Supabase — secure sign-in and storage for your account and saved
            memories
          </Text>
        </View>

        <Text style={styles.note}>
          Donna does not use your data for advertising or sell your personal
          information. You can revoke microphone access anytime in iOS Settings.
        </Text>

        <Pressable
          style={styles.linkButton}
          onPress={onOpenPrivacy}
          accessibilityRole="link"
          disabled={!onOpenPrivacy}
        >
          <Text style={styles.linkText}>Read full Privacy Policy</Text>
        </Pressable>
      </ScrollView>

      <Pressable
        style={[styles.acceptButton, saving && styles.acceptButtonDisabled]}
        onPress={handleAccept}
        disabled={saving}
        accessibilityRole="button"
      >
        {saving ? (
          <ActivityIndicator color={colors.white} size="small" />
        ) : (
          <Text style={styles.acceptButtonText}>
            I agree — continue to Donna
          </Text>
        )}
      </Pressable>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingHorizontal: 24,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 16,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.5,
      marginBottom: 12,
      fontFamily: colors.fontFamily,
    },
    lead: {
      fontSize: 16,
      lineHeight: 24,
      color: colors.muted,
      marginBottom: 24,
      fontFamily: colors.fontFamily,
    },
    sectionTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 10,
      fontFamily: colors.fontFamily,
    },
    bulletList: {
      gap: 10,
      marginBottom: 22,
    },
    bullet: {
      fontSize: 15,
      lineHeight: 22,
      color: colors.muted,
      fontFamily: colors.fontFamily,
    },
    note: {
      fontSize: 14,
      lineHeight: 21,
      color: colors.muted,
      marginBottom: 12,
      fontFamily: colors.fontFamily,
    },
    linkButton: {
      alignSelf: 'flex-start',
      paddingVertical: 4,
    },
    linkText: {
      fontSize: 15,
      fontWeight: '500',
      color: colors.primary,
      textDecorationLine: 'underline',
      fontFamily: colors.fontFamily,
    },
    acceptButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 8,
    },
    acceptButtonDisabled: {
      opacity: 0.7,
    },
    acceptButtonText: {
      color: colors.white,
      fontSize: 16,
      fontWeight: '600',
      fontFamily: colors.fontFamily,
    },
  });
}
