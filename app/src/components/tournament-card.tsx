import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Colors, MapStyles, Radius } from '@/constants/theme';
import type { Tournament } from '@/data/types';
import { formatCountdown, formatDateTime, formatEntry, formatMoney } from '@/utils/format';
import { findRegistration, isFull, slotsLeft } from '@/utils/tournament';

import { AppText } from './ui/app-text';
import { ModeBadge, Pill, ProgressBar, StatusBadge } from './ui/badges';
import { Button, type ButtonProps } from './ui/button';
import { StatTile } from './ui/card';

export function timeLabel(t: Tournament, now: number): string {
  if (t.status === 'live') return 'Live now';
  if (t.status === 'completed') return formatDateTime(t.startsAt, new Date(now));
  const msLeft = new Date(t.startsAt).getTime() - now;
  if (msLeft <= 0) return 'Starting now';
  if (msLeft < 86_400_000) return `Starts in ${formatCountdown(t.startsAt, now)}`;
  return formatDateTime(t.startsAt, new Date(now));
}

export function TournamentCard({
  tournament: t,
  userId,
  now,
}: {
  tournament: Tournament;
  userId?: string;
  now: number;
}) {
  const router = useRouter();
  const mine = findRegistration(t, userId);
  const isHost = t.hostId === userId;
  const left = slotsLeft(t);
  const map = MapStyles[t.map];
  const soon = t.status === 'upcoming' && new Date(t.startsAt).getTime() - now < 3_600_000;

  const open = () => router.push({ pathname: '/tournament/[id]', params: { id: t.id } });

  let action: ButtonProps;
  if (isHost) {
    action = {
      title: 'Manage',
      variant: 'secondary',
      icon: 'settings-outline',
      onPress: () => router.push({ pathname: '/host/[id]', params: { id: t.id } }),
    };
  } else if (t.status === 'completed') {
    action = { title: 'Results', variant: 'secondary', icon: 'podium', onPress: open };
  } else if (mine) {
    action = {
      title: t.room ? 'Room ID' : 'Joined',
      variant: 'secondary',
      icon: t.room ? 'key-outline' : 'checkmark-circle',
      onPress: open,
    };
  } else if (t.status === 'live') {
    action = { title: 'View', variant: 'secondary', onPress: open };
  } else if (isFull(t)) {
    action = { title: 'Full', disabled: true };
  } else {
    action = {
      title: 'Join',
      icon: 'flash',
      onPress: () => router.push({ pathname: '/join/[id]', params: { id: t.id } }),
    };
  }

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t.title}, ${t.mode} on ${t.map}, prize pool ${formatMoney(t.prizePool)}`}
        onPress={open}
        style={({ pressed }) => pressed && styles.pressed}>
        <LinearGradient
          colors={map.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.banner}>
          <Ionicons
            name={map.icon}
            size={130}
            color="rgba(255,255,255,0.13)"
            style={styles.bannerIcon}
          />
          <View style={styles.badges}>
            <ModeBadge mode={t.mode} onDark />
            <StatusBadge status={t.status} onDark />
            {mine ? <Pill label="Joined" color={Colors.live} solid /> : null}
            {isHost ? <Pill label="Hosting" color={Colors.gold} solid /> : null}
          </View>
          <View>
            <AppText variant="title" numberOfLines={1}>
              {t.title}
            </AppText>
            <View style={styles.metaRow}>
              <Ionicons name="location-outline" size={13} color="rgba(255,255,255,0.85)" />
              <AppText variant="caption" color="rgba(255,255,255,0.85)">
                {t.map} · {formatDateTime(t.startsAt, new Date(now))}
              </AppText>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.bodyTop}>
          <View style={styles.stats}>
            <StatTile
              label="Prize pool"
              value={formatMoney(t.prizePool)}
              color={Colors.gold}
              icon="trophy-outline"
            />
            <StatTile label="Per kill" value={formatMoney(t.perKill)} icon="skull-outline" />
            <StatTile
              label="Entry"
              value={formatEntry(t.entryFee)}
              color={t.entryFee === 0 ? Colors.live : undefined}
              icon="ticket-outline"
            />
          </View>

          <View style={styles.slots}>
            <View style={styles.slotsRow}>
              <AppText variant="caption">
                {t.registrations.length}/{t.maxTeams} {t.mode === 'Solo' ? 'players' : 'teams'}
              </AppText>
              <AppText
                variant="caption"
                color={left > 0 && left <= 3 ? Colors.primary : Colors.textMuted}>
                {left === 0 ? 'Slots full' : `${left} ${left === 1 ? 'slot' : 'slots'} left`}
              </AppText>
            </View>
            <ProgressBar value={t.registrations.length / t.maxTeams} />
          </View>
        </View>
      </Pressable>

      <View style={styles.footer}>
        <View style={styles.metaRow}>
          <Ionicons
            name={t.status === 'live' ? 'radio' : 'timer-outline'}
            size={15}
            color={t.status === 'live' ? Colors.live : soon ? Colors.primary : Colors.textMuted}
          />
          <AppText
            variant="bodyStrong"
            color={t.status === 'live' ? Colors.live : soon ? Colors.primary : Colors.textMuted}>
            {timeLabel(t, now)}
          </AppText>
        </View>
        <Button size="sm" {...action} style={styles.action} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pressed: {
    opacity: 0.85,
  },
  banner: {
    height: 128,
    padding: 14,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  bannerIcon: {
    position: 'absolute',
    right: -18,
    top: -10,
  },
  badges: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 1,
  },
  bodyTop: {
    paddingHorizontal: 14,
    paddingTop: 14,
    gap: 14,
  },
  stats: {
    flexDirection: 'row',
    gap: 12,
  },
  slots: {
    gap: 6,
  },
  slotsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 14,
  },
  action: {
    minWidth: 96,
  },
});
