CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(32) UNIQUE NOT NULL,
  name VARCHAR(120) NOT NULL DEFAULT 'Bingwa Teke User',
  role VARCHAR(20) NOT NULL DEFAULT 'customer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(32) NOT NULL,
  code_hash VARCHAR(120) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_otp_phone ON otp_codes(phone);

CREATE TABLE IF NOT EXISTS bundle_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  network VARCHAR(40) NOT NULL,
  data_label VARCHAR(40) NOT NULL,
  validity_label VARCHAR(40) NOT NULL,
  price_kes INTEGER NOT NULL CHECK (price_kes >= 0),
  ussd_code TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  offer_id UUID NOT NULL REFERENCES bundle_offers(id),
  sim_id VARCHAR(100),
  phone VARCHAR(32) NOT NULL,
  amount_kes INTEGER NOT NULL CHECK (amount_kes >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','success','failed','cancelled')),
  merchant_request_id VARCHAR(120),
  checkout_request_id VARCHAR(120) UNIQUE,
  mpesa_receipt_number VARCHAR(60),
  result_code INTEGER,
  result_desc TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tx_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_tx_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_tx_checkout ON transactions(checkout_request_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(120) NOT NULL,
  entity_type VARCHAR(80),
  entity_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Starter bundle catalog. Edit prices/USSD codes to match your real offers.
INSERT INTO bundle_offers (network, data_label, validity_label, price_kes, ussd_code)
SELECT * FROM (VALUES
  ('Safaricom', '250MB', '24 hours', 20, '*544#'),
  ('Safaricom', '500MB', '24 hours', 39, '*544#'),
  ('Safaricom', '1GB', '24 hours', 79, '*544#'),
  ('Safaricom', '2GB', '24 hours', 120, '*544#'),
  ('Safaricom', '4GB', '7 days', 250, '*544#')
) AS seed(network, data_label, validity_label, price_kes, ussd_code)
WHERE NOT EXISTS (SELECT 1 FROM bundle_offers);
