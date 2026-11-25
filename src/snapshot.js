let lastUpdatedAt = null;
let dataBusy = false;

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

async function loadLastUpdated() {
  if (STATIC_MODE) return;
  try {
    const response = await fetch('/api/last-update', { cache: 'no-store' });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) return;
    lastUpdatedAt = Date.parse(result.updatedAt);
    if (!Number.isNaN(lastUpdatedAt)) refreshLastUpdated();
  } catch {
    setDataStatus('Auto · waiting to update');
  }
}

const AUTO_INTERVAL_MS = 15 * 1000;
const STATIC_POLL_MS = 15 * 1000;
let autoTimer = null;
let staticPollTimer = null;
let staticPollBusy = false;
let staticSnapshotSignature = null;

function loadSnapshotScript() {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'data.js?t=' + Date.now();
    script.onload = () => {
      script.remove();
      const updatedAt = window.SNAPSHOT_UPDATED_AT;
      const matches = window.MATCHES;
      if (typeof updatedAt !== 'string' || !Array.isArray(matches)) {
        reject(new Error('Invalid data file'));
        return;
      }
      resolve({ updatedAt, matches });
    };
    script.onerror = () => {
      script.remove();
      reject(new Error('Could not reload data'));
    };
    document.head.appendChild(script);
  });
}

async function loadSnapshot() {
  return (await loadSnapshotScript()).matches;
}

async function loadApiSnapshot() {
  const response = await fetch('/api/data', { cache: 'no-store' });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok || typeof result.updatedAt !== 'string' || !Array.isArray(result.matches)) {
    throw new Error('Invalid API snapshot');
  }
  return result;
}

function mergeApiMatches(fresh) {
  const preserved = MATCHES.filter(match => {
    const phase = match.phase || 'today';
    return phase !== 'today' && phase !== 'live';
  });
  const seen = new Set();
  return fresh.concat(preserved).filter(match => {
    const key = match.id + '|' + match.sport + '|' + (match.phase || 'today');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function pollApiSnapshot() {
  const snapshot = await loadApiSnapshot();
  if (snapshot.updatedAt === staticSnapshotSignature) {
    refreshLastUpdated();
    return;
  }
  staticSnapshotSignature = snapshot.updatedAt;
  applySnapshot(mergeApiMatches(snapshot.matches));
  lastUpdatedAt = Date.parse(snapshot.updatedAt) || Date.now();
  els.dataStatus.classList.remove('error');
  refreshLastUpdated();
}

async function pollDataSnapshotScript() {
  const snapshot = await loadSnapshotScript();
  if (snapshot.updatedAt === staticSnapshotSignature) {
    refreshLastUpdated();
    return;
  }
  staticSnapshotSignature = snapshot.updatedAt;
  applySnapshot(snapshot.matches);
  lastUpdatedAt = Date.parse(snapshot.updatedAt) || Date.now();
  els.dataStatus.classList.remove('error');
  refreshLastUpdated();
}

async function pollStaticSnapshot() {
  if (staticPollBusy) return;
  staticPollBusy = true;
  try {
    if (STATIC_API_MODE) {
      try {
        await pollApiSnapshot();
        return;
      } catch {}
    }
    await pollDataSnapshotScript();
  } catch {
    setDataStatus('Static snapshot', 'error');
  } finally {
    staticPollBusy = false;
  }
}

function startStaticPolling() {
  clearInterval(staticPollTimer);
  staticPollTimer = setInterval(pollStaticSnapshot, STATIC_POLL_MS);
  if (STATIC_API_MODE) setTimeout(pollStaticSnapshot, 50);
}

function applySnapshot(next) {
  MATCHES = next;
  initLeagues();
  renderAll();
}

async function applyFreshData() {
  if (STATIC_MODE || dataBusy) return;
  try {
    const statusResponse = await fetch('/api/status', { cache: 'no-store' });
    const status = await statusResponse.json().catch(() => ({}));
    if (status.ok && status.updating) {
      setDataStatus('Auto · update in progress');
      return;
    }
  } catch {}
  dataBusy = true;
  setDataStatus('Auto updating…');
  try {
    const response = await fetch('/api/update-data', { method: 'POST', cache: 'no-store' });
    if (response.status === 409) {
      setDataStatus('Auto · startup update in progress');
      return;
    }
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) throw new Error(result.error || 'HTTP ' + response.status);
    applySnapshot(await loadSnapshot());
    lastUpdatedAt = Date.parse(result.updatedAt) || Date.now();
    dataBusy = false;
    els.dataStatus.classList.remove('error');
    refreshLastUpdated();
  } catch {
    setDataStatus('Update failed', 'error');
  } finally {
    dataBusy = false;
  }
}

function refreshLastUpdated() {
  updateAdvisorHeader();
  if (!lastUpdatedAt || dataBusy || els.dataStatus.classList.contains('error')) return;
  const label = STATIC_API_MODE ? 'Live static' : STATIC_MODE ? 'Static' : 'Auto';
  setDataStatus(label + ' · last updated ' + relativeTime(lastUpdatedAt));
}

function startAuto() {
  if (STATIC_MODE) {
    startStaticPolling();
    return;
  }
  clearInterval(autoTimer);
  autoTimer = setInterval(applyFreshData, AUTO_INTERVAL_MS);
}

async function bootstrap() {
  const started = Date.now();
  if (STATIC_MODE) {
    els.splashText.textContent = 'Loading saved snapshot…';
    staticSnapshotSignature = typeof window.SNAPSHOT_UPDATED_AT === 'string' ? window.SNAPSHOT_UPDATED_AT : null;
    const snapshotTime = Date.parse(staticSnapshotSignature);
    if (!Number.isNaN(snapshotTime)) lastUpdatedAt = snapshotTime;
    els.dataStatus.classList.remove('error');
    if (lastUpdatedAt) refreshLastUpdated();
    else setDataStatus(STATIC_API_MODE ? 'Live static snapshot' : 'Static snapshot');
    startStaticPolling();
    setTimeout(() => { els.splash.hidden = true; }, Math.max(0, 350 - (Date.now() - started)));
    return;
  }
  els.splashText.textContent = 'Loading latest odds…';
  try {
    const response = await fetch('/api/bootstrap', { cache: 'no-store' });
    const result = await response.json().catch(() => ({}));
    if (response.ok && result.ok) {
      els.splashText.textContent = 'Applying live snapshot…';
      applySnapshot(await loadSnapshot());
      lastUpdatedAt = Date.parse(result.updatedAt) || Date.now();
      els.dataStatus.classList.remove('error');
      refreshLastUpdated();
    } else {
      els.splashText.textContent = 'Using cached odds…';
      await loadLastUpdated();
      setDataStatus('Using cached snapshot', 'error');
    }
  } catch {
    els.splashText.textContent = 'Using cached odds…';
    setDataStatus('Using cached snapshot', 'error');
  } finally {
    startAuto();
    setTimeout(() => { els.splash.hidden = true; }, Math.max(0, 350 - (Date.now() - started)));
  }
}

setInterval(refreshLastUpdated, 30000);
