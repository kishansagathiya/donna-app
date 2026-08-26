/**
 * @jest-environment node
 */

import { createReminder, listReminders } from '../remindersApi';

jest.mock('../../config', () => ({
  API_BASE_URL: 'https://example.test',
}));

jest.mock('../auth', () => ({
  getAccessToken: jest.fn(async () => 'test-token'),
}));

describe('remindersApi', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('lists open reminders', async () => {
    const fetchMock = jest.fn(async () =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () => [{ id: 'r1', title: 'Call Mom', status: 'scheduled' }],
      }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const rows = await listReminders('open');
    expect(rows).toHaveLength(1);
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/reminders?');
    expect(url).toContain('status=open');
  });

  it('creates a reminder', async () => {
    const fetchMock = jest.fn(async () =>
      Promise.resolve({
        ok: true,
        status: 201,
        json: async () => ({ id: 'r1', title: 'Call Mom', status: 'scheduled' }),
      }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const row = await createReminder({ title: 'Call Mom', when: 'in 10 minutes' });
    expect(row.id).toBe('r1');
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect(String(init.body)).toContain('Call Mom');
  });
});
