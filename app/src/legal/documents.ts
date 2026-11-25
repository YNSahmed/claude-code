import {
  BUSINESS as B,
  ENTRY_FEE_PER_PLAYER as FEE,
  MINIMUM_AGE as AGE,
} from '@/constants/business';

/**
 * Legal pages, written in plain language. These are DRAFTS for the owner of Clutch Arena to
 * review (ideally with a lawyer) before launch. Text in [square brackets] is either a blank to
 * fill in or a suggested default to confirm, such as "[7] days".
 */

export type LegalDocId = 'privacy' | 'terms' | 'refunds' | 'cookies';

export type LegalBlock = string | { bullets: string[] };

export interface LegalSection {
  heading: string;
  body: LegalBlock[];
}

export interface LegalDoc {
  id: LegalDocId;
  title: string;
  linkLabel: string;
  intro: string;
  sections: LegalSection[];
}

const contact = `Email ${B.contactEmail}, or write to ${B.name}, ${B.address}.`;

const privacy: LegalDoc = {
  id: 'privacy',
  title: 'Privacy Policy',
  linkLabel: 'Privacy',
  intro: `This policy explains what personal data ${B.name} collects when you use the app, why, who we share it with, how long we keep it, and your rights under India's Digital Personal Data Protection Act, 2023.`,
  sections: [
    {
      heading: 'Who we are',
      body: [
        `${B.name} ("we", "us") runs Free Fire squad tournaments through this app. We decide how your personal data is used. ${contact}`,
      ],
    },
    {
      heading: 'What we collect',
      body: [
        {
          bullets: [
            'Your mobile number, to sign you in with a one-time code and to contact you about tournaments you join.',
            'Your display name, shown to you and, if you are in a squad, to your squad.',
            'Squad registrations: the squad name, and for each member their name, mobile number and (optionally) Free Fire UID.',
            "Results: your squad's placement and kills.",
            'Login codes. We store only a scrambled version (a hash), never the code itself, and delete it after [1 day].',
            'Your IP address, briefly, to stop abuse such as someone requesting many login codes.',
            'Entry fee payments you make by UPI: the payer name, UPI ID and transaction reference your UPI app shows us. Payments happen in your UPI app, not in ours.',
            'Prize payments: the UPI ID we pay prizes to and, where tax law requires it, your PAN.',
          ],
        },
        'We do not use advertising, analytics or tracking tools, and we do not sell your data.',
      ],
    },
    {
      heading: 'Data about your teammates',
      body: [
        "When a captain registers a squad, they give us their teammates' names and mobile numbers. The captain must have each teammate's permission, and each teammate must be at least 18. A teammate can ask us to see, correct or delete their data at any time, even if they never use the app.",
      ],
    },
    {
      heading: 'Why we use it',
      body: [
        {
          bullets: [
            'To sign you in and keep your account secure.',
            'To run tournaments: register squads, confirm entry fees, share room details with registered squads, publish results and pay prizes.',
            'To prevent cheating, fraud and abuse, and to enforce our Terms.',
            'To meet legal duties, such as tax rules on prizes.',
          ],
        },
        'We use your data because you agree to it when you sign up and register a squad, and where the law requires or allows us to.',
      ],
    },
    {
      heading: 'Who can see your data',
      body: [
        {
          bullets: [
            'Everyone using the app: squad names, tournament results and prize amounts.',
            'Your squad: your name. Your captain also sees the mobile numbers they entered. Teammates see only their own number.',
            `Us (the organizer): everything above, to run tournaments.`,
            `Service providers who process data for us: ${B.hostingProvider} (where the app's data is stored) and ${B.smsProvider} (which sends login codes and receives your mobile number to do so).`,
            "WhatsApp, only when you choose to open WhatsApp from the app (for example to follow our channel or message us). WhatsApp's own privacy policy applies there.",
            'Authorities, when the law requires it.',
          ],
        },
      ],
    },
    {
      heading: 'How long we keep it',
      body: [
        {
          bullets: [
            'Your account: until you delete it.',
            "Squad members' names and numbers: until [90 days] after the tournament ends, then deleted. Squad names and results stay as part of the public results.",
            'Login codes and the IP addresses linked to them: [1 day].',
            'Payment and prize records: as long as tax and accounting law requires.',
            'A record of organizer actions (such as results posted or players banned): kept for security and disputes.',
          ],
        },
      ],
    },
    {
      heading: 'How we protect it',
      body: [
        "Teammates' mobile numbers are encrypted in our database, login codes are stored only as hashes, and only the organizer can see everyone's details. On your phone, your login is kept in the device's secure storage. No system is perfectly secure; if a breach affects you, we will tell you and the authorities as the law requires.",
      ],
    },
    {
      heading: 'Your rights',
      body: [
        'You can ask us to:',
        {
          bullets: [
            'Tell you what personal data we hold about you and who we shared it with.',
            'Correct or update it.',
            'Delete it. You can also delete your account in the app under Profile.',
            'Stop using it, by withdrawing your consent (this ends your account).',
            'Name someone to exercise these rights for you if you die or cannot do so.',
          ],
        },
        `To use any of these rights, or to complain, contact our grievance officer, ${B.grievanceOfficer}, at ${B.contactEmail}. We will reply within [30 days]. If you are not satisfied, you can complain to the Data Protection Board of India.`,
      ],
    },
    {
      heading: 'Age limit',
      body: [
        `The app is only for people aged ${AGE} or older. If we learn we have data about someone under ${AGE}, we will delete it.`,
      ],
    },
    {
      heading: 'Changes',
      body: [
        'If we change this policy, we will update it here and tell you in the app before the changes apply to you.',
      ],
    },
  ],
};

const terms: LegalDoc = {
  id: 'terms',
  title: 'Terms of Service',
  linkLabel: 'Terms',
  intro: `These terms are an agreement between you and ${B.name}. By signing in or registering a squad you agree to them. If you do not agree, please do not use the app.`,
  sections: [
    {
      heading: 'Who can play',
      body: [
        {
          bullets: [
            `You must be ${AGE} or older and live in ${B.country}.`,
            'One account per person, using your own mobile number.',
            'Everyone in your squad must also be 18 or older and agree to these terms.',
          ],
        },
      ],
    },
    {
      heading: 'Your account',
      body: [
        'You sign in with a one-time code sent to your phone. Never share it. You are responsible for what happens on your account. Tell us at once if you think someone else has used it.',
      ],
    },
    {
      heading: 'Registering a squad',
      body: [
        {
          bullets: [
            'The captain registers the squad and is responsible for it.',
            "The captain must have every teammate's permission to share their name and number with us.",
            "Details must be true and match the players' game accounts.",
            'A person can be in only one squad per tournament.',
            "Squad names must not be offensive, misleading or copy someone else's.",
          ],
        },
      ],
    },
    {
      heading: 'Entry fees',
      body: [
        `Unless a tournament says otherwise, the entry fee is ₹${FEE} per player, which is ₹${FEE * 4} for a squad of four. The fee shown on the tournament is the full amount; there are no extra charges from us.`,
        `Pay by UPI to ${B.upiId} [within 2 hours of registering], quoting your squad name. Your spot is confirmed only when we receive the full fee. If it does not arrive in time, we may remove your squad and give the spot to someone else.`,
        'Refunds are covered in our Refund Policy.',
      ],
    },
    {
      heading: 'Prizes',
      body: [
        'Each tournament shows its prize pool, how it is split between places, and any reward per kill.',
        'We pay prizes by UPI to the captain [within 7 days] after results are posted, unless we are checking a dispute or suspected cheating. The captain shares the prize with their squad.',
        'Prizes may be subject to tax deducted at source (TDS) under Indian tax law. We may ask for your PAN and identity details before paying. Without them we may be unable to pay.',
        'Players who break these terms lose any prize.',
      ],
    },
    {
      heading: 'Fair play',
      body: [
        {
          bullets: [
            'No hacks, cheats, scripts, glitches or modified game clients.',
            "No teaming with other squads, account sharing or playing on someone else's account.",
            'No betting or wagering on matches, with us or with other players.',
            'Do not share room IDs or passwords with anyone outside your squad.',
            'Be respectful to other players and to us.',
          ],
        },
        'We may disqualify a squad, withhold prizes, or suspend or ban accounts that break these rules.',
      ],
    },
    {
      heading: 'Results and disputes',
      body: [
        'Results are based on the in-game result screen. If you think a result is wrong, contact us [within 24 hours] with screenshots. We will review it and our decision is final.',
      ],
    },
    {
      heading: 'Free Fire and WhatsApp',
      body: [
        `${B.name} is independent. We are not affiliated with, endorsed by or sponsored by Garena (the maker of Free Fire) or WhatsApp. "Free Fire" and map names belong to Garena. You must also follow Garena's own terms when you play.`,
        'Game outages, updates or bans by Garena are outside our control. If a match cannot be played, we may reschedule or cancel it under our Refund Policy.',
      ],
    },
    {
      heading: 'Changes, suspension and ending',
      body: [
        'We may change tournaments, these terms or the app. We will tell you about important changes in the app before they apply. We may suspend or close accounts that break these terms. You can stop using the app and delete your account at any time.',
      ],
    },
    {
      heading: 'Our responsibility',
      body: [
        'We run the app with care, but it is provided "as is" and may sometimes be unavailable. To the extent the law allows, our total responsibility to you for any claim is limited to the entry fees you paid us for the tournament concerned. Nothing in these terms limits rights you have under Indian consumer law.',
      ],
    },
    {
      heading: 'Law and disputes',
      body: [
        `These terms are governed by the laws of India. Courts in ${B.courtsCity} will handle any dispute. Please contact us first so we can try to sort it out. ${contact}`,
      ],
    },
  ],
};

const refunds: LegalDoc = {
  id: 'refunds',
  title: 'Refund Policy',
  linkLabel: 'Refunds',
  intro: `This explains when ${B.name} refunds entry fees (₹${FEE} per player, ₹${FEE * 4} per squad of four, paid by UPI).`,
  sections: [
    {
      heading: 'Full refund',
      body: [
        {
          bullets: [
            'We cancel the tournament.',
            'Your squad withdraws before registration closes.',
            'We remove your squad for a reason that is not your fault, such as the tournament being full.',
            'You paid twice or paid too much (we refund the extra).',
          ],
        },
      ],
    },
    {
      heading: 'No refund',
      body: [
        {
          bullets: [
            'After registration closes, if your squad does not play or joins late.',
            'If your squad is disqualified for breaking the rules or the Terms of Service.',
            "If a player's own device, internet connection or game account causes a problem.",
          ],
        },
      ],
    },
    {
      heading: 'Match problems',
      body: [
        'If a match cannot be completed because of a problem with the game itself, we will replay or reschedule it. If we cannot, we will give a full refund.',
      ],
    },
    {
      heading: 'How to ask for a refund',
      body: [
        `Email ${B.contactEmail} with your squad name, the tournament and your UPI transaction reference.`,
        'We send refunds by UPI to the account that paid, [within 7 working days] of approving them.',
      ],
    },
  ],
};

const cookies: LegalDoc = {
  id: 'cookies',
  title: 'Cookie Policy',
  linkLabel: 'Cookies',
  intro: `This explains the cookies and similar storage ${B.name} uses. In short: we use no cookies and no trackers, and store only what keeps you signed in.`,
  sections: [
    {
      heading: 'What we store',
      body: [
        {
          bullets: [
            "Phone app: your sign-in token, in your phone's secure storage (iOS Keychain or Android Keystore). It is needed to keep you signed in and is removed when you sign out.",
            'Web version: the same sign-in token in your browser\'s local storage under the name "clutch-arena.session". It is strictly necessary and is removed when you sign out.',
          ],
        },
        'Because this storage is strictly necessary for the service you asked for, it does not need a consent banner.',
      ],
    },
    {
      heading: 'What we do not use',
      body: [
        'Our app and server set no cookies, and we use no analytics, advertising, social media pixels or other third-party trackers. Fonts and icons are built into the app, so opening it does not contact font or icon services.',
        'If we ever add analytics or marketing tools, we will update this page and ask for your consent first, and you will be able to say no as easily as yes.',
      ],
    },
    {
      heading: 'Links that leave the app',
      body: [
        "If you choose to open WhatsApp (for example to follow our channel), WhatsApp's own cookie and privacy policies apply there.",
      ],
    },
    {
      heading: 'Questions',
      body: [contact],
    },
  ],
};

export const LEGAL_DOCS: Record<LegalDocId, LegalDoc> = { privacy, terms, refunds, cookies };
export const LEGAL_DOC_ORDER: LegalDocId[] = ['privacy', 'terms', 'refunds', 'cookies'];

export function isLegalDocId(value: string | undefined): value is LegalDocId {
  return value !== undefined && value in LEGAL_DOCS;
}
