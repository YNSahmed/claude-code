-- 002: ledger, payment orders, withdrawals and idempotency keys.

-- Generic guard for append-only tables.
CREATE OR REPLACE FUNCTION forbid_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only: % is not allowed', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$;

-- Immutable double-entry ledger.
-- Every money movement is one transaction (txn_id) made of two or more entries whose
-- signed amounts (CREDIT = +amount, DEBIT = -amount) sum to zero.
-- User accounts (DEPOSIT, WINNING, BONUS, LOCKED) record the wallet balance before and after.
-- System accounts (SYS_*) are the platform's side of each movement.
CREATE TABLE ledger_entries (
  id             BIGSERIAL PRIMARY KEY,
  txn_id         UUID NOT NULL,
  user_id        UUID REFERENCES users (id) ON DELETE RESTRICT,
  account        TEXT NOT NULL,
  direction      TEXT NOT NULL,
  amount         BIGINT NOT NULL,
  balance_before BIGINT,
  balance_after  BIGINT,
  reference_type TEXT NOT NULL,
  reference_id   TEXT NOT NULL,
  reason         TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT ledger_account_valid CHECK (account IN (
    'DEPOSIT', 'WINNING', 'BONUS', 'LOCKED',
    'SYS_GATEWAY', 'SYS_TOURNAMENT_POOL', 'SYS_PAYOUT', 'SYS_TDS_PAYABLE', 'SYS_PLATFORM_FEE', 'SYS_PROMO'
  )),
  CONSTRAINT ledger_direction_valid CHECK (direction IN ('DEBIT', 'CREDIT')),
  CONSTRAINT ledger_amount_positive CHECK (amount > 0),
  CONSTRAINT ledger_user_account_has_user CHECK ((left(account, 4) = 'SYS_') = (user_id IS NULL)),
  CONSTRAINT ledger_user_account_has_balances CHECK (
    (user_id IS NULL AND balance_before IS NULL AND balance_after IS NULL)
    OR (user_id IS NOT NULL AND balance_before IS NOT NULL AND balance_after IS NOT NULL)
  ),
  CONSTRAINT ledger_balance_math CHECK (
    balance_before IS NULL
    OR balance_after = balance_before + CASE direction WHEN 'CREDIT' THEN amount ELSE -amount END
  ),
  CONSTRAINT ledger_balance_after_non_negative CHECK (balance_after IS NULL OR balance_after >= 0)
);

CREATE INDEX ledger_entries_user_created_idx ON ledger_entries (user_id, created_at DESC, id DESC);
CREATE INDEX ledger_entries_txn_idx ON ledger_entries (txn_id);
CREATE INDEX ledger_entries_reference_idx ON ledger_entries (reference_type, reference_id);

CREATE TRIGGER ledger_entries_no_update_or_delete
  BEFORE UPDATE OR DELETE ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

CREATE TRIGGER ledger_entries_no_truncate
  BEFORE TRUNCATE ON ledger_entries
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_mutation();

-- Checked at COMMIT: a transaction whose entries do not sum to zero cannot be committed.
CREATE OR REPLACE FUNCTION ledger_txn_must_balance() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  imbalance BIGINT;
BEGIN
  SELECT COALESCE(SUM(CASE direction WHEN 'CREDIT' THEN amount ELSE -amount END), 0)
    INTO imbalance
    FROM ledger_entries
   WHERE txn_id = NEW.txn_id;

  IF imbalance <> 0 THEN
    RAISE EXCEPTION 'ledger transaction % is unbalanced by %', NEW.txn_id, imbalance
      USING ERRCODE = 'check_violation', CONSTRAINT = 'ledger_txn_balanced';
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER ledger_txn_balanced
  AFTER INSERT ON ledger_entries
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION ledger_txn_must_balance();

-- Deposits: created by the server with a server-chosen amount, marked PAID only by a
-- signature-verified gateway webhook.
CREATE TABLE payment_orders (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  gateway            TEXT NOT NULL,
  gateway_order_id   TEXT NOT NULL,
  gateway_payment_id TEXT,
  amount             BIGINT NOT NULL,
  currency           TEXT NOT NULL DEFAULT 'INR',
  status             TEXT NOT NULL DEFAULT 'CREATED',
  failure_reason     TEXT,
  paid_at            TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT payment_orders_gateway_order_key UNIQUE (gateway, gateway_order_id),
  CONSTRAINT payment_orders_gateway_payment_key UNIQUE (gateway, gateway_payment_id),
  CONSTRAINT payment_orders_amount_positive CHECK (amount > 0),
  CONSTRAINT payment_orders_currency_inr CHECK (currency = 'INR'),
  CONSTRAINT payment_orders_status_valid CHECK (status IN ('CREATED', 'PAID', 'FAILED')),
  CONSTRAINT payment_orders_paid_has_payment
    CHECK (status <> 'PAID' OR (paid_at IS NOT NULL AND gateway_payment_id IS NOT NULL))
);

CREATE INDEX payment_orders_user_idx ON payment_orders (user_id, created_at DESC);

CREATE TRIGGER payment_orders_set_updated_at
  BEFORE UPDATE ON payment_orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Withdrawals: tokens move from winning_balance to locked_balance when requested, and leave
-- locked_balance when paid (or return to winning_balance when rejected).
CREATE TABLE withdrawal_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  idempotency_key   TEXT NOT NULL,
  upi_id            TEXT NOT NULL,
  gross_amount      BIGINT NOT NULL,
  tds_amount        BIGINT NOT NULL DEFAULT 0,
  fee_amount        BIGINT NOT NULL DEFAULT 0,
  net_amount        BIGINT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'PENDING',
  payout_reference  TEXT,
  rejection_reason  TEXT,
  reviewed_by       UUID REFERENCES users (id) ON DELETE RESTRICT,
  processed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- A retried request can never create a second withdrawal.
  CONSTRAINT withdrawal_requests_idempotency_key UNIQUE (user_id, idempotency_key),
  CONSTRAINT withdrawal_requests_upi_format CHECK (upi_id ~ '^[A-Za-z0-9._-]{2,255}@[A-Za-z]{2,64}$'),
  CONSTRAINT withdrawal_requests_amounts_valid CHECK (
    gross_amount > 0 AND tds_amount >= 0 AND fee_amount >= 0 AND net_amount > 0
    AND gross_amount = tds_amount + fee_amount + net_amount
  ),
  CONSTRAINT withdrawal_requests_status_valid
    CHECK (status IN ('PENDING', 'PAID', 'REJECTED')),
  CONSTRAINT withdrawal_requests_paid_has_reference
    CHECK (status <> 'PAID' OR payout_reference IS NOT NULL)
);

CREATE INDEX withdrawal_requests_user_idx ON withdrawal_requests (user_id, created_at DESC);
CREATE INDEX withdrawal_requests_pending_idx ON withdrawal_requests (created_at) WHERE status = 'PENDING';

CREATE TRIGGER withdrawal_requests_set_updated_at
  BEFORE UPDATE ON withdrawal_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Idempotency keys for every money-moving endpoint.
--   owner: 'user:<uuid>' for API calls, 'gateway:<name>' for webhooks.
--   request_hash: SHA-256 of method, path and raw body; reusing a key with a different body is rejected.
CREATE TABLE idempotency_keys (
  owner           TEXT NOT NULL,
  key             TEXT NOT NULL,
  scope           TEXT NOT NULL,
  request_hash    TEXT NOT NULL,
  status          TEXT NOT NULL,
  response_status INTEGER,
  response_body   JSONB,
  locked_until    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (owner, key),
  CONSTRAINT idempotency_keys_key_length CHECK (char_length(key) BETWEEN 8 AND 128),
  CONSTRAINT idempotency_keys_status_valid CHECK (status IN ('IN_PROGRESS', 'COMPLETED')),
  CONSTRAINT idempotency_keys_completed_has_response
    CHECK (status <> 'COMPLETED' OR response_status IS NOT NULL)
);

CREATE INDEX idempotency_keys_created_idx ON idempotency_keys (created_at);

CREATE TRIGGER idempotency_keys_set_updated_at
  BEFORE UPDATE ON idempotency_keys
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
