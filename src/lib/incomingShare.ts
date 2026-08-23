export type IncomingShareItem = {
  mimeType: string;
  data: string;
  extraData?: string | null;
};

export type IncomingSharePayload = {
  mimeType?: string;
  data?: unknown;
  extraData?: unknown;
};

export type SharedIngestPlan =
  | { kind: 'url'; url: string }
  | { kind: 'text'; text: string; title: string }
  | { kind: 'file'; uri: string; name: string; type: string };

const HTTP_URL_RE = /https?:\/\/[^\s<>]+/i;

export function firstHttpURL(text: string): string {
  const match = text.match(HTTP_URL_RE);
  if (!match) return '';
  return match[0].replace(/[.,;:!?)]+$/, '');
}

export function payloadFromShareURL(url: string): IncomingSharePayload | null {
  const trimmed = url.trim();
  if (!trimmed.startsWith('donna://share') && !trimmed.startsWith('donna:share')) {
    return null;
  }

  let payload: string | null = null;
  try {
    const parsed = new URL(trimmed);
    payload = parsed.searchParams.get('payload');
  } catch {
    const queryIndex = trimmed.indexOf('?');
    if (queryIndex >= 0) {
      payload = new URLSearchParams(trimmed.slice(queryIndex + 1)).get('payload');
    }
  }
  if (!payload) return null;

  try {
    const parsed = JSON.parse(payload) as unknown;
    if (Array.isArray(parsed)) {
      return { data: parsed };
    }
    if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { items?: unknown }).items)) {
      return { data: (parsed as { items: unknown[] }).items };
    }
  } catch {
    return null;
  }
  return null;
}

function extraToString(extra: unknown): string | null {
  if (extra == null) return null;
  if (typeof extra === 'string') {
    const trimmed = extra.trim();
    return trimmed || null;
  }
  if (typeof extra === 'object') {
    const record = extra as Record<string, unknown>;
    for (const key of ['comment', 'text', 'title', 'message']) {
      const value = record[key];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }
  }
  return null;
}

function coerceItem(
  mimeType: string,
  data: unknown,
  extraData: string | null,
): IncomingShareItem | null {
  if (typeof data !== 'string') return null;
  const trimmed = data.trim();
  if (!trimmed) return null;
  return { mimeType, data: trimmed, extraData };
}

/**
 * react-native-share-menu returns different shapes on iOS vs Android:
 * - Android / docs: `{ mimeType, data }`
 * - iOS native: `{ data: [{ mimeType, data }, ...] }`
 * - Android SEND_MULTIPLE: `{ mimeType, data: string[] }`
 */
export function normalizeIncomingShares(
  raw: IncomingSharePayload | null | undefined,
): IncomingShareItem[] {
  if (!raw) return [];

  const extraData = extraToString(raw.extraData);
  const mime = typeof raw.mimeType === 'string' ? raw.mimeType : '';

  if (Array.isArray(raw.data)) {
    const items: IncomingShareItem[] = [];
    for (const entry of raw.data) {
      if (typeof entry === 'string') {
        const item = coerceItem(mime, entry, extraData);
        if (item) items.push(item);
        continue;
      }
      if (entry && typeof entry === 'object') {
        const record = entry as Record<string, unknown>;
        const item = coerceItem(
          typeof record.mimeType === 'string' ? record.mimeType : mime,
          record.data,
          extraData,
        );
        if (item) items.push(item);
      }
    }
    return items;
  }

  const item = coerceItem(mime, raw.data, extraData);
  return item ? [item] : [];
}

function isFileItem(item: IncomingShareItem): boolean {
  const mime = item.mimeType.toLowerCase();
  if (mime.startsWith('image/') || mime.startsWith('audio/') || mime.startsWith('video/')) {
    return true;
  }
  if (mime && mime !== 'text/plain' && mime !== 'text/url' && mime !== 'text/uri-list') {
    if (item.data.startsWith('file:') || item.data.startsWith('content:')) {
      return true;
    }
  }
  return item.data.startsWith('file:') || item.data.startsWith('content:');
}

function filePlan(item: IncomingShareItem): SharedIngestPlan {
  const uri = item.data;
  const name = decodeURIComponent(uri.split('/').pop() || 'shared-file');
  return {
    kind: 'file',
    uri,
    name: name || 'shared-file',
    type: item.mimeType || 'application/octet-stream',
  };
}

export function planSharedIngest(items: IncomingShareItem[]): SharedIngestPlan[] {
  if (!items.length) return [];

  const files = items.filter(isFileItem);
  if (files.length) {
    return files.map(filePlan);
  }

  const combined = items
    .map(item => item.data)
    .concat(items.map(item => item.extraData).filter((value): value is string => Boolean(value)))
    .filter((value, index, all) => all.indexOf(value) === index)
    .join('\n')
    .trim();

  const urls = [...new Set(
    [combined, ...items.map(item => item.data)]
      .map(text => firstHttpURL(text))
      .filter(Boolean),
  )];

  let leftover = combined;
  for (const url of urls) {
    leftover = leftover.split(url).join(' ');
  }
  leftover = leftover.replace(/\s+/g, ' ').trim();

  const hasEmbeddedUrl = items.some(item => {
    const url = firstHttpURL(item.data);
    if (!url) return false;
    const without = item.data
      .split(url)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    return (
      without.length >= 40 ||
      without.split(/\s+/).filter(Boolean).length >= 8
    );
  });

  if (!hasEmbeddedUrl && urls.length === 1 && leftover.length < 160) {
    return [{ kind: 'url', url: urls[0] }];
  }

  if (!hasEmbeddedUrl && urls.length > 1 && leftover.length < 160) {
    return urls.map(url => ({ kind: 'url' as const, url }));
  }

  if (combined) {
    return [{ kind: 'text', text: combined, title: 'Shared note' }];
  }

  return [];
}
