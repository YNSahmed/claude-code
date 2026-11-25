-- 005: record age confirmation and squad consent.

-- When the player confirmed they are 18 or older (asked before their number is collected).
ALTER TABLE users ADD COLUMN age_confirmed_at TIMESTAMPTZ;

-- When the captain confirmed their teammates are 18 or older and agreed to share their details.
ALTER TABLE squads ADD COLUMN consent_confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now();
