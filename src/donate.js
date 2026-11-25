function donateGuideForAmount(amount) {
  return /usdt/i.test(amount) ? 'Use Binance Pay ID 61934534' : 'Use M-Pesa 0764181161 or Mixx by Yas 0670929342';
}

function selectDonateAmount(button) {
  els.donateDialog.querySelectorAll('[data-amount]').forEach(item => item.classList.toggle('active', item === button));
  els.donateFeedback.textContent = 'Selected ' + button.dataset.amount + ' · ' + button.dataset.guide + '.';
}

function addCustomDonateAmount() {
  const value = els.donateCustomInput.value.trim();
  if (!value) return;
  const existing = [...els.donateDialog.querySelectorAll('[data-amount]')].find(item => item.dataset.amount.toLowerCase() === value.toLowerCase());
  let button = existing;
  if (!button) {
    button = document.createElement('button');
    button.type = 'button';
    button.className = 'donate-amount';
    button.dataset.amount = value;
    button.dataset.guide = donateGuideForAmount(value);
    button.dataset.custom = 'true';
    button.textContent = value;
    els.donateDialog.querySelector('.donate-amounts').appendChild(button);
  }
  els.donateCustomInput.value = '';
  selectDonateAmount(button);
}

function openDonateDialog() {
  els.donateFeedback.textContent = '';
  els.donateCustomInput.value = '';
  els.donateDialog.querySelectorAll('[data-amount]').forEach(button => button.classList.remove('active'));
  els.donateToggle.setAttribute('aria-expanded', 'true');
  if (typeof els.donateDialog.showModal === 'function') els.donateDialog.showModal();
  else els.donateDialog.setAttribute('open', '');
}

function closeDonateDialog() {
  if (typeof els.donateDialog.close === 'function') els.donateDialog.close();
  else {
    els.donateDialog.removeAttribute('open');
    els.donateToggle.setAttribute('aria-expanded', 'false');
  }
}

els.donateToggle.addEventListener('click', openDonateDialog);
els.donateClose.addEventListener('click', closeDonateDialog);
els.donateCustomAdd.addEventListener('click', addCustomDonateAmount);
els.donateCustomInput.addEventListener('keydown', event => {
  if (event.key === 'Enter') {
    event.preventDefault();
    addCustomDonateAmount();
  }
});
els.donateDialog.addEventListener('click', async event => {
  if (event.target === els.donateDialog) {
    closeDonateDialog();
    return;
  }
  const amountButton = event.target.closest('[data-amount]');
  if (amountButton) {
    selectDonateAmount(amountButton);
    return;
  }
  const button = event.target.closest('[data-copy]');
  if (!button) return;
  const value = button.dataset.copy;
  try {
    await navigator.clipboard.writeText(value);
    els.donateFeedback.textContent = 'Copied ' + value + '.';
  } catch {
    els.donateFeedback.textContent = 'Copy manually: ' + value;
  }
});
els.donateDialog.addEventListener('close', () => els.donateToggle.setAttribute('aria-expanded', 'false'));
