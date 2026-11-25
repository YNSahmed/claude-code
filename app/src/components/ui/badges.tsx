import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Colors, Gradients, ModeColors, Radius, StatusStyles } from '@/constants/theme';
import type { Mode, TournamentStatus } from '@/data/types';

import { AppText } from './app-text';

export function Pill({ label, color, solid }: { label: string; color: string; solid?: boolean }) {
  return (
    <View
      style={[
        styles.pill,
        { backgroundColor: solid ? color : `${color}26`, borderColor: `${color}66` },
      ]}>
      <AppText style={[styles.pillText, { color: solid ? Colors.background : color }]}>
        {label}
      </AppText>
    </View>
  );
}

export function ModeBadge({ mode, onDark }: { mode: Mode; onDark?: boolean }) {
  const icon = mode === 'Solo' ? 'person' : 'people';
  return (
    <View
      style={[
        styles.pill,
        styles.row,
        onDark
          ? styles.onDark
          : { backgroundColor: `${ModeColors[mode]}26`, borderColor: `${ModeColors[mode]}66` },
      ]}>
      <Ionicons name={icon} size={11} color={onDark ? Colors.text : ModeColors[mode]} />
      <AppText style={[styles.pillText, { color: onDark ? Colors.text : ModeColors[mode] }]}>
        {mode}
      </AppText>
    </View>
  );
}

export function StatusBadge({ status, onDark }: { status: TournamentStatus; onDark?: boolean }) {
  const { label, color } = StatusStyles[status];
  return (
    <View
      style={[
        styles.pill,
        styles.row,
        onDark ? styles.onDark : { backgroundColor: `${color}22`, borderColor: `${color}55` },
      ]}>
      {status === 'live' ? <LiveDot /> : null}
      <AppText style={[styles.pillText, { color: onDark ? Colors.text : color }]}>{label}</AppText>
    </View>
  );
}

/** A pulsing green dot for live matches. */
export function LiveDot() {
  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.25, { duration: 700 }), -1, true);
  }, [opacity]);
  const pulse = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[styles.dot, pulse]} />;
}

/** Fill level of the registration slots. */
export function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View
      style={styles.track}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}>
      {pct > 0 ? (
        <LinearGradient
          colors={Gradients.fire}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.fill, { width: `${pct * 100}%` }]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  onDark: {
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  pillText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.live,
  },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.surfaceRaised,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
});
