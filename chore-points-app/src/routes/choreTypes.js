const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../auth');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const activeOnly = req.query.all !== '1';
  const rows = activeOnly
    ? db.prepare('SELECT * FROM chore_types WHERE active = 1 ORDER BY points DESC').all()
    : db.prepare('SELECT * FROM chore_types ORDER BY points DESC').all();
  res.json(rows);
});

router.post('/', requireAuth, requireRole('parent'), (req, res) => {
  const { name, points } = req.body || {};
  if (!name || !Number.isInteger(points) || points <= 0) {
    return res.status(400).json({ error: '名前と正の整数のポイントを指定してください' });
  }
  const result = db.prepare('INSERT INTO chore_types (name, points) VALUES (?, ?)').run(name, points);
  res.status(201).json(db.prepare('SELECT * FROM chore_types WHERE id = ?').get(result.lastInsertRowid));
});

router.put('/:id', requireAuth, requireRole('parent'), (req, res) => {
  const existing = db.prepare('SELECT * FROM chore_types WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: '見つかりません' });

  const name = req.body?.name ?? existing.name;
  const points = req.body?.points ?? existing.points;
  const active = req.body?.active ?? existing.active;
  if (!Number.isInteger(points) || points <= 0) {
    return res.status(400).json({ error: 'ポイントは正の整数にしてください' });
  }

  db.prepare('UPDATE chore_types SET name = ?, points = ?, active = ? WHERE id = ?').run(
    name,
    points,
    active ? 1 : 0,
    req.params.id
  );
  res.json(db.prepare('SELECT * FROM chore_types WHERE id = ?').get(req.params.id));
});

module.exports = router;
