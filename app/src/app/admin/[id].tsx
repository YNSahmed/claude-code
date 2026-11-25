import Ionicons from '@expo/vector-icons/Ionicons';
import { usePreventScreenCapture } from 'expo-screen-capture';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';

import { errorMessage, newIdempotencyKey } from '@/api/client';
import {
  useCancelTournament,
  usePublishResults,
  useRegistrations,
  useRemoveSquad,
  useSetRoom,
  useSetStatus,
  useSettings,
} from '@/api/queries';
import type { Squad, Tournament } from '@/api/types';
import { AppText } from '@/components/ui/app-text';
import { ModeBadge, StatusBadge } from '@/components/ui/badges';
import { Button, IconButton } from '@/components/ui/button';
import { Card, SectionTitle, StatTile } from '@/components/ui/card';
import { Chip, ChipRow } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { Stepper } from '@/components/ui/stepper';
import { TextField } from '@/components/ui/text-field';
import { callPhone, openWhatsAppChat } from '@/components/whatsapp';
import { MAP_LABEL } from '@/constants/config';
import { Colors, Radius, WhatsAppGreen } from '@/constants/theme';
import { useNow } from '@/hooks/use-now';
import { confirmAction, copyText, haptics, shareText } from '@/utils/device';
import { formatDateTime, formatPhone } from '@/utils/format';
import { inviteMessage, teamWord, timeLabel } from '@/utils/tournament';

/** Blocks screenshots and screen recording while personal data is on screen (Android; iOS hides it in recordings). */
function NoScreenshots() {
  usePreventScreenCapture('admin-registrations');
  return null;
}

export default function ManageTournamentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading, isError, error, refetch, isRefetching } = useRegistrations(id);
  const { data: settings } = useSettings();
  const [note, setNote] = useState<string | null>(null);
  const now = useNow();

  if (isLoading) {
    return (
      <Screen header={<ScreenHeader title="Manage" />} bottomInset>
        <ActivityIndicator color={Colors.primary} style={styles.loading} />
      </Screen>
    );
  }
  if (isError || !data) {
    return (
      <Screen header={<ScreenHeader title="Manage" />} bottomInset>
        <EmptyState
          icon="lock-closed"
          title="Can't open this tournament"
          message={errorMessage(error)}
          actionLabel="Back"
          onAction={() => router.back()}
        />
      </Screen>
    );
  }

  const t = data.tournament;
  const share = async () => {
    const how = await shareText(inviteMessage(t, settings?.whatsappChannelUrl));
    if (how === 'copied') setNote('Invite text copied.');
  };

  return (
    <Screen
      bottomInset
      onRefresh={() => void refetch()}
      refreshing={isRefetching}
      header={
        <ScreenHeader
          title="Manage"
          right={
            <IconButton
              icon="share-social-outline"
              accessibilityLabel="Share invite"
              onPress={share}
            />
          }
        />
      }>
      {Platform.OS !== 'web' ? <NoScreenshots /> : null}
      <Summary tournament={t} />
      {note ? (
        <AppText variant="caption" color={Colors.live}>
          {note}
        </AppText>
      ) : null}

      <Button
        title="Make a poster for WhatsApp"
        icon="image"
        size="lg"
        onPress={() => router.push({ pathname: '/admin/poster/[id]', params: { id: t.id } })}
      />

      <Progress tournament={t} squads={data.squads.length} />
      {t.status !== 'COMPLETED' && t.status !== 'CANCELLED' ? <RoomEditor tournament={t} /> : null}
      {t.status === 'OPEN' || t.status === 'LOCKED' ? <MatchControl tournament={t} /> : null}
      {t.status !== 'COMPLETED' &&
      t.status !== 'CANCELLED' &&
      new Date(t.startsAt).getTime() <= now + 60_000 ? (
        <ResultsEditor
          key={data.squads.map((s) => s.id).join()}
          tournament={t}
          squads={data.squads}
        />
      ) : null}
      <Registrations tournament={t} squads={data.squads} />
      {t.status !== 'COMPLETED' && t.status !== 'CANCELLED' ? (
        <CancelTournament tournament={t} />
      ) : null}
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
        {MAP_LABEL[t.map]} · {formatDateTime(t.startsAt, new Date(now))} · {timeLabel(t, now)}
      </AppText>
      <View style={styles.row}>
        <StatTile label={teamWord(t)} value={`${t.teamsRegistered}/${t.maxTeams}`} />
        <StatTile label="Players" value={`${t.teamsRegistered * t.teamSize}`} />
        <StatTile
          label="Room"
          value={t.roomPublished ? 'Set' : 'Not set'}
          color={t.roomPublished ? Colors.live : Colors.textMuted}
        />
      </View>
    </Card>
  );
}

function Progress({ tournament: t, squads }: { tournament: Tournament; squads: number }) {
  const steps = [
    { label: 'Squads in', done: squads > 0 },
    { label: 'Room set', done: t.roomPublished },
    { label: 'Match live', done: t.status === 'LIVE' || t.status === 'COMPLETED' },
    { label: 'Results', done: t.status === 'COMPLETED' },
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

const RELEASE_OPTIONS = [
  { label: 'Right now', minutesBefore: null },
  { label: '15 min before', minutesBefore: 15 },
  { label: '10 min before', minutesBefore: 10 },
  { label: 'At start', minutesBefore: 0 },
] as const;

function RoomEditor({ tournament: t }: { tournament: Tournament }) {
  const setRoom = useSetRoom(t.id);
  const [roomId, setRoomId] = useState('');
  const [password, setPassword] = useState('');
  const [release, setRelease] = useState<number>(0);
  const [saved, setSaved] = useState(false);

  const save = () => {
    const option = RELEASE_OPTIONS[release] ?? RELEASE_OPTIONS[0];
    const start = new Date(t.startsAt).getTime();
    const releaseAt =
      option.minutesBefore === null
        ? new Date()
        : new Date(Math.max(Date.now(), start - option.minutesBefore * 60_000));
    setRoom.mutate(
      {
        roomId: roomId.trim(),
        roomPassword: password.trim(),
        releaseAt: new Date(Math.min(releaseAt.getTime(), start)).toISOString(),
      },
      {
        onSuccess: () => {
          setSaved(true);
          haptics.success();
        },
      }
    );
  };

  return (
    <Card>
      <SectionTitle title="Room details" icon="key" />
      <AppText variant="caption">
        {t.roomPublished
          ? `Shared${t.credentialsReleaseAt ? `, visible from ${formatDateTime(t.credentialsReleaseAt)}` : ''}. Enter new details to change them.`
          : 'Create the custom room in the game, then share its ID and password with registered squads only.'}
      </AppText>
      <View style={styles.row}>
        <View style={styles.flex}>
          <TextField
            label="Room ID"
            placeholder="e.g. 4829173"
            value={roomId}
            onChangeText={(v) => {
              setRoomId(v);
              setSaved(false);
            }}
            autoCapitalize="none"
            maxLength={20}
          />
        </View>
        <View style={styles.flex}>
          <TextField
            label="Password"
            placeholder="e.g. fire48"
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              setSaved(false);
            }}
            autoCapitalize="none"
            maxLength={32}
          />
        </View>
      </View>
      <AppText variant="label">Show to squads</AppText>
      <ChipRow>
        {RELEASE_OPTIONS.map((o, i) => (
          <Chip
            key={o.label}
            label={o.label}
            selected={release === i}
            onPress={() => setRelease(i)}
          />
        ))}
      </ChipRow>
      {setRoom.isError ? (
        <AppText variant="caption" color={Colors.danger}>
          {errorMessage(setRoom.error)}
        </AppText>
      ) : null}
      {saved ? (
        <AppText variant="caption" color={Colors.live}>
          Saved. Registered squads see a countdown, then the details.
        </AppText>
      ) : null}
      <Button
        title="Share with registered squads"
        icon="send"
        disabled={!roomId.trim() || !password.trim() || setRoom.isPending}
        onPress={save}
      />
    </Card>
  );
}

function MatchControl({ tournament: t }: { tournament: Tournament }) {
  const setStatus = useSetStatus(t.id);
  const change = async (status: 'LOCKED' | 'LIVE') => {
    const yes = await confirmAction({
      title: status === 'LOCKED' ? 'Close registration?' : 'Start the match?',
      message:
        status === 'LOCKED'
          ? 'No more squads can register.'
          : 'Registration closes and the tournament shows as live.',
      confirmText: status === 'LOCKED' ? 'Close' : 'Go live',
    });
    if (yes) setStatus.mutate(status, { onSuccess: () => haptics.success() });
  };
  return (
    <Card>
      <SectionTitle title="Match control" icon="play-circle" />
      <View style={styles.row}>
        {t.status === 'OPEN' ? (
          <Button
            title="Close registration"
            variant="secondary"
            icon="lock-closed"
            style={styles.flex}
            onPress={() => change('LOCKED')}
          />
        ) : null}
        <Button title="Go live" icon="radio" style={styles.flex} onPress={() => change('LIVE')} />
      </View>
      {setStatus.isError ? (
        <AppText variant="caption" color={Colors.danger}>
          {errorMessage(setStatus.error)}
        </AppText>
      ) : null}
    </Card>
  );
}

function ResultsEditor({ tournament: t, squads }: { tournament: Tournament; squads: Squad[] }) {
  const publish = usePublishResults(t.id);
  const keyRef = useRef(newIdempotencyKey());
  const [ranking, setRanking] = useState(() =>
    squads.map((s) => ({ squadId: s.id, name: s.name, kills: 0 }))
  );

  if (squads.length === 0) return null;

  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= ranking.length) return;
    haptics.select();
    setRanking((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  };

  const post = async () => {
    const yes = await confirmAction({
      title: 'Post the results?',
      message: 'Everyone will see the final leaderboard. This cannot be changed.',
      confirmText: 'Post results',
    });
    if (!yes) return;
    publish.mutate(
      {
        key: keyRef.current,
        results: ranking.map((r, i) => ({ squadId: r.squadId, placement: i + 1, kills: r.kills })),
      },
      {
        onSuccess: () => haptics.success(),
        onError: () => {
          keyRef.current = newIdempotencyKey();
        },
      }
    );
  };

  return (
    <Card>
      <SectionTitle title="Results" icon="podium" />
      <AppText variant="caption">
        Put the {teamWord(t)} in finishing order (winner on top) and set their kills.
      </AppText>
      {ranking.map((entry, i) => (
        <View key={entry.squadId} style={styles.rankRow}>
          <AppText
            variant="stat"
            style={styles.rankNumber}
            color={i < 3 ? Colors.gold : Colors.textMuted}>
            {i + 1}
          </AppText>
          <AppText variant="bodyStrong" numberOfLines={1} style={styles.flex}>
            {entry.name}
          </AppText>
          <Stepper
            compact
            value={entry.kills}
            onChange={(k) =>
              setRanking((cur) => cur.map((r, j) => (j === i ? { ...r, kills: k } : r)))
            }
            max={47}
            label={`kills for ${entry.name}`}
          />
          <View style={styles.arrows}>
            <ArrowButton
              icon="chevron-up"
              disabled={i === 0}
              onPress={() => move(i, -1)}
              label={`Move ${entry.name} up`}
            />
            <ArrowButton
              icon="chevron-down"
              disabled={i === ranking.length - 1}
              onPress={() => move(i, 1)}
              label={`Move ${entry.name} down`}
            />
          </View>
        </View>
      ))}
      {publish.isError ? (
        <AppText variant="caption" color={Colors.danger}>
          {errorMessage(publish.error)}
        </AppText>
      ) : null}
      <Button
        title={publish.isPending ? 'Posting…' : 'Post results'}
        icon="trophy"
        disabled={publish.isPending}
        onPress={post}
      />
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

function Registrations({ tournament: t, squads }: { tournament: Tournament; squads: Squad[] }) {
  const remove = useRemoveSquad(t.id);
  const [copied, setCopied] = useState(false);
  const canRemove = t.status !== 'COMPLETED' && t.status !== 'CANCELLED';

  const copyList = async () => {
    const text = squads
      .map((s) =>
        [
          `#${s.slotNumber} ${s.name}`,
          ...s.members.map(
            (m) =>
              `  ${m.position}. ${m.name} · ${m.phone ? formatPhone(m.phone) : ''}${m.freeFireUid ? ` · UID ${m.freeFireUid}` : ''}`
          ),
        ].join('\n')
      )
      .join('\n\n');
    await copyText(`${t.title}\n\n${text}`);
    setCopied(true);
  };

  const onRemove = async (squad: Squad) => {
    const yes = await confirmAction({
      title: `Remove ${squad.name}?`,
      message: 'Their spot opens up and their details are deleted.',
      confirmText: 'Remove',
      destructive: true,
    });
    if (yes)
      remove.mutate(
        { squadId: squad.id, reason: 'Removed by organizer' },
        { onSuccess: () => haptics.warning() }
      );
  };

  return (
    <Card>
      <SectionTitle
        title={`Registered ${teamWord(t)}`}
        icon="people"
        right={
          squads.length > 0 ? (
            <Button
              title={copied ? 'Copied' : 'Copy list'}
              variant="ghost"
              size="sm"
              icon={copied ? 'checkmark' : 'copy-outline'}
              onPress={copyList}
            />
          ) : undefined
        }
      />
      <View style={styles.privateNote}>
        <Ionicons name="shield-checkmark" size={14} color={Colors.gold} />
        <AppText variant="caption" color={Colors.gold} style={styles.flex}>
          Private: only you can see these names and numbers. Use them only for this tournament.
        </AppText>
      </View>
      {squads.length === 0 ? (
        <AppText variant="caption">
          No squads yet. Share a poster on your WhatsApp Channel to fill the spots.
        </AppText>
      ) : null}
      {squads.map((squad) => (
        <View key={squad.id} style={styles.squad}>
          <View style={styles.squadHeader}>
            <AppText variant="caption" style={styles.slot}>
              #{squad.slotNumber}
            </AppText>
            <AppText variant="bodyStrong" style={styles.flex} numberOfLines={1}>
              {squad.name}
            </AppText>
            {canRemove ? (
              <IconButton
                icon="trash-outline"
                color={Colors.danger}
                accessibilityLabel={`Remove ${squad.name}`}
                onPress={() => onRemove(squad)}
                style={styles.smallIcon}
              />
            ) : null}
          </View>
          {squad.members.map((m) => (
            <View key={m.position} style={styles.memberRow}>
              <View style={styles.flex}>
                <AppText variant="body">
                  {m.name}
                  {m.isCaptain ? ' · captain' : ''}
                </AppText>
                <AppText variant="caption" selectable>
                  {m.phone ? formatPhone(m.phone) : '—'}
                </AppText>
                {m.freeFireUid ? (
                  <AppText variant="caption" color={Colors.textFaint} selectable>
                    UID {m.freeFireUid}
                  </AppText>
                ) : null}
              </View>
              {m.phone ? (
                <>
                  <IconButton
                    icon="call-outline"
                    accessibilityLabel={`Call ${m.name}`}
                    onPress={() => callPhone(m.phone as string)}
                    style={styles.smallIcon}
                  />
                  <IconButton
                    icon="logo-whatsapp"
                    color={WhatsAppGreen}
                    accessibilityLabel={`WhatsApp ${m.name}`}
                    onPress={() => openWhatsAppChat(m.phone as string)}
                    style={styles.smallIcon}
                  />
                </>
              ) : null}
            </View>
          ))}
        </View>
      ))}
    </Card>
  );
}

function CancelTournament({ tournament: t }: { tournament: Tournament }) {
  const cancel = useCancelTournament(t.id);
  const onCancel = async () => {
    const yes = await confirmAction({
      title: 'Cancel this tournament?',
      message: 'Players will see it as cancelled.',
      confirmText: 'Cancel tournament',
      destructive: true,
    });
    if (yes)
      cancel.mutate(
        { reason: 'Cancelled by organizer', key: newIdempotencyKey() },
        { onSuccess: () => haptics.warning() }
      );
  };
  return (
    <Button
      title="Cancel tournament"
      icon="close-circle-outline"
      variant="danger"
      onPress={onCancel}
    />
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  loading: {
    marginTop: 60,
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
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceRaised,
  },
  rankNumber: {
    width: 24,
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
  privateNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 10,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(255, 194, 61, 0.08)',
  },
  squad: {
    gap: 6,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  squadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  slot: {
    minWidth: 26,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 34,
  },
  smallIcon: {
    width: 34,
    height: 34,
  },
});
