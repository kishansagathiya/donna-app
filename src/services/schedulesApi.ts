import { authorizedFetch, parseJSON } from './http';

export type ScheduledGoal = {
  id: string;
  user_id: string;
  title: string;
  goal: string;
  status: string;
  cadence_minutes: number;
  selected_skills?: string[];
  last_summary: string;
  current_agent_run_id?: string | null;
  run_count: number;
  last_run_at?: string | null;
  next_run_at?: string | null;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
};

export type CreateScheduleInput = {
  title: string;
  goal: string;
  cadence_minutes?: number;
};

export async function listSchedules(status?: string): Promise<ScheduledGoal[]> {
  const params = new URLSearchParams();
  params.set('limit', '50');
  if (status) params.set('status', status);
  const res = await authorizedFetch(`/schedules?${params.toString()}`);
  return parseJSON<ScheduledGoal[]>(res);
}

export async function createSchedule(
  input: CreateScheduleInput,
): Promise<ScheduledGoal> {
  const res = await authorizedFetch('/schedules', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parseJSON<ScheduledGoal>(res);
}

export async function pauseSchedule(id: string): Promise<ScheduledGoal> {
  const res = await authorizedFetch(
    `/schedules/${encodeURIComponent(id)}/pause`,
    { method: 'POST' },
  );
  return parseJSON<ScheduledGoal>(res);
}

export async function resumeSchedule(id: string): Promise<ScheduledGoal> {
  const res = await authorizedFetch(
    `/schedules/${encodeURIComponent(id)}/resume`,
    { method: 'POST' },
  );
  return parseJSON<ScheduledGoal>(res);
}

export async function archiveSchedule(id: string): Promise<ScheduledGoal> {
  const res = await authorizedFetch(
    `/schedules/${encodeURIComponent(id)}/archive`,
    { method: 'POST' },
  );
  return parseJSON<ScheduledGoal>(res);
}

export async function runScheduleNow(id: string): Promise<ScheduledGoal> {
  const res = await authorizedFetch(
    `/schedules/${encodeURIComponent(id)}/run`,
    { method: 'POST' },
  );
  return parseJSON<ScheduledGoal>(res);
}

export function cadenceLabel(minutes: number): string {
  if (minutes <= 0) return 'Once';
  if (minutes === 60) return 'Hourly';
  if (minutes === 1440) return 'Daily';
  if (minutes === 10080) return 'Weekly';
  return `Every ${minutes}m`;
}
