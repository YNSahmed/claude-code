import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { TournamentCard } from '@/components/tournament-card';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { SectionTitle } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Colors, Gradients, Radius, type IconName } from '@/constants/theme';
import { useStore } from '@/data/store';
import { useNow } from '@/hooks/use-now';
import { byStartTime } from '@/utils/tournament';

const STEPS: { icon: IconName; text: string }[] = [
  { icon: 'create-outline', text: 'Set the mode, map, time and prizes' },
  { icon: 'people-outline', text: 'Players register their teams' },
  { icon: 'key-outline', text: 'Share the room ID and password' },
  { icon: 'podium-outline', text: 'Rank the teams and post results' },
];

export default function HostScreen() {
  const { tournaments, profile } = useStore();
  const router = useRouter();
  const now = useNow();

  const hosted = tournaments.filter((t) => t.hostId === profile?.id);
  const active = hosted.filter((t) => t.status !== 'completed').sort(byStartTime);
  const finished = hosted.filter((t) => t.status === 'completed').sort((a, b) => byStartTime(b, a));

  return (
    <Screen>
      <View style={styles.header}>
        <AppText variant="title">Host</AppText>
        <AppText variant="caption">Run your own custom-room tournaments.</AppText>
      </View>

      <LinearGradient colors={Gradients.night} style={styles.hero}>
        <LinearGradient colors={Gradients.fire} style={styles.heroIcon}>
          <Ionicons name="megaphone" size={24} color={Colors.text} />
        </LinearGradient>
        <AppText variant="heading">Start a tournament in under a minute</AppText>
        <View style={styles.steps}>
          {STEPS.map((step, i) => (
            <View key={step.text} style={styles.step}>
              <View style={styles.stepNumber}>
                <AppText style={styles.stepNumberText}>{i + 1}</AppText>
              </View>
              <Ionicons name={step.icon} size={16} color={Colors.textMuted} />
              <AppText variant="caption" color={Colors.text} style={styles.flex}>
                {step.text}
              </AppText>
            </View>
          ))}
        </View>
        <Button
          title="Create tournament"
          icon="add-circle"
          size="lg"
          onPress={() => router.push('/host/new')}
        />
      </LinearGradient>

      {active.length > 0 ? (
        <>
          <SectionTitle title="Your tournaments" icon="flag" />
          {active.map((t) => (
            <TournamentCard key={t.id} tournament={t} userId={profile?.id} now={now} />
          ))}
        </>
      ) : null}

      {finished.length > 0 ? (
        <>
          <SectionTitle title="Finished" icon="checkmark-done" />
          {finished.map((t) => (
            <TournamentCard key={t.id} tournament={t} userId={profile?.id} now={now} />
          ))}
        </>
      ) : null}

      {hosted.length === 0 ? (
        <AppText variant="caption" style={styles.center}>
          Tournaments you create will show up here.
        </AppText>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 8,
    gap: 2,
  },
  flex: {
    flex: 1,
  },
  hero: {
    borderRadius: Radius.xl,
    padding: 18,
    gap: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  steps: {
    gap: 10,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceRaised,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  stepNumberText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  center: {
    textAlign: 'center',
    paddingVertical: 12,
  },
});
