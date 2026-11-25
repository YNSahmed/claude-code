import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { useSettings, useTournaments } from '@/api/queries';
import { useAuth } from '@/auth/auth-context';
import { TournamentCard } from '@/components/tournament-card';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Card, SectionTitle, StatTile } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { Colors, Gradients, Radius, WhatsAppGreen, type IconName } from '@/constants/theme';
import { useNow } from '@/hooks/use-now';

/** The organizer's home: create and run tournaments, posters, the WhatsApp Channel and players. */
export default function OrganizerScreen() {
  const router = useRouter();
  const now = useNow();
  const { isAdmin } = useAuth();
  const active = useTournaments('active');
  const completed = useTournaments('completed');
  const { data: settings } = useSettings();

  if (!isAdmin)
    return (
      <EmptyState
        icon="lock-closed"
        title="Organizer only"
        message="This area is only for the tournament organizer."
      />
    );

  const live = active.data ?? [];
  const squads = live.reduce((sum, t) => sum + t.teamsRegistered, 0);

  return (
    <Screen
      onRefresh={() => {
        void active.refetch();
        void completed.refetch();
      }}
      refreshing={active.isRefetching}>
      <View style={styles.header}>
        <AppText variant="title">Organizer</AppText>
        <AppText variant="caption">
          Only you can see this. Run tournaments, make posters, check registrations.
        </AppText>
      </View>

      <LinearGradient colors={Gradients.night} style={styles.hero}>
        <View style={styles.stats}>
          <StatTile label="Running" value={String(live.length)} icon="flash-outline" />
          <StatTile
            label="Squads in"
            value={String(squads)}
            icon="people-outline"
            color={Colors.live}
          />
          <StatTile
            label="Finished"
            value={String(completed.data?.length ?? 0)}
            icon="checkmark-done"
          />
        </View>
        <Button
          title="Create tournament"
          icon="add-circle"
          size="lg"
          onPress={() => router.push('/admin/new')}
        />
      </LinearGradient>

      <View style={styles.actions}>
        <Action
          icon="logo-whatsapp"
          color={WhatsAppGreen}
          title="WhatsApp Channel"
          text={settings?.whatsappChannelUrl ? 'Linked · edit' : 'Add your channel link'}
          href="/admin/settings"
        />
        <Action
          icon="people"
          color={Colors.info}
          title="Players"
          text="Search accounts"
          href="/admin/players"
        />
      </View>

      <SectionTitle title="Running tournaments" icon="flag" />
      {live.length === 0 ? (
        <Card>
          <AppText variant="caption">
            Nothing running. Create a tournament, then share its poster on your channel.
          </AppText>
        </Card>
      ) : (
        live.map((t) => <TournamentCard key={t.id} tournament={t} now={now} isAdmin />)
      )}

      {(completed.data ?? []).length > 0 ? (
        <>
          <SectionTitle title="Finished" icon="checkmark-done" />
          {(completed.data ?? []).map((t) => (
            <TournamentCard key={t.id} tournament={t} now={now} isAdmin />
          ))}
        </>
      ) : null}
    </Screen>
  );
}

function Action({
  icon,
  color,
  title,
  text,
  href,
}: {
  icon: IconName;
  color: string;
  title: string;
  text: string;
  href: Href;
}) {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(href)}
      style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
      <View style={[styles.actionIcon, { backgroundColor: `${color}22` }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <AppText variant="bodyStrong">{title}</AppText>
      <AppText variant="caption">{text}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 8,
    gap: 2,
  },
  hero: {
    borderRadius: Radius.xl,
    padding: 18,
    gap: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  stats: {
    flexDirection: 'row',
    gap: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  action: {
    flex: 1,
    gap: 4,
    padding: 14,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  pressed: {
    opacity: 0.85,
  },
});
