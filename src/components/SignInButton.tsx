import { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text } from './ThemedText';
import appleAuth from '@invertase/react-native-apple-authentication';
import { signInWithApple } from '../services/auth';

type Props = {
  onSuccess?: () => void;
  onError?: (message: string) => void;
};

export function SignInButton({ onSuccess, onError }: Props) {
  const [loading, setLoading] = useState(false);

  async function handlePress() {
    setLoading(true);
    try {
      await signInWithApple();
      onSuccess?.();
    } catch (error) {
      if (
        error instanceof Error &&
        'code' in error &&
        (error as { code: string }).code === appleAuth.Error.CANCELED
      ) {
        return;
      }
      const message =
        error instanceof Error
          ? error.message
          : 'Sign in failed. Please try again.';
      onError?.(message);
    } finally {
      setLoading(false);
    }
  }

  if (Platform.OS !== 'ios') {
    return (
      <View style={styles.unavailable}>
        <Text style={styles.unavailableText}>
          Sign in with Apple is available on iOS.
        </Text>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={handlePress}
      disabled={loading}
      activeOpacity={0.85}
    >
      {loading ? (
        <ActivityIndicator color="#ffffff" />
      ) : (
        <Text style={styles.buttonText}>Sign in with Apple</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: '100%',
    height: 52,
    borderRadius: 14,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#ffffff',
  },
  unavailable: {
    paddingVertical: 16,
  },
  unavailableText: {
    fontSize: 15,
    color: '#666666',
    textAlign: 'center',
  },
});
