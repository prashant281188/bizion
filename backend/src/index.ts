import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import { env } from './config/env.js';
import { db, closeDatabase } from './config/database.js';
import { corsOptions } from './config/cors.js';
import cors from 'cors';
import { generalLimiter } from './middleware/rate-limit.middleware.js';
import { errorHandler } from './middleware/error.middleware.js';
import { sendSuccess, sendError } from './utils/api-response.js';
import { sql } from 'drizzle-orm';
import authRoutes from './modules/auth/auth.routes.js';
import orgRoutes from './modules/organizations/org.routes.js';
import userRoutes from './modules/users/user.routes.js';
import mastersRoutes from './modules/masters/masters.routes.js';
import productRoutes from './modules/products/product.routes.js';
import contactRoutes from './modules/contacts/contact.routes.js';
import reportsRoutes from './modules/reports/reports.routes.js';
import invoiceRoutes from './modules/invoices/invoice.routes.js';
import creditNoteRoutes from './modules/invoices/credit-note.routes.js';
import paymentRoutes from './modules/payments/payment.routes.js';
import mediaRoutes from './modules/media/media.routes.js';
import inventoryRoutes from './modules/inventory/inventory.routes.js';
import ordersRoutes from './modules/orders/orders.routes.js';
import dispatchesRoutes from './modules/dispatches/dispatches.routes.js';
import goodsReceiptsRoutes from './modules/goods-receipts/goods-receipts.routes.js';
import searchRoutes from './modules/search/search.routes.js';
import transportersRoutes from './modules/transporters/transporters.routes.js';
import pricingRoutes from './modules/pricing/pricing.routes.js';
import portalRoutes from './modules/portal/portal.routes.js';
import tourPlansRoutes from './modules/tour-plans/tour-plans.routes.js';
import path from 'path';

const app = express();
const server = createServer(app);

// ─── Security & Core Middlewares ─────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'blob:', 'http://localhost:*', 'https://*.amazonaws.com'],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", 'https:', "'unsafe-inline'"],
      fontSrc: ["'self'", 'https:', 'data:'],
      connectSrc: ["'self'", 'http://localhost:*'],
    },
  },
}));
app.use(cors(corsOptions));
app.use(compression());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
if (env.NODE_ENV !== 'test') {
  const logFormat = env.NODE_ENV === 'production' ? 'combined' : 'dev';
  app.use(morgan(logFormat));
}

// Global rate limiting
app.use(generalLimiter);

// ─── Health Check Route ──────────────────────────────────────────────────────
app.get('/api/v1/health', async (_req, res) => {
  try {
    // Perform a quick database query to verify connection
    await db.execute(sql`SELECT 1`);
    
    sendSuccess(res, {
      status: 'UP',
      database: 'CONNECTED',
      timestamp: new Date().toISOString(),
    }, 'System is healthy');
  } catch (error: any) {
    console.error('Health check failed:', error);
    sendError(
      res,
      'System is unhealthy',
      500,
      {
        status: ['DOWN'],
        database: ['DISCONNECTED'],
        ...(error.message ? { error: [error.message] } : {}),
      }
    );
  }
});

// ─── API Routes ──────────────────────────────────────────────────────────────
// Globally disable browser caching for all API routes (except explicit public ones)
// This ensures React Query on the frontend has full control over caching and mutations instantly reflect.
app.use('/api/v1', (req, res, next) => {
  // Allow products/public to handle its own caching
  if (!req.path.startsWith('/products/public/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
  }
  next();
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/organizations', orgRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/masters', mastersRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/contacts', contactRoutes);
app.use('/api/v1/reports', reportsRoutes);
app.use('/api/v1/invoices', invoiceRoutes);
app.use('/api/v1/credit-notes', creditNoteRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/media', mediaRoutes);
app.use('/api/v1/inventory', inventoryRoutes);
app.use('/api/v1/orders', ordersRoutes);
app.use('/api/v1/dispatches', dispatchesRoutes);
app.use('/api/v1/goods-receipts', goodsReceiptsRoutes);
app.use('/api/v1/search', searchRoutes);
app.use('/api/v1/pricing', pricingRoutes);
app.use('/api/v1/portal', portalRoutes);
app.use('/api/v1/transporters', transportersRoutes);
app.use('/api/v1/tour-plans', tourPlansRoutes);

// Static uploads folder serving for local development fallback
app.use('/uploads', express.static(path.join(process.cwd(), 'public/uploads')));

// ─── 404 Route handler ────────────────────────────────────────────────────────
app.use((_req, res) => {
  sendError(res, `Route ${_req.originalUrl} not found`, 404);
});

// ─── Global Error Handler ────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Start Server ────────────────────────────────────────────────────────────
const port = Number(env.PORT);
const appServer = server.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Bizion API running on port ${port} in ${env.NODE_ENV} mode, listening on all interfaces (0.0.0.0)`);
});

// ─── Graceful Shutdown ────────────────────────────────────────────────────────
const shutdown = async () => {
  console.log('Stopping server and cleaning up...');
  
  appServer.close(async (err) => {
    if (err) {
      console.error('Error closing the server:', err);
      process.exit(1);
    }
    
    try {
      await closeDatabase();
      console.log('Database connections closed.');
      process.exit(0);
    } catch (dbErr) {
      console.error('Error closing database connection:', dbErr);
      process.exit(1);
    }
  });

  // Force close after 10 seconds
  setTimeout(() => {
    console.error('Forcefully shutting down...');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export { app, server };
