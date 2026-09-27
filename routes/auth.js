const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');

const router = express.Router();

function hashOtp(code) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

// Generates a 6-digit code. Wire in a real SMS provider (e.g. Africa's
// Talking, Twilio) here instead of console.log before going to production —
// right now the code is only logged server-side, never returned to the client.
router.post('/request-otp', async (req, res) => {
  const { phone } = req.body || {};
  if (!phone || String(phone).trim().length < 9) {
    return res.status(400).json({ message: 'Valid phone number required' });
  }

  const normalizedPhone = String(phone).trim();
  const code = String(crypto.randomInt(100000, 999999));
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  await pool.query(
    'INSERT INTO otp_codes (phone, code_hash, expires_at) VALUES ($1, $2, $3)',
    [normalizedPhone, hashOtp(code), expiresAt]
  );

  // TODO: replace this with a real SMS send call.
  console.log(`[OTP] ${normalizedPhone} -> ${code} (expires ${expiresAt.toISOString()})`);

  const response = { ok: true, message: 'OTP sent' };
  if (process.env.NODE_ENV !== 'production') {
    response.devOtp = code; // only exposed outside production for easier testing
  }
  res.json(response);
});

router.post('/verify-otp', async (req, res) => {
  const { phone, otp } = req.body || {};
  if (!phone || !otp) {
    return res.status(400).json({ message: 'phone and otp are required' });
  }

  const normalizedPhone = String(phone).trim();
  const { rows } = await pool.query(
    `SELECT id, code_hash FROM otp_codes
     WHERE phone = $1 AND consumed = FALSE AND expires_at > NOW()
     ORDER BY created_at DESC LIMIT 1`,
    [normalizedPhone]
  );

  const record = rows[0];
  if (!record || record.code_hash !== hashOtp(String(otp))) {
    return res.status(401).json({ message: 'Invalid or expired OTP' });
  }

  await pool.query('UPDATE otp_codes SET consumed = TRUE WHERE id = $1', [record.id]);

  const userResult = await pool.query(
    `INSERT INTO users (phone) VALUES ($1)
     ON CONFLICT (phone) DO UPDATE SET phone = EXCLUDED.phone
     RETURNING id, phone, name, role`,
    [normalizedPhone]
  );
  const user = userResult.rows[0];

  const accessToken = jwt.sign(
    { sub: user.id, phone: user.phone },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({ ok: true, accessToken, user });
});

module.exports = router;
