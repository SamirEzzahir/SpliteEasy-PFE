// Standalone design demo: all data stays in this tab. No application requests.
const walletIcon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const walletTone = wallet => wallet.typeId === 'type-bank' ? 'bank' : wallet.typeId === 'type-cash' ? 'cash' : 'custom';
const walletColor = wallet => ({bank:'var(--wallet-bank)',cash:'var(--chart-cash)',custom:'var(--chart-custom)'})[walletTone(wallet)];

function renderWalletPage() {
  const total = state.wallets.reduce((sum, wallet) => sum + wallet.balance, 0);
  document.getElementById('portfolio-total').textContent = money(total);
  document.getElementById('wallet-count').textContent = `${state.wallets.length} wallets`;
  document.getElementById('wallet-month-income').textContent = money(state.income);
  document.getElementById('wallet-month-spending').textContent = money(state.spending);
  document.getElementById('wallet-owed').textContent = money(state.owed);
  document.getElementById('wallet-receive').disabled = state.owed === 0;
  document.getElementById('all-wallets').innerHTML = state.wallets.length ? state.wallets.map(wallet => `
    <article class="balance-card wallet ${walletTone(wallet)}" aria-label="${esc(wallet.name)}: ${money(wallet.balance)}">
      <div class="balance-card-top">${walletIcon(walletTone(wallet) === 'custom' ? 'wallet' : walletTone(wallet))}<span class="wallet-type-tag" title="${esc(wallet.type)}">${esc(wallet.type)}</span></div>
      <h3>${esc(wallet.name)}</h3><strong class="balance num">${money(wallet.balance)}</strong>
      <div class="balance-card-bottom"><span>Personal wallet · MAD</span><button type="button" data-history="${wallet.id}" aria-label="View activity for ${esc(wallet.name)}">${walletIcon('chevron')}</button></div>
    </article>`).join('') : `<div class="empty">${walletIcon('wallet')}<p>Add a wallet to start tracking your money.</p><button class="linkbtn" data-action="wallet">Create wallet</button></div>`;

  let offset = 0;
  const segments = total > 0 ? state.wallets.filter(wallet => wallet.balance > 0).map(wallet => {
    const percent = wallet.balance / total * 100;
    const arc = percent - (percent < 100 ? Math.min(1.5, percent / 4) : 0);
    const segment = `<circle cx="100" cy="100" r="80" fill="none" stroke="${walletColor(wallet)}" stroke-width="18" pathLength="100" stroke-dasharray="${arc} ${100 - arc}" stroke-dashoffset="${-offset}"/>`;
    offset += percent;
    return segment;
  }).join('') : '';
  document.getElementById('wallet-chart').innerHTML = `<div class="wallet-chart"><svg viewBox="0 0 200 200" aria-hidden="true"><circle cx="100" cy="100" r="80" fill="none" stroke="var(--line)" stroke-width="18"/>${segments}</svg><div class="wallet-chart-center"><span>Total balance</span><strong class="num">${money(total)}</strong></div></div>`;
  document.getElementById('wallet-legend').innerHTML = state.wallets.map(wallet => `<li><span class="legend-dot" style="--segment:${walletColor(wallet)}" aria-hidden="true"></span><span class="legend-name">${esc(wallet.name)}<small>${esc(wallet.type)}</small></span><span class="legend-value num">${money(wallet.balance)}<small>${total > 0 ? (wallet.balance / total * 100).toFixed(1) : '0'}%</small></span></li>`).join('');

  const groups = new Map();
  state.entries.slice(0, 5).forEach(entry => {
    const date = entry.date || state.sampleDate;
    if (!groups.has(date)) groups.set(date, []);
    groups.get(date).push(entry);
  });
  document.getElementById('wallet-recent-feed').innerHTML = groups.size ? [...groups].map(([date, entries]) => {
    const dateLabel = new Intl.DateTimeFormat('en', {month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(`${date}T12:00:00Z`));
    return `<h3 class="activity-date">${dateLabel}</h3>${entries.map(entry => {
      const tone = entry.type === 'Spending' ? 'spending' : ['Income','Reimbursement'].includes(entry.type) ? 'income' : '';
      const iconName = {Spending:'receipt',Income:'arrow-down',Transfer:'transfer',Reimbursement:'arrow-down','Opening balance':'wallet'}[entry.type];
      const route = entry.type === 'Transfer' ? `${byId(entry.from).name} → ${byId(entry.to).name}` : byId(entry.from || entry.to).name;
      const sign = entry.type === 'Spending' ? '−' : entry.type === 'Transfer' ? '↔' : '+';
      return `<div class="entry"><span class="entry-icon ${tone}">${walletIcon(iconName)}</span><div class="entry-text"><b>${esc(entry.label)}</b><small>${esc(entry.type)} · ${esc(route)}</small></div><div class="entry-amount num ${tone}">${sign} ${money(entry.amount)}${entry.share !== undefined ? `<small>Your share ${money(entry.share)}</small>` : ''}</div></div>`;
    }).join('')}`;
  }).join('') : `<div class="empty">${walletIcon('list')}<p>Your recorded payments and receipts will appear here.</p><button class="linkbtn" data-action="income">Add income</button></div>`;
  requestAnimationFrame(syncCarouselButtons);
}

function syncWalletNavigation(name) {
  document.body.dataset.page = name;
  const titles = {overview:['My Money','A clear view of your everyday money.'],wallets:['My wallets','Every balance, in one place.'],activity:['Money activity','Your payments, receipts, and transfers.'],budgets:['My budgets','Give your money a purpose.']};
  document.getElementById('page-title').textContent = titles[name][0];
  document.getElementById('page-subtitle').textContent = titles[name][1];
  document.querySelectorAll('.money-bottom-nav [data-go]').forEach(button => {
    if (button.dataset.go === name) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  requestAnimationFrame(syncCarouselButtons);
}

function syncCarouselButtons() {
  const carousel = document.getElementById('all-wallets');
  document.getElementById('wallet-previous').disabled = carousel.scrollLeft <= 1;
  document.getElementById('wallet-next').disabled = carousel.scrollLeft + carousel.clientWidth >= carousel.scrollWidth - 1;
}

const carousel = document.getElementById('all-wallets');
carousel.addEventListener('scroll', syncCarouselButtons, {passive:true});
window.addEventListener('resize', syncCarouselButtons);
for (const [id, direction] of [['wallet-previous',-1],['wallet-next',1]]) {
  document.getElementById(id).onclick = () => carousel.scrollBy({left:direction * (carousel.querySelector('.balance-card')?.offsetWidth || carousel.clientWidth),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
}
const quickDialog = document.getElementById('quick-dialog');
document.getElementById('mobile-add').onclick = () => quickDialog.showModal();
document.getElementById('close-quick-dialog').onclick = () => quickDialog.close();
quickDialog.addEventListener('click', event => { if (event.target.closest('[data-action]')) quickDialog.close(); });
document.querySelector('.money-bottom-nav').addEventListener('click', event => {
  if (event.target.closest('[data-go]')) { window.scrollTo({top:0,behavior:'instant'}); document.getElementById('page-title').tabIndex = -1; document.getElementById('page-title').focus({preventScroll:true}); }
});
renderWalletPage();
tab('wallets');
