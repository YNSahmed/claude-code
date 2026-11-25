import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { errorMessage } from '@/api/client';
import {
  useLeaderboard,
  useMySquad,
  useSettings,
  useTournament,
  useWithdrawSquad,
} from '@/api/queries';
import type { Squad } from '@/api/types';
import { useAuth } from '@/auth/auth-context';
import { Leaderboard } from '@/components/leaderboard';
import { RoomCard } from '@/components/room-card';
import { AppText } from '@/components/ui/app-text';
import { ModeBadge, Pill, ProgressBar, StatusBadge } from '@/components/ui/badges';
import { Button, IconButton } from '@/components/ui/button';
import { Card, Divider, SectionTitle, StatTile } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen, ScreenHeader, useGoBack } from '@/components/ui/screen';
import { MAP_LABEL, MODE_LABEL } from '@/constants/config';
import { Colors, MapStyles, Radius, type IconName } from '@/constants/theme';
import { useNow } from '@/hooks/use-now';
import { confirmAction, haptics, shareText } from '@/utils/device';
import { formatDateTime, formatEntry, formatMoney, formatPhone, ordinal } from '@/utils/format';
import { inviteMessage, isRegistrationOpen, teamWord, timeLabel } from '@/utils/tournament';

export default function TournamentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const goBack = useGoBack();
  const insets = useSafeAreaInsets();
  const now = useNow();
  const { isAdmin } = useAuth();
  const { data, isLoading, isError, error, refetch, isRefetching } = useTournament(id);
  const mySquad = useMySquad(id);
  const t = data?.tournament;
  const leaderboard = useLeaderboard(id, t?.status === 'COMPLETED');
  const { data: settings } = useSettings();
  const [note, setNote] = useState<string | null>(null);

  if (isLoading) {
    return (
      <Screen header={<ScreenHeader title="Tournament" />} bottomInset>
        <ActivityIndicator color={Colors.primary} style={styles.loading} />
      </Screen>
    );
  }
  if (isError || !t) {
    return (
      <Screen header={<ScreenHeader title="Tournament" />} bottomInset>
        <EmptyState
          icon="search"
          title="Couldn't open this tournament"
          message={errorMessage(error)}
          actionLabel="Back to tournaments"
          onAction={() => router.replace('/')}
        />
      </Screen>
    );
  }

  const squad = mySquad.data ?? null;
  const map = MapStyles[t.map];
  const share = async () => {
    const how = await shareText(inviteMessage(t, settings?.whatsappChannelUrl));
    setNote(how === 'copied' ? 'Invite copied. Paste it in your squad chat.' : null);
  };

  let footer: ReactNode;
  if (isAdmin) {
    footer = (
      <Button
        title="Manage tournament"
        icon="settings-outline"
        size="lg"
        onPress={() => router.push({ pathname: '/admin/[id]', params: { id: t.id } })}
      />
    );
  } else if (squad) {
    footer = (
      <View style={styles.footerRow}>
        <Ionicons name="checkmark-circle" size={22} color={Colors.live} />
        <AppText variant="bodyStrong" style={styles.flex}>
          {squad.name} is registered · Team #{squad.slotNumber}
        </AppText>
      </View>
    );
  } else if (isRegistrationOpen(t)) {
    footer = (
      <Button
        title={`Register your ${teamWord(t, 1)} · Free`}
        icon="flash"
        size="lg"
        onPress={() => router.push({ pathname: '/register/[id]', params: { id: t.id } })}
      />
    );
  } else if (t.status === 'OPEN') {
    footer = (
      <Button
        title={t.teamsLeft === 0 ? 'All spots taken' : 'Registration closed'}
        size="lg"
        disabled
      />
    );
  }

  return (
    <Screen
      header={null}
      bottomInset={!footer}
      footer={footer}
      onRefresh={() => {
        void refetch();
        void mySquad.refetch();
      }}
      refreshing={isRefetching}
      hero={
        <LinearGradient
          colors={map.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { paddingTop: insets.top + 8 }]}>
          <Ionicons
            name={map.icon}
            size={220}
            color="rgba(255,255,255,0.12)"
            style={styles.heroIcon}
          />
          <View style={styles.heroBar}>
            <IconButton
              icon="chevron-back"
              accessibilityLabel="Back"
              onPress={goBack}
              style={styles.heroButton}
            />
            <IconButton
              icon="share-social-outline"
              accessibilityLabel="Share tournament"
              onPress={share}
              style={styles.heroButton}
            />
          </View>
          <View style={styles.heroContent}>
            <View style={styles.badges}>
              <ModeBadge mode={t.mode} onDark />
              <StatusBadge status={t.status} onDark />
              {squad ? <Pill label="Registered" color={Colors.live} solid /> : null}
            </View>
            <AppText variant="display">{t.title}</AppText>
            <AppText variant="caption" color="rgba(255,255,255,0.9)">
              {MAP_LABEL[t.map]} · {formatDateTime(t.startsAt, new Date(now))}
            </AppText>
          </View>
        </LinearGradient>
      }>
      <View />
      {note ? (
        <AppText variant="caption" color={Colors.live} style={styles.center}>
          {note}
        </AppText>
      ) : null}

      {squad ? (
        <MySquadCard squad={squad} tournamentId={t.id} canWithdraw={t.status === 'OPEN'} />
      ) : null}

      <Card>
        <View style={styles.infoRow}>
          <Info
            icon="calendar-outline"
            label="Starts"
            value={formatDateTime(t.startsAt, new Date(now))}
          />
          <Info
            icon="timer-outline"
            label="Status"
            value={t.status === 'COMPLETED' ? 'Finished' : timeLabel(t, now)}
          />
        </View>
        <Divider />
        <View style={styles.infoRow}>
          <Info icon="location-outline" label="Map" value={MAP_LABEL[t.map]} />
          <Info
            icon="people-outline"
            label="Mode"
            value={t.mode === 'SOLO' ? 'Solo' : `${MODE_LABEL[t.mode]} of ${t.teamSize}`}
          />
        </View>
        <Divider />
        <View style={styles.slots}>
          <View style={styles.slotsRow}>
            <AppText variant="caption">
              {t.teamsRegistered}/{t.maxTeams} {teamWord(t)} registered
            </AppText>
            <AppText variant="caption" color={Colors.primary}>
              {t.teamsLeft} left
            </AppText>
          </View>
          <ProgressBar value={t.teamsRegistered / t.maxTeams} />
        </View>
      </Card>

      <Card>
        <SectionTitle title="Prizes" icon="trophy" />
        <View style={styles.infoRow}>
          <StatTile label="Prize pool" value={formatMoney(t.prizePool)} color={Colors.gold} />
          <StatTile label="Per kill" value={formatMoney(t.perKillReward)} />
          <StatTile label="Entry" value={formatEntry(t.entryFee)} color={Colors.live} />
        </View>
        <View style={styles.split}>
          {t.prizes.map((amount, i) => (
            <View key={i} style={styles.splitRow}>
              <AppText variant="bodyStrong" style={styles.flex}>
                {ordinal(i + 1)} place
              </AppText>
              <AppText variant="stat" color={Colors.gold}>
                {formatMoney(amount)}
              </AppText>
            </View>
          ))}
          {t.perKillReward > 0 ? (
            <AppText variant="caption">Plus {formatMoney(t.perKillReward)} for every kill.</AppText>
          ) : null}
        </View>
      </Card>

      {(squad || isAdmin) &&
      (t.status === 'OPEN' || t.status === 'LOCKED' || t.status === 'LIVE') ? (
        <RoomCard tournamentId={t.id} />
      ) : null}

      {t.status === 'COMPLETED' ? (
        <Card>
          <SectionTitle title="Leaderboard" icon="podium" />
          {leaderboard.isLoading ? (
            <ActivityIndicator color={Colors.primary} />
          ) : (
            <Leaderboard standings={leaderboard.data ?? []} mySquadId={squad?.id} />
          )}
        </Card>
      ) : null}

      {t.rules.length > 0 ? (
        <Card>
          <SectionTitle title="Rules" icon="document-text-outline" />
          {t.rules.map((rule, i) => (
            <View key={i} style={styles.ruleRow}>
              <View style={styles.ruleDot} />
              <AppText variant="caption" color={Colors.text} style={styles.flex}>
                {rule}
              </AppText>
            </View>
          ))}
        </Card>
      ) : null}

      <Card>
        <SectionTitle
          title={`Registered ${teamWord(t)}`}
          icon="people"
          right={<AppText variant="caption">{data.squads.length}</AppText>}
        />
        {data.squads.length === 0 ? (
          <AppText variant="caption">No one has registered yet. Be the first!</AppText>
        ) : null}
        <View style={styles.squadGrid}>
          {data.squads.map((s) => (
            <View
              key={s.slotNumber}
              style={[styles.squadChip, s.name === squad?.name && styles.squadChipMine]}>
              <AppText variant="caption" color={Colors.textFaint}>
                #{s.slotNumber}
              </AppText>
              <AppText variant="bodyStrong" numberOfLines={1}>
                {s.name}
              </AppText>
            </View>
          ))}
        </View>
        <View style={styles.privacyNote}>
          <Ionicons name="lock-closed" size={13} color={Colors.textFaint} />
          <AppText variant="caption" color={Colors.textFaint}>
            Only squad names are public. Members and numbers stay private.
          </AppText>
        </View>
      </Card>
    </Screen>
  );
}

function MySquadCard({
  squad,
  tournamentId,
  canWithdraw,
}: {
  squad: Squad;
  tournamentId: string;
  canWithdraw: boolean;
}) {
  const [reveal, setReveal] = useState(false);
  const withdraw = useWithdrawSquad(tournamentId);
  const isCaptain = squad.myRole === 'captain';

  const onWithdraw = async () => {
    const yes = await confirmAction({
      title: `Withdraw ${squad.name}?`,
      message: 'Your spot is released and your squad’s details are deleted.',
      confirmText: 'Withdraw',
      destructive: true,
    });
    if (yes) withdraw.mutate(undefined, { onSuccess: () => haptics.warning() });
  };

  return (
    <Card style={styles.mySquad}>
      <SectionTitle
        title={squad.name}
        icon="shield"
        right={<Pill label={isCaptain ? 'You’re captain' : 'You’re in'} color={Colors.live} />}
      />
      <AppText variant="caption">
        Team #{squad.slotNumber}
        {squad.placement ? ` · Finished ${ordinal(squad.placement)} with ${squad.kills} kills` : ''}
      </AppText>
      {squad.members.map((m) => (
        <View key={m.position} style={styles.member}>
          <View style={[styles.memberNumber, m.isCaptain && styles.captainNumber]}>
            <AppText style={styles.memberNumberText}>{m.position}</AppText>
          </View>
          <View style={styles.flex}>
            <AppText variant="bodyStrong">
              {m.name}
              {m.isMe ? '  (you)' : ''}
            </AppText>
            {m.phone ? (
              <AppText variant="caption">
                {reveal || m.isMe ? formatPhone(m.phone) : m.phoneMasked}
              </AppText>
            ) : (
              <AppText variant="caption" color={Colors.textFaint}>
                Number private
              </AppText>
            )}
          </View>
          {m.freeFireUid ? <AppText variant="caption">UID {m.freeFireUid}</AppText> : null}
        </View>
      ))}
      <View style={styles.squadActions}>
        {isCaptain ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => setReveal(!reveal)}
            style={styles.reveal}>
            <Ionicons
              name={reveal ? 'eye-off-outline' : 'eye-outline'}
              size={16}
              color={Colors.textMuted}
            />
            <AppText variant="caption">{reveal ? 'Hide numbers' : 'Show numbers'}</AppText>
          </Pressable>
        ) : (
          <View />
        )}
        {isCaptain && canWithdraw ? (
          <Button
            title="Withdraw"
            variant="danger"
            size="sm"
            onPress={onWithdraw}
            disabled={withdraw.isPending}
          />
        ) : null}
      </View>
    </Card>
  );
}

function Info({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <View style={styles.info}>
      <Ionicons name={icon} size={18} color={Colors.primary} />
      <View style={styles.flex}>
        <AppText variant="label">{label}</AppText>
        <AppText variant="bodyStrong">{value}</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  center: {
    textAlign: 'center',
  },
  loading: {
    marginTop: 60,
  },
  hero: {
    minHeight: 250,
    paddingHorizontal: 16,
    paddingBottom: 20,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  heroIcon: {
    position: 'absolute',
    right: -40,
    bottom: -40,
  },
  heroBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroButton: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderColor: 'rgba(255,255,255,0.2)',
  },
  heroContent: {
    gap: 6,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  badges: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  mySquad: {
    borderColor: `${Colors.live}66`,
  },
  member: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  memberNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceRaised,
  },
  captainNumber: {
    backgroundColor: Colors.primary,
  },
  memberNumberText: {
    fontWeight: '700',
    fontSize: 13,
  },
  squadActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reveal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 12,
  },
  info: {
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  slots: {
    gap: 6,
  },
  slotsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  split: {
    gap: 8,
    padding: 12,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceRaised,
  },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ruleRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  ruleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
    backgroundColor: Colors.primary,
  },
  squadGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  squadChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceRaised,
    maxWidth: '100%',
  },
  squadChipMine: {
    borderWidth: 1,
    borderColor: Colors.live,
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 46,
  },
});
