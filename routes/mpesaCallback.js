const express = require('express');
const pool = require('../db/pool');

const router = express.Router();

// Safaricom POSTs here after the customer enters (or cancels) their M-Pesa
// PIN. This URL must be public HTTPS and match DARAJA_CALLBACK_URL exactly —
// Safaricom will not call localhost or an http:// URL.
router.post('/', async (req, res) => {
  const callback = req.body?.Body?.stkCallback;

  // Always acknowledge receipt so Safaricom doesn't retry indefinitely, even
  // if we can't match the transaction below.
  const ack = () => res.json({ ResultCode: 0, ResultDesc: 'Accepted' });

  if (!callback) {
    console.warn('Received malformed M-Pesa callback:', JSON.stringify(req.body));
    return ack();
  }

  const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = callback;
  let mpesaReceiptNumber = null;

  if (ResultCode === 0 && CallbackMetadata?.Item) {
    const receiptItem = CallbackMetadata.Item.find((i) => i.Name === 'MpesaReceiptNumber');
    mpesaReceiptNumber = receiptItem?.Value || null;
  }

  const status = ResultCode === 0 ? 'success' : 'failed';

  await pool.query(
    `UPDATE transactions
     SET status = $1, result_code = $2, result_desc = $3, mpesa_receipt_number = $4, updated_at = NOW()
     WHERE checkout_request_id = $5`,
    [status, ResultCode, ResultDesc, mpesaReceiptNumber, CheckoutRequestID]
  );

  // TODO: once status flips to 'success', trigger the actual bundle
  // fulfillment step here (your USSD/telecom_service flow) or queue it
  // for the admin dashboard to action.

  ack();
});

module.exports = router;
