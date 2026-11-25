renderAdvisorFaqs();
advisorThread.push({ role: 'advisor', text: advisorAnswerHelp(), answerId: 'help' });
refreshAdvisor();

function syncStickyHeights() {
  const topbar = document.querySelector('.topbar');
  const toolbar = document.querySelector('.toolbar');
  if (topbar) document.documentElement.style.setProperty('--topbar-height', topbar.offsetHeight + 'px');
  if (toolbar) document.documentElement.style.setProperty('--toolbar-height', toolbar.offsetHeight + 'px');
}

window.addEventListener('resize', syncStickyHeights);
if (typeof ResizeObserver !== 'undefined') {
  const observer = new ResizeObserver(syncStickyHeights);
  observer.observe(document.querySelector('.topbar'));
  observer.observe(document.querySelector('.toolbar'));
}

syncStickyHeights();
els.maxFolds.value = foldLimit();
document.querySelectorAll('input[type="range"]').forEach(syncRangeFill);
initLeagues();
syncDrawerButtons();
renderAll();
bootstrap();
