const db = require('./db');

function getBalance(userId) {
  const row = db
    .prepare('SELECT COALESCE(SUM(delta), 0) AS balance FROM point_transactions WHERE user_id = ?')
    .get(userId);
  return row.balance;
}

function addTransaction({ userId, delta, reason, choreRequestId = null, redemptionRequestId = null }) {
  db.prepare(
    `INSERT INTO point_transactions (user_id, delta, reason, chore_request_id, redemption_request_id)
     VALUES (?, ?, ?, ?, ?)`
  ).run(userId, delta, reason, choreRequestId, redemptionRequestId);
}

module.exports = { getBalance, addTransaction };
