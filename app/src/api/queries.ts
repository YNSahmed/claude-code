import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { ApiError, api } from './client';
import type {
  AdminUser,
  GameMap,
  Mode,
  Registration,
  RoomAccess,
  Settings,
  Squad,
  Standing,
  Tournament,
  User,
} from './types';

export const keys = {
  tournaments: (scope: 'active' | 'completed') => ['tournaments', scope] as const,
  tournament: (id: string) => ['tournament', id] as const,
  mySquad: (id: string) => ['my-squad', id] as const,
  myRegistrations: ['my-registrations'] as const,
  room: (id: string) => ['room', id] as const,
  leaderboard: (id: string) => ['leaderboard', id] as const,
  registrations: (id: string) => ['registrations', id] as const,
  settings: ['settings'] as const,
  users: (search: string) => ['users', search] as const,
};

// ---------------------------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------------------------

export function useTournaments(scope: 'active' | 'completed') {
  return useQuery({
    queryKey: keys.tournaments(scope),
    queryFn: () =>
      api<{ tournaments: Tournament[] }>(
        `/tournaments${scope === 'completed' ? '?status=COMPLETED' : ''}`
      ).then((r) => r.tournaments),
  });
}

export function useTournament(id: string) {
  return useQuery({
    queryKey: keys.tournament(id),
    queryFn: () =>
      api<{ tournament: Tournament; squads: { name: string; slotNumber: number }[] }>(
        `/tournaments/${id}`
      ),
  });
}

export function useMySquad(id: string) {
  return useQuery({
    queryKey: keys.mySquad(id),
    queryFn: () => api<{ squad: Squad | null }>(`/tournaments/${id}/my-squad`).then((r) => r.squad),
  });
}

export function useMyRegistrations() {
  return useQuery({
    queryKey: keys.myRegistrations,
    queryFn: () =>
      api<{ registrations: Registration[] }>('/tournaments/me/registrations').then(
        (r) => r.registrations
      ),
  });
}

/** Room ID and password, or why they are not available yet (with a countdown). */
export function useRoomAccess(id: string, enabled: boolean) {
  return useQuery({
    queryKey: keys.room(id),
    enabled,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.state !== 'locked' || data.secondsRemaining === null) return false;
      return Math.min(Math.max(data.secondsRemaining * 1000, 5000), 60_000);
    },
    queryFn: async (): Promise<RoomAccess> => {
      try {
        const r = await api<{ roomId: string; roomPassword: string }>(
          `/tournaments/${id}/room-credentials`
        );
        return { state: 'released', roomId: r.roomId, roomPassword: r.roomPassword };
      } catch (error) {
        if (error instanceof ApiError && error.code === 'CREDENTIALS_NOT_RELEASED') {
          return {
            state: 'locked',
            secondsRemaining:
              (error.details?.secondsRemaining as number | null | undefined) ?? null,
            releaseAt: (error.details?.releaseAt as string | null | undefined) ?? null,
          };
        }
        if (error instanceof ApiError && error.status === 403)
          return { state: 'unavailable', message: error.message };
        throw error;
      }
    },
  });
}

export function useLeaderboard(id: string, enabled: boolean) {
  return useQuery({
    queryKey: keys.leaderboard(id),
    enabled,
    queryFn: () =>
      api<{ standings: Standing[] }>(`/tournaments/${id}/leaderboard`).then((r) => r.standings),
  });
}

export function useSettings() {
  return useQuery({
    queryKey: keys.settings,
    staleTime: 5 * 60_000,
    queryFn: () => api<{ settings: Settings }>('/settings').then((r) => r.settings),
  });
}

// Organizer only.

export function useRegistrations(id: string) {
  return useQuery({
    queryKey: keys.registrations(id),
    queryFn: () =>
      api<{ tournament: Tournament; squads: Squad[] }>(`/tournaments/${id}/registrations`),
  });
}

export function useUsers(search: string) {
  return useQuery({
    queryKey: keys.users(search),
    queryFn: () =>
      api<{ users: AdminUser[] }>(
        `/users?limit=100${search ? `&search=${encodeURIComponent(search)}` : ''}`
      ).then((r) => r.users),
  });
}

// ---------------------------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------------------------

/** Refreshes everything that shows a tournament after it changes. */
function useInvalidateTournament() {
  const client = useQueryClient();
  return (id?: string) => {
    void client.invalidateQueries({ queryKey: ['tournaments'] });
    void client.invalidateQueries({ queryKey: keys.myRegistrations });
    if (id) {
      for (const key of [
        keys.tournament(id),
        keys.mySquad(id),
        keys.room(id),
        keys.leaderboard(id),
        keys.registrations(id),
      ]) {
        void client.invalidateQueries({ queryKey: key });
      }
    }
  };
}

export interface RegisterSquadBody {
  squadName: string;
  captain: { name: string; freeFireUid?: string };
  teammates: { name: string; phone: string; freeFireUid?: string }[];
  consent: true;
}

export function useRegisterSquad(id: string) {
  const invalidate = useInvalidateTournament();
  return useMutation({
    mutationFn: ({ body, key }: { body: RegisterSquadBody; key: string }) =>
      api<{ squad: Squad }>(`/tournaments/${id}/squads`, {
        method: 'POST',
        body,
        idempotencyKey: key,
      }),
    onSuccess: () => invalidate(id),
  });
}

export function useWithdrawSquad(id: string) {
  const invalidate = useInvalidateTournament();
  return useMutation({
    mutationFn: () =>
      api<{ withdrawn: boolean }>(`/tournaments/${id}/my-squad`, { method: 'DELETE' }),
    onSuccess: () => invalidate(id),
  });
}

export function useUpdateProfile() {
  return useMutation({
    mutationFn: (displayName: string) =>
      api<{ user: User }>('/users/me', { method: 'PATCH', body: { displayName } }),
  });
}

export interface CreateTournamentBody {
  title: string;
  mode: Mode;
  map: GameMap;
  prizePool: number;
  perKillReward: number;
  maxTeams: number;
  startsAt: string;
  rules: string[];
}

export function useCreateTournament() {
  const invalidate = useInvalidateTournament();
  return useMutation({
    mutationFn: (body: CreateTournamentBody) =>
      api<{ tournament: Tournament }>('/tournaments', { method: 'POST', body }),
    onSuccess: () => invalidate(),
  });
}

export function useSetRoom(id: string) {
  const invalidate = useInvalidateTournament();
  return useMutation({
    mutationFn: (body: { roomId: string; roomPassword: string; releaseAt: string }) =>
      api<{ tournament: Tournament }>(`/tournaments/${id}/room`, { method: 'PUT', body }),
    onSuccess: () => invalidate(id),
  });
}

export function useSetStatus(id: string) {
  const invalidate = useInvalidateTournament();
  return useMutation({
    mutationFn: (status: 'LOCKED' | 'LIVE') =>
      api<{ tournament: Tournament }>(`/tournaments/${id}/status`, {
        method: 'PATCH',
        body: { status },
      }),
    onSuccess: () => invalidate(id),
  });
}

export function usePublishResults(id: string) {
  const invalidate = useInvalidateTournament();
  return useMutation({
    mutationFn: ({
      results,
      key,
    }: {
      results: { squadId: string; placement: number; kills: number }[];
      key: string;
    }) =>
      api(`/tournaments/${id}/results`, { method: 'POST', body: { results }, idempotencyKey: key }),
    onSuccess: () => invalidate(id),
  });
}

export function useCancelTournament(id: string) {
  const invalidate = useInvalidateTournament();
  return useMutation({
    mutationFn: ({ reason, key }: { reason: string; key: string }) =>
      api(`/tournaments/${id}/cancel`, { method: 'POST', body: { reason }, idempotencyKey: key }),
    onSuccess: () => invalidate(id),
  });
}

export function useRemoveSquad(id: string) {
  const invalidate = useInvalidateTournament();
  return useMutation({
    mutationFn: ({ squadId, reason }: { squadId: string; reason: string }) =>
      api(`/tournaments/${id}/squads/${squadId}`, { method: 'DELETE', body: { reason } }),
    onSuccess: () => invalidate(id),
  });
}

export function useUpdateSettings() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: { whatsappChannelUrl?: string | null; organizerName?: string | null }) =>
      api<{ settings: Settings }>('/settings', { method: 'PUT', body }).then((r) => r.settings),
    onSuccess: (settings) => client.setQueryData(keys.settings, settings),
  });
}
