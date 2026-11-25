import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Colors, Fonts, Radius, type IconName } from '@/constants/theme';
import { haptics } from '@/utils/device';

import { AppText } from './app-text';

export function Chip({
  label,
  selected,
  onPress,
  icon,
  color = Colors.primary,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: IconName;
  color?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => {
        haptics.select();
        onPress();
      }}
      style={({ pressed }) => [
        styles.chip,
        selected && { backgroundColor: `${color}22`, borderColor: color },
        pressed && styles.pressed,
      ]}>
      {icon ? <Ionicons name={icon} size={15} color={selected ? color : Colors.textMuted} /> : null}
      <AppText style={[styles.chipLabel, { color: selected ? Colors.text : Colors.textMuted }]}>
        {label}
      </AppText>
    </Pressable>
  );
}

/** A horizontally scrolling row of chips. */
export function ChipRow({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}>
      {children}
    </ScrollView>
  );
}

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.segmented} accessibilityRole="tablist">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => {
              haptics.select();
              onChange(option.value);
            }}
            style={[styles.segment, selected && styles.segmentSelected]}>
            <AppText
              style={[styles.segmentLabel, { color: selected ? Colors.text : Colors.textMuted }]}>
              {option.label}
            </AppText>
            {option.count !== undefined ? (
              <View style={[styles.count, selected && styles.countSelected]}>
                <AppText
                  style={[styles.countLabel, { color: selected ? Colors.text : Colors.textMuted }]}>
                  {option.count}
                </AppText>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: 8,
    paddingRight: 16,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  chipLabel: {
    fontFamily: Fonts.displaySemi,
    fontSize: 15,
  },
  pressed: {
    opacity: 0.8,
  },
  segmented: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 38,
    borderRadius: Radius.sm,
  },
  segmentSelected: {
    backgroundColor: Colors.surfaceRaised,
  },
  segmentLabel: {
    fontFamily: Fonts.display,
    fontSize: 15,
  },
  count: {
    minWidth: 20,
    paddingHorizontal: 5,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceRaised,
  },
  countSelected: {
    backgroundColor: Colors.primary,
  },
  countLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
});
