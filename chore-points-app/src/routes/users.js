const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../auth');
const { getBalance } = require('../points');

const router = express.Router();

router.get('/balance', requireAuth, (req, res) => {
  res.json({ balance: getBalance(req.session.userId) });
});

router.get('/', requireAuth, requireRole('parent'), (req, res) => {
  const users = db.prepare('SELECT id, username, display_name, role FROM users ORDER BY role, id').all();
  const withBalance = users.map((u) => ({ ...u, balance: getBalance(u.id) }));
  res.json(withBalance);
});

module.exports = router;
