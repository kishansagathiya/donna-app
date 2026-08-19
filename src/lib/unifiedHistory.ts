export type HistoryConversation = {
  id: string;
  title: string;
  preview?: string | null;
  updated_at: string;
  pinned_at?: string | null;
  tags?: string[] | null;
  channel?: string;
};

export type HistoryAgentRun = {
  id: string;
  goal: string;
  status: string;
  updated_at: string;
  step_count?: number;
};

export type UnifiedHistoryItem =
  | {
      kind: 'chat';
      id: string;
      updatedAt: string;
      pinned: boolean;
      conversation: HistoryConversation;
    }
  | {
      kind: 'agent';
      id: string;
      updatedAt: string;
      pinned: false;
      run: HistoryAgentRun;
    };

const PENDING_RUN_ID = '__pending__';

export function agentStatusLabel(status: string): string {
  return status === 'waiting_for_user' ? 'needs reply' : status;
}

export function mergeHistoryItems(
  conversations: HistoryConversation[],
  runs: HistoryAgentRun[],
): UnifiedHistoryItem[] {
  const items: UnifiedHistoryItem[] = [
    ...conversations.map(conversation => ({
      kind: 'chat' as const,
      id: conversation.id,
      updatedAt: conversation.updated_at,
      pinned: Boolean(conversation.pinned_at),
      conversation,
    })),
    ...runs
      .filter(run => run.id && run.id !== PENDING_RUN_ID)
      .map(run => ({
        kind: 'agent' as const,
        id: run.id,
        updatedAt: run.updated_at,
        pinned: false as const,
        run,
      })),
  ];

  return items.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0);
  });
}

export function matchesHistoryQuery(
  item: UnifiedHistoryItem,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (item.kind === 'chat') {
    const tags = (item.conversation.tags ?? []).join(' ');
    const hay = `${item.conversation.title} ${item.conversation.preview ?? ''} ${tags} ${item.conversation.channel ?? ''}`;
    return hay.toLowerCase().includes(q);
  }
  const hay = `${item.run.goal} ${item.run.status} ${agentStatusLabel(item.run.status)}`;
  return hay.toLowerCase().includes(q);
}

export function historyKindLabel(item: UnifiedHistoryItem): string {
  if (item.kind === 'agent') return 'Agent';
  return item.conversation.channel === 'voice' ? 'Voice' : 'Chat';
}
