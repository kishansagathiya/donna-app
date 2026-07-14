import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text } from '../components/ThemedText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SignInButton } from '../components/SignInButton';
import { DEV_EMAIL, DEV_PASSWORD } from '../config';
import { useTheme } from '../hooks/useTheme';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { logoForTheme } from '../lib/logo';
import { signInWithDevCredentials } from '../services/auth';
import type { ThemeColors } from '../theme/colors';

type Props = {
  onSuccess: () => void;
  onOpenPrivacy?: () => void;
};

export function LoginScreen({ onSuccess, onOpenPrivacy }: Props) {
  const insets = useSafeAreaInsets();
  const { theme, colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [devLoading, setDevLoading] = useState(false);

  const hasDevCredentials = __DEV__ && !!DEV_EMAIL && !!DEV_PASSWORD;

  function handleError(message: string) {
    Alert.alert('Sign In Failed', message);
  }

  async function handleDevSignIn() {
    setDevLoading(true);
    try {
      await signInWithDevCredentials();
      onSuccess();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Dev sign-in failed.';
      Alert.alert('Dev Sign In Failed', message);
    } finally {
      setDevLoading(false);
    }
  }

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 32 },
      ]}
    >
      <View style={styles.hero}>
        <Image
          source={logoForTheme(theme)}
          style={styles.logo}
          resizeMode="cover"
        />
        <Text style={styles.title}>Donna</Text>
        <Text style={styles.subtitle}>
          AI Second Brain, but the{' '}
          <Text style={styles.subtitleBest}>BEST</Text>
        </Text>
      </View>

      <View style={styles.actions}>
        <Text style={styles.signInLabel}>Sign in to continue</Text>
        <SignInButton onSuccess={onSuccess} onError={handleError} />

        {hasDevCredentials && (
          <TouchableOpacity
            style={styles.devButton}
            onPress={handleDevSignIn}
            disabled={devLoading}
            activeOpacity={0.7}
          >
            {devLoading ? (
              <ActivityIndicator color={colors.muted} size="small" />
            ) : (
              <Text style={styles.devButtonText}>Dev sign in</Text>
            )}
          </TouchableOpacity>
        )}

        <Pressable
          style={styles.privacyLink}
          onPress={onOpenPrivacy}
          accessibilityRole="link"
          disabled={!onOpenPrivacy}
        >
          <Text style={styles.privacyLinkText}>Privacy Policy</Text>
        </Pressable>
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingHorizontal: 24,
      justifyContent: 'space-between',
    },
    hero: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 16,
    },
    logo: {
      width: 96,
      height: 96,
      borderRadius: 48,
      marginBottom: 8,
    },
    title: {
      fontSize: 40,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.5,
      textAlign: 'center',
      fontFamily: colors.fontFamily,
    },
    subtitle: {
      fontSize: 17,
      lineHeight: 26,
      color: colors.muted,
      maxWidth: 320,
      textAlign: 'center',
      fontFamily: colors.fontFamily,
    },
    subtitleBest: {
      fontStyle: 'italic',
      fontWeight: '700',
      color: colors.primary,
    },
    actions: {
      gap: 16,
    },
    signInLabel: {
      fontSize: 15,
      fontWeight: '500',
      color: colors.muted,
      textAlign: 'center',
      fontFamily: colors.fontFamily,
    },
    devButton: {
      alignSelf: 'center',
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 999,
      backgroundColor: colors.surface,
      minWidth: 120,
      alignItems: 'center',
    },
    devButtonText: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.muted,
      fontFamily: colors.fontFamily,
    },
    privacyLink: {
      alignSelf: 'center',
      paddingVertical: 8,
    },
    privacyLinkText: {
      fontSize: 14,
      color: colors.primary,
      textDecorationLine: 'underline',
      fontFamily: colors.fontFamily,
    },
  });
}
