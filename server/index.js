const { BRAND_NAME } = require('./config/brand');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config();

// Strict production security pre-flight check
if (process.env.NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    console.error('FATAL: JWT_SECRET environment variable is missing or shorter than 32 characters in production.');
    process.exit(1);
  }
}

// Initialize DB schema & seeds
const { db, DATA_DIR } = require('./config/database');

const app = express();
const PORT = process.env.PORT || 5000;

// Configured allowed origins (local + custom frontend URLs)
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://localhost:5000'
];

if (process.env.FRONTEND_URL) {
  process.env.FRONTEND_URL.split(',').forEach(url => {
    const trimmed = url.trim();
    if (trimmed) allowedOrigins.push(trimmed);
  });
}
if (process.env.CLIENT_URL) {
  process.env.CLIENT_URL.split(',').forEach(url => {
    const trimmed = url.trim();
    if (trimmed) allowedOrigins.push(trimmed);
  });
}

// CORS setup supporting Vercel, Railway, and localhost environments
app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests (e.g. mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);

    // Explicitly allowed origin
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Automatically allow any Vercel deployment preview or production domain
    if (origin.endsWith('.vercel.app')) {
      return callback(null, true);
    }

    // Allow development localhost ports
    if (/^http:\/\/localhost:\d+$/.test(origin) || /^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) {
      return callback(null, true);
    }

    // Allow and reflect origin
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Pragma', 'X-Requested-With', 'x-tenant-id', 'X-Tenant-Id']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Static directory for uploaded receipts or temp files
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const fs = require('fs');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
app.use('/uploads', express.static(UPLOADS_DIR));

// Public subscription plans endpoint
const { PLANS } = require('./config/plans');
app.get('/api/plans', (req, res) => {
  res.json({ success: true, plans: Object.values(PLANS) });
});

// Health check with database latency measurement
app.get('/api/health', async (req, res) => {
  try {
    const latencyMs = db.measureLatency ? await db.measureLatency() : 0;
    res.json({
      status: 'ok',
      app: `${BRAND_NAME} Management System`,
      driver: db.getDriver ? db.getDriver() : 'sqlite',
      latency_ms: latencyMs,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(503).json({
      status: 'unhealthy',
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Maintenance mode middleware (stops tenant traffic during cut-over/maintenance while keeping health and superowner open)
app.use((req, res, next) => {
  if (process.env.MAINTENANCE_MODE === 'true') {
    if (req.path === '/api/health' || req.path.startsWith('/api/superowner')) {
      return next();
    }
    return res.status(503).json({
      success: false,
      maintenance: true,
      message: 'System is currently undergoing maintenance. Please try again shortly.',
      timestamp: new Date().toISOString()
    });
  }
  next();
});

// API Routes
app.use('/api/me', require('./routes/me'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/purchases', require('./routes/purchases'));
app.use('/api/sales', require('./routes/sales'));
app.use('/api/parties', require('./routes/parties'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/users', require('./routes/users'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/backups', require('./routes/backups'));
app.use('/api/superowner', require('./routes/superowner'));

// Serve Vite frontend in production if built
const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.use((req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ success: false, message: err.message || 'Internal server error' });
});

let server = null;
if (process.env.NODE_ENV !== 'test' || require.main === module) {
  server = app.listen(PORT, () => {
    console.log('\n======================================================');
    console.log(`  ${BRAND_NAME} - Multi-Tenant Point of Sale Server`);
    console.log(`  Local:   http://localhost:${PORT}`);
    console.log('  Network: Accessible across LAN devices');
    console.log(`  API:     http://localhost:${PORT}/api`);
    console.log('======================================================\n');
  });
}

module.exports = app;
module.exports.server = server;
