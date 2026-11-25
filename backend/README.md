# FF Arena API

Backend for a Free Fire esports tournament platform with a token wallet (**1 token = ₹1**).
Node.js 20+, TypeScript, Express 5 and PostgreSQL 14+.

Every token movement runs in one PostgreSQL transaction with row locks, is checked by database
constraints, and is written to an append-only double-entry ledger. Money endpoints require an
`Idempotency-Key`, so retries and double-taps never double-charge or double-credit.

## Quick start

```bash
# 1. A database (any PostgreSQL 14+)
createuser ff_arena --pwprompt && createdb ff_arena --owner ff_arena

# 2. Config: copy, then fill in DATABASE_URL, JWT_SECRET, ROOM_CREDENTIALS_KEY and the Razorpay values
cp .env.example .env

# 3. Install, create tables, run
npm install
npm run migrate
npm run dev            # http://localhost:4000/health
```

Make your first admin after registering through the API:

```sql
UPDATE users SET role = 'admin' WHERE phone = '+919876543210';
```

| Script              | What it does                                    |
| ------------------- | ----------------------------------------------- |
| `npm run dev`       | Run with reload (tsx)                           |
| `npm run migrate`   | Apply new files in `migrations/`, in order      |
| `npm run typecheck` | `tsc --noEmit`                                  |
| `npm run build`     | Compile to `dist/`; start with `npm start`      |

## The money model

Each wallet has four balances, all `BIGINT` whole tokens with `CHECK (>= 0)`:

| Balance           | Filled by                     | Spent on                             | Withdrawable |
| ----------------- | ----------------------------- | ------------------------------------ | ------------ |
| `deposit_balance` | Verified gateway payments     | Entry fees                           | No           |
| `winning_balance` | Prizes and kill rewards       | Entry fees (if `ALLOW_WINNINGS_FOR_ENTRY`), withdrawals | **Yes** |
| `bonus_balance`   | Admin promo grants            | Entry fees, up to each tournament's `bonus_cap` | No |
| `locked_balance`  | Pending withdrawals           | Paid out, or returned to winnings    | —            |

**Ledger.** Every movement is a ledger transaction (`txn_id`) of two or more `ledger_entries` whose
signed amounts sum to zero: the user's side records the balance before and after, and the platform's
side uses system accounts (`SYS_GATEWAY`, `SYS_TOURNAMENT_POOL`, `SYS_PAYOUT`, `SYS_TDS_PAYABLE`,
`SYS_PLATFORM_FEE`, `SYS_PROMO`). The database itself enforces that:

- entries can't be updated, deleted or truncated (trigger);
- a transaction that doesn't sum to zero can't commit (deferred constraint trigger);
- `balance_after = balance_before ± amount` and never below zero (CHECK).

`postLedger()` in `src/modules/wallet/wallet.service.ts` is the only code that changes balances.

**Flows**

| Flow                    | Movements                                                                 |
| ----------------------- | ------------------------------------------------------------------------- |
| Deposit (webhook)       | `SYS_GATEWAY → DEPOSIT`                                                   |
| Join tournament         | `BONUS (≤ cap) + DEPOSIT + WINNING → SYS_TOURNAMENT_POOL`                 |
| Settle tournament       | `SYS_TOURNAMENT_POOL → WINNING` (placement share + kills × per-kill)      |
| Cancel tournament       | `SYS_TOURNAMENT_POOL →` back to exactly the balances each fee came from   |
| Request withdrawal      | `WINNING → LOCKED`                                                        |
| Withdrawal paid (admin) | `LOCKED → SYS_PAYOUT (net) + SYS_TDS_PAYABLE + SYS_PLATFORM_FEE`          |
| Withdrawal rejected     | `LOCKED → WINNING`                                                        |
| Bonus grant (admin)     | `SYS_PROMO → BONUS`                                                       |

## Security measures

- **Transactions and locks.** `withTransaction()` wraps every change in `BEGIN … COMMIT`/`ROLLBACK`
  and retries deadlocks and serialization failures. Rows are locked with `SELECT … FOR UPDATE`, and
  wallets always in `user_id` order, so concurrent requests queue instead of racing. Sessions run with
  `statement_timeout`, `lock_timeout` and `idle_in_transaction_session_timeout`.
- **Idempotency.** `Idempotency-Key` is required on deposit orders, the webhook (or the gateway's
  `X-Razorpay-Event-Id`), joins, withdrawals, settlements, cancellations and admin money actions. The
  key is claimed atomically, completed responses are replayed, concurrent duplicates get `409`, and a
  reused key with a different body gets `422`. Business-level unique constraints back this up:
  one entry per user, slot and UID per tournament; one withdrawal per key; one credit per payment.
- **Server-side prices.** Entry fees, prizes and payouts come from the database. Admins only
  report placements and kills; results are checked for consistency (teammates share a placement,
  total kills ≤ players − 1).
- **Webhooks.** HMAC-SHA256 over the raw request bytes, compared in constant time. The credited user
  and amount come from our `payment_orders` row; a mismatched amount is never credited.
- **Room credentials.** Passwords are AES-256-GCM encrypted at rest. They're served only to confirmed
  participants (or admins), after `credentials_release_at` by the database clock; otherwise `403`
  with `secondsRemaining`.
- **UID lock.** Joining needs an admin-verified Free Fire UID. The UID is snapshotted on the entry
  and can't be changed while the player is in an open or live tournament.
- **Auth.** scrypt password hashes, HS256 JWTs with a pinned algorithm, issuer and audience. The
  user is re-read on every request, so bans and revocation (`token_version`) apply immediately.
  Login timing doesn't reveal whether a phone is registered.
- **Input and transport.** Strict Zod schemas on every route (unknown fields rejected), Helmet,
  `Cache-Control: no-store`, a 64 KB body limit, and rate limits on auth, joins, deposits,
  withdrawals and webhooks.
- **Audit.** Admin actions are written to the append-only `admin_audit_log`.

## API

All routes are under `/api/v1`. Send `Authorization: Bearer <token>` where marked 🔒 (👑 = admin) and
`Idempotency-Key: <8–128 chars>` where marked 🔁. Errors look like
`{ "error": { "code", "message", "details?", "requestId" } }`.

| Method & path                                | Notes                                             |
| -------------------------------------------- | ------------------------------------------------- |
| `POST /auth/register`                        | `{ phone, password, displayName }` → token        |
| `POST /auth/login`                           | `{ phone, password }` → token                     |
| `GET /users/me` 🔒                           | Profile and balances                              |
| `PUT /users/me/free-fire-uid` 🔒             | `{ freeFireUid }`; needs re-verification          |
| `POST /users/:id/verify-uid` 👑              | Mark the UID verified                             |
| `PUT /users/:id/kyc` 👑                      | `{ status: PENDING \| VERIFIED \| REJECTED }`     |
| `PUT /users/:id/ban` 👑                      | `{ banned, reason }`; revokes tokens              |
| `GET /wallet/balance` 🔒                     |                                                   |
| `GET /wallet/transactions` 🔒                | Ledger history, `?limit&before`                   |
| `POST /wallet/deposit/orders` 🔒🔁           | `{ amount }` → gateway order for checkout         |
| `POST /wallet/deposit/webhook`               | Razorpay webhook (signed)                         |
| `POST /wallet/withdraw` 🔒🔁                 | `{ amount, upiId }`; KYC required                 |
| `GET /wallet/withdrawals` 🔒                 | Your withdrawals                                  |
| `GET /wallet/admin/withdrawals` 👑           | Review queue, `?status=PENDING`                   |
| `POST /wallet/admin/withdrawals/:id/approve` 👑🔁 | `{ payoutReference }` after paying the UPI ID |
| `POST /wallet/admin/withdrawals/:id/reject` 👑🔁  | `{ reason }`                                  |
| `POST /wallet/admin/bonus` 👑🔁              | `{ userId, amount, reason }`                      |
| `GET /tournaments`                           | `?status&limit`; never includes room details      |
| `GET /tournaments/:id`                       |                                                   |
| `GET /tournaments/me/entries` 🔒             | Your entries and results                          |
| `POST /tournaments/:id/join` 🔒🔁            | Books a slot and charges the entry fee            |
| `GET /tournaments/:id/room-credentials` 🔒   | Participants only, after release time             |
| `POST /tournaments` 👑                       | Create (mode, map, fees, prizes, slots, start)    |
| `PUT /tournaments/:id/room` 👑               | `{ roomId, roomPassword, releaseAt }`             |
| `PATCH /tournaments/:id/status` 👑           | `{ status: LOCKED \| LIVE }`                      |
| `POST /tournaments/:id/settle` 👑🔁          | `{ results: [{ participantId, placement, kills }] }` |
| `POST /tournaments/:id/cancel` 👑🔁          | `{ reason }`; refunds every entry                 |

## Razorpay setup

1. Turn on **automatic capture** for payments.
2. Add a webhook to `https://<your-api>/api/v1/wallet/deposit/webhook` for `payment.captured`,
   `order.paid` and `payment.failed`, and put its secret in `RAZORPAY_WEBHOOK_SECRET`.
3. The app creates an order with `POST /wallet/deposit/orders` and opens Razorpay Checkout with the
   returned `keyId` and `gatewayOrderId`. Tokens are credited only when the webhook arrives.

`PAYMENT_GATEWAY=mock` creates fake order ids for local development. Crediting still needs a
correctly signed webhook. The app refuses to start with `mock` when `NODE_ENV=production`.

## Before going live

These are outside this codebase, or are simplified here:

- **Legal.** India's Promotion and Regulation of Online Gaming Act, 2025 restricts online games
  played for money. Get legal advice on whether paid-entry, cash-prize tournaments are allowed in
  your model and region before taking real money.
- **Tax.** TDS is withheld at a flat `TDS_RATE_BPS` of each withdrawal, rounded up. Section 194BA
  taxes *net* winnings over the financial year; have a tax adviser confirm the calculation.
- **KYC, UID checks and payouts** are manual admin actions here. Integrate a KYC provider and
  automated UPI payouts (for example RazorpayX), keeping the same ledger postings.
- **Login.** Phone plus password works; OTP verification of the phone number is recommended.
- **Multiple instances.** Use a shared rate-limit store (for example Redis); the default is in-memory.
- **Database.** Run the app as a role without DDL or `TRUNCATE` rights, enable backups and
  point-in-time recovery, and alert on `amount_mismatch` and `Deposit amount mismatch` logs.
