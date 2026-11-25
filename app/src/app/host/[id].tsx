import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Leaderboard } from '@/components/leaderboard';
import { timeLabel } from '@/components/tournament-card';
import { AppText } from '@/components/ui/app-text';
import { ModeBadge, StatusBadge } from '@/components/ui/badges';
import { Button, IconButton } from '@/components/ui/button';
import { Card, SectionTitle, StatTile } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { Stepper } from '@/components/ui/stepper';
import { TextField } from '@/components/ui/text-field';
import { Colors, Radius } from '@/constants/theme';
import { useStore, useTournament, type ActionResult } from '@/data/store';
import type { Tournament } from '@/data/types';
import { useNow } from '@/hooks/use-now';
import { confirmAction, haptics, shareText } from '@/utils/device';
import { formatDateTime, formatEntry, formatMoney } from '@/utils/format';
import { inviteMessage } from '@/utils/tournament';

export default function ManageTournamentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTournament(id);
  const { profile } = useStore();
  const router = useRouter();
  const [note, setNote] = useState<string | null>(null);

  if (!t || t.hostId !== profile?.id) {
    return (
      <Screen header={<ScreenHeader title="Manage" />} bottomInset>
        <EmptyState
          icon="lock-closed"
          title="Not available"
          message="Only the organizer can manage this tournament."
          actionLabel="Back to tournaments"
          onAction={() => router.replace('/')}
        />
      </Screen>
    );
  }

  const share = async () => {
    const how = await shareText(inviteMessage(t));
    if (how === 'copied') setNote('Invite copied. Paste it in your group chat.');
  };

  return (
    <Screen
      bottomInset
      header={
        <ScreenHeader
          title="Manage"
          right={
            <IconButton
              icon="share-social-outline"
              accessibilityLabel="Share tournament"
              onPress={share}
            />
          }
        />
      }>
      <Summary tournament={t} />
      {note ? (
        <AppText variant="caption" color={Colors.live}>
          {note}
        </AppText>
      ) : null}
      <Progress tournament={t} />
      {t.status !== 'completed' ? <RoomEditor tournament={t} /> : null}
      {t.status === 'upcoming' ? <StartMatch tournament={t} /> : null}
      {t.status === 'live' ? <ResultsEditor tournament={t} /> : null}
      {t.status === 'completed' ? (
        <Card>
          <SectionTitle title="Final leaderboard" icon="podium" />
          <Leaderboard tournament={t} />
        </Card>
      ) : null}
      <TeamList tournament={t} />
      <DeleteTournament tournament={t} />
    </Screen>
  );
}

function Summary({ tournament: t }: { tournament: Tournament }) {
  const now = useNow();
  return (
    <Card>
      <View style={styles.badges}>
        <ModeBadge mode={t.mode} />
        <StatusBadge status={t.status} />
      </View>
      <AppText variant="title">{t.title}</AppText>
      <AppText variant="caption">
        {t.map} · {formatDateTime(t.startsAt, new Date(now))} · {timeLabel(t, now)}
      </AppText>
      <View style={styles.row}>
        <StatTile
          label={t.mode === 'Solo' ? 'Players' : 'Teams'}
          value={`${t.registrations.length}/${t.maxTeams}`}
        />
        <StatTile label="Prize pool" value={formatMoney(t.prizePool)} color={Colors.gold} />
        <StatTile label="Entry" value={formatEntry(t.entryFee)} />
      </View>
    </Card>
  );
}

function Progress({ tournament: t }: { tournament: Tournament }) {
  const steps = [
    { label: 'Teams registering', done: t.registrations.length > 0 },
    { label: 'Room shared', done: !!t.room },
    { label: 'Match live', done: t.status !== 'upcoming' },
    { label: 'Results posted', done: t.status === 'completed' },
  ];
  return (
    <View style={styles.progress}>
      {steps.map((step, i) => (
        <View key={step.label} style={styles.progressStep}>
          <View style={[styles.progressDot, step.done && styles.progressDone]}>
            {step.done ? (
              <Ionicons name="checkmark" size={14} color={Colors.background} />
            ) : (
              <AppText style={styles.progressNumber}>{i + 1}</AppText>
            )}
          </View>
          <AppText
            variant="caption"
            color={step.done ? Colors.text : Colors.textMuted}
            style={styles.progressLabel}>
            {step.label}
          </AppText>
        </View>
      ))}
    </View>
  );
}

function useFeedback() {
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const report = (result: ActionResult, success: string) => {
    if (result.ok) haptics.success();
    else haptics.warning();
    setMessage(result.ok ? { ok: true, text: success } : { ok: false, text: result.error });
    return result.ok;
  };
  const view = message ? (
    <View style={styles.feedback}>
      <Ionicons
        name={message.ok ? 'checkmark-circle' : 'alert-circle'}
        size={18}
        color={message.ok ? Colors.live : Colors.danger}
      />
      <AppText
        variant="caption"
        color={message.ok ? Colors.live : Colors.danger}
        style={styles.flex}>
        {message.text}
      </AppText>
    </View>
  ) : null;
  return { report, view, clear: () => setMessage(null) };
}

function RoomEditor({ tournament: t }: { tournament: Tournament }) {
  const { publishRoom } = useStore();
  const [roomId, setRoomId] = useState(t.room?.id ?? '');
  const [password, setPassword] = useState(t.room?.password ?? '');
  const feedback = useFeedback();
  const changed =
    roomId.trim() !== (t.room?.id ?? '') || password.trim() !== (t.room?.password ?? '');

  return (
    <Card>
      <SectionTitle title="Room details" icon="key" />
      <AppText variant="caption">
        Create a custom room in the game, then share its ID and password here. Only registered
        players can see them.
      </AppText>
      <View style={styles.row}>
        <View style={styles.flex}>
          <TextField
            label="Room ID"
            placeholder="e.g. 4829173"
            value={roomId}
            onChangeText={(v) => {
              setRoomId(v);
              feedback.clear();
            }}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={16}
          />
        </View>
        <View style={styles.flex}>
          <TextField
            label="Password"
            placeholder="e.g. fire48"
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              feedback.clear();
            }}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={16}
          />
        </View>
      </View>
      {feedback.view}
      <Button
        title={t.room ? 'Update room details' : 'Share with players'}
        icon="send"
        variant={changed ? 'primary' : 'secondary'}
        disabled={!changed}
        onPress={() =>
          feedback.report(
            publishRoom(t.id, { id: roomId, password }),
            'Players can see the room details now.'
          )
        }
      />
    </Card>
  );
}

function StartMatch({ tournament: t }: { tournament: Tournament }) {
  const { startMatch } = useStore();
  const feedback = useFeedback();

  const start = async () => {
    const yes = await confirmAction({
      title: 'Start the match?',
      message: 'Registration closes and the tournament is marked live.',
      confirmText: 'Start',
    });
    if (yes) feedback.report(startMatch(t.id), 'The match is live. Good luck to everyone!');
  };

  return (
    <Card>
      <SectionTitle title="Match control" icon="play-circle" />
      <AppText variant="caption">
        When everyone is in the room, start the match. Registration closes and you can post results
        afterwards.
      </AppText>
      {feedback.view}
      <Button
        title="Start match"
        icon="play"
        onPress={start}
        disabled={!t.room || t.registrations.length === 0}
      />
      {!t.room ? (
        <AppText variant="caption" color={Colors.textFaint}>
          Share the room details first.
        </AppText>
      ) : null}
    </Card>
  );
}

function ResultsEditor({ tournament: t }: { tournament: Tournament }) {
  const { publishResults } = useStore();
  const [ranking, setRanking] = useState(() =>
    t.registrations.map((r) => ({ registrationId: r.id, kills: 0 }))
  );
  const feedback = useFeedback();

  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= ranking.length) return;
    haptics.select();
    setRanking((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const setKills = (index: number, kills: number) =>
    setRanking((current) => current.map((r, i) => (i === index ? { ...r, kills } : r)));

  const post = async () => {
    const yes = await confirmAction({
      title: 'Post the results?',
      message: 'Players will see the final leaderboard. This cannot be changed later.',
      confirmText: 'Post results',
    });
    if (yes) feedback.report(publishResults(t.id, ranking), 'Results posted!');
  };

  return (
    <Card>
      <SectionTitle title="Results" icon="podium" />
      <AppText variant="caption">
        Put the teams in finishing order with the arrows (winner on top) and set their kills.
      </AppText>
      <View style={styles.ranking}>
        {ranking.map((entry, i) => {
          const team = t.registrations.find((r) => r.id === entry.registrationId);
          return (
            <View key={entry.registrationId} style={styles.rankRow}>
              <AppText
                variant="stat"
                style={styles.rankNumber}
                color={i < 3 ? Colors.gold : Colors.textMuted}>
                {i + 1}
              </AppText>
              <AppText variant="bodyStrong" numberOfLines={1} style={styles.flex}>
                {team?.teamName}
              </AppText>
              <Stepper
                compact
                value={entry.kills}
                onChange={(k) => setKills(i, k)}
                max={99}
                label={`kills for ${team?.teamName}`}
              />
              <View style={styles.arrows}>
                <ArrowButton
                  icon="chevron-up"
                  disabled={i === 0}
                  onPress={() => move(i, -1)}
                  label={`Move ${team?.teamName} up`}
                />
                <ArrowButton
                  icon="chevron-down"
                  disabled={i === ranking.length - 1}
                  onPress={() => move(i, 1)}
                  label={`Move ${team?.teamName} down`}
                />
              </View>
            </View>
          );
        })}
      </View>
      {feedback.view}
      <Button title="Post results" icon="trophy" onPress={post} />
    </Card>
  );
}

function ArrowButton({
  icon,
  disabled,
  onPress,
  label,
}: {
  icon: 'chevron-up' | 'chevron-down';
  disabled: boolean;
  onPress: () => void;
  label: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [
        styles.arrow,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}>
      <Ionicons name={icon} size={16} color={Colors.text} />
    </Pressable>
  );
}

function TeamList({ tournament: t }: { tournament: Tournament }) {
  const { removeTeam, addDemoTeams } = useStore();

  const remove = async (registrationId: string, name: string) => {
    const yes = await confirmAction({
      title: `Remove ${name}?`,
      message: 'Their slot opens up for someone else.',
      confirmText: 'Remove',
      destructive: true,
    });
    if (yes && removeTeam(t.id, registrationId).ok) haptics.warning();
  };

  return (
    <Card>
      <SectionTitle
        title={t.mode === 'Solo' ? 'Registered players' : 'Registered teams'}
        icon="people"
        right={
          <AppText variant="caption">
            {t.registrations.length}/{t.maxTeams}
          </AppText>
        }
      />
      {t.registrations.length === 0 ? (
        <AppText variant="caption">
          No one has joined yet. Share the tournament to fill your slots.
        </AppText>
      ) : null}
      {__DEV__ && t.status === 'upcoming' && t.registrations.length < t.maxTeams ? (
        <Button
          title="Add demo teams (dev only)"
          icon="flask-outline"
          variant="ghost"
          size="sm"
          onPress={() => addDemoTeams(t.id, 4)}
        />
      ) : null}
      {t.registrations.map((r, i) => (
        <View key={r.id} style={styles.team}>
          <View style={styles.teamHeader}>
            <AppText variant="caption" style={styles.teamIndex}>
              {i + 1}
            </AppText>
            <AppText variant="bodyStrong" style={styles.flex} numberOfLines={1}>
              {r.teamName}
            </AppText>
            {t.status === 'upcoming' ? (
              <IconButton
                icon="trash-outline"
                color={Colors.danger}
                accessibilityLabel={`Remove ${r.teamName}`}
                onPress={() => remove(r.id, r.teamName)}
                style={styles.smallIcon}
              />
            ) : null}
          </View>
          {r.players.map((p) => (
            <AppText key={p.uid} variant="caption" selectable style={styles.playerLine}>
              {p.ign} · UID {p.uid}
            </AppText>
          ))}
        </View>
      ))}
    </Card>
  );
}

function DeleteTournament({ tournament: t }: { tournament: Tournament }) {
  const { deleteTournament } = useStore();
  const router = useRouter();

  const remove = async () => {
    const yes = await confirmAction({
      title: 'Delete this tournament?',
      message: 'It disappears for everyone, including registered players.',
      confirmText: 'Delete',
      destructive: true,
    });
    if (yes && deleteTournament(t.id).ok) {
      haptics.warning();
      router.replace('/host');
    }
  };

  return (
    <Button title="Delete tournament" icon="trash-outline" variant="danger" onPress={remove} />
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  badges: {
    flexDirection: 'row',
    gap: 6,
  },
  progress: {
    flexDirection: 'row',
    gap: 6,
  },
  progressStep: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  progressDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceRaised,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  progressDone: {
    backgroundColor: Colors.live,
    borderColor: Colors.live,
  },
  progressNumber: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  progressLabel: {
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 14,
  },
  feedback: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ranking: {
    gap: 6,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceRaised,
  },
  rankNumber: {
    width: 26,
    textAlign: 'center',
  },
  arrows: {
    gap: 4,
  },
  arrow: {
    width: 28,
    height: 22,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  disabled: {
    opacity: 0.3,
  },
  pressed: {
    opacity: 0.7,
  },
  team: {
    gap: 2,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  teamHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  teamIndex: {
    width: 18,
    textAlign: 'center',
  },
  playerLine: {
    marginLeft: 28,
  },
  smallIcon: {
    width: 34,
    height: 34,
  },
});
