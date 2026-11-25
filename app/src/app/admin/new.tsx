import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { errorMessage } from '@/api/client';
import { useCreateTournament } from '@/api/queries';
import type { GameMap, Mode, Tournament } from '@/api/types';
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
  MAP_LABEL,
  MAPS,
  MODE_LABEL,
  MODES,
  ROOM_CAPACITY,
  TEAM_SIZE,
} from '@/constants/config';
import { Colors, MapStyles, ModeColors } from '@/constants/theme';
import { useNow } from '@/hooks/use-now';
import { haptics } from '@/utils/device';
import { formatDay, formatTime } from '@/utils/format';

const DAYS_AHEAD = 7;
/** Start times: 10:00 AM to 11:30 PM every half hour. */
const TIME_SLOTS = Array.from({ length: 28 }, (_, i) => 600 + i * 30);
const MIN_LEAD_MS = 30 * 60_000;
const PRIZE_SPLIT = [0.5, 0.3, 0.2];

function slotDate(dayOffset: number, minutes: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return date;
}

function slotsFor(day: number): number[] {
  const earliest = Date.now() + MIN_LEAD_MS;
  return TIME_SLOTS.filter((m) => slotDate(day, m).getTime() >= earliest);
}

const pickSlot = (day: number, preferred: number) => {
  const slots = slotsFor(day);
  return slots.includes(preferred) ? preferred : (slots[0] ?? preferred);
};

export default function NewTournamentScreen() {
  const router = useRouter();
  const now = useNow();
  const create = useCreateTournament();
  const days = Array.from({ length: DAYS_AHEAD }, (_, i) => i).filter(
    (d) => slotsFor(d).length > 0
  );

  const [title, setTitle] = useState('');
  const [mode, setMode] = useState<Mode>('SQUAD');
  const [map, setMap] = useState<GameMap>('BERMUDA');
  const [day, setDay] = useState(days[0] ?? 1);
  const [time, setTime] = useState(() => pickSlot(days[0] ?? 1, 20 * 60));
  const [maxTeams, setMaxTeams] = useState(12);
  const [prizePool, setPrizePool] = useState('1000');
  const [perKill, setPerKill] = useState('10');
  const [rules, setRules] = useState(DEFAULT_RULES.join('\n'));

  const teamCap = ROOM_CAPACITY / TEAM_SIZE[mode];
  const startsAt = slotDate(day, time).toISOString();
  const pool = Number(prizePool) || 0;
  const draft: Tournament = {
    id: 'preview',
    title: title.trim() || 'Your tournament',
    mode,
    teamSize: TEAM_SIZE[mode],
    map,
    entryFee: 0,
    prizePool: pool,
    prizeSplitBps: [5000, 3000, 2000],
    prizes: PRIZE_SPLIT.map((share) => Math.floor(pool * share)),
    perKillReward: Number(perKill) || 0,
    maxTeams,
    teamsRegistered: 0,
    teamsLeft: maxTeams,
    startsAt,
    status: 'OPEN',
    rules: [],
    roomPublished: false,
    credentialsReleaseAt: null,
  };

  const submit = () =>
    create.mutate(
      {
        title: title.trim(),
        mode,
        map,
        startsAt,
        maxTeams,
        prizePool: pool,
        perKillReward: Number(perKill) || 0,
        rules: rules
          .split('\n')
          .map((r) => r.trim())
          .filter(Boolean),
      },
      {
        onSuccess: ({ tournament }) => {
          haptics.success();
          router.replace({ pathname: '/admin/[id]', params: { id: tournament.id } });
        },
        onError: () => haptics.warning(),
      }
    );

  return (
    <Screen
      header={<ScreenHeader title="New tournament" variant="close" />}
      footer={
        <View style={styles.footer}>
          {create.isError ? (
            <View style={styles.error}>
              <Ionicons name="alert-circle" size={18} color={Colors.danger} />
              <AppText variant="caption" color={Colors.danger} style={styles.flex}>
                {errorMessage(create.error)}
              </AppText>
            </View>
          ) : null}
          <Button
            title={create.isPending ? 'Creating…' : 'Create tournament'}
            icon="rocket"
            size="lg"
            disabled={create.isPending || title.trim().length < 3}
            onPress={submit}
          />
        </View>
      }>
      <Card>
        <TextField
          label="Tournament name"
          placeholder="e.g. Friday Night Squads"
          value={title}
          onChangeText={setTitle}
          maxLength={60}
        />
      </Card>

      <Card>
        <SectionTitle title="Mode" icon="people" />
        <View style={styles.wrap}>
          {MODES.map((m) => (
            <Chip
              key={m}
              label={`${MODE_LABEL[m]} · ${TEAM_SIZE[m]}`}
              selected={mode === m}
              onPress={() => {
                setMode(m);
                setMaxTeams(ROOM_CAPACITY / TEAM_SIZE[m]);
              }}
              color={ModeColors[m]}
              icon={m === 'SOLO' ? 'person' : 'people'}
            />
          ))}
        </View>
        <SectionTitle title="Map" icon="location" />
        <View style={styles.wrap}>
          {MAPS.map((m) => (
            <Chip
              key={m}
              label={MAP_LABEL[m]}
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
              onPress={() => {
                setDay(d);
                setTime((current) => pickSlot(d, current));
              }}
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
        <SectionTitle title="Spots & prizes" icon="trophy" />
        <Stepper
          label={`Max ${MODE_LABEL[mode].toLowerCase()}s`}
          value={Math.min(maxTeams, teamCap)}
          onChange={setMaxTeams}
          min={2}
          max={teamCap}
          format={(v) => `${v} · ${v * TEAM_SIZE[mode]} players`}
        />
        <View style={styles.row}>
          <View style={styles.flex}>
            <TextField
              label={`Prize pool (${CURRENCY_SYMBOL})`}
              value={prizePool}
              onChangeText={(v) => setPrizePool(v.replace(/\D/g, ''))}
              keyboardType="number-pad"
              maxLength={7}
            />
          </View>
          <View style={styles.flex}>
            <TextField
              label={`Per kill (${CURRENCY_SYMBOL})`}
              value={perKill}
              onChangeText={(v) => setPerKill(v.replace(/\D/g, ''))}
              keyboardType="number-pad"
              maxLength={5}
            />
          </View>
        </View>
        <AppText variant="caption">
          Registration is free. The prize pool is split 50% / 30% / 20% for the top three; you pay
          winners outside the app.
        </AppText>
      </Card>

      <Card>
        <SectionTitle title="Rules" icon="document-text-outline" />
        <TextField label="One rule per line" value={rules} onChangeText={setRules} multiline />
      </Card>

      <SectionTitle title="Preview" icon="eye-outline" />
      <TournamentCard tournament={draft} now={now} preview />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  row: {
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
