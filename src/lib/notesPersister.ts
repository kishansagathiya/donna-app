import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { notesPersistStorageKey } from './notesQueryKeys';

export function createNotesPersister(userId: string) {
  return createAsyncStoragePersister({
    storage: AsyncStorage,
    key: notesPersistStorageKey(userId),
    throttleTime: 500,
  });
}

export async function clearNotesPersistedCache(userId: string): Promise<void> {
  await AsyncStorage.removeItem(notesPersistStorageKey(userId));
}
