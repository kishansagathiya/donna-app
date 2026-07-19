import { authorizedFetch, parseJSON } from './http';

export type IntegrationCapabilities = {
  live_query_meetings: boolean;
  live_get_transcript: boolean;
  list_meetings: boolean;
  get_meetings: boolean;
  transcripts: boolean;
  folders: boolean;
  history_days?: number;
  plan_hint?: string;
};

export type IntegrationStatus = {
  provider: string;
  status: string;
  account_label?: string;
  workspace_label?: string;
  capabilities: IntegrationCapabilities;
  initial_sync_status: string;
  imported_meeting_count: number;
  imported_transcript_count: number;
  sync_enabled: boolean;
  last_sync_at?: string;
  next_sync_at?: string;
  last_error?: string;
  retains_imports_on_disconnect: boolean;
  enabled: boolean;
};

export async function listIntegrations(): Promise<IntegrationStatus[]> {
  const res = await authorizedFetch('/integrations');
  const body = await parseJSON<{ integrations?: IntegrationStatus[] }>(res);
  return body.integrations ?? [];
}

export async function authorizeGranola(
  returnTo: 'web' | 'mobile' = 'mobile',
): Promise<{ authorization_url: string }> {
  const res = await authorizedFetch('/integrations/granola/authorize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ return_to: returnTo }),
  });
  const body = await parseJSON<{ authorization_url?: string }>(res);
  if (!body.authorization_url) {
    throw new Error('Authorize failed: missing authorization_url');
  }
  return { authorization_url: body.authorization_url };
}

export async function syncGranola(): Promise<void> {
  const res = await authorizedFetch('/integrations/granola/sync', {
    method: 'POST',
  });
  await parseJSON<{ status?: string }>(res);
}

export async function patchGranola(
  syncEnabled: boolean,
): Promise<IntegrationStatus> {
  const res = await authorizedFetch('/integrations/granola', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sync_enabled: syncEnabled }),
  });
  return parseJSON<IntegrationStatus>(res);
}

export async function disconnectGranola(): Promise<IntegrationStatus> {
  const res = await authorizedFetch('/integrations/granola', {
    method: 'DELETE',
  });
  return parseJSON<IntegrationStatus>(res);
}

export async function deleteGranolaImports(): Promise<void> {
  const res = await authorizedFetch('/integrations/granola/imports', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirm: true }),
  });
  await parseJSON<{ deleted?: boolean }>(res);
}
