import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { errorMessage } from '@/api/client';
import { useMyRegistrations, useTournaments } from '@/api/queries';
import type { Mode, Tournament } from '@/api/types';
import { useAuth } from '@/auth/auth-context';
import { Logo } from '@/components/brand';
import { TournamentCard } from '@/components/tournament-card';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Chip, ChipRow, SegmentedControl } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { WhatsAppChannelBanner } from '@/components/whatsapp';
import { MAP_LABEL, MODE_LABEL, MODES } from '@/constants/config';
import { Colors, Fonts, Gradients, ModeColors, Radius } from '@/constants/theme';
import { useNow } from '@/hooks/use-now';
import { formatMoney, initials } from '@/utils/format';
import { isRegistrationOpen, teamWord, timeLabel } from '@/utils/tournament';

export default function TournamentsScreen() {
  const router = useRouter();
  const now = useNow();
  const { user, isAdmin } = useAuth();
  const [scope, setScope] = useState<'active' | 'completed'>('active');
  const [mode, setMode] = useState<Mode | 'ALL'>('ALL');
  const active = useTournaments('active');
  const completed = useTournaments('completed');
  const { data: registrations } = useMyRegistrations();

  const roles = new Map((registrations ?? []).map((r) => [r.tournament.id, r.squad.myRole]));
  const query = scope === 'active' ? active : completed;
  const list = (query.data ?? []).filter((t) => mode === 'ALL' || t.mode === mode);
  const featured = (active.data ?? [])
    .filter((t) => isRegistrationOpen(t) && !roles.has(t.id))
    .sort((a, b) => b.prizePool - a.prizePool)[0];

  return (
    <Screen
      onRefresh={() => {
        void active.refetch();
        void completed.refetch();
      }}
      refreshing={active.isRefetching || completed.isRefetching}>
      <View style={styles.topBar}>
        <Logo size={34} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open your profile"
          onPress={() => router.navigate('/profile')}>
          <LinearGradient colors={Gradients.fire} style={styles.avatar}>
            <AppText style={styles.avatarText}>{initials(user?.displayName ?? '')}</AppText>
          </LinearGradient>
        </Pressable>
      </View>

      <View>
        <AppText variant="caption">Ready to drop,</AppText>
        <AppText variant="title" numberOfLines={1}>
          {user?.displayName}?
        </AppText>
      </View>

      {featured && !isAdmin ? <FeaturedCard tournament={featured} now={now} /> : null}

      <WhatsAppChannelBanner />

      <SegmentedControl
        value={scope}
        onChange={setScope}
        options={[
          { value: 'active', label: 'Upcoming & live', count: active.data?.length },
          { value: 'completed', label: 'Results', count: completed.data?.length },
        ]}
      />

      <ChipRow>
        <Chip
          label="All modes"
          selected={mode === 'ALL'}
          onPress={() => setMode('ALL')}
          icon="apps"
        />
        {MODES.map((m) => (
          <Chip
            key={m}
            label={MODE_LABEL[m]}
            selected={mode === m}
            onPress={() => setMode(m)}
            color={ModeColors[m]}
            icon={m === 'SOLO' ? 'person' : 'people'}
          />
        ))}
      </ChipRow>

      {query.isLoading ? (
        <ActivityIndicator color={Colors.primary} style={styles.loading} />
      ) : query.isError ? (
        <EmptyState
          icon="cloud-offline"
          title="Couldn't load tournaments"
          message={errorMessage(query.error)}
          actionLabel="Try again"
          onAction={() => void query.refetch()}
        />
      ) : list.length === 0 ? (
        <EmptyState
          icon={scope === 'active' ? 'trophy' : 'podium'}
          title={scope === 'active' ? 'No tournaments right now' : 'No results yet'}
          message={
            scope === 'active'
              ? 'New tournaments are announced here and on our WhatsApp Channel.'
              : 'Finished tournaments and their leaderboards show up here.'
          }
          actionLabel={isAdmin && scope === 'active' ? 'Create a tournament' : undefined}
          onAction={() => router.push('/admin/new')}
        />
      ) : (
        list.map((t) => (
          <TournamentCard
            key={t.id}
            tournament={t}
            now={now}
            myRole={roles.get(t.id)}
            isAdmin={isAdmin}
          />
        ))
      )}
    </Screen>
  );
}

function FeaturedCard({ tournament: t, now }: { tournament: Tournament; now: number }) {
  const router = useRouter();
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
        onPress={() => router.push({ pathname: '/tournament/[id]', params: { id: t.id } })}
        style={({ pressed }) => [styles.featuredInfo, pressed && styles.pressed]}>
        <View style={styles.featuredTag}>
          <Ionicons name="star" size={11} color={Colors.primary} />
          <AppText style={styles.featuredTagText}>Biggest prize</AppText>
        </View>
        <AppText variant="title" numberOfLines={1}>
          {t.title}
        </AppText>
        <AppText variant="caption" color="rgba(255,255,255,0.9)">
          {MODE_LABEL[t.mode]} · {MAP_LABEL[t.map]} · {timeLabel(t, now)}
        </AppText>
      </Pressable>
      <View style={styles.featuredBottom}>
        <View>
          <AppText variant="label" color="rgba(255,255,255,0.8)">
            Prize pool
          </AppText>
          <AppText style={styles.featuredPrize}>{formatMoney(t.prizePool)}</AppText>
          <AppText variant="caption" color="rgba(255,255,255,0.9)">
            Free entry · {t.teamsLeft} {teamWord(t, t.teamsLeft)} left
          </AppText>
        </View>
        <Button
          title="Register"
          variant="secondary"
          icon="flash"
          style={styles.featuredButton}
          onPress={() => router.push({ pathname: '/register/[id]', params: { id: t.id } })}
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
  loading: {
    marginTop: 40,
  },
  pressed: {
    opacity: 0.85,
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
