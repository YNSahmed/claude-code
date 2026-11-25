-- 001: users and wallets.
-- All money is stored as BIGINT whole tokens, where 1 token = ₹1.

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TABLE users (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone                     TEXT NOT NULL,
  password_hash             TEXT NOT NULL,
  display_name              TEXT NOT NULL,
  role                      TEXT NOT NULL DEFAULT 'player',
  free_fire_uid             TEXT,
  free_fire_uid_verified_at TIMESTAMPTZ,
  kyc_status                TEXT NOT NULL DEFAULT 'NOT_STARTED',
  is_banned                 BOOLEAN NOT NULL DEFAULT FALSE,
  -- Bumped to revoke every access token issued before (ban, password change).
  token_version             INTEGER NOT NULL DEFAULT 0,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT users_phone_key UNIQUE (phone),
  CONSTRAINT users_free_fire_uid_key UNIQUE (free_fire_uid),
  CONSTRAINT users_phone_format CHECK (phone ~ '^\+91[6-9][0-9]{9}$'),
  CONSTRAINT users_display_name_length CHECK (char_length(display_name) BETWEEN 2 AND 32),
  CONSTRAINT users_role_valid CHECK (role IN ('player', 'admin')),
  CONSTRAINT users_free_fire_uid_format CHECK (free_fire_uid ~ '^[0-9]{6,12}$'),
  CONSTRAINT users_uid_verified_requires_uid
    CHECK (free_fire_uid_verified_at IS NULL OR free_fire_uid IS NOT NULL),
  CONSTRAINT users_kyc_status_valid
    CHECK (kyc_status IN ('NOT_STARTED', 'PENDING', 'VERIFIED', 'REJECTED'))
);

CREATE TRIGGER users_set_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- One wallet per user (the primary key is the user id).
--   deposit_balance: bought through the payment gateway. Only spendable on entry fees, never withdrawable.
--   winning_balance: prizes and kill rewards. The only withdrawable balance.
--   bonus_balance:   promotional tokens. Spendable on entry fees up to each tournament's bonus cap.
--   locked_balance:  winnings held for a pending withdrawal.
CREATE TABLE wallets (
  user_id         UUID PRIMARY KEY REFERENCES users (id) ON DELETE RESTRICT,
  deposit_balance BIGINT NOT NULL DEFAULT 0,
  winning_balance BIGINT NOT NULL DEFAULT 0,
  bonus_balance   BIGINT NOT NULL DEFAULT 0,
  locked_balance  BIGINT NOT NULL DEFAULT 0,
  -- Incremented on every balance change; handy for optimistic checks and debugging.
  version         BIGINT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT wallets_deposit_balance_non_negative CHECK (deposit_balance >= 0),
  CONSTRAINT wallets_winning_balance_non_negative CHECK (winning_balance >= 0),
  CONSTRAINT wallets_bonus_balance_non_negative   CHECK (bonus_balance >= 0),
  CONSTRAINT wallets_locked_balance_non_negative  CHECK (locked_balance >= 0)
);

CREATE TRIGGER wallets_set_updated_at
  BEFORE UPDATE ON wallets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
