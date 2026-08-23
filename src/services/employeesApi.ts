import { authorizedFetch, parseJSON } from './http';

export type AIEmployee = {
  id: string;
  user_id: string;
  name: string;
  role: string;
  goal: string;
  status: string;
  cadence_minutes: number;
  max_steps_per_shift: number;
  progress_summary: string;
  current_agent_run_id?: string | null;
  shift_count: number;
  last_shift_at?: string | null;
  next_shift_at?: string | null;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
};

export type HireEmployeeInput = {
  name: string;
  role?: string;
  goal: string;
  cadence_minutes?: number;
};

export async function listEmployees(status?: string): Promise<AIEmployee[]> {
  const params = new URLSearchParams();
  params.set('limit', '50');
  if (status) params.set('status', status);
  const res = await authorizedFetch(`/employees?${params.toString()}`);
  return parseJSON<AIEmployee[]>(res);
}

export async function hireEmployee(
  input: HireEmployeeInput,
): Promise<AIEmployee> {
  const res = await authorizedFetch('/employees', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parseJSON<AIEmployee>(res);
}

export async function pauseEmployee(id: string): Promise<AIEmployee> {
  const res = await authorizedFetch(
    `/employees/${encodeURIComponent(id)}/pause`,
    { method: 'POST' },
  );
  return parseJSON<AIEmployee>(res);
}

export async function resumeEmployee(id: string): Promise<AIEmployee> {
  const res = await authorizedFetch(
    `/employees/${encodeURIComponent(id)}/resume`,
    { method: 'POST' },
  );
  return parseJSON<AIEmployee>(res);
}

export async function archiveEmployee(id: string): Promise<AIEmployee> {
  const res = await authorizedFetch(
    `/employees/${encodeURIComponent(id)}/archive`,
    { method: 'POST' },
  );
  return parseJSON<AIEmployee>(res);
}
