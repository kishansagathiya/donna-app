/**
 * @jest-environment node
 */

import { authorizedFetch, xhrRequest } from '../http';

jest.mock('../../config', () => ({
  API_BASE_URL: 'https://example.test',
}));

jest.mock('../auth', () => ({
  getAccessToken: jest.fn(async () => 'test-token'),
}));

jest.mock('../errorReporting', () => ({
  reportError: jest.fn(),
}));

type XhrInstance = {
  status: number;
  statusText: string;
  responseText: string;
  onload: (() => void) | null;
  onerror: (() => void) | null;
  ontimeout: (() => void) | null;
  open: jest.Mock;
  setRequestHeader: jest.Mock;
  send: jest.Mock;
};

describe('authorizedFetch', () => {
  const g = globalThis as { XMLHttpRequest: unknown };
  const originalXHR = g.XMLHttpRequest;
  let xhr: XhrInstance;

  beforeEach(() => {
    xhr = {
      status: 200,
      statusText: 'OK',
      responseText: '{"ok":true}',
      onload: null,
      onerror: null,
      ontimeout: null,
      open: jest.fn(),
      setRequestHeader: jest.fn(),
      send: jest.fn(function (this: XhrInstance) {
        this.onload?.();
      }),
    };
    g.XMLHttpRequest = jest.fn(() => xhr) as unknown as typeof XMLHttpRequest;
  });

  afterEach(() => {
    g.XMLHttpRequest = originalXHR;
    jest.restoreAllMocks();
  });

  it('uses fetch when it succeeds', async () => {
    const fetchMock = jest.fn(async () =>
      Promise.resolve(new Response('{"items":[]}', { status: 200 })),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const res = await authorizedFetch('/notes/feed?limit=50');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(xhr.open).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ items: [] });
  });

  it('falls back to XHR when fetch throws Network request failed', async () => {
    global.fetch = jest.fn(async () => {
      throw new TypeError('Network request failed');
    }) as unknown as typeof fetch;

    const res = await authorizedFetch('/notes/feed?limit=50&curated=true');
    expect(xhr.open).toHaveBeenCalledWith(
      'GET',
      'https://example.test/notes/feed?limit=50&curated=true',
      true,
    );
    expect(xhr.setRequestHeader).toHaveBeenCalledWith(
      'Authorization',
      'Bearer test-token',
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
  });

  it('wraps the error when fetch and XHR both fail', async () => {
    global.fetch = jest.fn(async () => {
      throw new TypeError('Network request failed');
    }) as unknown as typeof fetch;
    xhr.send = jest.fn(function (this: XhrInstance) {
      this.onerror?.();
    });

    await expect(authorizedFetch('/notes/feed')).rejects.toThrow(
      'Network request failed (https://example.test). Check your connection and try again.',
    );
  });
});

describe('xhrRequest', () => {
  const g = globalThis as { XMLHttpRequest: unknown };
  const originalXHR = g.XMLHttpRequest;

  afterEach(() => {
    g.XMLHttpRequest = originalXHR;
  });

  it('sends JSON bodies', async () => {
    const xhr: XhrInstance = {
      status: 201,
      statusText: 'Created',
      responseText: '{"id":"n1"}',
      onload: null,
      onerror: null,
      ontimeout: null,
      open: jest.fn(),
      setRequestHeader: jest.fn(),
      send: jest.fn(function (this: XhrInstance) {
        this.onload?.();
      }),
    };
    g.XMLHttpRequest = jest.fn(() => xhr) as unknown as typeof XMLHttpRequest;

    const res = await xhrRequest('https://example.test/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"content":"hi"}',
    });
    expect(xhr.open).toHaveBeenCalledWith(
      'POST',
      'https://example.test/notes',
      true,
    );
    expect(xhr.send).toHaveBeenCalledWith('{"content":"hi"}');
    expect(res.status).toBe(201);
  });
});
