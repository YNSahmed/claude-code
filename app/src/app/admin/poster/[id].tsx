import Ionicons from '@expo/vector-icons/Ionicons';
import * as Sharing from 'expo-sharing';
import { useLocalSearchParams } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { useLeaderboard, useSettings, useTournament } from '@/api/queries';
import { POSTER_TEMPLATES, Poster, type PosterTemplate } from '@/components/poster';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Card, SectionTitle } from '@/components/ui/card';
import { Chip, ChipRow } from '@/components/ui/chip';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import {
  Colors,
  MaxContentWidth,
  PosterThemes,
  WhatsAppGreen,
  type PosterThemeName,
} from '@/constants/theme';
import { copyText, haptics } from '@/utils/device';
import { inviteMessage } from '@/utils/tournament';

const STEPS = [
  'Tap “Share poster” and choose WhatsApp.',
  'Pick your channel (it’s listed with your chats, or under Updates).',
  'Paste the caption (it’s already copied) and send.',
];

export default function PosterStudioScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width: screenWidth } = useWindowDimensions();
  const { data } = useTournament(id);
  const t = data?.tournament;
  const leaderboard = useLeaderboard(id, t?.status === 'COMPLETED');
  const { data: settings } = useSettings();
  const posterRef = useRef<ComponentRef<typeof View>>(null);

  const [template, setTemplate] = useState<PosterTemplate | null>(null);
  const [theme, setTheme] = useState<PosterThemeName>('inferno');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!t) {
    return (
      <Screen header={<ScreenHeader title="Poster" />} bottomInset>
        <ActivityIndicator color={Colors.primary} />
      </Screen>
    );
  }

  const available = POSTER_TEMPLATES.filter((p) =>
    t.status === 'COMPLETED' ? p.value === 'results' : p.value !== 'results'
  );
  const current =
    template && available.some((p) => p.value === template)
      ? template
      : (available[0]?.value ?? 'announce');
  const width = Math.min(screenWidth - 32, MaxContentWidth, 420);
  const caption = inviteMessage(t, settings?.whatsappChannelUrl);

  const share = async () => {
    setMessage(null);
    if (Platform.OS === 'web') {
      setMessage(
        'Sharing images works in the phone app. On the web, take a screenshot of the poster.'
      );
      return;
    }
    setBusy(true);
    try {
      await copyText(caption);
      const uri = await captureRef(posterRef, { format: 'png', quality: 1, result: 'tmpfile' });
      if (!(await Sharing.isAvailableAsync())) {
        setMessage('Sharing is not available on this device.');
        return;
      }
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: 'Post to your WhatsApp Channel',
        UTI: 'public.png',
      });
      haptics.success();
      setMessage('Caption copied — paste it under the poster in WhatsApp.');
    } catch {
      setMessage('Could not create the poster image. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen header={<ScreenHeader title="Poster studio" />} bottomInset>
      <ChipRow>
        {available.map((p) => (
          <Chip
            key={p.value}
            label={p.label}
            icon={p.icon}
            selected={current === p.value}
            onPress={() => setTemplate(p.value)}
          />
        ))}
      </ChipRow>
      <ChipRow>
        {(Object.keys(PosterThemes) as PosterThemeName[]).map((name) => (
          <Chip
            key={name}
            label={PosterThemes[name].label}
            selected={theme === name}
            onPress={() => setTheme(name)}
            color={PosterThemes[name].accent}
            icon="color-palette"
          />
        ))}
      </ChipRow>

      <View style={styles.posterFrame}>
        <Poster
          ref={posterRef}
          tournament={t}
          template={current}
          theme={theme}
          width={width}
          organizerName={settings?.organizerName}
          hasChannel={!!settings?.whatsappChannelUrl}
          standings={leaderboard.data}
        />
      </View>

      <Button
        title={busy ? 'Preparing…' : 'Share poster to WhatsApp'}
        icon="logo-whatsapp"
        size="lg"
        disabled={busy}
        onPress={share}
      />
      <Button
        title="Copy caption only"
        variant="secondary"
        icon="copy-outline"
        onPress={() => copyText(caption).then(() => setMessage('Caption copied.'))}
      />
      {message ? (
        <AppText variant="caption" color={Colors.live} style={styles.center}>
          {message}
        </AppText>
      ) : null}

      <Card>
        <SectionTitle title="Post it to your channel" icon="logo-whatsapp" />
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
        {!settings?.whatsappChannelUrl ? (
          <View style={styles.tip}>
            <Ionicons name="information-circle-outline" size={16} color={Colors.textMuted} />
            <AppText variant="caption" style={styles.flex}>
              Add your channel link in Organizer → WhatsApp Channel so posters and the app point
              players to it.
            </AppText>
          </View>
        ) : null}
      </Card>

      <Card>
        <SectionTitle title="Caption" icon="text" />
        <AppText variant="caption" color={Colors.text} selectable>
          {caption}
        </AppText>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  center: {
    textAlign: 'center',
  },
  posterFrame: {
    alignItems: 'center',
    borderRadius: 12,
    overflow: 'hidden',
    alignSelf: 'center',
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
  tip: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
});
