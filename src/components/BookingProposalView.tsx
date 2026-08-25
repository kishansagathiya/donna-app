import { StyleSheet, View } from 'react-native';
import { Text } from '../components/ThemedText';
import type { BookingProposal } from '../lib/agentTurns';
import type { ThemeColors } from '../theme/colors';

export function BookingProposalView({
  proposal,
  colors,
}: {
  proposal: BookingProposal;
  colors: ThemeColors;
}) {
  const rows: { label: string; value: string }[] = [];
  if (proposal.itinerary) rows.push({ label: 'Itinerary', value: proposal.itinerary });
  if (proposal.dates) rows.push({ label: 'Dates', value: proposal.dates });
  if (proposal.airline) rows.push({ label: 'Airline', value: proposal.airline });
  if (proposal.vendor) rows.push({ label: 'Vendor', value: proposal.vendor });
  if (proposal.passengers) {
    rows.push({ label: 'Travelers', value: proposal.passengers });
  }
  if (proposal.cabin) rows.push({ label: 'Cabin', value: proposal.cabin });
  if (proposal.total) rows.push({ label: 'Total', value: proposal.total });
  if (proposal.notes) rows.push({ label: 'Notes', value: proposal.notes });
  if (rows.length === 0 && !proposal.sourceUrl) return null;

  return (
    <View
      style={[
        styles.box,
        { borderColor: colors.border, backgroundColor: colors.surface },
      ]}
    >
      {rows.map(row => (
        <View key={row.label} style={styles.row}>
          <Text style={[styles.label, { color: colors.muted }]}>{row.label}</Text>
          <Text style={[styles.value, { color: colors.text }]}>{row.value}</Text>
        </View>
      ))}
      {proposal.sourceUrl ? (
        <Text style={[styles.source, { color: colors.primary }]} numberOfLines={1}>
          {proposal.sourceUrl}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 6,
    marginTop: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  label: {
    width: 76,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  value: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  source: {
    fontSize: 12,
    marginTop: 4,
  },
});
