import { getAccessToken } from './auth';
import { API_BASE_URL } from '../config';
import { version as APP_VERSION } from '../../package.json';

const MAX_MESSAGE_LENGTH = 1000;
const MAX_STACK_LENGTH = 8000;
const MAX_REPORTS_PER_SESSION = 20;

/** Fingerprints (messages) already reported this app session. */
const reportedFingerprints = new Set<string>();
let reportCount = 0;
let initialized = false;

function toMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message || 'Unknown error';
  }
  if (typeof error === 'string') {
    return error;
  }
  try {
    return JSON.stringify(error) ?? String(error);
  } catch {
    return String(error);
  }
}

/**
 * Fire-and-forget error report to the Donna server (which files GitHub
 * issues). Never throws, never rejects — callers should not await this.
 */
export function reportError(
  error: unknown,
  context?: Record<string, string>,
): void {
  try {
    const message =
      toMessage(error).slice(0, MAX_MESSAGE_LENGTH) || 'Unknown error';

    if (
      reportedFingerprints.has(message) ||
      reportCount >= MAX_REPORTS_PER_SESSION
    ) {
      return;
    }
    reportedFingerprints.add(message);
    reportCount += 1;

    const stack =
      error instanceof Error && error.stack
        ? error.stack.slice(0, MAX_STACK_LENGTH)
        : undefined;

    void (async () => {
      const token = await getAccessToken().catch(() => null);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      await fetch(`${API_BASE_URL}/errors`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          source: 'ios',
          message,
          ...(stack ? { stack } : {}),
          appVersion: APP_VERSION,
          ...(context && Object.keys(context).length > 0 ? { context } : {}),
        }),
      });
    })().catch(() => {});
  } catch {
    // Reporting must never break the app.
  }
}

/**
 * Report uncaught JS errors while preserving the previous global handler
 * (RedBox in dev, crash reporting in release). Safe to call more than once.
 */
export function initErrorReporting(): void {
  if (initialized) {
    return;
  }
  initialized = true;

  try {
    const prev = ErrorUtils.getGlobalHandler();
    ErrorUtils.setGlobalHandler((error, isFatal) => {
      reportError(error, { fatal: String(!!isFatal) });
      prev?.(error, isFatal);
    });
  } catch {
    // ErrorUtils unavailable (e.g. test environment) — skip reporting.
  }
}
