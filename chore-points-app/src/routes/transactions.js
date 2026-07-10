const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  let userId = req.session.userId;
  if (req.session.role === 'parent' && req.query.user_id) {
    userId = req.query.user_id;
  }
  const rows = db
    .prepare('SELECT id, delta, reason, created_at FROM point_transactions WHERE user_id = ? ORDER BY created_at DESC')
    .all(userId);
  res.json(rows);
});

module.exports = router;
