document.addEventListener("DOMContentLoaded", async () => {
  loadAuth();
  await loadDashboard();
  await loadAllExpenses();
});

async function loadDashboard() {
  try {
    const res = await fetch(`${API_URL}/dashboard/summary`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error("Failed to load dashboard");
    const data = await res.json();

    document.getElementById("totalIncome").textContent = `${data.total_income.toFixed(2)} MAD`;
    document.getElementById("totalExpense").textContent = `${data.total_expense.toFixed(2)} MAD`;
    document.getElementById("netBalance").textContent = `${data.net_balance.toFixed(2)} MAD`;

    // Render list
    const list = document.getElementById("recentExpensesList");
    list.innerHTML = "";
    data.recent_expenses.forEach(e => {
      const li = document.createElement("li");
      li.className = "list-group-item d-flex justify-content-between";
      li.innerHTML = `
        <span>${e.description}</span>
        <span>${e.amount.toFixed(2)} ${e.currency}</span>
      `;
      list.appendChild(li);
    });

    renderChart(data);

  } catch (err) {
    console.error(err);
    alert("Error loading dashboard!");
  }
}

function renderChart(data) {
  const ctx = document.getElementById("summaryChart").getContext("2d");
  new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Incomes", "Expenses"],
      datasets: [{
        data: [data.total_income, data.total_expense],
        backgroundColor: ["#4CAF50", "#F44336"]
      }]
    },
    options: {
      plugins: { legend: { position: "bottom" } }
    }
  });
}


// ----------------------------
// Load all expenses
// ----------------------------
async function loadAllExpenses() {
  try {
    console.log("🔄 Loading all expenses...");
    
    // First, get the current user ID
    const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
    const currentUserId = currentUser.id;
    
    if (!currentUserId) {
      console.error("❌ No current user ID found");
      showError("Please log in to view expenses");
      return;
    }
    
    console.log("👤 Current user ID:", currentUserId);
    
    const url = `${API_URL}/expenses/all`;
    const res = await fetch(url, {
      headers: getHeaders()
    });
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    
    const allExpenses = await res.json();
    console.log("✅ All expenses loaded:", allExpenses.length, "expenses");
    
    // Filter expenses where the current user is a participant
    const userExpenses = allExpenses.filter(expense => {
      // Check if the current user has a split in this expense
      const hasSplit = expense.splits && expense.splits.some(split => split.user_id === currentUserId);
      return hasSplit;
    });
    
    console.log("✅ User's expenses:", userExpenses.length, "expenses");

    renderExpensesTable(userExpenses);
    setupFilters(userExpenses);
    updateExpenseCount(userExpenses.length);

  } catch (err) {
    console.error("❌ Error loading expenses:", err);
    showError("Failed to load expenses: " + err.message);
  }
}

// ----------------------------
// Render table
// ----------------------------
async function renderExpensesTable(expenses) {
  // First, get the current user ID
    const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
    const currentUserId = currentUser.id;
    
    if (!currentUserId) {
      console.error("❌ No current user ID found");
      showError("Please log in to view expenses");
      return;
    }
    
  const tableBody = document.getElementById("allExpensesTableBody");
  
  if (!tableBody) return console.warn("⚠️ Table body not found");


 

  tableBody.innerHTML = "";

  if (!Array.isArray(expenses) || expenses.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center text-muted py-4">
          <i class="bi bi-inbox fs-1 d-block mb-2"></i>
          No expenses found.
        </td>
      </tr>
    `;
    return;
  }

  expenses.forEach((expense, index) => {
    const row = document.createElement("tr");
    row.className = "fade-in";
    row.style.animationDelay = `${index * 0.05}s`;

    const date = expense.created_at
      ? new Date(expense.created_at).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : "—";

    // ✅ Find the current user's share_amount for this expense
    let shareAmount = "—";
    if (Array.isArray(expense.splits)) {
      const userSplit = expense.splits.find(
        (s) => s.user_id === currentUserId
      );
      if (userSplit) {
        shareAmount = userSplit.share_amount
          ? userSplit.share_amount.toFixed(2)
          : "0.00";
      }
    }
    const amount = expense.amount ? expense.amount.toFixed(2) : "0.00";
    const currency = expense.currency || "MAD";

    // ✅ Render row
    row.innerHTML = `
      <td>
        <div class="d-flex align-items-center">
          <i class="bi bi-calendar3 me-2 text-muted"></i>
          <span>${date}</span>
        </div>
      </td>
      <td>
        <div class="d-flex align-items-center">
          <div class="badge bg-primary me-2">${expense.group_name || "Unknown"}</div>
        </div>
      </td>
      <td>
        <div class="fw-semibold">${expense.description || "—"}</div>
        ${
          expense.category
            ? `<small class="text-muted">${expense.category}</small>`
            : ""
        }
      </td>
      <td>
        <div class="fw-bold text-success">${amount} ${currency}</div>
      </td>
      <td>
        <div class="fw-bold text-success">${shareAmount} ${currency}</div>
      </td>
      <td>
        <div class="d-flex align-items-center">
          <div
            class="avatar rounded-circle bg-info text-white d-flex align-items-center justify-content-center me-2"
            style="width:32px;height:32px;font-size:0.8rem;font-weight:bold;"
          >
            ${(expense.payer_name || "U").charAt(0).toUpperCase()}
          </div>
          <span>${expense.payer_name || "Unknown"}</span>
        </div>
      </td>
      <td>
        <div class="d-flex align-items-center">
          <div
            class="avatar rounded-circle bg-secondary text-white d-flex align-items-center justify-content-center me-2"
            style="width:32px;height:32px;font-size:0.8rem;font-weight:bold;"
          >
            ${(expense.added_by_username || "U").charAt(0).toUpperCase()}
          </div>
          <span>${expense.added_by_username || "Unknown"}</span>
        </div>
      </td>
      <td>
        <div class="btn-group btn-group-sm">
          <button class="btn btn-outline-primary" onclick="viewExpense(${
            expense.id
          })" title="View Details">
            <i class="bi bi-eye"></i>
          </button>
          <button class="btn btn-outline-secondary" onclick="editExpense(${
            expense.id
          })" title="Edit">
            <i class="bi bi-pencil"></i>
          </button>
        </div>
      </td>
    `;

    tableBody.appendChild(row);
  });
}

// ----------------------------
// Setup filters (real time)
// ----------------------------
function setupFilters(expenses) {
  const fromInput = document.getElementById("filterFrom");
  const toInput = document.getElementById("filterTo");
  const groupSelect = document.getElementById("filterGroup");
  const titleInput = document.getElementById("filterTitle");
  const clearBtn = document.getElementById("clearFilters");

  // Populate group list
  const groups = [...new Set(expenses.map(e => e.group_name).filter(Boolean))];
  groupSelect.innerHTML = `<option value="">All Groups</option>`;
  groups.forEach(group => {
    groupSelect.insertAdjacentHTML("beforeend", `<option value="${group}">${group}</option>`);
  });

  const applyFilters = () => {
    const from = fromInput.value ? new Date(fromInput.value) : null;
    const to = toInput.value ? new Date(toInput.value) : null;
    const group = groupSelect.value;
    const title = titleInput.value.toLowerCase();

    const filtered = expenses.filter(expense => {
      const expenseDate = expense.created_at ? new Date(expense.created_at) : null;
      const matchesDate = !from || !to || (expenseDate && expenseDate >= from && expenseDate <= to);
      const matchesGroup = !group || expense.group_name === group;
      const matchesTitle = !title || (expense.description && expense.description.toLowerCase().includes(title));

      return matchesDate && matchesGroup && matchesTitle;
    });

    renderExpensesTable(filtered);
    updateExpenseCount(filtered.length);
  };

  const clearFilters = () => {
    fromInput.value = "";
    toInput.value = "";
    groupSelect.value = "";
    titleInput.value = "";
    applyFilters();
  };

  // Add event listeners
  [fromInput, toInput, groupSelect, titleInput].forEach(el => {
    el.addEventListener("input", applyFilters);
    el.addEventListener("change", applyFilters);
  });

  if (clearBtn) {
    clearBtn.addEventListener("click", clearFilters);
  }
}

// ----------------------------
// Update expense count
// ----------------------------
function updateExpenseCount(count) {
  const countElement = document.getElementById("expenseCount");
  if (countElement) {
    countElement.textContent = count;
  }
}

// ----------------------------
// Action functions
// ----------------------------
function viewExpense(expenseId) {
  console.log("Viewing expense:", expenseId);
  // TODO: Implement expense detail modal
  alert(`View expense ${expenseId} - Feature coming soon!`);
}

function editExpense(expenseId) {
  console.log("Editing expense:", expenseId);
  // TODO: Implement expense edit functionality
  alert(`Edit expense ${expenseId} - Feature coming soon!`);
}

// ----------------------------
// Utility functions
// ----------------------------
function showError(message) {
  // Create a simple toast notification
  const toast = document.createElement("div");
  toast.className = "alert alert-danger alert-dismissible fade show position-fixed";
  toast.style.cssText = "top: 20px; right: 20px; z-index: 9999; min-width: 300px;";
  toast.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
  `;
  document.body.appendChild(toast);
  
  // Auto remove after 5 seconds
  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 5000);
}

// ----------------------------
// Initialize on page load
// ----------------------------
// Note: Already handled in the main DOMContentLoaded event above