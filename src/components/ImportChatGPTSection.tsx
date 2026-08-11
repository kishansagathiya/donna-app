import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import DocumentPicker, {
  types as DocumentPickerTypes,
} from 'react-native-document-picker';
import { Text } from './ThemedText';
import { useTheme } from '../hooks/useTheme';
import { useThemedStyles } from '../hooks/useThemedStyles';
import {
  getChatGPTImport,
  getLatestChatGPTImport,
  importChatGPTExportZip,
  type ChatGPTImport,
} from '../services/chatgptImportApi';
import type { ThemeColors } from '../theme/colors';

function isActiveImport(imp: ChatGPTImport | null): boolean {
  if (!imp) return false;
  return imp.status === 'queued' || imp.status === 'running';
}

function statusCopy(imp: ChatGPTImport): string {
  switch (imp.status) {
    case 'awaiting_upload':
      return 'Waiting for upload…';
    case 'queued':
      return 'Queued — Donna will process your export shortly.';
    case 'running':
      if (imp.conversations_total > 0) {
        return `Importing conversations… ${imp.conversations_processed} / ${imp.conversations_total}`;
      }
      return 'Importing conversations…';
    case 'completed': {
      const parts = [
        `${imp.conversations_processed} conversation${imp.conversations_processed === 1 ? '' : 's'}`,
      ];
      if (imp.memories_imported > 0) {
        parts.push(
          `${imp.memories_imported} saved memor${imp.memories_imported === 1 ? 'y' : 'ies'}`,
        );
      }
      return `Imported ${parts.join(' and ')}.`;
    }
    case 'failed':
      return imp.error ? `Import failed: ${imp.error}` : 'Import failed.';
    default:
      return imp.status;
  }
}

type Props = {
  onOpenMemory?: () => void;
};

export function ImportChatGPTSection({ onOpenMemory }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [latest, setLatest] = useState<ChatGPTImport | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploadPct, setUploadPct] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const imp = await getLatestChatGPTImport();
      setLatest(imp);
    } catch (err) {
      Alert.alert(
        'Could not load import status',
        err instanceof Error ? err.message : 'Please try again.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!latest || !isActiveImport(latest)) {
      return;
    }
    const id = latest.id;
    const timer = setInterval(() => {
      void getChatGPTImport(id)
        .then(imp => setLatest(imp))
        .catch(() => {
          /* keep polling */
        });
    }, 2500);
    return () => clearInterval(timer);
  }, [latest?.id, latest?.status]);

  async function handlePick() {
    try {
      const [file] = await DocumentPicker.pick({
        type: [DocumentPickerTypes.zip, DocumentPickerTypes.allFiles],
        copyTo: 'cachesDirectory',
        allowMultiSelection: false,
      });
      const uri = file.fileCopyUri ?? file.uri;
      if (!uri) {
        throw new Error('Could not read the selected file');
      }

      setBusy(true);
      setUploadPct(0);
      const imp = await importChatGPTExportZip({
        uri,
        name: file.name ?? undefined,
        size: file.size,
        onProgress: (phase, ratio) => {
          if (phase === 'uploading') {
            setUploadPct(Math.round((ratio ?? 0) * 100));
          } else {
            setUploadPct(null);
          }
        },
      });
      setLatest(imp);
    } catch (err) {
      if (DocumentPicker.isCancel(err)) {
        return;
      }
      Alert.alert(
        'Import failed',
        err instanceof Error ? err.message : 'Could not import ChatGPT export',
      );
    } finally {
      setBusy(false);
      setUploadPct(null);
    }
  }

  const inProgress =
    latest?.status === 'queued' || latest?.status === 'running';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Import ChatGPT</Text>
      <Text style={styles.description}>
        Bring your ChatGPT history into Donna so it can build memory and context
        for chat and notes.
      </Text>

      <Text style={styles.steps}>
        1. Open ChatGPT → profile → Settings → Data controls.{'\n'}
        2. Tap Export data and confirm. OpenAI emails a download link.{'\n'}
        3. Download the ZIP before the link expires (~24 hours).{'\n'}
        4. Upload that ZIP here — no need to unzip it.
      </Text>

      {loading ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <>
          {latest && latest.status !== 'awaiting_upload' ? (
            <Text style={styles.status}>{statusCopy(latest)}</Text>
          ) : null}

          {uploadPct != null ? (
            <Text style={styles.status}>Uploading… {uploadPct}%</Text>
          ) : null}

          <Pressable
            style={[
              styles.button,
              styles.secondaryButton,
              (busy || inProgress) && styles.buttonDisabled,
            ]}
            onPress={() => void handlePick()}
            disabled={busy || inProgress}
            accessibilityRole="button"
          >
            {busy ? (
              <ActivityIndicator color={colors.text} size="small" />
            ) : (
              <Text style={styles.secondaryButtonText}>
                {inProgress
                  ? 'Import in progress…'
                  : 'Upload ChatGPT export ZIP'}
              </Text>
            )}
          </Pressable>

          <Text style={styles.hint}>
            Max 512MB. Donna extracts memories in the background; review them in
            Memory when ready.
          </Text>

          {latest?.status === 'completed' && onOpenMemory ? (
            <Pressable
              onPress={onOpenMemory}
              accessibilityRole="button"
              style={styles.linkWrap}
            >
              <Text style={styles.link}>Review what Donna learned</Text>
            </Pressable>
          ) : null}
        </>
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      marginBottom: 28,
    },
    title: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    description: {
      fontSize: 14,
      lineHeight: 20,
      color: colors.muted,
      marginBottom: 10,
    },
    steps: {
      fontSize: 13,
      lineHeight: 20,
      color: colors.muted,
      marginBottom: 12,
    },
    status: {
      fontSize: 13,
      lineHeight: 20,
      color: colors.text,
      marginBottom: 10,
    },
    hint: {
      marginTop: 8,
      fontSize: 12,
      lineHeight: 18,
      color: colors.muted,
    },
    button: {
      borderRadius: 12,
      paddingVertical: 14,
      paddingHorizontal: 16,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 48,
      marginBottom: 0,
    },
    secondaryButton: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    secondaryButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    buttonDisabled: {
      opacity: 0.7,
    },
    linkWrap: {
      marginTop: 12,
    },
    link: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      textDecorationLine: 'underline',
    },
  });
}
