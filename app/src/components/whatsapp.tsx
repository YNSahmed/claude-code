import Ionicons from '@expo/vector-icons/Ionicons';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { useSettings } from '@/api/queries';
import { Colors, Radius, WhatsAppGreen } from '@/constants/theme';
import { haptics } from '@/utils/device';

import { AppText } from './ui/app-text';

/** "Follow our WhatsApp Channel" banner. Hidden until the organizer adds the channel link. */
export function WhatsAppChannelBanner({ compact }: { compact?: boolean }) {
  const { data: settings } = useSettings();
  const url = settings?.whatsappChannelUrl;
  if (!url) return null;

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel="Follow our WhatsApp Channel"
      onPress={() => {
        haptics.tap();
        void Linking.openURL(url);
      }}
      style={({ pressed }) => [
        styles.banner,
        compact && styles.compact,
        pressed && styles.pressed,
      ]}>
      <View style={styles.icon}>
        <Ionicons name="logo-whatsapp" size={22} color="#FFFFFF" />
      </View>
      <View style={styles.text}>
        <AppText variant="bodyStrong">Follow our WhatsApp Channel</AppText>
        {!compact ? (
          <AppText variant="caption">New tournaments, posters and results, first.</AppText>
        ) : null}
      </View>
      <Ionicons name="open-outline" size={18} color={WhatsAppGreen} />
    </Pressable>
  );
}

/** "+919876543210" → opens a WhatsApp chat with that number. */
export function openWhatsAppChat(phone: string, text?: string) {
  const digits = phone.replace(/\D/g, '');
  void Linking.openURL(`https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`);
}

export function callPhone(phone: string) {
  void Linking.openURL(`tel:${phone}`);
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: Radius.lg,
    backgroundColor: 'rgba(37, 211, 102, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(37, 211, 102, 0.4)',
  },
  compact: {
    padding: 10,
  },
  pressed: {
    opacity: 0.85,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: WhatsAppGreen,
  },
  text: {
    flex: 1,
  },
});

export const WhatsAppColors = { green: WhatsAppGreen, text: Colors.text };
