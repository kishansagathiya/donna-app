import { getAccessToken } from './auth';
import { API_BASE_URL } from '../config';
import type { DonnaMode } from '../types/mode';
import type { MemoryCitation } from '../types/citations';
import type { ChatAttachmentPayload } from '../lib/chatAttachments';
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
  attachments?: ChatAttachmentPayload[];
  webSearch?: boolean;
};

export type SendChatResult = {
  reply: string;
  sessionId: string;
  aborted?: boolean;
  citations?: MemoryCitation[];
  groundedUserMessage?: string;
  attachmentLabels?: string[];
};

export type ChatStreamCallbacks = {
  onSession?: (sessionId: string) => void;
  onPhase?: (phase: string) => void;
  onChunk?: (text: string) => void;
  onCitations?: (citations: MemoryCitation[]) => void;
  onError?: (message: string) => void;
  onDone?: (result: SendChatResult) => void;
};

export type ChatStreamHandle = {
  promise: Promise<SendChatResult>;
  abort: () => void;
};

type ChatRequestBody = {
  message: string;
  history?: ChatTurnMessage[];
  session_id?: string;
  mode?: string;
  attachments?: ChatAttachmentPayload[];
  web_search?: boolean;
};

type StreamEventName = 'session' | 'phase' | 'chunk' | 'citations' | 'done' | 'error';

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
  if (input.attachments && input.attachments.length > 0) {
    body.attachments = input.attachments;
  }
  if (input.webSearch) {
    body.web_search = true;
  }

  return body;
}

function parseCitations(raw: unknown): MemoryCitation[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) {
    return undefined;
  }
  const out: MemoryCitation[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const text = typeof row.text === 'string' ? row.text.trim() : '';
    if (!text) continue;
    out.push({
      source: typeof row.source === 'string' ? row.source : 'fact',
      id: typeof row.id === 'string' ? row.id : undefined,
      text,
      score: typeof row.score === 'number' ? row.score : undefined,
      url: typeof row.url === 'string' ? row.url : undefined,
      title: typeof row.title === 'string' ? row.title : undefined,
    });
  }
  return out.length ? out : undefined;
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
    citations?: unknown;
    grounded_user_message?: string;
    attachment_labels?: string[];
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
    citations: parseCitations(responseBody.citations),
    groundedUserMessage: responseBody.grounded_user_message,
    attachmentLabels: responseBody.attachment_labels,
  };
}

export function streamChatMessage(
  input: SendChatInput,
  callbacks: ChatStreamCallbacks,
): ChatStreamHandle {
  let abortFn: () => void = () => undefined;

  const promise = new Promise<SendChatResult>((resolve, reject) => {
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
        let latestCitations: MemoryCitation[] | undefined;
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

        abortFn = () => {
          if (settled) {
            return;
          }
          settled = true;
          es.close();
          const result = {
            reply: latestReply,
            sessionId: latestSessionId,
            aborted: true as const,
            citations: latestCitations,
          };
          callbacks.onDone?.(result);
          resolve(result);
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

        es.addEventListener('citations', (event: CustomEventPayload) => {
          try {
            const data = JSON.parse(event.data ?? '{}') as {
              citations?: unknown;
            };
            const cites = parseCitations(data.citations);
            if (cites?.length) {
              latestCitations = cites;
              callbacks.onCitations?.(cites);
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
              citations?: unknown;
              grounded_user_message?: string;
              attachment_labels?: string[];
            };
            const cites = parseCitations(data.citations) ?? latestCitations;
            if (cites?.length) {
              latestCitations = cites;
              callbacks.onCitations?.(cites);
            }
            finish({
              reply: data.reply ?? latestReply,
              sessionId: data.session_id ?? latestSessionId,
              citations: cites,
              groundedUserMessage: data.grounded_user_message,
              attachmentLabels: data.attachment_labels,
            });
          } catch {
            finish({
              reply: latestReply,
              sessionId: latestSessionId,
              citations: latestCitations,
            });
          }
        });

        es.addEventListener('close', () => {
          if (!settled) {
            finish({
              reply: latestReply,
              sessionId: latestSessionId,
              citations: latestCitations,
            });
          }
        });
      })
      .catch(err => {
        reject(err instanceof Error ? err : new Error(String(err)));
      });
  });

  return {
    promise,
    abort: () => abortFn(),
  };
}
