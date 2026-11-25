import { Router } from 'express';

import { currentUser, requireAuth, requireRole } from '../../middlewares/auth.js';
import { otpPhoneLimiter, otpRequestIpLimiter, otpVerifyIpLimiter } from '../../middlewares/rateLimiter.js';
import { parseInput } from '../../utils/errors.js';
import {
  banSchema,
  kycSchema,
  listUsersQuery,
  requestOtpSchema,
  updateProfileSchema,
  userIdParams,
  verifyOtpSchema,
} from './auth.schema.js';
import {
  getProfile,
  listUsers,
  requestOtp,
  setBanned,
  setKycStatus,
  signOutEverywhere,
  updateProfile,
  verifyOtp,
} from './auth.service.js';

export const authRouter = Router();

/** Step 1: send a 6-digit code to the phone number. */
authRouter.post('/otp/request', otpRequestIpLimiter, otpPhoneLimiter, async (req, res) => {
  const { phone } = parseInput(requestOtpSchema, req.body);
  res.json(await requestOtp(phone, req.ip));
});

/** Step 2: exchange the code for an access token. Creates the account on first sign-in. */
authRouter.post('/otp/verify', otpVerifyIpLimiter, otpPhoneLimiter, async (req, res) => {
  const { phone, code } = parseInput(verifyOtpSchema, req.body);
  res.json(await verifyOtp(phone, code));
});

authRouter.post('/sign-out-everywhere', requireAuth, async (req, res) => {
  await signOutEverywhere(currentUser(req).id);
  res.json({ signedOut: true });
});

export const usersRouter = Router();

usersRouter.get('/me', requireAuth, async (req, res) => {
  res.json(await getProfile(currentUser(req).id));
});

usersRouter.patch('/me', requireAuth, async (req, res) => {
  const { displayName } = parseInput(updateProfileSchema, req.body);
  res.json(await updateProfile(currentUser(req).id, displayName));
});

// Admin only.

usersRouter.get('/', requireAuth, requireRole('admin'), async (req, res) => {
  res.json({ users: await listUsers(parseInput(listUsersQuery, req.query)) });
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
