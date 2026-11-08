import { firebaseConfig } from './firebase-config.js';

const categories = [
  { id: 'food', name: 'Еда', icon: '🍔', color: '#f6b93b' },
  { id: 'transport', name: 'Транспорт', icon: '🚗', color: '#eb4d4b' },
  { id: 'home', name: 'Дом', icon: '🏠', color: '#48dbfb' },
  { id: 'shopping', name: 'Покупки', icon: '🛒', color: '#1dd1a1' },
  { id: 'fun', name: 'Отдых', icon: '🎮', color: '#9b59b6' },
];
const defaultLimits = { food: 60000, transport: 35000, home: 80000, shopping: 50000, fun: 40000 };
const LOCAL_KEY = 'pixel-budget-local-v1';
const state = {
  view: 'chart', mode: 'month', date: new Date(), transactionType: 'expense', category: 'food',
  transactions: [], limits: { ...defaultLimits }, user: null, firebase: null, stopSync: null, editingLimit: null,
};
const $ = selector => document.querySelector(selector);
const money = value => `${Math.round(Number(value || 0)).toLocaleString('ru-RU')} ₸`;
const monthKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const todayInput = () => new Date().toISOString().slice(0, 10);

function localData() {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY)) || { transactions: [], limits: defaultLimits }; }
  catch { return { transactions: [], limits: defaultLimits }; }
}
function saveLocal() { localStorage.setItem(LOCAL_KEY, JSON.stringify({ transactions: state.transactions, limits: state.limits })); }
function setBanner(text, online = false) { const el = $('#sync-banner'); el.textContent = text; el.classList.toggle('is-online', online); }
function dateInPeriod(dateString) {
  const date = new Date(`${dateString}T12:00:00`);
  return state.mode === 'year' ? date.getFullYear() === state.date.getFullYear() : monthKey(date) === monthKey(state.date);
}
function periodTransactions() { return state.transactions.filter(item => dateInPeriod(item.date)); }
function stats() {
  const result = { income: 0, expense: 0, byCategory: Object.fromEntries(categories.map(c => [c.id, 0])) };
  for (const item of periodTransactions()) {
    if (item.type === 'income') result.income += Number(item.amount);
    else { result.expense += Number(item.amount); result.byCategory[item.category] += Number(item.amount); }
  }
  return result;
}
function periodLabel() {
  if (state.mode === 'year') return `${state.date.getFullYear()} ГОД`;
  return new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(state.date).replace(/^./, char => char.toUpperCase());
}
function renderHeader() {
  $('#period-label').textContent = periodLabel();
  document.querySelectorAll('.mode-button').forEach(button => button.classList.toggle('is-active', button.dataset.mode === state.mode));
}
function renderChart() {
  const { expense, byCategory } = stats();
  const list = $('#category-list'); list.replaceChildren();
  categories.forEach(category => {
    const value = byCategory[category.id]; const percent = expense ? (value / expense) * 100 : 0;
    const row = document.createElement('article'); row.className = 'category-row'; row.style.setProperty('--bar', category.color);
    row.innerHTML = `<div class="category-top"><div class="category-name-wrap"><span class="category-icon">${category.icon}</span><span class="category-name">${category.name}</span></div><b style="color:${category.color}">${percent.toFixed(1)}%</b><span class="category-amount">${money(value)}</span></div><div class="progress"><i style="width:${percent}%"></i></div>`;
    list.append(row);
  });
  drawDonut(expense, byCategory);
}
function drawDonut(total, byCategory) {
  const canvas = $('#donut-chart'); const context = canvas.getContext('2d'); const ratio = window.devicePixelRatio || 1;
  const side = canvas.clientWidth || 240; canvas.width = side * ratio; canvas.height = side * ratio; context.scale(ratio, ratio); context.clearRect(0, 0, side, side);
  const cx = side / 2; const cy = side / 2; const radius = side * .33;
  context.imageSmoothingEnabled = false; context.lineWidth = 28; context.strokeStyle = '#35394e'; context.beginPath(); context.arc(cx, cy, radius, 0, Math.PI * 2); context.stroke();
  let start = -Math.PI / 2;
  if (total) categories.forEach(category => { const angle = byCategory[category.id] / total * Math.PI * 2; if (!angle) return; context.strokeStyle = category.color; context.beginPath(); context.arc(cx, cy, radius, start + .025, start + angle - .025); context.stroke(); start += angle; });
  context.fillStyle = '#f5f6fa'; context.textAlign = 'center'; context.font = '11px "Press Start 2P"'; context.fillText(money(total), cx, cy + 2); context.fillStyle = '#f9d949'; context.fillText('ТРАТЫ', cx, cy + 22);
}
function renderRecords() {
  const { income, expense } = stats(); const balance = income - expense;
  $('#total-expenses').textContent = `−${money(expense)}`; $('#total-income').textContent = `+${money(income)}`;
  const balanceEl = $('#total-balance'); balanceEl.textContent = `${balance >= 0 ? '+' : '−'}${money(Math.abs(balance))}`; balanceEl.className = balance < 0 ? 'negative' : 'positive';
  const list = $('#records-list'); list.replaceChildren(); const records = periodTransactions().sort((a, b) => b.date.localeCompare(a.date));
  if (!records.length) { list.append($('#empty-records-template').content.cloneNode(true)); return; }
  records.forEach(item => { const category = categories.find(c => c.id === item.category) || categories[0]; const row = document.createElement('article'); row.className = 'record'; row.innerHTML = `<span class="record-icon">${item.type === 'income' ? '✦' : category.icon}</span><div><div class="record-title">${escapeHtml(item.note || (item.type === 'income' ? 'Доход' : category.name))}</div><div class="record-meta">${formatDate(item.date)} · ${item.type === 'income' ? 'Доход' : category.name}</div></div><strong class="record-amount ${item.type === 'income' ? 'positive' : 'negative'}">${item.type === 'income' ? '+' : '−'}${money(item.amount)}</strong><button class="delete-button" data-delete="${item.id}" title="Удалить">×</button>`; list.append(row); });
}
function renderPlan() {
  const { expense, byCategory } = stats(); const total = Object.values(state.limits).reduce((sum, value) => sum + Number(value), 0); const left = total - expense;
  $('#plan-total').textContent = money(total); $('#plan-spent').textContent = money(expense); $('#plan-left').textContent = `${left < 0 ? '−' : '+'}${money(Math.abs(left))}`; $('#plan-left').parentElement.className = left < 0 ? 'negative' : 'positive'; $('#plan-progress').style.width = `${Math.min(100, total ? expense / total * 100 : 0)}%`;
  const list = $('#limits-list'); list.replaceChildren();
  categories.forEach(category => { const limit = Number(state.limits[category.id] || 0); const spent = byCategory[category.id]; const remaining = limit - spent; const used = limit ? Math.min(100, spent / limit * 100) : 0; const row = document.createElement('article'); row.className = 'limit-row'; row.style.setProperty('--bar', remaining < 0 ? '#eb4d4b' : category.color); row.innerHTML = `<div class="limit-top"><div class="category-name-wrap"><span class="category-icon">${category.icon}</span><span class="limit-name">${category.name}</span></div><b style="color:${category.color}">Лимит: ${money(limit)}</b><button class="limit-button" data-limit-category="${category.id}">✎ Лимит</button></div><div class="limit-details"><span>Траты: ${money(spent)}</span><span class="${remaining < 0 ? 'negative' : 'positive'}">Ост.: ${remaining < 0 ? '−' : '+'}${money(Math.abs(remaining))}</span></div><div class="progress"><i style="width:${used}%"></i></div>`; list.append(row); });
}
function renderPicker() { const picker = $('#category-picker'); picker.replaceChildren(); categories.forEach(category => { const button = document.createElement('button'); button.type = 'button'; button.className = `category-choice ${category.id === state.category ? 'is-selected' : ''}`; button.dataset.category = category.id; button.innerHTML = `<span>${category.icon}</span>${category.name}`; picker.append(button); }); }
function renderAll() { renderHeader(); renderChart(); renderRecords(); renderPlan(); renderPicker(); }
function showView(view) { state.view = view; document.querySelectorAll('.view').forEach(element => element.classList.toggle('is-active', element.id === `view-${view}`)); document.querySelectorAll('.nav-button').forEach(button => button.classList.toggle('is-active', button.dataset.view === view)); }
function escapeHtml(text) { const node = document.createElement('span'); node.textContent = text; return node.innerHTML; }
function formatDate(date) { return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short' }).format(new Date(`${date}T12:00:00`)); }
async function persist() {
  saveLocal(); if (!state.firebase || !state.user) return;
  const { db, doc, setDoc } = state.firebase; await setDoc(doc(db, 'users', state.user.uid, 'settings', 'budget'), { limits: state.limits }, { merge: true });
}
async function addTransaction(item) {
  if (state.firebase && state.user) { const { db, collection, addDoc, serverTimestamp } = state.firebase; await addDoc(collection(db, 'users', state.user.uid, 'transactions'), { ...item, createdAt: serverTimestamp() }); return; }
  state.transactions.unshift({ ...item, id: crypto.randomUUID() }); saveLocal(); renderAll();
}
async function removeTransaction(id) {
  if (state.firebase && state.user) { const { db, doc, deleteDoc } = state.firebase; await deleteDoc(doc(db, 'users', state.user.uid, 'transactions', id)); return; }
  state.transactions = state.transactions.filter(item => item.id !== id); saveLocal(); renderAll();
}
async function startFirebase() {
  if (!firebaseConfig) { const saved = localData(); state.transactions = saved.transactions || []; state.limits = { ...defaultLimits, ...(saved.limits || {}) }; renderAll(); return; }
  try {
    const [appModule, authModule, firestoreModule] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js'), import('https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js'), import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js')
    ]);
    const app = appModule.initializeApp(firebaseConfig); const auth = authModule.getAuth(app); const db = firestoreModule.getFirestore(app);
    state.firebase = { auth, db, ...authModule, ...firestoreModule };
    authModule.onAuthStateChanged(auth, async user => { state.user = user; $('#auth-button').textContent = user ? 'Выйти' : 'Войти'; if (state.stopSync) state.stopSync(); if (!user) { const saved = localData(); state.transactions = saved.transactions || []; state.limits = { ...defaultLimits, ...(saved.limits || {}) }; setBanner('Войди через Google, чтобы синхронизировать данные.'); renderAll(); return; }
      setBanner(`Синхронизация включена: ${user.email || 'ваш аккаунт'}`, true);
      const settingsRef = firestoreModule.doc(db, 'users', user.uid, 'settings', 'budget');
      const stopSettings = firestoreModule.onSnapshot(settingsRef, snapshot => { if (snapshot.exists()) { state.limits = { ...defaultLimits, ...(snapshot.data().limits || {}) }; renderAll(); } else persist().catch(console.error); });
      const recordsRef = firestoreModule.collection(db, 'users', user.uid, 'transactions');
      const stopRecords = firestoreModule.onSnapshot(recordsRef, snapshot => { state.transactions = snapshot.docs.map(record => ({ id: record.id, ...record.data() })); renderAll(); });
      state.stopSync = () => { stopSettings(); stopRecords(); };
    });
  } catch (error) { console.error(error); setBanner('Firebase не подключился. Проверь firebase-config.js.'); const saved = localData(); state.transactions = saved.transactions || []; state.limits = { ...defaultLimits, ...(saved.limits || {}) }; renderAll(); }
}
function bindEvents() {
  document.querySelectorAll('.nav-button').forEach(button => button.addEventListener('click', () => showView(button.dataset.view)));
  document.querySelectorAll('.mode-button').forEach(button => button.addEventListener('click', () => { state.mode = button.dataset.mode; renderAll(); }));
  $('#previous-period').addEventListener('click', () => { state.mode === 'year' ? state.date.setFullYear(state.date.getFullYear() - 1) : state.date.setMonth(state.date.getMonth() - 1); renderAll(); });
  $('#next-period').addEventListener('click', () => { state.mode === 'year' ? state.date.setFullYear(state.date.getFullYear() + 1) : state.date.setMonth(state.date.getMonth() + 1); renderAll(); });
  $('#auth-button').addEventListener('click', async () => { if (!state.firebase) return alert('Сначала вставь настройки Firebase в firebase-config.js'); try { const { auth, GoogleAuthProvider, signInWithPopup, signOut } = state.firebase; if (state.user) await signOut(auth); else await signInWithPopup(auth, new GoogleAuthProvider()); } catch (error) { alert(`Не удалось войти: ${error.message}`); } });
  document.addEventListener('click', event => { const categoryButton = event.target.closest('[data-category]'); if (categoryButton) { state.category = categoryButton.dataset.category; renderPicker(); } const quick = event.target.closest('[data-amount]'); if (quick) { const input = $('#transaction-amount'); input.value = Number((input.value || '0').replace(',', '.')) + Number(quick.dataset.amount); } const remove = event.target.closest('[data-delete]'); if (remove && confirm('Удалить эту операцию?')) removeTransaction(remove.dataset.delete).catch(error => alert(error.message)); const limit = event.target.closest('[data-limit-category]'); if (limit) openLimit(limit.dataset.limitCategory); const type = event.target.closest('[data-transaction-type]'); if (type) { state.transactionType = type.dataset.transactionType; document.querySelectorAll('.type-button').forEach(button => button.classList.toggle(button.dataset.transactionType === 'expense' ? 'is-expense' : 'is-income', button.dataset.transactionType === state.transactionType)); $('#save-transaction').textContent = state.transactionType === 'expense' ? '+ СОХРАНИТЬ РАСХОД' : '+ СОХРАНИТЬ ДОХОД'; } });
  $('#transaction-form').addEventListener('submit', async event => { event.preventDefault(); const amount = Number($('#transaction-amount').value.replace(',', '.')); if (!amount || amount <= 0) return; await addTransaction({ type: state.transactionType, category: state.category, amount, note: $('#transaction-note').value.trim(), date: $('#transaction-date').value }); event.target.reset(); $('#transaction-date').value = todayInput(); $('#transaction-amount').value = ''; showView('records'); });
  $('#limit-form').addEventListener('submit', async event => { event.preventDefault(); const value = Number($('#limit-input').value.replace(',', '.')); if (!Number.isFinite(value) || value < 0) return; state.limits[state.editingLimit] = value; await persist(); $('#limit-dialog').close(); renderAll(); });
  $('#cancel-limit').addEventListener('click', () => $('#limit-dialog').close());
  $('#limit-dialog').addEventListener('click', event => { const quick = event.target.closest('[data-limit]'); if (quick) $('#limit-input').value = Number($('#limit-input').value || 0) + Number(quick.dataset.limit); });
}
function openLimit(categoryId) { state.editingLimit = categoryId; const category = categories.find(item => item.id === categoryId); $('#limit-title').textContent = `ЛИМИТ: ${category.name.toUpperCase()}`; $('#limit-input').value = state.limits[categoryId] || 0; $('#limit-dialog').showModal(); }

$('#transaction-date').value = todayInput();
bindEvents(); startFirebase();
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js'));
