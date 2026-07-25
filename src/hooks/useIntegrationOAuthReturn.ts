import { useEffect, useRef } from 'react';
import { Linking } from 'react-native';

export type IntegrationOAuthResult = {
  provider: 'granola' | 'google';
  ok: boolean;
  error?: string;
};

/** @deprecated Prefer IntegrationOAuthResult */
export type GranolaOAuthResult = {
  ok: boolean;
  error?: string;
  provider?: 'granola' | 'google';
};

function parseIntegrationOAuthUrl(url: string): IntegrationOAuthResult | null {
  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    // Fall through to string prefix parsing below.
    parsed = null as unknown as URL;
  }

  const tryProvider = (provider: 'granola' | 'google', source: string) => {
    const queryIndex = source.indexOf('?');
    const query = queryIndex >= 0 ? source.slice(queryIndex + 1) : '';
    const params = new URLSearchParams(query);
    const okParam = params.get('ok');
    const error = params.get('error') ?? undefined;
    return {
      provider,
      ok: okParam !== '0' && !error,
      error: error || undefined,
    } satisfies IntegrationOAuthResult;
  };

  if (parsed) {
    const isDonnaScheme = parsed.protocol === 'donna:';
    const host = parsed.hostname || parsed.host;
    const path = parsed.pathname || '';
    if (isDonnaScheme && host === 'integrations') {
      if (
        path === '/granola' ||
        path === 'granola' ||
        path.startsWith('/granola')
      ) {
        const okParam = parsed.searchParams.get('ok');
        const error = parsed.searchParams.get('error') ?? undefined;
        return {
          provider: 'granola',
          ok: okParam !== '0' && !error,
          error: error || undefined,
        };
      }
      if (
        path === '/google' ||
        path === 'google' ||
        path.startsWith('/google')
      ) {
        const okParam = parsed.searchParams.get('ok');
        const error = parsed.searchParams.get('error') ?? undefined;
        return {
          provider: 'google',
          ok: okParam !== '0' && !error,
          error: error || undefined,
        };
      }
    }
  }

  if (
    trimmed.startsWith('donna://integrations/granola') ||
    trimmed.startsWith('donna:integrations/granola')
  ) {
    return tryProvider('granola', trimmed);
  }
  if (
    trimmed.startsWith('donna://integrations/google') ||
    trimmed.startsWith('donna:integrations/google')
  ) {
    return tryProvider('google', trimmed);
  }
  return null;
}

/**
 * Listens for donna://integrations/{provider} OAuth return deep links.
 */
export function useIntegrationOAuthReturn(
  onReturn: (result: IntegrationOAuthResult) => void,
): void {
  const onReturnRef = useRef(onReturn);
  onReturnRef.current = onReturn;

  useEffect(() => {
    let active = true;

    void Linking.getInitialURL().then(url => {
      if (!active || !url) {
        return;
      }
      const result = parseIntegrationOAuthUrl(url);
      if (result) {
        onReturnRef.current(result);
      }
    });

    const subscription = Linking.addEventListener('url', event => {
      const result = parseIntegrationOAuthUrl(event.url);
      if (result) {
        onReturnRef.current(result);
      }
    });

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
}

/** @deprecated Prefer useIntegrationOAuthReturn */
export function useGranolaOAuthReturn(
  onReturn: (result: GranolaOAuthResult) => void,
): void {
  useIntegrationOAuthReturn(result => {
    onReturn({
      ok: result.ok,
      error: result.error,
      provider: result.provider,
    });
  });
}
