const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
  tg.setHeaderColor('#040406');
  tg.setBackgroundColor('#040406');
}

const params = new URLSearchParams(window.location.search);
const rawRole = params.get('role');
let role = (rawRole === 'admin' || rawRole === 'approver') ? rawRole : 'driver';
const LOGIN_CODES = {
  admin: 'admin123',
  approver: 'approver123'
};
const apiBase = (params.get('apiBase') || '').trim().replace(/\/$/, '');

const state = {
  balance: 1120,
  tripCount: 10,
  tripsPerRoll: 10,
  spinning: false,
  rotation: 0,
  missions: [
    { title: 'Drive 50km', done: 32, total: 50, xp: 120 },
    { title: 'Complete 12 trips', done: 7, total: 12, xp: 90 },
    { title: 'Maintain 4.8 rating', done: 48, total: 50, xp: 60 }
  ],
  docs: [
    { name: 'Driver License', status: 'verified' },
    { name: 'Libre', status: 'missing' },
    { name: 'Business License', status: 'verified' }
  ]
};

const els = {
  balance: document.getElementById('balanceEtb'),
  missionList: document.getElementById('missionList'),
  tripCount: document.getElementById('tripCount'),
  tripBar: document.getElementById('tripBar'),
  addTripBtn: document.getElementById('addTripBtn'),
  wheel: document.getElementById('wheel'),
  spinBtn: document.getElementById('spinBtn'),
  spinResult: document.getElementById('spinResult'),
  clearanceList: document.getElementById('clearanceList'),
  loginOverlay: document.getElementById('loginOverlay'),
  loginBtn: document.getElementById('loginBtn'),
  loginCode: document.getElementById('loginCode'),
  loginHint: document.getElementById('loginHint'),
  logoutBtn: document.getElementById('logoutBtn')
};

function canApprove() {
  return role === 'admin' || role === 'approver';
}

function applyRoleUI() {
  document.body.classList.toggle('role-admin', canApprove());
  document.querySelector('h1').textContent =
    role === 'admin' ? 'Admin Console' : (role === 'approver' ? 'Approver Console' : 'Driver Console');
}

const multipliers = [1.0, 1.2, 1.5, 2.0, 0.8, 3.0];

function loadState() {
  try {
    const raw = window.localStorage.getItem('cradleMiniState');
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (typeof parsed.balance === 'number') state.balance = parsed.balance;
    if (typeof parsed.tripCount === 'number') state.tripCount = parsed.tripCount;
    if (typeof parsed.rotation === 'number') state.rotation = parsed.rotation;
  } catch (_) {}
  try {
    const authRaw = window.sessionStorage.getItem('cradleMiniAuth');
    if (authRaw) {
      const parsed = JSON.parse(authRaw);
      if (parsed && (parsed.role === 'driver' || parsed.role === 'approver' || parsed.role === 'admin')) {
        role = parsed.role;
      }
    }
  } catch (_) {}
}

function saveState() {
  window.localStorage.setItem(
    'cradleMiniState',
    JSON.stringify({
      balance: state.balance,
      tripCount: state.tripCount,
      rotation: state.rotation
    })
  );
}

function saveAuth() {
  window.sessionStorage.setItem(
    'cradleMiniAuth',
    JSON.stringify({ role })
  );
}

function clearAuth() {
  window.sessionStorage.removeItem('cradleMiniAuth');
}

function etb(v) {
  return `ETB ${v.toFixed(2)}`;
}

function renderMissions() {
  els.missionList.innerHTML = '';
  for (const m of state.missions) {
    const pct = Math.max(0, Math.min(100, (m.done / m.total) * 100));
    const node = document.createElement('div');
    node.className = 'mission';
    node.innerHTML = `
      <h4>${m.title}</h4>
      <div class="bar"><div class="bar-fill" style="width:${pct}%"></div></div>
      <div class="mission-row"><span>${m.done}/${m.total}</span><span>${m.xp} XP</span></div>
    `;
    els.missionList.appendChild(node);
  }
}

function renderTrips() {
  els.tripCount.textContent = String(state.tripCount);
  const pct = Math.min(100, (state.tripCount / state.tripsPerRoll) * 100);
  els.tripBar.style.width = `${pct}%`;
  const eligible = state.tripCount >= state.tripsPerRoll;
  els.spinBtn.disabled = !eligible || state.spinning;
  els.spinBtn.textContent = state.spinning ? 'ROLLING...' : (eligible ? 'ROLL' : `LOCKED ${state.tripCount}/${state.tripsPerRoll}`);
}

function renderBalance() {
  els.balance.textContent = etb(state.balance);
}

function renderDocs() {
  els.clearanceList.innerHTML = '';
  for (const doc of state.docs) {
    const ok = doc.status === 'verified';
    const item = document.createElement('div');
    item.className = 'clearance-item';
    item.innerHTML = `
      <div class="clearance-row">
        <strong>${doc.name}</strong>
        <span class="tag ${ok ? 'ok' : 'missing'}">${ok ? 'Verified' : 'Missing'}</span>
      </div>
    `;
    els.clearanceList.appendChild(item);
  }
}

function switchView(view) {
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  const next = document.querySelector(`#view-${view}`);
  if (next) next.classList.add('active');
  document.querySelectorAll('.nav-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.view === view);
  });
}

function spinWheel() {
  if (state.spinning) return;
  if (state.tripCount < state.tripsPerRoll) {
    els.spinResult.textContent = `Need ${state.tripsPerRoll - state.tripCount} more trips`;
    if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('warning');
    return;
  }

  state.spinning = true;
  renderTrips();
  els.spinResult.textContent = 'Spinning...';
  const index = Math.floor(Math.random() * multipliers.length);
  const multiplier = multipliers[index];
  const segment = 360 / multipliers.length;
  const target = 360 * 6 + (360 - (index * segment + segment / 2));

  state.rotation += target;
  els.wheel.style.transform = `rotate(${state.rotation}deg)`;

  window.setTimeout(() => {
    const reward = 40 * multiplier;
    state.balance += reward;
    state.tripCount -= state.tripsPerRoll;
    renderBalance();
    state.spinning = false;
    renderTrips();
    els.spinResult.textContent = `Win x${multiplier.toFixed(1)} -> +${etb(reward)}`;
    saveState();
    if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
  }, 4900);
}

function initNav() {
  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });
}

function initActions() {
  els.addTripBtn.addEventListener('click', () => {
    state.tripCount = Math.min(50, state.tripCount + 1);
    renderTrips();
    saveState();
  });
  els.spinBtn.addEventListener('click', spinWheel);

  document.querySelectorAll('.quick-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;

      if (action === 'upload') {
        switchView('tasks');
        if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
        return;
      }
      if (action === 'rewards') {
        switchView('rewards');
        return;
      }
      if (action === 'wallet') {
        switchView('home');
        els.spinResult.textContent = `Wallet balance: ${etb(state.balance)}`;
        return;
      }
      if (action === 'profile') {
        switchView('profile');
        return;
      }
      if (action === 'topup') {
        const value = window.prompt('Top up amount in ETB (demo):', '100');
        if (!value) return;
        const amount = Number(value);
        if (!Number.isFinite(amount) || amount <= 0) {
          window.alert('Invalid amount');
          return;
        }
        const telegramId = tg?.initDataUnsafe?.user?.id || 0;
        if (!apiBase || !telegramId) {
          state.balance += amount;
          renderBalance();
          saveState();
          els.spinResult.textContent = `Top-up success: +${etb(amount)} (demo)`;
          if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
          return;
        }

        const payload = {
          telegram_id: Number(telegramId),
          amount_etb: amount,
          title: 'Cradle Wallet Top Up'
        };
        fetch(`${apiBase}/api/topup/initiate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
          .then((r) => r.json())
          .then((data) => {
            if (!data.reference) {
              throw new Error(data.detail || 'Failed to start top-up');
            }
            if (data.checkout_url) {
              if (tg?.openLink) tg.openLink(data.checkout_url);
              else window.open(data.checkout_url, '_blank');
            }
            let attempts = 0;
            const timer = setInterval(() => {
              attempts += 1;
              fetch(`${apiBase}/api/topup/status/${data.reference}`)
                .then((r) => r.json())
                .then((s) => {
                  if (s.status === 'successful') {
                    state.balance += amount;
                    renderBalance();
                    saveState();
                    els.spinResult.textContent = `Top-up success: +${etb(amount)}`;
                    clearInterval(timer);
                    if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
                  } else if (s.status === 'failed') {
                    els.spinResult.textContent = `Top-up failed: ${s.failure_reason || 'provider rejected'}`;
                    clearInterval(timer);
                    if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('error');
                  } else if (attempts >= 30) {
                    els.spinResult.textContent = 'Top-up pending confirmation...';
                    clearInterval(timer);
                  }
                })
                .catch(() => {
                  if (attempts >= 30) {
                    clearInterval(timer);
                  }
                });
            }, 3000);
          })
          .catch((err) => {
            window.alert(`Top-up init error: ${err.message}`);
          });
        return;
      }
      if (action === 'support') {
        window.alert('Support: @cradlepartnersupport | 0924470000');
        return;
      }
      if (action === 'faq') {
        window.alert('FAQ:\\n1) Upload docs\\n2) Wait approval\\n3) Use rewards and top-up');
        return;
      }
      if (action === 'approve') {
        if (!canApprove()) {
          window.alert('Admin only');
          return;
        }
        switchView('profile');
        if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
      }
    });
  });

  els.logoutBtn?.addEventListener('click', () => {
    clearAuth();
    role = 'driver';
    applyRoleUI();
    els.loginCode.value = '';
    els.loginHint.textContent = 'Demo codes: approver123, admin123';
    els.loginOverlay.classList.remove('hidden');
  });
}

function initLogin() {
  const roleBtns = Array.from(document.querySelectorAll('.login-role-btn'));
  let selectedRole = role;

  const activate = (nextRole) => {
    selectedRole = nextRole;
    roleBtns.forEach((btn) => btn.classList.toggle('active', btn.dataset.role === nextRole));
    if (nextRole === 'driver') {
      els.loginHint.textContent = 'Driver role does not require passcode.';
    } else if (nextRole === 'approver') {
      els.loginHint.textContent = 'Approver demo code: approver123';
    } else {
      els.loginHint.textContent = 'Admin demo code: admin123';
    }
  };

  roleBtns.forEach((btn) => {
    btn.addEventListener('click', () => activate(btn.dataset.role));
  });
  activate(selectedRole);

  const completeLogin = () => {
    const code = (els.loginCode.value || '').trim();
    if (selectedRole !== 'driver' && code !== LOGIN_CODES[selectedRole]) {
      els.loginHint.textContent = 'Invalid passcode.';
      if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('error');
      return;
    }
    role = selectedRole;
    saveAuth();
    applyRoleUI();
    els.loginOverlay.classList.add('hidden');
    if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
  };

  els.loginBtn.addEventListener('click', completeLogin);
  els.loginCode.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') completeLogin();
  });

  if (window.sessionStorage.getItem('cradleMiniAuth')) {
    applyRoleUI();
    els.loginOverlay.classList.add('hidden');
  } else {
    els.loginOverlay.classList.remove('hidden');
  }
}

loadState();
applyRoleUI();
els.wheel.style.transform = `rotate(${state.rotation}deg)`;
renderBalance();
renderMissions();
renderTrips();
renderDocs();
initNav();
initActions();
initLogin();
