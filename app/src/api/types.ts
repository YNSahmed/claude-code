/** Shapes returned by the Clutch Arena API (backend/). */

export type Mode = 'SOLO' | 'DUO' | 'SQUAD';
export type GameMap = 'BERMUDA' | 'PURGATORY' | 'KALAHARI' | 'ALPINE' | 'NEXTERRA';
export type TournamentStatus = 'OPEN' | 'LOCKED' | 'LIVE' | 'COMPLETED' | 'CANCELLED';
export type Role = 'player' | 'admin';

export interface User {
  id: string;
  phone: string;
  displayName: string | null;
  role: Role;
  needsProfile: boolean;
  createdAt: string;
}

export interface Tournament {
  id: string;
  title: string;
  mode: Mode;
  teamSize: number;
  map: GameMap;
  entryFee: number;
  prizePool: number;
  prizeSplitBps: number[];
  /** Prize for 1st, 2nd, 3rd... place. */
  prizes: number[];
  perKillReward: number;
  maxTeams: number;
  teamsRegistered: number;
  teamsLeft: number;
  startsAt: string;
  status: TournamentStatus;
  rules: string[];
  roomPublished: boolean;
  credentialsReleaseAt: string | null;
}

export interface SquadMember {
  position: number;
  name: string;
  isCaptain: boolean;
  isMe: boolean;
  /** Only present for the organizer, the captain, and your own entry. */
  phone: string | null;
  phoneMasked: string | null;
  freeFireUid: string | null;
}

export type SquadRole = 'captain' | 'member' | 'admin';

export interface Squad {
  id: string;
  name: string;
  slotNumber: number;
  placement: number | null;
  kills: number | null;
  registeredAt: string;
  myRole: SquadRole;
  members: SquadMember[];
  captainAccountName?: string | null;
}

export interface Registration {
  tournament: Tournament;
  squad: {
    id: string;
    name: string;
    slotNumber: number;
    placement: number | null;
    kills: number | null;
    myRole: SquadRole;
  };
}

export interface Standing {
  squadId: string;
  squadName: string;
  placement: number;
  kills: number;
  prize: number;
}

export interface Settings {
  whatsappChannelUrl: string | null;
  organizerName: string | null;
}

export type RoomAccess =
  | { state: 'released'; roomId: string; roomPassword: string }
  | { state: 'locked'; secondsRemaining: number | null; releaseAt: string | null }
  | { state: 'unavailable'; message: string };

export interface AdminUser extends User {
  isBanned: boolean;
  squadsRegistered: number;
}
