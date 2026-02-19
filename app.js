const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
  tg.setHeaderColor('#040406');
  tg.setBackgroundColor('#040406');
}

const state = {
  balance: 1120,
  tripCount: 3,
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
    els.spinResult.textContent = 'Need more trips to unlock roll';
    return;
  }

  state.spinning = true;
  const multipliers = [1.0, 1.2, 1.5, 2.0, 0.8, 3.0];
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
    renderTrips();
    els.spinResult.textContent = `Win x${multiplier.toFixed(1)} -> +${etb(reward)}`;
    state.spinning = false;
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
  });
  els.spinBtn.addEventListener('click', spinWheel);
}

renderBalance();
renderMissions();
renderTrips();
renderDocs();
initNav();
initActions();
