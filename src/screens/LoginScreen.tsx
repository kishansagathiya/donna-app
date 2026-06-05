import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SignInButton } from '../components/SignInButton';
import { DEV_EMAIL, DEV_PASSWORD } from '../config';
import { signInWithDevCredentials } from '../services/auth';
import logo from '../../assets/logo.png';

type Props = {
  onSuccess: () => void;
};

export function LoginScreen({ onSuccess }: Props) {
  const insets = useSafeAreaInsets();
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
        <Image source={logo} style={styles.logo} resizeMode="cover" />
        <Text style={styles.title}>Donna</Text>
        <Text style={styles.subtitle}>AI Second Brain, but the BEST</Text>
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
              <ActivityIndicator color="#666666" size="small" />
            ) : (
              <Text style={styles.devButtonText}>Dev sign in</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
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
    color: '#1a1a1a',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 17,
    lineHeight: 26,
    color: '#666666',
    maxWidth: 320,
    textAlign: 'center',
  },
  actions: {
    gap: 16,
  },
  signInLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#666666',
    textAlign: 'center',
  },
  devButton: {
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: '#f0f0f0',
    minWidth: 120,
    alignItems: 'center',
  },
  devButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666666',
  },
});
