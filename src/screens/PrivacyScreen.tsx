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

/** Keep in sync with donna-web/src/pages/Privacy.tsx */
export function PrivacyScreen({ visible, onClose }: Props) {
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
          <Text style={styles.headerTitle}>Privacy Policy</Text>
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
          <Text style={styles.updated}>Last updated: June 12, 2026</Text>

          <Text style={styles.paragraph}>
            Donna ("we," "our," or "us") is a voice-powered AI assistant. This
            policy explains how we handle information when you use the Donna iOS
            app and this website.
          </Text>

          <Text style={styles.sectionTitle}>Information we collect</Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>Account information.</Text> When you sign
            in with Apple or Google, we receive an account identifier and, if you
            choose to share it, your email address and name. This is used to keep
            your data separate from other users and to maintain your session.
          </Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>Voice audio.</Text> When you tap the
            microphone and speak, Donna records audio only during that active
            session. Audio is sent to our servers to transcribe your speech,
            generate a reply, and return spoken audio to the app.
          </Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>Transcripts and replies.</Text> Text
            transcripts of what you say and Donna's responses may be stored on
            our servers to operate the service and improve reliability.
          </Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>Memory content.</Text> Links, documents,
            and photos you add to Donna's memory are uploaded to our servers so
            Donna can recall them in future conversations.
          </Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>Website waitlist.</Text> If you join the
            waitlist on this site, we collect the email address you submit so we
            can notify you about Donna.
          </Text>
          <Text style={styles.paragraph}>
            We do not collect your contacts or precise location.
          </Text>

          <Text style={styles.sectionTitle}>How we use information</Text>
          <Text style={styles.bullet}>
            • To authenticate you and maintain your account
          </Text>
          <Text style={styles.bullet}>
            • To transcribe your speech and generate AI responses
          </Text>
          <Text style={styles.bullet}>
            • To deliver spoken replies through the app
          </Text>
          <Text style={styles.bullet}>
            • To store and recall content you add to memory
          </Text>
          <Text style={styles.bullet}>
            • To send waitlist updates, if you signed up on this site
          </Text>
          <Text style={styles.bullet}>
            • To maintain, secure, and improve Donna
          </Text>
          <Text style={styles.paragraph}>
            We do not use your data for advertising. We do not sell your personal
            information. We do not track you across other companies' apps or
            websites for advertising purposes.
          </Text>

          <Text style={styles.sectionTitle}>Third-party services</Text>
          <Text style={styles.paragraph}>
            Donna uses the following third-party services to operate the app.
            Data is sent to these providers only as needed to provide the
            service:
          </Text>
          <Text style={styles.bullet}>
            • <Text style={styles.bold}>OpenRouter</Text> — speech transcription
            and AI text generation
          </Text>
          <Text style={styles.bullet}>
            • <Text style={styles.bold}>OpenAI, Cartesia, or ElevenLabs</Text> —
            text-to-speech synthesis (one provider is used depending on
            configuration)
          </Text>
          <Text style={styles.bullet}>
            • <Text style={styles.bold}>Supabase</Text> — authentication,
            database, and file storage
          </Text>
          <Text style={styles.paragraph}>
            These providers process data under their own privacy policies. Before
            your first use of voice or memory features, the Donna app asks for
            your permission to share data with these services.
          </Text>

          <Text style={styles.sectionTitle}>Data retention</Text>
          <Text style={styles.paragraph}>
            Voice audio and conversation data are retained on our servers as
            needed to operate the service until you delete your account or we no
            longer need the data to provide Donna.
          </Text>
          <Text style={styles.paragraph}>
            Imported meeting snapshots from integrations remain in Donna after
            disconnect or source-side permission changes until you explicitly
            delete them from Integrations.
          </Text>

          <Text style={styles.sectionTitle}>Account deletion</Text>
          <Text style={styles.paragraph}>
            You can delete your Donna account and the personal data we store for
            you at any time in the iOS app:
          </Text>
          <Text style={styles.bullet}>1. Open Donna and sign in</Text>
          <Text style={styles.bullet}>
            2. Open Profile and choose Delete account
          </Text>
          <Text style={styles.bullet}>3. Confirm deletion</Text>
          <Text style={styles.paragraph}>
            Account deletion is permanent. When you confirm, we delete your
            sign-in account and remove the data associated with it from our
            systems, including account identifier, transcripts, memory content,
            and derived facts. Deletion applies to data stored on our servers and
            in Supabase. It does not remove copies already processed by
            third-party AI providers under their own retention policies. If you
            cannot access the app, contact us using the email below and we will
            help delete your account.
          </Text>

          <Text style={styles.sectionTitle}>Microphone and photo access</Text>
          <Text style={styles.paragraph}>
            The Donna app requests microphone access when you start a voice
            session. Photo library access is requested only when you choose to
            add a photo to memory. You can revoke these permissions at any time
            in iOS Settings.
          </Text>

          <Text style={styles.sectionTitle}>Children</Text>
          <Text style={styles.paragraph}>
            Donna is not directed at children under 13, and we do not knowingly
            collect personal information from children.
          </Text>

          <Text style={styles.sectionTitle}>Changes</Text>
          <Text style={styles.paragraph}>
            We may update this policy from time to time. We will revise the date
            at the top of this page when we do.
          </Text>

          <Text style={styles.sectionTitle}>Contact</Text>
          <Text style={styles.paragraph}>
            Questions about privacy or account deletion? Email{' '}
            <Text
              style={styles.link}
              onPress={() => void Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
            >
              {SUPPORT_EMAIL}
            </Text>
            .
          </Text>
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
    updated: {
      fontSize: 13,
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
    link: {
      color: colors.primary,
      textDecorationLine: 'underline',
    },
  });
}
