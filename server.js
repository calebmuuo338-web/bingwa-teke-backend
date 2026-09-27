require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./db/pool');

const authRoutes = require('./routes/auth');
const bundlesRoutes = require('./routes/bundles');
const transactionsRoutes = require('./routes/transactions');
const mpesaCallbackRoutes = require('./routes/mpesaCallback');

const REQUIRED_ENV = ['DATABASE_URL', 'JWT_SECRET'];
const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  console.error('Copy .env.example to .env and fill these in before starting the server.');
  process.exit(1);
}

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, service: 'Bingwa Teke API', db: 'connected' });
  } catch (err) {
    res.status(500).json({ ok: false, service: 'Bingwa Teke API', db: 'unreachable', error: err.message });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/bundles', bundlesRoutes);
app.use('/api/transactions', transactionsRoutes);
app.use('/api/mpesa/callback', mpesaCallbackRoutes);

// Generic error handler so a thrown error in an async route doesn't crash
// the whole process without a response being sent.
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Bingwa Teke API running on port ${PORT}`);
});
