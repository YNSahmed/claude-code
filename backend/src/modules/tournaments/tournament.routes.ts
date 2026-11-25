import { Router } from 'express';

import { currentUser, requireAuth, requireRole } from '../../middlewares/auth.js';
import { idempotency } from '../../middlewares/idempotency.js';
import { joinLimiter } from '../../middlewares/rateLimiter.js';
import { parseInput } from '../../utils/errors.js';
import {
  cancelSchema,
  createTournamentSchema,
  listTournamentsQuery,
  roomCredentialsSchema,
  settleSchema,
  tournamentIdParams,
  updateStatusSchema,
} from './tournament.schema.js';
import {
  cancelTournament,
  createTournament,
  getRoomCredentials,
  getTournament,
  joinTournament,
  listMyEntries,
  listTournaments,
  setRoomCredentials,
  settleTournament,
  updateTournamentStatus,
} from './tournament.service.js';

export const tournamentRouter = Router();

// ---------------------------------------------------------------------------------------------
// Public and player
// ---------------------------------------------------------------------------------------------

tournamentRouter.get('/', async (req, res) => {
  res.json({ tournaments: await listTournaments(parseInput(listTournamentsQuery, req.query)) });
});

tournamentRouter.get('/me/entries', requireAuth, async (req, res) => {
  res.json({ entries: await listMyEntries(currentUser(req).id) });
});

tournamentRouter.get('/:id', async (req, res) => {
  const { id } = parseInput(tournamentIdParams, req.params);
  res.json({ tournament: await getTournament(id) });
});

tournamentRouter.post(
  '/:id/join',
  requireAuth,
  joinLimiter,
  idempotency({ scope: 'POST /tournaments/:id/join' }),
  async (req, res) => {
    const { id } = parseInput(tournamentIdParams, req.params);
    res.status(201).json(await joinTournament(currentUser(req).id, id));
  }
);

tournamentRouter.get('/:id/room-credentials', requireAuth, async (req, res) => {
  const { id } = parseInput(tournamentIdParams, req.params);
  res.json(await getRoomCredentials(currentUser(req), id));
});

// ---------------------------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------------------------

tournamentRouter.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  const input = parseInput(createTournamentSchema, req.body);
  res.status(201).json({ tournament: await createTournament(currentUser(req).id, input) });
});

tournamentRouter.put('/:id/room', requireAuth, requireRole('admin'), async (req, res) => {
  const { id } = parseInput(tournamentIdParams, req.params);
  const input = parseInput(roomCredentialsSchema, req.body);
  res.json({ tournament: await setRoomCredentials(currentUser(req).id, id, input) });
});

tournamentRouter.patch('/:id/status', requireAuth, requireRole('admin'), async (req, res) => {
  const { id } = parseInput(tournamentIdParams, req.params);
  const { status } = parseInput(updateStatusSchema, req.body);
  res.json({ tournament: await updateTournamentStatus(currentUser(req).id, id, status) });
});

tournamentRouter.post(
  '/:id/settle',
  requireAuth,
  requireRole('admin'),
  idempotency({ scope: 'POST /tournaments/:id/settle' }),
  async (req, res) => {
    const { id } = parseInput(tournamentIdParams, req.params);
    const input = parseInput(settleSchema, req.body);
    res.json(await settleTournament(currentUser(req).id, id, input));
  }
);

tournamentRouter.post(
  '/:id/cancel',
  requireAuth,
  requireRole('admin'),
  idempotency({ scope: 'POST /tournaments/:id/cancel' }),
  async (req, res) => {
    const { id } = parseInput(tournamentIdParams, req.params);
    const { reason } = parseInput(cancelSchema, req.body);
    res.json(await cancelTournament(currentUser(req).id, id, reason));
  }
);
