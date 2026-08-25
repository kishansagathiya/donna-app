import { authorizedFetch, parseJSON } from './http';

export type SkillSource = 'user' | 'agent' | 'system';

export type Skill = {
  id?: string;
  user_id?: string;
  name: string;
  description: string;
  content: string;
  source: SkillSource;
  agent_run_id?: string | null;
  version?: number;
  created_at?: string;
  updated_at?: string;
};

export type SkillDraft = {
  name: string;
  description: string;
  content: string;
};

export async function listSkills(): Promise<Skill[]> {
  const res = await authorizedFetch('/skills');
  return parseJSON<Skill[]>(res);
}

export async function createSkill(draft: SkillDraft): Promise<Skill> {
  const res = await authorizedFetch('/skills', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(draft),
  });
  return parseJSON<Skill>(res);
}

export async function updateSkill(
  id: string,
  patch: Partial<SkillDraft>,
): Promise<Skill> {
  const res = await authorizedFetch(`/skills/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  return parseJSON<Skill>(res);
}

export async function deleteSkill(id: string): Promise<void> {
  const res = await authorizedFetch(`/skills/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  await parseJSON<{ ok?: boolean }>(res);
}
