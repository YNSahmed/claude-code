import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { useRoomAccess } from '@/api/queries';
import { Colors, Fonts, Radius } from '@/constants/theme';
import { useNow } from '@/hooks/use-now';
import { copyText } from '@/utils/device';
import { formatClock, formatDateTime } from '@/utils/format';

import { AppText } from './ui/app-text';
import { Card, SectionTitle } from './ui/card';

/** Room ID and password for a registered squad, with a live countdown until they're released. */
export function RoomCard({ tournamentId, compact }: { tournamentId: string; compact?: boolean }) {
  const { data, isLoading } = useRoomAccess(tournamentId, true);
  const now = useNow(1000);

  const body = (() => {
    if (isLoading || !data) return <ActivityIndicator color={Colors.primary} />;
    if (data.state === 'unavailable') return <Notice icon="lock-closed" text={data.message} />;
    if (data.state === 'locked') {
      const secondsLeft = data.releaseAt
        ? Math.max(0, (new Date(data.releaseAt).getTime() - now) / 1000)
        : null;
      return secondsLeft !== null && secondsLeft > 0 ? (
        <View style={styles.countdown}>
          <AppText variant="label">Unlocks in</AppText>
          <AppText style={styles.clock}>{formatClock(secondsLeft)}</AppText>
          <AppText variant="caption">at {formatDateTime(data.releaseAt as string)}</AppText>
        </View>
      ) : (
        <Notice
          icon="time-outline"
          text="The organizer shares the room ID and password shortly before the start. They will appear right here."
        />
      );
    }
    return (
      <>
        <View style={styles.fields}>
          <CopyField label="Room ID" value={data.roomId} />
          <CopyField label="Password" value={data.roomPassword} />
        </View>
        {!compact ? (
          <AppText variant="caption">
            Open the game → Custom Room → enter these details. Don&apos;t share them outside your
            squad.
          </AppText>
        ) : null}
      </>
    );
  })();

  if (compact) return <View style={styles.compact}>{body}</View>;
  return (
    <Card style={data?.state === 'released' ? styles.highlight : undefined}>
      <SectionTitle title="Room details" icon="key-outline" />
      {body}
    </Card>
  );
}

function Notice({ icon, text }: { icon: 'lock-closed' | 'time-outline'; text: string }) {
  return (
    <View style={styles.notice}>
      <Ionicons name={icon} size={20} color={Colors.textMuted} />
      <AppText variant="caption" style={styles.flex}>
        {text}
      </AppText>
    </View>
  );
}

export function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Copy ${label}`}
      onPress={() => copyText(value).then(() => setCopied(true))}
      style={({ pressed }) => [styles.field, pressed && styles.pressed]}>
      <View style={styles.flex}>
        <AppText variant="label">{label}</AppText>
        <AppText style={styles.value} selectable>
          {value}
        </AppText>
      </View>
      <View style={[styles.copy, copied && styles.copied]}>
        <Ionicons
          name={copied ? 'checkmark' : 'copy-outline'}
          size={16}
          color={copied ? Colors.background : Colors.text}
        />
        <AppText style={[styles.copyText, copied && { color: Colors.background }]}>
          {copied ? 'Copied' : 'Copy'}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  compact: {
    gap: 8,
  },
  highlight: {
    borderColor: `${Colors.live}66`,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceRaised,
  },
  countdown: {
    alignItems: 'center',
    gap: 2,
    padding: 12,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceRaised,
  },
  clock: {
    fontFamily: Fonts.display,
    fontSize: 36,
    lineHeight: 40,
    color: Colors.primary,
    letterSpacing: 1,
  },
  fields: {
    gap: 8,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceRaised,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pressed: {
    opacity: 0.8,
  },
  value: {
    fontFamily: Fonts.display,
    fontSize: 24,
    lineHeight: 28,
    letterSpacing: 2,
  },
  copy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 34,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  copied: {
    backgroundColor: Colors.live,
    borderColor: Colors.live,
  },
  copyText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
