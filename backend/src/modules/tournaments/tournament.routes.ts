import { Router } from 'express';

import { currentUser, requireAuth, requireRole } from '../../middlewares/auth.js';
import { idempotency } from '../../middlewares/idempotency.js';
import { squadLimiter } from '../../middlewares/rateLimiter.js';
import { parseInput } from '../../utils/errors.js';
import {
  getMySquad,
  getRoomCredentials,
  listMyRegistrations,
  listRegistrations,
  registerSquad,
  removeSquad,
  withdrawSquad,
} from './squad.service.js';
import {
  cancelSchema,
  createTournamentSchema,
  listTournamentsQuery,
  registerSquadSchema,
  removeSquadSchema,
  resultsSchema,
  roomCredentialsSchema,
  squadParams,
  tournamentIdParams,
  updateStatusSchema,
} from './tournament.schema.js';
import {
  cancelTournament,
  createTournament,
  getLeaderboard,
  getTournament,
  listTournaments,
  publishResults,
  setRoomCredentials,
  updateTournamentStatus,
} from './tournament.service.js';

export const tournamentRouter = Router();

// ---------------------------------------------------------------------------------------------
// Public
// ---------------------------------------------------------------------------------------------

tournamentRouter.get('/', async (req, res) => {
  res.json({ tournaments: await listTournaments(parseInput(listTournamentsQuery, req.query)) });
});

tournamentRouter.get('/me/registrations', requireAuth, async (req, res) => {
  res.json({ registrations: await listMyRegistrations(currentUser(req).id) });
});

tournamentRouter.get('/:id', async (req, res) => {
  const { id } = parseInput(tournamentIdParams, req.params);
  res.json(await getTournament(id));
});

tournamentRouter.get('/:id/leaderboard', async (req, res) => {
  const { id } = parseInput(tournamentIdParams, req.params);
  res.json(await getLeaderboard(id));
});

// ---------------------------------------------------------------------------------------------
// Players
// ---------------------------------------------------------------------------------------------

tournamentRouter.post(
  '/:id/squads',
  requireAuth,
  squadLimiter,
  idempotency({ scope: 'POST /tournaments/:id/squads' }),
  async (req, res) => {
    const { id } = parseInput(tournamentIdParams, req.params);
    const input = parseInput(registerSquadSchema, req.body);
    res.status(201).json(await registerSquad(currentUser(req).id, id, input));
  }
);

tournamentRouter.get('/:id/my-squad', requireAuth, async (req, res) => {
  const { id } = parseInput(tournamentIdParams, req.params);
  res.json(await getMySquad(currentUser(req).id, id));
});

tournamentRouter.delete('/:id/my-squad', requireAuth, squadLimiter, async (req, res) => {
  const { id } = parseInput(tournamentIdParams, req.params);
  res.json(await withdrawSquad(currentUser(req).id, id));
});

tournamentRouter.get('/:id/room-credentials', requireAuth, async (req, res) => {
  const { id } = parseInput(tournamentIdParams, req.params);
  res.json(await getRoomCredentials(currentUser(req), id));
});

// ---------------------------------------------------------------------------------------------
// Organizer (admin)
// ---------------------------------------------------------------------------------------------

const admin = [requireAuth, requireRole('admin')];

tournamentRouter.post('/', ...admin, async (req, res) => {
  const input = parseInput(createTournamentSchema, req.body);
  res.status(201).json({ tournament: await createTournament(currentUser(req).id, input) });
});

tournamentRouter.get('/:id/registrations', ...admin, async (req, res) => {
  const { id } = parseInput(tournamentIdParams, req.params);
  res.json(await listRegistrations(id));
});

tournamentRouter.delete('/:id/squads/:squadId', ...admin, async (req, res) => {
  const { id, squadId } = parseInput(squadParams, req.params);
  const { reason } = parseInput(removeSquadSchema, req.body);
  res.json(await removeSquad(currentUser(req).id, id, squadId, reason));
});

tournamentRouter.put('/:id/room', ...admin, async (req, res) => {
  const { id } = parseInput(tournamentIdParams, req.params);
  const input = parseInput(roomCredentialsSchema, req.body);
  res.json({ tournament: await setRoomCredentials(currentUser(req).id, id, input) });
});

tournamentRouter.patch('/:id/status', ...admin, async (req, res) => {
  const { id } = parseInput(tournamentIdParams, req.params);
  const { status } = parseInput(updateStatusSchema, req.body);
  res.json({ tournament: await updateTournamentStatus(currentUser(req).id, id, status) });
});

tournamentRouter.post('/:id/results', ...admin, idempotency({ scope: 'POST /tournaments/:id/results' }), async (req, res) => {
  const { id } = parseInput(tournamentIdParams, req.params);
  const input = parseInput(resultsSchema, req.body);
  res.json(await publishResults(currentUser(req).id, id, input));
});

tournamentRouter.post('/:id/cancel', ...admin, idempotency({ scope: 'POST /tournaments/:id/cancel' }), async (req, res) => {
  const { id } = parseInput(tournamentIdParams, req.params);
  const { reason } = parseInput(cancelSchema, req.body);
  res.json(await cancelTournament(currentUser(req).id, id, reason));
});
