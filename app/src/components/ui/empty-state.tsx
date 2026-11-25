import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { Colors, Gradients, type IconName } from '@/constants/theme';

import { AppText } from './app-text';
import { Button } from './button';

export function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  onAction,
}: {
  icon: IconName;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.wrapper}>
      <LinearGradient colors={Gradients.fire} style={styles.iconCircle}>
        <Ionicons name={icon} size={30} color={Colors.text} />
      </LinearGradient>
      <AppText variant="heading" style={styles.center}>
        {title}
      </AppText>
      <AppText variant="caption" style={[styles.center, styles.message]}>
        {message}
      </AppText>
      {actionLabel && onAction ? (
        <Button title={actionLabel} onPress={onAction} style={styles.action} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
    gap: 10,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  center: {
    textAlign: 'center',
  },
  message: {
    maxWidth: 320,
  },
  action: {
    marginTop: 8,
    alignSelf: 'stretch',
  },
});
