import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import type { ComponentRef, Ref } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';

import type { Standing, Tournament } from '@/api/types';
import { APP_NAME, MAP_LABEL, MODE_LABEL } from '@/constants/config';
import {
  Fonts,
  MapStyles,
  PosterThemes,
  type IconName,
  type PosterThemeName,
} from '@/constants/theme';
import { formatDay, formatEntry, formatMoney, formatTime, ordinal } from '@/utils/format';
import { teamWord } from '@/utils/tournament';

import { AppText } from './ui/app-text';

export type PosterTemplate = 'announce' | 'hurry' | 'results';

export const POSTER_TEMPLATES: { value: PosterTemplate; label: string; icon: IconName }[] = [
  { value: 'announce', label: 'Registration open', icon: 'megaphone' },
  { value: 'hurry', label: 'Last spots', icon: 'flash' },
  { value: 'results', label: 'Results', icon: 'podium' },
];

interface PosterProps extends ViewProps {
  ref?: Ref<ComponentRef<typeof View>>;
  tournament: Tournament;
  template: PosterTemplate;
  theme: PosterThemeName;
  /** Rendered width in points. The poster is 2:3 portrait (1080×1620 on a 3× phone), shown in full on WhatsApp. */
  width: number;
  organizerName?: string | null;
  hasChannel?: boolean;
  standings?: Standing[];
}

/** A shareable tournament poster. Everything scales with `width`, so captures stay sharp. */
export function Poster({
  ref,
  tournament: t,
  template,
  theme: themeName,
  width,
  organizerName,
  hasChannel,
  standings = [],
  style,
  ...rest
}: PosterProps) {
  const theme = PosterThemes[themeName];
  const s = width / 360;
  const height = width * 1.5;
  const map = MapStyles[t.map];
  const date = new Date(t.startsAt);
  const brand = (organizerName || APP_NAME).toUpperCase();

  const kicker =
    template === 'results'
      ? 'OFFICIAL RESULTS'
      : template === 'hurry'
        ? `ONLY ${t.teamsLeft} ${teamWord(t, t.teamsLeft).toUpperCase()} LEFT!`
        : 'REGISTRATION OPEN';

  return (
    <View
      ref={ref}
      collapsable={false}
      testID="poster"
      // minHeight, not height: a long title grows the poster instead of clipping its bottom.
      style={[
        { width, minHeight: height, overflow: 'hidden', backgroundColor: theme.background[0] },
        style,
      ]}
      {...rest}>
      <LinearGradient
        colors={theme.background}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Decoration: glow, diagonal light streaks and the map's emblem. */}
      <View
        style={[
          styles.glow,
          {
            width: 260 * s,
            height: 260 * s,
            borderRadius: 130 * s,
            top: -90 * s,
            left: -70 * s,
            backgroundColor: theme.accent,
          },
        ]}
      />
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={[
            styles.streak,
            {
              width: 520 * s,
              height: (i === 1 ? 26 : 8) * s,
              top: (210 + i * 34) * s,
              left: -80 * s,
              backgroundColor: theme.accent,
              opacity: i === 1 ? 0.12 : 0.22,
            },
          ]}
        />
      ))}
      <Ionicons
        name={map.icon}
        size={300 * s}
        color="rgba(255,255,255,0.07)"
        style={{ position: 'absolute', right: -90 * s, bottom: -60 * s }}
      />

      <View style={{ flex: 1, padding: 18 * s, gap: 8 * s }}>
        {/* Brand row */}
        <View style={styles.row}>
          <LinearGradient
            colors={['#FF8A00', '#FF2E4D']}
            style={{
              width: 30 * s,
              height: 30 * s,
              borderRadius: 9 * s,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Ionicons name="flame" size={18 * s} color="#FFFFFF" />
          </LinearGradient>
          <AppText
            numberOfLines={1}
            style={[
              styles.display,
              { flex: 1, fontSize: 16 * s, letterSpacing: 2 * s, color: theme.text },
            ]}>
            {brand}
          </AppText>
          <View
            style={[
              styles.chip,
              {
                paddingHorizontal: 9 * s,
                paddingVertical: 3 * s,
                borderRadius: 6 * s,
                borderColor: 'rgba(255,255,255,0.35)',
              },
            ]}>
            <AppText
              style={[
                styles.display,
                { fontSize: 11 * s, letterSpacing: 1.5 * s, color: theme.text },
              ]}>
              FREE FIRE · {MODE_LABEL[t.mode].toUpperCase()}
            </AppText>
          </View>
        </View>

        {/* Kicker + title */}
        <View style={{ marginTop: 6 * s, gap: 5 * s }}>
          <View
            style={[
              styles.kicker,
              {
                backgroundColor: theme.accent,
                paddingHorizontal: 10 * s,
                paddingVertical: 4 * s,
                borderRadius: 4 * s,
              },
            ]}>
            <AppText
              style={[
                styles.display,
                { fontSize: 13 * s, letterSpacing: 2 * s, color: '#111111' },
              ]}>
              {kicker}
            </AppText>
          </View>
          <AppText
            numberOfLines={2}
            adjustsFontSizeToFit
            style={[
              styles.display,
              {
                fontSize: 36 * s,
                lineHeight: 37 * s,
                color: theme.text,
                textShadowColor: 'rgba(0,0,0,0.45)',
                textShadowRadius: 12 * s,
              },
            ]}>
            {t.title.toUpperCase()}
          </AppText>
        </View>

        {template === 'results' ? (
          <Podium standings={standings} s={s} accent={theme.accent} text={theme.text} />
        ) : (
          <>
            {/* When and where */}
            <View style={[styles.row, { gap: 8 * s, flexWrap: 'wrap' }]}>
              <InfoChip icon="calendar" label={formatDay(date).toUpperCase()} s={s} />
              <InfoChip icon="time" label={formatTime(date)} s={s} />
              <InfoChip icon="location" label={MAP_LABEL[t.map].toUpperCase()} s={s} />
            </View>

            {/* Prize */}
            <View style={{ marginTop: 2 * s }}>
              <AppText
                style={[
                  styles.display,
                  { fontSize: 14 * s, letterSpacing: 3 * s, color: 'rgba(255,255,255,0.8)' },
                ]}>
                PRIZE POOL
              </AppText>
              <AppText
                style={[
                  styles.display,
                  {
                    fontSize: 52 * s,
                    lineHeight: 54 * s,
                    color: theme.accent,
                    textShadowColor: 'rgba(0,0,0,0.5)',
                    textShadowRadius: 14 * s,
                  },
                ]}>
                {formatMoney(t.prizePool)}
              </AppText>
              <View style={[styles.row, { gap: 6 * s, marginTop: 2 * s }]}>
                {t.prizes.slice(0, 3).map((amount, i) => (
                  <View
                    key={i}
                    style={[styles.prizeBox, { paddingVertical: 5 * s, borderRadius: 8 * s }]}>
                    <AppText
                      style={[
                        styles.display,
                        { fontSize: 11 * s, color: 'rgba(255,255,255,0.75)' },
                      ]}>
                      {ordinal(i + 1).toUpperCase()}
                    </AppText>
                    <AppText style={[styles.display, { fontSize: 17 * s, color: theme.text }]}>
                      {formatMoney(amount)}
                    </AppText>
                  </View>
                ))}
                {t.perKillReward > 0 ? (
                  <View style={[styles.prizeBox, { paddingVertical: 5 * s, borderRadius: 8 * s }]}>
                    <AppText
                      style={[
                        styles.display,
                        { fontSize: 11 * s, color: 'rgba(255,255,255,0.75)' },
                      ]}>
                      PER KILL
                    </AppText>
                    <AppText style={[styles.display, { fontSize: 17 * s, color: theme.text }]}>
                      {formatMoney(t.perKillReward)}
                    </AppText>
                  </View>
                ) : null}
              </View>
            </View>
          </>
        )}

        <View style={{ flex: 1 }} />

        {/* Bottom call to action */}
        {template !== 'results' ? (
          <View style={[styles.row, { gap: 8 * s }]}>
            <Stat label="ENTRY" value={formatEntry(t.entryFee).toUpperCase()} s={s} />
            <Stat label={teamWord(t).toUpperCase()} value={`${t.maxTeams}`} s={s} />
            <Stat
              label="LEFT"
              value={`${t.teamsLeft}`}
              s={s}
              highlight={template === 'hurry' ? theme.accent : undefined}
            />
          </View>
        ) : null}
        <LinearGradient
          colors={['#FF8A00', '#FF2E4D']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ borderRadius: 10 * s, paddingVertical: 8 * s, alignItems: 'center' }}>
          <AppText
            style={[
              styles.display,
              { fontSize: 15 * s, letterSpacing: 1.2 * s, color: '#FFFFFF' },
            ]}>
            {template === 'results'
              ? 'NEXT TOURNAMENT IS COMING SOON'
              : `REGISTER YOUR ${teamWord(t, 1).toUpperCase()} IN THE APP · FREE`}
          </AppText>
        </LinearGradient>
        {hasChannel ? (
          <View style={[styles.row, { justifyContent: 'center', gap: 6 * s }]}>
            <Ionicons name="logo-whatsapp" size={14 * s} color="#25D366" />
            <AppText
              style={[
                styles.display,
                { fontSize: 12 * s, letterSpacing: 1 * s, color: 'rgba(255,255,255,0.85)' },
              ]}>
              FOLLOW OUR WHATSAPP CHANNEL
            </AppText>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function InfoChip({ icon, label, s }: { icon: IconName; label: string; s: number }) {
  return (
    <View
      style={[
        styles.row,
        styles.chip,
        {
          gap: 5 * s,
          paddingHorizontal: 10 * s,
          paddingVertical: 5 * s,
          borderRadius: 20 * s,
          backgroundColor: 'rgba(0,0,0,0.3)',
          borderColor: 'rgba(255,255,255,0.18)',
        },
      ]}>
      <Ionicons name={icon} size={13 * s} color="#FFFFFF" />
      <AppText style={[styles.display, { fontSize: 14 * s, color: '#FFFFFF' }]}>{label}</AppText>
    </View>
  );
}

function Stat({
  label,
  value,
  s,
  highlight,
}: {
  label: string;
  value: string;
  s: number;
  highlight?: string;
}) {
  return (
    <View
      style={[
        styles.stat,
        {
          paddingVertical: 4 * s,
          borderRadius: 8 * s,
          borderColor: highlight ?? 'rgba(255,255,255,0.18)',
        },
      ]}>
      <AppText
        style={[
          styles.display,
          { fontSize: 19 * s, lineHeight: 21 * s, color: highlight ?? '#FFFFFF' },
        ]}>
        {value}
      </AppText>
      <AppText
        style={[
          styles.display,
          { fontSize: 10 * s, letterSpacing: 1.5 * s, color: 'rgba(255,255,255,0.7)' },
        ]}>
        {label}
      </AppText>
    </View>
  );
}

function Podium({
  standings,
  s,
  accent,
  text,
}: {
  standings: Standing[];
  s: number;
  accent: string;
  text: string;
}) {
  const top = [standings[1], standings[0], standings[2]];
  const heights = [96, 128, 78];
  const colors = ['#C9D3E3', accent, '#D9895B'];
  return (
    <View style={{ marginTop: 18 * s, gap: 12 * s }}>
      <View style={[styles.row, { alignItems: 'flex-end', gap: 8 * s }]}>
        {top.map((entry, i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center', gap: 4 * s }}>
            {i === 1 ? <Ionicons name="trophy" size={30 * s} color={accent} /> : null}
            <AppText
              numberOfLines={2}
              style={[
                styles.display,
                { fontSize: 15 * s, lineHeight: 16 * s, color: text, textAlign: 'center' },
              ]}>
              {entry?.squadName.toUpperCase() ?? '—'}
            </AppText>
            <View
              style={{
                width: '100%',
                height: heights[i]! * s,
                borderTopLeftRadius: 8 * s,
                borderTopRightRadius: 8 * s,
                backgroundColor: 'rgba(0,0,0,0.35)',
                borderTopWidth: 4 * s,
                borderColor: colors[i],
                alignItems: 'center',
                paddingTop: 6 * s,
              }}>
              <AppText
                style={[
                  styles.display,
                  { fontSize: 26 * s, lineHeight: 28 * s, color: colors[i] },
                ]}>
                {[2, 1, 3][i]}
              </AppText>
              {entry ? (
                <>
                  <AppText style={[styles.display, { fontSize: 15 * s, color: text }]}>
                    {formatMoney(entry.prize)}
                  </AppText>
                  <AppText
                    style={[styles.display, { fontSize: 11 * s, color: 'rgba(255,255,255,0.7)' }]}>
                    {entry.kills} KILLS
                  </AppText>
                </>
              ) : null}
            </View>
          </View>
        ))}
      </View>
      <AppText
        style={[
          styles.display,
          {
            fontSize: 14 * s,
            letterSpacing: 1.5 * s,
            color: 'rgba(255,255,255,0.85)',
            textAlign: 'center',
          },
        ]}>
        GG TO EVERY SQUAD THAT DROPPED IN!
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  display: {
    fontFamily: Fonts.display,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chip: {
    borderWidth: 1,
  },
  kicker: {
    alignSelf: 'flex-start',
  },
  glow: {
    position: 'absolute',
    opacity: 0.22,
  },
  streak: {
    position: 'absolute',
    transform: [{ rotate: '-18deg' }],
  },
  prizeBox: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.32)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.32)',
    borderWidth: 1,
  },
});
