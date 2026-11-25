import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import type { SquadRole, Tournament } from '@/api/types';
import { MAP_LABEL } from '@/constants/config';
import { Colors, MapStyles, Radius } from '@/constants/theme';
import { formatDateTime, formatEntry, formatMoney } from '@/utils/format';
import { isRegistrationOpen, teamWord, timeLabel } from '@/utils/tournament';

import { AppText } from './ui/app-text';
import { ModeBadge, Pill, ProgressBar, StatusBadge } from './ui/badges';
import { Button, type ButtonProps } from './ui/button';
import { StatTile } from './ui/card';

export function TournamentCard({
  tournament: t,
  now,
  myRole,
  isAdmin,
  preview,
}: {
  tournament: Tournament;
  now: number;
  /** Set when the signed-in player is in a squad for this tournament. */
  myRole?: SquadRole;
  isAdmin?: boolean;
  /** Non-interactive (used for the create-tournament preview). */
  preview?: boolean;
}) {
  const router = useRouter();
  const map = MapStyles[t.map];
  const soon = t.status === 'OPEN' && new Date(t.startsAt).getTime() - now < 3_600_000;
  const open = () => router.push({ pathname: '/tournament/[id]', params: { id: t.id } });

  let action: ButtonProps;
  if (isAdmin) {
    action = {
      title: 'Manage',
      variant: 'secondary',
      icon: 'settings-outline',
      onPress: () => router.push({ pathname: '/admin/[id]', params: { id: t.id } }),
    };
  } else if (t.status === 'COMPLETED') {
    action = { title: 'Results', variant: 'secondary', icon: 'podium', onPress: open };
  } else if (myRole) {
    action = { title: 'Registered', variant: 'secondary', icon: 'checkmark-circle', onPress: open };
  } else if (isRegistrationOpen(t)) {
    action = {
      title: 'Register',
      icon: 'flash',
      onPress: () => router.push({ pathname: '/register/[id]', params: { id: t.id } }),
    };
  } else if (t.status === 'OPEN' && t.teamsLeft === 0) {
    action = { title: 'Full', disabled: true };
  } else {
    action = { title: 'View', variant: 'secondary', onPress: open };
  }

  return (
    <View style={[styles.card, preview && styles.noPointer]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t.title}, ${MAP_LABEL[t.map]}, prize pool ${formatMoney(t.prizePool)}`}
        onPress={open}
        disabled={preview}
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
            {myRole ? (
              <Pill
                label={myRole === 'captain' ? 'Your squad' : 'You’re in'}
                color={Colors.live}
                solid
              />
            ) : null}
          </View>
          <View>
            <AppText variant="title" numberOfLines={1}>
              {t.title}
            </AppText>
            <View style={styles.metaRow}>
              <Ionicons name="location-outline" size={13} color="rgba(255,255,255,0.85)" />
              <AppText variant="caption" color="rgba(255,255,255,0.85)">
                {MAP_LABEL[t.map]} · {formatDateTime(t.startsAt, new Date(now))}
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
            <StatTile label="Per kill" value={formatMoney(t.perKillReward)} icon="skull-outline" />
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
                {t.teamsRegistered}/{t.maxTeams} {teamWord(t)}
              </AppText>
              <AppText
                variant="caption"
                color={t.teamsLeft > 0 && t.teamsLeft <= 2 ? Colors.primary : Colors.textMuted}>
                {t.teamsLeft === 0
                  ? 'Full'
                  : `${t.teamsLeft} ${t.teamsLeft === 1 ? 'spot' : 'spots'} left`}
              </AppText>
            </View>
            <ProgressBar value={t.teamsRegistered / t.maxTeams} />
          </View>
        </View>
      </Pressable>

      <View style={styles.footer}>
        <View style={styles.metaRow}>
          <Ionicons
            name={t.status === 'LIVE' ? 'radio' : 'timer-outline'}
            size={15}
            color={t.status === 'LIVE' ? Colors.live : soon ? Colors.primary : Colors.textMuted}
          />
          <AppText
            variant="bodyStrong"
            color={t.status === 'LIVE' ? Colors.live : soon ? Colors.primary : Colors.textMuted}>
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
  noPointer: {
    pointerEvents: 'none',
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
    minWidth: 104,
  },
});
