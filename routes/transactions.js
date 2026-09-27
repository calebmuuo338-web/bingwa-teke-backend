const express = require('express');
const pool = require('../db/pool');
const daraja = require('../services/daraja');
const { requireAuth } = require('./authMiddleware');

const router = express.Router();

// Create a transaction and trigger an M-Pesa STK push (customer gets a
// prompt on their phone to enter their M-Pesa PIN).
router.post('/', requireAuth, async (req, res) => {
  const { offerId, simId, phone } = req.body || {};
  if (!offerId || !simId || !phone) {
    return res.status(400).json({ message: 'offerId, simId and phone are required' });
  }

  const offerResult = await pool.query(
    'SELECT id, network, data_label, price_kes FROM bundle_offers WHERE id = $1 AND active = TRUE',
    [offerId]
  );
  const offer = offerResult.rows[0];
  if (!offer) {
    return res.status(404).json({ message: 'Bundle offer not found' });
  }

  const txResult = await pool.query(
    `INSERT INTO transactions (user_id, offer_id, sim_id, phone, amount_kes, status)
     VALUES ($1, $2, $3, $4, $5, 'pending')
     RETURNING *`,
    [req.user.sub, offerId, simId, phone, offer.price_kes]
  );
  const tx = txResult.rows[0];

  try {
    const { merchantRequestId, checkoutRequestId } = await daraja.stkPush({
      phone,
      amountKes: offer.price_kes,
      accountReference: 'BingwaTeke',
      transactionDesc: `${offer.data_label} bundle`
    });

    const updated = await pool.query(
      `UPDATE transactions
       SET status = 'processing', merchant_request_id = $1, checkout_request_id = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [merchantRequestId, checkoutRequestId, tx.id]
    );

    res.status(201).json({
      transaction: updated.rows[0],
      message: 'STK push sent — check your phone to enter your M-Pesa PIN'
    });
  } catch (err) {
    await pool.query(
      `UPDATE transactions SET status = 'failed', result_desc = $1, updated_at = NOW() WHERE id = $2`,
      [err.message, tx.id]
    );
    res.status(502).json({ message: `M-Pesa request failed: ${err.message}` });
  }
});

// The Flutter app polls this after sending the STK push, since the actual
// payment result arrives asynchronously via the /api/mpesa/callback route.
router.get('/:id/status', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, status, mpesa_receipt_number, result_desc FROM transactions WHERE id = $1 AND user_id = $2',
    [req.params.id, req.user.sub]
  );
  const tx = rows[0];
  if (!tx) return res.status(404).json({ message: 'Transaction not found' });
  res.json({ transaction: tx });
});

module.exports = router;
