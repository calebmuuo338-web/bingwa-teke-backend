# Bingwa Teke Backend

Developer: Sofaya Data

Node.js/Express backend with a real Postgres database and a real Safaricom
Daraja (M-Pesa STK Push) integration.

## API

- `GET /api/health` — checks the server and DB connection
- `POST /api/auth/request-otp` — `{ phone }` → generates and stores a 6-digit OTP
- `POST /api/auth/verify-otp` — `{ phone, otp }` → returns a real JWT
- `GET /api/bundles?network=Safaricom` — list bundle offers
- `POST /api/transactions` — `{ offerId, simId, phone }` (auth required) → creates a
  transaction and sends an M-Pesa STK push to the phone
- `GET /api/transactions/:id/status` (auth required) — poll payment status
- `POST /api/mpesa/callback` — Safaricom calls this automatically; you don't call it yourself

## Local setup

1. Install Node.js 18+ and PostgreSQL (or run Postgres via Docker).
2. `npm install`
3. `cp .env.example .env` and fill in `DATABASE_URL` and `JWT_SECRET` at minimum.
4. `npm run migrate` — creates the tables and seeds the starter bundle catalog.
5. `npm start`

## Testing M-Pesa locally (sandbox)

Safaricom needs a **public HTTPS URL** to send callbacks to — it cannot reach
`localhost`. For local testing, use a tunnel like [ngrok](https://ngrok.com):

```
ngrok http 3000
```

Then set `DARAJA_CALLBACK_URL` in your `.env` to the `https://xxxx.ngrok-free.app/api/mpesa/callback`
URL ngrok gives you, restart the server, and test a real STK push using
Safaricom's sandbox test credentials from your Daraja app dashboard.

## Going live checklist

- [ ] Apply for a real Paybill/Till and go-live approval on the Daraja portal
      (this is a separate step from sandbox access — Safaricom reviews it)
- [ ] Switch `DARAJA_ENV=production` and use your production consumer key/secret,
      shortcode, and passkey
- [ ] Point `DARAJA_CALLBACK_URL` at your deployed backend's public URL
- [ ] Set a strong, unique `JWT_SECRET`
- [ ] Replace the OTP `console.log` in `routes/auth.js` with a real SMS provider
      (e.g. Africa's Talking, which is commonly used for Kenyan numbers)
- [ ] Add the actual bundle fulfillment step (USSD/telecom integration) where
      the `TODO` is in `routes/mpesaCallback.js`, so a successful payment
      actually triggers delivery of the bundle
