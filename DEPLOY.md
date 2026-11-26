# Put Clutch Arena online

You'll end up with:

- **A website link** (for example `https://clutch-arena-xxxx.onrender.com`) that anyone can open on
  their phone. It's the full app, including your Organizer area.
- **An Android app (APK)** your players can install.

Everything is already set up in this repository. You only create two free accounts and press a few
buttons.

| What | Cost |
| --- | --- |
| Render (server, database, website) | Free to start. The free server sleeps after 15 idle minutes (the next visit takes about a minute), and **the free database is deleted after 30 days**. Before real players join, upgrade the server to Starter and the database to a paid plan (roughly US$13–14/month together; check render.com/pricing). |
| Expo (builds the Android app) | Free plan, with a limited number of builds per month. |

---

## Part 1: server and website (Render), about 10 minutes

You can do this on a phone or a computer.

1. Go to **render.com** → **Get Started** → **Sign up with GitHub**. Use the GitHub account that owns
   `YNSahmed/claude-code`.
2. In the dashboard, tap **New** → **Blueprint**.
3. Connect the repository **YNSahmed/claude-code**. If Render asks to install its GitHub app,
   allow it for this repository.
4. Choose the branch **`claude/app-repository-setup-alsmlr`**. Render reads `render.yaml` and
   shows two things to create: **clutch-arena** (the server and website) and **clutch-arena-db** (the
   database).
5. It asks for **ADMIN_PHONES**. Type your mobile number in this exact format: `+919876543210`.
   This makes you the organizer.
6. Tap **Apply** (or **Deploy Blueprint**) and wait until **clutch-arena** shows **Live**. The first
   build takes about 5–10 minutes.
7. Open **clutch-arena** and copy the link at the top. **That's your app's website.** Open it, sign in
   with your number, and you'll see the **Organizer** tab.

### Signing in while it's in test mode

No SMS company is connected yet, so login codes aren't texted. To find a code:
**Render → clutch-arena → Logs**, then look for `DEV ONLY: login code` next to the phone number.
Only you can see the logs, so for now you read the code out to anyone testing with you. Part 3
explains how to switch on real SMS.

---

## Part 2: Android app (APK), about 20 minutes

### Option A: with a computer (Node.js installed)

1. Make a free account at **expo.dev**.
2. In a terminal, inside your copy of this repository:
   ```bash
   cd app
   npx eas-cli@latest login
   npx eas-cli@latest init
   ```
   Answer **Yes** to create the project.
3. On **expo.dev**, open the **clutch-arena** project → **Environment variables** → **Add**:
   - Name: `EXPO_PUBLIC_API_URL`
   - Value: your Render link from Part 1, for example `https://clutch-arena-xxxx.onrender.com`
   - Environments: **Preview** and **Production**
   - Visibility: Plain text
4. Back in the terminal:
   ```bash
   npx eas-cli@latest build --platform android --profile preview
   ```
   Answer **Yes** when it offers to create an Android keystore. After about 15 minutes you get a
   **download link and QR code for the APK**.

### Option B: phone only

Send Claude your Render link. It will put the link into the app's settings so you can build from
the expo.dev website with GitHub, and will tell you the exact buttons to press.

### Installing the APK

Send players the download link. On Android: open the link → **Download** → allow
**Install unknown apps** when asked → **Install**.
(For the Google Play Store later, build with `--profile production` and use a Google Play Console
account; Google charges a one-time US$25 fee.)

---

## Part 3: before real players join

- [ ] **Upgrade** the Render database (or it is deleted after 30 days) and the server (so it doesn't
      sleep).
- [ ] **Real SMS codes:** create an **MSG91** account and get a DLT-approved sender ID and OTP
      template. Then in **Render → clutch-arena → Environment** set:
      `NODE_ENV` = `production`, `SMS_PROVIDER` = `msg91`, `MSG91_AUTH_KEY`, `MSG91_TEMPLATE_ID`
      (and `MSG91_OTP_VARIABLE` if your template's variable isn't called `otp`). Save; Render restarts it.
- [ ] Fill in the **[blanks]** in the legal pages (`app/src/constants/business.ts`) and have them
      reviewed.
- [ ] Get a lawyer's view on the **₹50/₹200 entry fee** under the Online Gaming Act 2025.
- [ ] Add your **WhatsApp Channel** link in the app: Organizer → WhatsApp Channel.
- [ ] **Never change or delete `PII_ENCRYPTION_KEY`** in Render. Without it, the saved phone numbers
      can't be read.

## If something goes wrong

| Problem | Fix |
| --- | --- |
| Render build fails with "out of memory" or "Killed" | The website build needs about 1 GB of memory. Tell Claude; there's a lighter fallback. |
| Server log says "Invalid environment configuration" | Usually `ADMIN_PHONES` isn't in the `+91XXXXXXXXXX` format. Fix it under Environment. |
| App or website says it can't reach the server | The free server is waking up. Wait a minute and try again. |
| APK opens but can't sign in | `EXPO_PUBLIC_API_URL` on expo.dev is missing or wrong. Fix it and build again. |
