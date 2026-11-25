import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, View } from 'react-native';

import { errorMessage } from '@/api/client';
import { useSettings, useUpdateSettings } from '@/api/queries';
import type { Settings } from '@/api/types';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Card, SectionTitle } from '@/components/ui/card';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { Colors, WhatsAppGreen } from '@/constants/theme';
import { haptics } from '@/utils/device';

const CHANNEL_PATTERN = /^https:\/\/(www\.)?whatsapp\.com\/channel\/[A-Za-z0-9]{10,64}\/?$/;

const STEPS = [
  'Open WhatsApp and go to the Updates tab.',
  'Open your channel, tap its name, then Share (or Channel link).',
  'Copy the link and paste it here. It looks like https://whatsapp.com/channel/0029Va…',
];

export default function OrganizerSettingsScreen() {
  const { data: settings } = useSettings();
  if (!settings) {
    return (
      <Screen header={<ScreenHeader title="WhatsApp Channel" />} bottomInset>
        <ActivityIndicator color={Colors.primary} />
      </Screen>
    );
  }
  return <SettingsForm settings={settings} />;
}

function SettingsForm({ settings }: { settings: Settings }) {
  const update = useUpdateSettings();
  const [url, setUrl] = useState(settings.whatsappChannelUrl ?? '');
  const [name, setName] = useState(settings.organizerName ?? '');
  const [saved, setSaved] = useState(false);

  const urlError =
    url && !CHANNEL_PATTERN.test(url.trim()) ? 'Paste the full channel link from WhatsApp' : null;

  const save = () =>
    update.mutate(
      { whatsappChannelUrl: url.trim() || null, organizerName: name.trim() || null },
      {
        onSuccess: () => {
          setSaved(true);
          haptics.success();
        },
      }
    );

  return (
    <Screen header={<ScreenHeader title="WhatsApp Channel" />} bottomInset>
      <Card>
        <View style={styles.titleRow}>
          <Ionicons name="logo-whatsapp" size={28} color={WhatsAppGreen} />
          <AppText variant="heading" style={styles.flex}>
            Your broadcast channel
          </AppText>
        </View>
        <AppText variant="caption">
          Players see a &quot;Follow our WhatsApp Channel&quot; button in the app, and your posters
          mention it. Post each poster to the channel from the poster screen.
        </AppText>
        <TextField
          label="Channel link"
          placeholder="https://whatsapp.com/channel/…"
          value={url}
          onChangeText={(v) => {
            setUrl(v);
            setSaved(false);
          }}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          error={urlError}
        />
        <TextField
          label="Organizer name (on posters)"
          placeholder="e.g. Clutch Arena"
          value={name}
          onChangeText={(v) => {
            setName(v);
            setSaved(false);
          }}
          maxLength={40}
        />
        {update.isError ? (
          <AppText variant="caption" color={Colors.danger}>
            {errorMessage(update.error)}
          </AppText>
        ) : null}
        <Button
          title={saved ? 'Saved' : 'Save'}
          icon={saved ? 'checkmark-circle' : 'save-outline'}
          disabled={!!urlError || update.isPending}
          onPress={save}
        />
        {settings.whatsappChannelUrl ? (
          <Button
            title="Open channel"
            variant="ghost"
            icon="open-outline"
            onPress={() => void Linking.openURL(settings.whatsappChannelUrl as string)}
          />
        ) : null}
      </Card>

      <Card>
        <SectionTitle title="Where to find the link" icon="help-circle-outline" />
        {STEPS.map((step, i) => (
          <View key={step} style={styles.step}>
            <View style={styles.stepNumber}>
              <AppText style={styles.stepNumberText}>{i + 1}</AppText>
            </View>
            <AppText variant="caption" color={Colors.text} style={styles.flex}>
              {step}
            </AppText>
          </View>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceRaised,
  },
  stepNumberText: {
    fontSize: 12,
    fontWeight: '700',
    color: WhatsAppGreen,
  },
});
