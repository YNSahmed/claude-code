# Clutch Arena: complete build prompt for Google AI Studio

This file contains everything needed to rebuild **Clutch Arena** (Free Fire squad tournaments) in
**Google AI Studio → Build**. AI Studio makes web apps that run in the browser, so this version
uses **Firebase** for phone-number login and for a database whose security rules keep players' data
private.

## How to use this file

1. Go to [aistudio.google.com](https://aistudio.google.com) → **Build**.
2. Paste the **whole MASTER PROMPT** (Part A) and let it generate the first version.
3. Then paste the **phase prompts** in Part B **one at a time**. After each, try the app in the
   preview before moving on. Smaller steps give much better results than one giant request.
4. Do the **Firebase setup** in Part C. AI Studio can't do it for you.
5. Before launch, go through Part E.

> ⚠️ **Entry fees and the law.** India's Promotion and Regulation of Online Gaming Act, 2025 bans
> "online money games" (paying a fee to win money), except properly recognised and registered
> e-sports. The prompt builds the ₹50/₹200 entry fee **switched off by default**. Turn it on only
> after a lawyer confirms you're allowed.

---

## Part A: MASTER PROMPT (paste this first)

```text
You are a senior full-stack engineer and product designer. Build "Clutch Arena": a mobile-first web
app (installable PWA) for running Free Fire custom-room SQUAD tournaments in India.

=====================================================================
1. GOAL IN ONE PARAGRAPH
=====================================================================
Players sign in with their Indian mobile number (SMS one-time code), confirm they are 18+, and a
captain registers a squad of 4 (captain + 3 teammates, each with name and mobile number). Players
see tournaments, their squad, a countdown, and then the room ID and password when the organizer
releases them. Each person's data is private: other players only ever see squad names. Only the
organizer (admin) can create and run tournaments, see everyone's details, post results, make
attractive posters, and share them to the organizer's WhatsApp Channel.

=====================================================================
2. TECH STACK AND HARD CONSTRAINTS
=====================================================================
- React + TypeScript + Vite + Tailwind CSS. Mobile-first, works from 360 px wide upwards.
- Firebase JS SDK (modular v10+): Firebase Authentication (Phone sign-in) and Cloud Firestore.
  Put the config in src/firebase.ts with clearly marked placeholders I will fill in:
  apiKey, authDomain, projectId, appId. Do not invent values.
- Write firestore.rules (security rules) and firestore.indexes.json as real files in the project.
  The rules are the security boundary: never rely on hiding things in the UI alone.
- Routing with react-router (routes listed in section 7). Every page has its own URL.
- Posters: html-to-image (toPng) and the Web Share API (navigator.share with files).
- No other backend, no Cloud Functions required.
- Do NOT add analytics, ads, tracking pixels, crash reporters, or third-party scripts.
- Do NOT call the Gemini API or any AI service. No player data may leave Firebase.
- Do NOT store IP addresses, and do not copy phone numbers into any other collection or log.
- No in-app payments. Entry fees (when enabled) are paid by UPI outside the app.
- India only: phone numbers are +91 followed by 10 digits starting with 6, 7, 8 or 9.
- Currency is Indian rupees, shown as "₹1,234".
- Use only fonts and icons licensed for commercial use:
  Rajdhani (Google Fonts, SIL OFL 1.1) for headings, Inter (SIL OFL 1.1) for body text,
  and lucide-react icons (ISC licence). No stock photos. Write their sources into CREDITS.md.

=====================================================================
3. ROLES
=====================================================================
- Visitor (signed out): can see the sign-in page and the legal pages only.
- Player: any signed-in, 18+ user. Can register ONE squad per tournament as its captain, or be a
  member of a squad someone else registered.
- Captain: the player who registered a squad. Sees their own squad's names and numbers.
- Member: a teammate whose number the captain entered. If they sign in with that number, they see
  the squad, the teammates' NAMES, only THEIR OWN number, and the room details.
- Organizer (admin): phone numbers listed in the Firestore document config/admins (field "phones",
  an array of "+91..." strings, created by hand in the Firebase console). Sees and manages
  everything. Nobody can make themselves an admin from the app.

=====================================================================
4. DATA MODEL (Cloud Firestore)
=====================================================================
config/admins                  { phones: string[] }               Never readable or writable by clients.
config/public                  { organizerName: string, whatsappChannelUrl: string|null,
                                 entryFeesEnabled: boolean (default false), entryFeePerPlayer: 50,
                                 upiId: string|null, upiPayeeName: string|null }
                                 Anyone can read. Only admins write.
users/{uid}                    { phone (must equal the auth token's phone_number), displayName,
                                 ageConfirmedAt (timestamp), createdAt }
                                 The owner reads/writes their own doc (not the phone field);
                                 admins can read all.
tournaments/{tid}              { title, mode: "SQUAD", teamSize: 4, map: "BERMUDA"|"PURGATORY"|
                                 "KALAHARI"|"ALPINE"|"NEXTERRA", startsAt, registrationClosesAt,
                                 maxTeams (2..12), teamsRegistered, nextTeamNumber,
                                 prizePool, prizeSplit: [50,30,20] (percent), perKillReward,
                                 rules: string[], status: "OPEN"|"LOCKED"|"LIVE"|"COMPLETED"|"CANCELLED",
                                 roomPublished: boolean, roomReleaseAt (timestamp|null),
                                 completedAt (timestamp|null), createdAt }
                                 Anyone signed in can read. Admins write everything. Players may
                                 only change teamsRegistered/nextTeamNumber as described in section 6.
tournaments/{tid}/private/room { roomId, password }
                                 Readable by admins, or by a registered player (captain or member)
                                 only when request.time >= tournament.roomReleaseAt. Admin writes.
tournaments/{tid}/squads/{captainUid}
                               { name (2..24 chars), teamNumber, captainUid, createdAt,
                                 consentConfirmedAt, placement|null, kills|null }
                                 PUBLIC fields only (any signed-in user can read: squad names
                                 are public). The doc id is the captain's uid, so a captain can
                                 only ever have one squad per tournament.
tournaments/{tid}/squads/{captainUid}/members/{phoneE164}
                               { position: 1..4, name (2..32), phone (== doc id),
                                 freeFireUid (optional, 6..12 digits), isCaptain }
                                 Readable ONLY by: admins, the squad's captain, and the member
                                 whose auth phone_number equals the doc id. Created only by the
                                 captain in the registration batch. Position 1 must be the
                                 captain's own verified phone number.
tournaments/{tid}/squads/{captainUid}/private/payment
                               { status: "pending"|"submitted"|"paid"|"rejected", utr (12 digits)|null,
                                 amount, updatedAt }   (only exists when entry fees are enabled)
                                 Readable by the captain and admins. The captain may only set
                                 status "submitted" + utr; only admins set "paid"/"rejected".
tournaments/{tid}/memberIndex/{phoneE164}
                               { captainUid }   Create-only (no update). Makes it impossible for one
                                 phone number to be in two squads of the same tournament. Clients
                                 cannot read it (rules use exists() on it). Captain/admin may delete.
auditLog/{autoId}              { adminUid, action, target, details, at } Admin create-only,
                                 no update or delete, admin read.

=====================================================================
5. SECURITY RULES (firestore.rules) MUST ENFORCE ALL OF THIS
=====================================================================
- isSignedIn(): request.auth != null and request.auth.token.phone_number is set.
- isAdmin(): request.auth.token.phone_number in get(/config/admins).data.phones.
- Default deny for every path not listed.
- users/{uid}: create only if uid == request.auth.uid, phone == request.auth.token.phone_number,
  and ageConfirmedAt == request.time (the 18+ checkbox was ticked). Phone can never change.
- Squad registration (a single batched write from the captain) is only valid when ALL are true:
  tournament.status == "OPEN"; request.time < tournament.registrationClosesAt;
  getAfter(tournament).teamsRegistered == get(tournament).teamsRegistered + 1 and <= maxTeams;
  getAfter(tournament).nextTeamNumber == get(tournament).nextTeamNumber + 1;
  the new squad's teamNumber == get(tournament).nextTeamNumber;
  the squad doc id == request.auth.uid; consentConfirmedAt == request.time;
  exactly teamSize member docs are created, positions 1..4, member 1 phone == the captain's token
  phone; every member's memberIndex doc is created in the same batch (create fails if the phone is
  already registered, which blocks duplicates); names and optional UIDs are validated.
- Players may only touch teamsRegistered/nextTeamNumber on a tournament, and only as part of
  registering or withdrawing their own squad. All other tournament fields: admin only.
- Withdraw (captain, while status == "OPEN"): delete the squad, its members, its payment doc and
  its memberIndex docs, and decrement teamsRegistered by 1 in one batch.
- Room details: as described in the data model. Squad results (placement, kills): admin only.
- Admins may delete any squad (with its subdocs and index docs) and must write an auditLog entry.
- Also write rules unit tests with @firebase/rules-unit-testing covering every rule above
  (put them in /tests and tell me how to run them against the Firebase Emulator).

=====================================================================
6. KEY FLOWS
=====================================================================
A. Sign-in (route /sign-in)
   1. Mobile number field with a fixed "+91" prefix (10 digits, numeric keyboard).
   2. An UNTICKED checkbox "I am 18 or older". "Send code" does nothing but show
      "Clutch Arena is only for players aged 18 or older." until it is ticked.
   3. Line under the button: "By tapping Send code, you agree to our Terms of Service and confirm
      you have read our Privacy Policy." (both linked).
   4. Firebase signInWithPhoneNumber with an invisible RecaptchaVerifier. Show a 6-digit code
      input (autocomplete="one-time-code"), a resend button with a 30-second countdown, and
      "Change number".
   5. First sign-in: create users/{uid} with ageConfirmedAt, then ask "What should we call you?"
      (display name, 2–32 chars) before showing the app.

B. Browse (route /)
   Header with the logo, greeting "Ready to drop, {name}?", a "Follow our WhatsApp Channel" banner
   (only if whatsappChannelUrl is set), tabs "Upcoming & live" / "Results", and tournament cards.
   Card: map-coloured banner with a dark scrim behind text, mode and status badges, title, map,
   date and time, prize pool, per-kill reward, entry ("Free" or "₹50/player · ₹200/squad"), a slots
   bar "7/12 squads · 5 left", a real countdown, and one action button
   (Register / Registered / Full / Results).

C. Tournament page (route /t/:id)
   Info (start time, status, map, "Squad of 4"), prizes (1st/2nd/3rd from prizeSplit + per kill),
   rules, the list of registered SQUAD NAMES only (never members), "Your squad" card if you are in
   one, the room card (countdown until roomReleaseAt, then room ID and password with Copy buttons),
   and the leaderboard when COMPLETED. Share button (Web Share API, else copy a text invite).

D. Register squad (route /t/:id/register)
   - Squad name; "You (captain)": name prefilled, phone shown as verified (not editable),
     optional Free Fire UID; Teammates 1–3: name, +91 mobile, optional Free Fire UID.
   - Validation: names 2–32 chars, valid Indian mobiles, all 4 numbers different, none equal to
     the captain's, UIDs 6–12 digits if given.
   - If entry fees are enabled, show BEFORE submitting: "Entry fee: ₹50 × 4 players = ₹200.
     No other charges." (the full price, no hidden fees).
   - UNTICKED checkbox: "My teammates are 18 or older and agreed to share their name and mobile
     number with Clutch Arena for this tournament." Plus a link to the Privacy Policy and the note:
     "Only you (the captain) and the organizer can see these numbers. Other players see just your
     squad name."
   - Submit in a Firestore transaction (read the tournament, then write everything from section 5
     in one go). Disable the button while saving so a double tap can't register twice.
   - Friendly errors: full, closed, squad name taken, "Someone in your squad is already registered
     in this tournament" (never say which other squad).

E. Entry fee by UPI (only when config/public.entryFeesEnabled is true)
   After registering, the squad shows "Payment pending: ₹200". Show the UPI ID with a Copy button,
   an "Open UPI app" link (upi://pay?pa={upiId}&pn={upiPayeeName}&am={amount}&cu=INR&tn={squad name}),
   and a field for the 12-digit UPI transaction reference (UTR) → status "submitted". The organizer
   marks it "paid" or "rejected". Unpaid squads can be removed by the organizer.

F. My squads (route /me/squads)
   Squads where I am the captain or a member (a collectionGroup query on "members" where
   phone == my phone; captains also query their own squad docs). Each shows tournament, squad name,
   team number, my role, payment status (captain), and the room card.

G. Profile (route /me)
   Name (editable), verified phone, "Who can see your details" explainer, WhatsApp Channel button,
   "Sign out", and "Delete my account" (see section 9).

H. Organizer area (routes under /admin, visible and allowed only for admins)
   - Dashboard: counts (running, squads registered, finished), "Create tournament", links to
     WhatsApp Channel settings and Players.
   - Create tournament: title, map chips, date chips (next 7 days) + time chips (every 30 min,
     10:00 to 23:30, nothing less than 30 minutes from now), max squads (2..12), prize pool, per-kill
     reward, rules (one per line, with sensible defaults), and a live preview card.
   - Manage tournament: progress steps (Squads in → Room set → Live → Results); room details form
     (room ID, password, release: now / 15 min before / 10 min before / at start); buttons
     "Close registration" and "Go live" (with confirmation); results editor (order squads with up
     and down arrows, kills steppers, checks that placements are 1..N and total kills <= players − 1);
     registrations list with every member's name, number (tap to call or WhatsApp via
     https://wa.me/91XXXXXXXXXX) and UID; payment status controls; "Copy list"; "Remove squad";
     "Cancel tournament". Numbers are hidden behind a "Show numbers" toggle by default.
   - Poster studio (section 8).
   - Settings: WhatsApp Channel link (must match https://whatsapp.com/channel/...), organizer name
     shown on posters, the entry-fee switch with the UPI ID and payee name, and
     "Delete squad members' data for tournaments that ended more than 90 days ago" (purge button).
   - Players: search users by name or number, with call/WhatsApp buttons.
   - Every organizer action writes an auditLog entry.

=====================================================================
7. ROUTES
=====================================================================
/sign-in, /welcome (name), /, /t/:id, /t/:id/register, /me/squads, /me,
/admin, /admin/new, /admin/t/:id, /admin/t/:id/poster, /admin/settings, /admin/players,
/legal/privacy, /legal/terms, /legal/refunds, /legal/cookies, /contact, /credits.
Signed-out users are sent to /sign-in except for /legal/*, /contact and /credits.
Non-admins who open /admin/* see "Organizer only".
A footer on every page links: Privacy · Terms · Refunds · Cookies · Contact · Credits, and shows
"© Clutch Arena".

=====================================================================
8. POSTERS AND WHATSAPP
=====================================================================
- Poster size 2:3 portrait, rendered from a 360×540 px node at pixelRatio 3 → 1080×1620 PNG.
- Templates: "Registration open", "Last spots" (only offered when fewer than 4 spots are left, and
  it prints "ONLY {n} SQUADS LEFT (as of {time})" so it can't become a false claim later), and
  "Results" (podium: 2nd · 1st · 3rd with squad names, prize and kills).
- Themes: Inferno (deep red → orange, gold accent), Neon (navy → electric blue, cyan accent),
  Royal (black → bronze, gold accent).
- Content: organizer name + flame logo, "FREE FIRE · SQUAD" tag, big title, date / time / map
  chips, big prize pool, 1st/2nd/3rd and per-kill boxes, entry / squads / spots-left boxes,
  call-to-action bar "REGISTER YOUR SQUAD IN THE APP", and "Follow our WhatsApp Channel" if set.
  Every number on a poster comes from the database. Never invent counts or claims.
- "Share poster to WhatsApp": build the PNG, then navigator.share({ files: [png], text: caption })
  when navigator.canShare({ files }) is true (the organizer then picks WhatsApp → their Channel).
  Otherwise download the PNG and copy the caption. Always copy the caption to the clipboard and
  show 3-step instructions: Share → WhatsApp → pick your Channel and paste the caption.
- Caption: title, mode and map, date/time, prize pool and per-kill, entry, spots left,
  "Register your squad in the Clutch Arena app", and the channel link.
- Players see a "Follow our WhatsApp Channel" banner linking to whatsappChannelUrl.
  Apps can't post to a WhatsApp Channel automatically; do not pretend otherwise.

=====================================================================
9. PRIVACY, DELETION AND HONEST UI
=====================================================================
- Collect only: phone (login), display name, age confirmation time, squad name, members' names,
  phones and optional Free Fire UIDs, results, and (if fees are on) payment status and UTR.
- Delete my account (Profile): confirm dialog → delete the user's squads in tournaments that have
  not finished (members, payment, index docs, counters), delete member docs of squads they
  captained in finished tournaments (keep only squad name and result), delete users/{uid}, then
  delete the Firebase Auth user (ask them to re-verify by SMS if Firebase requires a recent login).
  Also show "Or email [contact email] to ask us to delete your data", which teammates who never
  signed up can use too.
- Data retention: the admin purge button deletes squad members' data 90 days after a tournament ends.
- No pre-ticked boxes, no fake countdowns or fake scarcity, no made-up user counts, ratings or
  testimonials, no guilt-trip wording. Withdrawing a squad and deleting an account each take at
  most two taps plus one confirmation.
- Never claim "#1", "trusted by thousands", "bank-level security", or anything we can't prove.
  Use accurate wording: "Only you (the captain) and the organizer can see these numbers."
- Disclaimer in the footer and the Terms: "Clutch Arena is independent and not affiliated with
  Garena (Free Fire) or WhatsApp."

=====================================================================
10. DESIGN SYSTEM (dark esports look, accessible)
=====================================================================
Colours (all pairs below pass WCAG AA):
  background #0A0C11, surface #141720, raised surface #1C2030, border #272C3D,
  text #F4F6FB, muted text #9AA2B6, faint text and placeholders #8A93A8,
  primary orange #FF6A1A (links and accents), gold #FFC23D, live green #22D37A,
  info blue #3DA9FF, danger #FF4D5E, WhatsApp green #25D366 (with DARK #0A0C11 icons on it).
  Primary buttons: gradient #FF8A00 → #FF5A3C with DARK text #0A0C11 (not white).
  Map banner gradients: Bermuda #13B5A5→#1B3F8B, Purgatory #9B3CF0→#2A0A4F,
  Kalahari #F7A440→#8A300B, Alpine #6FC8FF→#24427A, NeXTerra #00E0C6→#4C1D95. Always put a
  dark scrim (rgba(0,0,0,0.55) gradient) behind any text on a banner.
Type: Rajdhani 700 for headings, numbers and buttons; Inter for body text (15–16 px, line height 1.5).
Shapes: 12–18 px rounded corners, 1 px borders, cards on surface colour, generous spacing.
Motion: subtle (pressed scale 0.98, a pulsing dot for LIVE). Respect prefers-reduced-motion.
Logo: rounded square with an orange→red gradient and a white flame icon, next to "CLUTCH ARENA"
(with "ARENA" in orange).

=====================================================================
11. ACCESSIBILITY (must pass)
=====================================================================
- Every meaningful image has alt text; decorative icons get aria-hidden="true" (empty alt).
  The poster preview has an alt/aria-label describing it.
- Contrast: 4.5:1 for normal text and 3:1 for large text and UI components (use the palette above).
- Full keyboard use: every control is reachable with Tab in a logical order, has a clearly
  visible focus ring (2 px solid #FFC23D, 2 px offset, via :focus-visible), and there are no
  keyboard traps (dialogs trap focus only while open and return it when closed).
- Real buttons and links (no clickable divs), labels on every input, aria-checked on checkboxes,
  error messages linked with aria-describedby, headings in order, lang="en".
- Tap targets at least 44×44 px.

=====================================================================
12. LEGAL PAGES (each starts with a yellow "DRAFT – not yet reviewed" banner)
=====================================================================
Keep everything in [square brackets] visible and highlighted for me to fill in.
Business details: name "Clutch Arena"; email [your contact email]; address [your business address];
grievance officer [name]; courts in [your city]; UPI ID [your UPI ID];
hosting: Google Firebase (Cloud Firestore, region [your Firestore region]);
SMS: Google Firebase Authentication.
- Privacy Policy (India DPDP Act 2023): who we are; what we collect (section 9 list); teammates'
  data comes from the captain with their permission, and teammates can ask us to see, correct or
  delete it; why (sign-in, running tournaments, fair play, legal duties); who can see what
  (public squad names and results, captain, member, organizer, Firebase as processor, WhatsApp
  only when the user opens it, authorities when the law requires); retention (account until
  deleted; members' data 90 days after the tournament; payment records as tax law requires);
  security; rights (access, correction, erasure, withdraw consent, nominate someone, complain to
  the grievance officer, then the Data Protection Board of India); 18+ only; changes; contact.
- Terms of Service: 18+ and India only; one account per person; captain responsibilities and
  teammates' consent; entry fee ₹50 per player / ₹200 per squad when enabled, paid by UPI within
  [2 hours], with the spot confirmed only on receipt; prizes per tournament, paid by UPI to the
  captain within [7 days], with TDS where tax law requires (PAN may be needed); fair play (no hacks,
  teaming, account sharing, betting; don't share room details); disputes within [24 hours] with
  screenshots, organizer's decision final; not affiliated with Garena/WhatsApp; liability limited to
  the fees paid; Indian law, courts in [your city].
- Refund Policy: full refund if we cancel, if the squad withdraws before registration closes, if
  we remove them through no fault of theirs, or for duplicate payments; no refund for no-shows,
  late joins or disqualification; replay/reschedule or refund if the game itself fails; how to
  ask; refunds by UPI within [7 working days].
- Cookie Policy: Firebase Authentication keeps the sign-in session in the browser's storage
  (IndexedDB/local storage). It is strictly necessary and removed on sign-out. No analytics,
  advertising or tracking cookies, so no consent banner is needed. If that ever changes, we
  will ask first, with "Reject" as easy as "Accept".
- Contact (/contact): business name, address, email, grievance officer.
- Credits (/credits): every font, icon set and library, with its licence and link.

=====================================================================
13. DONE WHEN
=====================================================================
- A visitor can read all legal pages but nothing else until signed in.
- Sign-in is impossible without ticking 18+, and works with a real SMS code.
- Two captains can never get the same team number, a tournament never exceeds maxTeams, a phone
  number can't be in two squads of one tournament, and a captain can't register twice.
- A non-captain member sees teammates' names but only their own number; other players see only
  squad names; only admins see the registrations page. All of this is enforced by firestore.rules
  and covered by the rules tests.
- Room details stay hidden (a countdown shows instead) until roomReleaseAt, and only for
  registered players.
- Posters export at 1080×1620 and share to WhatsApp on Android and iPhone.
- No console errors; Lighthouse accessibility score 95+ on the main pages.

Start by generating the project structure, src/firebase.ts with placeholders, the design system,
the sign-in flow with the 18+ gate, the legal pages, and firestore.rules. Then tell me what's left.
```

---

## Part B: phase prompts (paste one at a time, after Part A)

**Phase 1: foundation and look**
```text
Make sure the design system from section 10 is applied everywhere: Tailwind theme tokens for the
palette, Rajdhani + Inter, the logo, buttons (dark text on the orange gradient), cards, chips,
badges (mode, status with a pulsing LIVE dot), progress bar, inputs with a "+91" prefix, a reusable
Checkbox (unticked by default, aria-checked), the footer with legal links, and a visible
:focus-visible ring. Show me a style-guide page at /dev/style (remove it before launch).
```

**Phase 2: sign-in and profile**
```text
Implement flow A (sign-in with the 18+ checkbox, invisible reCAPTCHA, 6-digit code, resend
timer, name step) and flow G (profile, sign out). Handle Firebase errors with friendly messages
(invalid number, too many requests, wrong code, expired code). Create users/{uid} exactly as
section 4 describes, and keep my placeholders in src/firebase.ts.
```

**Phase 3: tournaments and squad registration**
```text
Implement flows B, C, D and F: the tournament list and cards, tournament page, squad registration
as ONE Firestore transaction (sections 4 and 5), withdraw, My squads, and the room card with its
countdown. Never show members or numbers outside the rules in section 3.
```

**Phase 4: organizer area**
```text
Implement section H: dashboard, create tournament with live preview, manage tournament (room
details, close registration, go live, results editor with validation, registrations list with
the "Show numbers" toggle, call/WhatsApp links, copy list, remove squad, cancel), players search,
settings (WhatsApp Channel link, organizer name, entry-fee switch with UPI details, 90-day purge),
and auditLog writes for every organizer action.
```

**Phase 5: posters and WhatsApp**
```text
Implement section 8: the poster studio with 3 templates × 3 themes at 2:3, 1080×1620 PNG export,
Web Share API sharing with a download fallback, the auto-copied caption, the 3-step channel
instructions, and the players' "Follow our WhatsApp Channel" banner.
```

**Phase 6: entry fees (keep the switch OFF until a lawyer approves)**
```text
Implement flow E behind config/public.entryFeesEnabled: show the full price before submitting,
the payment-pending state, copyable UPI ID, the upi:// link, UTR entry, and the organizer's
paid/rejected controls. When the switch is off, everything says "Free entry" and no payment UI shows.
```

**Phase 7: privacy, deletion and legal pages**
```text
Implement section 9 (Delete my account, the email deletion route, the 90-day purge) and section 12
(Privacy, Terms, Refunds, Cookies, Contact, Credits) with DRAFT banners and highlighted [blanks].
Then list every piece of personal data the app stores and where, so I can check it against the
privacy policy.
```

**Phase 8: security rules, tests and polish**
```text
Review firestore.rules against section 5 line by line and fix any gap. Write the
@firebase/rules-unit-testing tests (including: double registration, overfilling, duplicate phone,
reading someone else's members, early room access, non-admin writes). Then do an accessibility
pass for section 11 (alt text, contrast, keyboard-only walk-through of every page) and fix what
you find. Finish with a list of anything still not done.
```

---

## Part C: Firebase setup (you do this)

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com) and
   choose a Firestore location in India (for example `asia-south1`, Mumbai).
2. **Authentication** → Sign-in method → enable **Phone**. Add your AI Studio preview domain and
   your final website domain under **Authorized domains**. Real SMS codes are billed by Firebase
   and need a billing-enabled (Blaze) project; check current pricing. Add test phone numbers for
   development.
3. **Firestore Database** → create it, then **Rules** → paste the generated `firestore.rules` → Publish.
4. Create the document `config/admins` with a field `phones` (array) containing your number, for
   example `+919876543210`. Create `config/public` with `organizerName: "Clutch Arena"`,
   `entryFeesEnabled: false`, `entryFeePerPlayer: 50`.
5. **Project settings** → Your apps → add a **Web app** → copy `apiKey`, `authDomain`,
   `projectId` and `appId` into `src/firebase.ts`. These values are public identifiers, not
   passwords; your security comes from the rules.
6. Run the rules tests with the Firebase Emulator (`npm i -g firebase-tools`, then
   `firebase emulators:exec "npm test"`) before inviting players.

---

## Part D: alternative, a web front end for the existing backend

Already running the Node/PostgreSQL backend in this repository (`backend/`)? Then you don't need
Firebase. Paste this instead of Part A:

```text
Build "Clutch Arena", a mobile-first React + TypeScript + Tailwind web app that is ONLY a front end
for my existing REST API at {API_BASE_URL}/api/v1 (no Firebase, no other backend, no analytics,
no AI calls). Use the design system, accessibility rules, posters, legal pages and honest-UI rules
described below [paste sections 8–12 of Part A here].
Endpoints:
POST /auth/otp/request {phone, confirmedAdult:true} · POST /auth/otp/verify {phone, code,
confirmedAdult:true} → {accessToken, user} · GET/PATCH /users/me · GET /settings ·
GET /tournaments (?status=COMPLETED) · GET /tournaments/:id · GET /tournaments/:id/leaderboard ·
GET /tournaments/me/registrations · POST /tournaments/:id/squads {squadName, captain:{name,
freeFireUid?}, teammates:[{name, phone, freeFireUid?}], consent:true} with an Idempotency-Key header ·
GET/DELETE /tournaments/:id/my-squad · GET /tournaments/:id/room-credentials (403 with
details.secondsRemaining while locked) · admin: POST /tournaments, GET /tournaments/:id/registrations,
DELETE /tournaments/:id/squads/:squadId {reason}, PUT /tournaments/:id/room, PATCH
/tournaments/:id/status, POST /tournaments/:id/results (Idempotency-Key), POST
/tournaments/:id/cancel, GET /users, PUT /settings.
Send "Authorization: Bearer <token>"; keep the token in memory plus sessionStorage only.
Errors come as {error:{code, message, details}}; show the message.
```

Add your website's address to the backend's `CORS_ORIGINS`.

---

## Part E: before launch

- [ ] A lawyer has confirmed whether you may charge the ₹50/₹200 entry fee under the Online Gaming
      Act 2025. Until then, keep `entryFeesEnabled` off.
- [ ] Every [bracket] in the legal pages is filled in, then the DRAFT banners are removed.
- [ ] `config/admins` contains only your number(s).
- [ ] The rules tests pass in the emulator, and you tried the app with two phones: a captain and a
      teammate (check the teammate can't see other numbers).
- [ ] You know how you'll pay prizes and deduct TDS where required.
- [ ] Privacy-policy URL (`/legal/privacy`) added to your WhatsApp Channel description and to any
      app-store listing.
