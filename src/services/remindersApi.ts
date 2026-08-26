import { authorizedFetch, parseJSON } from './http';

export type Reminder = {
  id: string;
  user_id: string;
  title: string;
  notes: string;
  due_at: string;
  timezone: string;
  status: string;
  action_run_id?: string | null;
  fired_at?: string | null;
  dismissed_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateReminderInput = {
  title: string;
  notes?: string;
  when?: string;
  due_at?: string;
  timezone?: string;
};

export async function listReminders(status?: string): Promise<Reminder[]> {
  const params = new URLSearchParams();
  params.set('limit', '50');
  if (status) params.set('status', status);
  const res = await authorizedFetch(`/reminders?${params.toString()}`);
  return parseJSON<Reminder[]>(res);
}

export async function createReminder(
  input: CreateReminderInput,
): Promise<Reminder> {
  const res = await authorizedFetch('/reminders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parseJSON<Reminder>(res);
}

export async function cancelReminder(id: string): Promise<Reminder> {
  const res = await authorizedFetch(
    `/reminders/${encodeURIComponent(id)}/cancel`,
    { method: 'POST' },
  );
  return parseJSON<Reminder>(res);
}

export async function dismissReminder(id: string): Promise<Reminder> {
  const res = await authorizedFetch(
    `/reminders/${encodeURIComponent(id)}/dismiss`,
    { method: 'POST' },
  );
  return parseJSON<Reminder>(res);
}

export function formatReminderWhen(dueAt: string, timezone?: string): string {
  const date = new Date(dueAt);
  if (Number.isNaN(date.getTime())) return dueAt;
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: timezone || undefined,
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}
