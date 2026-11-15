import { Hono } from 'hono';
import { handle } from 'hono/aws-lambda';
import { cors } from 'hono/cors';
import { AppError } from '../lib/errors.js';
import { nowISO } from '../lib/time.js';
import { authRoutes } from '../routes/auth.js';
import { circleRoutes } from '../routes/circle.js';
import { medsRoutes } from '../routes/meds.js';
import { dosesRoutes } from '../routes/doses.js';
import { appointmentsRoutes } from '../routes/appointments.js';
import { suggestionsRoutes } from '../routes/suggestions.js';
import { adherenceRoutes } from '../routes/adherence.js';
import { scanRoutes } from '../routes/scan.js';
import { publicRoutes } from '../routes/public.js';
import { demoRoutes } from '../routes/demo.js';

const app = new Hono();

app.use('*', cors());

// Global error handler: always returns { error: { code, message } }
app.onError((err, c) => {
  console.error('Unhandled request error:', err);

  if (err instanceof AppError) {
    return c.json(
      {
        error: {
          code: err.code,
          message: err.message,
        },
      },
      err.statusCode as any
    );
  }

  return c.json(
    {
      error: {
        code: 'INTERNAL_ERROR',
        message: err.message || 'An unexpected error occurred',
      },
    },
    500
  );
});

// Health check endpoint
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: nowISO(),
    version: '1.0.0',
    service: 'carecircle-api',
  });
});

// Root endpoint
app.get('/', (c) => {
  return c.json({
    message: 'Welcome to CareCircle API',
    status: 'healthy',
  });
});

// Mount modular sub-routers
app.route('/p', publicRoutes); // Public one-tap confirmation routes
app.route('/auth', authRoutes);
app.route('/meds', medsRoutes);
app.route('/doses', dosesRoutes);
app.route('/appointments', appointmentsRoutes);
app.route('/suggestions', suggestionsRoutes);
app.route('/adherence', adherenceRoutes);
app.route('/scan', scanRoutes);
app.route('/demo', demoRoutes);
app.route('/', circleRoutes);

export const handler = handle(app);
export { app };
