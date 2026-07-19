import { useEffect, useRef } from 'react';
import { Linking } from 'react-native';

export type GranolaOAuthResult = {
  ok: boolean;
  error?: string;
};

function parseGranolaOAuthUrl(url: string): GranolaOAuthResult | null {
  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }

  // donna://integrations/granola?ok=1
  // donna://integrations/granola?ok=0&error=...
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  const isDonnaScheme = parsed.protocol === 'donna:';
  const host = parsed.hostname || parsed.host;
  const path = parsed.pathname || '';
  const matches =
    isDonnaScheme &&
    host === 'integrations' &&
    (path === '/granola' || path === 'granola' || path.startsWith('/granola'));

  if (!matches) {
    // Some Android URL parsers yield path-only forms.
    if (
      trimmed.startsWith('donna://integrations/granola') ||
      trimmed.startsWith('donna:integrations/granola')
    ) {
      const queryIndex = trimmed.indexOf('?');
      const query = queryIndex >= 0 ? trimmed.slice(queryIndex + 1) : '';
      const params = new URLSearchParams(query);
      const okParam = params.get('ok');
      const error = params.get('error') ?? undefined;
      return {
        ok: okParam !== '0' && !error,
        error: error || undefined,
      };
    }
    return null;
  }

  const okParam = parsed.searchParams.get('ok');
  const error = parsed.searchParams.get('error') ?? undefined;
  return {
    ok: okParam !== '0' && !error,
    error: error || undefined,
  };
}

/**
 * Listens for donna://integrations/granola OAuth return deep links.
 */
export function useGranolaOAuthReturn(
  onReturn: (result: GranolaOAuthResult) => void,
): void {
  const onReturnRef = useRef(onReturn);
  onReturnRef.current = onReturn;

  useEffect(() => {
    let active = true;

    void Linking.getInitialURL().then(url => {
      if (!active || !url) {
        return;
      }
      const result = parseGranolaOAuthUrl(url);
      if (result) {
        onReturnRef.current(result);
      }
    });

    const subscription = Linking.addEventListener('url', event => {
      const result = parseGranolaOAuthUrl(event.url);
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
