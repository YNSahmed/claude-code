import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { Colors, Radius } from '@/constants/theme';
import { haptics } from '@/utils/device';

import { AppText } from './app-text';

/** A − value + control for whole numbers. */
export function Stepper({
  value,
  onChange,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  step = 1,
  format = String,
  label,
  compact,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  format?: (value: number) => string;
  label?: string;
  compact?: boolean;
}) {
  const change = (next: number) => {
    const clamped = Math.min(max, Math.max(min, next));
    if (clamped !== value) {
      haptics.select();
      onChange(clamped);
    }
  };
  const size = compact ? 32 : 40;

  return (
    <View style={styles.wrapper}>
      {label && !compact ? <AppText variant="label">{label}</AppText> : null}
      <View style={[styles.row, compact && styles.rowCompact]}>
        <StepButton
          icon="remove"
          size={size}
          disabled={value <= min}
          onPress={() => change(value - step)}
          label={`Decrease ${label ?? ''}`}
        />
        <AppText variant="stat" style={[styles.value, compact && styles.valueCompact]}>
          {format(value)}
        </AppText>
        <StepButton
          icon="add"
          size={size}
          disabled={value >= max}
          onPress={() => change(value + step)}
          label={`Increase ${label ?? ''}`}
        />
      </View>
    </View>
  );
}

function StepButton({
  icon,
  size,
  disabled,
  onPress,
  label,
}: {
  icon: 'add' | 'remove';
  size: number;
  disabled: boolean;
  onPress: () => void;
  label: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label.trim()}
      disabled={disabled}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { width: size, height: size },
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}>
      <Ionicons name={icon} size={size * 0.5} color={disabled ? Colors.textFaint : Colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 5,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceRaised,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  rowCompact: {
    padding: 3,
    gap: 4,
  },
  value: {
    flex: 1,
    textAlign: 'center',
  },
  valueCompact: {
    minWidth: 28,
    fontSize: 17,
  },
  button: {
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.7,
  },
});
