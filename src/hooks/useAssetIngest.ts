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
import {
  normalizeIncomingShares,
  planSharedIngest,
  type IncomingSharePayload,
} from '../lib/incomingShare';

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
    async (work: () => Promise<{ asset_kind: string; extractor?: string }>) => {
      if (busy) return;
      setBusy(true);
      showToast('Adding to memory…');
      try {
        const result = await work();
        showToast(ingestMessageForKind(result.asset_kind, result.extractor));
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
    async (payload: IncomingSharePayload): Promise<boolean> => {
      const plans = planSharedIngest(normalizeIncomingShares(payload));
      if (!plans.length) return false;

      setBusy(true);
      showToast(
        plans.length === 1 && plans[0].kind === 'url'
          ? 'Saving link to your notes…'
          : 'Saving to your notes…',
      );
      try {
        let lastKind = 'text';
        let lastExtractor: string | undefined;
        for (const plan of plans) {
          if (plan.kind === 'url') {
            const result = await ingestUrl(plan.url);
            lastKind = result.asset_kind;
            lastExtractor = result.extractor;
          } else if (plan.kind === 'text') {
            const result = await ingestText(plan.text, plan.title);
            lastKind = result.asset_kind;
            lastExtractor = result.extractor;
          } else {
            const result = await ingestFile({
              uri: plan.uri,
              name: plan.name,
              type: plan.type,
            });
            lastKind = result.asset_kind;
            lastExtractor = result.extractor;
          }
        }
        const saved =
          ingestMessageForKind(lastKind, lastExtractor).replace(
            / to memory$/,
            ' to your notes',
          );
        showToast(saved);
        return true;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Could not save shared item';
        showToast(message, true);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [showToast],
  );

  return {
    toast,
    busy,
    showToast,
    addLink,
    addNote,
    pickDocument,
    pickPhoto,
    ingestSharedPayload,
  };
}
