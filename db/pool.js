const { Pool } = require('pg');

// Render, Railway, and most managed Postgres providers give you a single
// DATABASE_URL connection string — put it in your .env (or the host's
// environment variable settings). SSL is required by most hosted Postgres
// providers, so it's enabled unless you're pointed at localhost.
const isLocal = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL || '');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false }
});

pool.on('error', (err) => {
  console.error('Unexpected Postgres pool error', err);
});

module.exports = pool;
