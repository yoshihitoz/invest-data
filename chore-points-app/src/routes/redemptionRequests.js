const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../auth');
const { getBalance, addTransaction } = require('../points');

const router = express.Router();

const SELECT_BASE = `
  SELECT
    rr.id, rr.status, rr.points_cost, rr.requested_at, rr.reviewed_at, rr.review_note,
    ro.id AS option_id, ro.name AS option_name, ro.type AS option_type, ro.value AS option_value,
    u.id AS user_id, u.display_name AS user_display_name,
    ru.display_name AS reviewed_by_name
  FROM redemption_requests rr
  JOIN redemption_options ro ON ro.id = rr.redemption_option_id
  JOIN users u ON u.id = rr.user_id
  LEFT JOIN users ru ON ru.id = rr.reviewed_by
`;

router.get('/', requireAuth, (req, res) => {
  const status = req.query.status;
  const clauses = [];
  const params = [];

  if (req.session.role !== 'parent') {
    clauses.push('rr.user_id = ?');
    params.push(req.session.userId);
  }
  if (status) {
    clauses.push('rr.status = ?');
    params.push(status);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db.prepare(`${SELECT_BASE} ${where} ORDER BY rr.requested_at DESC`).all(...params);
  res.json(rows);
});

router.post('/', requireAuth, requireRole('child'), (req, res) => {
  const { redemption_option_id } = req.body || {};
  const option = db.prepare('SELECT * FROM redemption_options WHERE id = ? AND active = 1').get(redemption_option_id);
  if (!option) return res.status(400).json({ error: '有効な交換メニューを選んでください' });

  const balance = getBalance(req.session.userId);
  if (balance < option.points_cost) {
    return res.status(400).json({ error: `ポイントが足りません（残高: ${balance}pt、必要: ${option.points_cost}pt）` });
  }

  const result = db
    .prepare('INSERT INTO redemption_requests (user_id, redemption_option_id, points_cost) VALUES (?, ?, ?)')
    .run(req.session.userId, option.id, option.points_cost);

  res.status(201).json(db.prepare(`${SELECT_BASE} WHERE rr.id = ?`).get(result.lastInsertRowid));
});

router.post('/:id/approve', requireAuth, requireRole('parent'), (req, res) => {
  const request = db.prepare('SELECT * FROM redemption_requests WHERE id = ?').get(req.params.id);
  if (!request) return res.status(404).json({ error: '見つかりません' });
  if (request.status !== 'pending') return res.status(400).json({ error: 'すでに処理済みです' });

  const balance = getBalance(request.user_id);
  if (balance < request.points_cost) {
    return res.status(400).json({ error: `本人のポイント残高が不足しています（残高: ${balance}pt）` });
  }

  const option = db.prepare('SELECT * FROM redemption_options WHERE id = ?').get(request.redemption_option_id);

  db.prepare(
    `UPDATE redemption_requests
     SET status = 'approved', reviewed_by = ?, reviewed_at = datetime('now'), review_note = ?
     WHERE id = ?`
  ).run(req.session.userId, req.body?.note || null, request.id);

  addTransaction({
    userId: request.user_id,
    delta: -request.points_cost,
    reason: `交換承認: ${option.name}`,
    redemptionRequestId: request.id,
  });

  res.json(db.prepare(`${SELECT_BASE} WHERE rr.id = ?`).get(request.id));
});

router.post('/:id/reject', requireAuth, requireRole('parent'), (req, res) => {
  const request = db.prepare('SELECT * FROM redemption_requests WHERE id = ?').get(req.params.id);
  if (!request) return res.status(404).json({ error: '見つかりません' });
  if (request.status !== 'pending') return res.status(400).json({ error: 'すでに処理済みです' });

  db.prepare(
    `UPDATE redemption_requests
     SET status = 'rejected', reviewed_by = ?, reviewed_at = datetime('now'), review_note = ?
     WHERE id = ?`
  ).run(req.session.userId, req.body?.note || null, request.id);

  res.json(db.prepare(`${SELECT_BASE} WHERE rr.id = ?`).get(request.id));
});

module.exports = router;
