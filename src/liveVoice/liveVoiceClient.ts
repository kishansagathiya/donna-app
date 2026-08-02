import type { LiveClientMessage, LiveServerMessage } from './protocol';
import { parseLiveServerMessage } from './protocol';

function connectionErrorMessage(url: string): string {
  const base = `Cannot reach Donna Voice at ${url}.`;
  if (__DEV__) {
    return (
      `${base} Start the server with npm run dev:server and set GEMINI_API_KEY.`
    );
  }
  return `${base} Check your connection and try again.`;
}

export type LiveVoiceClientHandlers = {
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (message: string) => void;
  onMessage?: (message: LiveServerMessage) => void;
};

export class LiveVoiceClient {
  private ws: WebSocket | null = null;
  private handlers: LiveVoiceClientHandlers = {};

  constructor(private readonly url: string) {}

  setHandlers(handlers: LiveVoiceClientHandlers): void {
    this.handlers = handlers;
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
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
        ? `${this.url}${
            this.url.includes('?') ? '&' : '?'
          }token=${encodeURIComponent(accessToken)}`
        : this.url;

      const ws = new WebSocket(url);
      this.ws = ws;

      ws.onopen = () => {
        if (settled) return;
        settled = true;
        this.handlers.onOpen?.();
        resolve();
      };

      ws.onerror = () => {
        fail(connectionErrorMessage(this.url));
      };

      ws.onclose = event => {
        const reason = event.reason?.trim() ?? '';
        if (event.code === 4401) {
          const message =
            reason === 'missing_token'
              ? 'Not signed in. Please sign in to continue.'
              : 'Authentication failed. Please sign in again.';
          if (!settled) {
            fail(message);
          } else {
            this.handlers.onError?.(message);
          }
          return;
        }
        if (!settled) {
          fail(connectionErrorMessage(this.url));
          return;
        }
        this.handlers.onClose?.();
      };

      ws.onmessage = event => {
        const raw =
          typeof event.data === 'string' ? event.data : String(event.data);
        const msg = parseLiveServerMessage(raw);
        if (msg) this.handlers.onMessage?.(msg);
      };
    });
  }

  send(message: LiveClientMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Voice socket is not connected');
    }
    this.ws.send(JSON.stringify(message));
  }

  disconnect(): void {
    if (!this.ws) return;
    try {
      this.ws.close();
    } catch {
      // ignore
    }
    this.ws = null;
  }
}
