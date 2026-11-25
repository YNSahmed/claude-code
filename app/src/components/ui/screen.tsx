import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, MaxContentWidth } from '@/constants/theme';

import { AppText } from './app-text';
import { IconButton } from './button';

interface ScreenProps {
  children: ReactNode;
  /** Replaces the default top safe-area spacer, for screens with their own header. */
  header?: ReactNode;
  /** Pinned to the bottom of the screen, for the main action. */
  footer?: ReactNode;
  /** Adds the bottom safe-area inset. Tab screens leave this off: the tab bar covers it. */
  bottomInset?: boolean;
  /** Content drawn edge to edge above the padded content, such as a banner. */
  hero?: ReactNode;
}

export function Screen({ children, header, footer, bottomInset = false, hero }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const bottomPadding = footer ? 24 : bottomInset ? insets.bottom + 24 : 24;

  return (
    <View style={styles.root}>
      {header ?? (hero ? null : <View style={{ height: insets.top }} />)}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={{ paddingBottom: bottomPadding }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {hero}
          <View style={styles.content}>{children}</View>
        </ScrollView>
        {footer ? (
          <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
            <View style={styles.footerInner}>{footer}</View>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </View>
  );
}

/** Title bar for screens pushed on top of the tabs. */
export function ScreenHeader({
  title,
  variant = 'back',
  right,
}: {
  title: string;
  variant?: 'back' | 'close';
  right?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const goBack = useGoBack();

  return (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <IconButton
        icon={variant === 'close' ? 'close' : 'chevron-back'}
        accessibilityLabel={variant === 'close' ? 'Close' : 'Back'}
        onPress={goBack}
      />
      <AppText variant="heading" numberOfLines={1} style={styles.headerTitle}>
        {title}
      </AppText>
      <View style={styles.headerRight}>{right}</View>
    </View>
  );
}

/** Goes back, or to the home screen when there is nothing to go back to (for example after opening a link). */
export function useGoBack() {
  const router = useRouter();
  return () => (router.canGoBack() ? router.back() : router.replace('/'));
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: 16,
    gap: 16,
  },
  footer: {
    paddingTop: 12,
    paddingHorizontal: 16,
    backgroundColor: Colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  footerInner: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: Colors.background,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    minWidth: 40,
    alignItems: 'flex-end',
  },
});
