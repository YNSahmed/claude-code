import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { CopyField } from '@/components/room-card';
import { timeLabel } from '@/components/tournament-card';
import { AppText } from '@/components/ui/app-text';
import { ModeBadge, StatusBadge } from '@/components/ui/badges';
import { SectionTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { Colors, Fonts, MapStyles, Radius } from '@/constants/theme';
import { useStore } from '@/data/store';
import type { Registration, Tournament } from '@/data/types';
import { useNow } from '@/hooks/use-now';
import { formatDateTime, formatMoney, ordinal } from '@/utils/format';
import { byStartTime, earningsFor, findRegistration } from '@/utils/tournament';

export default function MyMatchesScreen() {
  const { tournaments, profile } = useStore();
  const router = useRouter();
  const now = useNow();

  const mine = tournaments.flatMap((t) => {
    const registration = findRegistration(t, profile?.id);
    return registration ? [{ t, registration }] : [];
  });
  const active = mine
    .filter(({ t }) => t.status !== 'completed')
    .sort((a, b) => byStartTime(a.t, b.t));
  const past = mine
    .filter(({ t }) => t.status === 'completed')
    .sort((a, b) => byStartTime(b.t, a.t));

  return (
    <Screen>
      <View style={styles.header}>
        <AppText variant="title">My Matches</AppText>
        <AppText variant="caption">Your tickets, room details and results in one place.</AppText>
      </View>

      {mine.length === 0 ? (
        <EmptyState
          icon="game-controller"
          title="No matches yet"
          message="Join a tournament and your match ticket, room ID and password will show up here."
          actionLabel="Browse tournaments"
          onAction={() => router.navigate('/')}
        />
      ) : null}

      {active.length > 0 ? (
        <>
          <SectionTitle title="Up next" icon="flash" />
          {active.map(({ t, registration }) => (
            <MatchTicket key={t.id} tournament={t} registration={registration} now={now} />
          ))}
        </>
      ) : null}

      {past.length > 0 ? (
        <>
          <SectionTitle title="Past matches" icon="time-outline" />
          {past.map(({ t, registration }) => (
            <PastMatchRow key={t.id} tournament={t} registration={registration} />
          ))}
        </>
      ) : null}
    </Screen>
  );
}

function MatchTicket({
  tournament: t,
  registration,
  now,
}: {
  tournament: Tournament;
  registration: Registration;
  now: number;
}) {
  const router = useRouter();
  const map = MapStyles[t.map];

  return (
    <View style={styles.ticket}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${t.title}`}
        onPress={() => router.push({ pathname: '/tournament/[id]', params: { id: t.id } })}
        style={({ pressed }) => pressed && styles.pressed}>
        <LinearGradient
          colors={map.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.ticketTop}>
          <View style={styles.badges}>
            <ModeBadge mode={t.mode} onDark />
            <StatusBadge status={t.status} onDark />
          </View>
          <AppText variant="heading" numberOfLines={1}>
            {t.title}
          </AppText>
          <AppText variant="caption" color="rgba(255,255,255,0.9)">
            {t.map} · {timeLabel(t, now)}
          </AppText>
        </LinearGradient>
      </Pressable>
      <View style={styles.perforation} />
      <View style={styles.ticketBody}>
        <View style={styles.teamRow}>
          <Ionicons
            name={t.mode === 'Solo' ? 'person' : 'people'}
            size={16}
            color={Colors.textMuted}
          />
          <AppText variant="bodyStrong" style={styles.flex} numberOfLines={1}>
            {registration.teamName}
          </AppText>
        </View>
        {t.room ? (
          <View style={styles.roomRow}>
            <CopyField label="Room ID" value={t.room.id} />
            <CopyField label="Password" value={t.room.password} />
          </View>
        ) : (
          <View style={styles.waiting}>
            <Ionicons name="time-outline" size={16} color={Colors.textMuted} />
            <AppText variant="caption" style={styles.flex}>
              Room ID and password will appear here before the match.
            </AppText>
          </View>
        )}
      </View>
    </View>
  );
}

function PastMatchRow({
  tournament: t,
  registration,
}: {
  tournament: Tournament;
  registration: Registration;
}) {
  const router = useRouter();
  const result = t.results.find((r) => r.registrationId === registration.id);
  const earnings = result ? earningsFor(t, result) : 0;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/tournament/[id]', params: { id: t.id } })}
      style={({ pressed }) => [styles.pastRow, pressed && styles.pressed]}>
      <View style={[styles.placement, result?.placement === 1 && styles.placementWin]}>
        <AppText
          style={[styles.placementText, result?.placement === 1 && { color: Colors.background }]}>
          {result ? ordinal(result.placement) : '—'}
        </AppText>
      </View>
      <View style={styles.flex}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {t.title}
        </AppText>
        <AppText variant="caption">
          {formatDateTime(t.startsAt)} · {result?.kills ?? 0} kills
        </AppText>
      </View>
      <AppText style={[styles.earned, { color: earnings > 0 ? Colors.gold : Colors.textFaint }]}>
        {earnings > 0 ? `+${formatMoney(earnings)}` : '—'}
      </AppText>
    </Pressable>
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
  pressed: {
    opacity: 0.9,
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
    height: 0,
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
  roomRow: {
    gap: 8,
  },
  waiting: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceRaised,
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
  earned: {
    fontFamily: Fonts.display,
    fontSize: 17,
  },
});
