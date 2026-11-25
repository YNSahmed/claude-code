-- 004: phone OTP login, free squad registration and organizer settings.
-- Replaces password login and the per-player paid entry model.

-- ---------------------------------------------------------------------------------------------
-- Login with a one-time code sent by SMS. Passwords are no longer used.
-- ---------------------------------------------------------------------------------------------
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
-- New users pick their name right after their first sign-in.
ALTER TABLE users ALTER COLUMN display_name DROP NOT NULL;
ALTER TABLE users ADD COLUMN phone_verified_at TIMESTAMPTZ;

CREATE TABLE otp_challenges (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone       TEXT NOT NULL,
  -- Keyed hash of the code; the code itself is never stored.
  code_hash   TEXT NOT NULL,
  attempts    INTEGER NOT NULL DEFAULT 0,
  expires_at  TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  request_ip  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT otp_challenges_phone_format CHECK (phone ~ '^\+91[6-9][0-9]{9}$'),
  CONSTRAINT otp_challenges_attempts_valid CHECK (attempts BETWEEN 0 AND 20)
);

CREATE INDEX otp_challenges_phone_created_idx ON otp_challenges (phone, created_at DESC);

-- ---------------------------------------------------------------------------------------------
-- Squads: a signed-in captain registers their team. Registration is free.
-- ---------------------------------------------------------------------------------------------
DROP TABLE tournament_participants;

-- Rules shown on the tournament page, one per line.
ALTER TABLE tournaments ADD COLUMN rules TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE tournaments ADD CONSTRAINT tournaments_rules_count CHECK (cardinality(rules) <= 20);

CREATE TABLE squads (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments (id) ON DELETE CASCADE,
  captain_id    UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  -- Team number in the custom room: 1 .. max_slots / team size.
  slot_number   INTEGER NOT NULL,
  placement     INTEGER,
  kills         INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT squads_one_per_captain UNIQUE (tournament_id, captain_id),
  CONSTRAINT squads_one_per_slot UNIQUE (tournament_id, slot_number),
  CONSTRAINT squads_name_length CHECK (char_length(name) BETWEEN 2 AND 24),
  CONSTRAINT squads_slot_positive CHECK (slot_number >= 1),
  CONSTRAINT squads_result_valid CHECK ((placement IS NULL OR placement >= 1) AND (kills IS NULL OR kills >= 0))
);

CREATE UNIQUE INDEX squads_unique_name ON squads (tournament_id, lower(name));
CREATE INDEX squads_captain_idx ON squads (captain_id);

CREATE TRIGGER squads_set_updated_at
  BEFORE UPDATE ON squads
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Squad members are private: only the organizer (admin) and the squad's own captain can read
-- their phone numbers, which are stored AES-256-GCM encrypted. phone_hash is a keyed HMAC used
-- to stop one person being registered in two squads of the same tournament.
CREATE TABLE squad_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  squad_id        UUID NOT NULL REFERENCES squads (id) ON DELETE CASCADE,
  tournament_id   UUID NOT NULL REFERENCES tournaments (id) ON DELETE CASCADE,
  position        SMALLINT NOT NULL,
  name            TEXT NOT NULL,
  phone_encrypted TEXT NOT NULL,
  phone_hash      TEXT NOT NULL,
  free_fire_uid   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT squad_members_one_per_position UNIQUE (squad_id, position),
  CONSTRAINT squad_members_one_squad_per_phone UNIQUE (tournament_id, phone_hash),
  CONSTRAINT squad_members_one_squad_per_uid UNIQUE (tournament_id, free_fire_uid),
  CONSTRAINT squad_members_position_valid CHECK (position BETWEEN 1 AND 4),
  CONSTRAINT squad_members_name_length CHECK (char_length(name) BETWEEN 2 AND 32),
  CONSTRAINT squad_members_uid_format CHECK (free_fire_uid IS NULL OR free_fire_uid ~ '^[0-9]{6,12}$')
);

CREATE INDEX squad_members_phone_hash_idx ON squad_members (phone_hash);

-- ---------------------------------------------------------------------------------------------
-- Organizer settings shown to players (for example the WhatsApp Channel link).
-- ---------------------------------------------------------------------------------------------
CREATE TABLE app_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_by UUID REFERENCES users (id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT app_settings_key_valid CHECK (key IN ('whatsapp_channel_url', 'organizer_name'))
);
