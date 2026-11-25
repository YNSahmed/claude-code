import { StyleSheet, Text, type TextProps } from 'react-native';

import { Colors, Fonts } from '@/constants/theme';

type Variant =
  'display' | 'title' | 'heading' | 'stat' | 'body' | 'bodyStrong' | 'caption' | 'label';

export type AppTextProps = TextProps & {
  variant?: Variant;
  color?: string;
};

const defaultColors: Partial<Record<Variant, string>> = {
  caption: Colors.textMuted,
  label: Colors.textMuted,
};

export function AppText({ variant = 'body', color, style, ...rest }: AppTextProps) {
  return (
    <Text
      style={[styles[variant], { color: color ?? defaultColors[variant] ?? Colors.text }, style]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  display: { fontFamily: Fonts.display, fontSize: 34, lineHeight: 38, letterSpacing: 0.5 },
  title: { fontFamily: Fonts.display, fontSize: 26, lineHeight: 30, letterSpacing: 0.3 },
  heading: { fontFamily: Fonts.display, fontSize: 20, lineHeight: 24, letterSpacing: 0.3 },
  stat: { fontFamily: Fonts.display, fontSize: 19, lineHeight: 22 },
  body: { fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontSize: 15, lineHeight: 22, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18 },
  label: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
});
