import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, use, useEffect, useMemo, useReducer, type ReactNode } from 'react';

import { MAX_TEAMS, TEAM_SIZE } from '@/constants/config';
import { createId } from '@/utils/device';
import { findRegistration, isFull } from '@/utils/tournament';

import { createSeedTournaments, makeRegistrations } from './seed';
import type { GameMap, Mode, Player, Profile, Tournament } from './types';
import { validateIgn, validateUid } from './validation';

/**
 * App state, saved on this device with AsyncStorage.
 *
 * Every screen reads and changes data through `useStore()`, so moving to a shared
 * backend (Supabase, Firebase or your own API) only means changing this file.
 */

const STORAGE_KEY = 'clutch-arena/state/v1';

interface SavedState {
  profile: Profile | null;
  tournaments: Tournament[];
}

interface State extends SavedState {
  ready: boolean;
}

type Action =
  | { type: 'load'; data: SavedState }
  | { type: 'setProfile'; profile: Profile }
  | { type: 'saveTournament'; tournament: Tournament }
  | { type: 'removeTournament'; id: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'load':
      return { ...action.data, ready: true };
    case 'setProfile':
      return { ...state, profile: action.profile };
    case 'saveTournament': {
      const exists = state.tournaments.some((t) => t.id === action.tournament.id);
      const tournaments = exists
        ? state.tournaments.map((t) => (t.id === action.tournament.id ? action.tournament : t))
        : [action.tournament, ...state.tournaments];
      return { ...state, tournaments };
    }
    case 'removeTournament':
      return { ...state, tournaments: state.tournaments.filter((t) => t.id !== action.id) };
  }
}

function freshState(): SavedState {
  return { profile: null, tournaments: createSeedTournaments(Date.now()) };
}

export type ActionResult = { ok: true } | { ok: false; error: string };

const ok: ActionResult = { ok: true };
const fail = (error: string): ActionResult => ({ ok: false, error });

export interface TournamentInput {
  title: string;
  mode: Mode;
  map: GameMap;
  startsAt: string;
  maxTeams: number;
  entryFee: number;
  prizePool: number;
  perKill: number;
  rules: string[];
}

export interface TeamInput {
  teamName: string;
  players: Player[];
}

interface StoreValue {
  ready: boolean;
  profile: Profile | null;
  tournaments: Tournament[];
  saveProfile: (input: { ign: string; uid: string }) => ActionResult;
  createTournament: (input: TournamentInput) => ActionResult & { id?: string };
  joinTournament: (id: string, team: TeamInput) => ActionResult;
  leaveTournament: (id: string) => ActionResult;
  removeTeam: (id: string, registrationId: string) => ActionResult;
  publishRoom: (id: string, room: { id: string; password: string }) => ActionResult;
  startMatch: (id: string) => ActionResult;
  /** `ranking` lists the teams from 1st place down, with their kills. */
  publishResults: (
    id: string,
    ranking: { registrationId: string; kills: number }[]
  ) => ActionResult;
  deleteTournament: (id: string) => ActionResult;
  /** Development builds only: fills open slots with sample teams, to try the organizer flow on one device. */
  addDemoTeams: (id: string, count: number) => ActionResult;
  resetApp: () => Promise<void>;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { ready: false, profile: null, tournaments: [] });

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => (raw ? (JSON.parse(raw) as SavedState) : freshState()))
      .catch(() => freshState())
      .then((data) => {
        if (!cancelled) dispatch({ type: 'load', data });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!state.ready) return;
    const data: SavedState = { profile: state.profile, tournaments: state.tournaments };
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data)).catch(() => {
      // Storage can be unavailable (for example in a private browser window); the app keeps working in memory.
    });
  }, [state.ready, state.profile, state.tournaments]);

  const value = useMemo<StoreValue>(() => {
    const current = () => state;
    const find = (id: string) => current().tournaments.find((t) => t.id === id);
    const save = (tournament: Tournament) => dispatch({ type: 'saveTournament', tournament });
    const hostOnly = (id: string): Tournament | string => {
      const t = find(id);
      if (!t) return 'Tournament not found';
      if (t.hostId !== current().profile?.id) return 'Only the organizer can do this';
      return t;
    };

    return {
      ...state,

      saveProfile({ ign, uid }) {
        const error = validateIgn(ign) ?? validateUid(uid);
        if (error) return fail(error);
        const existing = current().profile;
        dispatch({
          type: 'setProfile',
          profile: {
            id: existing?.id ?? createId('player-'),
            ign: ign.trim(),
            uid: uid.trim(),
            createdAt: existing?.createdAt ?? new Date().toISOString(),
          },
        });
        return ok;
      },

      createTournament(input) {
        const profile = current().profile;
        if (!profile) return fail('Create your profile first');
        if (input.title.trim().length < 3) return fail('Give the tournament a name');
        if (new Date(input.startsAt).getTime() < Date.now())
          return fail('Pick a start time in the future');
        if (input.maxTeams < 2 || input.maxTeams > MAX_TEAMS[input.mode]) {
          return fail(`${input.mode} rooms take 2–${MAX_TEAMS[input.mode]} teams`);
        }
        const id = createId('t-');
        save({
          ...input,
          id,
          title: input.title.trim(),
          rules: input.rules.map((r) => r.trim()).filter(Boolean),
          hostId: profile.id,
          hostName: profile.ign,
          status: 'upcoming',
          room: null,
          registrations: [],
          results: [],
          createdAt: new Date().toISOString(),
        });
        return { ok: true, id };
      },

      joinTournament(id, team) {
        const t = find(id);
        const profile = current().profile;
        if (!t || !profile) return fail('Tournament not found');
        if (t.hostId === profile.id) return fail("You're the organizer of this tournament");
        if (t.status !== 'upcoming') return fail('Registration is closed');
        if (findRegistration(t, profile.id)) return fail("You've already joined");
        if (isFull(t)) return fail('All slots are taken');
        if (team.players.length !== TEAM_SIZE[t.mode])
          return fail(`Add all ${TEAM_SIZE[t.mode]} players`);

        const players = team.players.map((p) => ({ ign: p.ign.trim(), uid: p.uid.trim() }));
        for (const p of players) {
          const error = validateIgn(p.ign) ?? validateUid(p.uid);
          if (error) return fail(error);
        }
        const uids = players.map((p) => p.uid);
        if (new Set(uids).size !== uids.length)
          return fail('Each player needs a different player ID');
        const taken = t.registrations.flatMap((r) => r.players).find((p) => uids.includes(p.uid));
        if (taken) return fail(`Player ID ${taken.uid} is already registered`);

        const teamName =
          team.teamName.trim() ||
          (TEAM_SIZE[t.mode] === 1 ? players[0].ign : `${players[0].ign}'s team`);
        save({
          ...t,
          registrations: [
            ...t.registrations,
            {
              id: createId('team-'),
              userId: profile.id,
              teamName,
              players,
              joinedAt: new Date().toISOString(),
            },
          ],
        });
        return ok;
      },

      leaveTournament(id) {
        const t = find(id);
        const mine = t && findRegistration(t, current().profile?.id);
        if (!t || !mine) return fail("You haven't joined this tournament");
        if (t.status !== 'upcoming') return fail("You can't leave once the match has started");
        save({ ...t, registrations: t.registrations.filter((r) => r.id !== mine.id) });
        return ok;
      },

      removeTeam(id, registrationId) {
        const t = hostOnly(id);
        if (typeof t === 'string') return fail(t);
        if (t.status !== 'upcoming')
          return fail("Teams can't be removed once the match has started");
        save({ ...t, registrations: t.registrations.filter((r) => r.id !== registrationId) });
        return ok;
      },

      publishRoom(id, room) {
        const t = hostOnly(id);
        if (typeof t === 'string') return fail(t);
        if (!room.id.trim() || !room.password.trim())
          return fail('Enter both the room ID and the password');
        save({
          ...t,
          room: {
            id: room.id.trim(),
            password: room.password.trim(),
            publishedAt: new Date().toISOString(),
          },
        });
        return ok;
      },

      startMatch(id) {
        const t = hostOnly(id);
        if (typeof t === 'string') return fail(t);
        if (t.registrations.length === 0) return fail('No teams have joined yet');
        if (!t.room) return fail('Share the room ID and password first');
        save({ ...t, status: 'live' });
        return ok;
      },

      publishResults(id, ranking) {
        const t = hostOnly(id);
        if (typeof t === 'string') return fail(t);
        if (t.status !== 'live') return fail('Start the match before posting results');
        const ids = new Set(t.registrations.map((r) => r.id));
        if (ranking.length !== ids.size || ranking.some((r) => !ids.has(r.registrationId))) {
          return fail('Rank every team before posting results');
        }
        save({
          ...t,
          status: 'completed',
          results: ranking.map((r, i) => ({
            registrationId: r.registrationId,
            placement: i + 1,
            kills: Math.max(0, Math.round(r.kills)),
          })),
        });
        return ok;
      },

      deleteTournament(id) {
        const t = hostOnly(id);
        if (typeof t === 'string') return fail(t);
        dispatch({ type: 'removeTournament', id });
        return ok;
      },

      addDemoTeams(id, count) {
        const t = hostOnly(id);
        if (typeof t === 'string') return fail(t);
        if (t.status !== 'upcoming') return fail('Registration is closed');
        const room = Math.min(count, t.maxTeams - t.registrations.length);
        if (room <= 0) return fail('All slots are taken');
        const seed = t.registrations.length + 3;
        const demo = makeRegistrations(
          `${t.id}-demo${seed}`,
          t.mode,
          room,
          seed,
          new Date(t.startsAt).getTime()
        );
        save({ ...t, registrations: [...t.registrations, ...demo] });
        return ok;
      },

      async resetApp() {
        await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
        dispatch({ type: 'load', data: freshState() });
      },
    };
  }, [state]);

  return <StoreContext value={value}>{children}</StoreContext>;
}

export function useStore(): StoreValue {
  const store = use(StoreContext);
  if (!store) throw new Error('useStore must be used inside <StoreProvider>');
  return store;
}

export function useTournament(id: string | undefined): Tournament | undefined {
  const { tournaments } = useStore();
  return tournaments.find((t) => t.id === id);
}
