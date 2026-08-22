import {
  briefingWithoutNotes,
  collapseDailyNoteText,
  dailyTaskText,
  shouldCollapseDailyNote,
} from '../dailyTasks';
import type { DailyBriefing, DailyTask } from '../../services/notesApi';

function task(
  partial: Partial<DailyTask> & Pick<DailyTask, 'note_id'>,
): DailyTask {
  return {
    title: '',
    preview: '',
    priority: 'do_first',
    reason: '',
    is_urgent: true,
    is_important: true,
    ...partial,
  };
}

describe('dailyTaskText', () => {
  it('prefers full content over the truncated title', () => {
    expect(
      dailyTaskText({
        title: 'https://ecosystem.firstwingsconnect.com/progra...',
        preview: '',
        content: 'https://ecosystem.firstwingsconnect.com/programs/apply-now',
      }),
    ).toBe('https://ecosystem.firstwingsconnect.com/programs/apply-now');
  });

  it('falls back to title and preview when content is missing', () => {
    expect(
      dailyTaskText({
        title: 'Ship the Today tab',
        preview: 'Show full notes and bulk delete',
      }),
    ).toBe('Ship the Today tab\nShow full notes and bulk delete');
  });
});

describe('shouldCollapseDailyNote', () => {
  it('keeps short notes fully visible', () => {
    expect(shouldCollapseDailyNote('fill out the application for funding')).toBe(
      false,
    );
  });

  it('collapses very long notes', () => {
    expect(shouldCollapseDailyNote('line\n'.repeat(20))).toBe(true);
    expect(shouldCollapseDailyNote('x'.repeat(1001))).toBe(true);
  });
});

describe('collapseDailyNoteText', () => {
  it('cuts on a word boundary when possible', () => {
    const text = `${'word '.repeat(80)}tail`;
    const collapsed = collapseDailyNoteText(text, 40);
    expect(collapsed.endsWith('…')).toBe(true);
    expect(collapsed.length).toBeLessThan(text.length);
  });
});

describe('briefingWithoutNotes', () => {
  it('drops selected notes and rebuilds the summary', () => {
    const briefing: DailyBriefing = {
      date: '2026-08-22',
      summary: 'Today: 2 to do first, 1 to schedule.',
      tasks: [
        task({ note_id: 'a', priority: 'do_first' }),
        task({ note_id: 'b', priority: 'do_first' }),
        task({ note_id: 'c', priority: 'schedule', is_urgent: false }),
      ],
      outdated: [],
    };
    const next = briefingWithoutNotes(briefing, ['a', 'c']);
    expect(next.tasks.map(item => item.note_id)).toEqual(['b']);
    expect(next.summary).toBe('Today: 1 to do first.');
  });
});
