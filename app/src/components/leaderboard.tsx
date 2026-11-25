import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import type { Standing } from '@/api/types';
import { Colors, Fonts, Radius } from '@/constants/theme';
import { formatMoney } from '@/utils/format';

import { AppText } from './ui/app-text';

export const MEDALS = ['#FFC23D', '#C9D3E3', '#D9895B'];

export function Leaderboard({
  standings,
  mySquadId,
}: {
  standings: Standing[];
  mySquadId?: string;
}) {
  if (standings.length === 0)
    return <AppText variant="caption">Results will appear here after the match.</AppText>;
  return (
    <View style={styles.list}>
      {standings.map((s) => {
        const medal = MEDALS[s.placement - 1];
        const mine = s.squadId === mySquadId;
        return (
          <View key={s.squadId} style={[styles.row, mine && styles.mine]}>
            <View style={[styles.rank, medal ? { backgroundColor: medal } : null]}>
              <AppText style={[styles.rankText, medal ? { color: Colors.background } : null]}>
                {s.placement}
              </AppText>
            </View>
            <AppText variant="bodyStrong" numberOfLines={1} style={styles.team}>
              {s.squadName}
              {mine ? '  (you)' : ''}
            </AppText>
            <View style={styles.kills}>
              <Ionicons name="skull-outline" size={14} color={Colors.textMuted} />
              <AppText variant="bodyStrong">{s.kills}</AppText>
            </View>
            <AppText
              style={[styles.prize, { color: s.prize > 0 ? Colors.gold : Colors.textFaint }]}>
              {s.prize > 0 ? formatMoney(s.prize) : '—'}
            </AppText>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceRaised,
  },
  mine: {
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  rank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  rankText: {
    fontFamily: Fonts.display,
    fontSize: 15,
    color: Colors.text,
  },
  team: {
    flex: 1,
  },
  kills: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 40,
  },
  prize: {
    fontFamily: Fonts.display,
    fontSize: 16,
    minWidth: 64,
    textAlign: 'right',
  },
});
