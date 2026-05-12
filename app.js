const STORAGE_KEY = "codex-money-ledger-v1";

const categories = {
  expense: ["餐飲", "交通", "購物", "住宿", "娛樂", "醫療", "學習", "其他"],
  income: ["薪資", "獎金", "投資", "退款", "兼職", "其他"]
};

const state = {
  transactions: [],
  type: "expense"
};

const formatter = new Intl.NumberFormat("zh-TW", {
  style: "currency",
  currency: "TWD",
  maximumFractionDigits: 0
});

const els = {
  form: document.querySelector("#transactionForm"),
  typeInput: document.querySelector("#typeInput"),
  dateInput: document.querySelector("#dateInput"),
  amountInput: document.querySelector("#amountInput"),
  categoryInput: document.querySelector("#categoryInput"),
  methodInput: document.querySelector("#methodInput"),
  noteInput: document.querySelector("#noteInput"),
  typeButtons: document.querySelectorAll(".type-button"),
  monthInput: document.querySelector("#monthInput"),
  filterType: document.querySelector("#filterType"),
  searchInput: document.querySelector("#searchInput"),
  incomeMetric: document.querySelector("#incomeMetric"),
  expenseMetric: document.querySelector("#expenseMetric"),
  balanceMetric: document.querySelector("#balanceMetric"),
  chartTotal: document.querySelector("#chartTotal"),
  categoryChart: document.querySelector("#categoryChart"),
  recordsList: document.querySelector("#recordsList"),
  recordTemplate: document.querySelector("#recordTemplate"),
  exportJsonBtn: document.querySelector("#exportJsonBtn"),
  exportCsvBtn: document.querySelector("#exportCsvBtn"),
  importInput: document.querySelector("#importInput")
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function currentMonth() {
  return today().slice(0, 7);
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.transactions));
}

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    state.transactions = Array.isArray(saved) ? saved : [];
  } catch {
    state.transactions = [];
  }
}

function setType(type) {
  state.type = type;
  els.typeInput.value = type;
  els.typeButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.type === type);
  });
  renderCategories();
}

function renderCategories() {
  els.categoryInput.innerHTML = categories[state.type]
    .map((category) => `<option>${category}</option>`)
    .join("");
}

function transactionMonth(transaction) {
  return transaction.date.slice(0, 7);
}

function getVisibleTransactions() {
  const selectedMonth = els.monthInput.value;
  const query = els.searchInput.value.trim().toLowerCase();
  const filterType = els.filterType.value;

  return state.transactions
    .filter((transaction) => transactionMonth(transaction) === selectedMonth)
    .filter((transaction) => filterType === "all" || transaction.type === filterType)
    .filter((transaction) => {
      if (!query) return true;
      return `${transaction.category} ${transaction.note} ${transaction.method}`
        .toLowerCase()
        .includes(query);
    })
    .sort((a, b) => `${b.date}${b.createdAt}`.localeCompare(`${a.date}${a.createdAt}`));
}

function getMonthTransactions() {
  return state.transactions.filter((transaction) => transactionMonth(transaction) === els.monthInput.value);
}

function sumByType(transactions, type) {
  return transactions
    .filter((transaction) => transaction.type === type)
    .reduce((sum, transaction) => sum + transaction.amount, 0);
}

function renderSummary() {
  const monthTransactions = getMonthTransactions();
  const income = sumByType(monthTransactions, "income");
  const expense = sumByType(monthTransactions, "expense");

  els.incomeMetric.textContent = formatter.format(income);
  els.expenseMetric.textContent = formatter.format(expense);
  els.balanceMetric.textContent = formatter.format(income - expense);
  renderChart(monthTransactions.filter((transaction) => transaction.type === "expense"));
}

function renderChart(expenses) {
  const totals = expenses.reduce((grouped, transaction) => {
    grouped[transaction.category] = (grouped[transaction.category] || 0) + transaction.amount;
    return grouped;
  }, {});
  const rows = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const max = rows[0]?.[1] || 0;
  const total = rows.reduce((sum, [, amount]) => sum + amount, 0);

  els.chartTotal.textContent = formatter.format(total);

  if (!rows.length) {
    els.categoryChart.innerHTML = `<div class="empty-state">本月尚無支出</div>`;
    return;
  }

  els.categoryChart.innerHTML = rows
    .map(([category, amount], index) => {
      const colors = ["#256a8a", "#bc3f35", "#157f5b", "#b97822", "#6f5b9a", "#61715f"];
      const width = Math.max((amount / max) * 100, 4);
      return `
        <div class="chart-row">
          <span class="chart-name" title="${escapeHtml(category)}">${escapeHtml(category)}</span>
          <div class="bar-track">
            <div class="bar-fill" style="width: ${width}%; background: ${colors[index % colors.length]}"></div>
          </div>
          <span class="chart-value">${formatter.format(amount)}</span>
        </div>
      `;
    })
    .join("");
}

function renderRecords() {
  const visible = getVisibleTransactions();

  if (!visible.length) {
    els.recordsList.innerHTML = `<div class="empty-state">沒有符合條件的紀錄</div>`;
    return;
  }

  els.recordsList.innerHTML = "";
  visible.forEach((transaction) => {
    const node = els.recordTemplate.content.firstElementChild.cloneNode(true);
    const sign = transaction.type === "income" ? "+" : "-";
    const note = transaction.note ? ` · ${transaction.note}` : "";

    node.classList.toggle("income", transaction.type === "income");
    node.querySelector(".record-title").textContent = transaction.category;
    node.querySelector(".record-meta").textContent = `${transaction.date} · ${transaction.method}${note}`;
    node.querySelector(".record-amount").textContent = `${sign}${formatter.format(transaction.amount)}`;
    node.querySelector(".delete-button").addEventListener("click", () => {
      state.transactions = state.transactions.filter((item) => item.id !== transaction.id);
      save();
      render();
    });
    els.recordsList.appendChild(node);
  });
}

function render() {
  renderSummary();
  renderRecords();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };
    return map[char];
  });
}

function download(filename, contents, type) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function toCsv(transactions) {
  const header = ["日期", "類型", "分類", "付款方式", "金額", "備註"];
  const rows = transactions.map((transaction) => [
    transaction.date,
    transaction.type === "income" ? "收入" : "支出",
    transaction.category,
    transaction.method,
    transaction.amount,
    transaction.note
  ]);
  return [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

function bindEvents() {
  els.typeButtons.forEach((button) => {
    button.addEventListener("click", () => setType(button.dataset.type));
  });

  els.form.addEventListener("submit", (event) => {
    event.preventDefault();
    const amount = Number(els.amountInput.value);
    if (!Number.isFinite(amount) || amount <= 0) return;

    state.transactions.push({
      id: crypto.randomUUID(),
      type: state.type,
      date: els.dateInput.value,
      amount,
      category: els.categoryInput.value,
      method: els.methodInput.value,
      note: els.noteInput.value.trim(),
      createdAt: new Date().toISOString()
    });

    save();
    els.amountInput.value = "";
    els.noteInput.value = "";
    els.amountInput.focus();
    render();
  });

  [els.monthInput, els.filterType, els.searchInput].forEach((input) => {
    input.addEventListener("input", render);
  });

  els.exportJsonBtn.addEventListener("click", () => {
    download(`money-ledger-${today()}.json`, JSON.stringify(state.transactions, null, 2), "application/json");
  });

  els.exportCsvBtn.addEventListener("click", () => {
    download(`money-ledger-${today()}.csv`, toCsv(state.transactions), "text/csv;charset=utf-8");
  });

  els.importInput.addEventListener("change", async () => {
    const file = els.importInput.files[0];
    if (!file) return;
    try {
      const imported = JSON.parse(await file.text());
      if (!Array.isArray(imported)) throw new Error("Invalid file");
      state.transactions = imported.filter((item) => item.id && item.date && item.type && Number.isFinite(Number(item.amount)));
      save();
      render();
    } catch {
      alert("匯入失敗，請選擇此工具匯出的 JSON 檔。");
    } finally {
      els.importInput.value = "";
    }
  });
}

function init() {
  load();
  els.dateInput.value = today();
  els.monthInput.value = currentMonth();
  setType("expense");
  bindEvents();
  render();
}

init();
