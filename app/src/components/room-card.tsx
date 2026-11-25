import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Colors, Fonts, Radius } from '@/constants/theme';
import type { Tournament } from '@/data/types';
import { copyText } from '@/utils/device';
import { formatDateTime } from '@/utils/format';

import { AppText } from './ui/app-text';
import { Card, SectionTitle } from './ui/card';

/** Room ID and password. Locked until the player has joined. */
export function RoomCard({
  tournament: t,
  unlocked,
}: {
  tournament: Tournament;
  unlocked: boolean;
}) {
  return (
    <Card style={unlocked && t.room ? styles.highlight : undefined}>
      <SectionTitle title="Room details" icon="key-outline" />
      {!unlocked ? (
        <Notice
          icon="lock-closed"
          text="Join this tournament to unlock the room ID and password."
        />
      ) : !t.room ? (
        <Notice
          icon="time-outline"
          text="The organizer shares the room ID and password 10–15 minutes before the start. They will show up right here."
        />
      ) : (
        <>
          <View style={styles.fields}>
            <CopyField label="Room ID" value={t.room.id} />
            <CopyField label="Password" value={t.room.password} />
          </View>
          <AppText variant="caption">
            Shared {formatDateTime(t.room.publishedAt)}. Open the game, go to Custom Room, and join
            with these details.
          </AppText>
        </>
      )}
    </Card>
  );
}

function Notice({ icon, text }: { icon: 'lock-closed' | 'time-outline'; text: string }) {
  return (
    <View style={styles.notice}>
      <Ionicons name={icon} size={20} color={Colors.textMuted} />
      <AppText variant="caption" style={styles.noticeText}>
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
      accessibilityLabel={`Copy ${label}: ${value}`}
      onPress={() => copyText(value).then(() => setCopied(true))}
      style={({ pressed }) => [styles.field, pressed && styles.pressed]}>
      <View style={styles.fieldText}>
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
  noticeText: {
    flex: 1,
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
  fieldText: {
    flex: 1,
    gap: 2,
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
