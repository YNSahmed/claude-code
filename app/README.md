# Clutch Arena

A mobile app for **Free Fire squad tournaments**, built with [Expo](https://expo.dev) (React Native)
for Android, iOS and web. It talks to the API in `../backend`.

## What it does

**Players**

- Sign in with their mobile number and a 6-digit SMS code. No passwords.
- Register a squad: a squad name, themselves as captain, and three teammates, each with name and
  mobile number (Free Fire UID optional). Registration is free.
- See the room ID and password with a live countdown, unlocked only for registered squads. Teammates
  who sign in with the number their captain entered see it too.
- Follow the organizer's WhatsApp Channel from the app, and see results and leaderboards.

**Privacy:** other players only ever see squad names. Captains see their own squad's numbers.
Only the organizer sees everyone's details. Numbers are encrypted on the server, and the session token
is kept in the phone's secure keychain.

**Organizer (you):** an Organizer tab that only you can see, for numbers listed in the backend's
`ADMIN_PHONES`:

- **Tournaments:** create tournaments (mode, map, date and time, squads, prize pool, per-kill
  reward, rules) with a live preview.
- **Squads:** see every registered squad with names, numbers and UIDs, plus one-tap call and
  WhatsApp. Copy the full list, or remove a squad. Screenshots are blocked on these screens on
  Android.
- **Match day:** share room details on a timer, close registration, go live, then rank squads and
  post results.
- **Poster studio:** "Registration open", "Last spots" and "Results" posters in Inferno, Neon and
  Royal themes. **Share poster to WhatsApp** opens the share sheet so you can post the poster to
  your Channel, with a ready-made caption already copied.
- **WhatsApp Channel:** save your channel link once; players get a "Follow our WhatsApp Channel"
  button and the posters mention it.
- **Players:** search every account.

## Run it

1. Start the backend first (see `../backend/README.md`), with your number in `ADMIN_PHONES`.
2. Point the app at it and start Expo:

```bash
cd app
cp .env.example .env.local   # set EXPO_PUBLIC_API_URL
npm install
npm start
```

On a phone with **Expo Go**, scan the QR code. `EXPO_PUBLIC_API_URL` must be reachable from the
phone: use your computer's local network IP (for example `http://192.168.1.20:4000`), not
`localhost`. Press `w` to open the web version; add `http://localhost:8081` to the backend's
`CORS_ORIGINS` for that.

In development the backend prints login codes in its log (`SMS_PROVIDER=console`).

## Build for the Play Store and App Store

```bash
npx eas-cli@latest login
npx eas-cli@latest build --platform android   # or ios, or all
```

Set `EXPO_PUBLIC_API_URL` to your deployed HTTPS API for production builds.

## Project layout

```
src/
  api/          API client, response types and React Query hooks
  auth/         Session: sign-in state, token in expo-secure-store
  app/          Screens (Expo Router)
    sign-in.tsx, complete-profile.tsx
    (tabs)/     Tournaments, My Squads, Organizer (admin only), Profile
    tournament/[id].tsx   Details, your squad, room details, leaderboard
    register/[id].tsx     Squad registration
    admin/      New tournament, manage, poster studio, WhatsApp Channel, players
  components/   Tournament card, room card, poster, phone input, WhatsApp helpers, UI kit
  constants/    App settings and theme
  utils/        Formatting, device helpers (haptics, share, copy, confirm)
```

## Checks

```bash
npm run typecheck   # TypeScript
npm run lint        # ESLint (Expo config)
npm run format      # Prettier
```

## Notes

- Free Fire is a trademark of Garena. This app isn't affiliated with Garena and uses its own name,
  logo and artwork.
- Prizes are shown in the app but paid by you outside it. The backend's token wallet is switched off.
