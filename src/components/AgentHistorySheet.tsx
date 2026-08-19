import React from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './ThemedText';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { useTheme } from '../hooks/useTheme';
import type { AgentRun } from '../services/agentsApi';
import type { ThemeColors } from '../theme/colors';

type Props = {
  visible: boolean;
  onClose: () => void;
  runs: AgentRun[];
  selectedId: string | null;
  onSelect: (run: AgentRun) => void;
  onRefresh?: () => Promise<void> | void;
  refreshing?: boolean;
};

function statusLabel(status: string) {
  return status === 'waiting_for_user' ? 'needs reply' : status;
}

export function AgentHistorySheet({
  visible,
  onClose,
  runs,
  selectedId,
  onSelect,
  onRefresh,
  refreshing = false,
}: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, 16) },
          ]}
          onPress={e => e.stopPropagation()}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Agent history</Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Text style={styles.close}>Done</Text>
            </Pressable>
          </View>

          <FlatList
            data={runs}
            keyExtractor={item => item.id}
            contentContainerStyle={[
              styles.listContent,
              runs.length === 0 && styles.listEmptyContent,
            ]}
            refreshControl={
              onRefresh ? (
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => void onRefresh()}
                  tintColor={colors.primary}
                />
              ) : undefined
            }
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No agent runs yet</Text>
                <Text style={styles.emptyBody}>
                  Start a background goal. Donna will keep working while you do
                  other things.
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const waiting = item.status === 'waiting_for_user';
              const selected = item.id === selectedId;
              return (
                <Pressable
                  onPress={() => {
                    onSelect(item);
                    onClose();
                  }}
                  style={({ pressed }) => [
                    styles.card,
                    waiting && styles.cardWaiting,
                    selected && styles.cardSelected,
                    pressed && styles.cardPressed,
                  ]}
                >
                  <View style={styles.badgeRow}>
                    <View
                      style={[
                        styles.badge,
                        waiting && styles.badgeWaiting,
                        item.status === 'succeeded' && styles.badgeOk,
                        (item.status === 'failed' ||
                          item.status === 'cancelled') &&
                          styles.badgeBad,
                        (item.status === 'running' ||
                          item.status === 'queued') &&
                          styles.badgeActive,
                      ]}
                    >
                      <Text style={styles.badgeText}>
                        {statusLabel(item.status)}
                      </Text>
                    </View>
                    <Text style={styles.metaText}>
                      {item.step_count} steps
                    </Text>
                  </View>
                  <Text style={styles.cardTitle} numberOfLines={3}>
                    {item.goal}
                  </Text>
                </Pressable>
              );
            }}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.35)',
    },
    sheet: {
      maxHeight: '88%',
      minHeight: '50%',
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      fontFamily: colors.fontFamily,
    },
    close: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.primary,
      fontFamily: colors.fontFamily,
    },
    listContent: {
      paddingHorizontal: 20,
      paddingVertical: 16,
      gap: 12,
    },
    listEmptyContent: {
      flexGrow: 1,
      justifyContent: 'center',
    },
    emptyState: {
      alignItems: 'center',
      paddingHorizontal: 24,
      gap: 8,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      fontFamily: colors.fontFamily,
    },
    emptyBody: {
      fontSize: 14,
      lineHeight: 20,
      textAlign: 'center',
      color: colors.muted,
      fontFamily: colors.fontFamily,
    },
    card: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      backgroundColor: colors.background,
      padding: 14,
      gap: 10,
    },
    cardWaiting: {
      borderColor: '#F59E0B',
      backgroundColor: '#FFFBEB',
    },
    cardSelected: {
      borderColor: colors.primary,
    },
    cardPressed: {
      opacity: 0.85,
    },
    badgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    badge: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    badgeWaiting: {
      borderColor: '#FCD34D',
      backgroundColor: '#FEF3C7',
    },
    badgeOk: {
      borderColor: '#A7F3D0',
      backgroundColor: '#ECFDF5',
    },
    badgeBad: {
      borderColor: '#FECACA',
      backgroundColor: '#FEE2E2',
    },
    badgeActive: {
      borderColor: '#BAE6FD',
      backgroundColor: '#E0F2FE',
    },
    badgeText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.text,
      fontFamily: colors.fontFamily,
    },
    metaText: {
      fontSize: 12,
      color: colors.muted,
      fontFamily: colors.fontFamily,
    },
    cardTitle: {
      fontSize: 15,
      lineHeight: 21,
      color: colors.text,
      fontFamily: colors.fontFamily,
    },
  });
}
