import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { Colors, Fonts, Radius } from '@/constants/theme';
import type { Tournament } from '@/data/types';
import { formatMoney } from '@/utils/format';
import { standings } from '@/utils/tournament';

import { AppText } from './ui/app-text';

const MEDALS = ['#FFC23D', '#C9D3E3', '#D9895B'];

export function Leaderboard({
  tournament: t,
  userId,
  limit,
}: {
  tournament: Tournament;
  userId?: string;
  limit?: number;
}) {
  const rows = standings(t).slice(0, limit);

  return (
    <View style={styles.list}>
      {rows.map(({ result, registration, earnings }) => {
        const medal = MEDALS[result.placement - 1];
        const mine = registration.userId === userId;
        return (
          <View key={registration.id} style={[styles.row, mine && styles.mine]}>
            <View style={[styles.rank, medal ? { backgroundColor: medal } : null]}>
              <AppText style={[styles.rankText, medal ? { color: Colors.background } : null]}>
                {result.placement}
              </AppText>
            </View>
            <View style={styles.team}>
              <AppText variant="bodyStrong" numberOfLines={1}>
                {registration.teamName}
                {mine ? '  (you)' : ''}
              </AppText>
              {t.mode !== 'Solo' ? (
                <AppText variant="caption" numberOfLines={1}>
                  {registration.players.map((p) => p.ign).join(' · ')}
                </AppText>
              ) : null}
            </View>
            <View style={styles.kills}>
              <Ionicons name="skull-outline" size={14} color={Colors.textMuted} />
              <AppText variant="bodyStrong">{result.kills}</AppText>
            </View>
            <AppText
              style={[styles.earnings, { color: earnings > 0 ? Colors.gold : Colors.textFaint }]}>
              {earnings > 0 ? formatMoney(earnings) : '—'}
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
  earnings: {
    fontFamily: Fonts.display,
    fontSize: 16,
    minWidth: 64,
    textAlign: 'right',
  },
});
