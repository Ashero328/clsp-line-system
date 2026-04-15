// ============================================================
// script.js — UI Layer (Renderers, Events, Init)
// Depends on: customer_script.js (storage + algorithm)
// ============================================================

// ── Currency Definitions ────────────────────────────────────
const CURRENCIES = [
  { code: 'TWD', name: '新台幣', symbol: 'NT$' },
  { code: 'USD', name: '美元',   symbol: '$'   },
  { code: 'JPY', name: '日圓',   symbol: '¥'   },
  { code: 'EUR', name: '歐元',   symbol: '€'   },
  { code: 'CNY', name: '人民幣', symbol: '¥'   },
  { code: 'HKD', name: '港幣',   symbol: 'HK$' },
  { code: 'KRW', name: '韓元',   symbol: '₩'   },
  { code: 'SGD', name: '新加坡幣', symbol: 'S$' },
  { code: 'GBP', name: '英鎊',   symbol: '£'   },
  { code: 'AUD', name: '澳幣',   symbol: 'A$'  },
  { code: 'MYR', name: '馬幣',   symbol: 'RM'  },
];
function currencySymbol(code) {
  return (CURRENCIES.find(c => c.code === code) || { symbol: code }).symbol;
}

// ── Block 3: App State ──────────────────────────────────────
const AppState = {
  currentProjectId:       null,
  currentExpenseId:       null,
  pendingMembers:         [],
  pendingAlgorithm:       'itemized',
  pendingCoverImage:      null,
  pendingDate:            null,
  currentExpenseIcon:     'receipt_long',
  liffProfile:            null,
  currentSplitType:       'all',
  editingProjectId:       null,
  projectCurrencySymbol:  'NT$',
  projectBaseCurrency:    'TWD',
};

// ── Block 4: Navigation ─────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const t = document.getElementById(id);
  if (t) t.classList.add('active');
}

// ── Block 5: Helpers ────────────────────────────────────────
function esc(s) {
  return String(s || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function fmtAmt(n) {
  return Number(n || 0).toLocaleString('zh-TW', { maximumFractionDigits: 0 });
}
function fmtDate(s) {
  if (!s) return '';
  const d = new Date(s.includes('T') ? s : s + 'T00:00:00');
  if (isNaN(d.getTime())) return s;
  return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
}
function splitDesc(e, members) {
  if (e.splitType === 'all') return `全體 ${members.length} 人均分`;
  if (e.splitType === 'except') {
    const excl = e.splitMembers.map(id => (members.find(m=>m.id===id)||{name:'?'}).name).join('、');
    return `排除 ${excl}，${members.length - e.splitMembers.length} 人均分`;
  }
  const incl = e.splitMembers.map(id => (members.find(m=>m.id===id)||{name:'?'}).name).join('、');
  return `指定 ${incl} 均分`;
}

function iconColorClass(icon) {
  const map = {
    'restaurant':              'food',
    'fastfood':                'fastfood',
    'local_cafe':              'cafe',
    'cake':                    'sweet',
    'hotel':                   'hotel',
    'local_taxi':              'transport',
    'train':                   'transport',
    'local_convenience_store': 'store',
    'shopping_bag':            'shopping',
    'movie':                   'movie',
    'flight':                  'flight',
    'sports':                  'sports',
    'local_hospital':          'health',
    'celebration':             'fun',
    'directions_car':          'car',
    'receipt_long':            'bill',
    'data_object':             'default',
  };
  return map[icon] || 'default';
}

// ── Block 6: Renderers ──────────────────────────────────────
function renderHomeScreen() {
  const projects = getAllProjects();
  const list     = document.getElementById('home-project-list');
  const empty    = document.getElementById('home-empty-state');
  const count    = document.getElementById('home-project-count');
  count.textContent = `${projects.length} 個`;

  if (projects.length === 0) {
    list.innerHTML = '';
    empty.style.display = 'flex';
    return;
  }
  empty.style.display = 'none';

  list.innerHTML = projects.map(p => {
    const coverHtml = p.coverImage
      ? `<img src="${p.coverImage}" alt="" class="w-full h-full object-cover" />`
      : `<div class="w-full h-full flex items-center justify-center nm-thumbnail">
          <span class="material-symbols-outlined txt-5xl clr-muted" style="opacity:0.12;">receipt_long</span>
        </div>`;
    return `
      <div class="cursor-pointer project-card project-card-wrap" data-pid="${p.id}">
        <div class="h-48 overflow-hidden">
          ${coverHtml}
        </div>
        <div class="p-6 flex flex-col">
          <h3 class="project-card-title font-headline">${esc(p.name)}</h3>
          <p class="project-card-date font-body">${fmtDate(p.createdDate)}</p>
          <span class="project-card-badge font-label">成員: ${p.members.length} 人</span>
          <div class="flex gap-3 mt-5">
            <button class="edit-project-btn project-card-btn edit font-headline" data-pid="${p.id}">編輯</button>
            <button class="delete-project-btn project-card-btn delete font-headline" data-pid="${p.id}">刪除</button>
          </div>
        </div>
      </div>`;
  }).join('');

  list.querySelectorAll('.project-card').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('.delete-project-btn')) return;
      if (e.target.closest('.edit-project-btn'))   return;
      navigateToProject(card.dataset.pid);
    });
  });
  list.querySelectorAll('.edit-project-btn').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); openEditProjectForm(btn.dataset.pid); });
  });
  list.querySelectorAll('.delete-project-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      if (confirm('確定要刪除這個專案？所有帳目將一併刪除。')) {
        deleteProject(btn.dataset.pid);
        renderHomeScreen();
      }
    });
  });
}

function renderProjectDetail(pid) {
  const project = getAllProjects().find(p => p.id === pid);
  if (!project) { showScreen('screen-home'); return; }
  const expenses = getExpenses(pid);
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const avg   = project.members.length ? Math.round(total / project.members.length) : 0;
  const sym   = AppState.projectCurrencySymbol;

  document.getElementById('detail-project-name').textContent  = project.name;
  document.getElementById('detail-total-amount').textContent  = fmtAmt(total);
  document.getElementById('detail-expense-count').textContent = expenses.length;
  document.getElementById('detail-avg-amount').textContent    = sym + fmtAmt(avg);
  // Update currency unit in banner
  const unitEl = document.getElementById('detail-currency-unit');
  if (unitEl) unitEl.textContent = sym;

  const algoBadge = document.getElementById('detail-algo-badge');
  if (project.algorithm === 'itemized') {
    algoBadge.innerHTML = `<span class="chip-inactive inline-flex items-center gap-1 rounded-full px-3 py-1 font-label font-semibold txt-md"><span class="material-symbols-outlined txt-sm">receipt</span>逐筆抵銷法</span>`;
  } else {
    algoBadge.innerHTML = `<span class="badge-roundtable inline-flex items-center gap-1 rounded-full px-3 py-1 font-label font-semibold txt-md"><span class="material-symbols-outlined txt-sm">table_restaurant</span>圓桌法</span>`;
  }

  const list  = document.getElementById('expense-list');
  const empty = document.getElementById('expense-empty-state');
  if (expenses.length === 0) {
    list.innerHTML = '';
    empty.style.display = 'flex';
    return;
  }
  empty.style.display = 'none';

  list.innerHTML = [...expenses]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .map(e => {
      const payer    = project.members.find(m => m.id === e.payerId);
      const iconKey  = e.icon || detectIcon(e.name);
      const iconCls  = iconColorClass(iconKey);
      const origLine = (e.currency && e.currency !== AppState.projectBaseCurrency && e.originalAmount != null)
        ? `<p class="font-label txt-xs clr-muted mt-0.5">${e.originalAmount} ${e.currency}</p>`
        : '';
      return `
        <div class="expense-card">
          <div class="flex items-center gap-4">
            <div class="exp-icon ${iconCls}">
              <span class="material-symbols-outlined" style="font-variation-settings:'FILL' 1;">${iconKey}</span>
            </div>
            <div class="flex-1 min-w-0">
              <p class="expense-name font-headline">${esc(e.name)}</p>
              <div class="flex items-center gap-2 mt-1 flex-wrap">
                <span class="expense-meta font-label">由 <b>${esc(payer ? payer.name : '?')}</b> 支付</span>
                <span class="w-1 h-1 rounded-full flex-shrink-0" style="background:var(--clr-outline-var);"></span>
                <span class="expense-meta font-label">${fmtDate(e.date)}</span>
              </div>
              <p class="font-label txt-base clr-muted mt-1">${esc(splitDesc(e, project.members))}</p>
            </div>
            <div class="flex flex-col items-end gap-2 flex-shrink-0">
              <div class="text-right">
                <p class="expense-amt-lbl font-label">金額</p>
                <p class="expense-amount font-headline">${sym}${fmtAmt(e.amount)}</p>
                ${origLine}
              </div>
              <div class="flex gap-1.5">
                <button class="edit-exp-btn btn-edit-sm w-9 h-9 rounded-xl flex items-center justify-center" data-eid="${e.id}">
                  <span class="material-symbols-outlined txt-body">edit</span>
                </button>
                <button class="del-exp-btn btn-delete-sm w-9 h-9 rounded-xl flex items-center justify-center" data-eid="${e.id}">
                  <span class="material-symbols-outlined txt-body">delete</span>
                </button>
              </div>
            </div>
          </div>
        </div>`;
    }).join('');

  list.querySelectorAll('.edit-exp-btn').forEach(b =>
    b.addEventListener('click', () => navigateToExpenseForm(pid, b.dataset.eid)));
  list.querySelectorAll('.del-exp-btn').forEach(b =>
    b.addEventListener('click', () => {
      if (confirm('確定要刪除這筆帳目？')) {
        deleteExpense(pid, b.dataset.eid);
        renderProjectDetail(pid);
      }
    }));
}

function updateConversionPreview(settings) {
  const preview  = document.getElementById('expense-conversion-preview');
  const amount   = parseFloat(document.getElementById('input-expense-amount').value) || 0;
  const currency = document.getElementById('input-expense-currency')?.value;
  const base     = settings.baseCurrency || 'TWD';
  if (!preview) return;
  if (!currency || currency === base || amount <= 0) {
    preview.classList.add('hidden');
    return;
  }
  const rate      = settings.rates?.[currency] || 1;
  const converted = Math.round(amount * rate);
  const sym       = currencySymbol(base);
  preview.classList.remove('hidden');
  preview.textContent = `≈ ${sym}${fmtAmt(converted)}（匯率 1 ${currency} = ${rate} ${base}）`;
}

function renderExpenseForm(pid, eid) {
  const project  = getAllProjects().find(p => p.id === pid);
  if (!project) return;
  const settings = getProjectSettings(pid);
  const isEdit   = !!eid;
  const expense  = isEdit ? getExpenses(pid).find(e => e.id === eid) : null;

  document.getElementById('expense-form-title').textContent = isEdit ? '編輯帳目' : '新增帳目';
  const expName = expense?.name || '';
  document.getElementById('input-expense-name').value   = expName;
  document.getElementById('input-expense-date').value   = expense?.date || new Date().toISOString().split('T')[0];

  // Currency selector
  const currSel = document.getElementById('input-expense-currency');
  const defCurr = expense?.currency || settings.defaultInputCurrency || settings.baseCurrency || 'TWD';
  currSel.innerHTML = CURRENCIES.map(c =>
    `<option value="${c.code}" ${c.code === defCurr ? 'selected' : ''}>${c.code}</option>`
  ).join('');

  // Amount: show original amount if non-base currency, otherwise base amount
  const baseCurr = settings.baseCurrency || 'TWD';
  if (expense) {
    if (expense.currency && expense.currency !== baseCurr && expense.originalAmount != null) {
      document.getElementById('input-expense-amount').value = expense.originalAmount;
    } else {
      document.getElementById('input-expense-amount').value = expense.amount || '';
    }
  } else {
    document.getElementById('input-expense-amount').value = '';
  }

  updateConversionPreview(settings);
  currSel.addEventListener('change', () => updateConversionPreview(settings));
  document.getElementById('input-expense-amount').addEventListener('input', () => updateConversionPreview(settings));

  const initIcon = expense?.icon || (expName ? detectIcon(expName) : 'receipt_long');
  AppState.currentExpenseIcon = initIcon;
  const iconEl = document.getElementById('icon-picker-current');
  if (iconEl) iconEl.textContent = initIcon;

  const payerSel = document.getElementById('payer-selector');
  payerSel.innerHTML = project.members.map(m => {
    const isSel = expense?.payerId === m.id;
    return `<button class="payer-chip rounded-full px-4 py-2 font-label font-semibold transition-all ${isSel ? 'payer-selected' : 'chip-inactive'}" style="font-size:15px;" data-mid="${m.id}">${esc(m.name)}</button>`;
  }).join('');
  payerSel.querySelectorAll('.payer-chip').forEach(c => {
    c.addEventListener('click', () => {
      payerSel.querySelectorAll('.payer-chip').forEach(x => {
        x.className = x.className.replace('payer-selected', 'chip-inactive');
      });
      c.className = c.className.replace('chip-inactive', 'payer-selected');
      updateSplitPreview(project);
    });
  });

  const initSplit = expense?.splitType || 'all';
  AppState.currentSplitType = initSplit;
  updateSplitTabs(initSplit);
  renderSplitMemberChips(project, expense?.splitMembers || []);

  document.querySelectorAll('[data-split]').forEach(tab => {
    tab.addEventListener('click', () => {
      AppState.currentSplitType = tab.dataset.split;
      updateSplitTabs(tab.dataset.split);
      renderSplitMemberChips(project, []);
      updateSplitPreview(project);
    });
  });

  document.getElementById('input-expense-amount').addEventListener('input', () => updateSplitPreview(project));
}

function updateSplitTabs(active) {
  ['all', 'except', 'include'].forEach(t => {
    const el = document.getElementById('split-tab-' + t);
    if (el) {
      el.className = el.className.replace(/split-tab-(active|inactive)/g, '');
      el.className += ' ' + (t === active ? 'split-tab-active' : 'split-tab-inactive');
    }
  });
  const panel = document.getElementById('split-detail-panel');
  const label = document.getElementById('split-panel-label');
  if (active === 'all') {
    panel.style.display = 'none';
  } else {
    panel.style.display = 'flex';
    label.textContent = active === 'except' ? '選擇排除的成員（其餘人均分）' : '選擇參與分攤的成員';
  }
}

function renderSplitMemberChips(project, selected) {
  const container = document.getElementById('split-member-chips');
  container.innerHTML = project.members.map(m => {
    const isSel = selected.includes(m.id);
    return `<button class="split-member-chip rounded-full px-4 py-2 font-label font-semibold transition-all ${isSel ? 'payer-selected' : 'chip-inactive'}" style="font-size:15px;" data-mid="${m.id}">${esc(m.name)}</button>`;
  }).join('');
  container.querySelectorAll('.split-member-chip').forEach(c => {
    c.addEventListener('click', () => {
      c.className = c.className.includes('payer-selected')
        ? c.className.replace('payer-selected', 'chip-inactive')
        : c.className.replace('chip-inactive', 'payer-selected');
      updateSplitPreview(project);
    });
  });
  updateSplitPreview(project);
}

function updateSplitPreview(project) {
  const amount    = parseFloat(document.getElementById('input-expense-amount').value) || 0;
  const splitType = AppState.currentSplitType;
  const selectedIds = Array.from(document.querySelectorAll('.split-member-chip.payer-selected')).map(c => c.dataset.mid);

  let pids;
  if (splitType === 'all')    pids = project.members.map(m => m.id);
  else if (splitType === 'except') pids = project.members.map(m => m.id).filter(id => !selectedIds.includes(id));
  else pids = selectedIds;

  const preview = document.getElementById('split-preview');
  if (pids.length === 0) { preview.textContent = '請選擇分攤成員'; return; }
  const share = amount > 0 ? Math.floor(amount / pids.length) : 0;
  const names = pids.map(id => (project.members.find(m => m.id === id) || {name:'?'}).name);
  preview.textContent = `由 ${names.join('、')} ${pids.length} 人均分，每人 ${AppState.projectCurrencySymbol}${fmtAmt(share)}`;
}

function exportExpensesCSV(pid) {
  const project  = getAllProjects().find(p => p.id === pid);
  if (!project) return;
  const expenses = getExpenses(pid);
  const nameOf   = {};
  project.members.forEach(m => { nameOf[m.id] = m.name; });

  const iconLabel = {};
  EXPENSE_ICONS.forEach(e => { iconLabel[e.icon] = e.label; });

  const headers = ['日期', '項目名稱', '類別', '金額', '貨幣', '原始金額', '匯率', '代墊人', '分攤成員'];
  const rows = expenses.map(e => {
    const pids = getParticipants(e, project.members);
    const participants = pids.map(id => nameOf[id] || id).join('、');
    return [
      e.date        || '',
      e.name        || '',
      iconLabel[e.icon] || e.icon || '',
      e.amount      ?? '',
      e.currency    || '',
      e.originalAmount != null ? e.originalAmount : '',
      e.rate        != null ? e.rate : '',
      nameOf[e.payerId] || e.payerId || '',
      participants
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
  });

  const csv      = '\uFEFF' + [headers.join(','), ...rows].join('\n');
  const filename = `${project.name || 'ClearSplit'}_帳目.csv`;
  const isLine   = /Line\//i.test(navigator.userAgent);

  if (isLine) {
    // LINE 內建瀏覽器不支援 Blob 下載，改用 data: URI
    const dataUri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    const a = document.createElement('a');
    a.href = dataUri;
    a.download = filename;
    a.click();
    // 若 data: URI 仍被擋，fallback：開新視窗讓使用者長按儲存
    setTimeout(() => {
      try {
        const w = window.open(dataUri, '_blank');
        if (!w) {
          alert('請點擊右上角選單 → 「以瀏覽器開啟」後再試一次匯出。');
        }
      } catch (_) {
        alert('請點擊右上角選單 → 「以瀏覽器開啟」後再試一次匯出。');
      }
    }, 800);
  } else {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}

function renderSettlement(pid) {
  const project  = getAllProjects().find(p => p.id === pid);
  if (!project) return;
  const expenses = getExpenses(pid);
  const total    = expenses.reduce((s, e) => s + e.amount, 0);

  const sym = AppState.projectCurrencySymbol;
  document.getElementById('stat-total').textContent    = sym + fmtAmt(total);
  document.getElementById('stat-members').textContent  = project.members.length + ' 人';
  document.getElementById('stat-expenses').textContent = expenses.length + ' 筆';

  const isRound = project.algorithm === 'roundtable';
  document.getElementById('algo-icon-display').textContent = isRound ? 'table_restaurant' : 'receipt_long';
  document.getElementById('algo-name-display').textContent = isRound ? '圓桌法（淨額法）' : '逐筆抵銷法';
  document.getElementById('algo-desc-display').textContent = isRound ? '計算最終淨額，以最少筆數轉帳結清' : '保留每筆支出的債務來源細節';
  document.getElementById('btn-toggle-algo-label').textContent = isRound ? '切換逐筆' : '切換圓桌';

  const list       = document.getElementById('settlement-balance-list');
  const allSettled = document.getElementById('settlement-all-settled');

  if (expenses.length === 0) {
    list.innerHTML = '';
    allSettled.style.display = 'flex';
    return;
  }
  allSettled.style.display = 'none';

  const settled = getSettledTx(pid);

  if (isRound) {
    const { netBalances, transactions } = calculateRoundtable(project.members, expenses);
    if (transactions.length === 0) { list.innerHTML = ''; allSettled.style.display = 'flex'; return; }

    const balanceChips = netBalances.map(nb => {
      const cls  = nb.balance > 0.01 ? 'debt-creditor' : nb.balance < -0.01 ? 'debt-debtor' : 'chip-inactive';
      const sign = nb.balance > 0.01 ? '+' : '';
      return `<span class="rounded-full px-3 py-1.5 font-label font-bold txt-md ${cls}">${esc(nb.memberName)} ${sign}${sym}${fmtAmt(Math.abs(nb.balance))}</span>`;
    }).join('');

    const txRows = transactions.map(t => {
      const key = `rt|${t.debtorName}|${t.creditorName}`;
      const done = settled.has(key);
      return `
      <div class="nm-card rounded-3xl p-5 flex items-center gap-3 flex-wrap${done ? ' tx-settled' : ''}" data-tx-key="${esc(key)}">
        <span class="debt-debtor rounded-full px-3 py-1.5 font-label font-bold txt-md">${esc(t.debtorName)}</span>
        <span class="material-symbols-outlined flex-shrink-0 clr-primary">arrow_forward</span>
        <span class="debt-creditor rounded-full px-3 py-1.5 font-label font-bold txt-md">${esc(t.creditorName)}</span>
        <span class="font-headline font-bold ml-auto txt-xl clr-primary">${sym}${fmtAmt(t.amount)}</span>
        <button class="settle-btn${done ? ' settled' : ''}" data-tx-key="${esc(key)}">
          <span class="material-symbols-outlined txt-xl" style="font-variation-settings:'FILL' ${done ? 1 : 0};">check_circle</span>
        </button>
      </div>`;
    }).join('');

    list.innerHTML = `
      <div>
        <p class="section-label font-label mb-3">淨額概覽</p>
        <div class="flex flex-wrap gap-2 mb-5">${balanceChips}</div>
        <p class="section-label font-label mb-3">最少轉帳方案</p>
        <div class="flex flex-col gap-3">${txRows}</div>
      </div>`;
  } else {
    const result   = calculateItemized(project.members, expenses);
    const allEmpty = result.every(r => r.debts.length === 0);
    if (allEmpty) { list.innerHTML = ''; allSettled.style.display = 'flex'; return; }

    list.innerHTML = result.filter(r => r.debts.length > 0).map(r => {
      const rows = r.debts.map(d => {
        const key = `it|${r.expenseId}|${d.debtorName}|${d.creditorName}`;
        const done = settled.has(key);
        return `
        <div class="flex items-center gap-2 mt-2 pl-1 flex-wrap${done ? ' tx-settled' : ''}" data-tx-key="${esc(key)}">
          <span class="debt-debtor rounded-full px-2.5 py-1 font-label font-bold txt-base">${esc(d.debtorName)}</span>
          <span class="material-symbols-outlined txt-xl clr-muted">arrow_forward</span>
          <span class="debt-creditor rounded-full px-2.5 py-1 font-label font-bold txt-base">${esc(d.creditorName)}</span>
          <span class="font-label font-semibold ml-auto txt-md clr-surface">${sym}${fmtAmt(d.amount)}</span>
          <button class="settle-btn${done ? ' settled' : ''}" data-tx-key="${esc(key)}">
            <span class="material-symbols-outlined txt-xl" style="font-variation-settings:'FILL' ${done ? 1 : 0};">check_circle</span>
          </button>
        </div>`;
      }).join('');
      return `
        <div class="nm-card rounded-3xl p-5">
          <div class="flex items-center gap-2 mb-1">
            <span class="material-symbols-outlined txt-xl clr-primary">receipt</span>
            <span class="font-headline font-semibold txt-body flex-1 clr-surface">${esc(r.expenseName)}</span>
            <span class="font-headline font-bold txt-body clr-primary">${sym}${fmtAmt(r.expenseAmount)}</span>
          </div>
          ${rows}
        </div>`;
    }).join('');
  }
}

// ── Block 7: Navigation Helpers ─────────────────────────────
function navigateToProject(pid) {
  AppState.currentProjectId = pid;
  const settings = getProjectSettings(pid);
  AppState.projectBaseCurrency   = settings.baseCurrency || 'TWD';
  AppState.projectCurrencySymbol = currencySymbol(settings.baseCurrency || 'TWD');
  renderProjectDetail(pid);
  showScreen('screen-project-detail');
}
function navigateToExpenseForm(pid, eid) {
  AppState.currentExpenseId = eid;
  renderExpenseForm(pid, eid);
  showScreen('screen-expense-form');
}
function navigateToSettings(pid) {
  AppState.currentProjectId = pid;
  renderSettings(pid);
  showScreen('screen-settings');
}

// ── Block 7b: Settings Renderer ─────────────────────────────
function renderSettings(pid) {
  const settings    = getProjectSettings(pid);
  const baseCurr    = settings.baseCurrency || 'TWD';
  const defInput    = settings.defaultInputCurrency || baseCurr;

  const optionsBase = CURRENCIES.map(c =>
    `<option value="${c.code}" ${c.code === baseCurr ? 'selected' : ''}>${c.symbol} ${c.name}（${c.code}）</option>`
  ).join('');
  document.getElementById('settings-base-currency').innerHTML = optionsBase;

  const optionsDef = CURRENCIES.map(c =>
    `<option value="${c.code}" ${c.code === defInput ? 'selected' : ''}>${c.symbol} ${c.name}（${c.code}）</option>`
  ).join('');
  document.getElementById('settings-default-input-currency').innerHTML = optionsDef;

  // Re-render rates when base currency changes
  document.getElementById('settings-base-currency').onchange = () => renderRatesList(pid, settings);

  renderRatesList(pid, settings);
}

function renderRatesList(pid, settings) {
  const baseCurr  = document.getElementById('settings-base-currency').value;
  const ratesList = document.getElementById('settings-rates-list');

  ratesList.innerHTML = CURRENCIES.filter(c => c.code !== baseCurr).map(c => {
    const rate = settings.rates?.[c.code] || 1;
    return `
      <div class="settings-rate-row">
        <div class="flex items-center gap-2">
          <span class="txt-lg font-headline font-bold clr-bright">${c.code}</span>
          <span class="txt-sm clr-muted font-label">${c.name}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="txt-xs clr-muted font-label">= </span>
          <input type="number" step="0.0001" min="0"
            class="settings-rate-input"
            data-currency="${c.code}"
            value="${rate}" />
          <span class="txt-xs clr-muted font-label">${baseCurr}</span>
        </div>
      </div>`;
  }).join('');
}

// ── Block 8: Pending Member UI ──────────────────────────────
function renderPendingMemberChips() {
  const container = document.getElementById('member-chip-list');
  const badge     = document.getElementById('member-count-badge');
  badge.textContent = AppState.pendingMembers.length + ' 人';
  if (AppState.pendingMembers.length === 0) {
    container.innerHTML = `<span class="font-label" style="font-size:14px; color:var(--clr-on-surface-var); opacity:0.4;">新增成員後顯示於此</span>`;
    return;
  }
  container.innerHTML = AppState.pendingMembers.map(m => {
    const roleLabel = m.role === 'viewer' ? '檢視' : '編輯';
    return `
      <span class="member-chip">
        ${esc(m.name)}
        <span class="role-badge ${m.role === 'viewer' ? 'viewer' : 'editor'}">${roleLabel}</span>
        <button class="remove-member-btn remove-btn" data-mid="${m.id}">
          <span class="material-symbols-outlined" style="font-size:17px;">close</span>
        </button>
      </span>`;
  }).join('');
  container.querySelectorAll('.remove-member-btn').forEach(b => {
    b.addEventListener('click', () => {
      AppState.pendingMembers = AppState.pendingMembers.filter(m => m.id !== b.dataset.mid);
      renderPendingMemberChips();
    });
  });
}

function resetCreateForm() {
  const today = new Date().toISOString().slice(0, 10);
  document.getElementById('input-project-date').value  = today;
  document.getElementById('input-project-name').value  = '';
  document.getElementById('input-new-member-name').value = '';
  document.getElementById('input-cover-image').value   = '';
  AppState.pendingMembers    = [];
  AppState.pendingAlgorithm  = 'itemized';
  AppState.pendingCoverImage = null;
  AppState.pendingDate       = today;
  AppState.editingProjectId  = null;
  renderPendingMemberChips();

  const titleEl  = document.getElementById('create-project-title');
  const submitBtn= document.getElementById('btn-create-project-submit');
  if (titleEl)   titleEl.textContent  = '新增專案';
  if (submitBtn) submitBtn.textContent = '建立專案';

  document.getElementById('algo-card-itemized').classList.add('algo-selected');
  document.getElementById('algo-card-roundtable').classList.remove('algo-selected');
  document.getElementById('cover-image-preview').classList.add('hidden');
  document.getElementById('cover-image-preview').src = '';
  document.getElementById('cover-image-placeholder').style.display = '';
  document.getElementById('btn-remove-cover').classList.add('hidden');
}

function compressImage(file, maxPx, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = ev => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > maxPx || h > maxPx) {
          if (w > h) { h = Math.round(h * maxPx / w); w = maxPx; }
          else       { w = Math.round(w * maxPx / h); h = maxPx; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ── Block 9: Event Bindings ─────────────────────────────────
function openEditProjectModal(pid) {
  const project = getAllProjects().find(p => p.id === pid);
  if (!project) return;
  AppState.currentProjectId = pid;

  const container = document.getElementById('edit-modal-members');
  function renderEditChips() {
    const proj = getAllProjects().find(p => p.id === pid);
    container.innerHTML = (proj?.members || []).map(m => {
      const roleLabel = m.role === 'viewer' ? '檢視' : '編輯';
      return `
        <span class="member-chip">
          ${esc(m.name)}
          <span class="role-badge ${m.role === 'viewer' ? 'viewer' : 'editor'}">${roleLabel}</span>
        </span>`;
    }).join('');
  }
  renderEditChips();
  document.getElementById('input-edit-member-name').value = '';
  document.getElementById('modal-edit-project').classList.remove('hidden');
  document.getElementById('modal-edit-project').classList.add('flex');

  document.getElementById('btn-edit-add-member').onclick = () => {
    const name = document.getElementById('input-edit-member-name').value.trim();
    const role = document.getElementById('select-edit-member-role')?.value || 'editor';
    if (!name) return;
    const proj = getAllProjects().find(p => p.id === pid);
    if (!proj) return;
    proj.members.push({ id: generateId(), name, role });
    saveProject(proj);
    document.getElementById('input-edit-member-name').value = '';
    renderEditChips();
  };
  document.getElementById('btn-edit-modal-save').onclick  = () => closeEditModal();
  document.getElementById('btn-edit-modal-close').onclick = () => closeEditModal();
}
function closeEditModal() {
  const m = document.getElementById('modal-edit-project');
  m.classList.add('hidden');
  m.classList.remove('flex');
  renderHomeScreen();
}

function openEditProjectForm(pid) {
  const project = getAllProjects().find(p => p.id === pid);
  if (!project) return;
  AppState.editingProjectId = pid;
  document.getElementById('input-project-date').value = project.createdDate.split('T')[0];
  document.getElementById('input-project-name').value = project.name;
  AppState.pendingMembers    = project.members.map(m => ({ ...m }));
  AppState.pendingCoverImage = project.coverImage || null;
  renderPendingMemberChips();

  const preview = document.getElementById('cover-image-preview');
  if (project.coverImage) {
    preview.src = project.coverImage;
    preview.classList.remove('hidden');
    document.getElementById('cover-image-placeholder').style.display = 'none';
    document.getElementById('btn-remove-cover').classList.remove('hidden');
  } else {
    preview.classList.add('hidden');
    preview.src = '';
    document.getElementById('cover-image-placeholder').style.display = '';
    document.getElementById('btn-remove-cover').classList.add('hidden');
  }

  AppState.pendingAlgorithm = project.algorithm;
  document.getElementById('algo-card-itemized').classList.toggle('algo-selected', project.algorithm === 'itemized');
  document.getElementById('algo-card-roundtable').classList.toggle('algo-selected', project.algorithm === 'roundtable');

  const titleEl  = document.getElementById('create-project-title');
  const submitBtn= document.getElementById('btn-create-project-submit');
  if (titleEl)   titleEl.textContent  = '編輯專案';
  if (submitBtn) submitBtn.textContent = '儲存變更';
  showScreen('screen-create-project');
}

// ── Icon Picker ──────────────────────────────────────────────
function buildIconPicker() {
  const grid    = document.querySelector('#icon-picker-popup .grid');
  const allIcons = [...EXPENSE_ICONS, { icon: ICON_FALLBACK, label: '其他' }];
  grid.innerHTML = allIcons.map(item => `
    <button class="icon-pick-btn w-11 h-11 rounded-2xl flex items-center justify-center"
      data-icon="${item.icon}" title="${item.label}">
      <span class="material-symbols-outlined" style="font-size:20px; font-variation-settings:'FILL' 1;">${item.icon}</span>
    </button>`).join('');
  grid.querySelectorAll('.icon-pick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      AppState.currentExpenseIcon = btn.dataset.icon;
      document.getElementById('icon-picker-current').textContent = btn.dataset.icon;
      closeIconPicker();
    });
  });
}
function closeIconPicker() {
  document.getElementById('icon-picker-popup').classList.add('hidden');
}

// ── Main Event Binding ───────────────────────────────────────
function bindAllEvents() {
  // Home
  document.getElementById('btn-new-project').addEventListener('click', () => {
    resetCreateForm();
    showScreen('screen-create-project');
  });

  // Create Project — back
  document.getElementById('btn-create-project-back').addEventListener('click', () => {
    AppState.editingProjectId = null;
    const titleEl  = document.getElementById('create-project-title');
    const submitBtn= document.getElementById('btn-create-project-submit');
    if (titleEl)   titleEl.textContent  = '新增專案';
    if (submitBtn) submitBtn.textContent = '建立專案';
    showScreen('screen-home');
  });

  // Add member
  document.getElementById('btn-add-member').addEventListener('click', () => {
    const inp  = document.getElementById('input-new-member-name');
    const role = document.getElementById('select-member-role')?.value || 'editor';
    const name = inp.value.trim();
    if (!name) return;
    AppState.pendingMembers.push({ id: generateId(), name, role });
    inp.value = '';
    renderPendingMemberChips();
  });
  document.getElementById('input-new-member-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('btn-add-member').click();
  });

  // Algo selection
  document.querySelectorAll('[data-algo]').forEach(card => {
    card.addEventListener('click', () => {
      AppState.pendingAlgorithm = card.dataset.algo;
      document.getElementById('algo-card-itemized').classList.toggle('algo-selected', card.dataset.algo === 'itemized');
      document.getElementById('algo-card-roundtable').classList.toggle('algo-selected', card.dataset.algo === 'roundtable');
    });
  });

  // Cover image upload
  document.getElementById('cover-image-zone').addEventListener('click', () => {
    document.getElementById('input-cover-image').click();
  });
  document.getElementById('input-cover-image').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('圖片超過 5MB，請選擇較小的圖片'); e.target.value = ''; return; }
    try {
      const compressed = await compressImage(file, 1200, 0.82);
      AppState.pendingCoverImage = compressed;
      const preview = document.getElementById('cover-image-preview');
      preview.src = compressed;
      preview.classList.remove('hidden');
      document.getElementById('cover-image-placeholder').style.display = 'none';
      document.getElementById('btn-remove-cover').classList.remove('hidden');
    } catch {
      alert('圖片處理失敗，請重試');
      e.target.value = '';
    }
  });
  document.getElementById('btn-remove-cover').addEventListener('click', e => {
    e.stopPropagation();
    AppState.pendingCoverImage = null;
    document.getElementById('input-cover-image').value = '';
    document.getElementById('cover-image-preview').classList.add('hidden');
    document.getElementById('cover-image-preview').src = '';
    document.getElementById('cover-image-placeholder').style.display = '';
    document.getElementById('btn-remove-cover').classList.add('hidden');
  });

  // Date sync
  document.getElementById('input-project-date').addEventListener('change', e => {
    AppState.pendingDate = e.target.value;
  });

  // Submit create/edit project
  document.getElementById('btn-create-project-submit').addEventListener('click', () => {
    const date = document.getElementById('input-project-date').value;
    const name = document.getElementById('input-project-name').value.trim();
    if (!date)                              { alert('請選擇日期'); return; }
    if (!name)                              { alert('請輸入專案名稱'); return; }
    if (AppState.pendingMembers.length < 2) { alert('至少需要 2 位成員'); return; }

    if (AppState.editingProjectId) {
      const projects = getAllProjects();
      const p = projects.find(x => x.id === AppState.editingProjectId);
      if (p) {
        p.name        = name;
        p.createdDate = date + 'T00:00:00.000Z';
        p.members     = AppState.pendingMembers.slice();
        p.algorithm   = AppState.pendingAlgorithm;
        p.coverImage  = AppState.pendingCoverImage || null;
        saveProject(p);
      }
      AppState.editingProjectId = null;
    } else {
      saveProject({
        id: generateId(), name,
        createdDate: date + 'T00:00:00.000Z',
        members:    AppState.pendingMembers.slice(),
        algorithm:  AppState.pendingAlgorithm,
        coverImage: AppState.pendingCoverImage || null,
        status:     'active'
      });
    }
    renderHomeScreen();
    showScreen('screen-home');
  });

  // Project detail navigation
  document.getElementById('btn-project-detail-back').addEventListener('click', () => { renderHomeScreen(); showScreen('screen-home'); });
  document.getElementById('detail-nav-home').addEventListener('click', () => { renderHomeScreen(); showScreen('screen-home'); });
  document.getElementById('detail-nav-settlement').addEventListener('click', () => { renderSettlement(AppState.currentProjectId); showScreen('screen-settlement'); });
  document.getElementById('btn-new-expense').addEventListener('click', () => navigateToExpenseForm(AppState.currentProjectId, null));
  document.getElementById('btn-go-settlement').addEventListener('click', () => { renderSettlement(AppState.currentProjectId); showScreen('screen-settlement'); });

  // Icon picker
  buildIconPicker();
  document.getElementById('btn-icon-picker').addEventListener('click', e => {
    e.stopPropagation();
    const popup  = document.getElementById('icon-picker-popup');
    const btn    = document.getElementById('btn-icon-picker');
    const rect   = btn.getBoundingClientRect();
    const appRect= document.getElementById('app').getBoundingClientRect();
    popup.style.top  = (rect.bottom - appRect.top + 8) + 'px';
    popup.style.left = (rect.left - appRect.left) + 'px';
    popup.classList.toggle('hidden');
  });
  document.getElementById('input-expense-name').addEventListener('input', e => {
    const detected = detectIcon(e.target.value);
    AppState.currentExpenseIcon = detected;
    document.getElementById('icon-picker-current').textContent = detected;
  });
  document.getElementById('app').addEventListener('click', e => {
    if (!e.target.closest('#icon-picker-popup') && !e.target.closest('#btn-icon-picker')) closeIconPicker();
  });

  // Expense form
  document.getElementById('btn-expense-form-back').addEventListener('click', () => showScreen('screen-project-detail'));
  document.getElementById('btn-expense-form-submit').addEventListener('click', () => {
    const name   = document.getElementById('input-expense-name').value.trim();
    const date   = document.getElementById('input-expense-date').value;
    const amount = parseFloat(document.getElementById('input-expense-amount').value);
    if (!name)              { alert('請輸入項目名稱'); return; }
    if (!date)              { alert('請選擇日期'); return; }
    if (!amount || amount <= 0) { alert('請輸入有效金額'); return; }

    const payerChip = document.querySelector('.payer-chip.payer-selected');
    if (!payerChip) { alert('請選擇代墊人'); return; }

    const splitType    = AppState.currentSplitType;
    const splitMembers = splitType !== 'all'
      ? Array.from(document.querySelectorAll('.split-member-chip.payer-selected')).map(c => c.dataset.mid)
      : [];
    if (splitType === 'include' && splitMembers.length === 0) { alert('請選擇分攤成員'); return; }

    const pid        = AppState.currentProjectId;
    const settings   = getProjectSettings(pid);
    const base       = settings.baseCurrency || 'TWD';
    const currency   = document.getElementById('input-expense-currency')?.value || base;
    const rate       = (currency !== base) ? (settings.rates?.[currency] || 1) : 1;
    const baseAmount = (currency !== base) ? Math.round(amount * rate) : amount;

    saveExpense({
      id:             AppState.currentExpenseId || generateId(),
      projectId:      pid,
      name, date,
      amount:         baseAmount,
      currency:       currency,
      originalAmount: currency !== base ? amount : null,
      rate:           currency !== base ? rate   : null,
      icon:           AppState.currentExpenseIcon,
      payerId:        payerChip.dataset.mid,
      splitType, splitMembers
    });
    renderProjectDetail(pid);
    showScreen('screen-project-detail');
  });

  // Settlement nav
  document.getElementById('btn-settlement-back').addEventListener('click', () => showScreen('screen-project-detail'));
  document.getElementById('settlement-nav-home').addEventListener('click', () => { renderHomeScreen(); showScreen('screen-home'); });
  document.getElementById('settlement-nav-items').addEventListener('click', () => showScreen('screen-project-detail'));
  document.getElementById('settlement-nav-settings').addEventListener('click', () => navigateToSettings(AppState.currentProjectId));
  document.getElementById('btn-toggle-algo').addEventListener('click', () => {
    const projects = getAllProjects();
    const project  = projects.find(p => p.id === AppState.currentProjectId);
    if (!project) return;
    project.algorithm = project.algorithm === 'itemized' ? 'roundtable' : 'itemized';
    saveProject(project);
    renderSettlement(AppState.currentProjectId);
  });

  document.getElementById('settlement-balance-list').addEventListener('click', e => {
    const btn = e.target.closest('.settle-btn');
    if (!btn) return;
    toggleSettledTx(AppState.currentProjectId, btn.dataset.txKey);
    renderSettlement(AppState.currentProjectId);
  });

  document.getElementById('btn-export-excel').addEventListener('click', () => {
    exportExpensesCSV(AppState.currentProjectId);
  });

  // Project detail — settings nav
  document.getElementById('detail-nav-settings').addEventListener('click', () => navigateToSettings(AppState.currentProjectId));

  // Settings screen
  document.getElementById('btn-settings-back').addEventListener('click', () => showScreen('screen-project-detail'));
  document.getElementById('btn-settings-save').addEventListener('click', () => {
    const pid          = AppState.currentProjectId;
    const baseCurrency = document.getElementById('settings-base-currency').value;
    const defaultInput = document.getElementById('settings-default-input-currency').value;
    const rates        = {};
    document.querySelectorAll('.settings-rate-input').forEach(inp => {
      rates[inp.dataset.currency] = parseFloat(inp.value) || 1;
    });
    saveProjectSettings(pid, { baseCurrency, defaultInputCurrency: defaultInput, rates });
    // Update app state with new currency
    AppState.projectBaseCurrency   = baseCurrency;
    AppState.projectCurrencySymbol = currencySymbol(baseCurrency);
    renderProjectDetail(pid);
    showScreen('screen-project-detail');
  });

  // Fetch live exchange rates
  document.getElementById('btn-fetch-rates').addEventListener('click', async () => {
    const btn      = document.getElementById('btn-fetch-rates');
    const baseCurr = document.getElementById('settings-base-currency')?.value || 'TWD';
    btn.disabled   = true;
    try {
      const res  = await fetch(`https://open.er-api.com/v6/latest/${baseCurr}`);
      const data = await res.json();
      if (data.result !== 'success') throw new Error('API error');
      document.querySelectorAll('.settings-rate-input').forEach(inp => {
        const code = inp.dataset.currency;
        if (data.rates[code] && data.rates[code] > 0) {
          inp.value = (1 / data.rates[code]).toFixed(4);
        }
      });
      const now = new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
      document.getElementById('settings-rates-updated').textContent = `更新 ${now}`;
    } catch {
      alert('匯率更新失敗，請確認網路連線');
    } finally {
      btn.disabled = false;
    }
  });

  // Mobile keyboard scroll fix
  document.querySelectorAll('input').forEach(el => {
    el.addEventListener('focus', () => {
      setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
    });
  });
}

// ── Block 10: LIFF + Init ────────────────────────────────────
async function initializeLiff() {
  try {
    await liff.init({ liffId: '2009708366-ZRcDL4VT' });
    if (!liff.isLoggedIn()) { liff.login(); return; }
    const profile = await liff.getProfile();
    AppState.liffProfile = profile;
    const avatarEl = document.getElementById('liff-user-avatar');
    if (avatarEl && profile.pictureUrl) avatarEl.src = profile.pictureUrl;
  } catch (err) {
    console.warn('LIFF not available, running in browser mode:', err.message);
  }
  initApp();
}

function initApp() {
  bindAllEvents();
  renderHomeScreen();
  showScreen('screen-home');
}

// window.onload = initializeLiff; // LIFF 暫時停用
window.onload = initApp;
