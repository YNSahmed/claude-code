import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Colors, Radius, type IconName } from '@/constants/theme';

import { AppText } from './app-text';

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({
  title,
  icon,
  right,
}: {
  title: string;
  icon?: IconName;
  right?: ReactNode;
}) {
  return (
    <View style={styles.sectionTitle}>
      {icon ? <Ionicons name={icon} size={18} color={Colors.primary} /> : null}
      <AppText variant="heading" style={styles.sectionText}>
        {title}
      </AppText>
      {right}
    </View>
  );
}

export function StatTile({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: string;
  color?: string;
  icon?: IconName;
}) {
  return (
    <View style={styles.stat}>
      <View style={styles.statLabelRow}>
        {icon ? <Ionicons name={icon} size={13} color={Colors.textMuted} /> : null}
        <AppText variant="label">{label}</AppText>
      </View>
      <AppText variant="stat" color={color} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </AppText>
    </View>
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionText: {
    flex: 1,
  },
  stat: {
    flex: 1,
    gap: 4,
  },
  statLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
  },
});
