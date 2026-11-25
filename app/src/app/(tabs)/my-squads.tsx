import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { errorMessage } from '@/api/client';
import { useMyRegistrations } from '@/api/queries';
import type { Registration } from '@/api/types';
import { RoomCard } from '@/components/room-card';
import { AppText } from '@/components/ui/app-text';
import { ModeBadge, Pill, StatusBadge } from '@/components/ui/badges';
import { SectionTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { WhatsAppChannelBanner } from '@/components/whatsapp';
import { MAP_LABEL } from '@/constants/config';
import { Colors, Fonts, MapStyles, Radius } from '@/constants/theme';
import { useNow } from '@/hooks/use-now';
import { formatDateTime, formatMoney, ordinal } from '@/utils/format';
import { timeLabel } from '@/utils/tournament';

export default function MySquadsScreen() {
  const router = useRouter();
  const { data, isLoading, isError, error, refetch, isRefetching } = useMyRegistrations();
  const active = (data ?? []).filter((r) =>
    ['OPEN', 'LOCKED', 'LIVE'].includes(r.tournament.status)
  );
  const past = (data ?? []).filter(
    (r) => !['OPEN', 'LOCKED', 'LIVE'].includes(r.tournament.status)
  );

  return (
    <Screen onRefresh={() => void refetch()} refreshing={isRefetching}>
      <View style={styles.header}>
        <AppText variant="title">My Squads</AppText>
        <AppText variant="caption">Your squads, room details and results.</AppText>
      </View>

      {isLoading ? <ActivityIndicator color={Colors.primary} style={styles.loading} /> : null}
      {isError ? (
        <EmptyState
          icon="cloud-offline"
          title="Couldn't load your squads"
          message={errorMessage(error)}
          actionLabel="Try again"
          onAction={() => void refetch()}
        />
      ) : null}
      {!isLoading && !isError && (data ?? []).length === 0 ? (
        <EmptyState
          icon="people"
          title="No squads yet"
          message="Register your squad for a tournament. If your captain added your number, you'll see the squad here too."
          actionLabel="Browse tournaments"
          onAction={() => router.navigate('/')}
        />
      ) : null}

      {active.length > 0 ? (
        <>
          <SectionTitle title="Up next" icon="flash" />
          {active.map((r) => (
            <Ticket key={r.squad.id} registration={r} />
          ))}
        </>
      ) : null}

      {past.length > 0 ? (
        <>
          <SectionTitle title="Past tournaments" icon="time-outline" />
          {past.map((r) => (
            <PastRow key={r.squad.id} registration={r} />
          ))}
        </>
      ) : null}

      <WhatsAppChannelBanner compact />
    </Screen>
  );
}

function Ticket({ registration: { tournament: t, squad } }: { registration: Registration }) {
  const router = useRouter();
  const now = useNow();
  return (
    <View style={styles.ticket}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${t.title}`}
        onPress={() => router.push({ pathname: '/tournament/[id]', params: { id: t.id } })}
        style={({ pressed }) => pressed && styles.pressed}>
        <LinearGradient
          colors={MapStyles[t.map].gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.ticketTop}>
          <View style={styles.badges}>
            <ModeBadge mode={t.mode} onDark />
            <StatusBadge status={t.status} onDark />
            <Pill
              label={squad.myRole === 'captain' ? 'Captain' : 'Member'}
              color={Colors.gold}
              solid
            />
          </View>
          <AppText variant="heading" numberOfLines={1}>
            {t.title}
          </AppText>
          <AppText variant="caption" color="rgba(255,255,255,0.9)">
            {MAP_LABEL[t.map]} · {timeLabel(t, now)}
          </AppText>
        </LinearGradient>
      </Pressable>
      <View style={styles.perforation} />
      <View style={styles.ticketBody}>
        <View style={styles.teamRow}>
          <Ionicons name="shield" size={16} color={Colors.primary} />
          <AppText variant="bodyStrong" style={styles.flex} numberOfLines={1}>
            {squad.name}
          </AppText>
          <AppText variant="caption">Team #{squad.slotNumber}</AppText>
        </View>
        <RoomCard tournamentId={t.id} compact />
      </View>
    </View>
  );
}

function PastRow({ registration: { tournament: t, squad } }: { registration: Registration }) {
  const router = useRouter();
  const prize = squad.placement
    ? (t.prizes[squad.placement - 1] ?? 0) + (squad.kills ?? 0) * t.perKillReward
    : 0;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/tournament/[id]', params: { id: t.id } })}
      style={({ pressed }) => [styles.pastRow, pressed && styles.pressed]}>
      <View style={[styles.placement, squad.placement === 1 && styles.placementWin]}>
        <AppText
          style={[styles.placementText, squad.placement === 1 && { color: Colors.background }]}>
          {squad.placement ? ordinal(squad.placement) : '—'}
        </AppText>
      </View>
      <View style={styles.flex}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {t.title}
        </AppText>
        <AppText variant="caption">
          {squad.name} ·{' '}
          {t.status === 'CANCELLED'
            ? 'Cancelled'
            : `${squad.kills ?? 0} kills · ${formatDateTime(t.startsAt)}`}
        </AppText>
      </View>
      <AppText style={[styles.prize, { color: prize > 0 ? Colors.gold : Colors.textFaint }]}>
        {prize > 0 ? formatMoney(prize) : '—'}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 8,
    gap: 2,
  },
  loading: {
    marginTop: 40,
  },
  flex: {
    flex: 1,
  },
  pressed: {
    opacity: 0.88,
  },
  ticket: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  ticketTop: {
    padding: 14,
    gap: 4,
  },
  badges: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 4,
  },
  perforation: {
    borderTopWidth: 2,
    borderStyle: 'dashed',
    borderColor: Colors.border,
  },
  ticketBody: {
    padding: 14,
    gap: 12,
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pastRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  placement: {
    width: 46,
    height: 46,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceRaised,
  },
  placementWin: {
    backgroundColor: Colors.gold,
  },
  placementText: {
    fontFamily: Fonts.display,
    fontSize: 17,
    color: Colors.text,
  },
  prize: {
    fontFamily: Fonts.display,
    fontSize: 17,
  },
});
