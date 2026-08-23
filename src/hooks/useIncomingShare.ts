import { useEffect, useRef } from 'react';
import { AppState, Linking, NativeModules } from 'react-native';
import ShareMenu from 'react-native-share-menu';
import {
  normalizeIncomingShares,
  payloadFromShareURL,
  type IncomingSharePayload,
} from '../lib/incomingShare';

type ShareHandler = (payload: IncomingSharePayload) => void | Promise<void>;

type ShareInboxModule = {
  takePending: () => Promise<Array<{ data?: string; mimeType?: string }>>;
};

function shareInbox(): ShareInboxModule | null {
  const module = NativeModules.DonnaShareInbox as ShareInboxModule | undefined;
  return typeof module?.takePending === 'function' ? module : null;
}

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
    const handle = (share?: IncomingSharePayload | null) => {
      const items = normalizeIncomingShares(share);
      if (!items.length) return;
      const key = items.map(item => `${item.mimeType}:${item.data}`).join('|');
      if (lastKeyRef.current === key) return;
      lastKeyRef.current = key;
      void onShareRef.current(share ?? { data: items });
    };

    const takeNativeInbox = () => {
      const inbox = shareInbox();
      if (!inbox) return;
      void inbox.takePending().then(items => {
        if (Array.isArray(items) && items.length) {
          handle({ data: items });
        }
      });
    };

    const handleUrl = (url: string | null) => {
      if (!url) return;
      handle(payloadFromShareURL(url));
    };

    takeNativeInbox();
    void Linking.getInitialURL().then(handleUrl);

    if (isShareMenuAvailable()) {
      ShareMenu.getInitialShare(handle);
    }

    const linking = Linking.addEventListener('url', event => {
      handleUrl(event.url);
      takeNativeInbox();
    });

    const listener = isShareMenuAvailable()
      ? ShareMenu.addNewShareListener(handle)
      : null;

    const appState = AppState.addEventListener('change', state => {
      if (state === 'active') {
        takeNativeInbox();
        if (isShareMenuAvailable()) {
          ShareMenu.getInitialShare(handle);
        }
      }
    });

    return () => {
      linking.remove();
      if (typeof listener?.remove === 'function') {
        listener.remove();
      }
      appState.remove();
    };
  }, []);
}
