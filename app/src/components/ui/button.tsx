import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Colors, Fonts, Gradients, Radius, type IconName } from '@/constants/theme';
import { haptics } from '@/utils/device';

import { AppText } from './app-text';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

const heights: Record<Size, number> = { sm: 36, md: 46, lg: 54 };
const fontSizes: Record<Size, number> = { sm: 14, md: 16, lg: 18 };

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  disabled,
  style,
  accessibilityLabel,
}: ButtonProps) {
  const textColor = disabled
    ? Colors.textFaint
    : variant === 'danger'
      ? Colors.danger
      : variant === 'ghost'
        ? Colors.primary
        : Colors.text;

  const content = (
    <View
      style={[
        styles.content,
        { height: heights[size], paddingHorizontal: size === 'sm' ? 14 : 20 },
      ]}>
      {icon ? <Ionicons name={icon} size={fontSizes[size] + 2} color={textColor} /> : null}
      <AppText
        style={[styles.label, { fontSize: fontSizes[size], color: textColor }]}
        numberOfLines={1}>
        {title}
      </AppText>
    </View>
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={() => {
        haptics.tap();
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.base,
        variant === 'secondary' && styles.secondary,
        variant === 'danger' && styles.danger,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}>
      {variant === 'primary' && !disabled ? (
        <LinearGradient
          colors={Gradients.fire}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}>
          {content}
        </LinearGradient>
      ) : (
        content
      )}
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  color = Colors.text,
  style,
}: {
  icon: IconName;
  onPress: () => void;
  accessibilityLabel: string;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      style={({ pressed }) => [styles.iconButton, pressed && styles.pressed, style]}>
      <Ionicons name={icon} size={22} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  gradient: {
    borderRadius: Radius.md,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  label: {
    fontFamily: Fonts.display,
    letterSpacing: 0.4,
  },
  secondary: {
    backgroundColor: Colors.surfaceRaised,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  danger: {
    backgroundColor: 'rgba(255, 77, 94, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 77, 94, 0.35)',
  },
  disabled: {
    backgroundColor: Colors.surfaceRaised,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceRaised,
    borderWidth: 1,
    borderColor: Colors.border,
  },
});
