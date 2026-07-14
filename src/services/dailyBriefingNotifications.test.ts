import { formatDailyBriefingNotificationBodyForTest } from './dailyBriefingNotifications';
import type { DailyBriefing } from './notesApi';

jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    requestPermission: jest.fn(async () => ({ authorizationStatus: 1 })),
    createChannel: jest.fn(async () => 'donna-daily'),
    displayNotification: jest.fn(async () => 'id'),
  },
  AndroidImportance: { DEFAULT: 3 },
  AuthorizationStatus: { AUTHORIZED: 1, PROVISIONAL: 2, DENIED: 0 },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
}));

function briefing(
  partial: Partial<DailyBriefing> & Pick<DailyBriefing, 'date'>,
): DailyBriefing {
  return {
    summary: '',
    tasks: [],
    outdated: [],
    ...partial,
  };
}

describe('formatDailyBriefingNotificationBody', () => {
  it('formats up to five task titles and notes overflow', () => {
    const body = formatDailyBriefingNotificationBodyForTest(
      briefing({
        date: '2026-07-14',
        tasks: [
          { note_id: '1', title: 'One', preview: '', priority: 'do_first', reason: '', is_urgent: false, is_important: false },
          { note_id: '2', title: 'Two', preview: '', priority: 'schedule', reason: '', is_urgent: false, is_important: false },
          { note_id: '3', title: 'Three', preview: '', priority: 'schedule', reason: '', is_urgent: false, is_important: false },
          { note_id: '4', title: 'Four', preview: '', priority: 'delegate', reason: '', is_urgent: false, is_important: false },
          { note_id: '5', title: 'Five', preview: '', priority: 'delegate', reason: '', is_urgent: false, is_important: false },
          { note_id: '6', title: 'Six', preview: '', priority: 'schedule', reason: '', is_urgent: false, is_important: false },
        ],
      }),
    );
    expect(body).toBe(
      '1. One\n2. Two\n3. Three\n4. Four\n5. Five\n+1 more…',
    );
  });

  it('falls back to summary when there are no tasks', () => {
    expect(
      formatDailyBriefingNotificationBodyForTest(
        briefing({ date: '2026-07-14', summary: 'Focus on shipping.' }),
      ),
    ).toBe('Focus on shipping.');
  });

  it('returns null for empty briefing', () => {
    expect(
      formatDailyBriefingNotificationBodyForTest(
        briefing({ date: '2026-07-14' }),
      ),
    ).toBeNull();
  });
});
