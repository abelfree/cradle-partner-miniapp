const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
  tg.setHeaderColor('#040406');
  tg.setBackgroundColor('#040406');
}

const params = new URLSearchParams(window.location.search);
const role = params.get('role') === 'admin' ? 'admin' : 'driver';
if (role === 'admin') {
  document.body.classList.add('role-admin');
}

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
  clearanceList: document.getElementById('clearanceList')
};

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
        state.balance += amount;
        renderBalance();
        saveState();
        els.spinResult.textContent = `Top-up success: +${etb(amount)}`;
        if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
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
        if (role !== 'admin') {
          window.alert('Admin only');
          return;
        }
        switchView('profile');
        if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
      }
    });
  });
}

loadState();
els.wheel.style.transform = `rotate(${state.rotation}deg)`;
renderBalance();
renderMissions();
renderTrips();
renderDocs();
initNav();
initActions();
