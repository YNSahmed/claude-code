import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Leaderboard } from '@/components/leaderboard';
import { RoomCard } from '@/components/room-card';
import { timeLabel } from '@/components/tournament-card';
import { AppText } from '@/components/ui/app-text';
import { ModeBadge, Pill, ProgressBar, StatusBadge } from '@/components/ui/badges';
import { Button, IconButton } from '@/components/ui/button';
import { Card, Divider, SectionTitle, StatTile } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen, ScreenHeader, useGoBack } from '@/components/ui/screen';
import { PRIZE_SPLIT, TEAM_SIZE } from '@/constants/config';
import { Colors, MapStyles, Radius, type IconName } from '@/constants/theme';
import { useStore, useTournament } from '@/data/store';
import { useNow } from '@/hooks/use-now';
import { confirmAction, haptics, shareText } from '@/utils/device';
import { formatDateTime, formatEntry, formatMoney, ordinal } from '@/utils/format';
import {
  findRegistration,
  inviteMessage,
  isFull,
  prizeForPlacement,
  slotsLeft,
} from '@/utils/tournament';

const TEAMS_PREVIEW = 8;

export default function TournamentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTournament(id);
  const { profile, leaveTournament } = useStore();
  const router = useRouter();
  const goBack = useGoBack();
  const insets = useSafeAreaInsets();
  const now = useNow();
  const [showAllTeams, setShowAllTeams] = useState(false);
  const [shareNote, setShareNote] = useState<string | null>(null);

  if (!t) {
    return (
      <Screen header={<ScreenHeader title="Tournament" />} bottomInset>
        <EmptyState
          icon="search"
          title="Tournament not found"
          message="It may have been deleted by the organizer."
          actionLabel="Back to tournaments"
          onAction={() => router.replace('/')}
        />
      </Screen>
    );
  }

  const mine = findRegistration(t, profile?.id);
  const isHost = t.hostId === profile?.id;
  const map = MapStyles[t.map];
  const teams = showAllTeams ? t.registrations : t.registrations.slice(0, TEAMS_PREVIEW);

  const share = async () => {
    const how = await shareText(inviteMessage(t));
    setShareNote(how === 'copied' ? 'Invite copied — paste it in your group chat.' : null);
  };

  const leave = async () => {
    const yes = await confirmAction({
      title: 'Leave this tournament?',
      message: 'Your slot will be given up and your team removed.',
      confirmText: 'Leave',
      destructive: true,
    });
    if (yes && leaveTournament(t.id).ok) haptics.warning();
  };

  let footer: ReactNode;
  if (isHost) {
    footer = (
      <Button
        title="Manage tournament"
        icon="settings-outline"
        size="lg"
        onPress={() => router.push({ pathname: '/host/[id]', params: { id: t.id } })}
      />
    );
  } else if (mine && t.status === 'upcoming') {
    footer = (
      <View style={styles.footerRow}>
        <View style={styles.joinedNote}>
          <Ionicons name="checkmark-circle" size={22} color={Colors.live} />
          <AppText variant="bodyStrong">You&apos;re in!</AppText>
        </View>
        <Button title="Leave" variant="danger" size="md" onPress={leave} style={styles.leave} />
      </View>
    );
  } else if (t.status === 'upcoming' && !mine) {
    footer = isFull(t) ? (
      <Button title="All slots taken" size="lg" disabled />
    ) : (
      <Button
        title={`Join now · ${formatEntry(t.entryFee)}`}
        icon="flash"
        size="lg"
        onPress={() =>
          router.push({ pathname: '/join/[id]', params: { id: t.id, from: 'details' } })
        }
      />
    );
  }

  return (
    <Screen
      header={null}
      bottomInset={!footer}
      footer={footer}
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
              {mine ? <Pill label="Joined" color={Colors.live} solid /> : null}
            </View>
            <AppText variant="display">{t.title}</AppText>
            <AppText variant="caption" color="rgba(255,255,255,0.9)">
              Hosted by {isHost ? 'you' : t.hostName}
            </AppText>
          </View>
        </LinearGradient>
      }>
      <View style={styles.spacer} />

      {shareNote ? (
        <AppText variant="caption" color={Colors.live} style={styles.center}>
          {shareNote}
        </AppText>
      ) : null}

      {mine ? (
        <Card style={styles.joinedCard}>
          <SectionTitle
            title={t.status === 'completed' ? 'Your team' : "You're registered"}
            icon="shield-checkmark"
          />
          <AppText variant="bodyStrong">{mine.teamName}</AppText>
          {mine.players.map((p, i) => (
            <View key={p.uid} style={styles.playerRow}>
              <AppText variant="caption" style={styles.playerIndex}>
                {i + 1}
              </AppText>
              <AppText style={styles.flex}>{p.ign}</AppText>
              <AppText variant="caption">UID {p.uid}</AppText>
            </View>
          ))}
        </Card>
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
            value={t.status === 'completed' ? 'Finished' : timeLabel(t, now)}
          />
        </View>
        <Divider />
        <View style={styles.infoRow}>
          <Info icon="location-outline" label="Map" value={t.map} />
          <Info
            icon="people-outline"
            label="Mode"
            value={t.mode === 'Solo' ? 'Solo' : `${t.mode} of ${TEAM_SIZE[t.mode]}`}
          />
        </View>
        <Divider />
        <View style={styles.slots}>
          <View style={styles.slotsRow}>
            <AppText variant="caption">
              {t.registrations.length}/{t.maxTeams} {t.mode === 'Solo' ? 'players' : 'teams'}{' '}
              registered
            </AppText>
            <AppText variant="caption" color={Colors.primary}>
              {slotsLeft(t)} left
            </AppText>
          </View>
          <ProgressBar value={t.registrations.length / t.maxTeams} />
        </View>
      </Card>

      <Card>
        <SectionTitle title="Prizes" icon="trophy" />
        <View style={styles.infoRow}>
          <StatTile label="Prize pool" value={formatMoney(t.prizePool)} color={Colors.gold} />
          <StatTile label="Per kill" value={formatMoney(t.perKill)} />
          <StatTile
            label="Entry"
            value={formatEntry(t.entryFee)}
            color={t.entryFee === 0 ? Colors.live : undefined}
          />
        </View>
        <View style={styles.split}>
          {PRIZE_SPLIT.map((_, i) => (
            <View key={i} style={styles.splitRow}>
              <AppText variant="bodyStrong" style={styles.flex}>
                {ordinal(i + 1)} place
              </AppText>
              <AppText variant="stat" color={Colors.gold}>
                {formatMoney(prizeForPlacement(t, i + 1))}
              </AppText>
            </View>
          ))}
          <AppText variant="caption">Plus {formatMoney(t.perKill)} for every kill.</AppText>
        </View>
      </Card>

      {t.status !== 'completed' ? <RoomCard tournament={t} unlocked={!!mine || isHost} /> : null}

      {t.status === 'completed' && t.results.length > 0 ? (
        <Card>
          <SectionTitle title="Leaderboard" icon="podium" />
          <Leaderboard tournament={t} userId={profile?.id} />
        </Card>
      ) : null}

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

      <Card>
        <SectionTitle
          title={t.mode === 'Solo' ? 'Players' : 'Teams'}
          icon="people"
          right={<AppText variant="caption">{t.registrations.length}</AppText>}
        />
        {t.registrations.length === 0 ? (
          <AppText variant="caption">Nobody has joined yet. Be the first!</AppText>
        ) : null}
        {teams.map((r, i) => (
          <View key={r.id} style={styles.teamRow}>
            <AppText variant="caption" style={styles.playerIndex}>
              {i + 1}
            </AppText>
            <View style={styles.flex}>
              <AppText variant="bodyStrong" numberOfLines={1}>
                {r.teamName}
                {r.userId === profile?.id ? '  (you)' : ''}
              </AppText>
              {t.mode !== 'Solo' ? (
                <AppText variant="caption" numberOfLines={1}>
                  {r.players.map((p) => p.ign).join(' · ')}
                </AppText>
              ) : null}
            </View>
          </View>
        ))}
        {t.registrations.length > TEAMS_PREVIEW ? (
          <Button
            title={showAllTeams ? 'Show less' : `Show all ${t.registrations.length}`}
            variant="ghost"
            size="sm"
            onPress={() => setShowAllTeams(!showAllTeams)}
          />
        ) : null}
      </Card>
    </Screen>
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
  spacer: {
    height: 0,
  },
  joinedCard: {
    borderColor: `${Colors.live}66`,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  playerIndex: {
    width: 18,
    textAlign: 'center',
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
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 2,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  joinedNote: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  leave: {
    minWidth: 110,
  },
});
