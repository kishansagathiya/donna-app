jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
    removeItem: jest.fn(async () => undefined),
  },
}));
jest.mock('react-native-blob-util', () => ({
  __esModule: true,
  default: {
    fs: {
      dirs: { DocumentDir: '/tmp' },
      exists: jest.fn(async () => true),
      mkdir: jest.fn(async () => undefined),
      writeFile: jest.fn(async () => undefined),
      readFile: jest.fn(async () => ''),
      unlink: jest.fn(async () => undefined),
    },
  },
}));

import { shouldShowLocalDeviceCapture } from '../localDeviceCaptures';
import type { LocalDeviceCapture } from '../localDeviceCaptures';

function capture(
  overrides: Partial<LocalDeviceCapture> = {},
): LocalDeviceCapture {
  return {
    id: 'cap_1-1',
    deviceName: 'cap_1',
    wavPath: '/tmp/cap_1.wav',
    createdAt: '2026-07-26T00:00:00.000Z',
    uploadStatus: 'pending',
    transcript: null,
    serverNoteId: null,
    clientNoteId: '11111111-1111-4111-8111-111111111111',
    lastUploadError: null,
    ...overrides,
  };
}

describe('shouldShowLocalDeviceCapture', () => {
  it('shows pending, uploading, and failed captures', () => {
    expect(shouldShowLocalDeviceCapture(capture({ uploadStatus: 'pending' }))).toBe(
      true,
    );
    expect(
      shouldShowLocalDeviceCapture(capture({ uploadStatus: 'uploading' })),
    ).toBe(true);
    expect(shouldShowLocalDeviceCapture(capture({ uploadStatus: 'failed' }))).toBe(
      true,
    );
  });

  it('hides uploaded captures so they do not duplicate server notes', () => {
    expect(
      shouldShowLocalDeviceCapture(capture({ uploadStatus: 'uploaded' })),
    ).toBe(false);
  });

  it('hides captures already linked to a server note id', () => {
    expect(
      shouldShowLocalDeviceCapture(
        capture({
          uploadStatus: 'pending',
          serverNoteId: '22222222-2222-4222-8222-222222222222',
        }),
      ),
    ).toBe(false);
  });
});
