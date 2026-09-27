const express = require('express');
const pool = require('../db/pool');

const router = express.Router();

router.get('/', async (req, res) => {
  const { network } = req.query;
  const params = [];
  let query = 'SELECT id, network, data_label, validity_label, price_kes, ussd_code FROM bundle_offers WHERE active = TRUE';

  if (network) {
    params.push(network);
    query += ` AND LOWER(network) = LOWER($${params.length})`;
  }
  query += ' ORDER BY price_kes ASC';

  const { rows } = await pool.query(query, params);
  res.json({ offers: rows });
});

module.exports = router;
