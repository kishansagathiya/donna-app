import { useCallback, useState } from 'react';
import DocumentPicker, {
  type DocumentPickerResponse,
} from 'react-native-document-picker';
import {
  launchImageLibrary,
  type Asset,
  type ImagePickerResponse,
} from 'react-native-image-picker';
import {
  ingestFile,
  ingestMessageForKind,
  ingestText,
  ingestUrl,
  type IngestFile,
} from '../services/knowledgeApi';

export type IngestToast = {
  message: string;
  isError: boolean;
};

function pickerFileToIngest(file: DocumentPickerResponse): IngestFile {
  const uri = file.fileCopyUri ?? file.uri;
  return {
    uri,
    name: file.name ?? 'document',
    type: file.type ?? 'application/octet-stream',
  };
}

function imageAssetToIngest(asset: Asset): IngestFile {
  const name = asset.fileName ?? `photo.${asset.type?.split('/')[1] ?? 'jpg'}`;
  return {
    uri: asset.uri ?? '',
    name,
    type: asset.type ?? 'image/jpeg',
  };
}

export function useAssetIngest() {
  const [toast, setToast] = useState<IngestToast | null>(null);
  const [busy, setBusy] = useState(false);

  const showToast = useCallback((message: string, isError = false) => {
    setToast({ message, isError });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const runIngest = useCallback(
    async (work: () => Promise<{ asset_kind: string }>) => {
      if (busy) return;
      setBusy(true);
      showToast('Adding to memory…');
      try {
        const result = await work();
        showToast(ingestMessageForKind(result.asset_kind));
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to add to memory';
        showToast(message, true);
      } finally {
        setBusy(false);
      }
    },
    [busy, showToast],
  );

  const addLink = useCallback(
    async (url: string) => {
      await runIngest(() => ingestUrl(url));
    },
    [runIngest],
  );

  const addNote = useCallback(
    async (text: string, title?: string) => {
      await runIngest(() => ingestText(text, title));
    },
    [runIngest],
  );

  const pickDocument = useCallback(async () => {
    try {
      const [file] = await DocumentPicker.pick({
        allowMultiSelection: false,
        copyTo: 'cachesDirectory',
      });
      const ingest = pickerFileToIngest(file);
      await runIngest(() => ingestFile(ingest));
    } catch (err) {
      if (DocumentPicker.isCancel(err)) return;
      showToast(
        err instanceof Error ? err.message : 'Could not open file',
        true,
      );
    }
  }, [runIngest, showToast]);

  const pickPhoto = useCallback(async () => {
    const result: ImagePickerResponse = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: 1,
    });

    if (result.didCancel) return;
    const asset = result.assets?.[0];
    if (!asset?.uri) {
      showToast('No photo selected', true);
      return;
    }

    await runIngest(() => ingestFile(imageAssetToIngest(asset)));
  }, [runIngest, showToast]);

  const ingestSharedPayload = useCallback(
    async (payload: {
      mimeType?: string;
      data?: string;
      extraData?: string | null;
    }) => {
      const mime = payload.mimeType ?? '';
      const data = payload.data ?? '';

      if (!data) return;

      if (mime === 'text/plain' || mime === 'text/url' || data.startsWith('http')) {
        const url = data.startsWith('http') ? data : payload.extraData ?? data;
        if (url.startsWith('http')) {
          await addLink(url);
          return;
        }
        await addNote(data, 'Shared note');
        return;
      }

      if (mime.startsWith('image/') || data.startsWith('file://')) {
        const name = data.split('/').pop() ?? 'shared-file';
        await runIngest(() =>
          ingestFile({
            uri: data,
            name,
            type: mime || 'application/octet-stream',
          }),
        );
        return;
      }

      await addNote(data, 'Shared content');
    },
    [addLink, addNote, runIngest],
  );

  return {
    toast,
    busy,
    addLink,
    addNote,
    pickDocument,
    pickPhoto,
    ingestSharedPayload,
  };
}
