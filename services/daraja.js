// Safaricom Daraja API integration (Lipa na M-Pesa Online / STK Push).
// Docs: https://developer.safaricom.co.ke/APIs/MpesaExpressSimulate
//
// Required environment variables (see .env.example):
//   DARAJA_ENV               "sandbox" or "production"
//   DARAJA_CONSUMER_KEY      from your Daraja app
//   DARAJA_CONSUMER_SECRET   from your Daraja app
//   DARAJA_SHORTCODE         your Paybill/Till number (sandbox default: 174379)
//   DARAJA_PASSKEY           Lipa na M-Pesa Online passkey Safaricom gave you
//   DARAJA_CALLBACK_URL      public HTTPS URL Safaricom will POST results to,
//                            e.g. https://your-backend.onrender.com/api/mpesa/callback

const BASE_URL = process.env.DARAJA_ENV === 'production'
  ? 'https://api.safaricom.co.ke'
  : 'https://sandbox.safaricom.co.ke';

function timestampNow() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return (
    d.getFullYear().toString() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

// Daraja wants phone numbers as 2547XXXXXXXX (no leading +, no 0)
function normalizePhone(rawPhone) {
  let phone = String(rawPhone).replace(/\s+/g, '');
  if (phone.startsWith('+')) phone = phone.slice(1);
  if (phone.startsWith('0')) phone = `254${phone.slice(1)}`;
  if (phone.startsWith('7') || phone.startsWith('1')) phone = `254${phone}`;
  return phone;
}

async function getAccessToken() {
  const key = process.env.DARAJA_CONSUMER_KEY;
  const secret = process.env.DARAJA_CONSUMER_SECRET;
  if (!key || !secret) {
    throw new Error('DARAJA_CONSUMER_KEY / DARAJA_CONSUMER_SECRET are not set');
  }

  const credentials = Buffer.from(`${key}:${secret}`).toString('base64');
  const res = await fetch(`${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${credentials}` }
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Daraja OAuth failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  return data.access_token;
}

async function stkPush({ phone, amountKes, accountReference, transactionDesc }) {
  const shortcode = process.env.DARAJA_SHORTCODE;
  const passkey = process.env.DARAJA_PASSKEY;
  const callbackUrl = process.env.DARAJA_CALLBACK_URL;

  if (!shortcode || !passkey || !callbackUrl) {
    throw new Error('DARAJA_SHORTCODE / DARAJA_PASSKEY / DARAJA_CALLBACK_URL are not set');
  }

  const accessToken = await getAccessToken();
  const timestamp = timestampNow();
  const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');
  const msisdn = normalizePhone(phone);

  const payload = {
    BusinessShortCode: shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: Math.round(amountKes),
    PartyA: msisdn,
    PartyB: shortcode,
    PhoneNumber: msisdn,
    CallBackURL: callbackUrl,
    AccountReference: accountReference.slice(0, 12),
    TransactionDesc: transactionDesc.slice(0, 13)
  };

  const res = await fetch(`${BASE_URL}/mpesa/stkpush/v1/processrequest`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (!res.ok || data.ResponseCode !== '0') {
    const message = data.errorMessage || data.ResponseDescription || 'STK push request failed';
    throw new Error(message);
  }

  return {
    merchantRequestId: data.MerchantRequestID,
    checkoutRequestId: data.CheckoutRequestID
  };
}

module.exports = { getAccessToken, stkPush, normalizePhone };
