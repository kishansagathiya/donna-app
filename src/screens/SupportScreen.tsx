import {
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../components/ThemedText';
import { useThemedStyles } from '../hooks/useThemedStyles';
import type { ThemeColors } from '../theme/colors';

const SUPPORT_EMAIL = 'kishansagathiya@gmail.com';

type Props = {
  visible: boolean;
  onClose: () => void;
};

/** Keep in sync with donna-web/src/pages/Support.tsx */
export function SupportScreen({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(createStyles);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.container,
          { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 },
        ]}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Support</Text>
          <Pressable
            onPress={onClose}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Text style={styles.closeText}>Done</Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.lead}>We're here to help.</Text>

          <Text style={styles.paragraph}>
            Donna is your voice-powered AI second brain. Tap the mic, speak
            naturally, and Donna listens, thinks, and talks back.
          </Text>

          <Text style={styles.sectionTitle}>Getting started</Text>
          <Text style={styles.bullet}>
            • Open the Donna app on your iPhone
          </Text>
          <Text style={styles.bullet}>• Tap the microphone button</Text>
          <Text style={styles.bullet}>
            • Allow microphone access when iOS prompts you
          </Text>
          <Text style={styles.bullet}>• Speak your question or thought</Text>
          <Text style={styles.bullet}>
            • Wait a moment for Donna's spoken reply
          </Text>
          <Text style={styles.bullet}>
            • Tap the mic again to end the session
          </Text>
          <Text style={styles.paragraph}>
            Donna requires an internet connection. The app works best in a quiet
            environment with a stable network.
          </Text>

          <Text style={styles.sectionTitle}>Common issues</Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>Donna doesn't hear me.</Text> Check that
            microphone access is enabled for Donna in Settings → Privacy &amp;
            Security → Microphone.
          </Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>No reply or long delay.</Text> Confirm you
            have a working internet connection and try again in a few seconds.
          </Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>Audio doesn't play.</Text> Make sure your
            iPhone is not muted and volume is turned up.
          </Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>Delete your account.</Text> Open Profile
            in the Donna app, then choose Delete account. This permanently
            removes your conversations, memories, and sign-in from our servers.
          </Text>

          <View style={styles.contactCard}>
            <Text style={styles.sectionTitle}>Contact us</Text>
            <Text style={styles.paragraph}>
              For help, feedback, or account questions, reach us at:
            </Text>
            <Pressable
              onPress={() => void Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
              accessibilityRole="link"
            >
              <Text style={styles.email}>{SUPPORT_EMAIL}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    closeText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.primary,
      minHeight: 44,
      lineHeight: 44,
      paddingHorizontal: 4,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 24,
      paddingTop: 16,
      paddingBottom: 32,
    },
    lead: {
      fontSize: 15,
      color: colors.muted,
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.primary,
      marginTop: 20,
      marginBottom: 10,
    },
    paragraph: {
      fontSize: 15,
      lineHeight: 22,
      color: colors.text,
      marginBottom: 12,
    },
    bullet: {
      fontSize: 15,
      lineHeight: 22,
      color: colors.text,
      marginBottom: 6,
      paddingLeft: 4,
    },
    bold: {
      fontWeight: '600',
      color: colors.text,
    },
    contactCard: {
      marginTop: 8,
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    email: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.primary,
      textDecorationLine: 'underline',
    },
  });
}
