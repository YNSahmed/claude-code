/**
 * Business details used by the legal pages and the contact screen.
 *
 * Anything in [square brackets] is a blank you still need to fill in. The legal pages show
 * those blanks highlighted, so they are easy to spot while the pages are drafts.
 */
export const BUSINESS = {
  name: 'Clutch Arena',
  country: 'India',
  contactEmail: '[your contact email]',
  address: '[your business address]',
  /** The person who answers privacy questions and complaints (required by India's DPDP Act). */
  grievanceOfficer: '[name of the person who handles complaints]',
  /** City whose courts handle disputes, for the terms. */
  courtsCity: '[your city]',
  /** Where players send entry fees. */
  upiId: '[your UPI ID]',
  hostingProvider: '[hosting provider and region, e.g. a cloud server in Mumbai]',
  smsProvider: '[SMS provider: MSG91 or Twilio]',
} as const;

/** Entry fee: ₹50 per player, so ₹200 for a squad of four. Collected by UPI outside the app. */
export const ENTRY_FEE_PER_PLAYER = 50;

export const MINIMUM_AGE = 18;

/** Shown on every legal page until you have reviewed and published them. */
export const LEGAL_PAGES_ARE_DRAFTS = true;
