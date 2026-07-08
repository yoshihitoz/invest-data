const db = require('./db');
const { hashPassword } = require('./auth');

const DEFAULT_USERS = [
  { username: 'yoshihito', display_name: 'Papa', role: 'parent', password: 'papa-change-me' },
  { username: 'masako', display_name: 'Mama', role: 'parent', password: 'mama-change-me' },
  { username: 'yoshiyuki', display_name: '義幸', role: 'child', password: 'yoshiyuki-change-me' },
];

const DEFAULT_CHORE_TYPES = [
  { name: '皿洗い', points: 10 },
  { name: '洗濯物たたみ', points: 10 },
  { name: 'ゴミ出し', points: 5 },
  { name: '掃除機がけ', points: 15 },
  { name: 'お風呂掃除', points: 20 },
  { name: '玄関掃除', points: 15 },
];

const DEFAULT_REDEMPTION_OPTIONS = [
  { name: '現金 100円', type: 'cash', points_cost: 20, value: 100 },
  { name: '現金 500円', type: 'cash', points_cost: 90, value: 500 },
  { name: 'ゲーム時間 15分', type: 'game_time', points_cost: 10, value: 15 },
  { name: 'ゲーム時間 30分', type: 'game_time', points_cost: 18, value: 30 },
];

function seed() {
  const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  if (userCount === 0) {
    const insertUser = db.prepare(
      'INSERT INTO users (username, display_name, role, password_hash, password_salt) VALUES (?, ?, ?, ?, ?)'
    );
    for (const u of DEFAULT_USERS) {
      const { hash, salt } = hashPassword(u.password);
      insertUser.run(u.username, u.display_name, u.role, hash, salt);
    }
    console.log('初期ユーザーを作成しました。仮パスワードなので必ずログイン後に変更してください:');
    for (const u of DEFAULT_USERS) {
      console.log(`  ${u.username} / ${u.password}`);
    }
  }

  const choreTypeCount = db.prepare('SELECT COUNT(*) AS c FROM chore_types').get().c;
  if (choreTypeCount === 0) {
    const insertChore = db.prepare('INSERT INTO chore_types (name, points) VALUES (?, ?)');
    for (const c of DEFAULT_CHORE_TYPES) insertChore.run(c.name, c.points);
    console.log('サンプルのお手伝い種類を登録しました（後で管理画面から調整できます）。');
  }

  const redemptionCount = db.prepare('SELECT COUNT(*) AS c FROM redemption_options').get().c;
  if (redemptionCount === 0) {
    const insertRedemption = db.prepare(
      'INSERT INTO redemption_options (name, type, points_cost, value) VALUES (?, ?, ?, ?)'
    );
    for (const r of DEFAULT_REDEMPTION_OPTIONS) {
      insertRedemption.run(r.name, r.type, r.points_cost, r.value);
    }
    console.log('サンプルの交換メニューを登録しました（後で管理画面から調整できます）。');
  }
}

seed();

module.exports = { seed };
