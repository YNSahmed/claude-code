import { Router } from 'express';
import { z } from 'zod';

import { pool, withTransaction } from '../../config/db.js';
import { currentUser, requireAuth, requireRole } from '../../middlewares/auth.js';
import { recordAdminAction } from '../../utils/audit.js';
import { parseInput } from '../../utils/errors.js';

/** Organizer settings shown to every player, managed by the admin. */

const updateSettingsSchema = z.strictObject({
  /** Official channel invite link, e.g. https://whatsapp.com/channel/0029Va... — null removes it. */
  whatsappChannelUrl: z
    .string()
    .trim()
    .regex(/^https:\/\/(www\.)?whatsapp\.com\/channel\/[A-Za-z0-9]{10,64}\/?$/, 'Paste your WhatsApp Channel link (https://whatsapp.com/channel/...).')
    .nullable()
    .optional(),
  organizerName: z.string().trim().min(2).max(40).nullable().optional(),
});

const KEYS = { whatsappChannelUrl: 'whatsapp_channel_url', organizerName: 'organizer_name' } as const;

async function readSettings() {
  const { rows } = await pool.query<{ key: string; value: string }>('SELECT key, value FROM app_settings');
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    whatsappChannelUrl: map.get(KEYS.whatsappChannelUrl) ?? null,
    organizerName: map.get(KEYS.organizerName) ?? null,
  };
}

export const settingsRouter = Router();

settingsRouter.get('/', async (_req, res) => {
  res.json({ settings: await readSettings() });
});

settingsRouter.put('/', requireAuth, requireRole('admin'), async (req, res) => {
  const input = parseInput(updateSettingsSchema, req.body);
  const adminId = currentUser(req).id;
  await withTransaction(async (client) => {
    for (const [field, key] of Object.entries(KEYS) as [keyof typeof KEYS, string][]) {
      const value = input[field];
      if (value === undefined) continue;
      if (value === null) await client.query('DELETE FROM app_settings WHERE key = $1', [key]);
      else {
        await client.query(
          `INSERT INTO app_settings (key, value, updated_by) VALUES ($1, $2, $3)
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`,
          [key, value, adminId]
        );
      }
    }
    await recordAdminAction(client, { adminId, action: 'SETTINGS_UPDATED', targetType: 'settings', targetId: 'app', details: input });
  });
  res.json({ settings: await readSettings() });
});
