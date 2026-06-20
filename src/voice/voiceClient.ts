import type { ClientMessage, ServerMessage } from './protocol';
import { parseServerMessage } from './protocol';

export type VoiceClientHandlers = {
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (message: string) => void;
  onMessage?: (message: ServerMessage) => void;
};

export class VoiceClient {
  private ws: WebSocket | null = null;
  private handlers: VoiceClientHandlers = {};

  constructor(private readonly url: string) {}

  setHandlers(handlers: VoiceClientHandlers): void {
    this.handlers = handlers;
  }

  connect(accessToken?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      let settled = false;
      const fail = (message: string) => {
        if (settled) return;
        settled = true;
        this.handlers.onError?.(message);
        reject(new Error(message));
      };

      const url = accessToken
        ? `${this.url}${this.url.includes('?') ? '&' : '?'}token=${encodeURIComponent(accessToken)}`
        : this.url;

      console.log('[donna-app] connecting to', url.replace(/token=[^&]+/, 'token=***'));
      const ws = new WebSocket(url);
      this.ws = ws;

      ws.onopen = () => {
        if (settled) return;
        settled = true;
        console.log('[donna-app] voice connected');
        this.handlers.onOpen?.();
        resolve();
      };

      ws.onerror = () => {
        fail(
          `Cannot reach Donna server at ${this.url}. ` +
            'Start it with npm run dev:server. ' +
            'On a physical iPhone, ensure the phone and Mac are on the same Wi‑Fi, then restart Metro (npm start) to refresh the auto-detected dev host.',
        );
      };

      ws.onclose = (event) => {
        const reason = event.reason?.trim();
        let message: string | null = null;
        if (event.code === 4401) {
          const authMessages: Record<string, string> = {
            missing_token: 'Not signed in. Please sign in to continue.',
            token_expired: 'Your session expired. Please sign in again.',
            invalid_token: 'Invalid session. Please sign in again.',
          };
          message =
            authMessages[reason] ??
            (reason || 'Authentication failed. Please sign in again.');
        } else if (!settled) {
          message =
            `Voice socket closed before connect (${this.url}, code ${event.code}). ` +
            'Is the voice server running?';
        }

        if (message) {
          if (!settled) {
            fail(message);
          } else {
            // Auth can finish after onopen; the session must fail fast instead of
            // waiting for session.ready.
            this.handlers.onError?.(message);
          }
        }
        this.handlers.onClose?.();
        this.ws = null;
      };

      ws.onmessage = (event) => {
        try {
          const message = parseServerMessage(String(event.data));
          this.handlers.onMessage?.(message);
        } catch {
          this.handlers.onError?.('Invalid server message');
        }
      };
    });
  }

  send(message: ClientMessage): void {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      throw new Error('Voice socket is not connected');
    }
    this.ws.send(JSON.stringify(message));
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
