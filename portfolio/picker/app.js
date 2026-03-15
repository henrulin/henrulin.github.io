// ── Config ──────────────────────────────────────────────
const MODES = {
  powerball: {
    label: 'Powerball',
    mainCount: 7,
    mainMax: 35,
    hasPowerball: true,
    pbMax: 20,
  },
  ozlotto: {
    label: 'Oz Lotto',
    mainCount: 7,
    mainMax: 47,
    hasPowerball: false,
  },
};

const MAX_SAVED = 50;

// ── State ────────────────────────────────────────────────
let currentMode = 'powerball';
let selectedMain = new Set();
let selectedPb = null;
let savedPicks = [];          // [{mode, main:[...], pb:n|null}]
let historyOpen = false;

// ── DOM refs ─────────────────────────────────────────────
const numbersLayer  = document.getElementById('numbers-layer');
const selectedRow   = document.getElementById('selected-row');
const statusText    = document.getElementById('status-text');
const countDisplay  = document.getElementById('count-display');
const clearBtn      = document.getElementById('clear-btn');
const saveBtn       = document.getElementById('save-btn');
const canvas        = document.getElementById('blob-canvas');
const ctx           = canvas.getContext('2d');

const historyPanel  = document.getElementById('history-panel');
const historyToggle = document.getElementById('history-toggle');
const historyList   = document.getElementById('history-list');
const historyCount  = document.getElementById('history-count');
const exportBtn     = document.getElementById('export-btn');
const clearAllBtn   = document.getElementById('clear-all-btn');

// ── Blob background animation ─────────────────────────────
let blobT = 0;

function resizeCanvas() {
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width  = rect.width;
  canvas.height = rect.height;
}

function drawBlob() {
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2;
  const baseR = Math.min(w, h) * 0.38;

  ctx.save();
  ctx.beginPath();

  const pts = 7;
  for (let i = 0; i <= pts * 3; i++) {
    const angle = (i / pts) * Math.PI * 2;
    const wobble = 0.08;
    const r = baseR * (
      1
      + wobble * Math.sin(blobT * 0.7 + i * 1.3)
      + wobble * 0.5 * Math.cos(blobT * 0.4 + i * 2.1)
    );
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }

  ctx.closePath();

  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseR * 1.1);
  grad.addColorStop(0,   'rgba(100, 130, 255, 0.07)');
  grad.addColorStop(0.5, 'rgba(80,  100, 220, 0.04)');
  grad.addColorStop(1,   'rgba(60,  80,  200, 0.00)');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.restore();

  blobT += 0.008;
  requestAnimationFrame(drawBlob);
}

// ── Organic number placement ──────────────────────────────
function placeNumbers(n, containerW, containerH) {
  const isMobile = window.innerWidth <= 430;
  const cx = containerW / 2;
  const cy = containerH / 2;
  
  // Ellipse ratios per spec (Tier 1 vs Tier 2)
  const rx = containerW * (isMobile ? 0.49 : 0.44);
  const ry = containerH * (isMobile ? 0.49 : 0.46);
  
  // Read ball radius from computed style (CSS variable --num-size)
  const computedStyle = getComputedStyle(document.documentElement);
  const numSizePx = parseFloat(computedStyle.getPropertyValue('--num-size')) || 44;
  const ballR = numSizePx / 2;
  
  // Min distance buffer: Tier 1 (+5px), Tier 2 (+2px)
  const buffer = isMobile ? 2 : 5;
  const minDist = ballR * 2 + buffer;

  const positions = [];
  const maxAttempts = isMobile ? 2000 : 1000;

  function randInEllipse() {
    const angle = Math.random() * Math.PI * 2;
    const t = Math.sqrt(Math.random());
    return {
      x: cx + rx * t * Math.cos(angle),
      y: cy + ry * t * Math.sin(angle),
    };
  }

  for (let i = 0; i < n; i++) {
    let accepted = false;
    for (let a = 0; a < maxAttempts && !accepted; a++) {
      const p = randInEllipse();
      let ok = true;
      for (const q of positions) {
        const dx = p.x - q.x;
        const dy = p.y - q.y;
        if (Math.sqrt(dx * dx + dy * dy) < minDist) { ok = false; break; }
      }
      if (ok) { positions.push(p); accepted = true; }
    }
    if (!accepted) positions.push(randInEllipse());
  }

  return positions;
}

// ── Render the main number cloud ──────────────────────────
function renderNumbers() {
  numbersLayer.innerHTML = '';
  const cfg = MODES[currentMode];
  const containerRect = numbersLayer.getBoundingClientRect();
  const W = containerRect.width  || canvas.width;
  const H = containerRect.height || canvas.height;

  const mainFull   = selectedMain.size >= cfg.mainCount;
  const totalBalls = cfg.mainMax + (cfg.hasPowerball ? cfg.pbMax : 0);
  const positions  = placeNumbers(totalBalls, W, H);

  // ── Main balls
  for (let n = 1; n <= cfg.mainMax; n++) {
    const pos = positions[n - 1];
    if (!pos) continue;

    const el = document.createElement('div');
    el.classList.add('num-ball');
    el.textContent = n;
    el.style.left = pos.x + 'px';
    el.style.top  = pos.y + 'px';

    const delay = (Math.random() * 4).toFixed(2);
    const dur   = (5 + Math.random() * 3).toFixed(2);
    el.style.animationDelay    = `-${delay}s`;
    el.style.animationDuration = `${dur}s`;

    if (selectedMain.has(n)) {
      el.classList.add('selected');
    } else if (mainFull) {
      el.classList.add('disabled');
    }

    el.addEventListener('click', () => toggleMain(n, cfg));
    numbersLayer.appendChild(el);
  }

  // ── Powerball balls (invisible until main is complete)
  if (cfg.hasPowerball) {
    for (let n = 1; n <= cfg.pbMax; n++) {
      const pos = positions[cfg.mainMax + n - 1];
      if (!pos) continue;

      const el = document.createElement('div');
      el.classList.add('num-ball', 'pb-ball-cloud');
      el.textContent = n;
      el.style.left = pos.x + 'px';
      el.style.top  = pos.y + 'px';

      const delay = (Math.random() * 4).toFixed(2);
      const dur   = (5 + Math.random() * 3).toFixed(2);
      el.style.animationDelay    = `-${delay}s`;
      el.style.animationDuration = `${dur}s`;

      if (selectedPb === n) {
        el.classList.add('selected');
      } else if (!mainFull) {
        el.classList.add('pb-pending'); // fully invisible
      }

      if (mainFull && selectedPb !== null && selectedPb !== n) {
        el.classList.add('disabled');
      }

      el.addEventListener('click', () => {
        if (!mainFull) return;
        togglePb(n);
      });

      numbersLayer.appendChild(el);
    }
  }
}

// ── Toggle main number ────────────────────────────────────
function toggleMain(n, cfg) {
  if (selectedMain.has(n)) {
    selectedMain.delete(n);
  } else {
    if (selectedMain.size >= cfg.mainCount) return;
    selectedMain.add(n);
  }
  renderNumbers();
  updateUI();
}

// ── Toggle Powerball ──────────────────────────────────────
function togglePb(n) {
  selectedPb = (selectedPb === n) ? null : n;
  renderNumbers();
  updateUI();
}

// ── Check if current pick is complete ─────────────────────
function isPickComplete() {
  const cfg = MODES[currentMode];
  const mainOk = selectedMain.size >= cfg.mainCount;
  const pbOk   = !cfg.hasPowerball || selectedPb !== null;
  return mainOk && pbOk;
}

// ── Save current pick ─────────────────────────────────────
function savePick() {
  if (!isPickComplete()) return;
  if (savedPicks.length >= MAX_SAVED) return;

  savedPicks.unshift({
    mode: currentMode,
    main: [...selectedMain].sort((a, b) => a - b),
    pb:   selectedPb,
  });

  // Reset current pick
  selectedMain.clear();
  selectedPb = null;
  renderNumbers();
  updateUI();
  renderHistory();

  // Auto-open history on first save
  if (savedPicks.length === 1 && !historyOpen) toggleHistory();
}

// ── Remove a saved pick ───────────────────────────────────
function removePick(idx) {
  savedPicks.splice(idx, 1);
  renderHistory();
}

// ── Clear all saved picks ─────────────────────────────────
function clearAll() {
  savedPicks = [];
  renderHistory();
}

// ── Export history as markdown ────────────────────────────
function exportHistory() {
  if (savedPicks.length === 0) return;
  
  let mdContent = '# Numbers · Saved Picks\n\n';
  
  savedPicks.forEach((pick, idx) => {
    const pickNum = savedPicks.length - idx;
    const modeLabel = MODES[pick.mode].label;
    const mainStr = pick.main.join(', ');
    
    mdContent += `### Pick ${pickNum}: ${modeLabel}\n`;
    mdContent += `- Main Numbers: **${mainStr}**\n`;
    if (pick.pb !== null) {
      mdContent += `- Powerball: **${pick.pb}**\n`;
    }
    mdContent += '\n';
  });

  const blob = new Blob([mdContent], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  a.download = `numbers-picks-${yyyy}-${mm}-${dd}.md`;
  
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Render history list ───────────────────────────────────
function renderHistory() {
  historyCount.textContent = savedPicks.length;
  historyList.innerHTML = '';

  if (savedPicks.length === 0) {
    const empty = document.createElement('div');
    empty.classList.add('history-empty');
    empty.textContent = 'No picks saved yet';
    historyList.appendChild(empty);
    return;
  }

  savedPicks.forEach((pick, idx) => {
    const row = document.createElement('div');
    row.classList.add('history-row');

    const chips = document.createElement('div');
    chips.classList.add('history-chips');

    pick.main.forEach(n => {
      const chip = document.createElement('div');
      chip.classList.add('history-chip', 'main');
      chip.textContent = n;
      chips.appendChild(chip);
    });

    if (pick.pb !== null) {
      const sep = document.createElement('span');
      sep.classList.add('history-sep');
      sep.textContent = '·';
      chips.appendChild(sep);

      const chip = document.createElement('div');
      chip.classList.add('history-chip', 'pb');
      chip.textContent = pick.pb;
      chips.appendChild(chip);
    }

    const removeBtn = document.createElement('button');
    removeBtn.classList.add('history-remove');
    removeBtn.textContent = '×';
    removeBtn.title = 'Remove';
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      removePick(idx);
    });

    row.appendChild(chips);
    row.appendChild(removeBtn);
    historyList.appendChild(row);
  });
}

// ── Toggle history open/closed ────────────────────────────
function toggleHistory() {
  historyOpen = !historyOpen;
  historyPanel.classList.toggle('open', historyOpen);
}

// ── Update current-pick UI ────────────────────────────────
function updateUI() {
  const cfg = MODES[currentMode];
  const mainArr  = [...selectedMain].sort((a, b) => a - b);
  const total    = cfg.mainCount;
  const mainFull = mainArr.length >= total;

  countDisplay.textContent = `${mainArr.length} / ${total}`;

  if (!mainFull) {
    statusText.textContent = 'Choose your numbers — trust what resonates';
  } else if (cfg.hasPowerball && selectedPb === null) {
    statusText.textContent = 'Now feel into the Powerball ✦';
  } else {
    statusText.textContent = 'Your numbers are set ✦';
  }

  // Save button enabled state
  const complete = isPickComplete();
  const atMax    = savedPicks.length >= MAX_SAVED;
  saveBtn.disabled = !complete || atMax;

  // Chips
  selectedRow.innerHTML = '';
  if (mainArr.length === 0 && selectedPb === null) {
    const ph = document.createElement('span');
    ph.classList.add('sel-placeholder');
    ph.textContent = 'Your picks will appear here';
    selectedRow.appendChild(ph);
    return;
  }

  mainArr.forEach(n => {
    const chip = document.createElement('div');
    chip.classList.add('sel-chip', 'main');
    chip.textContent = n;
    selectedRow.appendChild(chip);
  });

  if (cfg.hasPowerball && selectedPb !== null) {
    const sep = document.createElement('span');
    sep.style.cssText = 'color:rgba(255,255,255,0.15);font-size:18px;line-height:1;padding:0 4px;align-self:center;';
    sep.textContent = '·';
    selectedRow.appendChild(sep);

    const chip = document.createElement('div');
    chip.classList.add('sel-chip', 'pb');
    chip.textContent = selectedPb;
    selectedRow.appendChild(chip);
  }
}

// ── Buttons ───────────────────────────────────────────────
saveBtn.addEventListener('click', savePick);

clearBtn.addEventListener('click', () => {
  selectedMain.clear();
  selectedPb = null;
  renderNumbers();
  updateUI();
});

historyToggle.addEventListener('click', (e) => {
  // Don't toggle if clicking clear-all or export
  const isActionBtn = e.target === clearAllBtn || clearAllBtn.contains(e.target) || 
                      e.target === exportBtn || exportBtn.contains(e.target);
  if (isActionBtn) return;
  toggleHistory();
});

exportBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  exportHistory();
});

clearAllBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  clearAll();
});

// ── Mode switch ───────────────────────────────────────────
document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.dataset.mode === currentMode) return;
    currentMode = btn.dataset.mode;
    selectedMain.clear();
    selectedPb = null;
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderNumbers();
    updateUI();
  });
});

// ── Init & resize ─────────────────────────────────────────
function init() {
  resizeCanvas();
  renderNumbers();
  renderHistory();
  updateUI();
  drawBlob();
}

window.addEventListener('resize', () => {
  resizeCanvas();
  renderNumbers();
});

init();
