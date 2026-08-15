const REFRESH_SKEW_MS = 15_000;

/** True when the JWT expires within `skewMs`. Missing `exp` is treated as fresh. */
export function accessTokenNeedsRefresh(
  token: string,
  now = Date.now(),
  skewMs = REFRESH_SKEW_MS,
): boolean {
  const expMs = jwtExpiryMs(token);
  if (expMs == null) {
    return false;
  }
  return expMs <= now + skewMs;
}

function jwtExpiryMs(token: string): number | null {
  const payload = token.split('.')[1];
  if (!payload) {
    return null;
  }
  try {
    const padded = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json =
      typeof atob === 'function'
        ? atob(padded)
        : Buffer.from(padded, 'base64').toString('utf8');
    const exp = (JSON.parse(json) as { exp?: number }).exp;
    return typeof exp === 'number' ? exp * 1000 : null;
  } catch {
    return null;
  }
}
