// Global Balance Page JavaScript
// Ensure config.js is loaded first
if (typeof API_URL === 'undefined' || typeof getHeaders === 'undefined') {
  console.error("❌ config.js not loaded! Make sure config.js is loaded before global-balance.js");
}

// Call it once to initialize when script loads
if (typeof loadAuth === 'function') {
  loadAuth();
} else {
  console.warn("⚠️ loadAuth function not found");
}

let balancesData = [];

// -----------------------------
// Utility Functions
// -----------------------------
function showError(message) {
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

function getStatusBadge(status) {
  const badges = {
    'pending': '<span class="badge bg-warning"><i class="bi bi-clock me-1"></i>Pending</span>',
    'accepted': '<span class="badge bg-success"><i class="bi bi-check-circle me-1"></i>Accepted</span>',
    'rejected': '<span class="badge bg-danger"><i class="bi bi-x-circle me-1"></i>Rejected</span>'
  };
  return badges[status] || '<span class="badge bg-secondary">Unknown</span>';
}

// -----------------------------
// Load Current User
// -----------------------------
async function loadCurrentUser() {
  try {
    if (typeof loadAuth === 'function') {
      loadAuth();
    } else {
      console.error("❌ loadAuth function not found");
      showError("Authentication system not loaded");
      return false;
    }

    if (!currentUser) {
      if (typeof fetchCurrentUser === 'function') {
        currentUser = await fetchCurrentUser();
      } else {
        console.error("❌ fetchCurrentUser function not found");
        showError("User fetch function not available");
        return false;
      }
    }

    if (!currentUser || !currentUser.id) {
      showError("User not authenticated. Please log in.");
      setTimeout(() => {
        window.location.href = "login.html";
      }, 2000);
      return false;
    }

    console.log("✅ Current user loaded:", currentUser);
    return true;
  } catch (err) {
    console.error("❌ Error loading current user:", err);
    showError("Failed to load user data: " + err.message);
    return false;
  }
}

// -----------------------------
// Load Summary Statistics
// -----------------------------
function updateSummaryStats(balances) {
  console.log("📊 Updating summary stats with balances:", balances);

  if (!balances || !Array.isArray(balances)) {
    console.warn("⚠️ Invalid balances data for summary stats:", balances);
    balances = [];
  }

  const round = (num) => Math.round(num * 100) / 100;

  // Calculate stats with proper handling of empty arrays
  const positiveBalances = balances.filter(b => b && b.net > 0);
  const negativeBalances = balances.filter(b => b && b.net < 0);

  const totalLent = round(positiveBalances.reduce((sum, b) => sum + (b.net || 0), 0));
  const totalOwed = round(Math.abs(negativeBalances.reduce((sum, b) => sum + (b.net || 0), 0)));
  const netBalance = round(balances.reduce((sum, b) => sum + (b?.net || 0), 0));

  console.log("📊 Calculated stats:", { totalLent, totalOwed, netBalance, positiveCount: positiveBalances.length, negativeCount: negativeBalances.length });

  // Update UI elements
  const totalLentEl = document.getElementById('totalLent');
  const totalOwedEl = document.getElementById('totalOwed');
  const netBalanceEl = document.getElementById('netBalance');

  if (totalLentEl) totalLentEl.textContent = `${formatCurrency(totalLent)} MAD`;
  if (totalOwedEl) totalOwedEl.textContent = `${formatCurrency(totalOwed)} MAD`;
  if (netBalanceEl) netBalanceEl.textContent = `${netBalance > 0 ? '+' : ''}${formatCurrency(netBalance)} MAD`;
}

// -----------------------------
// Load Global Balances
// -----------------------------
async function loadBalances() {
  console.log("🔄 Loading global balances...");
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
    if (typeof loadAuth === 'function') loadAuth();
    if (typeof API_URL === 'undefined' || typeof getHeaders === 'undefined') throw new Error("API configuration not loaded.");

    const url = `${API_URL}/settle/global/balances`;
    const res = await fetch(url, { headers: getHeaders() });

    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

    const data = await res.json();
    balancesData = data;
    container.innerHTML = "";

    if (!data || !Array.isArray(data) || data.length === 0) {
      container.innerHTML = `
        <div class="col-12 text-center text-muted py-5">
          <i class="bi bi-people fs-1 mb-3"></i>
          <h5>No balances found</h5>
          <p>You have no balances with your friends across all groups.</p>
        </div>
      `;
      updateSummaryStats([]);
      return;
    }

    document.getElementById('friendCount').textContent = `${data.length} friends`;
    updateSummaryStats(data);

    data.forEach((balance) => {
      const isPositive = balance.net > 0;
      const isNegative = balance.net < 0;
      const color = isPositive ? "success" : isNegative ? "danger" : "secondary";
      const icon = isPositive ? "arrow-up-circle" : isNegative ? "arrow-down-circle" : "dash-circle";
      const statusText = isPositive ? "Owes you" : isNegative ? "You owe" : "Settled";

      const name = balance.username || "Unknown";

      const card = document.createElement("div");
      card.className = "col-12 col-sm-6 col-md-4 col-lg-3";

      card.innerHTML = `
        <div class="card border-${color} balance-card shadow-sm h-100">
          <div class="card-body text-center p-3">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <h6 class="card-title mb-0 fw-bold">${name}</h6>
            </div>
            <div class="mb-2">
              <i class="bi bi-${icon} fs-2 text-${color}"></i>
            </div>
            <p class="card-text fw-bold text-${color} mb-1">
              ${formatCurrency(Math.abs(balance.net))} MAD
            </p>
            <small class="text-muted">${statusText}</small>
          </div>
        </div>
      `;
      container.appendChild(card);
    });
  } catch (err) {
    console.error("❌ Error loading balances:", err);
    container.innerHTML = `
      <div class="col-12 text-center text-danger py-4">
        <i class="bi bi-exclamation-triangle fs-1 mb-3"></i>
        <h5>Error loading balances</h5>
        <button class="btn btn-outline-primary mt-2" onclick="loadBalances()">
          <i class="bi bi-arrow-clockwise me-1"></i>Retry
        </button>
      </div>
    `;
  }
}

// -----------------------------
// Load Suggested Global Settlements
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
    const url = `${API_URL}/settle/global/settlements`;
    const res = await fetch(url, { headers: getHeaders() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
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
    console.error("❌ Error loading settlements:", err);
    tbody.innerHTML = `<tr><td colspan="4" class="text-center text-negative py-4">Error loading data</td></tr>`;
  }
}

// -----------------------------
// Load Global Settlement History
// -----------------------------
async function loadHistory() {
  const tbody = document.querySelector("#historyTable tbody");
  tbody.innerHTML = `
    <tr>
      <td colspan="6" class="text-center text-muted py-4">
        <div class="spinner-border text-info" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        <div class="mt-2">Loading history...</div>
      </td>
    </tr>
  `;

  try {
    const url = `${API_URL}/settle/global/history`;
    const res = await fetch(url, { headers: getHeaders() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    tbody.innerHTML = "";

    if (!data.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center text-muted py-4">
            <i class="bi bi-clock-history fs-1 mb-3"></i>
            <h5>No settlement history</h5>
            <p class="mb-0">No global settlements have been recorded yet</p>
          </td>
        </tr>
      `;
      document.getElementById('historyCount').textContent = '0 records';
      return;
    }

    document.getElementById('historyCount').textContent = `${data.length} records`;

    data.forEach((settlement) => {
      const isToCurrentUser = settlement.to_user_id === currentUser.id;
      const isFromCurrentUser = settlement.from_user_id === currentUser.id;

      let statusBadge = '<span class="badge bg-secondary">Unknown</span>';

      if (settlement.status === 'pending') {
        statusBadge = '<span class="badge bg-warning text-dark"><i class="bi bi-clock me-1"></i>Pending</span>';
      } else if (settlement.status === 'accepted') {
        statusBadge = '<span class="badge bg-success"><i class="bi bi-check-circle me-1"></i>Accepted</span>';
      } else if (settlement.status === 'rejected') {
        statusBadge = '<span class="badge bg-danger"><i class="bi bi-x-circle me-1"></i>Rejected</span>';
      }

      let actionButtons = '';
      if (settlement.status === 'pending' && isToCurrentUser) {
        actionButtons = `
          <button class="btn btn-sm btn-success me-1" onclick="acceptGlobalSettlement(${settlement.id})">
            <i class="bi bi-check-circle me-1"></i>Accept
          </button>
          <button class="btn btn-sm btn-danger" onclick="rejectGlobalSettlement(${settlement.id})">
            <i class="bi bi-x-circle me-1"></i>Reject
          </button>
        `;
      } else if (settlement.status === 'rejected' && isFromCurrentUser) {
        actionButtons = `
          <button class="btn btn-sm btn-outline-primary" onclick="resendGlobalSettlement(${settlement.id}, ${settlement.to_user_id}, ${settlement.amount})">
            <i class="bi bi-arrow-repeat me-1"></i>Resend
          </button>
        `;
      }

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
          ${statusBadge}
        </td>
        <td>
          <small class="text-muted">${getRelativeTime(settlement.created_at)}</small>
        </td>
        <td>
          ${actionButtons}
        </td>
      `;
      tbody.appendChild(row);
    });
  } catch (err) {
    console.error("❌ Error loading history:", err);
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-negative py-4">Error loading history</td></tr>`;
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
  const messageInput = document.getElementById("settlementMessage");

  select.innerHTML = '<option value="">Select a friend...</option>';
  amountInput.value = "";
  if (messageInput) messageInput.value = "";
  updateSettlementPreview(0, null);

  balancesData.forEach(b => {
    if (b.user_id !== currentUser.id) {
      const option = document.createElement("option");
      option.value = b.user_id;
      option.textContent = `${b.username} (${b.net > 0 ? 'owes you' : 'you owe'} ${formatCurrency(Math.abs(b.net))} MAD)`;
      option.dataset.balance = b.net;
      option.dataset.username = b.username;
      select.appendChild(option);
    }
  });

  if (balancesData.length === 0 || balancesData.filter(b => b.user_id !== currentUser.id).length === 0) {
    const option = document.createElement("option");
    option.textContent = "No friends with balances";
    option.disabled = true;
    option.selected = true;
    select.appendChild(option);
  }

  select.addEventListener("change", () => {
    const selected = select.options[select.selectedIndex];
    if (selected.value && selected.dataset.balance) {
      const balance = parseFloat(selected.dataset.balance);
      if (balance < 0) {
        amountInput.value = Math.abs(balance).toFixed(2);
        updateSettlementPreview(Math.abs(balance).toFixed(2), selected.dataset.username);
      } else {
        amountInput.value = "";
        updateSettlementPreview(0, null);
        showError("This friend owes you. They should record the settlement.");
      }
    } else {
      updateSettlementPreview(amountInput.value || 0, null);
    }
  });

  amountInput.addEventListener("input", () => {
    const selected = select.options[select.selectedIndex];
    const username = selected.value ? (selected.dataset.username || selected.textContent.split(' (')[0]) : null;
    updateSettlementPreview(amountInput.value || 0, username);
  });

  // Use Tailwind Modal Logic
  if (typeof showTailwindModal === 'function') {
    showTailwindModal();
  } else {
    // Fallback if helper not found
    const modal = document.getElementById('recordSettlementModal');
    modal.classList.remove('opacity-0', 'pointer-events-none');
  }
}

function updateSettlementPreview(amount, recipientName) {
  const displayAmount = parseFloat(amount) || 0;
  const name = recipientName || "Recipient";

  const amountDisplay = document.getElementById("previewAmountDisplay");
  if (amountDisplay) amountDisplay.textContent = `${formatCurrency(displayAmount)} MAD`;

  const nameDisplay = document.getElementById("previewRecipientName");
  if (nameDisplay) nameDisplay.textContent = name;

  const avatarDisplay = document.getElementById("previewRecipientAvatar");
  if (avatarDisplay) {
    if (recipientName) {
      const initials = recipientName.split(" ").map(w => w[0]).join("").toUpperCase().substring(0, 2);
      avatarDisplay.textContent = initials;
      avatarDisplay.className = "size-10 rounded-full bg-positive text-white flex items-center justify-center font-bold";
    } else {
      avatarDisplay.textContent = "?";
      avatarDisplay.className = "size-10 rounded-full bg-gray-400 text-white flex items-center justify-center font-bold";
    }
  }
}

function quickSettle(fromUser, toUser, amount) {
  if (!currentUser) {
    showError("User not authenticated");
    return;
  }

  // Check if fromUser is the current user
  const isCurrentUserFrom = fromUser === currentUser.username;

  // Find user data - current user might not be in balancesData
  let fromUserData, toUserData;

  if (isCurrentUserFrom) {
    // Current user is the one who owes (from_user)
    fromUserData = { user_id: currentUser.id, username: currentUser.username };
    toUserData = balancesData.find(b => b.username === toUser);
  } else {
    // Current user is the one being paid (to_user)
    fromUserData = balancesData.find(b => b.username === fromUser);
    toUserData = { user_id: currentUser.id, username: currentUser.username };
  }

  if (!fromUserData || !toUserData) {
    console.error("User data not found:", { fromUser, toUser, fromUserData, toUserData, balancesData, currentUser });
    showError("User data not found. Please refresh the page.");
    return;
  }

  // Verify current user is involved in this settlement
  if (fromUserData.user_id !== currentUser.id && toUserData.user_id !== currentUser.id) {
    showError("You can only settle your own debts");
    return;
  }

  // Only allow if current user is the one who owes (from_user)
  if (fromUserData.user_id !== currentUser.id) {
    showError("You can only record settlements where you are the payer");
    return;
  }

  const select = document.getElementById("toUserSelect");
  const amountInput = document.getElementById("settleAmount");

  openSettlementModal();

  setTimeout(() => {
    if (select && toUserData) {
      select.value = toUserData.user_id;
      amountInput.value = amount.toFixed(2);
      updateSettlementPreview(amount.toFixed(2), toUser);
    }
  }, 300);
}

// -----------------------------
// Form Submission
// -----------------------------
function setupSettlementForm() {
  const form = document.getElementById("settlementForm");
  if (!form) return;

  form.onsubmit = async (e) => {
    e.preventDefault();

    const select = document.getElementById("toUserSelect");
    const amountInput = document.getElementById("settleAmount");
    const messageInput = document.getElementById("settlementMessage");
    const submitBtn = form.querySelector('button[type="submit"]');

    if (!select.value) {
      showError("Please select a friend to settle with");
      return;
    }

    if (!amountInput.value || parseFloat(amountInput.value) <= 0) {
      showError("Please enter a valid amount");
      return;
    }

    const payload = {
      to_user_id: parseInt(select.value),
      amount: parseFloat(amountInput.value),
      message: messageInput ? messageInput.value.trim() || null : null,
    };

    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = 'Recording...';
    submitBtn.disabled = true;

    try {
      if (typeof loadAuth === 'function') loadAuth();
      if (typeof API_URL === 'undefined' || typeof getHeaders === 'undefined') throw new Error("API configuration not loaded.");

      const url = `${API_URL}/settle/global/record`;
      const res = await fetch(url, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || "Failed to record settlement");
      }

      showSuccess("Global settlement request sent!");

      // Close Tailwind Modal
      if (typeof closeSettlementModal === 'function') {
        closeSettlementModal();
      } else {
        const modal = document.getElementById('recordSettlementModal');
        modal.classList.add('opacity-0', 'pointer-events-none');
      }

      await Promise.all([loadBalances(), loadSettlements(), loadHistory()]);

    } catch (err) {
      console.error("❌ Error recording settlement:", err);
      showError(err.message || "Failed to record global settlement");
    } finally {
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
    }
  };
}

// -----------------------------
// Accept/Reject/Resend Global Settlement
// -----------------------------
async function acceptGlobalSettlement(settlementId) {
  if (!confirm("Are you sure you want to accept this global settlement?")) {
    return;
  }

  try {
    if (typeof loadAuth === 'function') {
      loadAuth();
    }

    if (typeof API_URL === 'undefined' || typeof getHeaders === 'undefined') {
      throw new Error("API configuration not loaded. Please refresh the page.");
    }

    const url = `${API_URL}/settle/global/${settlementId}/accept`;
    console.log("🌐 POST to:", url);

    const res = await fetch(url, {
      method: "POST",
      headers: getHeaders(),
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.detail || "Failed to accept settlement");
    }

    showSuccess("Global settlement accepted successfully!");
    await Promise.all([loadBalances(), loadSettlements(), loadHistory()]);
  } catch (err) {
    console.error("Error accepting settlement:", err);
    showError(err.message || "Failed to accept settlement");
  }
}

async function rejectGlobalSettlement(settlementId) {
  const reason = prompt("Please provide a reason for rejecting this global settlement (optional):");

  if (reason === null) {
    return;
  }

  try {
    if (typeof loadAuth === 'function') {
      loadAuth();
    }

    if (typeof API_URL === 'undefined' || typeof getHeaders === 'undefined') {
      throw new Error("API configuration not loaded. Please refresh the page.");
    }

    const url = `${API_URL}/settle/global/${settlementId}/reject`;
    console.log("🌐 POST to:", url);

    const res = await fetch(url, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        reason: reason || null
      }),
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.detail || "Failed to reject settlement");
    }

    showSuccess("Global settlement rejected.");
    await Promise.all([loadBalances(), loadSettlements(), loadHistory()]);
  } catch (err) {
    console.error("Error rejecting settlement:", err);
    showError(err.message || "Failed to reject settlement");
  }
}

async function resendGlobalSettlement(settlementId, toUserId, currentAmount) {
  const newAmount = prompt("Enter the amount (or leave empty to keep current):", currentAmount);
  if (newAmount === null) {
    return;
  }

  const amount = newAmount ? parseFloat(newAmount) : currentAmount;
  if (isNaN(amount) || amount <= 0) {
    showError("Invalid amount");
    return;
  }

  const message = prompt("Add a message (optional):");

  try {
    if (typeof loadAuth === 'function') {
      loadAuth();
    }

    if (typeof API_URL === 'undefined' || typeof getHeaders === 'undefined') {
      throw new Error("API configuration not loaded. Please refresh the page.");
    }

    const url = `${API_URL}/settle/global/${settlementId}/resend`;
    console.log("🌐 POST to:", url);

    const res = await fetch(url, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        to_user_id: toUserId,
        amount: amount,
        message: message || null
      }),
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.detail || "Failed to resend settlement");
    }

    showSuccess("Global settlement resent successfully!");
    await Promise.all([loadBalances(), loadSettlements(), loadHistory()]);
  } catch (err) {
    console.error("Error resending settlement:", err);
    showError(err.message || "Failed to resend settlement");
  }
}

// -----------------------------
// Initialize Page
// -----------------------------
document.addEventListener("DOMContentLoaded", async () => {
  try {
    console.log("🚀 Initializing global balance page...");

    if (typeof API_URL === 'undefined') {
      console.error("❌ API_URL is not defined. config.js may not be loaded.");
      showError("Configuration not loaded. Please refresh the page.");
      return;
    }

    if (typeof getHeaders === 'undefined') {
      console.error("❌ getHeaders is not defined. config.js may not be loaded.");
      showError("Authentication functions not loaded. Please refresh the page.");
      return;
    }

    console.log("✅ Config loaded. API_URL:", API_URL);

    if (typeof loadAuth === 'function') {
      loadAuth();
    }

    const userLoaded = await loadCurrentUser();
    if (!userLoaded) {
      console.error("❌ Failed to load current user");
      return;
    }

    console.log("👤 Current user loaded:", currentUser);

    await Promise.all([
      loadBalances(),
      loadSettlements(),
      loadHistory()
    ]);

    document.getElementById("recordBtn").addEventListener("click", openSettlementModal);

    setupSettlementForm();

    console.log("✅ Global balance page initialized successfully");

  } catch (err) {
    console.error("❌ Error initializing global balance page:", err);
    showError("Failed to load global balance page");
  }
});

