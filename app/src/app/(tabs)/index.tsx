import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Logo } from '@/components/brand';
import { TournamentCard, timeLabel } from '@/components/tournament-card';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Chip, ChipRow, SegmentedControl } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { MODES } from '@/constants/config';
import { Colors, Fonts, Gradients, ModeColors, Radius } from '@/constants/theme';
import { useStore } from '@/data/store';
import type { Mode, Tournament, TournamentStatus } from '@/data/types';
import { useNow } from '@/hooks/use-now';
import { formatMoney, initials } from '@/utils/format';
import { byStartTime, canJoin, findRegistration, slotsLeft } from '@/utils/tournament';

const EMPTY_COPY: Record<TournamentStatus, { title: string; message: string }> = {
  upcoming: {
    title: 'No open tournaments',
    message: 'New tournaments show up here. Want to run one yourself? Head to the Host tab.',
  },
  live: {
    title: 'Nothing live right now',
    message: 'Matches appear here while they are being played.',
  },
  completed: {
    title: 'No results yet',
    message: 'Finished tournaments and their leaderboards show up here.',
  },
};

export default function TournamentsScreen() {
  const { tournaments, profile } = useStore();
  const router = useRouter();
  const now = useNow();
  const [status, setStatus] = useState<TournamentStatus>('upcoming');
  const [mode, setMode] = useState<Mode | 'All'>('All');

  const count = (s: TournamentStatus) => tournaments.filter((t) => t.status === s).length;
  const list = tournaments
    .filter((t) => t.status === status && (mode === 'All' || t.mode === mode))
    .sort((a, b) => (status === 'completed' ? byStartTime(b, a) : byStartTime(a, b)));

  const featured = tournaments
    .filter((t) => canJoin(t, profile?.id))
    .sort((a, b) => b.prizePool - a.prizePool)[0];

  return (
    <Screen>
      <View style={styles.topBar}>
        <Logo size={34} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open your profile"
          onPress={() => router.navigate('/profile')}
          style={({ pressed }) => pressed && styles.pressed}>
          <LinearGradient colors={Gradients.fire} style={styles.avatar}>
            <AppText style={styles.avatarText}>{initials(profile?.ign ?? '')}</AppText>
          </LinearGradient>
        </Pressable>
      </View>

      <View>
        <AppText variant="caption">Ready to drop,</AppText>
        <AppText variant="title" numberOfLines={1}>
          {profile?.ign}?
        </AppText>
      </View>

      {featured ? <FeaturedCard tournament={featured} now={now} /> : null}

      <SegmentedControl
        value={status}
        onChange={setStatus}
        options={[
          { value: 'upcoming', label: 'Upcoming', count: count('upcoming') },
          { value: 'live', label: 'Live', count: count('live') },
          { value: 'completed', label: 'Results', count: count('completed') },
        ]}
      />

      <ChipRow>
        <Chip
          label="All modes"
          selected={mode === 'All'}
          onPress={() => setMode('All')}
          icon="apps"
        />
        {MODES.map((m) => (
          <Chip
            key={m}
            label={m}
            selected={mode === m}
            onPress={() => setMode(m)}
            color={ModeColors[m]}
            icon={m === 'Solo' ? 'person' : 'people'}
          />
        ))}
      </ChipRow>

      {list.length > 0 ? (
        list.map((t) => <TournamentCard key={t.id} tournament={t} userId={profile?.id} now={now} />)
      ) : (
        <EmptyState
          icon={status === 'live' ? 'radio' : status === 'completed' ? 'podium' : 'trophy'}
          title={EMPTY_COPY[status].title}
          message={EMPTY_COPY[status].message}
          actionLabel={status === 'upcoming' ? 'Host a tournament' : undefined}
          onAction={() => router.push('/host/new')}
        />
      )}
    </Screen>
  );
}

function FeaturedCard({ tournament: t, now }: { tournament: Tournament; now: number }) {
  const router = useRouter();
  const { profile } = useStore();
  const joined = !!findRegistration(t, profile?.id);
  const left = slotsLeft(t);

  const openDetails = () => router.push({ pathname: '/tournament/[id]', params: { id: t.id } });

  return (
    <LinearGradient
      colors={Gradients.fire}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.featured}>
      <Ionicons
        name="trophy"
        size={150}
        color="rgba(255,255,255,0.14)"
        style={styles.featuredIcon}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Featured: ${t.title}`}
        onPress={openDetails}
        style={({ pressed }) => [styles.featuredInfo, pressed && styles.pressed]}>
        <View style={styles.featuredTag}>
          <Ionicons name="star" size={11} color={Colors.primary} />
          <AppText style={styles.featuredTagText}>Biggest prize</AppText>
        </View>
        <AppText variant="title" numberOfLines={1}>
          {t.title}
        </AppText>
        <AppText variant="caption" color="rgba(255,255,255,0.9)">
          {t.mode} · {t.map} · {timeLabel(t, now)}
        </AppText>
      </Pressable>
      <View style={styles.featuredBottom}>
        <View>
          <AppText variant="label" color="rgba(255,255,255,0.8)">
            Prize pool
          </AppText>
          <AppText style={styles.featuredPrize}>{formatMoney(t.prizePool)}</AppText>
          <AppText variant="caption" color="rgba(255,255,255,0.9)">
            {left} {left === 1 ? 'slot' : 'slots'} left
          </AppText>
        </View>
        <Button
          title={joined ? 'View' : 'Join now'}
          variant="secondary"
          icon={joined ? 'eye-outline' : 'flash'}
          style={styles.featuredButton}
          onPress={() =>
            joined ? openDetails() : router.push({ pathname: '/join/[id]', params: { id: t.id } })
          }
        />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: Fonts.display,
    fontSize: 16,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  featured: {
    borderRadius: Radius.xl,
    padding: 18,
    gap: 4,
    overflow: 'hidden',
  },
  featuredInfo: {
    gap: 4,
  },
  featuredIcon: {
    position: 'absolute',
    right: -20,
    bottom: -24,
  },
  featuredTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    backgroundColor: Colors.text,
    marginBottom: 6,
  },
  featuredTagText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: Colors.primary,
  },
  featuredBottom: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 12,
    gap: 12,
  },
  featuredPrize: {
    fontFamily: Fonts.display,
    fontSize: 38,
    lineHeight: 42,
  },
  featuredButton: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderColor: 'rgba(255,255,255,0.35)',
  },
});
