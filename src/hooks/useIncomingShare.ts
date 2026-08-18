import { useEffect, useRef } from 'react';
import { AppState, NativeModules } from 'react-native';
import ShareMenu from 'react-native-share-menu';
import {
  normalizeIncomingShares,
  type IncomingSharePayload,
} from '../lib/incomingShare';

type ShareHandler = (payload: IncomingSharePayload) => void | Promise<void>;

function isShareMenuAvailable(): boolean {
  const module = NativeModules.ShareMenu as
    | { getSharedText?: (callback: (share: unknown) => void) => void }
    | undefined;
  return typeof module?.getSharedText === 'function';
}

export function useIncomingShare(onShare: ShareHandler): void {
  const onShareRef = useRef(onShare);
  onShareRef.current = onShare;
  const lastKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isShareMenuAvailable()) {
      return;
    }

    const handle = (share?: IncomingSharePayload | null) => {
      const items = normalizeIncomingShares(share);
      if (!items.length) return;
      const key = items.map(item => `${item.mimeType}:${item.data}`).join('|');
      if (lastKeyRef.current === key) return;
      lastKeyRef.current = key;
      void onShareRef.current(share ?? {});
    };

    ShareMenu.getInitialShare(handle);

    const listener = ShareMenu.addNewShareListener(handle);
    const appState = AppState.addEventListener('change', state => {
      if (state === 'active') {
        ShareMenu.getInitialShare(handle);
      }
    });

    return () => {
      if (typeof listener?.remove === 'function') {
        listener.remove();
      }
      appState.remove();
    };
  }, []);
}
