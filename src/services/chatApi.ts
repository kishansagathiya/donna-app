import { getAccessToken } from './auth';
import { API_BASE_URL } from '../config';
import type { DonnaMode } from '../types/mode';
import EventSource from 'react-native-sse';

export type ChatTurnMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type SendChatInput = {
  message: string;
  history?: ChatTurnMessage[];
  sessionId?: string;
  mode?: DonnaMode;
};

export type SendChatResult = {
  reply: string;
  sessionId: string;
};

export type ChatStreamCallbacks = {
  onSession?: (sessionId: string) => void;
  onPhase?: (phase: string) => void;
  onChunk?: (text: string) => void;
  onError?: (message: string) => void;
  onDone?: (result: SendChatResult) => void;
};

type ChatRequestBody = {
  message: string;
  history?: ChatTurnMessage[];
  session_id?: string;
  mode?: string;
};

type StreamEventName = 'session' | 'phase' | 'chunk' | 'done' | 'error';

type CustomEventPayload = {
  type: StreamEventName | 'error';
  data: string | null;
  lastEventId: string | null;
  url: string;
};

function buildBody(input: SendChatInput): ChatRequestBody {
  const body: ChatRequestBody = {
    message: input.message,
  };

  if (input.history && input.history.length > 0) {
    body.history = input.history;
  }
  if (input.sessionId) {
    body.session_id = input.sessionId;
  }
  if (input.mode) {
    body.mode = input.mode;
  }

  return body;
}

export async function sendChatMessage(
  input: SendChatInput,
): Promise<SendChatResult> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Not signed in. Please sign in to continue.');
  }

  const res = await fetch(`${API_BASE_URL}/chat`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(buildBody(input)),
  });

  const responseBody = (await res.json()) as {
    reply?: string;
    session_id?: string;
    error?: string;
    message?: string;
  };

  if (!res.ok) {
    throw new Error(
      responseBody.message ??
        responseBody.error ??
        `Chat failed (${res.status})`,
    );
  }

  return {
    reply: responseBody.reply ?? '',
    sessionId: responseBody.session_id ?? input.sessionId ?? '',
  };
}

export function streamChatMessage(
  input: SendChatInput,
  callbacks: ChatStreamCallbacks,
): Promise<SendChatResult> {
  return new Promise((resolve, reject) => {
    getAccessToken()
      .then(token => {
        if (!token) {
          reject(new Error('Not signed in. Please sign in to continue.'));
          return;
        }

        const url = `${API_BASE_URL}/chat?stream=1`;
        const body = buildBody(input);

        const es = new EventSource<StreamEventName>(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
          method: 'POST',
          pollingInterval: 0,
        });

        let latestSessionId = input.sessionId ?? '';
        let latestReply = '';
        let settled = false;

        const finish = (result: SendChatResult) => {
          if (settled) {
            return;
          }
          settled = true;
          es.close();
          callbacks.onDone?.(result);
          resolve(result);
        };

        const fail = (message: string) => {
          if (settled) {
            return;
          }
          settled = true;
          es.close();
          callbacks.onError?.(message);
          reject(new Error(message));
        };

        es.addEventListener('open', () => {
          // Stream opened; data events will follow.
        });

        es.addEventListener('session', (event: CustomEventPayload) => {
          try {
            const data = JSON.parse(event.data ?? '{}') as {
              session_id?: string;
            };
            if (data.session_id) {
              latestSessionId = data.session_id;
              callbacks.onSession?.(data.session_id);
            }
          } catch {
            // Ignore malformed event.
          }
        });

        es.addEventListener('phase', (event: CustomEventPayload) => {
          if (event.data) {
            callbacks.onPhase?.(event.data);
          }
        });

        es.addEventListener('chunk', (event: CustomEventPayload) => {
          try {
            const data = JSON.parse(event.data ?? '{}') as { text?: string };
            if (data.text) {
              latestReply = data.text;
              callbacks.onChunk?.(data.text);
            }
          } catch {
            // Ignore malformed event.
          }
        });

        es.addEventListener('error', event => {
          const custom = event as unknown as CustomEventPayload;
          if (custom.data) {
            try {
              const data = JSON.parse(custom.data) as { message?: string };
              if (data.message) {
                fail(data.message);
                return;
              }
            } catch {
              // Fall through to raw data.
            }
            fail(custom.data);
            return;
          }

          const connectionError = event as { message?: string };
          fail(connectionError.message ?? 'Chat stream failed');
        });

        es.addEventListener('done', (event: CustomEventPayload) => {
          try {
            const data = JSON.parse(event.data ?? '{}') as {
              reply?: string;
              session_id?: string;
            };
            finish({
              reply: data.reply ?? latestReply,
              sessionId: data.session_id ?? latestSessionId,
            });
          } catch {
            finish({ reply: latestReply, sessionId: latestSessionId });
          }
        });

        es.addEventListener('close', () => {
          if (!settled) {
            finish({ reply: latestReply, sessionId: latestSessionId });
          }
        });
      })
      .catch(err => {
        reject(err instanceof Error ? err : new Error(String(err)));
      });
  });
}
