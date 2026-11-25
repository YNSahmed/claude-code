import { randomUUID } from 'node:crypto';

import { pool, withTransaction, type DbClient, type Queryable } from '../../config/db.js';
import { env } from '../../config/env.js';
import { recordAdminAction } from '../../utils/audit.js';
import { badRequest, conflict, forbidden, notFound } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import { paymentGateway, type RazorpayWebhook } from './payment-gateway.js';

// =============================================================================================
// Ledger writer
// =============================================================================================

export type UserAccount = 'DEPOSIT' | 'WINNING' | 'BONUS' | 'LOCKED';
export type SystemAccount =
  | 'SYS_GATEWAY'
  | 'SYS_TOURNAMENT_POOL'
  | 'SYS_PAYOUT'
  | 'SYS_TDS_PAYABLE'
  | 'SYS_PLATFORM_FEE'
  | 'SYS_PROMO';

type BalanceColumn = 'deposit_balance' | 'winning_balance' | 'bonus_balance' | 'locked_balance';

const BALANCE_COLUMN: Record<UserAccount, BalanceColumn> = {
  DEPOSIT: 'deposit_balance',
  WINNING: 'winning_balance',
  BONUS: 'bonus_balance',
  LOCKED: 'locked_balance',
};

export interface WalletRow {
  user_id: string;
  deposit_balance: number;
  winning_balance: number;
  bonus_balance: number;
  locked_balance: number;
}

/** A signed token amount: positive credits the account, negative debits it. */
export type Movement =
  | { userId: string; account: UserAccount; amount: number }
  | { userId?: undefined; account: SystemAccount; amount: number };

export interface LedgerPosting {
  referenceType: string;
  referenceId: string;
  reason: string;
  movements: Movement[];
}

/**
 * Locks wallet rows with SELECT ... FOR UPDATE, always in user_id order so two transactions
 * touching the same wallets can never deadlock. Locking again inside the same transaction is free.
 */
export async function lockWallets(client: DbClient, userIds: string[]): Promise<Map<string, WalletRow>> {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return new Map();
  const { rows } = await client.query<WalletRow>(
    `SELECT user_id, deposit_balance, winning_balance, bonus_balance, locked_balance
       FROM wallets
      WHERE user_id = ANY($1::uuid[])
      ORDER BY user_id
        FOR UPDATE`,
    [ids]
  );
  if (rows.length !== ids.length) throw notFound('Wallet');
  return new Map(rows.map((row) => [row.user_id, row]));
}

export async function lockWallet(client: DbClient, userId: string): Promise<WalletRow> {
  const wallet = (await lockWallets(client, [userId])).get(userId);
  if (!wallet) throw notFound('Wallet');
  return wallet;
}

/**
 * The only code that changes wallet balances. Must run inside withTransaction.
 *
 * Checks the movements balance to zero, locks every affected wallet, refuses any balance going
 * below zero, updates the wallets and appends one immutable ledger entry per movement with the
 * balance before and after. The database re-checks all of this (CHECK constraints plus a
 * deferred trigger that refuses to commit an unbalanced transaction).
 */
export async function postLedger(client: DbClient, posting: LedgerPosting): Promise<{ txnId: string | null }> {
  const movements = posting.movements.filter((m) => m.amount !== 0);
  if (movements.length === 0) return { txnId: null };
  for (const m of movements) {
    if (!Number.isSafeInteger(m.amount)) throw new Error(`Ledger amount must be a whole number, got ${m.amount}`);
  }
  const imbalance = movements.reduce((sum, m) => sum + m.amount, 0);
  if (imbalance !== 0) throw new Error(`Ledger posting ${posting.referenceType}/${posting.referenceId} is unbalanced by ${imbalance}`);

  const wallets = await lockWallets(
    client,
    movements.flatMap((m) => (m.userId ? [m.userId] : []))
  );

  const entries = movements.map((m) => {
    const direction = m.amount > 0 ? 'CREDIT' : 'DEBIT';
    if (!m.userId) {
      return { userId: null, account: m.account, direction, amount: Math.abs(m.amount), before: null, after: null };
    }
    const wallet = wallets.get(m.userId);
    if (!wallet) throw notFound('Wallet');
    const column = BALANCE_COLUMN[m.account];
    const before = wallet[column];
    const after = before + m.amount;
    if (after < 0) {
      throw conflict('INSUFFICIENT_BALANCE', 'Not enough balance.', { account: m.account, available: before, required: -m.amount });
    }
    wallet[column] = after;
    return { userId: m.userId, account: m.account, direction, amount: Math.abs(m.amount), before, after };
  });

  for (const wallet of wallets.values()) {
    await client.query(
      `UPDATE wallets
          SET deposit_balance = $2, winning_balance = $3, bonus_balance = $4, locked_balance = $5,
              version = version + 1
        WHERE user_id = $1`,
      [wallet.user_id, wallet.deposit_balance, wallet.winning_balance, wallet.bonus_balance, wallet.locked_balance]
    );
  }

  const txnId = randomUUID();
  await client.query(
    `INSERT INTO ledger_entries
       (txn_id, user_id, account, direction, amount, balance_before, balance_after, reference_type, reference_id, reason)
     SELECT $1, e.user_id, e.account, e.direction, e.amount, e.balance_before, e.balance_after, $2, $3, $4
       FROM unnest($5::uuid[], $6::text[], $7::text[], $8::bigint[], $9::bigint[], $10::bigint[])
         AS e(user_id, account, direction, amount, balance_before, balance_after)`,
    [
      txnId,
      posting.referenceType,
      posting.referenceId,
      posting.reason,
      entries.map((e) => e.userId),
      entries.map((e) => e.account),
      entries.map((e) => e.direction),
      entries.map((e) => e.amount),
      entries.map((e) => e.before),
      entries.map((e) => e.after),
    ]
  );

  return { txnId };
}

// =============================================================================================
// Balances and history
// =============================================================================================

export function toBalanceDto(wallet: WalletRow) {
  return {
    deposit: wallet.deposit_balance,
    winning: wallet.winning_balance,
    bonus: wallet.bonus_balance,
    locked: wallet.locked_balance,
    /** Only winnings can be withdrawn. */
    withdrawable: wallet.winning_balance,
  };
}

export async function getBalance(userId: string, db: Queryable = pool) {
  const { rows } = await db.query<WalletRow>(
    'SELECT user_id, deposit_balance, winning_balance, bonus_balance, locked_balance FROM wallets WHERE user_id = $1',
    [userId]
  );
  if (!rows[0]) throw notFound('Wallet');
  return toBalanceDto(rows[0]);
}

export async function listTransactions(userId: string, options: { limit: number; before?: number | undefined }) {
  const { rows } = await pool.query(
    `SELECT id, txn_id, account, direction, amount, balance_before, balance_after,
            reference_type, reference_id, reason, created_at
       FROM ledger_entries
      WHERE user_id = $1 AND ($2::bigint IS NULL OR id < $2)
      ORDER BY id DESC
      LIMIT $3`,
    [userId, options.before ?? null, options.limit]
  );
  return rows.map((r) => ({
    id: r.id,
    txnId: r.txn_id,
    account: r.account,
    direction: r.direction,
    amount: r.amount,
    balanceBefore: r.balance_before,
    balanceAfter: r.balance_after,
    referenceType: r.reference_type,
    referenceId: r.reference_id,
    reason: r.reason,
    createdAt: r.created_at,
  }));
}

// =============================================================================================
// Deposits
// =============================================================================================

/**
 * Creates a gateway order for `amount` tokens. The amount the player pays is fixed here, on the
 * server; the webhook later checks the captured payment matches it exactly before crediting.
 */
export async function createDepositOrder(userId: string, amount: number) {
  const paymentOrderId = randomUUID();
  const { gatewayOrderId } = await paymentGateway.createOrder({ amountPaise: amount * 100, receipt: paymentOrderId });

  await pool.query(
    `INSERT INTO payment_orders (id, user_id, gateway, gateway_order_id, amount)
     VALUES ($1, $2, $3, $4, $5)`,
    [paymentOrderId, userId, paymentGateway.name, gatewayOrderId, amount]
  );

  return {
    paymentOrderId,
    gateway: paymentGateway.name,
    gatewayOrderId,
    amount,
    amountPaise: amount * 100,
    currency: 'INR',
    /** Public key for the gateway's checkout SDK. */
    keyId: env.RAZORPAY_KEY_ID,
  };
}

type WebhookOutcome = 'credited' | 'already_processed' | 'marked_failed' | 'ignored' | 'unknown_order' | 'amount_mismatch';

/**
 * Applies a signature-verified gateway webhook. Who gets credited and how much always comes from
 * our payment_orders row, never from the webhook body. Safe to receive any number of times.
 */
export async function handleGatewayWebhook(event: RazorpayWebhook): Promise<WebhookOutcome> {
  const payment = event.payload.payment?.entity;
  if (!payment?.order_id) return 'ignored';

  if (event.event === 'payment.captured' || event.event === 'order.paid') {
    if (payment.status !== 'captured') return 'ignored';
    return creditDeposit(payment.order_id, payment.id, payment.amount, payment.currency);
  }

  if (event.event === 'payment.failed') {
    const { rowCount } = await pool.query(
      `UPDATE payment_orders SET status = 'FAILED', failure_reason = $3
        WHERE gateway = $1 AND gateway_order_id = $2 AND status = 'CREATED'`,
      [paymentGateway.name, payment.order_id, (payment.error_description ?? 'Payment failed').slice(0, 300)]
    );
    return rowCount ? 'marked_failed' : 'ignored';
  }

  return 'ignored';
}

async function creditDeposit(gatewayOrderId: string, gatewayPaymentId: string, paidPaise: number, currency: string) {
  return withTransaction<WebhookOutcome>(async (client) => {
    const { rows } = await client.query<{ id: string; user_id: string; amount: number; status: string }>(
      `SELECT id, user_id, amount, status
         FROM payment_orders
        WHERE gateway = $1 AND gateway_order_id = $2
          FOR UPDATE`,
      [paymentGateway.name, gatewayOrderId]
    );
    const order = rows[0];
    if (!order) {
      logger.warn('Webhook for an unknown order', { gatewayOrderId });
      return 'unknown_order';
    }
    if (order.status === 'PAID') return 'already_processed';

    if (currency !== 'INR' || paidPaise !== order.amount * 100) {
      // Money was captured but does not match what we asked for: never guess, flag for review.
      await client.query(
        `UPDATE payment_orders SET status = 'FAILED', failure_reason = $2 WHERE id = $1`,
        [order.id, `Captured ${paidPaise} ${currency} paise, expected ${order.amount * 100} INR paise`]
      );
      logger.error('Deposit amount mismatch: needs manual review', { paymentOrderId: order.id, gatewayOrderId });
      return 'amount_mismatch';
    }

    await client.query(
      `UPDATE payment_orders SET status = 'PAID', gateway_payment_id = $2, paid_at = now(), failure_reason = NULL
        WHERE id = $1`,
      [order.id, gatewayPaymentId]
    );
    await postLedger(client, {
      referenceType: 'PAYMENT_ORDER',
      referenceId: order.id,
      reason: `Deposit via ${paymentGateway.name}`,
      movements: [
        { userId: order.user_id, account: 'DEPOSIT', amount: order.amount },
        { account: 'SYS_GATEWAY', amount: -order.amount },
      ],
    });
    return 'credited';
  });
}

// =============================================================================================
// Withdrawals
// =============================================================================================

export interface WithdrawalRow {
  id: string;
  user_id: string;
  upi_id: string;
  gross_amount: number;
  tds_amount: number;
  fee_amount: number;
  net_amount: number;
  status: 'PENDING' | 'PAID' | 'REJECTED';
  payout_reference: string | null;
  rejection_reason: string | null;
  created_at: Date;
  processed_at: Date | null;
}

export function toWithdrawalDto(w: WithdrawalRow) {
  return {
    id: w.id,
    upiId: w.upi_id,
    grossAmount: w.gross_amount,
    tdsAmount: w.tds_amount,
    feeAmount: w.fee_amount,
    netAmount: w.net_amount,
    status: w.status,
    payoutReference: w.payout_reference,
    rejectionReason: w.rejection_reason,
    createdAt: w.created_at,
    processedAt: w.processed_at,
  };
}

/** Tax and fee are rounded up so the platform never under-withholds. */
export function withdrawalBreakdown(gross: number) {
  const tds = Math.ceil((gross * env.TDS_RATE_BPS) / 10_000);
  const fee = Math.ceil((gross * env.WITHDRAWAL_FEE_BPS) / 10_000);
  return { gross, tds, fee, net: gross - tds - fee };
}

/**
 * Locks `amount` winnings for payout. In one transaction: checks KYC and limits, locks the wallet
 * (FOR UPDATE), checks winning_balance, moves the tokens from winning to locked, writes the ledger
 * and creates a PENDING withdrawal. The (user, idempotency key) unique constraint means a retried
 * request returns the original withdrawal instead of creating a second one.
 */
export async function requestWithdrawal(userId: string, input: { amount: number; upiId: string }, idempotencyKey: string) {
  try {
    return await withTransaction(async (client) => {
      const { rows: users } = await client.query<{ kyc_status: string }>(
        'SELECT kyc_status FROM users WHERE id = $1 FOR SHARE',
        [userId]
      );
      if (!users[0]) throw notFound('User');
      if (users[0].kyc_status !== 'VERIFIED') {
        throw forbidden('KYC_REQUIRED', 'Complete KYC verification before withdrawing.');
      }
      if (input.amount < env.MIN_WITHDRAWAL || input.amount > env.MAX_WITHDRAWAL) {
        throw badRequest('WITHDRAWAL_LIMIT', `Withdrawals must be between ${env.MIN_WITHDRAWAL} and ${env.MAX_WITHDRAWAL} tokens.`);
      }

      const wallet = await lockWallet(client, userId);
      if (wallet.winning_balance < input.amount) {
        throw conflict('INSUFFICIENT_WINNINGS', 'Only winnings can be withdrawn, and you do not have enough.', {
          withdrawable: wallet.winning_balance,
        });
      }

      const { gross, tds, fee, net } = withdrawalBreakdown(input.amount);
      if (net <= 0) throw badRequest('WITHDRAWAL_TOO_SMALL', 'This amount is too small to pay out after tax and fees.');

      const { rows } = await client.query<WithdrawalRow>(
        `INSERT INTO withdrawal_requests (user_id, idempotency_key, upi_id, gross_amount, tds_amount, fee_amount, net_amount)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [userId, idempotencyKey, input.upiId, gross, tds, fee, net]
      );
      const withdrawal = rows[0];
      if (!withdrawal) throw new Error('Withdrawal insert returned no row');

      await postLedger(client, {
        referenceType: 'WITHDRAWAL',
        referenceId: withdrawal.id,
        reason: 'Withdrawal requested: winnings locked',
        movements: [
          { userId, account: 'WINNING', amount: -gross },
          { userId, account: 'LOCKED', amount: gross },
        ],
      });

      return { withdrawal: toWithdrawalDto(withdrawal), balance: await getBalance(userId, client), replayed: false };
    });
  } catch (error) {
    if ((error as { constraint?: string }).constraint === 'withdrawal_requests_idempotency_key') {
      const { rows } = await pool.query<WithdrawalRow>(
        'SELECT * FROM withdrawal_requests WHERE user_id = $1 AND idempotency_key = $2',
        [userId, idempotencyKey]
      );
      if (rows[0]) return { withdrawal: toWithdrawalDto(rows[0]), balance: await getBalance(userId), replayed: true };
    }
    throw error;
  }
}

export async function listWithdrawals(userId: string) {
  const { rows } = await pool.query<WithdrawalRow>(
    'SELECT * FROM withdrawal_requests WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
    [userId]
  );
  return rows.map(toWithdrawalDto);
}

export async function listWithdrawalsForReview(status: WithdrawalRow['status'], limit: number) {
  const { rows } = await pool.query<WithdrawalRow>(
    'SELECT * FROM withdrawal_requests WHERE status = $1 ORDER BY created_at ASC LIMIT $2',
    [status, limit]
  );
  return rows.map((w) => ({ ...toWithdrawalDto(w), userId: w.user_id }));
}

async function lockPendingWithdrawal(client: DbClient, withdrawalId: string): Promise<WithdrawalRow> {
  const { rows } = await client.query<WithdrawalRow>('SELECT * FROM withdrawal_requests WHERE id = $1 FOR UPDATE', [withdrawalId]);
  const withdrawal = rows[0];
  if (!withdrawal) throw notFound('Withdrawal');
  if (withdrawal.status !== 'PENDING') {
    throw conflict('WITHDRAWAL_ALREADY_PROCESSED', `This withdrawal is already ${withdrawal.status.toLowerCase()}.`);
  }
  return withdrawal;
}

/** Admin: the UPI payout was sent. Releases the locked tokens into payout, TDS and fee accounts. */
export async function approveWithdrawal(adminId: string, withdrawalId: string, payoutReference: string) {
  return withTransaction(async (client) => {
    const w = await lockPendingWithdrawal(client, withdrawalId);
    await postLedger(client, {
      referenceType: 'WITHDRAWAL',
      referenceId: w.id,
      reason: `Withdrawal paid (${payoutReference})`,
      movements: [
        { userId: w.user_id, account: 'LOCKED', amount: -w.gross_amount },
        { account: 'SYS_PAYOUT', amount: w.net_amount },
        { account: 'SYS_TDS_PAYABLE', amount: w.tds_amount },
        { account: 'SYS_PLATFORM_FEE', amount: w.fee_amount },
      ],
    });
    const { rows } = await client.query<WithdrawalRow>(
      `UPDATE withdrawal_requests
          SET status = 'PAID', payout_reference = $2, reviewed_by = $3, processed_at = now()
        WHERE id = $1
        RETURNING *`,
      [w.id, payoutReference, adminId]
    );
    await recordAdminAction(client, {
      adminId,
      action: 'WITHDRAWAL_APPROVED',
      targetType: 'withdrawal',
      targetId: w.id,
      details: { payoutReference, netAmount: w.net_amount },
    });
    return toWithdrawalDto(rows[0] as WithdrawalRow);
  });
}

/** Admin: refuse the withdrawal and return the locked tokens to the player's winnings. */
export async function rejectWithdrawal(adminId: string, withdrawalId: string, reason: string) {
  return withTransaction(async (client) => {
    const w = await lockPendingWithdrawal(client, withdrawalId);
    await postLedger(client, {
      referenceType: 'WITHDRAWAL',
      referenceId: w.id,
      reason: 'Withdrawal rejected: winnings returned',
      movements: [
        { userId: w.user_id, account: 'LOCKED', amount: -w.gross_amount },
        { userId: w.user_id, account: 'WINNING', amount: w.gross_amount },
      ],
    });
    const { rows } = await client.query<WithdrawalRow>(
      `UPDATE withdrawal_requests
          SET status = 'REJECTED', rejection_reason = $2, reviewed_by = $3, processed_at = now()
        WHERE id = $1
        RETURNING *`,
      [w.id, reason, adminId]
    );
    await recordAdminAction(client, {
      adminId,
      action: 'WITHDRAWAL_REJECTED',
      targetType: 'withdrawal',
      targetId: w.id,
      details: { reason },
    });
    return toWithdrawalDto(rows[0] as WithdrawalRow);
  });
}

/** Admin: credit promotional (non-withdrawable) bonus tokens. */
export async function grantBonus(adminId: string, input: { userId: string; amount: number; reason: string }) {
  return withTransaction(async (client) => {
    const grantId = randomUUID();
    await postLedger(client, {
      referenceType: 'BONUS_GRANT',
      referenceId: grantId,
      reason: input.reason,
      movements: [
        { userId: input.userId, account: 'BONUS', amount: input.amount },
        { account: 'SYS_PROMO', amount: -input.amount },
      ],
    });
    await recordAdminAction(client, {
      adminId,
      action: 'BONUS_GRANTED',
      targetType: 'user',
      targetId: input.userId,
      details: { grantId, amount: input.amount, reason: input.reason },
    });
    return { grantId, balance: await getBalance(input.userId, client) };
  });
}
