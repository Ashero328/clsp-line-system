// ============================================================
// customer_script.js — Storage & Algorithm Layer
// ============================================================

// ── Block 1: Storage Layer ──────────────────────────────────
function getAllProjects() {
  return JSON.parse(localStorage.getItem('clsp_projects') || '[]');
}
function saveProjects(list) {
  localStorage.setItem('clsp_projects', JSON.stringify(list));
}
function saveProject(p) {
  const list = getAllProjects();
  const i = list.findIndex(x => x.id === p.id);
  if (i >= 0) list[i] = p; else list.push(p);
  saveProjects(list);
}
function deleteProject(pid) {
  saveProjects(getAllProjects().filter(p => p.id !== pid));
  localStorage.removeItem('clsp_expenses_' + pid);
}
function getExpenses(pid) {
  return JSON.parse(localStorage.getItem('clsp_expenses_' + pid) || '[]');
}
function saveExpense(e) {
  const list = getExpenses(e.projectId);
  const i = list.findIndex(x => x.id === e.id);
  if (i >= 0) list[i] = e; else list.push(e);
  localStorage.setItem('clsp_expenses_' + e.projectId, JSON.stringify(list));
}
function deleteExpense(pid, eid) {
  const list = getExpenses(pid).filter(e => e.id !== eid);
  localStorage.setItem('clsp_expenses_' + pid, JSON.stringify(list));
}
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ── Icon System ─────────────────────────────────────────────
const EXPENSE_ICONS = [
  { icon: 'restaurant',               label: '餐廳',    kw: ['飯','餐','食','吃','午','晚','早','燒','鍋','烤','炸','壽司','拉麵','pizza','牛排','火鍋','便當'] },
  { icon: 'hotel',                    label: '住宿',    kw: ['飯店','旅館','住宿','旅店','民宿','hotel','hostel'] },
  { icon: 'local_cafe',               label: '咖啡',    kw: ['咖啡','星巴克','starbucks','cafe','茶','珍珠','飲料','drink','拿鐵','奶茶'] },
  { icon: 'cake',                     label: '甜點',    kw: ['蛋糕','甜點','甜食','bakery','甜','dessert','cake','冰淇淋'] },
  { icon: 'local_taxi',               label: '計程車',  kw: ['計程車','taxi','uber','優步','cab'] },
  { icon: 'train',                    label: '大眾運輸', kw: ['捷運','地鐵','高鐵','火車','鐵路','mrt','metro','台鐵','公車','bus'] },
  { icon: 'local_convenience_store',  label: '超商',    kw: ['超商','便利','7-11','全家','711','萊爾富','ok超商'] },
  { icon: 'shopping_bag',             label: '購物',    kw: ['購物','逛街','買','商場','百貨','服飾','衣服'] },
  { icon: 'movie',                    label: '電影',    kw: ['電影','影院','cinema','movie'] },
  { icon: 'flight',                   label: '機票',    kw: ['機票','航班','飛機','flight','機場'] },
  { icon: 'sports',                   label: '運動',    kw: ['運動','球','游泳','健身','gym','羽毛球'] },
  { icon: 'local_hospital',           label: '醫療',    kw: ['醫院','診所','藥','醫療','看診'] },
  { icon: 'celebration',              label: '娛樂',    kw: ['ktv','娛樂','慶祝','party','派對','酒吧','bar'] },
  { icon: 'fastfood',                 label: '速食',    kw: ['麥當勞','肯德基','摩斯','漢堡','速食','炸雞'] },
  { icon: 'directions_car',           label: '開車',    kw: ['停車','加油','高速','油費','過路費'] },
  { icon: 'receipt_long',             label: '帳單',    kw: ['帳單','費用','繳費','電費','水費','瓦斯'] },
];
const ICON_FALLBACK = 'data_object';

function detectIcon(name) {
  const n = name.toLowerCase();
  for (const rule of EXPENSE_ICONS) {
    if (rule.kw.some(k => n.includes(k.toLowerCase()))) return rule.icon;
  }
  return ICON_FALLBACK;
}

// ── Block 2: Algorithm Layer ────────────────────────────────
function getParticipants(expense, members) {
  if (expense.splitType === 'all') return members.map(m => m.id);
  if (expense.splitType === 'except') return members.map(m => m.id).filter(id => !expense.splitMembers.includes(id));
  if (expense.splitType === 'shares') return Object.keys(expense.shareUnits || {}).filter(id => expense.shareUnits[id] > 0);
  return expense.splitMembers.slice();
}

// Older expenses only carry payerId; multi-payer expenses also carry payers[].
function isMultiPayer(expense) {
  return Array.isArray(expense.payers) && expense.payers.length > 1;
}
function getPayers(expense) {
  return isMultiPayer(expense)
    ? expense.payers
    : [{ memberId: expense.payerId, amount: expense.amount }];
}
function getPaidBy(expense, memberId) {
  return getPayers(expense).filter(p => p.memberId === memberId).reduce((s, p) => s + p.amount, 0);
}
// Converts entered contributions to base currency. Rounding differences go to
// the largest payer so the payers always add up to the expense amount.
function buildBasePayers(inputs, baseAmount, rate, isForeign) {
  const payers = inputs.map(p => ({
    memberId: p.memberId,
    amount: isForeign ? Math.round(p.amount * rate) : p.amount,
    originalAmount: isForeign ? p.amount : null
  }));
  const top = payers.reduce((a, b) => (b.amount > a.amount ? b : a));
  const diff = baseAmount - payers.reduce((s, p) => s + p.amount, 0);
  top.amount = Math.round((top.amount + diff) * 100) / 100;
  return payers;
}

function calcShares(amount, participantIds) {
  const n = participantIds.length;
  if (n === 0) return {};
  // Work in integer units of 0.1 to avoid all floating-point drift.
  // Distribute the remainder (in 0.1 steps) to the first few members.
  const base10 = Math.floor(amount * 10 / n);   // e.g. 1000*10/3 → 3333
  const extra   = (amount * 10) - base10 * n;   // pure integer remainder
  const shares = {};
  participantIds.forEach((id, i) => {
    shares[id] = (i < extra ? base10 + 1 : base10) / 10;
  });
  return shares;
}

// Split by units (e.g. bags). Works in 0.1 steps like calcShares; the 0.1 steps
// left over go to the largest remainders so the shares always add up to amount.
function calcWeightedShares(amount, shareUnits) {
  const ids = Object.keys(shareUnits || {}).filter(id => shareUnits[id] > 0);
  const totalUnits = ids.reduce((s, id) => s + shareUnits[id], 0);
  if (totalUnits <= 0) return {};
  const totalCents = Math.round(amount * 100);
  const tenths = Math.floor(totalCents / 10);
  const rows = ids.map(id => {
    const exact = tenths * shareUnits[id] / totalUnits;
    return { id, base: Math.floor(exact + 1e-9), rem: exact - Math.floor(exact + 1e-9) };
  });
  let left = tenths - rows.reduce((s, r) => s + r.base, 0);
  [...rows].sort((a, b) => b.rem - a.rem).forEach(r => {
    if (left > 0) { r.base += 1; left -= 1; }
  });
  const shares = {};
  rows.forEach(r => { shares[r.id] = r.base / 10; });
  // Amounts with 2 decimals: keep the last cents on the largest share.
  const extraCents = totalCents % 10;
  if (extraCents) {
    const top = rows.reduce((a, b) => (b.base > a.base ? b : a));
    shares[top.id] = (top.base * 10 + extraCents) / 100;
  }
  return shares;
}

function getExpenseShares(expense, members) {
  return expense.splitType === 'shares'
    ? calcWeightedShares(expense.amount, expense.shareUnits)
    : calcShares(expense.amount, getParticipants(expense, members));
}

// Fewest transfers that clear a { memberId: balance } map.
function minimizeTransfers(members, net) {
  const EPS = 0.01;
  const pos = members.filter(m => net[m.id] > EPS)
    .map(m => ({ id: m.id, name: m.name, b: net[m.id] }))
    .sort((a, b) => b.b - a.b);
  const neg = members.filter(m => net[m.id] < -EPS)
    .map(m => ({ id: m.id, name: m.name, b: net[m.id] }))
    .sort((a, b) => a.b - b.b);

  const transactions = [];
  let pi = 0, ni = 0;
  while (pi < pos.length && ni < neg.length) {
    const cr = pos[pi], db = neg[ni];
    const amt = Math.round(Math.min(cr.b, Math.abs(db.b)) * 100) / 100;
    if (amt >= EPS) transactions.push({
      debtorId: db.id, debtorName: db.name,
      creditorId: cr.id, creditorName: cr.name, amount: amt
    });
    cr.b -= amt; db.b += amt;
    if (cr.b < EPS) pi++;
    if (Math.abs(db.b) < EPS) ni++;
  }
  return transactions;
}

function calculateItemized(members, expenses) {
  const nameOf = {};
  members.forEach(m => nameOf[m.id] = m.name);
  return expenses
    .filter(e => e.amount > 0)
    .map(e => {
      const pids = getParticipants(e, members);
      const shares = getExpenseShares(e, members);
      let debts;
      if (isMultiPayer(e)) {
        // Several payers: net this expense first so it needs the fewest transfers.
        const net = {};
        members.forEach(m => { net[m.id] = getPaidBy(e, m.id) - (shares[m.id] || 0); });
        debts = minimizeTransfers(members, net).map(t => ({
          debtorId: t.debtorId, debtorName: t.debtorName,
          creditorId: t.creditorId, creditorName: t.creditorName,
          amount: t.amount
        }));
      } else {
        debts = pids
          .filter(pid => pid !== e.payerId)
          .map(pid => ({
            debtorId: pid, debtorName: nameOf[pid] || '?',
            creditorId: e.payerId, creditorName: nameOf[e.payerId] || '?',
            amount: shares[pid]
          }));
      }
      return { expenseId: e.id, expenseName: e.name, expenseAmount: e.amount, debts };
    });
}

function calculateRoundtable(members, expenses) {
  const net = {};
  members.forEach(m => { net[m.id] = 0; });

  expenses.filter(e => e.amount > 0).forEach(e => {
    const pids = getParticipants(e, members);
    const shares = getExpenseShares(e, members);
    getPayers(e).forEach(p => { net[p.memberId] = (net[p.memberId] || 0) + p.amount; });
    pids.forEach(pid => { net[pid] = (net[pid] || 0) - shares[pid]; });
  });

  const netBalances = members.map(m => ({
    memberId: m.id, memberName: m.name,
    balance: Math.round(net[m.id] * 100) / 100
  }));

  return { netBalances, transactions: minimizeTransfers(members, net) };
}

// ── Block 3: Project Settings ───────────────────────────────
const DEFAULT_SETTINGS = {
  baseCurrency:         'TWD',
  defaultInputCurrency: 'TWD',
  rates: {
    USD: 32.5, JPY: 0.22, EUR: 35.8, CNY: 4.5,
    HKD: 4.2,  KRW: 0.024, SGD: 24.5, GBP: 42.0,
    AUD: 21.5, MYR: 7.3
  }
};
function getProjectSettings(pid) {
  const proj = getAllProjects().find(p => p.id === pid);
  if (!proj) return { ...DEFAULT_SETTINGS, rates: { ...DEFAULT_SETTINGS.rates } };
  return proj.settings
    ? { ...DEFAULT_SETTINGS, ...proj.settings, rates: { ...DEFAULT_SETTINGS.rates, ...(proj.settings.rates || {}) } }
    : { ...DEFAULT_SETTINGS, rates: { ...DEFAULT_SETTINGS.rates } };
}
function saveProjectSettings(pid, settings) {
  const projects = getAllProjects();
  const p = projects.find(x => x.id === pid);
  if (!p) return;
  p.settings = settings;
  saveProjects(projects);
}

// ── Settled Transactions ─────────────────────────────────────
function getSettledTx(pid) {
  return new Set(JSON.parse(localStorage.getItem('clsp_settled_' + pid) || '[]'));
}
function toggleSettledTx(pid, key) {
  const set = getSettledTx(pid);
  if (set.has(key)) set.delete(key); else set.add(key);
  localStorage.setItem('clsp_settled_' + pid, JSON.stringify([...set]));
}
