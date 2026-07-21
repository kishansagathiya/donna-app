import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import {
  clearFailedMutation,
  listFailedMutations,
  noteToSummary,
  patchNoteInFeeds,
  previewFromContent,
  pushFailedMutation,
  removeNoteFromFeeds,
  upsertNoteInFeeds,
  type FailedNoteMutation,
  type NotesFeedPage,
} from "../lib/notesCache";
import { notesQueryKeys } from "../lib/notesQueryKeys";
import {
  createNote,
  deleteNote,
  getNote,
  getNoteTags,
  listNotesForTag,
  listNotesPage,
  listTags,
  setNoteTags,
  updateNote,
  type Note,
  type NoteSummary,
} from "../services/notesApi";

const PAGE_SIZE = 50;

function requireUserId(userId: string | null): string {
  if (!userId) {
    throw new Error("Not signed in");
  }
  return userId;
}

type FeedPageParam =
  | { kind: "cursor"; cursor?: string }
  | { kind: "offset"; offset: number };

export function useNotesFeed(tag: string | null = null) {
  const { userId } = useAuth();
  const uid = userId ?? "anonymous";

  return useInfiniteQuery({
    queryKey: notesQueryKeys.feed(uid, { tag, curated: true }),
    enabled: Boolean(userId),
    initialPageParam: { kind: "cursor" } as FeedPageParam,
    placeholderData: keepPreviousData,
    queryFn: async ({ pageParam }) => {
      if (tag) {
        const items = await listNotesForTag(tag, PAGE_SIZE);
        const page: NotesFeedPage = { items, nextCursor: undefined };
        return page;
      }
      const page = await listNotesPage({
        limit: PAGE_SIZE,
        cursor: pageParam.kind === "cursor" ? pageParam.cursor : "offset",
        offset: pageParam.kind === "offset" ? pageParam.offset : 0,
        curated: true,
      });
      return {
        items: page.items,
        nextCursor: page.nextCursor,
        facets: page.facets?.map((f) => ({ tag: f.tag, count: f.count })),
      } satisfies NotesFeedPage;
    },
    getNextPageParam: (lastPage, pages) => {
      if (!lastPage.nextCursor) return undefined;
      if (lastPage.nextCursor === "offset") {
        const loaded = pages.reduce((sum, page) => sum + page.items.length, 0);
        return { kind: "offset", offset: loaded } satisfies FeedPageParam;
      }
      return {
        kind: "cursor",
        cursor: lastPage.nextCursor,
      } satisfies FeedPageParam;
    },
  });
}

export function useNotesTags() {
  const { userId } = useAuth();
  const uid = userId ?? "anonymous";
  return useQuery({
    queryKey: notesQueryKeys.tags(uid),
    enabled: Boolean(userId),
    placeholderData: keepPreviousData,
    queryFn: () => listTags(30),
  });
}

export function useNote(id: string | undefined) {
  const { userId } = useAuth();
  const uid = userId ?? "anonymous";
  return useQuery({
    queryKey: notesQueryKeys.detail(uid, id ?? ""),
    enabled: Boolean(userId && id),
    placeholderData: keepPreviousData,
    queryFn: () => getNote(id!),
  });
}

export function useNoteTags(id: string | undefined) {
  const { userId } = useAuth();
  const uid = userId ?? "anonymous";
  return useQuery({
    queryKey: notesQueryKeys.noteTags(uid, id ?? ""),
    enabled: Boolean(userId && id),
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const res = await getNoteTags(id!);
      return res.tags ?? [];
    },
  });
}

export function useFailedNoteMutations(): FailedNoteMutation[] {
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const uid = userId ?? "anonymous";
  return (
    useQuery({
      queryKey: notesQueryKeys.failed(uid),
      enabled: Boolean(userId),
      queryFn: () => listFailedMutations(queryClient, uid),
      initialData: () => listFailedMutations(queryClient, uid),
      staleTime: Infinity,
    }).data ?? []
  );
}

export function useCreateNoteMutation() {
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["notes", "create"],
    mutationFn: async (input: { content: string; id: string }) =>
      createNote(input.content, { id: input.id }),
    onMutate: async (input) => {
      const uid = requireUserId(userId);
      const { title, preview } = previewFromContent(input.content);
      const optimistic: NoteSummary = {
        id: input.id,
        title,
        preview,
        note_date: new Date().toISOString(),
        is_important: false,
        is_urgent: false,
        source_type: "manual",
        keywords: null,
        category: null,
        has_audio: false,
        content_version: 1,
        enrichment_status: "pending",
      };
      upsertNoteInFeeds(queryClient, uid, optimistic, { curated: true });
      clearFailedMutation(queryClient, uid, input.id, "create");
      return { id: input.id, uid };
    },
    onError: (err, input, ctx) => {
      if (!ctx) return;
      pushFailedMutation(queryClient, ctx.uid, {
        id: `create:${ctx.id}`,
        noteId: ctx.id,
        action: "create",
        message: err instanceof Error ? err.message : "Failed to save note",
        payload: input,
        createdAt: new Date().toISOString(),
      });
    },
    onSuccess: (created, _input, ctx) => {
      if (!ctx) return;
      clearFailedMutation(queryClient, ctx.uid, created.id, "create");
      upsertNoteInFeeds(queryClient, ctx.uid, noteToSummary(created), {
        curated: true,
      });
      queryClient.setQueryData(
        notesQueryKeys.detail(ctx.uid, created.id),
        created,
      );
      void queryClient.invalidateQueries({
        queryKey: notesQueryKeys.tags(ctx.uid),
      });
    },
  });
}

export function useUpdateNoteMutation() {
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["notes", "update"],
    mutationFn: async (input: {
      id: string;
      patch: Parameters<typeof updateNote>[1];
    }) => updateNote(input.id, input.patch),
    onMutate: async (input) => {
      const uid = requireUserId(userId);
      const previous = queryClient.getQueryData<Note>(
        notesQueryKeys.detail(uid, input.id),
      );
      if (input.patch.content !== undefined) {
        const { title, preview } = previewFromContent(input.patch.content);
        patchNoteInFeeds(queryClient, uid, input.id, { title, preview });
      }
      if (input.patch.is_important !== undefined) {
        patchNoteInFeeds(queryClient, uid, input.id, {
          is_important: input.patch.is_important,
        });
      }
      if (input.patch.is_urgent !== undefined) {
        patchNoteInFeeds(queryClient, uid, input.id, {
          is_urgent: input.patch.is_urgent,
        });
      }
      if (previous) {
        queryClient.setQueryData<Note>(notesQueryKeys.detail(uid, input.id), {
          ...previous,
          ...input.patch,
          ...(input.patch.content !== undefined
            ? previewFromContent(input.patch.content)
            : {}),
        });
      }
      clearFailedMutation(queryClient, uid, input.id, "update");
      clearFailedMutation(queryClient, uid, input.id, "flag");
      return { uid, id: input.id, previous };
    },
    onError: (err, input, ctx) => {
      if (!ctx) return;
      const action =
        input.patch.is_important !== undefined ||
        input.patch.is_urgent !== undefined
          ? "flag"
          : "update";
      pushFailedMutation(queryClient, ctx.uid, {
        id: `${action}:${input.id}`,
        noteId: input.id,
        action,
        message: err instanceof Error ? err.message : "Failed to update note",
        payload: input,
        createdAt: new Date().toISOString(),
      });
    },
    onSuccess: (updated, _input, ctx) => {
      if (!ctx) return;
      clearFailedMutation(queryClient, ctx.uid, updated.id);
      upsertNoteInFeeds(queryClient, ctx.uid, noteToSummary(updated), {
        curated: true,
      });
      queryClient.setQueryData(
        notesQueryKeys.detail(ctx.uid, updated.id),
        updated,
      );
    },
  });
}

export function useDeleteNoteMutation() {
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["notes", "delete"],
    mutationFn: async (id: string) => {
      await deleteNote(id);
      return id;
    },
    onMutate: async (id) => {
      const uid = requireUserId(userId);
      removeNoteFromFeeds(queryClient, uid, id);
      queryClient.removeQueries({ queryKey: notesQueryKeys.detail(uid, id) });
      return { uid, id };
    },
    onError: (err, id, ctx) => {
      if (!ctx) return;
      pushFailedMutation(queryClient, ctx.uid, {
        id: `delete:${id}`,
        noteId: id,
        action: "delete",
        message: err instanceof Error ? err.message : "Failed to delete note",
        createdAt: new Date().toISOString(),
      });
      void queryClient.invalidateQueries({
        queryKey: notesQueryKeys.feeds(ctx.uid),
      });
    },
    onSuccess: (_id, id, ctx) => {
      if (!ctx) return;
      clearFailedMutation(queryClient, ctx.uid, id);
      void queryClient.invalidateQueries({
        queryKey: notesQueryKeys.tags(ctx.uid),
      });
    },
  });
}

export function useSetNoteTagsMutation() {
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["notes", "tags"],
    mutationFn: async (input: { id: string; tags: string[] }) =>
      setNoteTags(input.id, input.tags),
    onMutate: async (input) => {
      const uid = requireUserId(userId);
      queryClient.setQueryData(
        notesQueryKeys.noteTags(uid, input.id),
        input.tags,
      );
      patchNoteInFeeds(queryClient, uid, input.id, { tags: input.tags });
      clearFailedMutation(queryClient, uid, input.id, "tags");
      return { uid, id: input.id };
    },
    onError: (err, input, ctx) => {
      if (!ctx) return;
      pushFailedMutation(queryClient, ctx.uid, {
        id: `tags:${input.id}`,
        noteId: input.id,
        action: "tags",
        message: err instanceof Error ? err.message : "Failed to save tags",
        payload: input,
        createdAt: new Date().toISOString(),
      });
    },
    onSuccess: (res, input, ctx) => {
      if (!ctx) return;
      clearFailedMutation(queryClient, ctx.uid, input.id, "tags");
      queryClient.setQueryData(
        notesQueryKeys.noteTags(ctx.uid, input.id),
        res.tags ?? [],
      );
      void queryClient.invalidateQueries({
        queryKey: notesQueryKeys.tags(ctx.uid),
      });
    },
  });
}

export function useRetryFailedNoteMutation() {
  const createMut = useCreateNoteMutation();
  const updateMut = useUpdateNoteMutation();
  const deleteMut = useDeleteNoteMutation();
  const tagsMut = useSetNoteTagsMutation();
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  return async (failure: FailedNoteMutation) => {
    const uid = requireUserId(userId);
    clearFailedMutation(queryClient, uid, failure.noteId, failure.action);
    const payload = failure.payload as
      | { content: string; id?: string }
      | { id: string; patch: Parameters<typeof updateNote>[1] }
      | { id: string; tags: string[] }
      | undefined;

    if (failure.action === "create" && payload && "content" in payload) {
      await createMut.mutateAsync({
        content: payload.content,
        id: payload.id ?? failure.noteId,
      });
      return;
    }
    if (
      (failure.action === "update" || failure.action === "flag") &&
      payload &&
      "patch" in payload
    ) {
      await updateMut.mutateAsync(payload);
      return;
    }
    if (failure.action === "tags" && payload && "tags" in payload) {
      await tagsMut.mutateAsync(payload);
      return;
    }
    if (failure.action === "delete") {
      await deleteMut.mutateAsync(failure.noteId);
    }
  };
}
