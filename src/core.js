const state = {
  minOdds: 1.3,
  minProb: 60,
  league: 'all',
  sport: 'Football',
  phase: 'today',
  selectedId: null,
  market: '3way',
  betMode: 'single',
  maxFolds: 12,
  insightTab: 'picks',
  parlayLegs: 3,
  modelAdjust: { home: 1, away: 1 },
  bets: []
};

const OUTCOMES = ['Home', 'Draw', 'Away'];
const PARLAY_POOL_LIMIT = 12;
const PARLAY_RESULT_LIMIT = 5;
let MATCHES = [];
const els = {
  splash: document.getElementById('splash'),
  splashText: document.getElementById('splashText'),
  matches: document.getElementById('matches'),
  picks: document.getElementById('picks'),
  picksPanel: document.getElementById('picksPanel'),
  parlayPanel: document.getElementById('parlayPanel'),
  pickSummary: document.getElementById('pickSummary'),
  foldCount: document.getElementById('foldCount'),
  maxFolds: document.getElementById('maxFolds'),
  foldOdds: document.getElementById('foldOdds'),
  addFolds: document.getElementById('addFolds'),
  parlayLegs: document.getElementById('parlayLegs'),
  parlaySummary: document.getElementById('parlaySummary'),
  parlays: document.getElementById('parlays'),
  minOdds: document.getElementById('minOdds'),
  minOddsValue: document.getElementById('minOddsValue'),
  minProb: document.getElementById('minProb'),
  minProbValue: document.getElementById('minProbValue'),
  statsDialog: document.getElementById('statsDialog'),
  statsDialogTitle: document.getElementById('statsDialogTitle'),
  statsDialogSub: document.getElementById('statsDialogSub'),
  statsDialogBody: document.getElementById('statsDialogBody'),
  statsDialogClose: document.getElementById('statsDialogClose'),
  leagueFilter: document.getElementById('leagueFilter'),
  dateLabel: document.getElementById('dateLabel'),
  dateHeads: document.getElementById('dateHeads'),
  betList: document.getElementById('betList'),
  betCount: document.getElementById('betCount'),
  betslipFab: document.getElementById('betslipFab'),
  clearBets: document.getElementById('clearBets'),
  stake: document.getElementById('stake'),
  sharedStakeRow: document.getElementById('sharedStakeRow'),
  totalOdds: document.getElementById('totalOdds'),
  totalOddsLabel: document.getElementById('totalOddsLabel'),
  hitProbability: document.getElementById('hitProbability'),
  potentialWin: document.getElementById('potentialWin'),
  dataStatus: document.getElementById('dataStatus'),
  dataStatusText: document.getElementById('dataStatusText'),
  donateToggle: document.getElementById('donateToggle'),
  donateDialog: document.getElementById('donateDialog'),
  donateClose: document.getElementById('donateClose'),
  donateFeedback: document.getElementById('donateFeedback'),
  donateCustomInput: document.getElementById('donateCustomInput'),
  donateCustomAdd: document.getElementById('donateCustomAdd'),
  advisorToggle: document.getElementById('advisorToggle'),
  advisorDialog: document.getElementById('advisorDialog'),
  advisorClose: document.getElementById('advisorClose'),
  advisorSub: document.getElementById('advisorSub'),
  advisorSummary: document.getElementById('advisorSummary'),
  advisorFaqs: document.getElementById('advisorFaqs'),
  advisorMessages: document.getElementById('advisorMessages'),
  advisorScroll: document.querySelector('.advisor-scroll'),
  advisorForm: document.getElementById('advisorForm'),
  advisorInput: document.getElementById('advisorInput'),
  sidebar: document.getElementById('sidebar'),
  betslip: document.getElementById('betslip'),
  overlay: document.getElementById('drawerOverlay')
};

function pct(value) { return (value * 100).toFixed(1) + '%'; }
function dec(value) { return value.toFixed(2); }
function foldLimit() {
  const raw = Number(state.maxFolds);
  if (!String(state.maxFolds).trim() || !Number.isFinite(raw)) return 12;
  return Math.min(100, Math.max(1, Math.floor(raw)));
}
function parlayLegCount() {
  const raw = Number(state.parlayLegs);
  if (!String(state.parlayLegs).trim() || !Number.isFinite(raw)) return 3;
  return Math.min(10, Math.max(2, Math.floor(raw)));
}
function sportOf(match) { return match.sport || 'Football'; }
function phaseOf(match) { return match.phase || 'today'; }
function isTwoWay(match) { return match.odds.length === 2; }
function fair(prob) { return 1 / prob; }

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
