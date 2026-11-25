import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router/js-tabs';
import type { ColorValue } from 'react-native';

import { Colors, Fonts, type IconName } from '@/constants/theme';
import { useStore } from '@/data/store';
import { findRegistration } from '@/utils/tournament';

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
  matches: tabIcon('game-controller', 'game-controller-outline'),
  host: tabIcon('add-circle', 'add-circle-outline'),
  profile: tabIcon('person-circle', 'person-circle-outline'),
};

export default function TabLayout() {
  const { tournaments, profile } = useStore();
  const activeMatches = tournaments.filter(
    (t) => t.status !== 'completed' && findRegistration(t, profile?.id)
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
        name="my-matches"
        options={{
          title: 'My Matches',
          tabBarIcon: icons.matches,
          tabBarBadge: activeMatches > 0 ? activeMatches : undefined,
        }}
      />
      <Tabs.Screen name="host" options={{ title: 'Host', tabBarIcon: icons.host }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icons.profile }} />
    </Tabs>
  );
}
