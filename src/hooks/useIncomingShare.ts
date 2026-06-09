import { useEffect, useRef } from 'react';
import { NativeModules } from 'react-native';
import ShareMenu from 'react-native-share-menu';

type ShareHandler = (payload: {
  mimeType?: string;
  data?: string;
  extraData?: string | null;
}) => void | Promise<void>;

function isShareMenuAvailable(): boolean {
  const module = NativeModules.ShareMenu as
    | { getSharedText?: (callback: (share: unknown) => void) => void }
    | undefined;
  return typeof module?.getSharedText === 'function';
}

export function useIncomingShare(onShare: ShareHandler): void {
  const onShareRef = useRef(onShare);
  onShareRef.current = onShare;

  useEffect(() => {
    if (!isShareMenuAvailable()) {
      return;
    }

    ShareMenu.getInitialShare((share) => {
      if (!share) return;
      void onShareRef.current({
        mimeType: share.mimeType,
        data: share.data,
        extraData: share.extraData ?? null,
      });
    });

    const listener = ShareMenu.addNewShareListener((share) => {
      void onShareRef.current({
        mimeType: share.mimeType,
        data: share.data,
        extraData: share.extraData ?? null,
      });
    });

    return () => {
      if (typeof listener?.remove === 'function') {
        listener.remove();
      }
    };
  }, []);
}
