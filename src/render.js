function initLeagues() {
  const current = state.league;
  const leagues = [...new Set(MATCHES.map(m => m.league))].sort();
  els.leagueFilter.innerHTML = '<option value="all">All leagues</option>';
  leagues.forEach(league => {
    const option = document.createElement('option');
    option.value = league;
    option.textContent = league;
    els.leagueFilter.appendChild(option);
  });
  if (!leagues.includes(current)) state.league = 'all';
  els.leagueFilter.value = state.league;
}

function updateHeads() {
  const ouOnly = state.market === 'ou';
  const heads = ouOnly ? ['', '', '', 'Goals', 'Over', 'Under'] : ['1', 'X', '2'];
  els.dateHeads.className = 'date-heads ' + (ouOnly ? 'heads-ou' : 'heads-3way');
  els.dateHeads.innerHTML = heads.map(h => '<i>' + h + '</i>').join('');
  els.dateLabel.textContent = state.phase === 'live' ? 'Live events' : state.phase === 'upcoming' ? 'Upcoming games' : state.phase === 'outright' ? 'Outrights' : '24/11 Tuesday';
}

function renderMatches() {
  const groups = [];
  visibleMatches().forEach(match => {
    let group = groups.find(g => g.league === match.league);
    if (!group) {
      group = { league: match.league, matches: [] };
      groups.push(group);
    }
    group.matches.push(match);
  });

  const html = groups.map(group => {
    const rows = group.matches.map(match => {
      const selected = match.id === state.selectedId ? ' selected' : '';
      const clock = match.live ? '<span class="live-clock">' + escapeHtml(match.minute || match.status || 'LIVE') + '</span>' : '<span>' + escapeHtml(match.time) + '</span>';
      const score = match.score ? '<span class="match-score">' + escapeHtml(match.score) + '</span>' : '';
      const groupLines = activeGroup(match).lines;
      const ouOnly = state.market === 'ou';
      const twoWayGroup = !ouOnly && groupLines.length === 2 && groupLines[0].market === '3way';
      const button = l => '<button class="odd" data-id="' + escapeHtml(match.id) + '" data-market="' + escapeHtml(l.market) + '" data-selection="' + escapeHtml(l.selection) + '" data-odds="' + escapeHtml(l.odds) + '" data-prob="' + escapeHtml(l.prob) + '">' + escapeHtml(dec(l.odds)) + '</button>';
      let oddsHtml = '<div class="odds' + (ouOnly ? ' ou-only' : '') + '">';
      if (ouOnly) oddsHtml += '<span class="odd-empty" aria-hidden="true"></span>'.repeat(3) + '<span class="ou-line">' + escapeHtml(match.ou) + '</span>' + groupLines.map(button).join('');
      else if (twoWayGroup) oddsHtml += button(groupLines[0]) + '<span class="odd-empty" aria-hidden="true"></span>' + button(groupLines[1]);
      else oddsHtml += groupLines.map(button).join('');
      oddsHtml += '</div>';

      return '<div class="match-row' + selected + (match.live ? ' live' : '') + '" data-id="' + escapeHtml(match.id) + '">' +
        '<div class="match-time">' + clock + '</div>' +
        '<div class="teams"><span class="team">' + escapeHtml(match.home) + score + '</span><span class="team away">' + escapeHtml(match.away) + '</span></div>' +
        oddsHtml +
      '</div>';
    }).join('');

    return '<div class="league-row"><span class="league-name"><span class="caret">&#9660;</span><span class="league-title">' + escapeHtml(group.league) + '</span></span><span class="league-markets">' + escapeHtml(activeGroup(group.matches[0]).title) + '</span></div>' + rows;
  }).join('');

  els.matches.innerHTML = html || '<div class="empty-bet">No matches in this view. Try another league, sport, or tab.</div>';
  updateHeads();
}

function renderPicks() {
  const picks = highProbabilityMatches();
  const shown = picks.slice(0, foldLimit());
  const total = visibleMatches().length;
  const foldOdds = shown.reduce((acc, item) => acc * item.line.odds, 1);
  els.pickSummary.textContent = picks.length + ' of ' + total + ' matches at or above ' + dec(state.minOdds) + ' odds and ' + state.minProb + '% probability';
  els.foldCount.textContent = shown.length;
  els.foldOdds.textContent = shown.length ? dec(foldOdds) : '0.00';
  els.addFolds.disabled = !shown.length;
  if (!shown.length) {
    els.picks.innerHTML = '<p class="empty-bet">No picks here. Lower the minimum odds or change the filters.</p>';
    renderParlays();
    return;
  }
  const slipKeys = new Set(state.bets.map(bet => betKey(bet.match, bet.market, bet.selection)));
  els.picks.innerHTML = shown.map((item, index) => {
    const active = item.match.id === state.selectedId ? ' active' : '';
    const inSlip = slipKeys.has(betKey(item.match, item.line.market, item.line.selection));
    return '<div class="pick' + active + '" data-id="' + escapeHtml(item.match.id) + '" role="button" tabindex="0">' +
      '<span><span class="pick-title">' + escapeHtml(item.match.home) + ' v ' + escapeHtml(item.match.away) + '</span>' +
      '<span class="pick-meta">' + escapeHtml(item.match.time) + ' &middot; ' + escapeHtml(item.line.selection) + ' &middot; ' + escapeHtml(dec(item.line.odds)) + '</span></span>' +
      '<span class="pick-prob">' + escapeHtml(pct(item.line.prob)) + '</span>' +
      '<button class="pick-stats" data-stats-id="' + escapeHtml(item.match.id) + '">Stats</button>' +
      (inSlip ? '' : '<button class="pick-add" data-pick-toggle="' + index + '">Add</button>') +
    '</div>';
  }).join('');
  renderParlays();
}

function renderParlays() {
  const options = parlayOptions();
  const shown = options.slice(0, PARLAY_RESULT_LIMIT);
  const stake = Number(els.stake.value) || 0;
  const legs = parlayLegCount();
  els.parlaySummary.textContent = options.length
    ? 'Top ' + shown.length + ' of ' + options.length + ' ' + legs + '-leg combinations'
    : 'Need at least ' + legs + ' qualifying picks';

  if (!shown.length) {
    els.parlays.innerHTML = '<p class="empty-bet">No parlays yet. Widen the filters or choose fewer legs.</p>';
    return;
  }

  els.parlays.innerHTML = shown.map((option, index) => {
    const teams = option.legs.map(item => escapeHtml(item.match.home + ' v ' + item.match.away)).join(' &middot; ');
    const selections = option.legs.map(item => item.line.selection + ' @ ' + dec(item.line.odds)).join(', ');
    return '<div class="parlay">' +
      '<div class="parlay-top"><strong>' + escapeHtml(dec(option.odds)) + '</strong><span>' + escapeHtml(pct(option.prob)) + ' hit probability</span><button class="parlay-add" data-parlay-index="' + index + '">Add</button></div>' +
      '<div class="parlay-teams" title="' + escapeHtml(selections) + '">' + teams + '</div>' +
      '<div class="parlay-meta">Expected Return ' + escapeHtml(dec(stake * option.odds)) + '</div>' +
    '</div>';
  }).join('');
}

function currentMatch() {
  const picks = highProbabilityMatches().slice(0, foldLimit());
  const selected = picks.find(item => item.match.id === state.selectedId);
  if (selected) return selected.match;
  if (picks.length) {
    state.selectedId = picks[0].match.id;
    renderPicks();
    return picks[0].match;
  }
  return null;
}

function statsMarkup(match, model, pick, detailed) {
  const lines = activeGroup(match).lines;
  const edges = lines.map(line => modelProb(match, model, line) * line.odds - 1);
  const bestEdge = Math.max(...edges);
  const xg = model.lambda ? 'λ ' + dec(model.lambda[0]) + ' – ' + dec(model.lambda[1]) : 'Model ' + pct(model.probs[0]);

  const rows = lines.map(line => {
    const modelP = modelProb(match, model, line);
    const ev = modelP * line.odds - 1;
    const kelly = Math.max(0, (modelP * line.odds - 1) / (line.odds - 1));
    const evClass = ev >= 0 ? 'positive' : 'negative';
    return '<tr><td>' + escapeHtml(line.selection) + '</td><td>' + escapeHtml(pct(modelP)) + '</td><td>' + escapeHtml(pct(line.prob)) + '</td><td>' + escapeHtml(dec(fair(modelP))) + '</td><td>' + escapeHtml(dec(line.odds)) + '</td><td class="' + evClass + '">' + escapeHtml((ev >= 0 ? '+' : '') + pct(ev)) + '</td><td>' + escapeHtml(pct(kelly)) + '</td></tr>';
  }).join('');

  const scores = model.topScores.length ? '<div class="stat-subtitle">Most likely scores</div><div class="score-list">' + model.topScores.map(s => '<span class="score-chip">' + escapeHtml(s.score) + ' <b>' + escapeHtml(pct(s.prob)) + '</b></span>').join('') + '</div>' : '';

  const controls = detailed ? '<div class="stat-subtitle">Model sensitivity</div><div class="model-controls">' +
    '<label>Home strength ' + dec(state.modelAdjust.home) + '<input type="range" min="0.8" max="1.2" step="0.02" value="' + state.modelAdjust.home + '" data-adjust="home" /></label>' +
    '<label>Away strength ' + dec(state.modelAdjust.away) + '<input type="range" min="0.8" max="1.2" step="0.02" value="' + state.modelAdjust.away + '" data-adjust="away" /></label>' +
    '</div>' : '';

  return '<div class="stat-cards">' +
    '<div class="stat-card"><span>Pick odds</span><strong>' + dec(pick.line.odds) + '</strong></div>' +
    '<div class="stat-card"><span>' + (model.type === 'poisson' ? 'Expected goals' : 'Model favourite') + '</span><strong>' + xg + '</strong></div>' +
    '<div class="stat-card"><span>Book margin</span><strong>' + pct(model.overround) + '</strong></div>' +
    '<div class="stat-card"><span>Best edge</span><strong class="' + (bestEdge >= 0 ? 'good' : '') + '">' + (bestEdge >= 0 ? '+' : '') + pct(bestEdge) + '</strong></div>' +
    '</div>' +
    '<table class="stat-table"><thead><tr><th>Line</th><th>Model</th><th>Market</th><th>Fair</th><th>Book</th><th>EV</th><th>Kelly</th></tr></thead><tbody>' + rows + '</tbody></table>' +
    (detailed ? scores : '') + controls;
}

let statsDialogGuard = false;

function openStatsDialog(id) {
  const pick = highProbabilityMatches().find(item => item.match.id === id);
  if (!pick) return;
  state.selectedId = id;
  els.picks.querySelectorAll('.pick').forEach(row => row.classList.toggle('active', row.dataset.id === String(id)));
  const model = modelFor(pick.match);
  els.statsDialogTitle.textContent = pick.match.home + ' v ' + pick.match.away;
  els.statsDialogSub.textContent = pick.line.selection + ' · ' + dec(pick.line.odds) + ' odds · ' + pct(pick.line.prob) + ' market probability';
  els.statsDialogBody.innerHTML = statsMarkup(pick.match, model, pick, true);
  els.statsDialogBody.querySelectorAll('input[type="range"]').forEach(syncRangeFill);
  setTimeout(() => {
    if (els.statsDialog.open) return;
    if (typeof els.statsDialog.showModal === 'function') els.statsDialog.showModal();
    else els.statsDialog.setAttribute('open', '');
    statsDialogGuard = true;
    setTimeout(() => { statsDialogGuard = false; }, 250);
  }, 0);
}

function slipHitProbability(bets, mode) {
  if (!bets.length) return 0;
  const probs = bets.map(bet => Number(bet.prob) || 0);
  if (mode === 'single') return probs.reduce((sum, prob) => sum + prob, 0) / probs.length;
  if (mode === 'multiple') return probs.reduce((acc, prob) => acc * prob, 1);
  const distribution = Array(probs.length + 1).fill(0);
  distribution[0] = 1;
  probs.forEach((prob, index) => {
    for (let wins = index + 1; wins >= 1; wins--) distribution[wins] = distribution[wins] * (1 - prob) + distribution[wins - 1] * prob;
    distribution[0] *= 1 - prob;
  });
  const needed = Math.max(1, probs.length - 1);
  return Math.min(1, Math.max(0, distribution.slice(needed).reduce((sum, value) => sum + value, 0)));
}

function computeBetTotals(bets, mode, sharedStake) {
  const count = bets.length;
  let totalStake = 0;
  let total = 0;
  let win = 0;
  let label = 'Total odds';

  if (mode === 'single') {
    totalStake = bets.reduce((sum, bet) => sum + (Number(bet.stake) || 0), 0);
    win = bets.reduce((sum, bet) => sum + (Number(bet.stake) || 0) * bet.odds, 0);
    total = totalStake ? win / totalStake : 0;
  } else {
    const stake = Number(sharedStake) || 0;
    const product = bets.reduce((acc, bet) => acc * bet.odds, 1);
    if (mode === 'multiple') {
      totalStake = count ? stake : 0;
      total = count ? product : 0;
      win = stake * total;
    } else {
      let comboOdds = 0;
      let combinations = 0;
      const picked = [];
      const choose = start => {
        if (picked.length === count - 1) {
          combinations++;
          comboOdds += picked.reduce((acc, bet) => acc * bet.odds, 1);
          return;
        }
        for (let i = start; i < count; i++) {
          picked.push(bets[i]);
          choose(i + 1);
          picked.pop();
        }
      };
      if (count) choose(0);
      totalStake = stake * combinations;
      total = comboOdds;
      win = stake * comboOdds;
      if (count) label = 'System ' + (count < 2 ? count : count - 1) + '/' + count;
    }
  }

  return { count, totalStake, totalOdds: total, potentialWin: win, hit: slipHitProbability(bets, mode), label };
}

function renderBets() {
  const count = state.bets.length;
  els.betCount.textContent = count;
  document.querySelectorAll('[data-mobile-bet-count]').forEach(el => { el.textContent = count; });
  els.sharedStakeRow.hidden = state.betMode === 'single';

  if (!count) {
    els.betList.innerHTML = '<p class="empty-bet">Click a moneyline price to add it here.</p>';
  } else {
    els.betList.innerHTML = state.bets.map((bet, index) =>
      '<div class="bet-item"><div class="bet-item-top"><span>' + escapeHtml(bet.selection) + '</span><strong>' + escapeHtml(dec(bet.odds)) + '</strong><button data-remove="' + index + '">&times;</button></div>' +
      '<div class="bet-item-meta">' + escapeHtml(bet.match.home) + ' v ' + escapeHtml(bet.match.away) + ' &middot; ' + escapeHtml(bet.market.toUpperCase()) + ' &middot; ' + escapeHtml(pct(bet.prob)) + '</div>' +
      (state.betMode === 'single' ? '<label class="bet-stake">Stake<input type="number" min="0" step="100" value="' + escapeHtml(bet.stake) + '" data-bet-stake="' + index + '" /></label>' : '') +
      '</div>'
    ).join('');
  }

  const totals = computeBetTotals(state.bets, state.betMode, els.stake.value);
  els.hitProbability.textContent = pct(totals.hit);
  els.totalOddsLabel.textContent = totals.label;
  els.totalOdds.textContent = count ? dec(totals.totalOdds) : '0.00';
  els.potentialWin.textContent = count ? dec(totals.potentialWin) : '0.00';
}

function betKey(match, market, selection) {
  return match.id + '|' + String(market).trim() + '|' + String(selection).trim();
}

function addBet(line, match) {
  if (!match) return;
  const key = betKey(match, line.market, line.selection);
  const existing = state.bets.find(bet => betKey(bet.match, bet.market, bet.selection) === key);
  const modelP = modelProb(match, modelFor(match), line);
  if (existing) {
    existing.odds = Number(line.odds);
    existing.prob = Number(line.prob);
    existing.modelP = modelP;
    renderBets();
    renderPicks();
    return;
  }
  state.bets.push({
    match,
    market: line.market,
    selection: line.selection,
    odds: Number(line.odds),
    prob: Number(line.prob),
    modelP,
    stake: Number(els.stake.value) || 1000
  });
  renderBets();
  renderPicks();
}

function selectMatch(id) {
  state.selectedId = id;
  renderMatches();
  renderPicks();
  if (window.innerWidth <= 1000) closeDrawers();
}

function syncDrawerButtons() {
  const betslipOpen = els.betslip.classList.contains('open');
  els.betslipFab.classList.toggle('hidden-when-open', betslipOpen);
  els.betslipFab.setAttribute('aria-expanded', String(betslipOpen));
  document.getElementById('menuToggle').classList.toggle('hidden-when-open', els.sidebar.classList.contains('open'));
}

function closeDrawers() {
  els.sidebar.classList.remove('open');
  els.betslip.classList.remove('open');
  els.overlay.classList.remove('visible');
  syncDrawerButtons();
}

function toggleDrawer(element) {
  const wasOpen = element.classList.contains('open');
  closeDrawers();
  if (!wasOpen) {
    element.classList.add('open');
    els.overlay.classList.add('visible');
    syncDrawerButtons();
  }
}

function setInsightTab(tab) {
  state.insightTab = tab;
  document.querySelectorAll('[data-insight-tab]').forEach(button => {
    const active = button.dataset.insightTab === tab;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
  els.picksPanel.hidden = tab !== 'picks';
  els.parlayPanel.hidden = tab !== 'parlay';
  if (tab === 'parlay') renderParlays();
}

function renderAll() {
  renderMatches();
  renderPicks();
  renderBets();
  refreshAdvisor();
}

function syncRangeFill(input) {
  const min = Number(input.min) || 0;
  const max = Number(input.max) || 100;
  const value = Number(input.value);
  const fill = max === min ? 0 : ((value - min) / (max - min)) * 100;
  input.style.setProperty('--range-fill', fill + '%');
}
