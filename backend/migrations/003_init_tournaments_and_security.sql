-- 003: tournaments, participants and the admin audit log.

CREATE OR REPLACE FUNCTION int_array_sum(values_ INTEGER[]) RETURNS BIGINT
LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(SUM(v), 0) FROM unnest(values_) AS v
$$;

CREATE TABLE tournaments (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title                  TEXT NOT NULL,
  mode                   TEXT NOT NULL,
  map                    TEXT NOT NULL,
  entry_fee              BIGINT NOT NULL,
  -- Most bonus tokens one entry may use; the rest comes from deposit (then winning) balance.
  bonus_cap              BIGINT NOT NULL DEFAULT 0,
  prize_pool             BIGINT NOT NULL,
  -- Share of prize_pool per placement in basis points: {5000,3000,2000} = 50% / 30% / 20%.
  prize_split_bps        INTEGER[] NOT NULL DEFAULT '{5000,3000,2000}',
  per_kill_reward        BIGINT NOT NULL DEFAULT 0,
  -- Player slots. Each participant is one player; teams are consecutive slots.
  max_slots              INTEGER NOT NULL,
  filled_slots           INTEGER NOT NULL DEFAULT 0,
  starts_at              TIMESTAMPTZ NOT NULL,
  room_id                TEXT,
  -- AES-256-GCM ciphertext (see src/utils/crypto.ts), never the plain password.
  room_password          TEXT,
  credentials_release_at TIMESTAMPTZ,
  status                 TEXT NOT NULL DEFAULT 'OPEN',
  created_by             UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  settled_at             TIMESTAMPTZ,
  cancelled_at           TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT tournaments_title_length CHECK (char_length(title) BETWEEN 3 AND 80),
  CONSTRAINT tournaments_mode_valid CHECK (mode IN ('SOLO', 'DUO', 'SQUAD')),
  CONSTRAINT tournaments_map_valid CHECK (map IN ('BERMUDA', 'PURGATORY', 'KALAHARI', 'ALPINE', 'NEXTERRA')),
  CONSTRAINT tournaments_money_non_negative
    CHECK (entry_fee >= 0 AND prize_pool >= 0 AND per_kill_reward >= 0),
  CONSTRAINT tournaments_bonus_cap_within_fee CHECK (bonus_cap >= 0 AND bonus_cap <= entry_fee),
  CONSTRAINT tournaments_prize_split_valid CHECK (
    cardinality(prize_split_bps) BETWEEN 1 AND 10
    AND 0 <= ALL (prize_split_bps)
    AND int_array_sum(prize_split_bps) <= 10000
  ),
  CONSTRAINT tournaments_max_slots_valid CHECK (
    max_slots BETWEEN 2 AND 48
    AND max_slots % CASE mode WHEN 'SOLO' THEN 1 WHEN 'DUO' THEN 2 ELSE 4 END = 0
  ),
  CONSTRAINT tournaments_slots_within_capacity CHECK (filled_slots >= 0 AND filled_slots <= max_slots),
  CONSTRAINT tournaments_status_valid
    CHECK (status IN ('OPEN', 'LOCKED', 'LIVE', 'COMPLETED', 'CANCELLED')),
  CONSTRAINT tournaments_room_credentials_complete CHECK ((room_id IS NULL) = (room_password IS NULL)),
  CONSTRAINT tournaments_release_before_start
    CHECK (credentials_release_at IS NULL OR credentials_release_at <= starts_at),
  CONSTRAINT tournaments_completed_is_settled CHECK ((status = 'COMPLETED') = (settled_at IS NOT NULL)),
  CONSTRAINT tournaments_cancelled_has_time CHECK ((status = 'CANCELLED') = (cancelled_at IS NOT NULL))
);

CREATE INDEX tournaments_status_start_idx ON tournaments (status, starts_at);

CREATE TRIGGER tournaments_set_updated_at
  BEFORE UPDATE ON tournaments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE tournament_participants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments (id) ON DELETE RESTRICT,
  user_id       UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  slot_number   INTEGER NOT NULL,
  -- Snapshot of the player's verified UID at join time.
  free_fire_uid TEXT NOT NULL,
  -- How the entry fee was paid, so a cancellation refunds each balance exactly.
  paid_bonus    BIGINT NOT NULL DEFAULT 0,
  paid_deposit  BIGINT NOT NULL DEFAULT 0,
  paid_winning  BIGINT NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'CONFIRMED',
  placement     INTEGER,
  kills         INTEGER,
  prize_amount  BIGINT,
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT tournament_participants_one_entry_per_user UNIQUE (tournament_id, user_id),
  CONSTRAINT tournament_participants_one_player_per_slot UNIQUE (tournament_id, slot_number),
  CONSTRAINT tournament_participants_one_entry_per_uid UNIQUE (tournament_id, free_fire_uid),
  CONSTRAINT tournament_participants_slot_positive CHECK (slot_number >= 1),
  CONSTRAINT tournament_participants_paid_non_negative
    CHECK (paid_bonus >= 0 AND paid_deposit >= 0 AND paid_winning >= 0),
  CONSTRAINT tournament_participants_status_valid CHECK (status IN ('CONFIRMED', 'REFUNDED')),
  CONSTRAINT tournament_participants_result_valid CHECK (
    (placement IS NULL OR placement >= 1)
    AND (kills IS NULL OR kills >= 0)
    AND (prize_amount IS NULL OR prize_amount >= 0)
  )
);

CREATE INDEX tournament_participants_user_idx ON tournament_participants (user_id, joined_at DESC);

CREATE TRIGGER tournament_participants_set_updated_at
  BEFORE UPDATE ON tournament_participants
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Append-only record of every admin action (settlements, cancellations, payouts, KYC, bans).
CREATE TABLE admin_audit_log (
  id          BIGSERIAL PRIMARY KEY,
  admin_id    UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  action      TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id   TEXT NOT NULL,
  details     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX admin_audit_log_target_idx ON admin_audit_log (target_type, target_id);

CREATE TRIGGER admin_audit_log_no_update_or_delete
  BEFORE UPDATE OR DELETE ON admin_audit_log
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

CREATE TRIGGER admin_audit_log_no_truncate
  BEFORE TRUNCATE ON admin_audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_mutation();
