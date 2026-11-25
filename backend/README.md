# Clutch Arena API

Backend for the Clutch Arena app (`../app`): Free Fire squad tournaments where players sign in with
their mobile number, captains register squads of four, everyone's details stay private, and only the
organizer manages tournaments.

Node.js 20+, TypeScript, Express 5 and PostgreSQL 14+.

## Quick start

```bash
# 1. A database (any PostgreSQL 14+)
createuser ff_arena --pwprompt && createdb ff_arena --owner ff_arena

# 2. Config: copy, then set DATABASE_URL, JWT_SECRET, the two keys and ADMIN_PHONES (your number)
cp .env.example .env

# 3. Install, create tables, run
npm install
npm run migrate
npm run dev            # http://localhost:4000/health
```

With `SMS_PROVIDER=console`, login codes are printed in the server log instead of being texted.
That only works in development; production needs `msg91` or `twilio` (see below).

| Script              | What it does                                    |
| ------------------- | ----------------------------------------------- |
| `npm run dev`       | Run with reload (tsx)                           |
| `npm run migrate`   | Apply new files in `migrations/`, in order      |
| `npm run typecheck` | `tsc --noEmit`                                  |
| `npm run build`     | Compile to `dist/`; start with `npm start`      |

## How it works

**Sign-in with a one-time SMS code.** `POST /auth/otp/request` texts a 6-digit code;
`POST /auth/otp/verify` exchanges it for a token, creating the account the first time. Numbers in
`ADMIN_PHONES` become the organizer (admin). Nobody else can become admin.

**Squads.** The signed-in captain registers a squad name, themselves (member 1, using the number
they verified at sign-in) and three teammates with name, mobile number and an optional Free Fire UID.
Registration is free. Duo (1 teammate) and solo (none) tournaments work the same way.

**Who can see what.**

| Data                             | Everyone | Squad member | Squad captain | Organizer |
| -------------------------------- | :------: | :----------: | :-----------: | :-------: |
| Tournament, squad names, results |    ✓     |      ✓       |       ✓       |     ✓     |
| Their squad's member names       |          |      ✓       |       ✓       |     ✓     |
| Members' phone numbers           |          |   own only   |       ✓       |     ✓     |
| Room ID and password             |          | after release | after release |     ✓     |
| All players and registrations    |          |              |               |     ✓     |

A teammate who signs in with the number their captain entered sees the squad and the room details
in the app, too.

## Security and privacy measures

- **Login codes:** 6 digits from a secure random source, stored only as a keyed hash, single use,
  expire after 5 minutes, dead after 5 wrong tries. One code per number every 30 seconds and five
  per hour, enforced in the database. The request response is identical whether or not the
  number has an account.
- **Personal data:** squad members' numbers are encrypted at rest (AES-256-GCM) and compared by
  a keyed HMAC, so "is this person already in a squad?" never needs the plain number. Error messages
  never reveal which other squad holds a number. Withdrawing or removing a squad deletes its
  members' data. Captains must confirm their teammates agreed to share their details.
- **Access control:** every route validates input with strict Zod schemas. Organizer routes require
  the admin role, read from the database on every request. JWTs use a pinned HS256 algorithm, issuer
  and audience; banning a player or "sign out everywhere" revokes every token at once.
- **Room credentials:** the password is encrypted at rest and only returned to registered squads
  after the release time (by the database clock). Before that, the API returns 403 with a countdown.
- **Consistency:** each registration runs in one transaction that locks the tournament row, so
  concurrent captains can never overfill it. Unique constraints stop duplicate captains, squad names,
  phone numbers and UIDs. Registration and results take an `Idempotency-Key`, so double taps and
  retries are safe.
- **Transport:** Helmet headers, `Cache-Control: no-store`, CORS limited to `CORS_ORIGINS`,
  a 64 KB body limit, and rate limits on sign-in, registration and everything else.
- **Audit:** organizer actions (tournaments, room details, results, removals, bans, settings) are
  written to the append-only `admin_audit_log`.

## API

All routes are under `/api/v1`. 🔒 = signed in, 👑 = organizer, 🔁 = send an `Idempotency-Key`.
Errors look like `{ "error": { "code", "message", "details?", "requestId" } }`.

| Method & path                                  | Notes                                              |
| ---------------------------------------------- | -------------------------------------------------- |
| `POST /auth/otp/request`                       | `{ phone }` (10 digits or +91…) → code by SMS      |
| `POST /auth/otp/verify`                        | `{ phone, code }` → `{ accessToken, user, isNewUser }` |
| `POST /auth/sign-out-everywhere` 🔒            | Revokes all of the user's tokens                   |
| `GET /users/me` 🔒 · `PATCH /users/me` 🔒      | Profile; `{ displayName }`                         |
| `GET /settings`                                | WhatsApp Channel link and organizer name           |
| `PUT /settings` 👑                             | `{ whatsappChannelUrl?, organizerName? }`          |
| `GET /tournaments`                             | Upcoming and live; `?status=COMPLETED` for results |
| `GET /tournaments/:id`                         | Tournament plus registered squad names             |
| `GET /tournaments/:id/leaderboard`             | Final standings with prizes                        |
| `GET /tournaments/me/registrations` 🔒         | Squads you captain or belong to                    |
| `POST /tournaments/:id/squads` 🔒🔁            | `{ squadName, captain, teammates, consent: true }` |
| `GET /tournaments/:id/my-squad` 🔒             | Your squad, with what you're allowed to see        |
| `DELETE /tournaments/:id/my-squad` 🔒          | Captain withdraws while registration is open       |
| `GET /tournaments/:id/room-credentials` 🔒     | Registered squads, after release time              |
| `POST /tournaments` 👑                         | `{ title, mode, map, maxTeams, startsAt, prizePool, perKillReward, rules }` |
| `GET /tournaments/:id/registrations` 👑        | Every squad with names, numbers and UIDs           |
| `DELETE /tournaments/:id/squads/:squadId` 👑   | `{ reason }`                                       |
| `PUT /tournaments/:id/room` 👑                 | `{ roomId, roomPassword, releaseAt }`              |
| `PATCH /tournaments/:id/status` 👑             | `{ status: LOCKED \| LIVE }`                       |
| `POST /tournaments/:id/results` 👑🔁           | `{ results: [{ squadId, placement, kills }] }`     |
| `POST /tournaments/:id/cancel` 👑🔁            | `{ reason }`                                       |
| `GET /users` 👑                                | Players, `?search=`                                |
| `PUT /users/:id/ban` 👑                        | `{ banned, reason }`                               |

## SMS providers

Indian SMS needs a DLT-registered sender ID and template, whichever provider you use.

- **MSG91** (`SMS_PROVIDER=msg91`): create an OTP template containing a variable (named `otp` by
  default, or set `MSG91_OTP_VARIABLE`), then set `MSG91_AUTH_KEY` and `MSG91_TEMPLATE_ID`.
- **Twilio** (`SMS_PROVIDER=twilio`): set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and `TWILIO_FROM`
  (a sender number, or a Messaging Service SID starting with `MG`).

Both integrations follow the providers' published APIs but haven't been tried against live
accounts. Send yourself a code before launch.

## Token wallet (off)

The earlier paid-entry wallet (deposits through Razorpay, withdrawals with TDS, an append-only
double-entry ledger) is still in `src/modules/wallet` and migrations 001–002. Its routes aren't
mounted unless `WALLET_ENABLED=true`, which also requires the Razorpay settings. Registration is free
by default. India's Promotion and Regulation of Online Gaming Act, 2025 restricts online games played
for money, so get legal advice before turning it on.

## Before going live

- Run PostgreSQL with backups, and keep `PII_ENCRYPTION_KEY` and `ROOM_CREDENTIALS_KEY` in a secrets
  manager. Losing the PII key makes stored phone numbers unreadable.
- Serve the API over HTTPS only, and put it behind a load balancer with `TRUST_PROXY` set.
- When running more than one instance, use a shared rate-limit store such as Redis. Login codes
  are already throttled in the database.
- Publish a privacy notice: India's DPDP Act, 2023 applies to the phone numbers you collect.
