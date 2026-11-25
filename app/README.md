# Clutch Arena

A mobile app for running and joining **Free Fire custom-room tournaments**, built with
[Expo](https://expo.dev) (React Native) for Android, iOS and web.

## What it does

**For players**

- Browse open, live and finished tournaments, filtered by Solo, Duo or Squad.
- See the prize pool, per-kill reward, entry fee, map, start time and free slots at a glance.
- Join in a few taps: your in-game name (IGN) and player ID (UID) are filled in, and for Duo
  and Squad you add your teammates and a team name.
- Get the **room ID and password** on your match ticket, with one-tap copy, once the organizer
  shares them.
- Check leaderboards, your placement, kills and winnings, and your career stats.

**For organizers**

- Create a tournament in under a minute: name, mode, map, day and time, slots, entry fee, prize
  pool, per-kill reward and rules, with a live preview.
- Share an invite to group chats.
- Publish the room ID and password, visible only to registered players.
- Start the match, rank the teams with arrows, set kills, and post results. The prize pool is
  split 50% / 30% / 20% between the top three, plus the per-kill reward.
- See every registered player's IGN and UID, and remove teams before the match.

## Run it

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
cd app
npm install
npm start
```

Then:

- **On your phone:** install **Expo Go** from the Play Store or App Store and scan the QR code.
- **Android emulator:** press `a`. **iOS simulator** (macOS only): press `i`.
- **In the browser:** press `w`.

On first launch the app asks for your IGN and UID, then shows sample tournaments so there is
something to try. **Profile → Reset app data** brings back the sample data.

To try the organizer flow on one device: create a tournament on the **Host** tab, open
**Manage**, and tap **Add demo teams (dev only)**. That button only appears in development builds.

## Build for the Play Store and App Store

Builds run in the cloud with [EAS](https://docs.expo.dev/eas/), so you don't need Android
Studio or Xcode:

```bash
npx eas-cli@latest login
npx eas-cli@latest build --platform android   # or ios, or all
npx eas-cli@latest submit --platform android
```

EAS asks for an app ID (for example `com.yourname.clutcharena`) the first time.

## Before you launch: read this

- **Data is stored on each phone only.** Tournaments, registrations and results are saved on the
  device with AsyncStorage, so players and organizers on different phones don't see each
  other's data yet. To run real tournaments, connect a shared backend such as Supabase,
  Firebase or your own API. Every screen reads and writes data through `src/data/store.tsx`,
  so that file is the only one that needs to change.
- **No payments.** Entry fees and prizes are shown but not collected or paid by the app.
  Organizers handle them outside the app. Real-money contests are regulated in many countries;
  check the rules where you operate before adding payments.
- **Not affiliated with Garena.** Free Fire is a trademark of Garena. The app uses its own
  name, logo and artwork.

## Customize

| What                                        | Where                                                     |
| ------------------------------------------- | --------------------------------------------------------- |
| App name, currency symbol (`$` by default)  | `src/constants/config.ts` (`APP_NAME`, `CURRENCY_SYMBOL`) |
| Prize split, max teams, default rules, maps | `src/constants/config.ts`                                 |
| Colors, map banners, fonts                  | `src/constants/theme.ts`                                  |
| Sample tournaments                          | `src/data/seed.ts`                                        |
| Store name, icon, splash                    | `app.json` and `assets/images/`                           |

## Project layout

```
src/
  app/                    Screens (Expo Router: each file is a route)
    (tabs)/               Bottom tabs: Tournaments, My Matches, Host, Profile
    tournament/[id].tsx   Tournament details, room details, leaderboard
    join/[id].tsx         Join form (solo, duo or squad)
    host/new.tsx          Create a tournament
    host/[id].tsx         Organizer controls: room, start match, results, teams
    onboarding.tsx        First launch: player card
  components/             Tournament card, room card, leaderboard and UI kit (ui/)
  constants/              App settings and theme
  data/                   Types, sample data, validation, and the store
  hooks/ utils/           Countdown clock, formatting, haptics, share and copy helpers
```

## Checks

```bash
npm run typecheck   # TypeScript
npm run lint        # ESLint (Expo config)
npm run format      # Prettier
```
