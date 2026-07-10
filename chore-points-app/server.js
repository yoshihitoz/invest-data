const path = require('node:path');
const crypto = require('node:crypto');
const express = require('express');
const session = require('express-session');

require('./src/seed');

const authRoutes = require('./src/routes/auth');
const usersRoutes = require('./src/routes/users');
const choreTypesRoutes = require('./src/routes/choreTypes');
const choreRequestsRoutes = require('./src/routes/choreRequests');
const redemptionOptionsRoutes = require('./src/routes/redemptionOptions');
const redemptionRequestsRoutes = require('./src/routes/redemptionRequests');
const transactionsRoutes = require('./src/routes/transactions');

const app = express();
const PORT = process.env.PORT || 3000;

if (!process.env.SESSION_SECRET) {
  console.warn('警告: SESSION_SECRET が未設定のため、起動のたびにセッションが無効になります。本番運用では環境変数を設定してください。');
}

app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 30,
      sameSite: 'lax',
    },
  })
);

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/chore-types', choreTypesRoutes);
app.use('/api/chore-requests', choreRequestsRoutes);
app.use('/api/redemption-options', redemptionOptionsRoutes);
app.use('/api/redemption-requests', redemptionRequestsRoutes);
app.use('/api/transactions', transactionsRoutes);

app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`Chore points app listening on http://localhost:${PORT}`);
});
