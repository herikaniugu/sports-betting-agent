const ADVISOR_FAQS = [
  { id: 'help', question: 'What can Bet Advisor do?' },
  { id: 'summary', question: "Summarize my bets today" },
  { id: 'plan', question: 'Suggest a plan for today' },
  { id: 'strongest', question: 'Which bet is strongest?' },
  { id: 'risk', question: 'Which bets are risky?' },
  { id: 'watch', question: 'What should I watch today?' },
  { id: 'value', question: 'Show me the best value picks' },
  { id: 'margin', question: 'What is the bookmaker margin?' },
  { id: 'updates', question: 'How fresh is this data?' }
];

const advisorThread = [];
const advisorWideQuery = window.matchMedia('(min-width: 1001px)');
let advisorDialogGuard = false;

function signedPct(value) {
  return (value >= 0 ? '+' : '') + pct(value);
}

function todayBets() {
  return state.bets.filter(bet => phaseOf(bet.match) === 'today' || phaseOf(bet.match) === 'live');
}

function bookMargin(match) {
  return match.odds.reduce((sum, odds) => sum + 1 / odds, 0) - 1;
}

function betModelProb(bet) {
  return modelProb(bet.match, modelFor(bet.match), { market: bet.market, selection: bet.selection });
}

function betEdge(bet) {
  return betModelProb(bet) * bet.odds - 1;
}

function rankedBets() {
  return todayBets()
    .map(bet => ({ bet, edge: betEdge(bet) }))
    .sort((a, b) => b.edge - a.edge || b.bet.prob - a.bet.prob);
}

function betLine(bet) {
  return bet.match.home + ' v ' + bet.match.away + ' · ' + bet.selection + ' @ ' + dec(bet.odds);
}

function numberLines(items, format) {
  return items.map((item, index) => (index + 1) + '. ' + format(item));
}

function betLines(bets, limit) {
  return numberLines(bets.slice(0, limit), bet => betLine(bet) + ' · ' + pct(bet.prob) + ' market · ' + signedPct(betEdge(bet)) + ' edge').join('\n');
}

function pickLine(item) {
  return item.match.home + ' v ' + item.match.away + ' · ' + item.line.selection + ' @ ' + dec(item.line.odds) + ' · ' + pct(item.line.prob);
}

function candidateLine(item) {
  return item.match.home + ' v ' + item.match.away + ' · ' + item.line.selection + ' @ ' + dec(item.line.odds) +
    ' · model ' + pct(item.modelP) + ' · edge ' + signedPct(item.edge);
}

function advisorValueCandidates() {
  const candidates = [];
  visibleMatches().forEach(match => {
    const model = modelFor(match);
    activeGroup(match).lines.forEach(line => {
      const modelP = modelProb(match, model, line);
      const edge = modelP * line.odds - 1;
      if (line.odds >= state.minOdds && modelP * 100 >= state.minProb) candidates.push({ match, line, modelP, edge });
    });
  });
  return candidates.sort((a, b) => b.edge - a.edge);
}

function renderAdvisorSummary() {
  const bets = todayBets();
  if (!bets.length) {
    els.advisorSummary.innerHTML = '<div class="advisor-summary-empty"><strong>No bets in today’s games yet</strong><span>Click an odd to add one, then ask for a live summary.</span></div>';
    return;
  }
  const totals = computeBetTotals(bets, state.betMode, els.stake.value);
  const avgProb = bets.reduce((sum, bet) => sum + bet.prob, 0) / bets.length;
  const leagues = new Set(bets.map(bet => bet.match.league)).size;
  const liveCount = bets.filter(bet => bet.match.live).length;
  const cards = [
    ['Bets', String(bets.length)],
    ['Total stake', dec(totals.totalStake)],
    ['Potential return', dec(totals.potentialWin)],
    ['Avg. market chance', pct(avgProb)]
  ];
  els.advisorSummary.innerHTML = '<div class="advisor-summary-grid">' + cards.map(card =>
    '<div class="advisor-summary-card"><span>' + escapeHtml(card[0]) + '</span><strong>' + escapeHtml(card[1]) + '</strong></div>'
  ).join('') + '</div>' +
    '<div class="advisor-summary-meta">' + leagues + ' league' + (leagues === 1 ? '' : 's') + ' · ' + liveCount + ' live · ' + escapeHtml(totals.label) + ' ' + dec(totals.totalOdds) + '</div>';
}

function updateAdvisorHeader() {
  const label = dataBusy ? 'updating now' : lastUpdatedAt ? relativeTime(lastUpdatedAt) : 'waiting for first update';
  els.advisorSub.textContent = 'Live snapshot · ' + label;
}

function advisorAnswerHelp() {
  return [
    'Bet Advisor',
    'How I can help',
    '- Read your current slip and show stake, return, and exposure',
    '- Build a plan from the strongest live lines',
    '- Flag the riskiest legs and games worth watching',
    '- Compare model probability with the current price',
    '- Check bookmaker margin and market freshness',
    '',
    'Ask a quick question or type your own.'
  ].join('\n');
}

function advisorAnswerSummary() {
  const bets = todayBets();
  if (!bets.length) return 'Your slip is empty\nAdd a price from the match list and I will size up the value and risk.';
  const totals = computeBetTotals(bets, state.betMode, els.stake.value);
  const ranked = rankedBets();
  const avgProb = bets.reduce((sum, bet) => sum + bet.prob, 0) / bets.length;
  const leagues = new Set(bets.map(bet => bet.match.league)).size;
  const liveCount = bets.filter(bet => bet.match.live).length;
  return [
    'Your book today',
    'Position',
    '- ' + bets.length + ' bets across ' + leagues + ' leagues' + (liveCount ? ', including ' + liveCount + ' live' : ''),
    '- Stake ' + dec(totals.totalStake),
    '- Potential return ' + dec(totals.potentialWin),
    '- ' + totals.label + ' ' + dec(totals.totalOdds),
    '- Average market chance ' + pct(avgProb),
    '',
    'Best edge',
    '1. ' + betLine(ranked[0].bet) + ' (' + signedPct(ranked[0].edge) + ')',
    '',
    'All legs',
    betLines(bets, 5)
  ].join('\n');
}

function advisorAnswerPlan() {
  const bets = todayBets();
  const ranked = rankedBets();
  const picks = highProbabilityMatches().slice(0, 3);
  const lines = ['Plan for today', 'My read'];

  if (ranked.length) {
    lines.push('- ' + ranked.length + ' legs in the slip; the top ' + Math.min(3, ranked.length) + ' carry the clearest model edge.');
    lines.push('', 'Prioritize');
    lines.push(...numberLines(ranked.slice(0, 3), item => betLine(item.bet) + ' (' + signedPct(item.edge) + ' edge)'));
    if (ranked.length > 3) {
      lines.push('', 'Secondary');
      lines.push(...numberLines(ranked.slice(3, 5), item => betLine(item.bet)));
    }
    const totals = computeBetTotals(bets, state.betMode, els.stake.value);
    lines.push('', 'Stake view');
    lines.push('- ' + bets.length + ' bets');
    lines.push('- Stake ' + dec(totals.totalStake));
    lines.push('- Potential return ' + dec(totals.potentialWin));
  } else if (picks.length) {
    lines.push('- Nothing in the slip yet. These lines are the strongest fit for your current filters.');
    lines.push('', 'Shortlist');
    lines.push(...numberLines(picks, pickLine));
    lines.push('', 'Add the ones you like and I will fold them into the plan.');
  } else {
    lines.push('- Nothing matches the current filters. Widen min odds or min probability and I will rebuild the shortlist.');
  }

  const live = MATCHES.filter(match => match.live);
  lines.push('', 'Live watch');
  if (live.length) {
    lines.push(...numberLines(live.slice(0, 3), match => match.home + ' v ' + match.away + ' · ' + (match.minute || match.status || 'LIVE')));
  } else {
    lines.push('- No live events right now');
  }
  lines.push('', 'Recheck prices before you commit; this market moves quickly.');
  return lines.join('\n');
}

function advisorAnswerStrongest() {
  const ranked = rankedBets();
  if (!ranked.length) return 'No ranked bets yet\nAdd a leg to today’s games and I will rank it against the current market.';
  const top = ranked[0];
  return [
    'Best play in your slip',
    betLine(top.bet),
    '',
    'Why it stands out',
    '- Model chance ' + pct(betModelProb(top.bet)),
    '- Market chance ' + pct(top.bet.prob),
    '- Edge ' + signedPct(top.edge),
    '',
    'This is the clearest model-versus-price gap in your current book.'
  ].join('\n');
}

function advisorAnswerRisk() {
  const bets = todayBets().sort((a, b) => a.prob - b.prob || b.odds - a.odds);
  if (!bets.length) return 'Your slip is empty\nAdd a leg to today’s games and I will flag the most volatile lines.';
  return [
    'Risk watch',
    'Most volatile legs',
    '',
    betLines(bets, 3),
    '',
    'These carry the lowest hit rates. I would keep them small or treat them as optional legs.'
  ].join('\n');
}

function advisorAnswerWatch() {
  const bets = todayBets();
  const liveMatches = MATCHES.filter(match => match.live);
  const liveBets = bets.filter(bet => bet.match.live);
  const next = bets.filter(bet => !bet.match.live).sort((a, b) => a.match.time.localeCompare(b.match.time));
  const picks = highProbabilityMatches().slice(0, 3);
  return [
    'Watchlist',
    'Live now',
    ...(liveMatches.length ? numberLines(liveMatches.slice(0, 3), match => {
      const line = bestLine(match);
      return match.home + ' v ' + match.away + ' \n* ' + (match.minute || match.status || 'LIVE') +
        ' · ' + line.selection + ' @ ' + dec(line.odds) + ' · ' + pct(line.prob);
    }) : ['- No live events right now']),
    '',
    'Live in your slip',
    ...(liveBets.length ? numberLines(liveBets, betLine) : ['- Nothing live in your slip yet']),
    '',
    'Upcoming in your slip',
    ...(next.length ? numberLines(next.slice(0, 3), bet => bet.match.time + ' · ' + betLine(bet)) : ['- None scheduled']),
    '',
    'Best filtered picks',
    ...(picks.length ? numberLines(picks, pickLine) : ['- None match your filters']),
    '',
    STATIC_MODE
      ? 'Snapshot saved ' + (lastUpdatedAt ? relativeTime(lastUpdatedAt) + '.' : 'for offline viewing.')
      : 'Last market refresh ' + (lastUpdatedAt ? relativeTime(lastUpdatedAt) : 'pending') + '. I will keep this updated.'
  ].join('\n');
}

function advisorAnswerValue() {
  const candidates = advisorValueCandidates();
  if (!candidates.length) return 'No value picks\nNothing passes both filters right now. Widen min probability or min odds and I will widen the board.';
  return [
    'Value board',
    'Best price-to-model fit',
    '',
    ...numberLines(candidates.slice(0, 3), candidateLine),
    '',
    'These lines show the strongest gap between model probability and current price.'
  ].join('\n');
}

function advisorAnswerMargin() {
  const matches = MATCHES.filter(match => phaseOf(match) === 'today' || match.live);
  if (!matches.length) return 'No margin data\nToday and live matches have not loaded yet.';
  const margins = matches.map(bookMargin);
  const average = margins.reduce((sum, margin) => sum + margin, 0) / margins.length;
  return [
    'Market margin check',
    'Today and live matches',
    '',
    '- Matches ' + matches.length,
    '- Average margin ' + pct(average),
    '- Range ' + pct(Math.min(...margins)) + ' to ' + pct(Math.max(...margins)),
    '',
    'That is the built-in bookmaker hold. I strip it out before ranking value.'
  ].join('\n');
}

function advisorAnswerUpdates() {
  return [
    'Market freshness',
    STATIC_MODE ? (STATIC_API_MODE ? 'This static deployment pulls the latest SportyBet snapshot from its own API every 15 seconds and rerenders in place.' : 'This static deployment polls the saved SportyBet snapshot and rerenders when the data file changes.') : 'Auto refresh is active and pulls the latest SportyBet snapshot every 15 seconds.',
    '',
    '- Status: ' + els.dataStatusText.textContent,
    '- Snapshot: ' + (lastUpdatedAt ? relativeTime(lastUpdatedAt) : 'pending'),
    STATIC_MODE ? (STATIC_API_MODE ? '- The browser polls /api/data; no page redeploy is needed.' : '- The browser polls data.js; the scheduled scraper updates the file.') : '- Your advisor answers stay in sync with each refresh.'
  ].join('\n');
}

const advisorAnswers = {
  help: advisorAnswerHelp,
  summary: advisorAnswerSummary,
  plan: advisorAnswerPlan,
  strongest: advisorAnswerStrongest,
  risk: advisorAnswerRisk,
  watch: advisorAnswerWatch,
  value: advisorAnswerValue,
  margin: advisorAnswerMargin,
  updates: advisorAnswerUpdates
};

function inferAdvisorAnswerId(text) {
  const query = text.toLowerCase();
  const checks = [
    ['plan', ['plan', 'strategy', 'shortlist', 'what to bet', 'build', 'suggest']],
    ['summary', ['summar', 'my bets', 'betslip', 'stake', 'return', 'how much', 'total']],
    ['strongest', ['strongest', 'safest', 'most likely', 'best bet', 'confidence', 'top bet']],
    ['risk', ['risk', 'risky', 'volatile', 'long shot', 'upset', 'likely to lose']],
    ['watch', ['watch', 'live', 'kick', 'next', 'schedule', 'right now']],
    ['value', ['value', 'edge', 'ev', 'kelly', 'pick']],
    ['margin', ['margin', 'overround', 'bookmaker', 'book', 'vig', 'juice']],
    ['updates', ['update', 'fresh', 'recent', 'status', 'change', 'auto']],
    ['help', ['help', 'what can', 'capab', 'questions']]
  ];
  let best = null;
  let bestScore = 0;
  checks.forEach(([id, terms]) => {
    const score = terms.filter(term => query.includes(term)).length;
    if (score > bestScore) {
      best = id;
      bestScore = score;
    }
  });
  return best;
}

function renderAdvisorFaqs() {
  const buttons = items => items.map(item =>
    '<button type="button" data-advisor-question="' + item.id + '">' + escapeHtml(item.question) + '</button>'
  ).join('');
  els.advisorFaqs.innerHTML = buttons(ADVISOR_FAQS);
}

function renderAdvisorThread(forceBottom = false) {
  const messages = els.advisorMessages;
  const scroller = els.advisorScroll;
  const atBottom = forceBottom || scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 48;
  const previousScroll = scroller.scrollTop;
  messages.innerHTML = '';
  advisorThread.forEach(message => {
    const row = document.createElement('div');
    row.className = 'advisor-message ' + message.role;
    const role = document.createElement('span');
    role.className = 'advisor-role';
    role.textContent = message.role === 'user' ? 'You' : 'Bet Advisor';
    const text = document.createElement('div');
    text.className = 'advisor-text';
    const lines = message.text.split('\n');
    if (lines.length > 1) {
      const title = document.createElement('strong');
      title.className = 'advisor-text-title';
      title.textContent = lines[0];
      const body = document.createElement('div');
      body.className = 'advisor-text-body';
      body.textContent = lines.slice(1).join('\n');
      text.append(title, body);
    } else {
      text.textContent = message.text;
    }
    row.append(role, text);
    messages.appendChild(row);
  });
  scroller.scrollTop = atBottom ? scroller.scrollHeight : previousScroll;
}

function refreshAdvisor() {
  updateAdvisorHeader();
  renderAdvisorSummary();
  if (!els.advisorDialog.open) return;
  advisorThread.forEach(message => {
    if (message.answerId && advisorAnswers[message.answerId]) message.text = advisorAnswers[message.answerId]();
  });
  renderAdvisorThread();
}

function askAdvisor(question, answerId) {
  const trimmed = String(question || '').trim();
  if (!trimmed) return;
  const resolved = answerId || inferAdvisorAnswerId(trimmed);
  advisorThread.push({ role: 'user', text: trimmed });
  advisorThread.push({
    role: 'advisor',
    text: resolved && advisorAnswers[resolved] ? advisorAnswers[resolved]() : 'I can work from the current market snapshot and your slip. Ask me about value, risk, live games, margins, or update timing.',
    answerId: resolved && advisorAnswers[resolved] ? resolved : null
  });
  if (advisorThread.length > 24) advisorThread.splice(0, advisorThread.length - 24);
  renderAdvisorThread(true);
}

function showAdvisorDialog() {
  if (advisorWideQuery.matches && typeof els.advisorDialog.show === 'function') els.advisorDialog.show();
  else if (typeof els.advisorDialog.showModal === 'function') els.advisorDialog.showModal();
  else els.advisorDialog.setAttribute('open', '');
  els.advisorToggle.setAttribute('aria-expanded', 'true');
  advisorDialogGuard = true;
  setTimeout(() => { advisorDialogGuard = false; }, 250);
  els.advisorInput.focus();
}

function openAdvisorDialog() {
  refreshAdvisor();
  if (!advisorThread.length) {
    advisorThread.push({ role: 'advisor', text: advisorAnswerHelp(), answerId: 'help' });
    renderAdvisorThread(true);
  }
  if (els.advisorDialog.open) {
    if (advisorWideQuery.matches) closeAdvisorDialog(true);
    return;
  }
  setTimeout(() => {
    if (!els.advisorDialog.open) showAdvisorDialog();
  }, 0);
}

function closeAdvisorDialog(force = false) {
  if (!force && advisorDialogGuard) return;
  if (typeof els.advisorDialog.close === 'function') els.advisorDialog.close();
  else {
    els.advisorDialog.removeAttribute('open');
    els.advisorToggle.setAttribute('aria-expanded', 'false');
  }
}

function syncAdvisorMode() {
  if (!els.advisorDialog.open) return;
  const shouldBeModal = !advisorWideQuery.matches;
  const isModal = typeof els.advisorDialog.matches === 'function' && els.advisorDialog.matches(':modal');
  if (shouldBeModal === isModal) return;
  els.advisorDialog.close();
  setTimeout(() => {
    if (!els.advisorDialog.open) showAdvisorDialog();
  }, 0);
}

if (typeof advisorWideQuery.addEventListener === 'function') advisorWideQuery.addEventListener('change', syncAdvisorMode);
else if (typeof advisorWideQuery.addListener === 'function') advisorWideQuery.addListener(syncAdvisorMode);

els.advisorToggle.addEventListener('click', openAdvisorDialog);
els.advisorClose.addEventListener('click', () => closeAdvisorDialog(true));
els.advisorDialog.addEventListener('click', event => {
  if (event.target === els.advisorDialog && !advisorDialogGuard) closeAdvisorDialog();
});
els.advisorDialog.addEventListener('close', () => els.advisorToggle.setAttribute('aria-expanded', 'false'));
els.advisorFaqs.addEventListener('click', event => {
  const button = event.target.closest('[data-advisor-question]');
  if (!button) return;
  const item = ADVISOR_FAQS.find(question => question.id === button.dataset.advisorQuestion);
  if (item) askAdvisor(item.question, item.id);
});
els.advisorForm.addEventListener('submit', event => {
  event.preventDefault();
  askAdvisor(els.advisorInput.value);
  els.advisorInput.value = '';
});
