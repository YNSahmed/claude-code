import { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Colors, Fonts, Radius } from '@/constants/theme';

import { AppText } from './ui/app-text';

/** Indian mobile number input with a fixed +91 prefix. `value` is the 10 digits. */
export function PhoneField({
  label,
  value,
  onChangeText,
  error,
  hint,
  ...rest
}: Omit<TextInputProps, 'value' | 'onChangeText'> & {
  label: string;
  value: string;
  onChangeText: (digits: string) => void;
  error?: string | null;
  hint?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrapper}>
      <AppText variant="label">{label}</AppText>
      <View style={[styles.box, focused && styles.focused, !!error && styles.errored]}>
        <AppText style={styles.prefix}>+91</AppText>
        <View style={styles.divider} />
        <TextInput
          accessibilityLabel={label}
          value={value}
          onChangeText={(text) => onChangeText(text.replace(/\D/g, '').slice(-10))}
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
          maxLength={10}
          placeholder="98765 43210"
          placeholderTextColor={Colors.textFaint}
          selectionColor={Colors.primary}
          style={styles.input}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...rest}
        />
      </View>
      {error ? (
        <AppText variant="caption" color={Colors.danger}>
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption" color={Colors.textFaint}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

/** Indian mobile numbers are 10 digits starting with 6, 7, 8 or 9. */
export function phoneError(digits: string): string | null {
  if (!digits) return 'Enter a mobile number';
  return /^[6-9]\d{9}$/.test(digits) ? null : 'Enter a valid 10-digit mobile number';
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 6,
  },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 50,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceRaised,
  },
  focused: {
    borderColor: Colors.primary,
  },
  errored: {
    borderColor: Colors.danger,
  },
  prefix: {
    fontFamily: Fonts.displaySemi,
    fontSize: 17,
    paddingHorizontal: 14,
    color: Colors.textMuted,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: Colors.border,
  },
  input: {
    outlineWidth: 0,
    flex: 1,
    paddingHorizontal: 14,
    color: Colors.text,
    fontSize: 17,
    letterSpacing: 1,
    minHeight: 48,
  },
});
