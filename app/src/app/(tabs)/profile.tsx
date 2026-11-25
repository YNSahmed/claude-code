import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api, errorMessage } from '@/api/client';
import { useUpdateProfile } from '@/api/queries';
import { useAuth } from '@/auth/auth-context';
import { AppText } from '@/components/ui/app-text';
import { Pill } from '@/components/ui/badges';
import { Button } from '@/components/ui/button';
import { Card, SectionTitle } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { WhatsAppChannelBanner } from '@/components/whatsapp';
import { APP_NAME } from '@/constants/config';
import { Colors, Fonts, Gradients, Radius, type IconName } from '@/constants/theme';
import { confirmAction, haptics } from '@/utils/device';
import { formatPhone, initials } from '@/utils/format';

const PRIVACY: { icon: IconName; text: string }[] = [
  { icon: 'eye-off', text: 'Other players only see your squad name, never your number.' },
  {
    icon: 'people',
    text: 'Your captain sees your squad’s names and numbers, because they entered them.',
  },
  {
    icon: 'shield-checkmark',
    text: 'Only the organizer can see everyone’s details, to run the tournament.',
  },
  {
    icon: 'lock-closed',
    text: 'Numbers are encrypted on our server, and your session is stored in your phone’s secure keychain.',
  },
];

export default function ProfileScreen() {
  const { user, setUser, signOut, isAdmin } = useAuth();
  const [name, setName] = useState(user?.displayName ?? '');
  const [saved, setSaved] = useState(false);
  const update = useUpdateProfile();

  if (!user) return null;
  const changed = name.trim() !== (user.displayName ?? '') && name.trim().length >= 2;

  const save = () =>
    update.mutate(name.trim(), {
      onSuccess: ({ user: updated }) => {
        setUser(updated);
        setSaved(true);
        haptics.success();
      },
    });

  const signOutEverywhere = async () => {
    const yes = await confirmAction({
      title: 'Sign out on all devices?',
      message: 'You will need a new SMS code on every phone where you are signed in.',
      confirmText: 'Sign out everywhere',
      destructive: true,
    });
    if (!yes) return;
    await api('/auth/sign-out-everywhere', { method: 'POST' }).catch(() => {});
    await signOut();
  };

  return (
    <Screen>
      <LinearGradient colors={Gradients.night} style={styles.hero}>
        <LinearGradient colors={Gradients.fire} style={styles.avatarRing}>
          <View style={styles.avatar}>
            <AppText style={styles.avatarText}>{initials(user.displayName ?? '')}</AppText>
          </View>
        </LinearGradient>
        <AppText variant="title">{user.displayName}</AppText>
        <View style={styles.phoneRow}>
          <Ionicons name="checkmark-circle" size={15} color={Colors.live} />
          <AppText variant="caption">{formatPhone(user.phone)} · verified</AppText>
        </View>
        {isAdmin ? <Pill label="Organizer" color={Colors.gold} solid /> : null}
      </LinearGradient>

      <WhatsAppChannelBanner />

      <Card>
        <SectionTitle title="Your name" icon="person" />
        <TextField
          label="Display name"
          value={name}
          onChangeText={(text) => {
            setName(text);
            setSaved(false);
          }}
          maxLength={32}
          error={update.isError ? errorMessage(update.error) : null}
        />
        <Button
          title={saved ? 'Saved' : 'Save'}
          icon={saved ? 'checkmark-circle' : 'save-outline'}
          variant={changed ? 'primary' : 'secondary'}
          disabled={!changed || update.isPending}
          onPress={save}
        />
      </Card>

      <Card>
        <SectionTitle title="Who can see your details" icon="shield-checkmark" />
        {PRIVACY.map((p) => (
          <View key={p.text} style={styles.privacyRow}>
            <Ionicons name={p.icon} size={18} color={Colors.primary} />
            <AppText variant="caption" color={Colors.text} style={styles.flex}>
              {p.text}
            </AppText>
          </View>
        ))}
      </Card>

      <Button
        title="Sign out"
        icon="log-out-outline"
        variant="secondary"
        onPress={() => void signOut()}
      />
      <Button
        title="Sign out on all devices"
        icon="phone-portrait-outline"
        variant="danger"
        onPress={signOutEverywhere}
      />
      <AppText variant="caption" style={styles.footer}>
        {APP_NAME} is an independent app, not affiliated with or endorsed by Garena.
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  hero: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 24,
    marginTop: 8,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  avatarRing: {
    width: 92,
    height: 92,
    borderRadius: 46,
    padding: 3,
    marginBottom: 6,
  },
  avatar: {
    flex: 1,
    borderRadius: 43,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  avatarText: {
    fontFamily: Fonts.display,
    fontSize: 32,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  footer: {
    textAlign: 'center',
    color: Colors.textFaint,
  },
});
