const express = require('express');
const db = require('../db');
const { hashPassword, verifyPassword, requireAuth } = require('../auth');

const router = express.Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'ユーザー名とパスワードを入力してください' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !verifyPassword(password, user.password_salt, user.password_hash)) {
    return res.status(401).json({ error: 'ユーザー名またはパスワードが違います' });
  }

  req.session.userId = user.id;
  req.session.role = user.role;
  res.json({ id: user.id, username: user.username, display_name: user.display_name, role: user.role });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get('/me', requireAuth, (req, res) => {
  const user = db
    .prepare('SELECT id, username, display_name, role FROM users WHERE id = ?')
    .get(req.session.userId);
  if (!user) return res.status(401).json({ error: 'ログインが必要です' });
  res.json(user);
});

router.post('/change-password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: '新しいパスワードは6文字以上にしてください' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
  if (!verifyPassword(currentPassword, user.password_salt, user.password_hash)) {
    return res.status(401).json({ error: '現在のパスワードが違います' });
  }

  const { hash, salt } = hashPassword(newPassword);
  db.prepare('UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?').run(hash, salt, user.id);
  res.json({ ok: true });
});

module.exports = router;
