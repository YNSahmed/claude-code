import { env } from '../../config/env.js';
import { AppError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

/**
 * Sends login codes by SMS.
 *
 * - console: development only (refused in production). Writes the code to the server log.
 * - msg91:   MSG91 Flow API with a DLT-approved template that has an OTP variable
 *            (MSG91_OTP_VARIABLE, default "otp").
 * - twilio:  Twilio Programmable SMS.
 *
 * Indian SMS needs a DLT-registered sender and template whichever provider you use.
 */
export interface SmsSender {
  sendOtp(phone: string, code: string): Promise<void>;
}

const ttlMinutes = Math.round(env.OTP_TTL_SECONDS / 60);

const consoleSender: SmsSender = {
  async sendOtp(phone, code) {
    logger.warn('DEV ONLY: login code (SMS_PROVIDER=console)', { phone, code });
  },
};

const msg91Sender: SmsSender = {
  async sendOtp(phone, code) {
    const response = await fetch('https://control.msg91.com/api/v5/flow', {
      method: 'POST',
      headers: { authkey: env.MSG91_AUTH_KEY ?? '', 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        template_id: env.MSG91_TEMPLATE_ID,
        short_url: '0',
        recipients: [{ mobiles: phone.replace('+', ''), [env.MSG91_OTP_VARIABLE]: code }],
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await response.json().catch(() => null)) as { type?: string } | null;
    if (!response.ok || body?.type === 'error') {
      throw new Error(`MSG91 responded ${response.status} ${body?.type ?? ''}`);
    }
  },
};

const twilioSender: SmsSender = {
  async sendOtp(phone, code) {
    const from = env.TWILIO_FROM ?? '';
    const form = new URLSearchParams({
      To: phone,
      Body: `${code} is your login code. It expires in ${ttlMinutes} minutes. Never share it with anyone.`,
      ...(from.startsWith('MG') ? { MessagingServiceSid: from } : { From: from }),
    });
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64')}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: form,
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`Twilio responded ${response.status}`);
  },
};

const senders = { console: consoleSender, msg91: msg91Sender, twilio: twilioSender };

export async function sendOtpSms(phone: string, code: string): Promise<void> {
  try {
    await senders[env.SMS_PROVIDER].sendOtp(phone, code);
  } catch (error) {
    logger.error('Sending the login code failed', {
      provider: env.SMS_PROVIDER,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new AppError(502, 'SMS_FAILED', 'We could not send the code. Try again in a minute.');
  }
}
