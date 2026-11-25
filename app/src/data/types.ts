export type Mode = 'Solo' | 'Duo' | 'Squad';

export type GameMap = 'Bermuda' | 'Purgatory' | 'Kalahari' | 'Alpine' | 'NeXTerra';

/** upcoming: registration open. live: match being played. completed: results published. */
export type TournamentStatus = 'upcoming' | 'live' | 'completed';

export interface Player {
  /** In-game name. */
  ign: string;
  /** Numeric in-game player ID. */
  uid: string;
}

export interface Registration {
  id: string;
  /** Profile id of the person who registered the team. */
  userId: string;
  teamName: string;
  players: Player[];
  joinedAt: string;
}

export interface Result {
  registrationId: string;
  /** 1 is the winner. */
  placement: number;
  kills: number;
}

export interface RoomDetails {
  id: string;
  password: string;
  publishedAt: string;
}

export interface Tournament {
  id: string;
  title: string;
  mode: Mode;
  map: GameMap;
  /** ISO date-time. */
  startsAt: string;
  maxTeams: number;
  entryFee: number;
  prizePool: number;
  perKill: number;
  rules: string[];
  hostId: string;
  hostName: string;
  status: TournamentStatus;
  /** Only shown to registered players and the host. */
  room: RoomDetails | null;
  registrations: Registration[];
  results: Result[];
  createdAt: string;
}

export interface Profile {
  id: string;
  ign: string;
  uid: string;
  createdAt: string;
}
