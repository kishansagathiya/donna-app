/**
 * @jest-environment node
 */

import {
  cancelAgentRun,
  createAgentRun,
  finishAgentRun,
  listAgentRuns,
  listAgentSteps,
  redirectAgentRun,
} from '../agentsApi';

jest.mock('../../config', () => ({
  API_BASE_URL: 'https://example.test',
}));

jest.mock('../auth', () => ({
  getAccessToken: jest.fn(async () => 'test-token'),
}));

describe('agentsApi', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('lists agent runs', async () => {
    const fetchMock = jest.fn(async () =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () => [{ id: 'a1', goal: 'Find photo', status: 'queued' }],
      }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const rows = await listAgentRuns();
    expect(rows).toHaveLength(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/agent-runs');
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer test-token',
    );
  });

  it('creates, finishes, cancels, and redirects', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'a1', status: 'queued' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'a1', status: 'succeeded' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'a1', status: 'cancelled' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'a1', status: 'queued' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [{ id: 's1', seq: 1, kind: 'thought', payload: {} }],
      });
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(createAgentRun('goal')).resolves.toMatchObject({ id: 'a1' });
    await expect(finishAgentRun('a1')).resolves.toMatchObject({
      status: 'succeeded',
    });
    await expect(cancelAgentRun('a1')).resolves.toMatchObject({
      status: 'cancelled',
    });
    await expect(redirectAgentRun('a1', 'SFO')).resolves.toMatchObject({
      id: 'a1',
    });
    await expect(listAgentSteps('a1', 2)).resolves.toHaveLength(1);

    expect((fetchMock.mock.calls[0] as [string, RequestInit])[0]).toContain(
      '/agent-runs',
    );
    expect((fetchMock.mock.calls[1] as [string, RequestInit])[0]).toContain(
      '/agent-runs/a1/finish',
    );
    expect((fetchMock.mock.calls[2] as [string, RequestInit])[0]).toContain(
      '/agent-runs/a1/cancel',
    );
    expect((fetchMock.mock.calls[3] as [string, RequestInit])[0]).toContain(
      '/agent-runs/a1/redirect',
    );
    expect((fetchMock.mock.calls[4] as [string, RequestInit])[0]).toContain(
      'after_seq=2',
    );
  });
});
