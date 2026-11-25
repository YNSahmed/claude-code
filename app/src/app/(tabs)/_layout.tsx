import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router/js-tabs';
import type { ColorValue } from 'react-native';

import { useMyRegistrations } from '@/api/queries';
import { useAuth } from '@/auth/auth-context';
import { Colors, Fonts, type IconName } from '@/constants/theme';

function tabIcon(active: IconName, inactive: IconName) {
  function TabIcon({
    focused,
    color,
    size,
  }: {
    focused: boolean;
    color: ColorValue;
    size: number;
  }) {
    return (
      <Ionicons
        name={focused ? active : inactive}
        size={size}
        color={typeof color === 'string' ? color : undefined}
      />
    );
  }
  return TabIcon;
}

const icons = {
  tournaments: tabIcon('trophy', 'trophy-outline'),
  squads: tabIcon('people', 'people-outline'),
  organizer: tabIcon('shield-checkmark', 'shield-checkmark-outline'),
  profile: tabIcon('person-circle', 'person-circle-outline'),
};

export default function TabLayout() {
  const { isAdmin } = useAuth();
  const { data: registrations } = useMyRegistrations();
  const upcoming = (registrations ?? []).filter((r) =>
    ['OPEN', 'LOCKED', 'LIVE'].includes(r.tournament.status)
  ).length;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textFaint,
        tabBarStyle: { backgroundColor: Colors.surface, borderTopColor: Colors.border },
        tabBarLabelStyle: { fontFamily: Fonts.displaySemi, fontSize: 13 },
        tabBarBadgeStyle: { backgroundColor: Colors.primary, color: Colors.text, fontSize: 11 },
        sceneStyle: { backgroundColor: Colors.background },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Tournaments', tabBarIcon: icons.tournaments }} />
      <Tabs.Screen
        name="my-squads"
        options={{
          title: 'My Squads',
          tabBarIcon: icons.squads,
          tabBarBadge: upcoming > 0 ? upcoming : undefined,
        }}
      />
      {/* Only the organizer sees this tab. */}
      <Tabs.Screen
        name="organizer"
        options={{
          title: 'Organizer',
          tabBarIcon: icons.organizer,
          href: isAdmin ? undefined : null,
        }}
      />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icons.profile }} />
    </Tabs>
  );
}
