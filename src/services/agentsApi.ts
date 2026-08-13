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

export type AgentAttachment = {
  kind: 'file' | 'url';
  filename?: string;
  mime?: string;
  data_base64?: string;
  url?: string;
};

export async function listAgentRuns(status?: string): Promise<AgentRun[]> {
  const q = status ? `?status=${encodeURIComponent(status)}` : '';
  const res = await authorizedFetch(`/agent-runs${q}`);
  return parseJSON<AgentRun[]>(res);
}

export async function createAgentRun(
  goal: string,
  attachments?: AgentAttachment[],
): Promise<AgentRun> {
  const res = await authorizedFetch('/agent-runs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      goal,
      attachments:
        attachments && attachments.length > 0 ? attachments : undefined,
    }),
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
  attachments?: AgentAttachment[],
): Promise<AgentRun> {
  const res = await authorizedFetch(
    `/agent-runs/${encodeURIComponent(id)}/redirect`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        attachments:
          attachments && attachments.length > 0 ? attachments : undefined,
      }),
    },
  );
  return parseJSON<AgentRun>(res);
}

export type AgentRunShare = {
  url: string;
  token: string;
  created_at: string;
  expires_at?: string;
};

export async function createAgentRunShare(id: string): Promise<AgentRunShare> {
  const res = await authorizedFetch(
    `/agent-runs/${encodeURIComponent(id)}/share`,
    { method: 'POST' },
  );
  return parseJSON<AgentRunShare>(res);
}

export async function revokeAgentRunShare(id: string): Promise<void> {
  const res = await authorizedFetch(
    `/agent-runs/${encodeURIComponent(id)}/share`,
    { method: 'DELETE' },
  );
  await parseJSON<{ ok: boolean }>(res);
}
