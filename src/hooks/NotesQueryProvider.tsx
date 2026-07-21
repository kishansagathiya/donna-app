import React, { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import type { Persister } from '@tanstack/query-persist-client-core';
import { useAuth } from './useAuth';
import { clearUserNotesCache } from '../lib/notesCache';
import {
  clearNotesPersistedCache,
  createNotesPersister,
} from '../lib/notesPersister';
import { createAppQueryClient } from '../lib/queryClient';

function shouldDehydrateQuery(query: {
  queryKey: readonly unknown[];
  state: { status: string };
}): boolean {
  const key = query.queryKey;
  if (!Array.isArray(key) || key[0] !== 'notes') return false;
  return query.state.status === 'success';
}

function shouldDehydrateMutation(mutation: {
  options: { mutationKey?: readonly unknown[] };
  state: { isPaused: boolean; status: string };
}): boolean {
  const key = mutation.options.mutationKey;
  if (!Array.isArray(key) || key[0] !== 'notes') return false;
  return mutation.state.isPaused || mutation.state.status === 'pending';
}

export function NotesQueryProvider({ children }: { children: ReactNode }) {
  const { userId } = useAuth();
  const [queryClient] = useState(() => createAppQueryClient());
  const previousUserId = useRef<string | null>(null);

  const persister = useMemo<Persister | null>(() => {
    if (!userId) return null;
    return createNotesPersister(userId);
  }, [userId]);

  useEffect(() => {
    const prev = previousUserId.current;
    if (prev && prev !== userId) {
      void (async () => {
        await clearUserNotesCache(queryClient, prev);
        await clearNotesPersistedCache(prev);
        queryClient.clear();
      })();
    }
    previousUserId.current = userId;
  }, [queryClient, userId]);

  if (!userId || !persister) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 1000 * 60 * 60 * 24 * 7,
        buster: userId,
        dehydrateOptions: {
          shouldDehydrateQuery,
          shouldDehydrateMutation,
        },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}

export async function clearNotesCacheForUser(
  userId: string | null | undefined,
): Promise<void> {
  if (!userId) return;
  await clearNotesPersistedCache(userId);
}
