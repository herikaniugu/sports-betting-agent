let lastUpdatedAt = null;
let dataBusy = false;
let snapshotSignature = null;

const AUTO_INTERVAL_MS = 15 * 1000;
let autoTimer = null;

function setDataStatus(text, mode) {
  els.dataStatusText.textContent = text;
  els.dataStatus.title = text;
  els.dataStatus.classList.toggle('error', mode === 'error');
}

function relativeTime(timestamp) {
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return minutes + (minutes === 1 ? ' minute ago' : ' minutes ago');
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours + (hours === 1 ? ' hour ago' : ' hours ago');
  const days = Math.round(hours / 24);
  return days + (days === 1 ? ' day ago' : ' days ago');
}

async function fetchSnapshot() {
  const response = await fetch('/api/data', { cache: 'no-store' });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok || typeof result.updatedAt !== 'string' || !Array.isArray(result.matches)) {
    throw new Error('Invalid API snapshot');
  }
  return result;
}

function applySnapshot(next) {
  MATCHES = next.matches;
  initLeagues();
  renderAll();
}

async function applyFreshData() {
  if (dataBusy) return;
  dataBusy = true;
  setDataStatus('Auto · updating…');
  try {
    const snapshot = await fetchSnapshot();
    if (snapshot.updatedAt !== snapshotSignature) {
      snapshotSignature = snapshot.updatedAt;
      applySnapshot(snapshot);
    }
    lastUpdatedAt = Date.parse(snapshot.updatedAt) || Date.now();
    els.dataStatus.classList.remove('error');
  } catch {
    setDataStatus('Auto · update failed', 'error');
  } finally {
    dataBusy = false;
    refreshLastUpdated();
  }
}

function refreshLastUpdated() {
  updateAdvisorHeader();
  if (!lastUpdatedAt || dataBusy || els.dataStatus.classList.contains('error')) return;
  setDataStatus('Auto · last updated ' + relativeTime(lastUpdatedAt));
}

function startAuto() {
  clearInterval(autoTimer);
  autoTimer = setInterval(applyFreshData, AUTO_INTERVAL_MS);
}

async function bootstrap() {
  const started = Date.now();
  els.splashText.textContent = 'Loading latest odds…';
  setDataStatus('Auto · loading');
  await applyFreshData();
  startAuto();
  setTimeout(() => { els.splash.hidden = true; }, Math.max(0, 350 - (Date.now() - started)));
}

setInterval(refreshLastUpdated, 30000);
