import { Router, type NextFunction, type Request, type Response } from 'express';

import { env } from '../../config/env.js';
import { currentUser, requireAuth, requireRole } from '../../middlewares/auth.js';
import { idempotency } from '../../middlewares/idempotency.js';
import { depositLimiter, webhookLimiter, withdrawLimiter } from '../../middlewares/rateLimiter.js';
import { verifyHmacSha256Signature } from '../../utils/crypto.js';
import { AppError, parseInput } from '../../utils/errors.js';
import { razorpayWebhookSchema } from './payment-gateway.js';
import {
  adminWithdrawalsQuerySchema,
  approveWithdrawalSchema,
  createDepositOrderSchema,
  grantBonusSchema,
  rejectWithdrawalSchema,
  transactionsQuerySchema,
  withdrawalIdParams,
  withdrawSchema,
} from './wallet.schema.js';
import {
  approveWithdrawal,
  createDepositOrder,
  getBalance,
  grantBonus,
  handleGatewayWebhook,
  listTransactions,
  listWithdrawals,
  listWithdrawalsForReview,
  rejectWithdrawal,
  requestWithdrawal,
} from './wallet.service.js';

export const walletRouter = Router();

/** Rejects any webhook whose X-Razorpay-Signature is not a valid HMAC of the raw body. */
function verifyGatewaySignature(req: Request, _res: Response, next: NextFunction): void {
  const secret = env.RAZORPAY_WEBHOOK_SECRET;
  const valid =
    secret !== undefined &&
    secret.length >= 16 &&
    req.rawBody !== undefined &&
    verifyHmacSha256Signature(req.rawBody, req.get('x-razorpay-signature'), secret);
  if (!valid) throw new AppError(401, 'INVALID_SIGNATURE', 'Invalid webhook signature.');
  next();
}

// ---------------------------------------------------------------------------------------------
// Player
// ---------------------------------------------------------------------------------------------

walletRouter.get('/balance', requireAuth, async (req, res) => {
  res.json(await getBalance(currentUser(req).id));
});

walletRouter.get('/transactions', requireAuth, async (req, res) => {
  const query = parseInput(transactionsQuerySchema, req.query);
  res.json({ transactions: await listTransactions(currentUser(req).id, query) });
});

walletRouter.post(
  '/deposit/orders',
  requireAuth,
  depositLimiter,
  idempotency({ scope: 'POST /wallet/deposit/orders' }),
  async (req, res) => {
    const { amount } = parseInput(createDepositOrderSchema, req.body);
    res.status(201).json(await createDepositOrder(currentUser(req).id, amount));
  }
);

/**
 * Payment gateway webhook. Order: rate limit → HMAC signature on the raw body → idempotency
 * (keyed by Idempotency-Key, or the gateway's X-Razorpay-Event-Id) → credit.
 * Unknown or irrelevant events still get 200 so the gateway stops retrying them.
 */
walletRouter.post(
  '/deposit/webhook',
  webhookLimiter,
  verifyGatewaySignature,
  idempotency({
    scope: 'POST /wallet/deposit/webhook',
    keyHeaders: ['Idempotency-Key', 'X-Razorpay-Event-Id'],
    owner: () => `gateway:${env.PAYMENT_GATEWAY}`,
  }),
  async (req, res) => {
    const event = parseInput(razorpayWebhookSchema, req.body);
    res.json({ received: true, outcome: await handleGatewayWebhook(event) });
  }
);

walletRouter.post(
  '/withdraw',
  requireAuth,
  withdrawLimiter,
  idempotency({ scope: 'POST /wallet/withdraw' }),
  async (req, res) => {
    const input = parseInput(withdrawSchema, req.body);
    const key = req.get('Idempotency-Key') as string; // Guaranteed by the idempotency middleware.
    const result = await requestWithdrawal(currentUser(req).id, input, key);
    res.status(result.replayed ? 200 : 201).json({ withdrawal: result.withdrawal, balance: result.balance });
  }
);

walletRouter.get('/withdrawals', requireAuth, async (req, res) => {
  res.json({ withdrawals: await listWithdrawals(currentUser(req).id) });
});

// ---------------------------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------------------------

walletRouter.get('/admin/withdrawals', requireAuth, requireRole('admin'), async (req, res) => {
  const { status, limit } = parseInput(adminWithdrawalsQuerySchema, req.query);
  res.json({ withdrawals: await listWithdrawalsForReview(status, limit) });
});

walletRouter.post(
  '/admin/withdrawals/:id/approve',
  requireAuth,
  requireRole('admin'),
  idempotency({ scope: 'POST /wallet/admin/withdrawals/:id/approve' }),
  async (req, res) => {
    const { id } = parseInput(withdrawalIdParams, req.params);
    const { payoutReference } = parseInput(approveWithdrawalSchema, req.body);
    res.json({ withdrawal: await approveWithdrawal(currentUser(req).id, id, payoutReference) });
  }
);

walletRouter.post(
  '/admin/withdrawals/:id/reject',
  requireAuth,
  requireRole('admin'),
  idempotency({ scope: 'POST /wallet/admin/withdrawals/:id/reject' }),
  async (req, res) => {
    const { id } = parseInput(withdrawalIdParams, req.params);
    const { reason } = parseInput(rejectWithdrawalSchema, req.body);
    res.json({ withdrawal: await rejectWithdrawal(currentUser(req).id, id, reason) });
  }
);

walletRouter.post(
  '/admin/bonus',
  requireAuth,
  requireRole('admin'),
  idempotency({ scope: 'POST /wallet/admin/bonus' }),
  async (req, res) => {
    const input = parseInput(grantBonusSchema, req.body);
    res.status(201).json(await grantBonus(currentUser(req).id, input));
  }
);
