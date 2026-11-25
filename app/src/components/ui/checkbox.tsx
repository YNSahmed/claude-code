import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { haptics } from '@/utils/device';

import { AppText } from './app-text';

/** A checkbox that always starts unticked unless the caller says otherwise. */
export function Checkbox({
  checked,
  onChange,
  label,
  error,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  /** Highlights the box when the form was submitted without it. */
  error?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      // Explicit, so screen readers on web also announce "not checked".
      aria-checked={checked}
      accessibilityLabel={label}
      onPress={() => {
        haptics.select();
        onChange(!checked);
      }}
      style={styles.row}>
      <View style={[styles.box, checked && styles.on, error && !checked && styles.error]}>
        {checked ? <Ionicons name="checkmark" size={16} color={Colors.background} /> : null}
      </View>
      <AppText variant="caption" color={Colors.text} style={styles.flex}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  flex: {
    flex: 1,
  },
  box: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  on: {
    backgroundColor: Colors.live,
    borderColor: Colors.live,
  },
  error: {
    borderColor: Colors.danger,
  },
});
