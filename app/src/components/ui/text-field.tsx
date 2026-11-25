import { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Colors, Radius } from '@/constants/theme';

import { AppText } from './app-text';

export type TextFieldProps = TextInputProps & {
  label: string;
  error?: string | null;
  hint?: string;
};

export function TextField({
  label,
  error,
  hint,
  style,
  multiline,
  onFocus,
  onBlur,
  ...rest
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrapper}>
      <AppText variant="label">{label}</AppText>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={Colors.textFaint}
        selectionColor={Colors.primary}
        multiline={multiline}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          styles.input,
          multiline && styles.multiline,
          focused && styles.focused,
          !!error && styles.errored,
          style,
        ]}
        {...rest}
      />
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

const styles = StyleSheet.create({
  wrapper: {
    gap: 6,
  },
  input: {
    minHeight: 50,
    paddingHorizontal: 14,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceRaised,
    color: Colors.text,
    fontSize: 16,
  },
  multiline: {
    minHeight: 120,
    paddingTop: 12,
    paddingBottom: 12,
    textAlignVertical: 'top',
  },
  focused: {
    borderColor: Colors.primary,
  },
  errored: {
    borderColor: Colors.danger,
  },
});
