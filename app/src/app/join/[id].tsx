import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { ModeBadge } from '@/components/ui/badges';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { TEAM_SIZE } from '@/constants/config';
import { Colors, MapStyles, Radius } from '@/constants/theme';
import { useStore, useTournament } from '@/data/store';
import type { Player } from '@/data/types';
import { digitsOnly, validateIgn, validateUid } from '@/data/validation';
import { haptics } from '@/utils/device';
import { formatDateTime, formatEntry, formatMoney } from '@/utils/format';
import { canJoin } from '@/utils/tournament';

export default function JoinScreen() {
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
  const t = useTournament(id);
  const { profile, joinTournament } = useStore();
  const router = useRouter();

  const size = t ? TEAM_SIZE[t.mode] : 1;
  const [teamName, setTeamName] = useState('');
  const [players, setPlayers] = useState<Player[]>(() =>
    Array.from({ length: size }, (_, i) =>
      i === 0 ? { ign: profile?.ign ?? '', uid: profile?.uid ?? '' } : { ign: '', uid: '' }
    )
  );
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set on success, so the form doesn't flash "Registration closed" while navigating away.
  const [joined, setJoined] = useState(false);

  if (!t || (!joined && !canJoin(t, profile?.id))) {
    return (
      <Screen header={<ScreenHeader title="Join tournament" variant="close" />} bottomInset>
        <EmptyState
          icon="lock-closed"
          title={t ? 'Registration closed' : 'Tournament not found'}
          message={
            t
              ? "You've already joined, or this tournament is full or has started."
              : 'It may have been deleted by the organizer.'
          }
          actionLabel="Back to tournaments"
          onAction={() => router.replace('/')}
        />
      </Screen>
    );
  }

  const updatePlayer = (index: number, patch: Partial<Player>) => {
    setPlayers((current) => current.map((p, i) => (i === index ? { ...p, ...patch } : p)));
    setError(null);
  };

  const submit = () => {
    setSubmitted(true);
    const result = joinTournament(t.id, { teamName, players });
    if (!result.ok) {
      setError(result.error);
      haptics.warning();
      return;
    }
    setJoined(true);
    haptics.success();
    if (from === 'details') router.back();
    else router.replace({ pathname: '/tournament/[id]', params: { id: t.id } });
  };

  const map = MapStyles[t.map];

  return (
    <Screen
      header={<ScreenHeader title="Join tournament" variant="close" />}
      footer={
        <View style={styles.footer}>
          {error ? (
            <View style={styles.error}>
              <Ionicons name="alert-circle" size={18} color={Colors.danger} />
              <AppText variant="caption" color={Colors.danger} style={styles.flex}>
                {error}
              </AppText>
            </View>
          ) : null}
          <Button
            title={size === 1 ? 'Confirm & join' : `Register ${t.mode.toLowerCase()} & join`}
            icon="checkmark-circle"
            size="lg"
            onPress={submit}
          />
        </View>
      }>
      <LinearGradient
        colors={map.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.summary}>
        <ModeBadge mode={t.mode} onDark />
        <AppText variant="title" numberOfLines={1}>
          {t.title}
        </AppText>
        <AppText variant="caption" color="rgba(255,255,255,0.9)">
          {t.map} · {formatDateTime(t.startsAt)}
        </AppText>
        <View style={styles.summaryStats}>
          <SummaryStat label="Entry" value={formatEntry(t.entryFee)} />
          <SummaryStat label="Prize pool" value={formatMoney(t.prizePool)} />
          <SummaryStat label="Per kill" value={formatMoney(t.perKill)} />
        </View>
      </LinearGradient>

      {size > 1 ? (
        <Card>
          <TextField
            label="Team name"
            placeholder={`${profile?.ign ?? 'Your'}'s team`}
            value={teamName}
            onChangeText={setTeamName}
            maxLength={24}
            hint="Leave empty to use your name."
          />
        </Card>
      ) : null}

      {players.map((player, i) => (
        <Card key={i}>
          <View style={styles.playerHeader}>
            <View style={[styles.playerNumber, i === 0 && styles.captain]}>
              <AppText style={styles.playerNumberText}>{i + 1}</AppText>
            </View>
            <AppText variant="heading" style={styles.flex}>
              {i === 0 ? (size === 1 ? 'Your details' : 'You (captain)') : `Teammate ${i}`}
            </AppText>
          </View>
          <TextField
            label="In-game name (IGN)"
            placeholder="e.g. ShadowX"
            value={player.ign}
            onChangeText={(ign) => updatePlayer(i, { ign })}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={20}
            error={submitted ? validateIgn(player.ign) : null}
          />
          <TextField
            label="Player ID (UID)"
            placeholder="e.g. 1234567890"
            value={player.uid}
            onChangeText={(uid) => updatePlayer(i, { uid: digitsOnly(uid) })}
            keyboardType="number-pad"
            maxLength={12}
            error={submitted ? validateUid(player.uid) : null}
          />
        </Card>
      ))}

      <View style={styles.note}>
        <Ionicons name="information-circle-outline" size={18} color={Colors.textMuted} />
        <AppText variant="caption" style={styles.flex}>
          {t.entryFee > 0
            ? `The ${formatEntry(t.entryFee)} entry fee is paid to the organizer the way they ask; the app doesn't take payments. `
            : ''}
          Make sure the IGN and UID match your game account, or you may be kicked from the room.
        </AppText>
      </View>
    </Screen>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.flex}>
      <AppText variant="label" color="rgba(255,255,255,0.8)">
        {label}
      </AppText>
      <AppText variant="stat">{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  summary: {
    borderRadius: Radius.lg,
    padding: 16,
    gap: 6,
  },
  summaryStats: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  playerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  playerNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceRaised,
  },
  captain: {
    backgroundColor: Colors.primary,
  },
  playerNumberText: {
    fontWeight: '700',
    fontSize: 13,
  },
  note: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  footer: {
    gap: 10,
  },
  error: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
