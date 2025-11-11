// Enhanced Balance Page JavaScript
// Call it once to initialize when script loads
loadAuth();

const params = new URLSearchParams(window.location.search);
const groupId = params.get("id");

let balancesData = [];

// -----------------------------
// Group Information Loading
// -----------------------------
async function loadGroupInfo() {
  try {
    console.log("🔄 Loading group info for group:", groupId);
    
    const res = await fetch(`${API_URL}/groups/${groupId}`, {
      headers: getHeaders(),
    });
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    
    const group = await res.json();
    console.log("📊 Group info loaded:", group);
    
    // Update currency display
    const currencyElement = document.getElementById("groupCurrency");
    if (currencyElement) {
      currencyElement.textContent = group.currency || 'USD';
    }
    
    return group;
  } catch (err) {
    console.error("❌ Error loading group info:", err);
    return null;
  }
}

// -----------------------------
// Utility Functions
// -----------------------------
function showError(message) {
  // Create toast notification
  const toast = document.createElement('div');
  toast.className = 'toast align-items-center text-white bg-danger border-0';
  toast.setAttribute('role', 'alert');
  toast.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">
        <i class="bi bi-exclamation-triangle me-2"></i>${message}
      </div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
    </div>
  `;
  
  // Add to page
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.className = 'toast-container position-fixed top-0 end-0 p-3';
    toastContainer.style.zIndex = '9999';
    document.body.appendChild(toastContainer);
  }
  
  toastContainer.appendChild(toast);
  
  // Show toast
  const bsToast = new bootstrap.Toast(toast);
  bsToast.show();
  
  // Remove after hide
  toast.addEventListener('hidden.bs.toast', () => {
    toast.remove();
  });
}

function showSuccess(message) {
  const toast = document.createElement('div');
  toast.className = 'toast align-items-center text-white bg-success border-0';
  toast.setAttribute('role', 'alert');
  toast.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">
        <i class="bi bi-check-circle me-2"></i>${message}
      </div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
    </div>
  `;
  
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.className = 'toast-container position-fixed top-0 end-0 p-3';
    toastContainer.style.zIndex = '9999';
    document.body.appendChild(toastContainer);
  }
  
  toastContainer.appendChild(toast);
  
  const bsToast = new bootstrap.Toast(toast);
  bsToast.show();
  
  toast.addEventListener('hidden.bs.toast', () => {
    toast.remove();
  });
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

function getRelativeTime(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);
  
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

// -----------------------------
// Load Current User
// -----------------------------
async function loadCurrentUser() {
  try {
    // Use the global currentUser from config.js
    if (!currentUser) {
      currentUser = await fetchCurrentUser();
    }
    if (!currentUser) {
      showError("User not authenticated");
      return false;
    }
    return true;
  } catch (err) {
    console.error("Error loading current user:", err);
    showError("Failed to load user data");
    return false;
  }
}

// -----------------------------
// Load Summary Statistics
// -----------------------------
function updateSummaryStats(balances) {
  console.log("📊 Updating summary stats with balances:", balances);
  
  // Use proper rounding to avoid floating-point errors
  const round = (num) => Math.round(num * 100) / 100;
  
  const totalLent = round(balances.filter(b => b.net > 0).reduce((sum, b) => sum + b.net, 0));
  const totalOwed = round(Math.abs(balances.filter(b => b.net < 0).reduce((sum, b) => sum + b.net, 0)));
  const netBalance = round(balances.reduce((sum, b) => sum + b.net, 0));
  
  console.log("📊 Calculated stats:", { totalLent, totalOwed, netBalance });
  
  document.getElementById('totalLent').textContent = `${formatCurrency(totalLent)} MAD`;
  document.getElementById('totalOwed').textContent = `${formatCurrency(totalOwed)} MAD`;
  document.getElementById('netBalance').textContent = `${formatCurrency(Math.abs(netBalance) < 0.01 ? 0 : netBalance)} MAD`;
}

// -----------------------------
// Load Balances
// -----------------------------
async function loadBalances() {
  console.log("🔄 Loading balances for group:", groupId);
  const container = document.querySelector("#balancesCards");
  container.innerHTML = `
    <div class="col-12 text-center text-muted py-4">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
      <div class="mt-2">Loading balances...</div>
    </div>
  `;

  try {
    console.log("🌐 Fetching balances from:", `${API_URL}/settle/${groupId}/balances`);
    const res = await fetch(`${API_URL}/settle/${groupId}/balances`, {
      headers: getHeaders(),
    });
    
    console.log("📡 Response status:", res.status);
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    
    const data = await res.json();
    console.log("📊 Received balances data:", data);
    balancesData = data;

    container.innerHTML = "";
    
    if (!data.length) {
      container.innerHTML = `
        <div class="col-12 text-center text-muted py-5">
          <i class="bi bi-people fs-1 mb-3"></i>
          <h5>No balances found</h5>
          <p>No members have any balances in this group.</p>
        </div>
      `;
      return;
    }

    // Update member count
    document.getElementById('memberCount').textContent = `${data.length} members`;

    // Update summary stats
    updateSummaryStats(data);

    data.forEach((balance) => {
      const color = balance.net > 0 ? "success" : balance.net < 0 ? "danger" : "secondary";
      const icon = balance.net > 0 ? "arrow-up-circle" : balance.net < 0 ? "arrow-down-circle" : "dash-circle";
      const status = balance.net > 0 ? "Lent" : balance.net < 0 ? "Owes" : "Even";
      
      const isCurrentUser = currentUser && balance.user_id === currentUser.id;

      const card = document.createElement("div");
      card.className = "col-12 col-sm-6 col-md-4 col-lg-3";
      card.innerHTML = `
        <div class="card border-${color} balance-card shadow-sm h-100 ${isCurrentUser ? 'border-3' : ''}">
          <div class="card-body text-center p-3">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <h6 class="card-title mb-0 fw-bold">${balance.username}</h6>
              ${isCurrentUser ? '<span class="badge bg-primary">You</span>' : ''}
            </div>
            <div class="mb-2">
              <i class="bi bi-${icon} fs-2 text-${color}"></i>
            </div>
            <p class="card-text fw-bold text-${color} mb-1">
              ${formatCurrency(Math.abs(balance.net))} MAD
            </p>
            <small class="text-muted">${status}</small>
          </div>
        </div>
      `;
      container.appendChild(card);
    });
  } catch (err) {
    console.error("Error loading balances:", err);
    container.innerHTML = `
      <div class="col-12 text-center text-danger py-4">
        <i class="bi bi-exclamation-triangle fs-1 mb-3"></i>
        <h5>Error loading balances</h5>
        <p>${err.message}</p>
        <button class="btn btn-outline-primary" onclick="loadBalances()">
          <i class="bi bi-arrow-clockwise me-1"></i>Retry
        </button>
      </div>
    `;
  }
}

// -----------------------------
// Load Settlements
// -----------------------------
async function loadSettlements() {
  const tbody = document.querySelector("#settlementsTable tbody");
  tbody.innerHTML = `
    <tr>
      <td colspan="4" class="text-center text-muted py-4">
        <div class="spinner-border text-warning" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        <div class="mt-2">Loading settlements...</div>
      </td>
    </tr>
  `;

  try {
    const res = await fetch(`${API_URL}/settle/${groupId}/settlements`, {
      headers: getHeaders(),
    });
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    
    const data = await res.json();

    tbody.innerHTML = "";
    
    if (!data.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" class="text-center text-success py-4">
            <i class="bi bi-check-circle fs-1 mb-3"></i>
            <h5>All settled up! 🎉</h5>
            <p class="mb-0">No settlements needed</p>
          </td>
        </tr>
      `;
      document.getElementById('settlementCount').textContent = '0 suggestions';
      return;
    }

    // Update settlement count
    document.getElementById('settlementCount').textContent = `${data.length} suggestions`;

    data.forEach((settlement) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>
          <div class="d-flex align-items-center">
            <div class="rounded-circle bg-danger text-white d-flex align-items-center justify-content-center me-2" style="width: 32px; height: 32px;">
              <i class="bi bi-person"></i>
            </div>
            <span class="fw-semibold">${settlement.from_username}</span>
          </div>
        </td>
        <td>
          <div class="d-flex align-items-center">
            <div class="rounded-circle bg-success text-white d-flex align-items-center justify-content-center me-2" style="width: 32px; height: 32px;">
              <i class="bi bi-person-check"></i>
            </div>
            <span class="fw-semibold">${settlement.to_username}</span>
          </div>
        </td>
        <td>
          <span class="badge bg-warning text-dark fs-6">
            ${formatCurrency(settlement.amount)} MAD
          </span>
        </td>
        <td>
          <button class="btn btn-outline-primary btn-sm" onclick="quickSettle('${settlement.from_username}', '${settlement.to_username}', ${settlement.amount})">
            <i class="bi bi-lightning me-1"></i>Quick Settle
          </button>
        </td>
      `;
      tbody.appendChild(row);
    });
  } catch (err) {
    console.error("Error loading settlements:", err);
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="text-center text-danger py-4">
          <i class="bi bi-exclamation-triangle fs-1 mb-3"></i>
          <h5>Error loading settlements</h5>
          <p>${err.message}</p>
          <button class="btn btn-outline-primary" onclick="loadSettlements()">
            <i class="bi bi-arrow-clockwise me-1"></i>Retry
          </button>
        </td>
      </tr>
    `;
  }
}

// -----------------------------
// Load History
// -----------------------------
async function loadHistory() {
  const tbody = document.querySelector("#historyTable tbody");
  tbody.innerHTML = `
    <tr>
      <td colspan="5" class="text-center text-muted py-4">
        <div class="spinner-border text-info" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        <div class="mt-2">Loading history...</div>
      </td>
    </tr>
  `;

  try {
    const res = await fetch(`${API_URL}/settle/${groupId}/history`, {
      headers: getHeaders(),
    });
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    
    const data = await res.json();

    tbody.innerHTML = "";
    
    if (!data.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="text-center text-muted py-4">
            <i class="bi bi-clock-history fs-1 mb-3"></i>
            <h5>No settlement history</h5>
            <p class="mb-0">No settlements have been recorded yet</p>
          </td>
        </tr>
      `;
      document.getElementById('historyCount').textContent = '0 records';
      return;
    }

    // Update history count
    document.getElementById('historyCount').textContent = `${data.length} records`;

    data.forEach((settlement) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>
          <div class="d-flex align-items-center">
            <div class="rounded-circle bg-danger text-white d-flex align-items-center justify-content-center me-2" style="width: 28px; height: 28px;">
              <i class="bi bi-person" style="font-size: 0.75rem;"></i>
            </div>
            <span>${settlement.from_username}</span>
          </div>
        </td>
        <td>
          <div class="d-flex align-items-center">
            <div class="rounded-circle bg-success text-white d-flex align-items-center justify-content-center me-2" style="width: 28px; height: 28px;">
              <i class="bi bi-person-check" style="font-size: 0.75rem;"></i>
            </div>
            <span>${settlement.to_username}</span>
          </div>
        </td>
        <td>
          <span class="fw-semibold text-success">
            ${formatCurrency(settlement.amount)} MAD
          </span>
        </td>
        <td>
          <small class="text-muted">${getRelativeTime(settlement.created_at)}</small>
        </td>
        <td>
          <span class="badge bg-success">
            <i class="bi bi-check-circle me-1"></i>Completed
          </span>
        </td>
      `;
      tbody.appendChild(row);
    });
  } catch (err) {
    console.error("Error loading history:", err);
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center text-danger py-4">
          <i class="bi bi-exclamation-triangle fs-1 mb-3"></i>
          <h5>Error loading history</h5>
          <p>${err.message}</p>
          <button class="btn btn-outline-primary" onclick="loadHistory()">
            <i class="bi bi-arrow-clockwise me-1"></i>Retry
          </button>
        </td>
      </tr>
    `;
  }
}

// -----------------------------
// Settlement Modal Functions
// -----------------------------
function openSettlementModal() {
  if (!balancesData || !currentUser) {
    showError("User data missing — please refresh the page");
    return;
}

  const select = document.getElementById("toUserSelect");
  const amountInput = document.getElementById("settleAmount");
  const preview = document.getElementById("settlementPreview");
  const currentBalanceEl = document.getElementById("currentBalance");

  // Reset form
  select.innerHTML = '<option value="">Select a member...</option>';
  amountInput.value = "";
  preview.style.display = "none";

  // Get current user's balance
  const myBalance = balancesData.find(b => b.user_id === currentUser.id);
  if (!myBalance) {
    showError("Your balance info is missing");
    return;
  }

  // Update current balance display
  const balanceColor = myBalance.net > 0 ? "text-success" : myBalance.net < 0 ? "text-danger" : "text-muted";
  const balanceIcon = myBalance.net > 0 ? "arrow-up-circle" : myBalance.net < 0 ? "arrow-down-circle" : "dash-circle";
  currentBalanceEl.innerHTML = `
    <span class="${balanceColor}">
      <i class="bi bi-${balanceIcon} me-1"></i>
      ${formatCurrency(Math.abs(myBalance.net))} MAD
      ${myBalance.net > 0 ? '(You lent)' : myBalance.net < 0 ? '(You owe)' : '(Even)'}
    </span>
  `;

  // User owes money (negative balance)
  if (myBalance.net < 0) {
    // Show users who are owed money (net > 0)
    const creditors = balancesData.filter(b => b.net > 0 && b.user_id !== currentUser.id);

    if (creditors.length === 0) {
      const option = document.createElement("option");
      option.textContent = "No users to settle with";
      option.disabled = true;
      option.selected = true;
      select.appendChild(option);
    } else {
      creditors.forEach(b => {
        const myDebt = Math.min(Math.abs(myBalance.net), b.net);
        const option = document.createElement("option");
        option.value = b.user_id;
        option.textContent = `${b.username} (${formatCurrency(myDebt)} MAD)`;
        option.dataset.amount = myDebt.toFixed(2);
        select.appendChild(option);
      });
    }
  } else {
    const option = document.createElement("option");
    option.textContent = "You have no debts to settle ✅";
    option.disabled = true;
    option.selected = true;
    select.appendChild(option);
  }

  // Auto-fill amount and show preview
  select.addEventListener("change", () => {
    const selected = select.options[select.selectedIndex];
    if (selected.dataset.amount) {
      amountInput.value = selected.dataset.amount;
      updateSettlementPreview(selected.textContent.split(' (')[0], selected.dataset.amount);
    } else {
      preview.style.display = "none";
    }
  });

  // Update preview when amount changes
  amountInput.addEventListener("input", () => {
    const selected = select.options[select.selectedIndex];
    if (selected.value && amountInput.value) {
      updateSettlementPreview(selected.textContent.split(' (')[0], amountInput.value);
    }
  });

  // Open modal
  const modal = new bootstrap.Modal(document.getElementById("recordSettlementModal"));
  modal.show();
}

function updateSettlementPreview(userName, amount) {
  const preview = document.getElementById("settlementPreview");
  const previewAmount = document.getElementById("previewAmount");
  const previewUser = document.getElementById("previewUser");
  
  previewAmount.textContent = `${formatCurrency(parseFloat(amount))} MAD`;
  previewUser.textContent = userName;
  preview.style.display = "block";
}

// Quick settle function
function quickSettle(fromUser, toUser, amount) {
  if (!currentUser) {
    showError("User not authenticated");
    return;
  }

  // Check if current user is involved in this settlement
  const fromUserData = balancesData.find(b => b.username === fromUser);
  const toUserData = balancesData.find(b => b.username === toUser);
  
  if (!fromUserData || !toUserData) {
    showError("User data not found");
    return;
  }

  // Only allow if current user is the one who owes money
  if (fromUserData.user_id !== currentUser.id) {
    showError("You can only settle your own debts");
    return;
  }

  // Pre-fill the settlement modal
  const select = document.getElementById("toUserSelect");
  const amountInput = document.getElementById("settleAmount");
  
  // Open modal first
  openSettlementModal();
  
  // Wait for modal to be ready, then pre-fill
  setTimeout(() => {
    select.value = toUserData.user_id;
    amountInput.value = amount.toFixed(2);
    updateSettlementPreview(toUser, amount.toFixed(2));
  }, 300);
}

// -----------------------------
// Form Submission
// -----------------------------
function setupSettlementForm() {
  const form = document.getElementById("settlementForm");
  form.onsubmit = async (e) => {
    e.preventDefault();

    const select = document.getElementById("toUserSelect");
    const amountInput = document.getElementById("settleAmount");
    const submitBtn = form.querySelector('button[type="submit"]');
    
    // Validation
    if (!select.value) {
      showError("Please select a member to settle with");
      return;
    }
    
    if (!amountInput.value || parseFloat(amountInput.value) <= 0) {
      showError("Please enter a valid amount");
      return;
    }

    const payload = {
      to_user_id: parseInt(select.value),
      amount: parseFloat(amountInput.value),
    };

    // Show loading state
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="bi bi-hourglass-split me-1"></i>Recording...';
    submitBtn.disabled = true;

    try {
      console.log("🔄 Recording settlement with payload:", payload);
    const res = await fetch(`${API_URL}/settle/${groupId}/record`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });

      console.log("📡 Settlement response status:", res.status);

      if (!res.ok) {
        const errorData = await res.json();
        console.error("❌ Settlement error:", errorData);
        throw new Error(errorData.detail || "Failed to record settlement");
      }

      const result = await res.json();
      console.log("✅ Settlement recorded successfully:", result);
      showSuccess("Settlement recorded successfully!");
      
      // Close modal
      const modal = bootstrap.Modal.getInstance(document.getElementById("recordSettlementModal"));
      if (modal) modal.hide();

      // Refresh all data
      await Promise.all([loadBalances(), loadSettlements(), loadHistory()]);
      
    } catch (err) {
      console.error("❌ Error recording settlement:", err);
      showError(err.message || "Failed to record settlement");
    } finally {
      // Restore button state
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
    }
  };
}

// -----------------------------
// Initialize Page
// -----------------------------
document.addEventListener("DOMContentLoaded", async () => {
  try {
    console.log("🚀 Initializing balance page...");
    console.log("📍 Group ID from URL:", groupId);
    
    if (!groupId) {
      showError("No group ID found in URL");
      return;
    }
    
    // Load current user first
    const userLoaded = await loadCurrentUser();
    if (!userLoaded) return;

    console.log("👤 Current user loaded:", currentUser);

    // Load all data
    await Promise.all([
      loadGroupInfo(),
      loadBalances(),
      loadSettlements(),
      loadHistory()
    ]);

    // Setup event listeners
  document.getElementById("routerToExpenses").addEventListener("click", () => {
    window.location.href = `expenses.html?id=${groupId}`;
  });
    
  document.getElementById("recordBtn").addEventListener("click", openSettlementModal);
    
    // Setup settlement form
    setupSettlementForm();

    console.log("✅ Balance page initialized successfully");

  } catch (err) {
    console.error("❌ Error initializing balance page:", err);
    showError("Failed to load balance page");
  }
});
