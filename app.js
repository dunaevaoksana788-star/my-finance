(function () {
  'use strict';

  const STORAGE_KEY = 'myFinanceAppData';

  const EXPENSE_CATEGORIES = ['Еда', 'Транспорт', 'Жильё', 'Развлечения', 'Здоровье', 'Одежда', 'Образование', 'Прочее'];
  const INCOME_CATEGORIES = ['Зарплата', 'Фриланс', 'Подарки', 'Инвестиции', 'Прочее'];

  const CATEGORY_COLORS = {
    'Еда': '#f4a462', 'Транспорт': '#4dabf7', 'Жильё': '#845ef7', 'Развлечения': '#ff6b9d',
    'Здоровье': '#20c997', 'Одежда': '#ffd43b', 'Образование': '#748ffc', 'Прочее': '#adb5bd',
    'Зарплата': '#16a34a', 'Фриланс': '#2f9e44', 'Подарки': '#f06595', 'Инвестиции': '#0ca678'
  };

  // ---------------- Storage ----------------
  function defaultData() {
    return { transactions: [], credits: [], goals: [], cushion: { target: 0, current: 0 } };
  }

  function loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultData();
      const parsed = JSON.parse(raw);
      return Object.assign(defaultData(), parsed);
    } catch (e) {
      console.error('Не удалось загрузить данные', e);
      return defaultData();
    }
  }

  function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  let data = loadData();

  // ---------------- Utils ----------------
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  function fmtMoney(n) {
    n = Number(n) || 0;
    return Math.round(n).toLocaleString('ru-RU') + ' ₽';
  }

  function fmtDate(iso) {
    if (!iso) return '';
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function todayISO() { return new Date().toISOString().slice(0, 10); }

  function monthKey(iso) { return iso.slice(0, 7); }

  function monthLabel(key) {
    const d = new Date(key + '-01T00:00:00');
    return d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
  }

  function monthLabelShort(key) {
    const d = new Date(key + '-01T00:00:00');
    return d.toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' });
  }

  function addMonths(iso, n) {
    const d = new Date(iso + 'T00:00:00');
    d.setMonth(d.getMonth() + n);
    return d.toISOString().slice(0, 10);
  }

  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

  // ---------------- Navigation ----------------
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      tabPanels.forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
      document.getElementById('tabs').classList.remove('open');
    });
  });
  document.getElementById('burgerBtn').addEventListener('click', () => {
    document.getElementById('tabs').classList.toggle('open');
  });

  // ---------------- Transactions form ----------------
  const txForm = document.getElementById('txForm');
  const txTypeSeg = document.getElementById('txTypeSeg');
  const txCategorySelect = document.getElementById('txCategory');
  const txDateInput = document.getElementById('txDate');
  let currentTxType = 'expense';

  function populateCategorySelect() {
    const list = currentTxType === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
    txCategorySelect.innerHTML = list.map(c => `<option value="${c}">${c}</option>`).join('');
  }

  txTypeSeg.addEventListener('click', (e) => {
    const btn = e.target.closest('.seg-btn');
    if (!btn) return;
    currentTxType = btn.dataset.type;
    txTypeSeg.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    populateCategorySelect();
  });

  txDateInput.value = todayISO();
  populateCategorySelect();

  txForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const amount = parseFloat(document.getElementById('txAmount').value);
    if (!amount || amount <= 0) return;
    data.transactions.push({
      id: uid(),
      type: currentTxType,
      amount: amount,
      category: txCategorySelect.value,
      date: txDateInput.value || todayISO(),
      note: document.getElementById('txNote').value.trim()
    });
    saveData();
    txForm.reset();
    txDateInput.value = todayISO();
    populateCategorySelect();
    renderAll();
  });

  // ---------------- Transactions list / filters ----------------
  const filterMonthSelect = document.getElementById('filterMonth');
  const filterTypeSelect = document.getElementById('filterType');
  filterMonthSelect.addEventListener('change', renderTransactionsTable);
  filterTypeSelect.addEventListener('change', renderTransactionsTable);

  function getAllMonthKeys() {
    const set = new Set(data.transactions.map(t => monthKey(t.date)));
    set.add(monthKey(todayISO()));
    return Array.from(set).sort().reverse();
  }

  function populateMonthFilter() {
    const prev = filterMonthSelect.value;
    const months = getAllMonthKeys();
    let html = '<option value="all">Все время</option>';
    html += months.map(m => `<option value="${m}">${capitalize(monthLabel(m))}</option>`).join('');
    filterMonthSelect.innerHTML = html;
    if (prev && (prev === 'all' || months.includes(prev))) {
      filterMonthSelect.value = prev;
    } else {
      filterMonthSelect.value = monthKey(todayISO());
    }
  }

  function capitalize(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; }

  function renderTransactionsTable() {
    const monthFilter = filterMonthSelect.value;
    const typeFilter = filterTypeSelect.value;
    let list = data.transactions.slice().sort((a, b) => b.date.localeCompare(a.date));
    if (monthFilter !== 'all') list = list.filter(t => monthKey(t.date) === monthFilter);
    if (typeFilter !== 'all') list = list.filter(t => t.type === typeFilter);

    const tbody = document.getElementById('txTableBody');
    document.getElementById('txEmpty').hidden = list.length > 0;
    tbody.innerHTML = list.map(t => `
      <tr>
        <td>${fmtDate(t.date)}</td>
        <td>${t.category}</td>
        <td>${t.note ? escapeHtml(t.note) : '<span class="muted">—</span>'}</td>
        <td class="text-right ${t.type === 'income' ? 'amount-income' : 'amount-expense'}">${t.type === 'income' ? '+' : '−'}${fmtMoney(t.amount)}</td>
        <td><button class="row-delete" data-id="${t.id}" title="Удалить">✕</button></td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.row-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        data.transactions = data.transactions.filter(t => t.id !== btn.dataset.id);
        saveData();
        renderAll();
      });
    });
  }

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  // ---------------- Credits ----------------
  const creditForm = document.getElementById('creditForm');
  document.getElementById('creditNextDate').value = addMonths(todayISO(), 1);

  creditForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const total = parseFloat(document.getElementById('creditTotal').value);
    const remaining = parseFloat(document.getElementById('creditRemaining').value);
    const monthly = parseFloat(document.getElementById('creditMonthly').value);
    if (!total || remaining == null || !monthly) return;
    data.credits.push({
      id: uid(),
      name: document.getElementById('creditName').value.trim() || 'Кредит',
      total: total,
      remaining: clamp(remaining, 0, total),
      monthly: monthly,
      rate: parseFloat(document.getElementById('creditRate').value) || 0,
      nextDate: document.getElementById('creditNextDate').value || addMonths(todayISO(), 1)
    });
    saveData();
    creditForm.reset();
    document.getElementById('creditNextDate').value = addMonths(todayISO(), 1);
    renderAll();
  });

  function renderCredits() {
    const list = data.credits.slice().sort((a, b) => (a.nextDate || '').localeCompare(b.nextDate || ''));
    const container = document.getElementById('creditsList');
    document.getElementById('creditsEmpty').hidden = list.length > 0;

    const totalDebt = list.reduce((s, c) => s + c.remaining, 0);
    const monthlySum = list.filter(c => c.remaining > 0).reduce((s, c) => s + c.monthly, 0);
    document.getElementById('creditsTotalDebt').textContent = fmtMoney(totalDebt);
    document.getElementById('creditsMonthlySum').textContent = fmtMoney(monthlySum);

    container.innerHTML = list.map(c => {
      const paidPct = c.total > 0 ? clamp(((c.total - c.remaining) / c.total) * 100, 0, 100) : 100;
      const isPaidOff = c.remaining <= 0;
      return `
      <div class="entity-card">
        <div class="entity-card-head">
          <h4>${escapeHtml(c.name)}${isPaidOff ? ' ✅' : ''}</h4>
          <button class="remove-link" data-remove-credit="${c.id}">удалить</button>
        </div>
        <div class="entity-meta">
          <span>Остаток: <strong>${fmtMoney(c.remaining)}</strong> из ${fmtMoney(c.total)}</span>
          <span>Платёж: ${fmtMoney(c.monthly)}/мес</span>
          ${c.rate ? `<span>Ставка: ${c.rate}%</span>` : ''}
          ${!isPaidOff ? `<span>След. платёж: ${fmtDate(c.nextDate)}</span>` : ''}
        </div>
        <div class="progress-bar"><div class="progress-fill credit" style="width:${paidPct.toFixed(1)}%"></div></div>
        <p class="mini-text">Выплачено ${paidPct.toFixed(0)}%</p>
        ${!isPaidOff ? `
        <div class="entity-actions">
          <button class="btn btn-primary" data-pay-credit="${c.id}">Внести платёж (${fmtMoney(c.monthly)})</button>
          <input type="number" min="0" step="0.01" placeholder="Своя сумма" data-custom-pay-input="${c.id}">
          <button class="btn btn-light" data-custom-pay="${c.id}">Внести</button>
        </div>` : ''}
      </div>`;
    }).join('');

    container.querySelectorAll('[data-remove-credit]').forEach(btn => {
      btn.addEventListener('click', () => {
        data.credits = data.credits.filter(c => c.id !== btn.dataset.removeCredit);
        saveData(); renderAll();
      });
    });
    container.querySelectorAll('[data-pay-credit]').forEach(btn => {
      btn.addEventListener('click', () => {
        const c = data.credits.find(c => c.id === btn.dataset.payCredit);
        if (!c) return;
        c.remaining = clamp(c.remaining - c.monthly, 0, c.total);
        c.nextDate = addMonths(c.nextDate, 1);
        saveData(); renderAll();
      });
    });
    container.querySelectorAll('[data-custom-pay]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.customPay;
        const input = container.querySelector(`[data-custom-pay-input="${id}"]`);
        const amount = parseFloat(input.value);
        if (!amount || amount <= 0) return;
        const c = data.credits.find(c => c.id === id);
        if (!c) return;
        c.remaining = clamp(c.remaining - amount, 0, c.total);
        saveData(); renderAll();
      });
    });
  }

  // ---------------- Dream goals ----------------
  const goalForm = document.getElementById('goalForm');
  goalForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const target = parseFloat(document.getElementById('goalTarget').value);
    if (!target || target <= 0) return;
    data.goals.push({
      id: uid(),
      name: document.getElementById('goalName').value.trim() || 'Мечта',
      target: target,
      current: parseFloat(document.getElementById('goalCurrent').value) || 0,
      deadline: document.getElementById('goalDeadline').value || ''
    });
    saveData();
    goalForm.reset();
    renderAll();
  });

  function renderGoals() {
    const list = data.goals;
    const container = document.getElementById('goalsList');
    document.getElementById('goalsEmpty').hidden = list.length > 0;

    container.innerHTML = list.map(g => {
      const pct = g.target > 0 ? clamp((g.current / g.target) * 100, 0, 100) : 0;
      let deadlineText = '';
      if (g.deadline) {
        const days = Math.ceil((new Date(g.deadline) - new Date(todayISO())) / 86400000);
        deadlineText = days >= 0 ? `<span>Осталось дней: ${days}</span>` : `<span>Срок прошёл (${fmtDate(g.deadline)})</span>`;
      }
      return `
      <div class="entity-card">
        <div class="entity-card-head">
          <h4>${escapeHtml(g.name)}${pct >= 100 ? ' 🎉' : ''}</h4>
          <button class="remove-link" data-remove-goal="${g.id}">удалить</button>
        </div>
        <div class="entity-meta">
          <span>${fmtMoney(g.current)} из ${fmtMoney(g.target)}</span>
          ${deadlineText}
        </div>
        <div class="progress-bar"><div class="progress-fill goal" style="width:${pct.toFixed(1)}%"></div></div>
        <p class="mini-text">${pct.toFixed(0)}% накоплено</p>
        <div class="entity-actions">
          <input type="number" min="0" step="0.01" placeholder="Сумма" data-goal-input="${g.id}">
          <button class="btn btn-primary" data-goal-add="${g.id}">Пополнить</button>
        </div>
      </div>`;
    }).join('');

    container.querySelectorAll('[data-remove-goal]').forEach(btn => {
      btn.addEventListener('click', () => {
        data.goals = data.goals.filter(g => g.id !== btn.dataset.removeGoal);
        saveData(); renderAll();
      });
    });
    container.querySelectorAll('[data-goal-add]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.goalAdd;
        const input = container.querySelector(`[data-goal-input="${id}"]`);
        const amount = parseFloat(input.value);
        if (!amount || amount <= 0) return;
        const g = data.goals.find(g => g.id === id);
        if (!g) return;
        g.current += amount;
        saveData(); renderAll();
      });
    });
  }

  // ---------------- Safety cushion ----------------
  const cushionTargetForm = document.getElementById('cushionTargetForm');
  const cushionForm = document.getElementById('cushionForm');

  cushionTargetForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const target = parseFloat(document.getElementById('cushionTargetInput').value);
    data.cushion.target = target > 0 ? target : 0;
    saveData();
    renderCushion();
  });

  cushionForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const amount = parseFloat(document.getElementById('cushionAmount').value);
    if (!amount || amount <= 0) return;
    const action = e.submitter ? e.submitter.dataset.action : 'add';
    if (action === 'withdraw') {
      data.cushion.current = Math.max(0, data.cushion.current - amount);
    } else {
      data.cushion.current += amount;
    }
    saveData();
    cushionForm.reset();
    renderCushion();
    renderDashboard();
  });

  function renderCushion() {
    const target = data.cushion.target || 0;
    const current = data.cushion.current || 0;
    const pct = target > 0 ? clamp((current / target) * 100, 0, 100) : 0;

    document.getElementById('cushionTargetInput').value = target || '';
    document.getElementById('cushionFill').style.width = pct.toFixed(1) + '%';
    document.getElementById('cushionStatusText').textContent = target > 0
      ? `Накоплено ${fmtMoney(current)} из ${fmtMoney(target)} (${pct.toFixed(0)}%)`
      : `Накоплено ${fmtMoney(current)}. Укажите целевую сумму выше, чтобы видеть прогресс.`;

    // dashboard mini
    document.getElementById('dashCushionFill').style.width = pct.toFixed(1) + '%';
    document.getElementById('dashCushionText').textContent = target > 0
      ? `${fmtMoney(current)} из ${fmtMoney(target)} (${pct.toFixed(0)}%)`
      : `${fmtMoney(current)} накоплено`;
  }

  // ---------------- Dashboard ----------------
  let categoriesChart = null;
  let trendChart = null;

  function renderDashboard() {
    const curMonth = monthKey(todayISO());
    const monthTx = data.transactions.filter(t => monthKey(t.date) === curMonth);
    const income = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const balance = income - expense;
    const rate = income > 0 ? clamp((balance / income) * 100, -999, 100) : 0;

    document.getElementById('statIncome').textContent = fmtMoney(income);
    document.getElementById('statExpense').textContent = fmtMoney(expense);
    document.getElementById('statBalance').textContent = (balance >= 0 ? '+' : '') + fmtMoney(balance);
    document.getElementById('statRate').textContent = rate.toFixed(0) + '%';

    // Category doughnut (current month expenses)
    const byCat = {};
    monthTx.filter(t => t.type === 'expense').forEach(t => { byCat[t.category] = (byCat[t.category] || 0) + t.amount; });
    const catLabels = Object.keys(byCat);
    const catValues = catLabels.map(k => byCat[k]);
    const catEmpty = document.getElementById('chartCategoriesEmpty');
    catEmpty.hidden = catLabels.length > 0;

    if (categoriesChart) categoriesChart.destroy();
    if (catLabels.length > 0) {
      categoriesChart = new Chart(document.getElementById('chartCategories'), {
        type: 'doughnut',
        data: {
          labels: catLabels,
          datasets: [{
            data: catValues,
            backgroundColor: catLabels.map(c => CATEGORY_COLORS[c] || '#adb5bd'),
            borderWidth: 0
          }]
        },
        options: {
          plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } } },
          maintainAspectRatio: false
        }
      });
    }

    // Trend chart (last 6 months)
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      months.push(d.toISOString().slice(0, 7));
    }
    const incomeSeries = months.map(m => data.transactions.filter(t => t.type === 'income' && monthKey(t.date) === m).reduce((s, t) => s + t.amount, 0));
    const expenseSeries = months.map(m => data.transactions.filter(t => t.type === 'expense' && monthKey(t.date) === m).reduce((s, t) => s + t.amount, 0));

    if (trendChart) trendChart.destroy();
    trendChart = new Chart(document.getElementById('chartTrend'), {
      type: 'bar',
      data: {
        labels: months.map(m => capitalize(monthLabelShort(m))),
        datasets: [
          { label: 'Доходы', data: incomeSeries, backgroundColor: '#16a34a', borderRadius: 6 },
          { label: 'Расходы', data: expenseSeries, backgroundColor: '#e0435b', borderRadius: 6 }
        ]
      },
      options: {
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } } },
        scales: { y: { beginAtZero: true, ticks: { callback: (v) => v >= 1000 ? (v / 1000) + 'к' : v } } }
      }
    });

    // Goals mini list
    const goalsListEl = document.getElementById('dashGoalsList');
    if (data.goals.length === 0) {
      goalsListEl.innerHTML = '<p class="mini-text">Пока нет целей — добавьте свою мечту во вкладке «Копилка на мечту»</p>';
    } else {
      goalsListEl.innerHTML = data.goals.slice(0, 3).map(g => {
        const pct = g.target > 0 ? clamp((g.current / g.target) * 100, 0, 100) : 0;
        return `<div class="mini-goal-item">
          <div class="row"><span>${escapeHtml(g.name)}</span><span>${pct.toFixed(0)}%</span></div>
          <div class="progress-bar"><div class="progress-fill goal" style="width:${pct.toFixed(1)}%"></div></div>
        </div>`;
      }).join('');
    }

    // Credits mini
    const activeCredits = data.credits.filter(c => c.remaining > 0);
    const totalDebt = activeCredits.reduce((s, c) => s + c.remaining, 0);
    document.getElementById('dashCreditsTotal').textContent = fmtMoney(totalDebt);
    const next = activeCredits.slice().sort((a, b) => (a.nextDate || '').localeCompare(b.nextDate || ''))[0];
    document.getElementById('dashCreditsNext').textContent = next
      ? `Ближайший платёж: ${escapeHtml(next.name)} — ${fmtMoney(next.monthly)} (${fmtDate(next.nextDate)})`
      : 'Активных кредитов нет';
  }

  // ---------------- Onboarding banner ----------------
  function renderOnboarding() {
    const isEmpty = data.transactions.length === 0 && data.credits.length === 0 && data.goals.length === 0 && !data.cushion.current;
    document.getElementById('onboardingBanner').hidden = !isEmpty;
  }

  document.getElementById('loadDemoBtn').addEventListener('click', () => {
    loadDemoData();
  });

  function loadDemoData() {
    const today = new Date();
    const tx = [];
    const cats = { income: ['Зарплата', 'Фриланс'], expense: ['Еда', 'Транспорт', 'Жильё', 'Развлечения', 'Здоровье'] };
    for (let m = 5; m >= 0; m--) {
      const d = new Date(today.getFullYear(), today.getMonth() - m, 5);
      const dateBase = d.toISOString().slice(0, 10);
      tx.push({ id: uid(), type: 'income', amount: 90000 + Math.round(Math.random() * 8000), category: 'Зарплата', date: dateBase, note: '' });
      if (Math.random() > 0.5) {
        tx.push({ id: uid(), type: 'income', amount: 8000 + Math.round(Math.random() * 10000), category: 'Фриланс', date: addMonths(dateBase, 0), note: 'подработка' });
      }
      const expenses = [
        ['Еда', 18000], ['Транспорт', 4500], ['Жильё', 30000], ['Развлечения', 6000], ['Здоровье', 3000]
      ];
      expenses.forEach(([cat, base], idx) => {
        tx.push({
          id: uid(), type: 'expense',
          amount: Math.round(base * (0.8 + Math.random() * 0.4)),
          category: cat,
          date: new Date(d.getFullYear(), d.getMonth(), 8 + idx * 3).toISOString().slice(0, 10),
          note: ''
        });
      });
    }
    data.transactions = data.transactions.concat(tx);
    data.credits.push({
      id: uid(), name: 'Потребительский кредит', total: 300000, remaining: 180000,
      monthly: 12000, rate: 14.9, nextDate: addMonths(todayISO(), 1)
    });
    data.goals.push({ id: uid(), name: 'Поездка в Грузию', target: 150000, current: 45000, deadline: addMonths(todayISO(), 5) });
    data.goals.push({ id: uid(), name: 'Новый ноутбук', target: 120000, current: 90000, deadline: '' });
    data.cushion.current = 60000;
    data.cushion.target = 300000;
    saveData();
    renderAll();
  }

  // ---------------- Export / Import / Reset ----------------
  document.getElementById('exportBtn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `моифинансы_${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  const importInput = document.getElementById('importInput');
  document.getElementById('importBtn').addEventListener('click', () => importInput.click());
  importInput.addEventListener('change', () => {
    const file = importInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!confirm('Импортированные данные заменят текущие. Продолжить?')) return;
        data = Object.assign(defaultData(), parsed);
        saveData();
        renderAll();
      } catch (e) {
        alert('Не удалось прочитать файл. Убедитесь, что это корректный экспорт из этого приложения.');
      }
    };
    reader.readAsText(file);
    importInput.value = '';
  });

  document.getElementById('resetBtn').addEventListener('click', () => {
    if (!confirm('Удалить все данные без возможности восстановления?')) return;
    data = defaultData();
    saveData();
    renderAll();
  });

  // ---------------- Render all ----------------
  function renderAll() {
    populateMonthFilter();
    renderTransactionsTable();
    renderCredits();
    renderGoals();
    renderCushion();
    renderDashboard();
    renderOnboarding();
  }

  renderAll();
})();
