import { Router } from 'express';

import { currentUser, requireAuth, requireRole } from '../../middlewares/auth.js';
import { authAccountLimiter, authIpLimiter } from '../../middlewares/rateLimiter.js';
import { parseInput } from '../../utils/errors.js';
import { banSchema, freeFireUidSchema, kycSchema, loginSchema, registerSchema, userIdParams } from './auth.schema.js';
import { getProfile, login, register, setBanned, setFreeFireUid, setKycStatus, verifyFreeFireUid } from './auth.service.js';

export const authRouter = Router();

authRouter.post('/register', authIpLimiter, async (req, res) => {
  res.status(201).json(await register(parseInput(registerSchema, req.body)));
});

authRouter.post('/login', authIpLimiter, authAccountLimiter, async (req, res) => {
  res.json(await login(parseInput(loginSchema, req.body)));
});

export const usersRouter = Router();

usersRouter.get('/me', requireAuth, async (req, res) => {
  res.json(await getProfile(currentUser(req).id));
});

usersRouter.put('/me/free-fire-uid', requireAuth, async (req, res) => {
  const { freeFireUid } = parseInput(freeFireUidSchema, req.body);
  res.json({ user: await setFreeFireUid(currentUser(req).id, freeFireUid) });
});

usersRouter.post('/:id/verify-uid', requireAuth, requireRole('admin'), async (req, res) => {
  const { id } = parseInput(userIdParams, req.params);
  res.json({ user: await verifyFreeFireUid(currentUser(req).id, id) });
});

usersRouter.put('/:id/kyc', requireAuth, requireRole('admin'), async (req, res) => {
  const { id } = parseInput(userIdParams, req.params);
  const { status } = parseInput(kycSchema, req.body);
  res.json({ user: await setKycStatus(currentUser(req).id, id, status) });
});

usersRouter.put('/:id/ban', requireAuth, requireRole('admin'), async (req, res) => {
  const { id } = parseInput(userIdParams, req.params);
  const { banned, reason } = parseInput(banSchema, req.body);
  res.json({ user: await setBanned(currentUser(req).id, id, banned, reason) });
});
