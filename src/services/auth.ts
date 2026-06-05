import AsyncStorage from '@react-native-async-storage/async-storage';
import appleAuth from '@invertase/react-native-apple-authentication';
import { createClient, type Session } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import {
  DEV_EMAIL,
  DEV_PASSWORD,
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
} from '../config';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export async function getSession(): Promise<Session | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}

export async function getAccessToken(): Promise<string | null> {
  const session = await getSession();
  return session?.access_token ?? null;
}

export async function ensureSession(): Promise<void> {
  const session = await getSession();
  if (session) return;

  throw new Error('Not signed in. Please sign in to continue.');
}

export async function signInWithApple(): Promise<void> {
  if (Platform.OS !== 'ios') {
    throw new Error('Sign in with Apple is only available on iOS.');
  }

  if (!appleAuth.isSupported) {
    throw new Error('Sign in with Apple is not available on this device.');
  }

  const credential = await appleAuth.performRequest({
    requestedOperation: appleAuth.Operation.LOGIN,
    requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
  });

  if (!credential.identityToken) {
    throw new Error('No identity token received from Apple.');
  }

  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
    nonce: credential.nonce,
  });

  if (error) {
    if (error.message.toLowerCase().includes('not enabled')) {
      throw new Error(
        'Apple Sign In is not enabled in Supabase. Go to Authentication → Providers → Apple, turn it on, add Client ID com.kishansagathiya.donna, and save.',
      );
    }
    throw new Error(error.message);
  }

  if (credential.fullName) {
    const nameParts: string[] = [];
    if (credential.fullName.givenName) {
      nameParts.push(credential.fullName.givenName);
    }
    if (credential.fullName.middleName) {
      nameParts.push(credential.fullName.middleName);
    }
    if (credential.fullName.familyName) {
      nameParts.push(credential.fullName.familyName);
    }

    const fullName = nameParts.join(' ');
    if (fullName) {
      await supabase.auth.updateUser({
        data: {
          full_name: fullName,
          given_name: credential.fullName.givenName ?? undefined,
          family_name: credential.fullName.familyName ?? undefined,
        },
      });
    }
  }
}

export async function signInWithDevCredentials(): Promise<void> {
  const email = DEV_EMAIL;
  const password = DEV_PASSWORD;
  if (!email || !password) {
    throw new Error('Dev credentials are not configured.');
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(error.message);
  }
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw new Error(error.message);
  }
}

export function onAuthStateChange(
  callback: (session: Session | null) => void,
): () => void {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });

  return () => subscription.unsubscribe();
}
