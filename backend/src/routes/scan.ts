import { Hono } from 'hono';
import { z } from 'zod';
import { aiService } from '../services/ai.js';
import { requireAuth, requireRoles } from '../lib/middleware.js';
import { Errors } from '../lib/errors.js';

const scanRoutes = new Hono();

scanRoutes.use('*', requireAuth);

const scanInputSchema = z.object({
  imageBase64: z.string().min(10, 'Image data is required'),
  mimeType: z.enum(['image/jpeg', 'image/png']).default('image/jpeg'),
});

/**
 * POST /scan/prescription
 * Extract prescription details from a photo (Elder & Caretaker)
 * Extraction only. Nothing is saved until confirmed by user.
 */
scanRoutes.post('/prescription', requireRoles(['ELDER', 'CARETAKER']), async (c) => {
  const body = await c.req.json();
  const parsed = scanInputSchema.safeParse(body);
  if (!parsed.success) {
    throw Errors.badRequest(parsed.error.errors.map((e) => e.message).join(', '));
  }

  const result = await aiService.extractPrescription(parsed.data.imageBase64, parsed.data.mimeType);

  return c.json({
    extracted: result,
    disclaimer: 'Check against the label. AI can make mistakes.',
  });
});

export { scanRoutes };
