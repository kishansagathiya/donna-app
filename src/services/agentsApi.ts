import { authorizedFetch, parseJSON } from './http';

export type AgentRun = {
  id: string;
  user_id: string;
  intent_id?: string | null;
  goal: string;
  status: string;
  max_steps: number;
  step_count: number;
  redirect_pending?: string | null;
  error?: string | null;
  result?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  finished_at?: string | null;
};

export type AgentStep = {
  id: string;
  agent_run_id: string;
  user_id?: string;
  seq: number;
  kind: string;
  payload: Record<string, unknown>;
  created_at: string;
};

export async function listAgentRuns(status?: string): Promise<AgentRun[]> {
  const q = status ? `?status=${encodeURIComponent(status)}` : '';
  const res = await authorizedFetch(`/agent-runs${q}`);
  return parseJSON<AgentRun[]>(res);
}

export async function createAgentRun(goal: string): Promise<AgentRun> {
  const res = await authorizedFetch('/agent-runs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal }),
  });
  return parseJSON<AgentRun>(res);
}

export async function getAgentRun(id: string): Promise<AgentRun> {
  const res = await authorizedFetch(`/agent-runs/${encodeURIComponent(id)}`);
  return parseJSON<AgentRun>(res);
}

export async function listAgentSteps(
  id: string,
  afterSeq = 0,
): Promise<AgentStep[]> {
  const q = afterSeq > 0 ? `?after_seq=${afterSeq}` : '';
  const res = await authorizedFetch(
    `/agent-runs/${encodeURIComponent(id)}/steps${q}`,
  );
  return parseJSON<AgentStep[]>(res);
}

export async function cancelAgentRun(id: string): Promise<AgentRun> {
  const res = await authorizedFetch(
    `/agent-runs/${encodeURIComponent(id)}/cancel`,
    { method: 'POST' },
  );
  return parseJSON<AgentRun>(res);
}

export async function finishAgentRun(id: string): Promise<AgentRun> {
  const res = await authorizedFetch(
    `/agent-runs/${encodeURIComponent(id)}/finish`,
    { method: 'POST' },
  );
  return parseJSON<AgentRun>(res);
}

export async function redirectAgentRun(
  id: string,
  message: string,
): Promise<AgentRun> {
  const res = await authorizedFetch(
    `/agent-runs/${encodeURIComponent(id)}/redirect`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    },
  );
  return parseJSON<AgentRun>(res);
}
