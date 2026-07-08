const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../auth');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const activeOnly = req.query.all !== '1';
  const rows = activeOnly
    ? db.prepare('SELECT * FROM redemption_options WHERE active = 1 ORDER BY type, points_cost').all()
    : db.prepare('SELECT * FROM redemption_options ORDER BY type, points_cost').all();
  res.json(rows);
});

router.post('/', requireAuth, requireRole('parent'), (req, res) => {
  const { name, type, points_cost, value } = req.body || {};
  if (!name || !['cash', 'game_time'].includes(type) || !Number.isInteger(points_cost) || points_cost <= 0 || !Number.isInteger(value) || value <= 0) {
    return res.status(400).json({ error: '入力内容を確認してください' });
  }
  const result = db
    .prepare('INSERT INTO redemption_options (name, type, points_cost, value) VALUES (?, ?, ?, ?)')
    .run(name, type, points_cost, value);
  res.status(201).json(db.prepare('SELECT * FROM redemption_options WHERE id = ?').get(result.lastInsertRowid));
});

router.put('/:id', requireAuth, requireRole('parent'), (req, res) => {
  const existing = db.prepare('SELECT * FROM redemption_options WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: '見つかりません' });

  const name = req.body?.name ?? existing.name;
  const type = req.body?.type ?? existing.type;
  const points_cost = req.body?.points_cost ?? existing.points_cost;
  const value = req.body?.value ?? existing.value;
  const active = req.body?.active ?? existing.active;

  if (!['cash', 'game_time'].includes(type) || !Number.isInteger(points_cost) || points_cost <= 0 || !Number.isInteger(value) || value <= 0) {
    return res.status(400).json({ error: '入力内容を確認してください' });
  }

  db.prepare(
    'UPDATE redemption_options SET name = ?, type = ?, points_cost = ?, value = ?, active = ? WHERE id = ?'
  ).run(name, type, points_cost, value, active ? 1 : 0, req.params.id);
  res.json(db.prepare('SELECT * FROM redemption_options WHERE id = ?').get(req.params.id));
});

module.exports = router;
