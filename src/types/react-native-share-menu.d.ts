declare module 'react-native-share-menu' {
  export type ShareData = {
    mimeType: string;
    data: string;
    extraData?: string | null;
  };

  type ShareListener = { remove: () => void };

  const ShareMenu: {
    getInitialShare: (handler: (share?: ShareData | null) => void) => void;
    addNewShareListener: (handler: (share: ShareData) => void) => ShareListener;
  };

  export default ShareMenu;
}
