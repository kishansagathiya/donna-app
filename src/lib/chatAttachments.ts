import ReactNativeBlobUtil from 'react-native-blob-util';
import DocumentPicker, {
  type DocumentPickerResponse,
} from 'react-native-document-picker';
import {
  launchImageLibrary,
  type Asset,
  type ImagePickerResponse,
} from 'react-native-image-picker';

export type ChatAttachmentKind = 'file' | 'url';

export type ChatAttachmentPayload = {
  kind: ChatAttachmentKind;
  filename?: string;
  mime?: string;
  data_base64?: string;
  url?: string;
};

export type PendingAttachment = {
  id: string;
  kind: ChatAttachmentKind;
  filename: string;
  mime?: string;
  previewUri?: string;
  payload: ChatAttachmentPayload;
};

const MAX_CHAT_ATTACHMENT_BYTES = 15 * 1024 * 1024;
const MAX_CHAT_ATTACHMENTS = 5;

let attachmentSeq = 0;
function nextId(): string {
  attachmentSeq += 1;
  return `att-${Date.now()}-${attachmentSeq}`;
}

export function assertAttachmentBudget(currentCount: number, adding = 1): void {
  if (currentCount + adding > MAX_CHAT_ATTACHMENTS) {
    throw new Error(
      `You can attach up to ${MAX_CHAT_ATTACHMENTS} items per message`,
    );
  }
}

export function urlToChatAttachment(rawUrl: string): PendingAttachment {
  const url = rawUrl.trim();
  if (!/^https?:\/\//i.test(url)) {
    throw new Error('Enter an http(s) URL');
  }
  let hostname = url;
  try {
    hostname = new URL(url).hostname || url;
  } catch {
    throw new Error('Invalid URL');
  }
  return {
    id: nextId(),
    kind: 'url',
    filename: hostname,
    payload: { kind: 'url', url },
  };
}

async function uriToBase64(uri: string): Promise<string> {
  const path = uri.startsWith('file://') ? uri.replace('file://', '') : uri;
  return ReactNativeBlobUtil.fs.readFile(path, 'base64');
}

async function fileSize(uri: string): Promise<number> {
  const path = uri.startsWith('file://') ? uri.replace('file://', '') : uri;
  const stat = await ReactNativeBlobUtil.fs.stat(path);
  return Number(stat.size ?? 0);
}

export async function pendingFromDocument(
  file: DocumentPickerResponse,
): Promise<PendingAttachment> {
  const uri = file.fileCopyUri ?? file.uri;
  if (!uri) {
    throw new Error('Could not read file');
  }
  const size = await fileSize(uri);
  if (size > MAX_CHAT_ATTACHMENT_BYTES) {
    throw new Error('File is too large (max 15MB)');
  }
  const data_base64 = await uriToBase64(uri);
  const mime = file.type ?? 'application/octet-stream';
  const filename = file.name ?? 'attachment';
  return {
    id: nextId(),
    kind: 'file',
    filename,
    mime,
    payload: {
      kind: 'file',
      filename,
      mime,
      data_base64,
    },
  };
}

export async function pendingFromImageAsset(
  asset: Asset,
): Promise<PendingAttachment> {
  if (!asset.uri) {
    throw new Error('No photo selected');
  }
  if (asset.fileSize && asset.fileSize > MAX_CHAT_ATTACHMENT_BYTES) {
    throw new Error('File is too large (max 15MB)');
  }
  const data_base64 = await uriToBase64(asset.uri);
  const mime = asset.type ?? 'image/jpeg';
  const filename =
    asset.fileName ?? `photo.${mime.split('/')[1] ?? 'jpg'}`;
  return {
    id: nextId(),
    kind: 'file',
    filename,
    mime,
    previewUri: asset.uri,
    payload: {
      kind: 'file',
      filename,
      mime,
      data_base64,
    },
  };
}

export async function pickDocumentForChat(): Promise<PendingAttachment | null> {
  try {
    const [file] = await DocumentPicker.pick({
      allowMultiSelection: false,
      copyTo: 'cachesDirectory',
    });
    return pendingFromDocument(file);
  } catch (err) {
    if (DocumentPicker.isCancel(err)) return null;
    throw err;
  }
}

export async function pickPhotoForChat(): Promise<PendingAttachment | null> {
  const result: ImagePickerResponse = await launchImageLibrary({
    mediaType: 'photo',
    selectionLimit: 1,
    includeBase64: false,
  });
  if (result.didCancel) return null;
  const asset = result.assets?.[0];
  if (!asset) {
    throw new Error('No photo selected');
  }
  return pendingFromImageAsset(asset);
}

export function displayUserContent(
  text: string,
  attachments: PendingAttachment[],
): string {
  const trimmed = text.trim();
  if (attachments.length === 0) return trimmed;
  const labels = attachments.map(a => a.filename).join(', ');
  if (!trimmed) return `📎 ${labels}`;
  return `${trimmed}\n\n📎 ${labels}`;
}
