# Clutch Arena (simple version): ready to paste into Google AI Studio

A **simple, safe** Free Fire squad registration app:

- **Players:** no login, no OTP. Open the link, pick a tournament, type the squad name and 4
  players' names and WhatsApp numbers, tick two boxes, done.
- **You (organizer):** sign in with your Google account (one tap) and see every squad, name and
  number. Call or WhatsApp anyone, mark payments, send room details, post results and make posters.
- **Safety:** checked by Firebase's database rules, which were **tested with 29 attack checks**
  in Google's Firestore emulator. Players can only *add* a registration. Nobody but your Google
  account can read names and numbers or change prizes, settings or payments. Spots can't be
  overfilled and one number can't be in two squads. Firebase App Check blocks bots and scripts.

> **No app can be 100% hacker-proof.** Without OTP, numbers aren't verified, so someone could
> type a fake squad. You can delete fake entries in one tap, and App Check stops automated spam.
> Never put the ₹50/₹200 fee live before a lawyer confirms it's allowed under the Online Gaming
> Act 2025 (the fee switch starts **off**).

---

## Step 1: create Firebase (free, about 10 minutes, once)

1. Open **console.firebase.google.com** → **Create a project** → name it `clutch-arena` → you can
   turn Google Analytics **off** → Create.
2. **Build → Firestore Database → Create database** → location **asia-south1 (Mumbai)** →
   **Start in production mode** → Create.
3. **Build → Authentication → Get started → Google → Enable** → pick your support email → Save.
4. **Firestore Database → Rules** → delete everything there → paste the **RULES** from the bottom
   of this file → change `YOUR-EMAIL@gmail.com` to **your** Google email → **Publish**.
5. **Project settings (gear icon) → Your apps → Web (</>)** → nickname `clutch-arena-web` →
   Register. Copy the `firebaseConfig` block it shows. These values are public identifiers,
   not passwords, so it's fine that they end up in the app.

## Step 2: build the app in Google AI Studio

1. Open **aistudio.google.com → Build**.
2. Paste the whole **PROMPT** below and send it.
3. When it's done, send one more message:
   `Here is my Firebase config: ` followed by the `firebaseConfig` block you copied, and
   `My organizer email is: you@gmail.com`.
4. Try it in the preview: register a test squad, then open `/admin` and sign in with Google.

## Step 3: put it online and lock it down

1. In AI Studio, use **Deploy** (or Share → deploy app) to get your public link.
2. Firebase → **Authentication → Settings → Authorized domains → Add domain** → add your app's
   domain (from the link, without `https://`). Add the AI Studio preview domain too if Google
   sign-in shows an "unauthorized domain" error.
3. **Recommended, to stop bots:** Firebase → **Build → App Check** → register your web app with
   **reCAPTCHA Enterprise** → copy the **site key** → tell AI Studio: `My App Check site key is: ...`
   → test the app → back in App Check, tap **Enforce** for **Cloud Firestore**.
4. Open the app → `/admin` → **Settings**: add your WhatsApp Channel link, your WhatsApp number
   (for payment screenshots) and your UPI ID. Leave **entry fees off** until your lawyer says yes.

To check the rules yourself later (optional, needs a computer with Node.js and Java):
`npm i -g firebase-tools @firebase/rules-unit-testing firebase` then, in this folder,
`firebase emulators:exec --only firestore --project demo-clutch "node rules.test.mjs"`.

---

## PROMPT (paste this whole block into AI Studio → Build)

```text
You are a senior React + Firebase engineer and designer. Build "Clutch Arena": a simple, secure,
mobile-first web app for Free Fire SQUAD tournaments in India. Players register a squad of 4
WITHOUT any login or OTP. Only the organizer (one Google account) can see players' details.

######## 1. STACK AND HARD RULES ########
- React + TypeScript + Vite + Tailwind CSS + react-router. Works great at 360 px width.
- Firebase JS SDK v10+ (modular): Cloud Firestore, Firebase Auth (Google sign-in for the
  organizer ONLY), and Firebase App Check (ReCaptchaEnterpriseProvider).
- src/firebase.ts holds FIREBASE_CONFIG, ORGANIZER_EMAIL and APP_CHECK_SITE_KEY as clearly marked
  placeholders. I will give you the real values. Initialise App Check only when the site key is
  not the placeholder.
- The database security rules are ALREADY WRITTEN AND TESTED (they're at the end of this message
  as firestore.rules). Save them in the project unchanged, and make every read and write in the
  app match them EXACTLY as described in section 4. Never weaken them.
- Players never sign in. Never ask players for OTP, passwords, email or location.
- No analytics, ads, trackers, cookies of our own, Gemini/AI calls, or third-party scripts
  (App Check's reCAPTCHA is the only one). Never log phone numbers to the console.
- Never use dangerouslySetInnerHTML or eval. Treat every text from the database as plain text.
- Fonts: Rajdhani (headings) and Inter (body) from Google Fonts, both SIL OFL 1.1.
  Icons: lucide-react (ISC). No stock photos. Poster export: html-to-image (MIT).
  List them with licences on a /credits page.

######## 2. DATA (Cloud Firestore) ########
config/settings  (anyone reads, organizer writes)
  { organizerName: string, whatsappChannelUrl: string|null, organizerWhatsApp: string|null
    (10 digits), upiId: string|null, upiName: string|null, entryFeesEnabled: boolean (default
    false), feePerPlayer: number (default 50) }

tournaments/{tid}  (anyone reads, organizer writes)
  { title, map: "Bermuda"|"Purgatory"|"Kalahari"|"Alpine"|"NeXTerra", startsAt: Timestamp,
    maxSquads: number (2..12), squadsRegistered: number (starts 0), nextTeamNumber: number
    (starts 1), lastRegistrationId: string (starts ""), status: "OPEN"|"CLOSED"|"COMPLETED"|
    "CANCELLED", prizePool: number, prizes: number[] (1st, 2nd, 3rd = 50%, 30%, 20% of the
    pool, rounded down), perKill: number, rules: string[], results: { squadName, placement,
    kills, prize }[] (empty until results are posted), createdAt: Timestamp }

tournaments/{tid}/registrations/{rid}  (PRIVATE: only the organizer reads, edits or deletes)
  { squadName (2..24 chars), teamNumber: integer, members: exactly 4 maps
    { name (2..32 chars), phone: 10 digits starting 6-9 with NO +91 and no spaces,
      uid: "" or 6..12 digits (Free Fire UID, optional) },
    adult: true, consent: true, paymentStatus: "unpaid", createdAt: serverTimestamp() }
  The organizer may later set paymentStatus to "paid".

tournaments/{tid}/phones/{phone}  (create-only; nobody but the organizer reads)
  { registrationId: rid }   One doc per member number. Blocks a number from being in 2 squads.

tournaments/{tid}/publicSquads/{rid}  (anyone reads)
  { squadName, teamNumber }   The ONLY squad info players can see.

######## 3. PLAYER SCREENS (no login) ########
- Home "/": logo, short tagline "Free Fire squad tournaments. Register in a minute.",
  a "Follow our WhatsApp Channel" banner (only if whatsappChannelUrl is set), and tournament cards
  (OPEN first, then CLOSED, then COMPLETED). Each card: map-coloured banner with a dark scrim
  behind the text, title, map, date and time, prize pool, per-kill reward, entry ("Free", or
  "₹50/player · ₹200/squad" when fees are on), a progress bar "7/12 squads · 5 spots left", a real
  countdown to the start, and one button (Register / Full / Closed / Results).
- Tournament page "/t/:tid": details, prizes (1st/2nd/3rd + per kill), rules, "Registered squads"
  (from publicSquads: team number + squad name only), the leaderboard from results when COMPLETED,
  and a Register button when it's OPEN, not full and before startsAt.
- Register "/t/:tid/register":
  - Squad name; Player 1 (Captain): name + WhatsApp number; Players 2–4: name + WhatsApp number;
    each player has an optional Free Fire UID. Phone inputs show a fixed "+91" and accept exactly
    10 digits. Validate as the rules do (all 4 numbers different).
  - If entryFeesEnabled: show the full price BEFORE submitting: "Entry fee: ₹50 × 4 players =
    ₹200. No other charges. Pay by UPI after registering."
  - Two UNTICKED checkboxes, both required:
    [ ] "All 4 players are 18 or older."
    [ ] "All 4 players agreed to share their name and number with Clutch Arena for this
        tournament." followed by a link to the Privacy Policy.
  - Note under the form: "Only the organizer can see these numbers. Other players see just your
    squad name."
  - Submit button disabled while saving (no double submissions).
- Success screen: "Squad registered! Team #N", a short code (the first 6 characters of rid,
  uppercase), then:
  - if fees are on: "Pay ₹200 to {upiId}" with a Copy button and an "Open UPI app" link
    upi://pay?pa={upiId}&pn={upiName}&am={amount}&cu=INR&tn=Clutch%20Arena%20{code}, and a
    "Send payment screenshot on WhatsApp" button opening
    https://wa.me/91{organizerWhatsApp}?text=Clutch%20Arena%20payment%20-%20{squad}%20-%20{code}.
    Say: "Your spot is confirmed when the organizer receives your payment."
  - "The organizer will WhatsApp the room ID and password to your captain before the match."
  - the WhatsApp Channel button.
- If saving fails, say: "Couldn't register. The tournament may be full or closed, or one of these
  numbers is already registered. Check and try again." Never reveal which other squad has a number.
- Footer on every page: Privacy · Terms · Refunds · Cookies · Contact · Credits · Organizer login,
  "© Clutch Arena", and "Clutch Arena is independent and not affiliated with Garena (Free Fire)
  or WhatsApp."

######## 4. HOW TO WRITE TO THE DATABASE (must match the rules exactly) ########
REGISTER (player, no login): one runTransaction:
  1. t = transaction.get(tournaments/{tid}). Stop with a friendly message if t.status !== "OPEN",
     now >= t.startsAt, or t.squadsRegistered >= t.maxSquads.
  2. rid = doc(collection(db, `tournaments/${tid}/registrations`)).id  (new auto id)
  3. transaction.set(registrations/{rid}, { squadName, teamNumber: t.nextTeamNumber, members
     (4 x {name, phone, uid}), adult: true, consent: true, paymentStatus: "unpaid",
     createdAt: serverTimestamp() })   (no other fields)
  4. for each of the 4 phones: transaction.set(phones/{phone}, { registrationId: rid })
  5. transaction.set(publicSquads/{rid}, { squadName, teamNumber: t.nextTeamNumber })
  6. transaction.update(tournaments/{tid}, { squadsRegistered: t.squadsRegistered + 1,
     nextTeamNumber: t.nextTeamNumber + 1, lastRegistrationId: rid })   (only these 3 fields)
  Trim names; store phones as exactly 10 digits; uid "" when empty.
REMOVE A SQUAD (organizer): one writeBatch: delete the registration, its publicSquads doc and its 4
  phones docs, and update the tournament's squadsRegistered to minus 1 (keep nextTeamNumber).
Everything else in /admin: normal reads and writes (the organizer is allowed everything).

######## 5. ORGANIZER AREA "/admin" (Google sign-in) ########
- "Sign in with Google" (signInWithPopup). If the email isn't ORGANIZER_EMAIL, show "This Google
  account isn't the organizer." with Sign out. (The rules enforce this anyway.)
- Dashboard: tournaments with squad counts, and "New tournament".
- New/Edit tournament: title, map chips, date and time pickers (not in the past), max squads
  (2..12, default 12), prize pool (₹), per-kill reward (₹), rules (one per line, with sensible
  defaults: join with registered names/UIDs; room details shared on WhatsApp before start; no
  hacks, scripts or teaming; screenshot your result; organizer's decision is final), and a live
  preview card. Prizes are computed as 50/30/20.
- Manage tournament "/admin/t/:tid":
  - Status buttons: Close registration (CLOSED), Reopen, Cancel, each with a confirmation.
  - Registrations: one card per squad (team number, squad name, time registered, payment status
    toggle Unpaid/Paid). Members show name, number and UID. Numbers are hidden behind a
    "Show numbers" toggle and, when shown, are tappable: tel:+91… and https://wa.me/91….
  - "Remove squad" (confirm) using the batch in section 4.
  - "Copy list" (plain text) and "Download CSV" (squad, team, player, phone, UID, payment).
  - "Send room details": room ID + password inputs (kept only in the browser, NOT saved to the
    database), then one "Send to captain on WhatsApp" button per squad, opening
    https://wa.me/91{captainPhone}?text={message with tournament, team number, room ID, password}.
  - Results: order squads with up/down arrows, set kills with steppers, check that total kills
    don't exceed players − 1, compute prize = prizes[place−1] (if any) + kills × perKill, then save
    `results` and set status COMPLETED (with confirmation).
- Poster studio "/admin/t/:tid/poster":
  - 2:3 portrait poster (a 360×540 node exported with html-to-image at pixelRatio 3 →
    1080×1620 PNG).
  - Templates: "Registration open"; "Last spots", offered only when 3 or fewer spots are left and
    printing "ONLY {n} SPOTS LEFT · as of {time}"; and "Results", a podium with 2nd · 1st · 3rd
    squad names, prizes and kills.
  - Themes: Inferno (deep red → orange, gold accent), Neon (navy → electric blue, cyan accent),
    Royal (black → bronze, gold accent).
  - Content: organizer name + flame logo, "FREE FIRE · SQUAD", big title, date / time / map chips,
    huge prize pool, 1st/2nd/3rd + per-kill boxes, entry / squads / spots-left boxes, a bar
    "REGISTER YOUR SQUAD · LINK IN DESCRIPTION", and "Follow our WhatsApp Channel".
  - Every number comes from the database.
  - "Share to WhatsApp": navigator.share({ files: [png], text: caption }) when
    navigator.canShare({ files }) is true. Otherwise download the PNG. Always copy the caption
    (title, date, map, prize pool, per kill, entry, spots left, the app link and the channel link)
    and show: "Share → WhatsApp → pick your Channel → paste the caption → send."
- Settings "/admin/settings": organizer name, WhatsApp Channel link (must start with
  https://whatsapp.com/channel/), your WhatsApp number, UPI ID, UPI name, entry-fee switch
  (OFF by default) and fee per player (₹50). Next to the switch show: "Turn on only after a lawyer
  confirms entry fees are allowed under India's Online Gaming Act 2025."

######## 6. LOOK AND FEEL (dark esports, accessible) ########
Colours: background #0A0C11, surface #141720, raised #1C2030, border #272C3D, text #F4F6FB,
muted #9AA2B6, placeholder/faint #8A93A8, orange #FF6A1A (links, accents), gold #FFC23D, green
#22D37A, blue #3DA9FF, red #FF4D5E, WhatsApp green #25D366 (dark #0A0C11 icon on it).
Primary buttons: gradient #FF8A00 → #FF5A3C with DARK text #0A0C11.
Map banners: Bermuda #13B5A5→#1B3F8B, Purgatory #9B3CF0→#2A0A4F, Kalahari #F7A440→#8A300B,
Alpine #6FC8FF→#24427A, NeXTerra #00E0C6→#4C1D95, always with a dark scrim behind text.
Rajdhani 700 for headings, numbers and buttons. Rounded 12–18 px cards, subtle press animation,
a pulsing dot for "LIVE", and respect prefers-reduced-motion.
Logo: an orange→red rounded square with a white flame, next to "CLUTCH ARENA" ("ARENA" in orange).

######## 7. ACCESSIBILITY (must pass) ########
Contrast at least 4.5:1 for text (the palette above passes). Visible focus ring: 2 px #FFC23D
via :focus-visible. Everything works with the keyboard (Tab order, no traps). Real buttons, links
and labels; aria-checked on checkboxes; errors tied to fields with aria-describedby. Decorative
icons get aria-hidden="true"; the poster preview gets an aria-label. Tap targets at least 44 px.
lang="en".

######## 8. LEGAL PAGES (each starts with a yellow "DRAFT – not yet reviewed" banner) ########
Keep the [blanks] visible and highlighted.
- Privacy Policy (India DPDP Act 2023): Clutch Arena, [contact email], [address], grievance
  officer [name].
  - What we collect: squad name, each player's name, WhatsApp number and optional Free Fire UID
    (given by the captain with their permission), results, and payment confirmations the players
    send us on WhatsApp. Players have no accounts.
  - Firebase App Check uses Google reCAPTCHA, which may process device and browser data to block
    bots.
  - Why: run tournaments, contact squads, pay prizes, prevent cheating, legal duties.
  - Who sees it: only the organizer. The public sees squad names and results. Google Firebase
    (Mumbai) stores it as our processor. WhatsApp only when someone chooses to message.
  - Kept until [90 days] after the tournament, except payment records the law requires.
  - Rights: access, correction, deletion and complaints by emailing [contact email], then the
    Data Protection Board of India.
  - 18+ only.
- Terms: 18+ and India only; the captain is responsible and has teammates' consent; true details;
  one squad per number per tournament; entry fee ₹50/player (₹200/squad) when enabled, by UPI
  within [2 hours], spot confirmed on payment; prizes by UPI to the captain within [7 days], with
  TDS where the law requires; fair play (no hacks, teaming, account sharing, betting; don't share
  room details); disputes within [24 hours] with screenshots, organizer's decision final; not
  affiliated with Garena/WhatsApp; liability limited to fees paid; Indian law, courts in [city].
- Refund Policy: full refund if we cancel, if they withdraw before registration closes, if we
  remove them through no fault of theirs, or for double payments; none for no-shows, late joins or
  disqualification; replay or refund if the game itself fails; ask at [contact email]; refunds by
  UPI within [7 working days].
- Cookie Policy: players' browsers store nothing of ours. reCAPTCHA (App Check) may set
  security cookies such as _GRECAPTCHA to block bots. These are strictly necessary, so there's no
  banner. The organizer's Google sign-in keeps a session in browser storage. No analytics or
  advertising cookies.
- Contact: Clutch Arena, [address], [contact email], grievance officer [name].
- Credits: fonts, icons and libraries with their licences.

######## 9. DONE WHEN ########
A player can register a squad in under a minute on a phone without any login. A second squad
using any of the same numbers is refused. A full, closed or started tournament refuses
registrations. Nobody except ORGANIZER_EMAIL can see names and numbers (try it in an incognito
window). The organizer can manage squads, payments, room messages, results and posters. There are
no console errors.

######## firestore.rules (save unchanged; I'll paste the same rules into Firebase) ########

rules_version = '2';

// Clutch Arena security rules.
// Players (no login): can read tournaments, squad names and settings, and can ADD a registration.
// Organizer (Google sign-in with ORGANIZER_EMAIL): can read and manage everything.
// Everything else is denied.
service cloud.firestore {
  match /databases/{database}/documents {

    // ---------- helpers ----------
    function isOrganizer() {
      return request.auth != null
        && request.auth.token.email == 'YOUR-EMAIL@gmail.com'   // <-- CHANGE THIS to your Google email
        && request.auth.token.email_verified == true;
    }
    function tournamentDoc(tid) { return /databases/$(database)/documents/tournaments/$(tid); }
    function registrationDoc(tid, rid) { return /databases/$(database)/documents/tournaments/$(tid)/registrations/$(rid); }
    function phoneDoc(tid, phone) { return /databases/$(database)/documents/tournaments/$(tid)/phones/$(phone); }
    function publicSquadDoc(tid, rid) { return /databases/$(database)/documents/tournaments/$(tid)/publicSquads/$(rid); }
    function isPhone(p) { return p is string && p.matches('^[6-9][0-9]{9}$'); }
    function isText(t, min, max) { return t is string && t.size() >= min && t.size() <= max; }
    function isUid(u) { return u is string && (u == '' || u.matches('^[0-9]{6,12}$')); }
    function isMember(m) {
      return m is map
        && m.keys().hasAll(['name', 'phone', 'uid']) && m.keys().hasOnly(['name', 'phone', 'uid'])
        && isText(m.name, 2, 32) && isPhone(m.phone) && isUid(m.uid);
    }
    function phonesDistinct(ms) {
      return ms[0].phone != ms[1].phone && ms[0].phone != ms[2].phone && ms[0].phone != ms[3].phone
        && ms[1].phone != ms[2].phone && ms[1].phone != ms[3].phone && ms[2].phone != ms[3].phone;
    }
    function isRegistration(d) {
      return d.keys().hasAll(['squadName', 'teamNumber', 'members', 'adult', 'consent', 'paymentStatus', 'createdAt'])
        && d.keys().hasOnly(['squadName', 'teamNumber', 'members', 'adult', 'consent', 'paymentStatus', 'createdAt'])
        && isText(d.squadName, 2, 24)
        && d.teamNumber is int
        && d.members is list && d.members.size() == 4
        && isMember(d.members[0]) && isMember(d.members[1]) && isMember(d.members[2]) && isMember(d.members[3])
        && phonesDistinct(d.members)
        && d.adult == true && d.consent == true
        && d.paymentStatus == 'unpaid'
        && d.createdAt == request.time;
    }

    // ---------- public settings (organizer edits) ----------
    match /config/settings {
      allow read: if true;
      allow write: if isOrganizer();
    }

    // ---------- tournaments ----------
    match /tournaments/{tid} {
      allow read: if true;
      allow create, delete: if isOrganizer();
      // Players may only bump the counters, by exactly one, together with a new registration.
      allow update: if isOrganizer() || (
        resource.data.status == 'OPEN'
        && request.time < resource.data.startsAt
        && request.resource.data.diff(resource.data).affectedKeys()
             .hasOnly(['squadsRegistered', 'nextTeamNumber', 'lastRegistrationId'])
        && request.resource.data.squadsRegistered == resource.data.squadsRegistered + 1
        && request.resource.data.squadsRegistered <= resource.data.maxSquads
        && request.resource.data.nextTeamNumber == resource.data.nextTeamNumber + 1
        && request.resource.data.lastRegistrationId is string
        && !exists(registrationDoc(tid, request.resource.data.lastRegistrationId))
        && existsAfter(registrationDoc(tid, request.resource.data.lastRegistrationId))
      );

      // Private: squad members' names and phone numbers. Only the organizer can read them.
      match /registrations/{rid} {
        allow read, update, delete: if isOrganizer();
        allow create: if isRegistration(request.resource.data)
          && get(tournamentDoc(tid)).data.status == 'OPEN'
          && request.time < get(tournamentDoc(tid)).data.startsAt
          && request.resource.data.teamNumber == get(tournamentDoc(tid)).data.nextTeamNumber
          && getAfter(tournamentDoc(tid)).data.lastRegistrationId == rid
          && existsAfter(phoneDoc(tid, request.resource.data.members[0].phone))
          && existsAfter(phoneDoc(tid, request.resource.data.members[1].phone))
          && existsAfter(phoneDoc(tid, request.resource.data.members[2].phone))
          && existsAfter(phoneDoc(tid, request.resource.data.members[3].phone))
          && existsAfter(publicSquadDoc(tid, rid));
      }

      // One document per phone number: a number can be in only one squad per tournament.
      // Create-only (a second create of the same number fails). Not readable by players.
      match /phones/{phone} {
        allow read, delete: if isOrganizer();
        allow create: if isPhone(phone)
          && request.resource.data.keys().hasOnly(['registrationId'])
          && request.resource.data.registrationId is string
          && (getAfter(registrationDoc(tid, request.resource.data.registrationId)).data.members[0].phone == phone
           || getAfter(registrationDoc(tid, request.resource.data.registrationId)).data.members[1].phone == phone
           || getAfter(registrationDoc(tid, request.resource.data.registrationId)).data.members[2].phone == phone
           || getAfter(registrationDoc(tid, request.resource.data.registrationId)).data.members[3].phone == phone);
      }

      // Public: just the squad name and team number, so everyone can see who's in.
      match /publicSquads/{rid} {
        allow read: if true;
        allow update, delete: if isOrganizer();
        allow create: if request.resource.data.keys().hasOnly(['squadName', 'teamNumber'])
          && request.resource.data.squadName == getAfter(registrationDoc(tid, rid)).data.squadName
          && request.resource.data.teamNumber == getAfter(registrationDoc(tid, rid)).data.teamNumber;
      }
    }

    // Anything not listed above is denied.
  }
}
```

---

## RULES (paste into Firebase → Firestore Database → Rules, change the email, Publish)

```
rules_version = '2';

// Clutch Arena security rules.
// Players (no login): can read tournaments, squad names and settings, and can ADD a registration.
// Organizer (Google sign-in with ORGANIZER_EMAIL): can read and manage everything.
// Everything else is denied.
service cloud.firestore {
  match /databases/{database}/documents {

    // ---------- helpers ----------
    function isOrganizer() {
      return request.auth != null
        && request.auth.token.email == 'YOUR-EMAIL@gmail.com'   // <-- CHANGE THIS to your Google email
        && request.auth.token.email_verified == true;
    }
    function tournamentDoc(tid) { return /databases/$(database)/documents/tournaments/$(tid); }
    function registrationDoc(tid, rid) { return /databases/$(database)/documents/tournaments/$(tid)/registrations/$(rid); }
    function phoneDoc(tid, phone) { return /databases/$(database)/documents/tournaments/$(tid)/phones/$(phone); }
    function publicSquadDoc(tid, rid) { return /databases/$(database)/documents/tournaments/$(tid)/publicSquads/$(rid); }
    function isPhone(p) { return p is string && p.matches('^[6-9][0-9]{9}$'); }
    function isText(t, min, max) { return t is string && t.size() >= min && t.size() <= max; }
    function isUid(u) { return u is string && (u == '' || u.matches('^[0-9]{6,12}$')); }
    function isMember(m) {
      return m is map
        && m.keys().hasAll(['name', 'phone', 'uid']) && m.keys().hasOnly(['name', 'phone', 'uid'])
        && isText(m.name, 2, 32) && isPhone(m.phone) && isUid(m.uid);
    }
    function phonesDistinct(ms) {
      return ms[0].phone != ms[1].phone && ms[0].phone != ms[2].phone && ms[0].phone != ms[3].phone
        && ms[1].phone != ms[2].phone && ms[1].phone != ms[3].phone && ms[2].phone != ms[3].phone;
    }
    function isRegistration(d) {
      return d.keys().hasAll(['squadName', 'teamNumber', 'members', 'adult', 'consent', 'paymentStatus', 'createdAt'])
        && d.keys().hasOnly(['squadName', 'teamNumber', 'members', 'adult', 'consent', 'paymentStatus', 'createdAt'])
        && isText(d.squadName, 2, 24)
        && d.teamNumber is int
        && d.members is list && d.members.size() == 4
        && isMember(d.members[0]) && isMember(d.members[1]) && isMember(d.members[2]) && isMember(d.members[3])
        && phonesDistinct(d.members)
        && d.adult == true && d.consent == true
        && d.paymentStatus == 'unpaid'
        && d.createdAt == request.time;
    }

    // ---------- public settings (organizer edits) ----------
    match /config/settings {
      allow read: if true;
      allow write: if isOrganizer();
    }

    // ---------- tournaments ----------
    match /tournaments/{tid} {
      allow read: if true;
      allow create, delete: if isOrganizer();
      // Players may only bump the counters, by exactly one, together with a new registration.
      allow update: if isOrganizer() || (
        resource.data.status == 'OPEN'
        && request.time < resource.data.startsAt
        && request.resource.data.diff(resource.data).affectedKeys()
             .hasOnly(['squadsRegistered', 'nextTeamNumber', 'lastRegistrationId'])
        && request.resource.data.squadsRegistered == resource.data.squadsRegistered + 1
        && request.resource.data.squadsRegistered <= resource.data.maxSquads
        && request.resource.data.nextTeamNumber == resource.data.nextTeamNumber + 1
        && request.resource.data.lastRegistrationId is string
        && !exists(registrationDoc(tid, request.resource.data.lastRegistrationId))
        && existsAfter(registrationDoc(tid, request.resource.data.lastRegistrationId))
      );

      // Private: squad members' names and phone numbers. Only the organizer can read them.
      match /registrations/{rid} {
        allow read, update, delete: if isOrganizer();
        allow create: if isRegistration(request.resource.data)
          && get(tournamentDoc(tid)).data.status == 'OPEN'
          && request.time < get(tournamentDoc(tid)).data.startsAt
          && request.resource.data.teamNumber == get(tournamentDoc(tid)).data.nextTeamNumber
          && getAfter(tournamentDoc(tid)).data.lastRegistrationId == rid
          && existsAfter(phoneDoc(tid, request.resource.data.members[0].phone))
          && existsAfter(phoneDoc(tid, request.resource.data.members[1].phone))
          && existsAfter(phoneDoc(tid, request.resource.data.members[2].phone))
          && existsAfter(phoneDoc(tid, request.resource.data.members[3].phone))
          && existsAfter(publicSquadDoc(tid, rid));
      }

      // One document per phone number: a number can be in only one squad per tournament.
      // Create-only (a second create of the same number fails). Not readable by players.
      match /phones/{phone} {
        allow read, delete: if isOrganizer();
        allow create: if isPhone(phone)
          && request.resource.data.keys().hasOnly(['registrationId'])
          && request.resource.data.registrationId is string
          && (getAfter(registrationDoc(tid, request.resource.data.registrationId)).data.members[0].phone == phone
           || getAfter(registrationDoc(tid, request.resource.data.registrationId)).data.members[1].phone == phone
           || getAfter(registrationDoc(tid, request.resource.data.registrationId)).data.members[2].phone == phone
           || getAfter(registrationDoc(tid, request.resource.data.registrationId)).data.members[3].phone == phone);
      }

      // Public: just the squad name and team number, so everyone can see who's in.
      match /publicSquads/{rid} {
        allow read: if true;
        allow update, delete: if isOrganizer();
        allow create: if request.resource.data.keys().hasOnly(['squadName', 'teamNumber'])
          && request.resource.data.squadName == getAfter(registrationDoc(tid, rid)).data.squadName
          && request.resource.data.teamNumber == getAfter(registrationDoc(tid, rid)).data.teamNumber;
      }
    }

    // Anything not listed above is denied.
  }
}
```
