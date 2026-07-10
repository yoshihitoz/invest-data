const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../auth');
const { addTransaction } = require('../points');

const router = express.Router();

const SELECT_BASE = `
  SELECT
    cr.id, cr.note, cr.status, cr.points_awarded, cr.requested_at, cr.reviewed_at, cr.review_note,
    ct.id AS chore_type_id, ct.name AS chore_type_name, ct.points AS chore_type_points,
    u.id AS user_id, u.display_name AS user_display_name,
    ru.display_name AS reviewed_by_name
  FROM chore_requests cr
  JOIN chore_types ct ON ct.id = cr.chore_type_id
  JOIN users u ON u.id = cr.user_id
  LEFT JOIN users ru ON ru.id = cr.reviewed_by
`;

router.get('/', requireAuth, (req, res) => {
  const status = req.query.status;
  const clauses = [];
  const params = [];

  if (req.session.role !== 'parent') {
    clauses.push('cr.user_id = ?');
    params.push(req.session.userId);
  }
  if (status) {
    clauses.push('cr.status = ?');
    params.push(status);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db.prepare(`${SELECT_BASE} ${where} ORDER BY cr.requested_at DESC`).all(...params);
  res.json(rows);
});

router.post('/', requireAuth, requireRole('child'), (req, res) => {
  const { chore_type_id, note } = req.body || {};
  const choreType = db.prepare('SELECT * FROM chore_types WHERE id = ? AND active = 1').get(chore_type_id);
  if (!choreType) return res.status(400).json({ error: '有効なお手伝いの種類を選んでください' });

  const result = db
    .prepare('INSERT INTO chore_requests (user_id, chore_type_id, note) VALUES (?, ?, ?)')
    .run(req.session.userId, choreType.id, note || null);

  res.status(201).json(db.prepare(`${SELECT_BASE} WHERE cr.id = ?`).get(result.lastInsertRowid));
});

router.post('/:id/approve', requireAuth, requireRole('parent'), (req, res) => {
  const request = db.prepare('SELECT * FROM chore_requests WHERE id = ?').get(req.params.id);
  if (!request) return res.status(404).json({ error: '見つかりません' });
  if (request.status !== 'pending') return res.status(400).json({ error: 'すでに処理済みです' });

  const choreType = db.prepare('SELECT * FROM chore_types WHERE id = ?').get(request.chore_type_id);

  db.prepare(
    `UPDATE chore_requests
     SET status = 'approved', points_awarded = ?, reviewed_by = ?, reviewed_at = datetime('now'), review_note = ?
     WHERE id = ?`
  ).run(choreType.points, req.session.userId, req.body?.note || null, request.id);

  addTransaction({
    userId: request.user_id,
    delta: choreType.points,
    reason: `お手伝い承認: ${choreType.name}`,
    choreRequestId: request.id,
  });

  res.json(db.prepare(`${SELECT_BASE} WHERE cr.id = ?`).get(request.id));
});

router.post('/:id/reject', requireAuth, requireRole('parent'), (req, res) => {
  const request = db.prepare('SELECT * FROM chore_requests WHERE id = ?').get(req.params.id);
  if (!request) return res.status(404).json({ error: '見つかりません' });
  if (request.status !== 'pending') return res.status(400).json({ error: 'すでに処理済みです' });

  db.prepare(
    `UPDATE chore_requests
     SET status = 'rejected', reviewed_by = ?, reviewed_at = datetime('now'), review_note = ?
     WHERE id = ?`
  ).run(req.session.userId, req.body?.note || null, request.id);

  res.json(db.prepare(`${SELECT_BASE} WHERE cr.id = ?`).get(request.id));
});

module.exports = router;
