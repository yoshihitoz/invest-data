const state = {
  me: null,
  tab: null,
  error: null,
  data: {},
};

const app = document.getElementById('app');

async function api(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    method: options.method || 'GET',
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
    credentials: 'include',
  });
  let body = null;
  try {
    body = await res.json();
  } catch (e) {
    body = null;
  }
  if (!res.ok) {
    throw new Error(body?.error || `エラーが発生しました (${res.status})`);
  }
  return body;
}

function fmtDate(s) {
  if (!s) return '';
  return s.replace('T', ' ').slice(0, 16);
}

function statusLabel(status) {
  return { pending: '承認待ち', approved: '承認済み', rejected: '却下' }[status] || status;
}

async function init() {
  try {
    state.me = await api('/auth/me');
    state.tab = state.me.role === 'parent' ? 'approve' : 'chores';
  } catch (e) {
    state.me = null;
  }
  render();
}

async function handleLogin(e) {
  e.preventDefault();
  const form = e.target;
  const username = form.username.value.trim();
  const password = form.password.value;
  try {
    state.me = await api('/auth/login', { method: 'POST', body: { username, password } });
    state.tab = state.me.role === 'parent' ? 'approve' : 'chores';
    state.error = null;
    render();
  } catch (err) {
    state.error = err.message;
    render();
  }
}

async function handleLogout() {
  await api('/auth/logout', { method: 'POST' });
  state.me = null;
  state.data = {};
  render();
}

function setTab(tab) {
  state.tab = tab;
  render();
}

function renderLogin() {
  app.innerHTML = `
    <div class="card login-card">
      <h2>お手伝いポイント</h2>
      ${state.error ? `<div class="error">${state.error}</div>` : ''}
      <form id="login-form">
        <input name="username" placeholder="ユーザー名" autocomplete="username" required />
        <input name="password" type="password" placeholder="パスワード" autocomplete="current-password" required />
        <button type="submit">ログイン</button>
      </form>
    </div>
  `;
  document.getElementById('login-form').addEventListener('submit', handleLogin);
}

function renderTopbar() {
  return `
    <div class="topbar">
      <h1>お手伝いポイント</h1>
      <div class="user-info">
        <span>${state.me.display_name}さん</span>
        <button class="secondary" id="logout-btn">ログアウト</button>
      </div>
    </div>
  `;
}

function renderChildTabs() {
  const tabs = [
    ['chores', 'お手伝い'],
    ['redeem', '交換'],
    ['history', '履歴'],
  ];
  return `<div class="tabs">${tabs
    .map(([key, label]) => `<button data-tab="${key}" class="${state.tab === key ? 'active' : ''}">${label}</button>`)
    .join('')}</div>`;
}

function renderParentTabs() {
  const tabs = [
    ['approve', '承認'],
    ['balances', '残高一覧'],
    ['settings', '設定'],
  ];
  return `<div class="tabs">${tabs
    .map(([key, label]) => `<button data-tab="${key}" class="${state.tab === key ? 'active' : ''}">${label}</button>`)
    .join('')}</div>`;
}

async function loadChildChores() {
  const [balance, choreTypes, myRequests] = await Promise.all([
    api('/users/balance'),
    api('/chore-types'),
    api('/chore-requests'),
  ]);
  return { balance, choreTypes, myRequests };
}

async function renderChildChoresTab(container) {
  const { balance, choreTypes, myRequests } = await loadChildChores();
  const pending = myRequests.filter((r) => r.status === 'pending');

  container.innerHTML = `
    <div class="card balance-card">
      <div class="amount">${balance.balance}pt</div>
      <div class="label">現在のポイント</div>
    </div>
    <div class="section-title">お手伝いを申請する</div>
    <div class="grid">
      ${choreTypes
        .map(
          (c) => `
        <div class="tile">
          <div class="name">${c.name}</div>
          <div class="points">+${c.points}pt</div>
          <button data-chore-id="${c.id}" class="request-chore-btn">申請する</button>
        </div>`
        )
        .join('') || '<div class="empty">お手伝いの種類がまだ登録されていません</div>'}
    </div>
    <div class="section-title">承認待ちの申請</div>
    <div class="card">
      ${
        pending
          .map(
            (r) => `
        <div class="list-item">
          <div>
            <div>${r.chore_type_name} (+${r.chore_type_points}pt)</div>
            <div class="meta">${fmtDate(r.requested_at)}</div>
          </div>
          <span class="badge pending">承認待ち</span>
        </div>`
          )
          .join('') || '<div class="empty">承認待ちの申請はありません</div>'
      }
    </div>
  `;

  container.querySelectorAll('.request-chore-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        await api('/chore-requests', { method: 'POST', body: { chore_type_id: Number(btn.dataset.choreId) } });
        render();
      } catch (err) {
        alert(err.message);
        btn.disabled = false;
      }
    });
  });
}

async function loadChildRedeem() {
  const [balance, options, myRequests] = await Promise.all([
    api('/users/balance'),
    api('/redemption-options'),
    api('/redemption-requests'),
  ]);
  return { balance, options, myRequests };
}

async function renderChildRedeemTab(container) {
  const { balance, options, myRequests } = await loadChildRedeem();
  const pending = myRequests.filter((r) => r.status === 'pending');

  container.innerHTML = `
    <div class="card balance-card">
      <div class="amount">${balance.balance}pt</div>
      <div class="label">現在のポイント</div>
    </div>
    <div class="section-title">ポイントを交換する</div>
    <div class="grid">
      ${options
        .map(
          (o) => `
        <div class="tile">
          <div class="name">${o.name}</div>
          <div class="points">${o.points_cost}pt</div>
          <button data-option-id="${o.id}" class="redeem-btn" ${balance.balance < o.points_cost ? 'disabled' : ''}>交換申請</button>
        </div>`
        )
        .join('') || '<div class="empty">交換メニューがまだ登録されていません</div>'}
    </div>
    <div class="section-title">承認待ちの交換申請</div>
    <div class="card">
      ${
        pending
          .map(
            (r) => `
        <div class="list-item">
          <div>
            <div>${r.option_name} (${r.points_cost}pt)</div>
            <div class="meta">${fmtDate(r.requested_at)}</div>
          </div>
          <span class="badge pending">承認待ち</span>
        </div>`
          )
          .join('') || '<div class="empty">承認待ちの交換申請はありません</div>'
      }
    </div>
  `;

  container.querySelectorAll('.redeem-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        await api('/redemption-requests', { method: 'POST', body: { redemption_option_id: Number(btn.dataset.optionId) } });
        render();
      } catch (err) {
        alert(err.message);
        btn.disabled = false;
      }
    });
  });
}

async function renderChildHistoryTab(container) {
  const [choreRequests, redemptionRequests, transactions] = await Promise.all([
    api('/chore-requests'),
    api('/redemption-requests'),
    api('/transactions'),
  ]);

  container.innerHTML = `
    <div class="section-title">お手伝い申請の履歴</div>
    <div class="card">
      ${
        choreRequests
          .map(
            (r) => `
        <div class="list-item">
          <div>
            <div>${r.chore_type_name} (+${r.chore_type_points}pt)</div>
            <div class="meta">${fmtDate(r.requested_at)}${r.review_note ? ' ・ ' + r.review_note : ''}</div>
          </div>
          <span class="badge ${r.status}">${statusLabel(r.status)}</span>
        </div>`
          )
          .join('') || '<div class="empty">まだ申請がありません</div>'
      }
    </div>
    <div class="section-title">交換申請の履歴</div>
    <div class="card">
      ${
        redemptionRequests
          .map(
            (r) => `
        <div class="list-item">
          <div>
            <div>${r.option_name} (${r.points_cost}pt)</div>
            <div class="meta">${fmtDate(r.requested_at)}${r.review_note ? ' ・ ' + r.review_note : ''}</div>
          </div>
          <span class="badge ${r.status}">${statusLabel(r.status)}</span>
        </div>`
          )
          .join('') || '<div class="empty">まだ交換申請がありません</div>'
      }
    </div>
    <div class="section-title">ポイント履歴</div>
    <div class="card">
      ${
        transactions
          .map(
            (t) => `
        <div class="list-item">
          <div>
            <div>${t.reason}</div>
            <div class="meta">${fmtDate(t.created_at)}</div>
          </div>
          <div style="color:${t.delta >= 0 ? 'var(--approved)' : 'var(--rejected)'}; font-weight:600;">
            ${t.delta >= 0 ? '+' : ''}${t.delta}pt
          </div>
        </div>`
          )
          .join('') || '<div class="empty">履歴がありません</div>'
      }
    </div>
  `;
}

async function renderParentApproveTab(container) {
  const [pendingChores, pendingRedemptions] = await Promise.all([
    api('/chore-requests?status=pending'),
    api('/redemption-requests?status=pending'),
  ]);

  container.innerHTML = `
    <div class="section-title">お手伝いの承認待ち</div>
    <div class="card">
      ${
        pendingChores
          .map(
            (r) => `
        <div class="list-item">
          <div>
            <div>${r.user_display_name}: ${r.chore_type_name} (+${r.chore_type_points}pt)</div>
            <div class="meta">${fmtDate(r.requested_at)}${r.note ? ' ・ ' + r.note : ''}</div>
          </div>
          <div class="actions">
            <button data-action="approve-chore" data-id="${r.id}">承認</button>
            <button class="danger" data-action="reject-chore" data-id="${r.id}">却下</button>
          </div>
        </div>`
          )
          .join('') || '<div class="empty">承認待ちのお手伝いはありません</div>'
      }
    </div>
    <div class="section-title">交換の承認待ち</div>
    <div class="card">
      ${
        pendingRedemptions
          .map(
            (r) => `
        <div class="list-item">
          <div>
            <div>${r.user_display_name}: ${r.option_name} (${r.points_cost}pt)</div>
            <div class="meta">${fmtDate(r.requested_at)}</div>
          </div>
          <div class="actions">
            <button data-action="approve-redemption" data-id="${r.id}">承認</button>
            <button class="danger" data-action="reject-redemption" data-id="${r.id}">却下</button>
          </div>
        </div>`
          )
          .join('') || '<div class="empty">承認待ちの交換申請はありません</div>'
      }
    </div>
  `;

  container.querySelectorAll('[data-action]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const { action, id } = btn.dataset;
      const [kind, decision] = [action.includes('chore') ? 'chore-requests' : 'redemption-requests', action.startsWith('approve') ? 'approve' : 'reject'];
      btn.disabled = true;
      try {
        await api(`/${kind}/${id}/${decision}`, { method: 'POST' });
        render();
      } catch (err) {
        alert(err.message);
        btn.disabled = false;
      }
    });
  });
}

async function renderParentBalancesTab(container) {
  const users = await api('/users');

  container.innerHTML = `
    <div class="section-title">家族のポイント残高</div>
    <div class="card">
      ${users
        .map(
          (u) => `
        <div class="list-item">
          <div>${u.display_name}（${u.role === 'parent' ? '親' : '子'}）</div>
          <div style="font-weight:700;">${u.balance}pt</div>
        </div>`
        )
        .join('')}
    </div>
  `;
}

async function renderParentSettingsTab(container) {
  const [choreTypes, options] = await Promise.all([
    api('/chore-types?all=1'),
    api('/redemption-options?all=1'),
  ]);

  container.innerHTML = `
    <div class="section-title">お手伝いの種類とポイント</div>
    <div class="card">
      ${choreTypes
        .map(
          (c) => `
        <div class="admin-row">
          <span style="flex:1;">${c.name}${c.active ? '' : '（無効）'}</span>
          <input type="number" min="1" value="${c.points}" data-chore-points="${c.id}" />
          <button data-toggle-chore="${c.id}" data-active="${c.active}" class="secondary">${c.active ? '無効化' : '有効化'}</button>
        </div>`
        )
        .join('')}
      <form id="add-chore-form" class="admin-row">
        <input name="name" placeholder="新しいお手伝いの名前" style="flex:1; width:auto;" required />
        <input name="points" type="number" min="1" placeholder="pt" required />
        <button type="submit">追加</button>
      </form>
    </div>
    <div class="section-title">交換メニュー</div>
    <div class="card">
      ${options
        .map(
          (o) => `
        <div class="admin-row">
          <span style="flex:1;">${o.name}（${o.type === 'cash' ? '現金' : 'ゲーム時間'} ${o.value}${o.type === 'cash' ? '円' : '分'}）${o.active ? '' : '（無効）'}</span>
          <input type="number" min="1" value="${o.points_cost}" data-option-cost="${o.id}" />
          <button data-toggle-option="${o.id}" data-active="${o.active}" class="secondary">${o.active ? '無効化' : '有効化'}</button>
        </div>`
        )
        .join('')}
      <form id="add-option-form" class="admin-row">
        <input name="name" placeholder="名前 (例: 現金 300円)" style="flex:1; width:auto;" required />
        <select name="type">
          <option value="cash">現金</option>
          <option value="game_time">ゲーム時間</option>
        </select>
        <input name="value" type="number" min="1" placeholder="円 or 分" required />
        <input name="points_cost" type="number" min="1" placeholder="pt" required />
        <button type="submit">追加</button>
      </form>
    </div>
  `;

  container.querySelectorAll('[data-chore-points]').forEach((input) => {
    input.addEventListener('change', async () => {
      try {
        await api(`/chore-types/${input.dataset.chorePoints}`, { method: 'PUT', body: { points: Number(input.value) } });
      } catch (err) {
        alert(err.message);
        render();
      }
    });
  });

  container.querySelectorAll('[data-toggle-chore]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const active = btn.dataset.active === '1' || btn.dataset.active === 'true';
      await api(`/chore-types/${btn.dataset.toggleChore}`, { method: 'PUT', body: { active: !active } });
      render();
    });
  });

  container.querySelectorAll('[data-option-cost]').forEach((input) => {
    input.addEventListener('change', async () => {
      try {
        await api(`/redemption-options/${input.dataset.optionCost}`, { method: 'PUT', body: { points_cost: Number(input.value) } });
      } catch (err) {
        alert(err.message);
        render();
      }
    });
  });

  container.querySelectorAll('[data-toggle-option]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const active = btn.dataset.active === '1' || btn.dataset.active === 'true';
      await api(`/redemption-options/${btn.dataset.toggleOption}`, { method: 'PUT', body: { active: !active } });
      render();
    });
  });

  container.querySelector('#add-chore-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    try {
      await api('/chore-types', { method: 'POST', body: { name: form.name.value, points: Number(form.points.value) } });
      render();
    } catch (err) {
      alert(err.message);
    }
  });

  container.querySelector('#add-option-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    try {
      await api('/redemption-options', {
        method: 'POST',
        body: {
          name: form.name.value,
          type: form.type.value,
          value: Number(form.value.value),
          points_cost: Number(form.points_cost.value),
        },
      });
      render();
    } catch (err) {
      alert(err.message);
    }
  });
}

async function render() {
  if (!state.me) {
    renderLogin();
    return;
  }

  app.innerHTML =
    renderTopbar() +
    (state.me.role === 'parent' ? renderParentTabs() : renderChildTabs()) +
    '<div id="tab-content"></div>';
  document.getElementById('logout-btn').addEventListener('click', handleLogout);
  document.querySelectorAll('[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => setTab(btn.dataset.tab));
  });

  const container = document.getElementById('tab-content');
  try {
    if (state.me.role === 'parent') {
      if (state.tab === 'approve') await renderParentApproveTab(container);
      else if (state.tab === 'balances') await renderParentBalancesTab(container);
      else if (state.tab === 'settings') await renderParentSettingsTab(container);
    } else {
      if (state.tab === 'chores') await renderChildChoresTab(container);
      else if (state.tab === 'redeem') await renderChildRedeemTab(container);
      else if (state.tab === 'history') await renderChildHistoryTab(container);
    }
  } catch (err) {
    container.innerHTML = `<div class="error">${err.message}</div>`;
  }
}

init();
