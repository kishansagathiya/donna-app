import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text } from '../components/ThemedText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SignInButton } from '../components/SignInButton';
import { SignInWithGoogleButton } from '../components/SignInWithGoogleButton';
import { DEV_EMAIL, DEV_PASSWORD } from '../config';
import { useTheme } from '../hooks/useTheme';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { logoForTheme } from '../lib/logo';
import { RELEASE_LABEL } from '../lib/release';
import { signInWithDevCredentials, signInWithPassword } from '../services/auth';
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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

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

  async function handlePasswordSignIn() {
    setPasswordLoading(true);
    try {
      await signInWithPassword(email, password);
      onSuccess();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Sign in failed.';
      handleError(message);
    } finally {
      setPasswordLoading(false);
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
        <Text style={styles.version}>{RELEASE_LABEL}</Text>
        <Text style={styles.subtitle}>
          AI Second Brain, but the{' '}
          <Text style={styles.subtitleBest}>BEST</Text>
        </Text>
      </View>

      <View style={styles.actions}>
        <Text style={styles.signInLabel}>Sign in to continue</Text>
        <SignInButton onSuccess={onSuccess} onError={handleError} />
        <SignInWithGoogleButton onSuccess={onSuccess} onError={handleError} />

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="username"
          autoComplete="username"
          editable={!passwordLoading}
        />
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          placeholderTextColor={colors.muted}
          secureTextEntry
          textContentType="password"
          autoComplete="password"
          editable={!passwordLoading}
          onSubmitEditing={() => void handlePasswordSignIn()}
        />
        <TouchableOpacity
          style={styles.emailButton}
          onPress={() => void handlePasswordSignIn()}
          disabled={passwordLoading}
          activeOpacity={0.7}
        >
          {passwordLoading ? (
            <ActivityIndicator color={colors.text} size="small" />
          ) : (
            <Text style={styles.emailButtonText}>Sign in with email</Text>
          )}
        </TouchableOpacity>

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
    version: {
      fontSize: 13,
      fontWeight: '600',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
      color: colors.primary,
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
    dividerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    dividerLine: {
      flex: 1,
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
    },
    dividerText: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.muted,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      fontFamily: colors.fontFamily,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 16,
      color: colors.text,
      backgroundColor: colors.surface,
      fontFamily: colors.fontFamily,
    },
    emailButton: {
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 48,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingVertical: 14,
      paddingHorizontal: 16,
    },
    emailButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
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
