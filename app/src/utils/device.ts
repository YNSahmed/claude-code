import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Alert, Platform, Share } from 'react-native';

const isWeb = Platform.OS === 'web';

function ignore() {}

/** Haptic feedback. Does nothing on web. */
export const haptics = {
  tap: () => {
    if (!isWeb) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(ignore);
  },
  select: () => {
    if (!isWeb) Haptics.selectionAsync().catch(ignore);
  },
  success: () => {
    if (!isWeb) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(ignore);
  },
  warning: () => {
    if (!isWeb) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(ignore);
  },
};

export async function copyText(text: string): Promise<void> {
  await Clipboard.setStringAsync(text);
  haptics.success();
}

/** Opens the share sheet on a phone. On web, copies the message instead. */
export async function shareText(message: string): Promise<'shared' | 'copied'> {
  if (!isWeb) {
    try {
      await Share.share({ message });
      return 'shared';
    } catch {
      // Fall through and copy instead.
    }
  }
  await copyText(message);
  return 'copied';
}

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmText?: string;
  destructive?: boolean;
}

/** A yes/no dialog that also works on web, where Alert buttons are not supported. */
export function confirmAction({
  title,
  message,
  confirmText = 'OK',
  destructive = false,
}: ConfirmOptions): Promise<boolean> {
  if (isWeb) {
    const ask = (globalThis as { confirm?: (text: string) => boolean }).confirm;
    return Promise.resolve(ask ? ask(message ? `${title}\n\n${message}` : title) : true);
  }
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        {
          text: confirmText,
          style: destructive ? 'destructive' : 'default',
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
}

export function createId(prefix = ''): string {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
