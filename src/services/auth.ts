import AsyncStorage from '@react-native-async-storage/async-storage';
import appleAuth from '@invertase/react-native-apple-authentication';
import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { createClient, type Session } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import {
  DEV_EMAIL,
  DEV_PASSWORD,
  GOOGLE_IOS_CLIENT_ID,
  GOOGLE_WEB_CLIENT_ID,
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
} from '../config';

let googleConfigured = false;

function ensureGoogleConfigured(): void {
  if (googleConfigured) {
    return;
  }

  if (!GOOGLE_WEB_CLIENT_ID) {
    throw new Error(
      'Google Sign In is not configured. Set GOOGLE_WEB_CLIENT_ID in src/config.ts to your Google Web OAuth Client ID.',
    );
  }

  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    ...(GOOGLE_IOS_CLIENT_ID ? { iosClientId: GOOGLE_IOS_CLIENT_ID } : {}),
  });
  googleConfigured = true;
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/** In-memory JWT so chat/voice requests skip AsyncStorage on the hot path. */
let memoryAccessToken: string | null | undefined;

export function primeAccessToken(token: string | null): void {
  memoryAccessToken = token;
}

export async function getSession(): Promise<Session | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  memoryAccessToken = session?.access_token ?? null;
  return session;
}

export async function getAccessToken(): Promise<string | null> {
  if (memoryAccessToken) {
    return memoryAccessToken;
  }
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

export async function signInWithGoogle(): Promise<void> {
  ensureGoogleConfigured();

  try {
    if (Platform.OS === 'android') {
      await GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: true,
      });
    }

    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) {
      return;
    }

    const idToken = response.data.idToken;
    if (!idToken) {
      throw new Error('No identity token received from Google.');
    }

    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });

    if (error) {
      if (error.message.toLowerCase().includes('not enabled')) {
        throw new Error(
          'Google Sign In is not enabled in Supabase. Go to Authentication → Providers → Google, turn it on, add your Web Client ID (and iOS Client ID), and save.',
        );
      }
      throw new Error(error.message);
    }

    const { user } = response.data;
    if (user?.name || user?.givenName || user?.familyName) {
      await supabase.auth.updateUser({
        data: {
          full_name: user.name ?? undefined,
          given_name: user.givenName ?? undefined,
          family_name: user.familyName ?? undefined,
        },
      });
    }
  } catch (error) {
    if (isErrorWithCode(error) && error.code === statusCodes.SIGN_IN_CANCELLED) {
      return;
    }
    if (isErrorWithCode(error) && error.code === statusCodes.IN_PROGRESS) {
      throw new Error('Google Sign In is already in progress.');
    }
    if (
      isErrorWithCode(error) &&
      error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE
    ) {
      throw new Error('Google Play Services are not available on this device.');
    }
    throw error instanceof Error
      ? error
      : new Error('Sign in with Google failed.');
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
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const userId = session?.user.id;
  const { error } = await supabase.auth.signOut();
  memoryAccessToken = null;
  if (userId) {
    const { clearNotesCacheForUser } = await import(
      '../hooks/NotesQueryProvider'
    );
    await clearNotesCacheForUser(userId);
  }
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
    memoryAccessToken = session?.access_token ?? null;
    callback(session);
  });

  return () => subscription.unsubscribe();
}
