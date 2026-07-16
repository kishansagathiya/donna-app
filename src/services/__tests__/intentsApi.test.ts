/**
 * @jest-environment node
 */

import {
  cancelActionRun,
  confirmActionRun,
  dismissIntent,
  listIntents,
} from '../intentsApi';

jest.mock('../../config', () => ({
  API_BASE_URL: 'https://example.test',
}));

jest.mock('../auth', () => ({
  getAccessToken: jest.fn(async () => 'test-token'),
}));

describe('intentsApi', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('lists open intents', async () => {
    const fetchMock = jest.fn(async () =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () => [
          { id: 'i1', kind: 'remind', status: 'open', summary: 'Call Mom' },
        ],
      }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const rows = await listIntents();
    expect(rows).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalled();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/intents?status=open');
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer test-token',
    );
  });

  it('dismisses an intent', async () => {
    const fetchMock = jest.fn(async () =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ id: 'i1', status: 'dismissed' }),
      }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const row = await dismissIntent('i1');
    expect(row.status).toBe('dismissed');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/intents/i1/dismiss');
    expect(init.method).toBe('POST');
  });

  it('confirms and cancels action runs', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'r1', status: 'succeeded' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'r2', status: 'cancelled' }),
      });
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(confirmActionRun('r1')).resolves.toMatchObject({
      status: 'succeeded',
    });
    await expect(cancelActionRun('r2')).resolves.toMatchObject({
      status: 'cancelled',
    });

    expect((fetchMock.mock.calls[0] as [string, RequestInit])[0]).toContain(
      '/action-runs/r1/confirm',
    );
    expect((fetchMock.mock.calls[1] as [string, RequestInit])[0]).toContain(
      '/action-runs/r2/cancel',
    );
  });
});
