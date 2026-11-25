function implied3(odds) {
  const raw = odds.map(o => 1 / o);
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map(v => v / sum);
}

function implied2(a, b) {
  const raw = [1 / a, 1 / b];
  const sum = raw[0] + raw[1];
  return [raw[0] / sum, raw[1] / sum];
}

function probabilities(match) {
  return isTwoWay(match) ? implied2(match.odds[0], match.odds[1]) : implied3(match.odds);
}

function poisson(k, lambda) {
  let value = Math.exp(-lambda);
  for (let i = 1; i <= k; i++) value = value * lambda / i;
  return value;
}

function scoreProbabilities(lh, la, totalLine) {
  const homePmf = [];
  const awayPmf = [];
  for (let k = 0; k <= 10; k++) {
    homePmf.push(poisson(k, lh));
    awayPmf.push(poisson(k, la));
  }
  let home = 0;
  let draw = 0;
  let away = 0;
  let over = 0;
  const scores = [];
  for (let i = 0; i <= 10; i++) {
    for (let j = 0; j <= 10; j++) {
      const p = homePmf[i] * awayPmf[j];
      if (i > j) home += p;
      else if (i === j) draw += p;
      else away += p;
      if (i + j > totalLine) over += p;
      scores.push({ score: i + '-' + j, prob: p });
    }
  }
  return {
    probs: [home, draw, away],
    ou: [over, 1 - over],
    topScores: scores.sort((a, b) => b.prob - a.prob).slice(0, 4)
  };
}

function fittedLambda(match, market) {
  let best = null;
  let bestError = Infinity;
  for (let split = 0.25; split <= 0.75; split += 0.01) {
    const lh = match.ou * split;
    const la = match.ou * (1 - split);
    const scored = scoreProbabilities(lh, la, match.ou);
    const error = Math.abs(scored.probs[0] - market[0]) + Math.abs(scored.probs[1] - market[1]) * 0.6 + Math.abs(scored.probs[2] - market[2]);
    if (error < bestError) {
      bestError = error;
      best = { lh, la };
    }
  }
  return best;
}

function modelFor(match) {
  const market = probabilities(match);
  const overround = match.odds.reduce((sum, odds) => sum + 1 / odds, 0) - 1;
  if (isTwoWay(match)) {
    const shift = (state.modelAdjust.home - state.modelAdjust.away) * 0.08;
    const home = Math.min(0.95, Math.max(0.05, 0.5 + (market[0] - 0.5) * 0.9 + shift));
    const ouMarket = match.noOu ? [0.5, 0.5] : implied2(match.over, match.under);
    const ouHome = 0.5 + (ouMarket[0] - 0.5) * 0.9;
    return {
      type: 'logistic',
      probs: [home, 1 - home],
      ou: [ouHome, 1 - ouHome],
      topScores: [],
      lambda: null,
      overround
    };
  }
  const fitted = fittedLambda(match, market);
  const lh = fitted.lh * state.modelAdjust.home;
  const la = fitted.la * state.modelAdjust.away;
  const scored = scoreProbabilities(lh, la, match.ou);
  return {
    type: 'poisson',
    probs: scored.probs,
    ou: scored.ou,
    topScores: scored.topScores,
    lambda: [lh, la],
    overround,
    market
  };
}

function modelProb(match, model, line) {
  if (line.market === 'ou') return line.selection.startsWith('Over') ? model.ou[0] : model.ou[1];
  if (isTwoWay(match)) return line.selection === 'Home' ? model.probs[0] : model.probs[1];
  const p = model.probs;
  if (line.selection === 'Home') return p[0];
  if (line.selection === 'Draw') return p[1];
  if (line.selection === 'Away') return p[2];
  if (line.selection === 'Home or Draw') return p[0] + p[1];
  if (line.selection === 'Draw or Away') return p[1] + p[2];
  if (line.selection === 'Home or Away') return p[0] + p[2];
  return p[2];
}

function allGroups(match) {
  const p = probabilities(match);
  const groups = [];

  if (isTwoWay(match)) {
    groups.push({
      title: 'Moneyline',
      market: '3way',
      lines: [
        { market: '3way', selection: 'Home', odds: match.odds[0], prob: p[0] },
        { market: '3way', selection: 'Away', odds: match.odds[1], prob: p[1] }
      ]
    });
  } else {
    groups.push({
      title: '1X2 moneyline',
      market: '3way',
      lines: p.map((prob, i) => ({ market: '3way', selection: OUTCOMES[i], odds: match.odds[i], prob }))
    });
    const dcPairs = [p[0] + p[1], p[1] + p[2], p[0] + p[2]];
    const dcLines = DC_SELECTIONS.map((selection, index) => {
      const odds = Number(match.dc?.[selection]) || fair(dcPairs[index]);
      return { market: 'dc', selection, odds: Number(odds.toFixed(2)), rawProb: 1 / odds };
    });
    const dcTotal = dcLines.reduce((sum, line) => sum + line.rawProb, 0);
    groups.push({
      title: 'Double chance',
      market: 'dc',
      lines: dcLines.map(({ rawProb, ...line }) => ({ ...line, prob: rawProb / dcTotal }))
    });
  }

  if (!match.noOu) {
    const ou = implied2(match.over, match.under);
    groups.push({
      title: (isTwoWay(match) ? 'Total ' : 'Total goals ') + match.ou,
      market: 'ou',
      lines: [
        { market: 'ou', selection: 'Over ' + match.ou, odds: match.over, prob: ou[0] },
        { market: 'ou', selection: 'Under ' + match.ou, odds: match.under, prob: ou[1] }
      ]
    });
  }

  return groups;
}

function activeGroup(match) {
  const groups = allGroups(match);
  return groups.find(group => group.market === state.market) || groups[0];
}

function bestLine(match) {
  const lines = activeGroup(match).lines;
  return lines.reduce((best, line) => line.prob > best.prob ? line : best, lines[0]);
}

function visibleMatches() {
  return MATCHES.filter(match => {
    if (sportOf(match) !== state.sport) return false;
    if (state.market === 'dc' && isTwoWay(match)) return false;
    if (state.phase === 'live') {
      if (!match.live) return false;
    } else if (phaseOf(match) !== state.phase) {
      return false;
    }
    if (state.league !== 'all' && match.league !== state.league) return false;
    return true;
  });
}

function highProbabilityMatches() {
  return visibleMatches()
    .map(match => ({ match, line: bestLine(match) }))
    .filter(item => item.line.odds >= state.minOdds && item.line.prob * 100 >= state.minProb)
    .sort((a, b) => b.line.prob - a.line.prob);
}
