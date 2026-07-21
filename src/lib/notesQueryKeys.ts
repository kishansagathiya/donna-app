export type NotesFeedFilters = {
  tag?: string | null;
  curated?: boolean;
  q?: string;
};

export const notesQueryKeys = {
  all: (userId: string) => ['notes', userId] as const,
  feeds: (userId: string) => [...notesQueryKeys.all(userId), 'feed'] as const,
  feed: (userId: string, filters: NotesFeedFilters = {}) =>
    [
      ...notesQueryKeys.feeds(userId),
      {
        tag: filters.tag ?? null,
        curated: filters.curated ?? true,
        q: filters.q ?? '',
      },
    ] as const,
  details: (userId: string) => [...notesQueryKeys.all(userId), 'detail'] as const,
  detail: (userId: string, id: string) =>
    [...notesQueryKeys.details(userId), id] as const,
  tags: (userId: string) => [...notesQueryKeys.all(userId), 'tags'] as const,
  noteTags: (userId: string, id: string) =>
    [...notesQueryKeys.all(userId), 'noteTags', id] as const,
  failed: (userId: string) =>
    [...notesQueryKeys.all(userId), 'failedMutations'] as const,
};

export function notesPersistStorageKey(userId: string): string {
  return `donna-notes-v2:${userId}`;
}
