import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { CopyField } from '@/components/room-card';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Card, SectionTitle, StatTile } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { APP_NAME } from '@/constants/config';
import { Colors, Fonts, Gradients, Radius } from '@/constants/theme';
import { useStore } from '@/data/store';
import { digitsOnly, validateIgn, validateUid } from '@/data/validation';
import { confirmAction, haptics } from '@/utils/device';
import { formatMoney, initials } from '@/utils/format';
import { playerStats } from '@/utils/tournament';

export default function ProfileScreen() {
  const { profile, tournaments, saveProfile, resetApp } = useStore();
  const [ign, setIgn] = useState(profile?.ign ?? '');
  const [uid, setUid] = useState(profile?.uid ?? '');
  const [saved, setSaved] = useState(false);

  if (!profile) return null;

  const stats = playerStats(tournaments, profile.id);
  const changed = ign.trim() !== profile.ign || uid.trim() !== profile.uid;
  const ignError = changed ? validateIgn(ign) : null;
  const uidError = changed ? validateUid(uid) : null;

  const save = () => {
    const result = saveProfile({ ign, uid });
    setSaved(result.ok);
    if (result.ok) haptics.success();
  };

  const reset = async () => {
    const yes = await confirmAction({
      title: 'Reset the app?',
      message:
        'This deletes your profile, your registrations and the tournaments you host on this device.',
      confirmText: 'Reset',
      destructive: true,
    });
    if (yes) await resetApp();
  };

  return (
    <Screen>
      <LinearGradient colors={Gradients.night} style={styles.hero}>
        <LinearGradient colors={Gradients.fire} style={styles.avatarRing}>
          <View style={styles.avatar}>
            <AppText style={styles.avatarText}>{initials(profile.ign)}</AppText>
          </View>
        </LinearGradient>
        <AppText variant="title">{profile.ign}</AppText>
        <AppText variant="caption">Player ID {profile.uid}</AppText>
      </LinearGradient>

      <Card>
        <SectionTitle title="Career" icon="stats-chart" />
        <View style={styles.statsRow}>
          <StatTile label="Joined" value={String(stats.joined)} icon="ticket-outline" />
          <StatTile
            label="Wins"
            value={String(stats.wins)}
            icon="trophy-outline"
            color={stats.wins > 0 ? Colors.gold : undefined}
          />
        </View>
        <View style={styles.statsRow}>
          <StatTile label="Kills" value={String(stats.kills)} icon="skull-outline" />
          <StatTile
            label="Winnings"
            value={formatMoney(stats.earnings)}
            icon="cash-outline"
            color={Colors.gold}
          />
        </View>
      </Card>

      <Card>
        <SectionTitle title="Player card" icon="id-card-outline" />
        <CopyField label="Your player ID" value={profile.uid} />
        <TextField
          label="In-game name (IGN)"
          value={ign}
          onChangeText={(text) => {
            setIgn(text);
            setSaved(false);
          }}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={20}
          error={ignError}
        />
        <TextField
          label="Player ID (UID)"
          value={uid}
          onChangeText={(text) => {
            setUid(digitsOnly(text));
            setSaved(false);
          }}
          keyboardType="number-pad"
          maxLength={12}
          error={uidError}
          hint="New registrations use this. Teams you've already registered keep their details."
        />
        <Button
          title={saved ? 'Saved' : 'Save changes'}
          icon={saved ? 'checkmark-circle' : 'save-outline'}
          variant={changed ? 'primary' : 'secondary'}
          disabled={!changed || !!ignError || !!uidError}
          onPress={save}
        />
      </Card>

      <Card>
        <SectionTitle title="How it works" icon="help-circle-outline" />
        {[
          'Pick a tournament and tap Join. Add your teammates for Duo or Squad.',
          'Before the match, the room ID and password appear on your match ticket.',
          'Open the game, go to Custom Room and join with those details.',
          'After the match, the organizer posts the leaderboard and prizes.',
        ].map((text, i) => (
          <View key={text} style={styles.howRow}>
            <View style={styles.howNumber}>
              <AppText style={styles.howNumberText}>{i + 1}</AppText>
            </View>
            <AppText variant="caption" color={Colors.text} style={styles.flex}>
              {text}
            </AppText>
          </View>
        ))}
      </Card>

      <Button title="Reset app data" icon="refresh" variant="danger" onPress={reset} />
      <AppText variant="caption" style={styles.footer}>
        {APP_NAME} is an independent app and is not affiliated with or endorsed by Garena.
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
    gap: 4,
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
    marginBottom: 8,
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
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  howRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  howNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceRaised,
  },
  howNumberText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  footer: {
    textAlign: 'center',
    color: Colors.textFaint,
  },
});
