import type { InfiniteData, QueryClient } from '@tanstack/react-query';
import type { Note, NoteSummary } from '../services/notesApi';
import { notesQueryKeys, type NotesFeedFilters } from './notesQueryKeys';

export type NotesFeedPage = {
  items: NoteSummary[];
  nextCursor?: string;
  facets?: {
    tag: string;
    count: number;
    canonical?: string;
    pinned?: boolean;
  }[];
};

export type FailedNoteMutation = {
  id: string;
  noteId: string;
  action: 'create' | 'update' | 'flag' | 'tags' | 'delete';
  message: string;
  payload?: unknown;
  createdAt: string;
};

export function noteToSummary(note: Note | NoteSummary): NoteSummary {
  return {
    id: note.id,
    title: note.title,
    preview: note.preview,
    note_date: note.note_date,
    is_important: note.is_important,
    is_urgent: note.is_urgent,
    source_type: note.source_type,
    keywords: note.keywords,
    category: note.category,
    has_audio: note.has_audio,
    content_version: note.content_version,
    enrichment_status: note.enrichment_status,
    enrichment_version: note.enrichment_version,
    tags: note.tags,
  };
}

export function previewFromContent(content: string): {
  title: string;
  preview: string;
} {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const title = (lines[0] ?? 'Untitled').slice(0, 80);
  const preview = lines.slice(1).join(' ').slice(0, 240);
  return { title, preview };
}

function mapFeedPages(
  data: InfiniteData<NotesFeedPage> | undefined,
  mapItems: (items: NoteSummary[]) => NoteSummary[],
): InfiniteData<NotesFeedPage> | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: mapItems(page.items),
    })),
  };
}

export function upsertNoteInFeeds(
  queryClient: QueryClient,
  userId: string,
  note: NoteSummary,
  filters: NotesFeedFilters = { curated: true },
): void {
  const key = notesQueryKeys.feed(userId, filters);
  queryClient.setQueryData<InfiniteData<NotesFeedPage>>(key, (prev) => {
    // Detail/update responses omit tags; preserve any cached membership.
    let merged = note;
    if (prev && (note.tags === undefined || note.tags === null)) {
      for (const page of prev.pages) {
        const existing = page.items.find((item) => item.id === note.id);
        if (existing?.tags?.length) {
          merged = { ...note, tags: existing.tags };
          break;
        }
      }
    }
    if (!prev) {
      return {
        pages: [{ items: [merged], nextCursor: undefined }],
        pageParams: [undefined],
      };
    }
    const without = mapFeedPages(prev, (items) =>
      items.filter((item) => item.id !== merged.id),
    )!;
    const [first, ...rest] = without.pages;
    if (!first) {
      return {
        pages: [{ items: [merged], nextCursor: undefined }],
        pageParams: without.pageParams,
      };
    }
    return {
      ...without,
      pages: [{ ...first, items: [merged, ...first.items] }, ...rest],
    };
  });
}

export function patchNoteInFeeds(
  queryClient: QueryClient,
  userId: string,
  noteId: string,
  patch: Partial<NoteSummary>,
): void {
  const feeds = queryClient.getQueriesData<InfiniteData<NotesFeedPage>>({
    queryKey: notesQueryKeys.feeds(userId),
  });
  for (const [key] of feeds) {
    queryClient.setQueryData<InfiniteData<NotesFeedPage>>(key, (prev) =>
      mapFeedPages(prev, (items) =>
        items.map((item) =>
          item.id === noteId ? { ...item, ...patch } : item,
        ),
      ),
    );
  }
}

export function removeNoteFromFeeds(
  queryClient: QueryClient,
  userId: string,
  noteId: string,
): void {
  const feeds = queryClient.getQueriesData<InfiniteData<NotesFeedPage>>({
    queryKey: notesQueryKeys.feeds(userId),
  });
  for (const [key] of feeds) {
    queryClient.setQueryData<InfiniteData<NotesFeedPage>>(key, (prev) =>
      mapFeedPages(prev, (items) => items.filter((item) => item.id !== noteId)),
    );
  }
}

export function listFailedMutations(
  queryClient: QueryClient,
  userId: string,
): FailedNoteMutation[] {
  return (
    queryClient.getQueryData<FailedNoteMutation[]>(
      notesQueryKeys.failed(userId),
    ) ?? []
  );
}

export function pushFailedMutation(
  queryClient: QueryClient,
  userId: string,
  failure: FailedNoteMutation,
): void {
  const key = notesQueryKeys.failed(userId);
  const prev = listFailedMutations(queryClient, userId).filter(
    (item) => !(item.noteId === failure.noteId && item.action === failure.action),
  );
  queryClient.setQueryData<FailedNoteMutation[]>(key, [failure, ...prev]);
}

export function clearFailedMutation(
  queryClient: QueryClient,
  userId: string,
  noteId: string,
  action?: FailedNoteMutation['action'],
): void {
  const key = notesQueryKeys.failed(userId);
  queryClient.setQueryData<FailedNoteMutation[]>(key, (prev) =>
    (prev ?? []).filter(
      (item) =>
        item.noteId !== noteId ||
        (action !== undefined && item.action !== action),
    ),
  );
}

export async function clearUserNotesCache(
  queryClient: QueryClient,
  userId: string,
): Promise<void> {
  await queryClient.cancelQueries({ queryKey: notesQueryKeys.all(userId) });
  queryClient.removeQueries({ queryKey: notesQueryKeys.all(userId) });
}
