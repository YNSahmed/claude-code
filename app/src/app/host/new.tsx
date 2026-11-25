import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { TournamentCard } from '@/components/tournament-card';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Card, SectionTitle } from '@/components/ui/card';
import { Chip, ChipRow } from '@/components/ui/chip';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { Stepper } from '@/components/ui/stepper';
import { TextField } from '@/components/ui/text-field';
import {
  CURRENCY_SYMBOL,
  DEFAULT_RULES,
  MAPS,
  MAX_TEAMS,
  MODES,
  TEAM_SIZE,
} from '@/constants/config';
import { Colors, MapStyles, ModeColors } from '@/constants/theme';
import { useStore } from '@/data/store';
import { useNow } from '@/hooks/use-now';
import type { GameMap, Mode, Tournament } from '@/data/types';
import { digitsOnly } from '@/data/validation';
import { haptics } from '@/utils/device';
import { formatDay, formatTime } from '@/utils/format';

const DAYS_AHEAD = 7;
/** Start times offered, in minutes after midnight: 10:00 AM to 11:30 PM every half hour. */
const TIME_SLOTS = Array.from({ length: 28 }, (_, i) => 600 + i * 30);
const DEFAULT_TIME = 20 * 60;
/** Today's slots must be at least this far away, so players have time to join. */
const MIN_LEAD_MS = 30 * 60_000;

function slotDate(dayOffset: number, minutes: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return date;
}

function slotsFor(dayOffset: number): number[] {
  const earliest = Date.now() + MIN_LEAD_MS;
  return TIME_SLOTS.filter((m) => slotDate(dayOffset, m).getTime() >= earliest);
}

function pickSlot(dayOffset: number, preferred: number): number {
  const slots = slotsFor(dayOffset);
  return slots.includes(preferred) ? preferred : (slots[0] ?? preferred);
}

export default function NewTournamentScreen() {
  const { profile, createTournament } = useStore();
  const router = useRouter();
  const now = useNow();

  const days = Array.from({ length: DAYS_AHEAD }, (_, i) => i).filter(
    (d) => slotsFor(d).length > 0
  );
  const [title, setTitle] = useState('');
  const [mode, setMode] = useState<Mode>('Squad');
  const [map, setMap] = useState<GameMap>('Bermuda');
  const [day, setDay] = useState(days[0]);
  const [time, setTime] = useState(() => pickSlot(days[0], DEFAULT_TIME));
  const [maxTeams, setMaxTeams] = useState(MAX_TEAMS.Squad);
  const [entryFee, setEntryFee] = useState('0');
  const [prizePool, setPrizePool] = useState('500');
  const [perKill, setPerKill] = useState('5');
  const [rules, setRules] = useState(DEFAULT_RULES.join('\n'));
  const [error, setError] = useState<string | null>(null);

  const startsAt = slotDate(day, time).toISOString();
  const draft: Tournament = {
    id: 'preview',
    title: title.trim() || 'Your tournament',
    mode,
    map,
    startsAt,
    maxTeams,
    entryFee: Number(entryFee) || 0,
    prizePool: Number(prizePool) || 0,
    perKill: Number(perKill) || 0,
    rules: [],
    hostId: 'preview',
    hostName: profile?.ign ?? '',
    status: 'upcoming',
    room: null,
    registrations: [],
    results: [],
    createdAt: startsAt,
  };

  const changeMode = (next: Mode) => {
    setMode(next);
    setMaxTeams(MAX_TEAMS[next]);
  };

  const changeDay = (next: number) => {
    setDay(next);
    setTime((current) => pickSlot(next, current));
  };

  const submit = () => {
    const result = createTournament({
      title,
      mode,
      map,
      startsAt,
      maxTeams,
      entryFee: draft.entryFee,
      prizePool: draft.prizePool,
      perKill: draft.perKill,
      rules: rules.split('\n'),
    });
    if (!result.ok) {
      setError(result.error);
      haptics.warning();
      return;
    }
    haptics.success();
    router.replace({ pathname: '/host/[id]', params: { id: result.id! } });
  };

  return (
    <Screen
      header={<ScreenHeader title="New tournament" variant="close" />}
      footer={
        <View style={styles.footer}>
          {error ? (
            <View style={styles.error}>
              <Ionicons name="alert-circle" size={18} color={Colors.danger} />
              <AppText variant="caption" color={Colors.danger} style={styles.flex}>
                {error}
              </AppText>
            </View>
          ) : null}
          <Button title="Create tournament" icon="rocket" size="lg" onPress={submit} />
        </View>
      }>
      <Card>
        <TextField
          label="Tournament name"
          placeholder="e.g. Friday Night Squads"
          value={title}
          onChangeText={(text) => {
            setTitle(text);
            setError(null);
          }}
          maxLength={32}
        />
      </Card>

      <Card>
        <SectionTitle title="Mode" icon="people" />
        <View style={styles.wrapRow}>
          {MODES.map((m) => (
            <Chip
              key={m}
              label={`${m} · ${TEAM_SIZE[m]}`}
              selected={mode === m}
              onPress={() => changeMode(m)}
              color={ModeColors[m]}
              icon={m === 'Solo' ? 'person' : 'people'}
            />
          ))}
        </View>
        <SectionTitle title="Map" icon="location" />
        <View style={styles.wrapRow}>
          {MAPS.map((m) => (
            <Chip
              key={m}
              label={m}
              selected={map === m}
              onPress={() => setMap(m)}
              icon={MapStyles[m].icon}
              color={MapStyles[m].gradient[0]}
            />
          ))}
        </View>
      </Card>

      <Card>
        <SectionTitle title="Date & time" icon="calendar" />
        <ChipRow>
          {days.map((d) => (
            <Chip
              key={d}
              label={formatDay(slotDate(d, 0))}
              selected={day === d}
              onPress={() => changeDay(d)}
            />
          ))}
        </ChipRow>
        <ChipRow>
          {slotsFor(day).map((m) => (
            <Chip
              key={m}
              label={formatTime(slotDate(day, m))}
              selected={time === m}
              onPress={() => setTime(m)}
            />
          ))}
        </ChipRow>
      </Card>

      <Card>
        <SectionTitle title="Slots & prizes" icon="trophy" />
        <Stepper
          label={mode === 'Solo' ? 'Max players' : 'Max teams'}
          value={maxTeams}
          onChange={setMaxTeams}
          min={2}
          max={MAX_TEAMS[mode]}
          format={(v) =>
            `${v} ${mode === 'Solo' ? 'players' : 'teams'} · ${v * TEAM_SIZE[mode]} in room`
          }
        />
        <View style={styles.moneyRow}>
          <View style={styles.flex}>
            <TextField
              label={`Entry (${CURRENCY_SYMBOL})`}
              value={entryFee}
              onChangeText={(v) => setEntryFee(digitsOnly(v))}
              keyboardType="number-pad"
              maxLength={6}
              hint="0 = free"
            />
          </View>
          <View style={styles.flex}>
            <TextField
              label={`Prize pool (${CURRENCY_SYMBOL})`}
              value={prizePool}
              onChangeText={(v) => setPrizePool(digitsOnly(v))}
              keyboardType="number-pad"
              maxLength={7}
            />
          </View>
          <View style={styles.flex}>
            <TextField
              label={`Per kill (${CURRENCY_SYMBOL})`}
              value={perKill}
              onChangeText={(v) => setPerKill(digitsOnly(v))}
              keyboardType="number-pad"
              maxLength={5}
            />
          </View>
        </View>
        <AppText variant="caption">
          The prize pool is split 50% / 30% / 20% between the top three.
        </AppText>
      </Card>

      <Card>
        <SectionTitle title="Rules" icon="document-text-outline" />
        <TextField label="One rule per line" value={rules} onChangeText={setRules} multiline />
      </Card>

      <SectionTitle title="Preview" icon="eye-outline" />
      <View style={styles.preview}>
        <TournamentCard tournament={draft} now={now} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  wrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  preview: {
    pointerEvents: 'none',
  },
  moneyRow: {
    flexDirection: 'row',
    gap: 8,
  },
  footer: {
    gap: 10,
  },
  error: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
