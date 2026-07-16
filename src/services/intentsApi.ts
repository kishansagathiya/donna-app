import { authorizedFetch, parseJSON } from './http';

export type ActionRun = {
  id: string;
  user_id: string;
  intent_id?: string | null;
  action_id: string;
  status: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown> | null;
  error?: string | null;
  confirmed_at?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  created_at: string;
  updated_at: string;
  action_slug?: string | null;
  action_name?: string | null;
  action_risk?: string | null;
};

export type Intent = {
  id: string;
  user_id: string;
  kind: string;
  status: string;
  summary: string;
  slots: Record<string, unknown>;
  source_type: string;
  source_id?: string | null;
  source_turn_index?: number | null;
  confidence?: number | null;
  created_at: string;
  updated_at: string;
  run?: ActionRun | null;
};

export async function listIntents(status = 'open'): Promise<Intent[]> {
  const res = await authorizedFetch(
    `/intents?status=${encodeURIComponent(status)}`,
  );
  return parseJSON<Intent[]>(res);
}

export async function dismissIntent(id: string): Promise<Intent> {
  const res = await authorizedFetch(
    `/intents/${encodeURIComponent(id)}/dismiss`,
    { method: 'POST' },
  );
  return parseJSON<Intent>(res);
}

export async function listActionRuns(status?: string): Promise<ActionRun[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  const res = await authorizedFetch(`/action-runs${qs}`);
  return parseJSON<ActionRun[]>(res);
}

export async function confirmActionRun(id: string): Promise<ActionRun> {
  const res = await authorizedFetch(
    `/action-runs/${encodeURIComponent(id)}/confirm`,
    { method: 'POST' },
  );
  return parseJSON<ActionRun>(res);
}

export async function cancelActionRun(id: string): Promise<ActionRun> {
  const res = await authorizedFetch(
    `/action-runs/${encodeURIComponent(id)}/cancel`,
    { method: 'POST' },
  );
  return parseJSON<ActionRun>(res);
}
