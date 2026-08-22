import type { DailyBriefing, DailyTask } from '../services/notesApi';

/** Collapse only long notes so short ones stay fully readable. */
export const TODAY_NOTE_COLLAPSE_CHARS = 1000;
export const TODAY_NOTE_COLLAPSE_LINES = 16;

export function dailyTaskText(
  task: Pick<DailyTask, 'title' | 'preview' | 'content'>,
): string {
  const content = task.content?.trim();
  if (content) {
    return content;
  }
  return [task.title, task.preview]
    .map(part => part?.trim())
    .filter(Boolean)
    .join('\n');
}

export function shouldCollapseDailyNote(
  text: string,
  maxChars = TODAY_NOTE_COLLAPSE_CHARS,
  maxLines = TODAY_NOTE_COLLAPSE_LINES,
): boolean {
  if (text.length > maxChars) {
    return true;
  }
  return text.split('\n').length > maxLines;
}

export function collapseDailyNoteText(
  text: string,
  maxChars = TODAY_NOTE_COLLAPSE_CHARS,
): string {
  if (text.length <= maxChars) {
    return text;
  }
  const slice = text.slice(0, maxChars);
  const lastBreak = Math.max(slice.lastIndexOf('\n'), slice.lastIndexOf(' '));
  const cut = lastBreak > maxChars * 0.6 ? lastBreak : maxChars;
  return `${text.slice(0, cut).trimEnd()}…`;
}

export function briefingWithoutNotes(
  briefing: DailyBriefing,
  ids: Iterable<string>,
): DailyBriefing {
  const remove = new Set(ids);
  const tasks = briefing.tasks.filter(task => !remove.has(task.note_id));
  return {
    ...briefing,
    tasks,
    summary: todaySummaryFromTasks(tasks),
  };
}

function todaySummaryFromTasks(tasks: DailyTask[]): string {
  let doFirst = 0;
  let schedule = 0;
  let delegate = 0;
  for (const task of tasks) {
    if (task.priority === 'do_first') doFirst += 1;
    else if (task.priority === 'schedule') schedule += 1;
    else if (task.priority === 'delegate') delegate += 1;
  }
  const parts: string[] = [];
  if (doFirst > 0) parts.push(`${doFirst} to do first`);
  if (schedule > 0) parts.push(`${schedule} to schedule`);
  if (delegate > 0) parts.push(`${delegate} to delegate`);
  if (parts.length === 0) {
    return 'Nothing on your list today.';
  }
  return `Today: ${parts.join(', ')}.`;
}
