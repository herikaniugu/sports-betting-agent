document.addEventListener('input', event => {
  if (event.target.matches('input[type="range"]')) syncRangeFill(event.target);
});

els.minOdds.addEventListener('input', event => {
  state.minOdds = Number(event.target.value);
  els.minOddsValue.textContent = dec(state.minOdds);
  renderMatches();
  renderPicks();
});

els.minProb.addEventListener('input', event => {
  state.minProb = Number(event.target.value);
  els.minProbValue.textContent = state.minProb + '%';
  renderMatches();
  renderPicks();
});

els.maxFolds.addEventListener('input', () => {
  state.maxFolds = els.maxFolds.value;
  renderPicks();
});

els.maxFolds.addEventListener('change', () => {
  state.maxFolds = foldLimit();
  els.maxFolds.value = state.maxFolds;
  renderPicks();
});

function handleAdjustInput(event) {
  const input = event.target.closest('[data-adjust]');
  if (!input) return;
  const key = input.dataset.adjust;
  state.modelAdjust[key] = Number(input.value);
  if (els.statsDialog.open) {
    const match = currentMatch();
    const pick = highProbabilityMatches().find(item => item.match.id === match.id);
    if (pick) {
      els.statsDialogBody.innerHTML = statsMarkup(match, modelFor(match), pick, true);
      els.statsDialogBody.querySelectorAll('input[type="range"]').forEach(syncRangeFill);
    }
  }
  const next = event.currentTarget.querySelector('[data-adjust="' + key + '"]');
  if (next) next.focus();
}

els.statsDialogBody.addEventListener('input', handleAdjustInput);

els.leagueFilter.addEventListener('change', event => {
  state.league = event.target.value;
  renderMatches();
  renderPicks();
});

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    state.market = tab.dataset.market;
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t === tab));
    renderMatches();
    renderPicks();
  });
});

document.querySelectorAll('[data-phase]').forEach(button => {
  button.addEventListener('click', () => {
    state.phase = button.dataset.phase;
    document.querySelectorAll('[data-phase]').forEach(b => b.classList.toggle('active', b === button));
    renderAll();
    closeDrawers();
  });
});

document.querySelectorAll('[data-sport]').forEach(button => {
  button.addEventListener('click', () => {
    state.sport = button.dataset.sport;
    document.querySelectorAll('[data-sport]').forEach(b => b.classList.toggle('active', b === button));
    state.league = 'all';
    els.leagueFilter.value = 'all';
    renderAll();
    closeDrawers();
  });
});

document.getElementById('moreSports').addEventListener('click', () => {
  const extra = document.getElementById('extraSports');
  extra.hidden = !extra.hidden;
});

els.matches.addEventListener('click', event => {
  const price = event.target.closest('[data-odds]');
  if (price) {
    const match = MATCHES.find(m => m.id === Number(price.dataset.id));
    addBet(price.dataset, match);
    return;
  }
  const row = event.target.closest('.match-row');
  if (row) selectMatch(Number(row.dataset.id));
});

els.picks.addEventListener('click', event => {
  const statsButton = event.target.closest('[data-stats-id]');
  if (statsButton) {
    event.stopPropagation();
    openStatsDialog(Number(statsButton.dataset.statsId));
    return;
  }
  const pick = event.target.closest('.pick');
  if (pick) selectMatch(Number(pick.dataset.id));
});

els.picks.addEventListener('keydown', event => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  const pick = event.target.closest('.pick');
  if (!pick || event.target !== pick) return;
  event.preventDefault();
  selectMatch(Number(pick.dataset.id));
});

els.statsDialogClose.addEventListener('click', () => {
  if (!statsDialogGuard) els.statsDialog.close();
});
els.statsDialog.addEventListener('click', event => {
  if (event.target === els.statsDialog && !statsDialogGuard) els.statsDialog.close();
});

els.betList.addEventListener('click', event => {
  const remove = event.target.closest('[data-remove]');
  if (!remove) return;
  state.bets.splice(Number(remove.dataset.remove), 1);
  renderBets();
});

els.betList.addEventListener('input', event => {
  const input = event.target.closest('[data-bet-stake]');
  if (!input) return;
  state.bets[Number(input.dataset.betStake)].stake = Number(input.value) || 0;
  renderBets();
  const next = els.betList.querySelector('[data-bet-stake="' + input.dataset.betStake + '"]');
  if (next) next.focus();
});

document.querySelectorAll('[data-mode]').forEach(button => {
  button.addEventListener('click', () => {
    state.betMode = button.dataset.mode;
    document.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('active', b === button));
    renderBets();
  });
});

els.clearBets.addEventListener('click', () => {
  state.bets = [];
  renderBets();
});

els.stake.addEventListener('input', renderBets);

els.addFolds.addEventListener('click', () => {
  const folds = highProbabilityMatches().slice(0, foldLimit());
  if (!folds.length) return;
  const seen = new Set();
  state.bets = folds.filter(item => {
    const key = betKey(item.match, item.line.market, item.line.selection);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map(item => ({
    match: item.match,
    market: item.line.market,
    selection: item.line.selection,
    odds: item.line.odds,
    prob: item.line.prob,
    stake: Number(els.stake.value) || 1000
  }));
  state.betMode = 'multiple';
  document.querySelectorAll('[data-mode]').forEach(button => button.classList.toggle('active', button.dataset.mode === 'multiple'));
  renderBets();
  if (window.innerWidth <= 1000 && !els.betslip.classList.contains('open')) toggleDrawer(els.betslip);
});

document.getElementById('menuToggle').addEventListener('click', () => toggleDrawer(els.sidebar));
document.getElementById('betslipToggle').addEventListener('click', () => toggleDrawer(els.betslip));
els.betslipFab.addEventListener('click', () => toggleDrawer(els.betslip));
document.getElementById('betslipClose').addEventListener('click', closeDrawers);
els.overlay.addEventListener('click', closeDrawers);
