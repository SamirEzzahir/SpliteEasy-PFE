document.addEventListener("DOMContentLoaded", async () => {
  const balancesContainer = document.getElementById("balancesContainer");
  const monthlyTableBody = document.getElementById("monthlyTableBody");
  const ledgerTableBody = document.getElementById("ledgerTableBody");
  const systemSelector = document.getElementById("systemSelector");

  // Modal Elements
  const strategyModal = new bootstrap.Modal(document.getElementById("strategyModal"));
  const distributeModal = new bootstrap.Modal(document.getElementById("distributeModal"));
  const spendModal = new bootstrap.Modal(document.getElementById("spendModal"));
  const sourcesModal = new bootstrap.Modal(document.getElementById("sourcesModal"));

  // Forms
  const strategyForm = document.getElementById("strategyForm");
  const distributeForm = document.getElementById("distributeForm");
  const spendForm = document.getElementById("spendForm");
  const addSourceForm = document.getElementById("addSourceForm");

  // Strategy Inputs
  const strategyModalTitle = document.getElementById("strategyModalTitle");
  const strategyIdInput = document.getElementById("strategyId");
  const strategyNameInput = document.getElementById("strategyName");
  const saveStrategyBtn = document.getElementById("saveStrategyBtn");
  const totalPercentDisplay = document.getElementById("totalPercentDisplay");
  const percentInputs = document.querySelectorAll(".percent-input");

  // Income Source Inputs
  const incomeSourceSelect = document.getElementById("incomeSourceSelect");
  const sourcesList = document.getElementById("sourcesList");
  const newSourceName = document.getElementById("newSourceName");

  // --- Configuration ---
  const JARS = {
    NEC: { name: "Necessities", icon: "bi-house-door", color: "bg-orange", desc: "Rent, Food, Bills" },
    FFA: { name: "Financial Freedom", icon: "bi-graph-up-arrow", color: "bg-yellow", desc: "Investments, Passive Income" },
    EDU: { name: "Education", icon: "bi-book", color: "bg-grey", desc: "Books, Courses, Seminars" },
    LTSS: { name: "Long Term Savings", icon: "bi-piggy-bank", color: "bg-blue", desc: "Big purchases, Rainy day" },
    PLAY: { name: "Play", icon: "bi-controller", color: "bg-light-green", desc: "Fun, Hobbies, Dining out" },
    GIVE: { name: "Give", icon: "bi-heart", color: "bg-green", desc: "Charity, Gifts" }
  };

  let strategies = [];
  let currentStrategyId = null;
  let incomeSources = [];

  // --- API Functions ---

  async function fetchStrategies() {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const res = await fetch(`${API_URL}/econome/strategies`, {
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        strategies = data.map(s => ({
          id: s.id,
          name: s.name,
          icon: s.user_id ? "bi-person-gear" : getIconForDefault(s.name),
          nec: s.nec, ffa: s.ffa, edu: s.edu,
          ltss: s.ltss, play: s.play, give: s.give,
          is_default: s.user_id === null,
          user_id: s.user_id
        }));

        if (!currentStrategyId && strategies.length > 0) {
          currentStrategyId = strategies[0].id;
        }

        renderSystemSelector();
        populateDistributeSelect();
      }
    } catch (err) {
      console.error("Failed to fetch strategies", err);
    }
  }

  async function fetchBalances() {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/econome/balances`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const balances = await res.json();
        renderBalances(balances);
      }
    } catch (err) {
      console.error("Failed to fetch balances", err);
    }
  }

  async function fetchMonthlySummary() {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/econome/monthly-summary`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const summary = await res.json();
        renderMonthlySummary(summary);
      }
    } catch (err) {
      console.error("Failed to fetch monthly summary", err);
    }
  }

  async function fetchLedger() {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/econome/ledger`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const transactions = await res.json();
        renderLedger(transactions);
      }
    } catch (err) {
      console.error("Failed to fetch ledger", err);
    }
  }

  async function fetchIncomeSources() {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/econome/income-sources`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        incomeSources = await res.json();
        renderIncomeSources();
      }
    } catch (err) {
      console.error("Failed to fetch income sources", err);
    }
  }

  // --- Action Functions ---

  async function distributeIncome(amount, strategyId, description) {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/econome/distribute?amount=${amount}&strategy_id=${strategyId}&description=${description}`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}` }
    });

    if (res.ok) {
      await refreshAll();
      distributeModal.hide();
      distributeForm.reset();
    } else {
      alert("Failed to distribute income");
    }
  }

  async function logExpense(amount, jarType, description) {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/econome/spend?amount=${amount}&jar_type=${jarType}&description=${description}`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}` }
    });

    if (res.ok) {
      await refreshAll();
      spendModal.hide();
      spendForm.reset();
    } else {
      alert("Failed to log expense");
    }
  }

  async function addIncomeSource(name) {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/econome/income-sources`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ name })
    });

    if (res.ok) {
      await fetchIncomeSources();
      newSourceName.value = "";
    } else {
      alert("Failed to add income source");
    }
  }

  async function deleteIncomeSource(id) {
    if (!confirm("Delete this income source?")) return;

    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/econome/income-sources/${id}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${token}` }
    });

    if (res.ok) {
      await fetchIncomeSources();
    } else {
      alert("Failed to delete income source");
    }
  }

  async function refreshAll() {
    await Promise.all([fetchBalances(), fetchMonthlySummary(), fetchLedger()]);
  }

  // --- UI Rendering ---

  function renderBalances(balances) {
    balancesContainer.innerHTML = "";
    const balMap = {};
    balances.forEach(b => balMap[b.jar_type] = b.balance);

    const jarOrder = ["NEC", "FFA", "EDU", "LTSS", "PLAY", "GIVE"];

    jarOrder.forEach((jarKey, index) => {
      const config = JARS[jarKey];
      const amount = balMap[jarKey] || 0;

      const cardHtml = `
                <div class="col-md-6 col-lg-4 animate-in" style="animation-delay: ${index * 0.1}s">
                    <div class="card jar-card ${config.color} shadow-sm h-100">
                        <div class="card-body p-4">
                            <div class="d-flex justify-content-between align-items-start mb-3">
                                <div class="jar-icon-wrapper bg-white bg-opacity-25 rounded-circle p-3">
                                    <i class="bi ${config.icon} fs-4 text-white"></i>
                                </div>
                                <span class="badge bg-white bg-opacity-25 text-white border-0">${jarKey}</span>
                            </div>
                            
                            <h5 class="card-title text-white mb-1 opacity-75">${config.name}</h5>
                            <div class="display-6 fw-bold text-white mb-2">${formatCurrency(amount)}</div>
                            <small class="text-white opacity-75">${config.desc}</small>
                        </div>
                    </div>
                </div>
            `;
      balancesContainer.insertAdjacentHTML("beforeend", cardHtml);
    });
  }

  function renderMonthlySummary(summary) {
    monthlyTableBody.innerHTML = "";
    if (summary.length === 0) {
      monthlyTableBody.innerHTML = `<tr><td colspan="8" class="text-center text-muted py-4">No data available</td></tr>`;
      return;
    }

    summary.forEach(row => {
      const tr = `
                <tr>
                    <td class="ps-4 text-start fw-bold text-muted">${row.month}</td>
                    <td class="fw-medium">${formatCurrency(row.NEC)}</td>
                    <td class="fw-medium">${formatCurrency(row.FFA)}</td>
                    <td class="fw-medium">${formatCurrency(row.EDU)}</td>
                    <td class="fw-medium">${formatCurrency(row.LTSS)}</td>
                    <td class="fw-medium">${formatCurrency(row.PLAY)}</td>
                    <td class="fw-medium">${formatCurrency(row.GIVE)}</td>
                    <td class="text-end pe-4 fw-bold">${formatCurrency(row.total)}</td>
                </tr>
            `;
      monthlyTableBody.insertAdjacentHTML("beforeend", tr);
    });
  }

  function renderLedger(transactions) {
    ledgerTableBody.innerHTML = "";
    if (transactions.length === 0) {
      ledgerTableBody.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-4">No transactions yet</td></tr>`;
      return;
    }

    transactions.forEach(txn => {
      const isIncome = txn.amount > 0;
      const colorClass = isIncome ? "text-success" : "text-danger";
      const sign = isIncome ? "+" : "";

      const row = `
                <tr>
                    <td class="ps-4 text-muted small">${new Date(txn.date).toLocaleDateString()}</td>
                    <td class="fw-medium">${txn.description}</td>
                    <td><span class="badge bg-light text-dark border">${txn.jar_type}</span></td>
                    <td class="text-end pe-4 fw-bold ${colorClass}">${sign}${formatCurrency(txn.amount)}</td>
                </tr>
            `;
      ledgerTableBody.insertAdjacentHTML("beforeend", row);
    });
  }

  function renderIncomeSources() {
    // Populate Dropdown
    incomeSourceSelect.innerHTML = `<option value="" disabled selected>Select source...</option>`;
    incomeSources.forEach(s => {
      const option = document.createElement("option");
      option.value = s.name; // Use name as description
      option.textContent = s.name;
      incomeSourceSelect.appendChild(option);
    });

    // Populate List in Modal
    sourcesList.innerHTML = "";
    incomeSources.forEach(s => {
      const li = `
                <li class="list-group-item d-flex justify-content-between align-items-center px-0">
                    ${s.name}
                    <button class="btn btn-xs btn-outline-danger border-0" onclick="deleteSource(${s.id})">
                        <i class="bi bi-trash"></i>
                    </button>
                </li>
            `;
      sourcesList.insertAdjacentHTML("beforeend", li);
    });

    // Attach delete handlers
    document.querySelectorAll("#sourcesList button").forEach((btn, idx) => {
      btn.onclick = () => deleteIncomeSource(incomeSources[idx].id);
    });
  }

  function renderSystemSelector() {
    systemSelector.innerHTML = "";
    strategies.forEach(s => {
      const isActive = s.id == currentStrategyId ? "active" : "";
      const editBtn = !s.is_default
        ? `<div class="position-absolute top-0 end-0 p-1">
                     <button class="btn btn-xs btn-link text-muted p-0 edit-strategy-btn" data-id="${s.id}" title="Edit">
                       <i class="bi bi-pencil-fill" style="font-size: 0.7rem;"></i>
                     </button>
                   </div>`
        : "";

      const cardHtml = `
                <div class="col-4 col-md-3 position-relative">
                    <div class="system-select-card ${isActive}" data-id="${s.id}">
                        <i class="bi ${s.icon}"></i>
                        <div class="fw-bold small text-truncate w-100 px-1">${s.name}</div>
                    </div>
                    ${editBtn}
                </div>
            `;
      systemSelector.insertAdjacentHTML("beforeend", cardHtml);
    });

    document.querySelectorAll(".system-select-card").forEach(card => {
      card.addEventListener("click", () => {
        currentStrategyId = card.dataset.id;
        renderSystemSelector();
      });
    });

    document.querySelectorAll(".edit-strategy-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        openEditModal(btn.dataset.id);
      });
    });
  }

  function populateDistributeSelect() {
    const select = document.getElementById("distributeStrategy");
    select.innerHTML = "";
    strategies.forEach(s => {
      const option = document.createElement("option");
      option.value = s.id;
      option.textContent = s.name;
      if (s.id == currentStrategyId) option.selected = true;
      select.appendChild(option);
    });
  }

  // --- Helper Functions ---

  function getIconForDefault(name) {
    if (name.includes("Eker")) return "bi-book";
    if (name.includes("Improved")) return "bi-graph-up-arrow";
    if (name.includes("Économé")) return "bi-gem";
    return "bi-pie-chart";
  }

  function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'MAD',
      minimumFractionDigits: 2
    }).format(amount).replace('MAD', '').trim() + ' MAD';
  }

  // --- Event Listeners ---

  distributeForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const amount = document.getElementById("distributeAmount").value;
    const source = incomeSourceSelect.value;
    const stratId = document.getElementById("distributeStrategy").value;

    if (!source) {
      alert("Please select an income source");
      return;
    }

    distributeIncome(amount, stratId, source);
  });

  spendForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const amount = document.getElementById("spendAmount").value;
    const jar = document.getElementById("spendJar").value;
    const desc = document.getElementById("spendDesc").value;
    logExpense(amount, jar, desc);
  });

  addSourceForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = newSourceName.value.trim();
    if (name) addIncomeSource(name);
  });

  // Strategy Management (Simplified for brevity, same as before)
  function openEditModal(id) {
    const strategy = strategies.find(s => s.id == id);
    if (!strategy) return;
    strategyModalTitle.textContent = "Edit Strategy";
    strategyIdInput.value = strategy.id;
    strategyNameInput.value = strategy.name;
    document.getElementById("necInput").value = Math.round(strategy.nec * 100);
    document.getElementById("ffaInput").value = Math.round(strategy.ffa * 100);
    document.getElementById("eduInput").value = Math.round(strategy.edu * 100);
    document.getElementById("ltssInput").value = Math.round(strategy.ltss * 100);
    document.getElementById("playInput").value = Math.round(strategy.play * 100);
    document.getElementById("giveInput").value = Math.round(strategy.give * 100);
    updateTotalPercent();
    strategyModal.show();
  }

  document.getElementById("addStrategyBtn").addEventListener("click", () => {
    strategyModalTitle.textContent = "Create New Strategy";
    strategyForm.reset();
    strategyIdInput.value = "";
    updateTotalPercent();
  });

  function updateTotalPercent() {
    let total = 0;
    percentInputs.forEach(input => {
      total += parseInt(input.value) || 0;
    });
    totalPercentDisplay.textContent = total + "%";
    if (total === 100) {
      totalPercentDisplay.classList.remove("text-danger");
      totalPercentDisplay.classList.add("text-success");
      saveStrategyBtn.disabled = false;
    } else {
      totalPercentDisplay.classList.add("text-danger");
      totalPercentDisplay.classList.remove("text-success");
      saveStrategyBtn.disabled = true;
    }
  }

  percentInputs.forEach(input => {
    input.addEventListener("input", updateTotalPercent);
  });

  // Initial Load
  await fetchStrategies();
  await fetchIncomeSources();
  await refreshAll();
});