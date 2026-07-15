/**
 * @jest-environment node
 */

import { openSsePost } from '../sseXhr';

type XhrInstance = {
  status: number;
  readyState: number;
  responseText: string;
  onprogress: ((ev?: unknown) => void) | null;
  onreadystatechange: ((ev?: unknown) => void) | null;
  onerror: ((ev?: unknown) => void) | null;
  open: jest.Mock;
  setRequestHeader: jest.Mock;
  send: jest.Mock;
  abort: jest.Mock;
};

type XHRCtor = {
  new (): XMLHttpRequest;
  DONE: number;
  LOADING: number;
  HEADERS_RECEIVED: number;
};

describe('openSsePost', () => {
  const g = globalThis as { XMLHttpRequest: unknown };
  const originalXHR = g.XMLHttpRequest;
  let xhr: XhrInstance;

  beforeEach(() => {
    xhr = {
      status: 0,
      readyState: 0,
      responseText: '',
      onprogress: null,
      onreadystatechange: null,
      onerror: null,
      open: jest.fn(),
      setRequestHeader: jest.fn(),
      send: jest.fn(),
      abort: jest.fn(),
    };

    const FakeXHR = jest.fn().mockImplementation(() => xhr) as unknown as XHRCtor;
    FakeXHR.DONE = 4;
    FakeXHR.LOADING = 3;
    FakeXHR.HEADERS_RECEIVED = 2;
    g.XMLHttpRequest = FakeXHR;
  });

  afterEach(() => {
    g.XMLHttpRequest = originalXHR;
  });

  it('connects immediately and emits parsed SSE events from onprogress', () => {
    const onEvent = jest.fn();
    const onOpen = jest.fn();
    const onError = jest.fn();

    openSsePost(
      'https://example.test/chat?stream=1',
      {
        headers: {
          Authorization: 'Bearer tok',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: 'hi' }),
      },
      { onEvent, onOpen, onError },
    );

    expect(xhr.open).toHaveBeenCalledWith(
      'POST',
      'https://example.test/chat?stream=1',
      true,
    );
    expect(xhr.send).toHaveBeenCalledWith(JSON.stringify({ message: 'hi' }));

    xhr.status = 200;
    xhr.responseText =
      'event: chunk\ndata: {"text":"Hello"}\n\nevent: chunk\ndata: {"text":"Hello!"}\n\n';
    xhr.onprogress?.();

    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith('chunk', '{"text":"Hello"}');
    expect(onEvent).toHaveBeenCalledWith('chunk', '{"text":"Hello!"}');
    expect(onError).not.toHaveBeenCalled();
  });

  it('only processes newly arrived bytes', () => {
    const onEvent = jest.fn();

    openSsePost(
      'https://example.test/chat?stream=1',
      { body: '{}' },
      { onEvent, onError: jest.fn() },
    );

    xhr.status = 200;
    xhr.responseText = 'event: chunk\ndata: {"text":"A"}\n\n';
    xhr.onprogress?.();
    expect(onEvent).toHaveBeenCalledTimes(1);

    xhr.responseText =
      'event: chunk\ndata: {"text":"A"}\n\nevent: chunk\ndata: {"text":"AB"}\n\n';
    xhr.onprogress?.();
    expect(onEvent).toHaveBeenCalledTimes(2);
    expect(onEvent).toHaveBeenLastCalledWith('chunk', '{"text":"AB"}');
  });

  it('surfaces HTTP error bodies', () => {
    const onError = jest.fn();

    openSsePost(
      'https://example.test/chat?stream=1',
      { body: '{}' },
      { onEvent: jest.fn(), onError },
    );

    xhr.status = 401;
    xhr.readyState = 4;
    xhr.responseText = JSON.stringify({ message: 'Not signed in' });
    xhr.onreadystatechange?.();

    expect(onError).toHaveBeenCalledWith('Not signed in');
  });
});
