/**
 * Immediate XHR-based SSE POST transport for React Native.
 *
 * `react-native-sse` defaults to a 500ms `timeoutBeforeConnection` delay and
 * only reads on `onreadystatechange`. This helper connects immediately and
 * flushes on both `onprogress` and ready-state changes so tokens surface ASAP.
 */

export type SseXhrHandle = {
  close: () => void;
};

export type SseXhrHandlers = {
  onEvent: (event: string, data: string) => void;
  onError: (message: string) => void;
  onOpen?: () => void;
  onClose?: () => void;
};

export function openSsePost(
  url: string,
  options: {
    headers?: Record<string, string>;
    body?: string;
  },
  handlers: SseXhrHandlers,
): SseXhrHandle {
  const xhr = new XMLHttpRequest();
  let lastIndex = 0;
  let buffer = '';
  let opened = false;
  let closed = false;
  let failed = false;

  const fail = (message: string) => {
    if (closed || failed) {
      return;
    }
    failed = true;
    handlers.onError(message);
  };

  const markOpen = () => {
    if (opened || closed) {
      return;
    }
    opened = true;
    handlers.onOpen?.();
  };

  const flush = () => {
    if (closed) {
      return;
    }

    const responseText = xhr.responseText ?? '';
    if (responseText.length <= lastIndex) {
      return;
    }

    buffer += responseText.slice(lastIndex);
    lastIndex = responseText.length;

    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';

    for (const part of parts) {
      if (!part.trim()) {
        continue;
      }

      let event = 'message';
      let data = '';

      for (const rawLine of part.split(/\r?\n/)) {
        if (rawLine.startsWith('event:')) {
          event = rawLine.slice(6).trimStart();
        } else if (rawLine.startsWith('data:')) {
          // Keep payload as-is after the first space/colon, matching web parser.
          data =
            rawLine.startsWith('data: ')
              ? rawLine.slice(6)
              : rawLine.slice(5).trimStart();
        }
      }

      if (data) {
        handlers.onEvent(event, data);
      }
    }
  };

  xhr.open('POST', url, true);
  xhr.setRequestHeader('Accept', 'text/event-stream');
  xhr.setRequestHeader('Cache-Control', 'no-cache');
  xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');

  if (options.headers) {
    for (const [key, value] of Object.entries(options.headers)) {
      xhr.setRequestHeader(key, value);
    }
  }

  xhr.onprogress = () => {
    if (xhr.status >= 200 && xhr.status < 400) {
      markOpen();
      flush();
    }
  };

  xhr.onreadystatechange = () => {
    if (closed) {
      return;
    }

    if (
      xhr.readyState === XMLHttpRequest.HEADERS_RECEIVED ||
      xhr.readyState === XMLHttpRequest.LOADING
    ) {
      if (xhr.status >= 200 && xhr.status < 400) {
        markOpen();
        flush();
      }
      return;
    }

    if (xhr.readyState !== XMLHttpRequest.DONE) {
      return;
    }

    if (xhr.status >= 200 && xhr.status < 400) {
      markOpen();
      flush();
      if (!closed) {
        handlers.onClose?.();
      }
      return;
    }

    if (xhr.status === 0) {
      // Aborted or network lost after close — ignore if we already closed.
      if (!closed) {
        fail('Chat stream failed');
      }
      return;
    }

    let message = `Chat stream failed (${xhr.status})`;
    try {
      const parsed = JSON.parse(xhr.responseText || '{}') as {
        message?: string;
        error?: string;
      };
      message = parsed.message ?? parsed.error ?? message;
    } catch {
      if (xhr.responseText?.trim()) {
        message = xhr.responseText.trim();
      }
    }
    fail(message);
  };

  xhr.onerror = () => {
    fail('Chat stream failed');
  };

  xhr.send(options.body ?? null);

  return {
    close: () => {
      if (closed) {
        return;
      }
      closed = true;
      xhr.abort();
    },
  };
}
