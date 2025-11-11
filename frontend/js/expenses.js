// frontend/js/expenses.js
// Enhanced expense management with better UX and responsive design
console.log("✅ Expenses.js loaded successfully");
loadAuth();

// Global variables
let currentGroup = null;
let userWallets = []; // Store all wallets for filtering by payer
let allExpenses = [];

// Pagination state
let expensesPagination = {
  currentOffset: 0,
  pageSize: 20,
  hasMore: true,
  isLoading: false,
  totalExpenses: 0
};

// -----------------------------
// Load group information
// -----------------------------
async function loadGroupInfo() {
  try {
    const url = new URL(window.location.href);
    const groupId = url.searchParams.get("id");

    if (!groupId) {
      showError("No group selected");
      return;
    }

    const res = await fetch(`${API_URL}/groups/${groupId}`, { headers: getHeaders() });
    if (!res.ok) {
      throw new Error("Failed to load group information");
    }

    currentGroup = await res.json();

    // Update group header
    document.getElementById("groupTitle").innerHTML = `
      <i class="bi bi-people-fill text-primary me-2"></i>
      ${currentGroup.title}
    `;

    document.getElementById("groupDescription").textContent =
      currentGroup.description || "No description available";

    document.getElementById("memberCount").innerHTML = `
      <i class="bi bi-person me-1"></i>${currentGroup.members_count || 0} members
    `;

    document.getElementById("groupCurrency").innerHTML = `
      <i class="bi bi-currency-exchange me-1"></i>${currentGroup.currency || 'USD'}
    `;

    // Update currency in expense modal
    const currencyDisplay = document.getElementById('currencyDisplay');
    if (currencyDisplay) {
      currencyDisplay.textContent = currentGroup.currency || 'USD';
    }




    // Update page title
    document.title = `${currentGroup.title} - Expenses`;

  } catch (err) {
    console.error("Error loading group info:", err);
    showError("Failed to load group information");
  }
}

// Load payer options for expense modal
async function loadPayersForExpense() {
  try {
    console.log("🔄 Loading payers for expense modal");

    // Check if we're on the expenses page
    if (!window.location.pathname.includes('expenses.html')) {
      console.log("⚠️ Not on expenses page, skipping loadPayersForExpense");
      return;
    }

    const members = await fetchMembers();
    const payerSelect = document.getElementById('expensePayer');

    if (!payerSelect) {
      console.warn("Payer select not found");
      return;
    }

    // Get current user for comparison
    const currentUser = await fetchCurrentUser();

    // Clear existing options except the first one
    payerSelect.innerHTML = '<option value="">Select who paid...</option>';

    // Add member options
    members.forEach(member => {
      const option = document.createElement('option');
      option.value = member.user_id;
      option.textContent = `${member.username || `User ${member.user_id}`}${member.user_id === currentUser?.id ? ' (You)' : ''}`;
      payerSelect.appendChild(option);
    });

    console.log("✅ Payers loaded for expense modal");

    // Add event listener for payer change
    payerSelect.addEventListener('change', updateWalletsForPayer);

  } catch (err) {
    console.error("❌ Error loading payers for expense:", err);
    showError("Failed to load payers");
  }
}

// Update wallets when payer changes
function updateWalletsForPayer() {
  const payerSelect = document.getElementById('expensePayer');
  const walletSelect = document.getElementById('expenseWallet');
  const walletSection = document.getElementById('walletSection');

  if (!payerSelect || !walletSelect || !walletSection) return;

  const selectedPayerId = payerSelect.value;

  if (!selectedPayerId) {
    // Hide wallet section if no payer selected
    walletSection.style.display = 'none';
    walletSelect.innerHTML = '<option value="">No wallet selected</option>';
    return;
  }

  // Get current user
  fetchCurrentUser().then(currentUser => {
    if (currentUser && parseInt(selectedPayerId) === currentUser.id) {
      // Show wallet section only for current user
      walletSection.style.display = 'block';

      // Filter wallets for the current user
      const currentUserWallets = userWallets.filter(wallet => wallet.user_id === currentUser.id);

      // Update wallet options
      walletSelect.innerHTML = '<option value="">No wallet selected</option>';

      currentUserWallets.forEach(wallet => {
        const option = document.createElement('option');
        option.value = wallet.id;
        option.textContent = `${wallet.name} (${wallet.balance.toFixed(2)} ${wallet.currency || 'MAD'})`;
        walletSelect.appendChild(option);
      });

      console.log(`✅ Updated wallets for current user:`, currentUserWallets.length);
    } else {
      // Hide wallet section for other users
      walletSection.style.display = 'none';
      walletSelect.innerHTML = '<option value="">No wallet selected</option>';
      console.log(`✅ Hidden wallet section for other user: ${selectedPayerId}`);
    }
  }).catch(err => {
    console.error("❌ Error getting current user:", err);
    // Hide wallet section on error
    walletSection.style.display = 'none';
  });
}

async function loadMembersForExpense() {
  try {
    console.log("🔄 Loading members for expense modal");

    // Check if we're on the expenses page
    if (!window.location.pathname.includes('expenses.html')) {
      console.log("⚠️ Not on expenses page, skipping loadMembersForExpense");
      return;
    }

    // Use the existing fetchMembers function
    const members = await fetchMembers();

    const membersListContainer = document.getElementById('membersListForExpense');
    if (!membersListContainer) {
      console.warn("Members list container not found, retrying in 100ms...");
      setTimeout(() => loadMembersForExpense(), 100);
      return;
    }

    if (members.length === 0) {
      membersListContainer.innerHTML = `
        <div class="text-center text-muted py-3">
          <i class="bi bi-info-circle fs-1 mb-2"></i>
          <p>No members found in this group</p>
        </div>
      `;
      return;
    }

    // Use the existing renderMembers function but for the expense modal
    renderMembersForExpense(membersListContainer, members);

    // Update preview after loading
    updateExpensePreview();

  } catch (err) {
    console.error("❌ Error loading members for expense:", err);
    const membersListContainer = document.getElementById('membersListForExpense');
    if (membersListContainer) {
      membersListContainer.innerHTML = `
        <div class="text-center text-danger py-3">
          <i class="bi bi-exclamation-triangle fs-1 mb-2"></i>
          <p>Failed to load members</p>
        </div>
      `;
    }
  }
}

function renderMembersForExpense(container, members) {
  if (!container || !Array.isArray(members)) return;

  container.innerHTML = "";
  container.className = "row g-3 justify-content-center"; // responsive grid spacing

  members.forEach(m => {
    const col = document.createElement("div");
    col.className = "col-6 col-md-4 col-lg-3 col-xl-2"; // auto-fit grid

    const card = document.createElement("div");
    card.className = "member-card card text-center border-0 shadow-sm";
    card.style.cursor = "pointer";
    card.style.transition = "all 0.25s ease";
    card.style.userSelect = "none";
    card.style.padding = "1rem";

    // ✅ Avatar or initials
    const initials = (m.username || "U")
      .split(" ")
      .map(w => w[0])
      .join("")
      .toUpperCase();

    card.innerHTML = `
      <input class="form-check-input d-none" type="checkbox" value="${m.user_id}" id="member_${m.user_id}" onchange="updateExpensePreview()" ${m.user_id === currentUser?.id ? 'checked' : ''}>
      <div class="avatar mx-auto mb-2 d-flex align-items-center justify-content-center rounded-circle">
        ${initials}
      </div>
      <h6 class="mb-0 text-truncate">${m.username || m.user_id}</h6>
      <small class="text-muted">${m.is_admin ? "👑 Admin" : "👤 Member"}</small>
      ${m.user_id === currentUser?.id ? '<span class="badge bg-primary mt-1">You</span>' : ''}
    `;

    // ✅ Click to toggle checkbox
    card.addEventListener("click", (e) => {
      if (e.target.type === "checkbox") return;
      const checkbox = card.querySelector("input[type=checkbox]");
      checkbox.checked = !checkbox.checked;
      updateExpensePreview();
    });

    // ✅ Visual feedback
    card.addEventListener("mouseenter", () => {
      card.style.transform = "translateY(-2px)";
      card.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
    });

    card.addEventListener("mouseleave", () => {
      card.style.transform = "translateY(0)";
      card.style.boxShadow = "0 2px 4px rgba(0,0,0,0.1)";
    });

    col.appendChild(card);
    container.appendChild(col);
  });
}

function selectAllMembers() {
  const checkboxes = document.querySelectorAll('#membersListForExpense input[type="checkbox"]');
  checkboxes.forEach(checkbox => {
    checkbox.checked = true;
  });
  updateExpensePreview();
}

function deselectAllMembers() {
  const checkboxes = document.querySelectorAll('#membersListForExpense input[type="checkbox"]');
  checkboxes.forEach(checkbox => {
    checkbox.checked = false;
  });
  updateExpensePreview();
}

function updateExpensePreview() {
  try {
    const amount = parseFloat(document.getElementById('expenseAmount')?.value || 0);
    const selectedMembers = document.querySelectorAll('#membersListForExpense input[type="checkbox"]:checked');
    const categorySelect = document.getElementById("expenseCategory");
    const category = categorySelect?.selectedOptions[0]?.textContent || "";
    console.log("jsamkslaksjamsa",selectedMembers);
    const memberCount = selectedMembers.length;
    const perPerson = memberCount > 0 ? (amount / memberCount).toFixed(2) : 0;

    const previewCard = document.getElementById('expensePreview');
    if (!previewCard) return;

    if (amount > 0 && memberCount > 0) {
      previewCard.style.display = 'block';

      document.getElementById('previewAmount').textContent = `${amount.toFixed(2)} ${currentGroup?.currency || 'MAD'}`;
      document.getElementById('previewPerPerson').textContent = `${perPerson} ${currentGroup?.currency || 'MAD'}`;
      document.getElementById('previewMemberCount').textContent = memberCount;
      document.getElementById('previewCategory').textContent = category || '-';

      // 🧩 Get usernames (the <h6> text inside the same .member-card)
      const memberNames = Array.from(selectedMembers).map(cb => {
        const card = cb.closest('.member-card');
        const nameEl = card?.querySelector('h6');
        return nameEl ? nameEl.textContent.trim() : '';
      });

      document.getElementById('previewParticipate').textContent = memberNames || '-';


    } else {
      previewCard.style.display = 'none';
    }
  } catch (err) {
    console.error("❌ Error updating expense preview:", err);
  }
}

// -----------------------------
// Edit Group Functions
// -----------------------------
async function openEditGroupModalFromExpenses() {
  try {
    const url = new URL(window.location.href);
    const groupId = url.searchParams.get("id");

    if (!groupId) {
      showError("No group selected");
      return;
    }

    console.log("🔄 Opening edit modal for group:", groupId);

    // Fetch complete group data
    const res = await fetch(`${API_URL}/groups/${groupId}`, { headers: getHeaders() });
    if (!res.ok) {
      throw new Error("Failed to fetch group data");
    }

    const group = await res.json();
    console.log("📊 Group data loaded:", group);

    // Populate all fields
    document.getElementById("editGroupId").value = groupId;
    document.getElementById("editGroupTitle").value = group.title || "";
    document.getElementById("editGroupType").value = group.type || "Other";
    document.getElementById("editGroupCurrency").value = group.currency || "MAD";
    document.getElementById("editGroupPhoto").value = group.photo || "";
    document.getElementById("editGroupDescription").value = group.description || "";

    setTimeout(() => {
      try {
        const editGroupModal = new bootstrap.Modal(document.getElementById('editGroupModal'));
        editGroupModal.show();
      } catch (err) {
        console.error("Error showing modal:", err);
      }
    }, 100);

  } catch (err) {
    console.error("❌ Error loading group data:", err);
    showError("Failed to load group information");
  }
}

async function saveGroupChanges(event) {
  event.preventDefault();

  const groupId = document.getElementById("editGroupId").value;
  const newTitle = document.getElementById("editGroupTitle").value.trim();
  const newType = document.getElementById("editGroupType").value;
  const newCurrency = document.getElementById("editGroupCurrency").value;
  const newPhoto = document.getElementById("editGroupPhoto").value.trim();
  const newDescription = document.getElementById("editGroupDescription").value.trim();

  console.log("🔄 Saving group changes:", { groupId, newTitle, newType, newCurrency, newPhoto, newDescription });

  if (!newTitle) {
    showError("Group name is required");
    return;
  }

  const payload = {
    title: newTitle,
    type: newType,
    currency: newCurrency,
    photo: newPhoto || null,
    description: newDescription || ""
  };

  try {
    const res = await fetch(`${API_URL}/groups/${groupId}`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.detail || "Failed to update group");
    }

    const updatedGroup = await res.json();
    console.log("✅ Group updated:", updatedGroup);

    showSuccess(`Group "${updatedGroup.title}" updated successfully!`);

    // Close modal
    const editGroupModal = bootstrap.Modal.getInstance(document.getElementById('editGroupModal'));
    if (editGroupModal) editGroupModal.hide();

    // Refresh the group info and expenses
    await Promise.all([
      loadGroupInfo(),
      loadExpenses(true) // Reset pagination
    ]);

  } catch (err) {
    console.error("❌ Error updating group:", err);
    showError(err.message || "Failed to update group");
  }
}

// -----------------------------
// Settlement Functions
// -----------------------------

async function fetchSettlementsForGroup(groupId) {
  try {
    console.log("🔄 Fetching settlements for group:", groupId);
    const res = await fetch(`${API_URL}/settle/${groupId}/history`, {
      headers: getHeaders()
    });

    if (!res.ok) {
      console.warn("⚠️ Failed to fetch settlements:", res.status);
      return [];
    }

    const settlements = await res.json();
    console.log("✅ Settlements fetched:", settlements.length);
    return settlements;
  } catch (err) {
    console.error("❌ Error fetching settlements:", err);
    return [];
  }
}

function renderSettlementDesktopTable(settlement, user, index) {
  const isFromUser = settlement.from_user_id === user.id;
  const isToUser = settlement.to_user_id === user.id;

  const tr = document.createElement("tr");
  tr.className = "fade-in settlement-row";
  tr.style.animationDelay = `${index * 0.1}s`;
  tr.style.backgroundColor = '#f8f9fa';
  tr.style.borderLeft = '4px solid #28a745';

  const settlementDate = new Date(settlement.created_at);
  const formattedDate = settlementDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  tr.innerHTML = `
  <td>
      <div class="d-flex align-items-center">
        <div class="me-3">
           
        </div>
        <div>
          <div class="fw-semibold text-success"> </div>
         
        </div>
      </div>
    </td>
    <td>
      <div class="d-flex align-items-center">
        <div class="me-3">
          <i class="bi bi-cash-coin text-success fs-5"></i>
        </div>
        <div>
          <div class="fw-semibold text-success">Settlement</div>
          <small class="text-muted">${formattedDate}</small>
        </div>
      </div>
    </td>
    <td>
      <span class="fw-bold text-success">${formatCurrency(settlement.amount, currentGroup?.currency || 'MAD')}</span>
    </td>
    <td>
      <div class="d-flex align-items-center">
        <div class="avatar rounded-circle bg-success text-white d-flex align-items-center justify-content-center me-2" style="width:32px;height:32px;font-size:0.8rem;font-weight:bold;">
          ${(settlement.from_username || "U").split(" ").map(w => w[0]).join("").toUpperCase()}
        </div>
        <span class="fw-semibold">${settlement.from_username || "Unknown"}</span>
      </div>
    </td>
    <td>
      <span class="badge bg-info fs-6">
        ${isFromUser ? 'Paid' : (isToUser ? 'Received' : 'Settlement')}
      </span>
    </td>
    <td>
      <span class="text-muted small">
        ${isFromUser ? `You paid ${settlement.to_username || 'Unknown'}` :
      isToUser ? `${settlement.from_username || 'Unknown'} paid you` :
        `${settlement.from_username || 'Unknown'} paid ${settlement.to_username || 'Unknown'}`}
      </span>
    </td>
    <td>
      <div class="d-flex gap-1">
        <button class="btn btn-sm btn-outline-success" onclick="showSettlementDetail(${settlement.id})" title="View Details">
          <i class="bi bi-eye"></i>
        </button>
      </div>
    </td>
  `;

  return tr;
}

function renderSettlementMobileCard(settlement, user, index) {
  const isFromUser = settlement.from_user_id === user.id;
  const isToUser = settlement.to_user_id === user.id;

  const settlementDate = new Date(settlement.created_at);
  const month = settlementDate.toLocaleDateString('en-US', { month: 'short' });
  const day = settlementDate.getDate();

  const card = document.createElement("div");
  card.className = "settlement-item";
  card.style.cssText = `
    display: flex;
    align-items: center;
    padding: 8px 12px;
    border-bottom: 1px solid #eee;
    background: #f8f9fa;
    min-height: 50px;
    cursor: pointer;
    border-left: 4px solid #28a745;
  `;

  const description = isFromUser ?
    `You paid ${settlement.to_username || 'Unknown'} ${formatCurrency(settlement.amount, currentGroup?.currency || 'MAD')}` :
    isToUser ?
      `${settlement.from_username || 'Unknown'} paid you ${formatCurrency(settlement.amount, currentGroup?.currency || 'MAD')}` :
      `${settlement.from_username || 'Unknown'} paid ${settlement.to_username || 'Unknown'} ${formatCurrency(settlement.amount, currentGroup?.currency || 'MAD')}`;

  card.innerHTML = `
    <div style="display: flex; align-items: center; width: 100%;">
      <!-- Date Section -->
      <div style="display: flex; align-items: center; margin-right: 12px;">
        <div style="text-align: center; margin-right: 8px;">
          <div style="font-size: 11px; color: #666; line-height: 1;">${month}</div>
          <div style="font-size: 16px; color: #333; font-weight: 500; line-height: 1;">${day}</div>
        </div>
        <div style="width: 24px; height: 24px; background: #d4edda; border-radius: 4px; display: flex; align-items: center; justify-content: center;">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#28a745" stroke-width="2">
            <rect x="2" y="6" width="20" height="12" rx="2"></rect>
            <circle cx="12" cy="12" r="2"></circle>
          </svg>
        </div>
      </div>
      
      <!-- Content Section -->
      <div style="flex: 1; display: flex; flex-direction: column; justify-content: center;">
        <div style="font-size: 14px; color: #333; font-weight: 500; margin-bottom: 2px;">
          Settlement
        </div>
        <div style="font-size: 12px; color: #666;">
          ${description}
        </div>
      </div>
      
      <!-- Amount Section -->
      <div style="text-align: right;">
        <div style="font-size: 14px; color: #28a745; font-weight: 600;">
          ${formatCurrency(settlement.amount, currentGroup?.currency || 'MAD')}
        </div>
        <div style="font-size: 11px; color: #28a745;">
          ${isFromUser ? 'Paid' : (isToUser ? 'Received' : 'Settlement')}
        </div>
      </div>
    </div>
  `;

  card.addEventListener('click', () => showSettlementDetail(settlement.id));

  return card;
}

function showSettlementDetail(settlementId) {
  // Find settlement in current data
  const settlement = window.currentSettlements?.find(s => s.id === settlementId);
  if (!settlement) return;

  const modal = document.createElement('div');
  modal.className = 'modal fade';
  modal.innerHTML = `
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header bg-success text-white">
          <h5 class="modal-title">
            <i class="bi bi-cash-coin me-2"></i>Settlement Details
          </h5>
          <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body">
          <div class="row mb-3">
            <div class="col-6">
              <strong>From:</strong>
              <div class="d-flex align-items-center mt-1">
                <div class="avatar rounded-circle bg-success text-white d-flex align-items-center justify-content-center me-2" style="width:32px;height:32px;font-size:0.8rem;font-weight:bold;">
                  ${(settlement.from_username || "U").split(" ").map(w => w[0]).join("").toUpperCase()}
                </div>
                <span>${settlement.from_username || "Unknown"}</span>
              </div>
            </div>
            <div class="col-6">
              <strong>To:</strong>
              <div class="d-flex align-items-center mt-1">
                <div class="avatar rounded-circle bg-info text-white d-flex align-items-center justify-content-center me-2" style="width:32px;height:32px;font-size:0.8rem;font-weight:bold;">
                  ${(settlement.to_username || "U").split(" ").map(w => w[0]).join("").toUpperCase()}
                </div>
                <span>${settlement.to_username || "Unknown"}</span>
              </div>
            </div>
          </div>
          <div class="row mb-3">
            <div class="col-6">
              <strong>Amount:</strong>
              <div class="h5 text-success mt-1">${formatCurrency(settlement.amount, currentGroup?.currency || 'MAD')}</div>
            </div>
            <div class="col-6">
              <strong>Date:</strong>
              <div class="mt-1">${new Date(settlement.created_at).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })}</div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  const bsModal = new bootstrap.Modal(modal);
  bsModal.show();

  modal.addEventListener('hidden.bs.modal', () => {
    modal.remove();
  });
}

// -----------------------------
// Utility Functions
// -----------------------------
function showError(message) {
  // Create a toast notification
  const toast = document.createElement('div');
  toast.className = 'toast align-items-center text-white bg-danger border-0 position-fixed top-0 end-0 m-3';
  toast.style.zIndex = '9999';
  toast.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">
        <i class="bi bi-exclamation-triangle me-2"></i>${message}
      </div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
    </div>
  `;
  document.body.appendChild(toast);

  const bsToast = new bootstrap.Toast(toast);
  bsToast.show();

  // Remove toast element after it's hidden
  toast.addEventListener('hidden.bs.toast', () => {
    toast.remove();
  });
}

function showSuccess(message) {
  const toast = document.createElement('div');
  toast.className = 'toast align-items-center text-white bg-success border-0 position-fixed top-0 end-0 m-3';
  toast.style.zIndex = '9999';
  toast.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">
        <i class="bi bi-check-circle me-2"></i>${message}
      </div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
    </div>
  `;
  document.body.appendChild(toast);

  const bsToast = new bootstrap.Toast(toast);
  bsToast.show();

  toast.addEventListener('hidden.bs.toast', () => {
    toast.remove();
  });
}

function formatCurrency(amount, currency = 'MAD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2
  }).format(amount);
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function getRelativeTime(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));

  if (diffInHours < 1) return 'Just now';
  if (diffInHours < 24) return `${diffInHours}h ago`;
  if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d ago`;
  return formatDate(dateString);
}
async function loadWallets() {
  try {
    const res = await fetch(`${API_URL}/wallets`, { headers: getHeaders() });
    if (!res.ok) return [];
    const wallets = await res.json();

    // Store wallets globally for filtering by payer
    userWallets = wallets;

    // Populate wallet dropdowns
    const addWalletSelect = document.getElementById('expenseWallet');
    const editWalletSelect = document.getElementById('editWallet');

    // Populate add wallet select
    if (addWalletSelect) {
      addWalletSelect.innerHTML = '<option value="">No wallet selected</option>';
      wallets.forEach(wallet => {
        const option = document.createElement('option');
        option.value = wallet.id;
        option.textContent = `${wallet.name} (${wallet.balance.toFixed(2)} ${wallet.currency || 'MAD'})`;
        addWalletSelect.appendChild(option);
      });
    }

    // Populate edit wallet select
    if (editWalletSelect) {
      editWalletSelect.innerHTML = '<option value="">No wallet selected</option>';
      wallets.forEach(wallet => {
        const option = document.createElement('option');
        option.value = wallet.id;
        option.textContent = `${wallet.name} (${wallet.balance.toFixed(2)} ${wallet.currency || 'MAD'})`;
        editWalletSelect.appendChild(option);
      });
    }

    console.log("✅ Wallets loaded:", wallets.length);
    return wallets;
  } catch (err) {
    console.error("❌ Error loading wallets:", err);
    showError("Failed to load wallets");
    return [];
  }
}


// -----------------------------
// Fetch expenses for group (with pagination)
// -----------------------------
async function fetchExpensesForGroup(groupId, limit = 20, offset = 0) {
  if (!groupId) return { expenses: [], total: 0, has_more: false };
  
  const url = `${API_URL}/expenses/${groupId}?limit=${limit}&offset=${offset}`;
  const res = await fetch(url, { headers: getHeaders() });
  
  if (!res.ok) {
    console.error("Failed to fetch expenses:", res.status);
    return { expenses: [], total: 0, has_more: false };
  }
  
  const data = await res.json();
  return data;
}

// -----------------------------
// Load and render expenses (initial load or reset)
// -----------------------------
async function loadExpenses(reset = false) {
  try {
    console.log("🔄 Loading expenses...", reset ? "(reset)" : "");
    const url = new URL(window.location.href);
    const groupId = url.searchParams.get("id");
    console.log("📁 Group ID:", groupId);

    if (!groupId) {
      showError("No group selected");
      return;
    }

    // Get current user
    const user = await fetchCurrentUser();
    console.log("👤 Current user:", user);

    if (!user) {
      showError("User not authenticated");
      return;
    }

    // Reset pagination if needed
    if (reset) {
      expensesPagination.currentOffset = 0;
      expensesPagination.hasMore = true;
      expensesPagination.isLoading = false;
      allExpenses = [];
    }

    // Prevent duplicate requests
    if (expensesPagination.isLoading) {
      console.log("⏳ Already loading, skipping...");
      return;
    }

    // Check if there are more expenses to load
    if (!expensesPagination.hasMore && !reset) {
      console.log("✅ All expenses loaded");
      return;
    }

    expensesPagination.isLoading = true;

    // Show loading state only on initial load
    if (expensesPagination.currentOffset === 0) {
      showLoadingState();
    } else {
      showLoadMoreIndicator();
    }

    // Fetch expenses with pagination
    const expensesData = await fetchExpensesForGroup(
      groupId, 
      expensesPagination.pageSize, 
      expensesPagination.currentOffset
    );

    console.log("💰 Expenses loaded:", expensesData.expenses.length, "items");
    console.log("📊 Total expenses:", expensesData.total);
    console.log("📄 Has more:", expensesData.has_more);

    // Fetch settlements (only once, at initial load)
    let settlements = [];
    const isInitialLoad = expensesPagination.currentOffset === 0;
    if (isInitialLoad) {
      settlements = await fetchSettlementsForGroup(groupId);
      console.log("💰 Settlements loaded:", settlements.length, "items");
      window.currentSettlements = settlements;
    } else {
      settlements = window.currentSettlements || [];
    }

    // Add new expenses with type marker
    const newExpenses = expensesData.expenses.map(expense => ({
      ...expense,
      itemType: 'expense'
    }));

    // Merge with existing expenses
    allExpenses = [...allExpenses, ...newExpenses];

    // Add settlements with type marker (only on initial load)
    if (isInitialLoad) {
      settlements.forEach(settlement => {
        allExpenses.push({ ...settlement, itemType: 'settlement' });
      });
    }

    // Update pagination state after merging
    expensesPagination.totalExpenses = expensesData.total;
    expensesPagination.hasMore = expensesData.has_more;
    // Update offset based on number of expenses loaded (not including settlements)
    expensesPagination.currentOffset += expensesData.expenses.length;

    // Sort by date (newest first)
    allExpenses.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    console.log("📋 Total items to render:", allExpenses.length);

    // Render all expenses
    if (window.innerWidth >= 992) {
      renderDesktopTable(allExpenses, user, currentGroup);
    } else {
      renderMobileCards(allExpenses, user, currentGroup);
    }

    // Hide loading indicators
    hideLoadMoreIndicator();

    if (isInitialLoad) {
      await checkIfAllSettled();
    }
    attachViewButtonEvents();

    expensesPagination.isLoading = false;

  } catch (err) {
    console.error("Error loading expenses:", err);
    showError("Failed to load expenses");
    expensesPagination.isLoading = false;
    hideLoadMoreIndicator();
    
    if (expensesPagination.currentOffset === 0) {
      showEmptyState();
    }
  }
}

// -----------------------------
// Load more expenses (for infinite scroll)
// -----------------------------
async function loadMoreExpenses() {
  if (expensesPagination.isLoading || !expensesPagination.hasMore) {
    return;
  }
  await loadExpenses(false);
}

// -----------------------------
// Handle scroll for infinite loading
// -----------------------------
function handleScroll() {
  // Don't load if already loading or no more items
  if (expensesPagination.isLoading || !expensesPagination.hasMore) {
    return;
  }

  // Calculate scroll position
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  const windowHeight = window.innerHeight;
  const documentHeight = document.documentElement.scrollHeight;

  // Load more when user is 200px from bottom
  const threshold = 200;
  const distanceFromBottom = documentHeight - (scrollTop + windowHeight);

  if (distanceFromBottom < threshold) {
    console.log("📜 Near bottom, loading more expenses...");
    loadMoreExpenses();
  }
}

function showLoadingState() {
  const table = document.getElementById("expensesTable");
  const mobileList = document.getElementById("expensesList");

  if (table) {
    table.innerHTML = `
      <tr>
        <td colspan="7" class="text-center text-muted py-4">
          <div class="d-flex align-items-center justify-content-center">
            <div class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></div>
            Loading expenses...
          </div>
        </td>
      </tr>
    `;
  }

  if (mobileList) {
    mobileList.innerHTML = `
      <div class="text-center text-muted py-4">
        <div class="d-flex align-items-center justify-content-center">
          <div class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></div>
          Loading expenses...
        </div>
      </div>
    `;
  }
}

function showEmptyState() {
  const table = document.getElementById("expensesTable");
  const mobileList = document.getElementById("expensesList");

  if (table) {
    table.innerHTML = `
      <tr>
        <td colspan="7" class="text-center text-muted py-5">
          <div class="py-4">
            <i class="bi bi-receipt" style="font-size: 3rem; opacity: 0.3;"></i>
            <h5 class="mt-3 mb-2">No expenses yet</h5>
            <p class="text-muted mb-0">Start by adding your first expense!</p>
          </div>
        </td>
      </tr>
    `;
  }

  if (mobileList) {
    mobileList.innerHTML = `
      <div class="text-center text-muted py-5">
        <div class="py-4">
          <i class="bi bi-receipt" style="font-size: 3rem; opacity: 0.3;"></i>
          <h5 class="mt-3 mb-2">No expenses yet</h5>
          <p class="text-muted mb-0">Start by adding your first expense!</p>
        </div>
      </div>
    `;
  }
}

// -----------------------------
// Loading indicators for pagination
// -----------------------------
function showLoadMoreIndicator() {
  // Remove existing indicator if any
  hideLoadMoreIndicator();
  
  const table = document.getElementById("expensesTable");
  const mobileList = document.getElementById("expensesList");
  
  // Add loading row to table
  if (table) {
    const loadingRow = document.createElement("tr");
    loadingRow.id = "loadMoreIndicator";
    loadingRow.innerHTML = `
      <td colspan="7" class="text-center py-3">
        <div class="d-flex align-items-center justify-content-center">
          <div class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></div>
          <span class="text-muted">Loading more expenses...</span>
        </div>
      </td>
    `;
    table.appendChild(loadingRow);
  }
  
  // Add loading card to mobile list
  if (mobileList) {
    const loadingCard = document.createElement("div");
    loadingCard.id = "loadMoreIndicator";
    loadingCard.className = "text-center py-3";
    loadingCard.innerHTML = `
      <div class="d-flex align-items-center justify-content-center">
        <div class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></div>
        <span class="text-muted">Loading more expenses...</span>
      </div>
    `;
    mobileList.appendChild(loadingCard);
  }
}

function hideLoadMoreIndicator() {
  const indicator = document.getElementById("loadMoreIndicator");
  if (indicator) {
    indicator.remove();
  }
}

function renderDesktopTable(items, user, currentGroup = null) {
  const table = document.getElementById("expensesTable");
  if (!table) return;

  table.innerHTML = "";

  if (!items.length) {
    showEmptyState();
    return;
  }

  items.forEach((item, index) => {
    let tr;

    if (item.itemType === 'settlement') {
      tr = renderSettlementDesktopTable(item, user, index);
    } else {
      // Original expense rendering logic
      const expense = item;
      // Check if user is payer OR group owner
      const isPayer = expense.payer_id === user.id;
      const isGroupOwner = currentGroup && currentGroup.owner_id === user.id;
      const isOwner = isPayer || isGroupOwner;
      const userSplit = expense.splits?.find(s => s.user_id === user.id);
      const userShare = userSplit ? userSplit.share_amount : 0;

      // Calculate if user lent money (paid more than share) or owes money (paid less than share)
      // Note: userPaid should only be based on isPayer, not isOwner (group owner didn't pay)
      const userPaid = isPayer ? expense.amount : 0;
      const userOwes = userShare;
      const netAmount = userPaid - userOwes;

      // Determine color and text based on netAmount (same logic as mobile view)
      let shareColor, shareText, shareLabel;
      if (netAmount > 0) {
        shareColor = "#28a745"; // Green for "you lent"
        shareText = "you lent";
        shareLabel = Number(netAmount).toFixed(2);
      } else if (netAmount < 0) {
        shareColor = "#dc3545"; // Red for "you owe"
        shareText = "you owe";
        shareLabel = Number(Math.abs(netAmount)).toFixed(2);
      } else {
        shareColor = "#6c757d"; // Gray for "even"
        shareText = "even";
        shareLabel = Number(userShare).toFixed(2);
      }

      tr = document.createElement("tr");
      tr.className = "fade-in";
      tr.style.animationDelay = `${index * 0.1}s`;

      tr.innerHTML = `
        <td>
          <div class="d-flex align-items-center">
            <div class="me-3">
              <i class="bi bi-receipt text-primary fs-5"></i>
            </div>
            <div>
              <div class="fw-semibold">${expense.description}</div>
              ${expense.category ? `<small class="text-muted">${expense.category}</small>` : ''}
            </div>
          </div>
        </td>
        <td>
          <span class="fw-bold text-primary">${formatCurrency(expense.amount, expense.currency)}</span>
        </td>
        <td>
          <div class="d-flex align-items-center">
            <div class="avatar rounded-circle bg-info text-white d-flex align-items-center justify-content-center me-2" style="width:32px;height:32px;font-size:0.8rem;font-weight:bold;">
              ${(expense.payer_username || "U").split(" ").map(w => w[0]).join("").toUpperCase()}
            </div>
            <span class="fw-semibold">${expense.payer_username || "Unknown"}</span>
          </div>
        </td>
        <td>
          <div style="text-align: center;">
            <div style="font-size: 11px; color: ${shareColor}; margin-bottom: 2px;">${shareText}</div>
            <div style="font-size: 14px; color: ${shareColor}; font-weight: 500;">${shareLabel} ${expense.currency}</div>
          </div>
        </td>
        <td>
          <span class="text-muted small">
            <i class="bi bi-wallet me-1"></i>
            ${expense.wallet_name || 'Unknown'}
          </span>
        </td>
        <td>
          <div>
            <div class="fw-semibold">${getRelativeTime(expense.created_at)}</div>
            <small class="text-muted">${formatDate(expense.created_at)}</small>
          </div>
        </td>
        <td>
          <div class="btn-group" role="group">
            <button class="btn btn-sm btn-outline-info view-btn" data-id="${expense.id}" title="View details">
              <i class="bi bi-eye"></i>
                </button>
            <button class="btn btn-sm btn-outline-primary edit-btn" data-id="${expense.id}" data-bs-toggle="modal" data-bs-target="#editExpenseModal" ${!isOwner ? "disabled" : ""} title="Edit expense">
              <i class="bi bi-pencil"></i>
                </button>
            <button class="btn btn-sm btn-outline-danger" ${!isOwner ? "disabled" : ""} onclick="deleteExpense(${expense.id})" title="Delete expense">
              <i class="bi bi-trash"></i>
                </button>
          </div>
        </td>
      `;
    }

    table.appendChild(tr);
  });
}

function renderMobileCards(items, user, currentGroup = null) {
  const container = document.getElementById("expensesList");
  if (!container) return;

  container.innerHTML = "";

  if (!items.length) {
    showEmptyState();
    return;
  }

  items.forEach((item, index) => {
    let card;

    if (item.itemType === 'settlement') {
      card = renderSettlementMobileCard(item, user, index);
    } else {
      // Original expense rendering logic
      const expense = item;
      // Check if user is payer OR group owner
      const isPayer = expense.payer_id === user.id;
      const isGroupOwner = currentGroup && currentGroup.owner_id === user.id;
      const isOwner = isPayer || isGroupOwner;
      const userSplit = expense.splits?.find(s => s.user_id === user.id);
      const userShare = userSplit ? userSplit.share_amount : 0;

      // Calculate if user lent money (paid more than share) or owes money (paid less than share)
      // Note: userPaid should only be based on isPayer, not isOwner (group owner didn't pay)
      const userPaid = isPayer ? expense.amount : 0;
      const userOwes = userShare;
      const netAmount = userPaid - userOwes;

      // Format date like the image
      const expenseDate = new Date(expense.created_at);
      const month = expenseDate.toLocaleDateString('en-US', { month: 'short' });
      const day = expenseDate.getDate();

      card = document.createElement("div");
      card.className = "expense-item";
      card.style.cssText = `
        display: flex;
        align-items: center;
        padding: 8px 12px;
        border-bottom: 1px solid #eee;
        background: white;
        min-height: 50px;
        cursor: pointer;
      `;

      card.innerHTML = `
        <div style="display: flex; align-items: center; width: 100%;">
          <!-- Date Section -->
          <div style="display: flex; align-items: center; margin-right: 12px;">
            <div style="text-align: center; margin-right: 8px;">
              <div style="font-size: 11px; color: #666; line-height: 1;">${month}</div>
              <div style="font-size: 16px; color: #333; font-weight: 500; line-height: 1;">${day}</div>
                </div>
            <div style="width: 24px; height: 24px; background: #f5f5f5; border-radius: 4px; display: flex; align-items: center; justify-content: center;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14,2 14,8 20,8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10,9 9,9 8,9"></polyline>
              </svg>
                </div>
                </div>
          
          <!-- Description and Amount -->
          <div style="flex: 1; margin-right: 12px;">
            <div style="font-size: 14px; color: #333; font-weight: 500; margin-bottom: 2px;">${expense.description}</div>
            <div style="font-size: 12px; color: #666;">You paid ${Number(expense.amount).toFixed(2)} ${expense.currency}</div>
              </div>
          
          <!-- Lent/Owed Amount -->
          <div style="text-align: right;">
            ${netAmount > 0 ?
          `<div style="font-size: 11px; color: #28a745; margin-bottom: 2px;">you lent</div>
               <div style="font-size: 14px; color: #28a745; font-weight: 500;">${Number(netAmount).toFixed(2)} ${expense.currency}</div>` :
          netAmount < 0 ?
            `<div style="font-size: 11px; color: #dc3545; margin-bottom: 2px;">you owe</div>
               <div style="font-size: 14px; color: #dc3545; font-weight: 500;">${Number(Math.abs(netAmount)).toFixed(2)} ${expense.currency}</div>` :
            `<div style="font-size: 11px; color: #6c757d; margin-bottom: 2px;">even</div>
               <div style="font-size: 14px; color: #6c757d; font-weight: 500;">${Number(userShare).toFixed(2)} ${expense.currency}</div>`
        }
          </div>
              </div>
            `;

      // Add click handler for viewing details
      card.addEventListener('click', () => {
        viewExpenseDetails(expense.id);
      });
    }

    container.appendChild(card);
  });
}

// -----------------------------
// Expense Detail View
// -----------------------------
async function viewExpenseDetails(expenseId) {
  try {
    console.log("🔍 Viewing expense details for ID:", expenseId);

    // Find the expense in our loaded data
    const expense = allExpenses.find(e => e.id === expenseId);
    if (!expense) {
      showError("Expense not found");
      return;
    }

    // Get current user
    const user = await fetchCurrentUser();
    if (!user) {
      showError("User not authenticated");
      return;
    }

    // Create and show the detail modal
    showExpenseDetailModal(expense, user);

  } catch (err) {
    console.error("❌ Error viewing expense details:", err);
    showError("Failed to load expense details");
  }
}

function showExpenseDetailModal(expense, user) {
  // Remove existing modal if any
  const existingModal = document.getElementById('expenseDetailModal');
  if (existingModal) {
    existingModal.remove();
  }

  // Calculate splits and amounts
  // Check if user is payer OR group owner
  const isPayer = expense.payer_id === user.id;
  const isGroupOwner = currentGroup && currentGroup.owner_id === user.id;
  const isOwner = isPayer || isGroupOwner; // Can edit/delete if payer OR group owner
  const userSplit = expense.splits?.find(s => s.user_id === user.id);
  const userShare = userSplit ? userSplit.share_amount : 0;
  const userPaid = isPayer ? expense.amount : 0; // Only payer actually paid
  const userOwes = userShare;
  const netAmount = userPaid - userOwes;

  // Format dates
  const createdDate = new Date(expense.created_at);
  const updatedDate = new Date(expense.updated_at);

  // Create modal HTML
  const modalHTML = `
    <div class="modal fade" id="expenseDetailModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <!-- Top Action Bar -->
          <div class="modal-header bg-light border-bottom">
            <div class="d-flex justify-content-between align-items-center w-100">
              <button type="button" class="btn btn-link p-0" data-bs-dismiss="modal">
                <i class="bi bi-arrow-left fs-4"></i>
              </button>
              <div class="d-flex align-items-center">
                <button class="btn btn-link p-1 me-2" title="More options">
                  <i class="bi bi-file-earmark-down fs-5"></i>
                </button>
                <button class="btn btn-link p-1 me-2" title="Add photo">
                  <i class="bi bi-camera fs-5"></i>
                </button>
                <button class="btn btn-link p-1 me-2" title="Delete" ${!isOwner ? "disabled" : ""} onclick="deleteExpense(${expense.id})">
                  <i class="bi bi-trash fs-5 text-danger"></i>
                </button>
                <button class="btn btn-link p-1" title="Edit" ${!isOwner ? "disabled" : ""} data-bs-toggle="modal" data-bs-target="#editExpenseModal" onclick="handleEditExpense(${expense.id})">
                  <i class="bi bi-pencil fs-5 text-primary"></i>
                </button>
              </div>
            </div>
          </div>
          
          <!-- Expense Details -->
          <div class="modal-body p-0">
            <!-- Main Info -->
            <div class="p-4 border-bottom">
              <h4 class="mb-2">${expense.description}</h4>
              <div class="display-6 fw-bold text-primary mb-3">${Number(expense.amount).toFixed(2)} ${expense.currency}</div>
              
              <div class="text-muted small mb-2">
                <div>Added by ${expense.added_by_username || "Unknown"} on ${createdDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                <div>Updated by ${expense.added_by_username || "Unknown"} on ${updatedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
              </div>
            </div>
            
            <!-- Split Breakdown -->
            <div class="p-4 border-bottom">
              <div class="d-flex align-items-start mb-3">
                <div class="me-3">
                  <div class="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center" style="width: 40px; height: 40px;">
                    <i class="bi bi-person-fill"></i>
                  </div>
                </div>
                <div class="flex-grow-1">
                  <div class="fw-bold">${isOwner ? `You paid ${Number(expense.amount).toFixed(2)} ${expense.currency}` : `${expense.payer_username || 'Someone'} paid ${Number(expense.amount).toFixed(2)} ${expense.currency}`}</div>
                  ${userOwes > 0 ? `<div class="text-danger">You owe ${Number(userOwes).toFixed(2)} ${expense.currency}</div>` : ''}
                </div>
              </div>
              
              <!-- Other participants -->
              ${expense.splits?.filter(s => s.user_id !== user.id).map(split => `
                <div class="d-flex align-items-center mb-2">
                  <div class="me-3">
                    <div class="rounded-circle bg-secondary text-white d-flex align-items-center justify-content-center" style="width: 32px; height: 32px;">
                      <i class="bi bi-person"></i>
                    </div>
                  </div>
                  <div class="flex-grow-1">
                    <div class="fw-bold">${split.username} owes ${Number(split.share_amount).toFixed(2)} ${expense.currency}</div>
                  </div>
                </div>
              `).join('') || ''}
            </div>
            
          </div>
        </div>
      </div>
    </div>
  `;

  // Add modal to body
  document.body.insertAdjacentHTML('beforeend', modalHTML);

  // Show modal
  setTimeout(() => {
    try {
      const modal = new bootstrap.Modal(document.getElementById('expenseDetailModal'));
      modal.show();

      // Clean up modal when hidden
      document.getElementById('expenseDetailModal').addEventListener('hidden.bs.modal', function () {
        this.remove();
      });
    } catch (err) {
      console.error("Error showing expense detail modal:", err);
    }
  }, 100);
}

// -----------------------------
// Attach event listeners
// -----------------------------
function attachViewButtonEvents() {
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      const expenseId = this.getAttribute('data-id');
      openExpenseModal(expenseId);
    });
  });
}



async function openExpenseModal(expenseId) {
  try {
    const curentuser = await fetchCurrentUser();
    const res = await fetch(`${API_URL}/expenses/exp/${expenseId}`, { headers: getHeaders() });
    if (!res.ok) return;

    const e = await res.json();
    const modalTitle = document.getElementById("expenseModalTitle");
    const modalBody = document.getElementById("expenseModalBody");
    const modalFooter = document.getElementById("expenseModalFooter");

    modalTitle.textContent = e.description;

    const participants = (e.splits || []).map(s => `${s.username}: ${s.share_amount} ${e.currency}`).join("<br>");

    modalBody.innerHTML = `
      <p><b>Amount:</b> ${Number(e.amount).toFixed(2)} ${e.currency}</p>
      <p><b>Payer:</b> ${e.payer_username || "Unknown"}</p>
      <p><b>Split between:</b><br>${participants || "No splits"}</p>
      <div class="alert alert-info">
            <i class="bi bi-info-circle"></i> 
            <strong>Note:</strong> ${e.note || " "}
      </div>

      <p class="text-muted"><small>Added by ${e.added_by_username} on ${new Date(e.created_at).toLocaleString()}</small></p>
    `;

    // Buttons - Check if user is payer OR group owner
    const isPayer = e.payer_id === curentuser.id || e.payer_username === curentuser.username;
    const isGroupOwner = currentGroup && currentGroup.owner_id === curentuser.id;
    const isOwner = isPayer || isGroupOwner;
    modalFooter.innerHTML = `
      <button class="btn btn-primary" ${!isOwner ? "disabled" : ""} onclick="handleEditExpense(${e.id})">Edit</button>
      <button class="btn btn-danger" ${!isOwner ? "disabled" : ""} onclick="deleteExpense(${e.id})">Delete</button>
    `;

    // Wait for DOM to be ready before showing modal
    setTimeout(() => {
      try {
        const modalEl = document.getElementById("expenseDetailModal");
        if (modalEl) {
          const modal = new bootstrap.Modal(modalEl);
          modal.show();
        }
      } catch (err) {
        console.error("Modal error:", err);
      }
    }, 100);

  } catch (err) {
    console.error(err);
  }
}



// -----------------------------
// Wrapper for modal save button
// -----------------------------
async function addExpenseModalSubmit() {
  try {
    const url = new URL(window.location.href);
    const groupId = url.searchParams.get("id");

    const date = document.getElementById("expenseDate").value;
    const time = document.getElementById("expenseTime").value;
    const amount = parseFloat(document.getElementById("expenseAmount").value);
    const description = document.getElementById("expenseDesc").value.trim();
    const note = document.getElementById("expenseNote").value;
    const category = document.getElementById("expenseCategory").value;
    const walletId = document.getElementById("expenseWallet").value;
    const payerId = document.getElementById("expensePayer").value;


    if (!groupId) {
      showError("No group selected");
      return;
    }

    // Fetch current user first
    const currentUser = await fetchCurrentUser();
    if (!currentUser) {
      showError("User not authenticated");
      return;
    }



    if (!date || !time || !amount || !description) {
      showError("Please fill in all required fields");
      return;
    }

    if (amount <= 0) {
      showError("Amount must be greater than 0");
      return;
    }

    if (!payerId) {
      showError("Please select who paid for this expense");
      return;
    }

    // Get selected members
    const checked = document.querySelectorAll('#membersListForExpense input[type="checkbox"]:checked');
    const selectedMembers = Array.from(checked).map(checkbox => parseInt(checkbox.value));
    if (selectedMembers.length === 0) {
      showError("Please select at least one member");
      return;
    }

    // Build splits equally
    const share = amount / selectedMembers.length;
    const splits = selectedMembers.map(id => ({ user_id: id, share_amount: share }));

    // Combine date and time
    const expenseDate = new Date(`${date}T${time}`);

    const expenseData = {
      group_id: parseInt(groupId),
      payer_id: parseInt(payerId),
      description: description,
      note: note,
      amount: amount,
      currency: currentGroup?.currency || "MAD",
      category: category,
      wallet_id: walletId ? parseInt(walletId) : null,
      split_type: "equal",
      created_at: expenseDate.toISOString(),
      splits
    };

    console.log("🔄 Creating expense:", expenseData);
    console.log("👥 Selected members:", selectedMembers);

    const res = await fetch(`${API_URL}/expenses`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(expenseData),
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.detail || "Failed to create expense");
    }

    const newExpense = await res.json();
    console.log("✅ Expense created:", newExpense);

    showSuccess(`Expense "${description}" added successfully!`);

    // Close modal
    const addExpenseModal = bootstrap.Modal.getInstance(document.getElementById('addExpenseModal'));
    if (addExpenseModal) addExpenseModal.hide();


    // Clear form
    document.getElementById("addExpenseModal").querySelector("form").reset();

    // Refresh expenses and wallets
    await Promise.all([
      loadExpenses(true), // Reset pagination
      loadWallets(),
      initializeExpenseModal()
    ]);

  } catch (err) {
    console.error("❌ Error creating expense:", err);
    showError(err.message || "Failed to create expense");
  }
}



// --------------------------------------
// Initialize expense modal (clean version)
// --------------------------------------
async function initializeExpenseModal() {
  try {
    // ✅ Run only on expenses page
    if (!window.location.pathname.includes('expenses.html')) {
      console.log("⚠️ Not on expenses page, skipping initializeExpenseModal");
      return;
    }

    // ✅ Set current date and time
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const dateInput = document.getElementById('expenseDate');
    const timeInput = document.getElementById('expenseTime');

    if (dateInput) dateInput.value = today;
    if (timeInput) timeInput.value = currentTime;

    // ✅ Add preview listeners
    const amountInput = document.getElementById('expenseAmount');
    const categorySelect = document.getElementById('expenseCategory');

    if (amountInput) {
      amountInput.addEventListener('input', updateExpensePreview);
    }

    if (categorySelect) {
      categorySelect.addEventListener('change', updateExpensePreview);
    }

    // ✅ Fetch current user and set default payer
    const currentUser = await fetchCurrentUser();
    const payerSelect = document.getElementById('expensePayer');

    if (payerSelect && currentUser) {
      payerSelect.value = currentUser.id;
      console.log(`✅ Default payer set to current user: ${currentUser.id}`);

      // Trigger wallet update
      updateWalletsForPayer();
    }

    console.log("✅ Expense modal initialized successfully");
  } catch (err) {
    console.error("❌ Error initializing expense modal:", err);
  }
}





// -----------------------------
// Delete expense
// -----------------------------
async function deleteExpense(expenseId) {
  if (!confirm("Delete this expense?")) return;
  const res = await fetch(`${API_URL}/expenses/${expenseId}`, { method: "DELETE", headers: getHeaders() });
  if (res.ok) {
    await loadExpenses(true); // Reset pagination and reload
  } else {
    const e = await res.json().catch(() => null);
    alert(e?.detail || "Delete failed");

  }
}

// -----------------------------
// Friends list for add-member modal (improved design)
// -----------------------------
async function friendsListtoAddMember() {
  const t = localStorage.getItem("token");
  if (!t) return;

  // My friends
  let res = await fetch(`${API_URL}/friends/my`, { headers: getHeaders() });
  const myFriends = res.ok ? await res.json() : [];

  const ul1 = document.getElementById("friendsListtoAddMember");
  if (!ul1) return;

  if (myFriends.length === 0) {
    ul1.innerHTML = `
  <div class="text-center text-muted py-4" 
       style="cursor: pointer;" 
       onclick="window.location.href='http://pcrox.ddns.net:5500/frontend/friends.html'">
    <i class="bi bi-person-plus" style="font-size: 2rem;"></i>
    <p class="mt-2 mb-0">No friends available to add</p>
    <small>Click here to add friends</small>
  </div>`;
    return;
  }
  ul1.innerHTML = "";
  ul1.className = "friends-grid";

  myFriends.forEach(f => {
    const card = document.createElement("div");
    card.className = "friend-card";
    card.dataset.friendId = f.user_id;

    const initials = (f.username || "U")
      .split(" ")
      .map(w => w[0])
      .join("")
      .toUpperCase();

    card.innerHTML = `
      <div class="friend-avatar">${initials}</div>
      <div class="friend-name" title="${f.username || f.email || f.phone || `User ${f.user_id}`}">
        ${f.username || f.email || f.phone || `User ${f.user_id}`}
      </div>
    `;

    // Click handler for selection
    card.addEventListener('click', () => {
      card.classList.toggle('selected');
    });

    ul1.appendChild(card);
  });
}







// -----------------------------
// Members helpers (unchanged)
// -----------------------------
async function fetchMembers() {
  const params = new URLSearchParams(window.location.search);
  const groupId = params.get("id");
  if (!groupId) return [];

  const res = await fetch(`${API_URL}/groups/${groupId}/members`, { headers: getHeaders() });
  if (!res.ok) throw new Error("Failed to fetch members: " + res.status);

  const data = await res.json();
  console.log("✅ Members API response:", data);

  // If backend returns { members: [...] }, unwrap it
  const members = Array.isArray(data) ? data : data.members;
  if (!Array.isArray(members)) {
    console.error("⚠️ Invalid members format:", data);
    return [];
  }

  // Now safely render
  renderMembers(members);
  return members;
}

function renderMembersCheckboxList(container, members) {
  container.innerHTML = "";
  container.className = "row g-3 justify-content-center"; // responsive grid spacing

  members.forEach(m => {
    const col = document.createElement("div");
    col.className = "col-6 col-md-4 col-lg-3 col-xl-2"; // auto-fit grid

    const card = document.createElement("div");
    card.className = "member-card card text-center border-0 shadow-sm";
    card.style.cursor = "pointer";
    card.style.transition = "all 0.25s ease";
    card.style.userSelect = "none";
    card.style.padding = "1rem";

    // ✅ Avatar or initials
    const initials = (m.username || "U")
      .split(" ")
      .map(w => w[0])
      .join("")
      .toUpperCase();

    card.innerHTML = `
      <input class="form-check-input d-none" type="checkbox" value="${m.user_id}" id="member_${m.user_id}">
      <div class="avatar mx-auto mb-2 d-flex align-items-center justify-content-center rounded-circle">
        ${initials}
      </div>
      <h6 class="mb-0 text-truncate">${m.username || m.user_id}</h6>
      <small class="text-muted">${m.is_admin ? "👑 Admin" : "👤 Member"}</small>
    `;

    // ✅ Clickable / tappable behavior
    card.addEventListener("click", (e) => {
      const checkbox = card.querySelector("input[type='checkbox']");
      if (e.target.tagName !== "INPUT") checkbox.checked = !checkbox.checked;
      const checked = checkbox.checked;
      card.classList.toggle("selected", checked);
    });

    col.appendChild(card);
    container.appendChild(col);
  });
}

function renderMembersTable(container, members) {
  container.innerHTML = "";

  if (members.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td colspan="4" class="text-center text-muted py-4">
        <i class="bi bi-people"></i> No members found
      </td>`;
    container.appendChild(tr);
    return;
  }

  members.forEach(m => {
    const tr = document.createElement("tr");
    tr.className = "align-middle";
    tr.innerHTML = `
      <td><span class="badge bg-secondary">${m.user_id}</span></td>
      <td>
        <div class="d-flex align-items-center">
          <div class="avatar rounded-circle bg-primary text-white d-flex align-items-center justify-content-center me-2" style="width:32px;height:32px;font-size:0.8rem;font-weight:bold;">
            ${(m.username || "U").split(" ").map(w => w[0]).join("").toUpperCase()}
          </div>
          <span class="fw-semibold">${m.username || `User ${m.user_id}`}</span>
        </div>
      </td>
      <td>
        <span class="badge ${m.is_admin ? 'bg-warning' : 'bg-info'}">
          <i class="bi ${m.is_admin ? 'bi-shield-check' : 'bi-person'}"></i>
          ${m.is_admin ? 'Admin' : 'Member'}
        </span>
      </td>
      <td>
        <div class="btn-group" role="group">
          <button class="btn btn-sm btn-outline-warning" onclick="toggleAdmin(${m.user_id}, ${!m.is_admin})" title="Toggle Admin">
            <i class="bi bi-shield-check"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger" onclick="deleteMember(${m.user_id})" title="Remove Member">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </td>`;
    container.appendChild(tr);
  });
}

function renderMembersMobileCards(container, members) {
  container.innerHTML = "";
  container.className = "row g-3 p-3"; // responsive spacing with padding

  if (members.length === 0) {
    const emptyDiv = document.createElement("div");
    emptyDiv.className = "col-12 text-center text-muted py-4";
    emptyDiv.innerHTML = `
      <i class="bi bi-people" style="font-size: 2rem;"></i>
      <p class="mt-2 mb-0">No members found</p>`;
    container.appendChild(emptyDiv);
    return;
  }

  members.forEach(m => {
    const col = document.createElement("div");
    col.className = "col-12 col-sm-6 col-lg-4"; // responsive grid

    const card = document.createElement("div");
    card.className = "card shadow-sm member-card h-100";
    card.style.transition = "transform 0.2s, box-shadow 0.2s";
    card.innerHTML = `
      <div class="card-body d-flex flex-column">
        <div class="d-flex align-items-center mb-3">
          <div class="avatar rounded-circle bg-primary text-white d-flex align-items-center justify-content-center me-3" style="width:50px;height:50px;font-weight:bold;font-size:1.2rem;">
            ${(m.username || "U").split(" ").map(w => w[0]).join("").toUpperCase()}
          </div>
          <div class="flex-grow-1">
            <h6 class="mb-0 fw-bold">${m.username || `User ${m.user_id}`}</h6>
            <small class="text-muted">ID: ${m.user_id}</small>
          </div>
        </div>
        
        <div class="mb-3">
          <span class="badge ${m.is_admin ? 'bg-warning text-dark' : 'bg-info'} fs-6">
            <i class="bi ${m.is_admin ? 'bi-shield-check' : 'bi-person'}"></i>
            ${m.is_admin ? 'Admin' : 'Member'}
          </span>
        </div>
        
        <div class="mt-auto">
          <div class="btn-group w-100" role="group">
            <button class="btn btn-outline-warning btn-sm" onclick="toggleAdmin(${m.user_id}, ${!m.is_admin})" title="Toggle Admin">
              <i class="bi bi-shield-check"></i> ${m.is_admin ? 'Remove Admin' : 'Make Admin'}
            </button>
            <button class="btn btn-outline-danger btn-sm" onclick="deleteMember(${m.user_id})" title="Remove Member">
              <i class="bi bi-trash"></i> Remove
            </button>
          </div>
        </div>
      </div>
    `;

    // Hover effects
    card.addEventListener("mouseenter", () => {
      card.style.transform = "translateY(-2px)";
      card.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
    });
    card.addEventListener("mouseleave", () => {
      card.style.transform = "translateY(0)";
      card.style.boxShadow = "0 2px 4px rgba(0,0,0,0.1)";
    });

    col.appendChild(card);
    container.appendChild(col);
  });
}

function renderMembers(members) {
  const desktopContainer = document.getElementById("membersTable");
  const mobileContainer = document.getElementById("membersMobileCards");

  // Check screen size and render accordingly
  if (window.innerWidth >= 768) {
    // Desktop: show table, hide mobile cards
    if (desktopContainer) {
      desktopContainer.parentElement.classList.remove("d-none");
      renderMembersTable(desktopContainer, members);
    }
    if (mobileContainer) {
      mobileContainer.classList.add("d-none");
    }
  } else {
    // Mobile: show cards, hide table
    if (mobileContainer) {
      mobileContainer.classList.remove("d-none");
      renderMembersMobileCards(mobileContainer, members);
    }
    if (desktopContainer) {
      desktopContainer.parentElement.classList.add("d-none");
    }
  }
}

async function loadMembers() {
  try {
    const members = await fetchMembers();

    // Render desktop table
    const tableContainer = document.querySelector("#membersTableContainer");
    const tableBody = document.querySelector("#membersTable");
    if (tableContainer && tableBody) {
      renderMembersTable(tableBody, members);
    }

    // Render mobile cards
    const mobileCards = document.querySelector("#membersMobileCards");
    if (mobileCards) {
      renderMembersMobileCards(mobileCards, members);
    }
  } catch (err) {
    console.error("Error loading members:", err);
  }
}

// Render beautiful member cards for mobile
function renderMembersMobileCards(container, members) {
  container.innerHTML = "";

  if (members.length === 0) {
    container.innerHTML = `
      <div class="text-center text-muted py-4">
        <i class="bi bi-people"></i>
        <div class="mt-2">No members found</div>
        <small>Add friends to get started</small>
      </div>`;
    return;
  }

  members.forEach(member => {
    const card = document.createElement("div");
    card.className = `member-card ${member.is_admin ? 'admin' : ''}`;

    const initials = (member.username || "U")
      .split(" ")
      .map(w => w[0])
      .join("")
      .toUpperCase();

    card.innerHTML = `
      <div class="member-header">
        <div class="member-avatar">${initials}</div>
        <div class="member-info">
          <div class="member-name">${member.username || `User ${member.user_id}`}</div>
          <div class="member-role">${member.is_admin ? '👑 Admin' : '👤 Member'}</div>
        </div>
      </div>
      <div class="member-actions">
        <button class="btn btn-outline-warning btn-sm" onclick="toggleAdmin(${member.user_id}, ${!member.is_admin})">
          <i class="bi bi-shield-${member.is_admin ? 'minus' : 'plus'}"></i>
          ${member.is_admin ? 'Remove Admin' : 'Make Admin'}
        </button>
        <button class="btn btn-outline-danger btn-sm" onclick="deleteMember(${member.user_id})">
          <i class="bi bi-trash"></i> Remove
        </button>
      </div>
    `;

    container.appendChild(card);
  });
}

// Add Members
async function addMemberFromModal(modal) {
  const selectedCards = modal.querySelectorAll(".friend-card.selected");
  if (!selectedCards.length) return alert("Please select a friend!");
  const userIds = Array.from(selectedCards).map(card => parseInt(card.dataset.friendId));
  const isAdmin = modal.querySelector("#is_admin")?.checked || false;
  const params = new URLSearchParams(window.location.search);
  const groupId = params.get("id");
  if (!groupId) return alert("No group selected");

  const payload = { user_ids: userIds, is_admin: isAdmin };

  const res = await fetch(`${API_URL}/groups/${groupId}/add_members`, {
    method: "POST",
    headers: Object.assign({ "Content-Type": "application/json" }, getHeaders()),
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const e = await res.json().catch(() => null);
    return alert(e?.detail || "Failed to add member");
  }

  alert("Member(s) added!");
  loadMembers();

  // Clear selections
  selectedCards.forEach(card => card.classList.remove('selected'));
}

async function addMemberModalSubmit() {
  const modal = document.getElementById("manageMembersModal");
  await addMemberFromModal(modal);
}

// Update Member (toggle admin)
async function toggleAdmin(memberId, newStatus) {
  const params = new URLSearchParams(window.location.search);
  const groupId = params.get("id");
  if (!groupId) return;
  const res = await fetch(`${API_URL}/groups/${groupId}/members/${memberId}`, {
    method: "PUT",
    headers: Object.assign({ "Content-Type": "application/json" }, getHeaders()),
    body: JSON.stringify({ is_admin: newStatus })
  });

  if (!res.ok) {
    const e = await res.json().catch(() => null);
    return alert(e?.detail || "Failed to update member");
  }
  loadMembers();
}

// Delete Member
async function deleteMember(memberId) {
  if (!confirm("Remove this member?")) return;
  const params = new URLSearchParams(window.location.search);
  const groupId = params.get("id");
  if (!groupId) return;
  const res = await fetch(`${API_URL}/groups/${groupId}/members/${memberId}`, {
    method: "DELETE",
    headers: getHeaders()
  });

  if (!res.ok) {
    const e = await res.json().catch(() => null);
    return alert(e?.detail || "Failed to delete member");
  }
  loadMembers();
}

// ----------------------------
// 🧮 Check if group is fully settled
// ----------------------------
async function checkIfAllSettled() {
  const url = new URL(window.location.href);
  const groupId = url.searchParams.get("id");
  if (!groupId) return;

  try {
    const res = await fetch(`${API_URL}/settle/${groupId}/balances`, { headers: getHeaders() });
    if (!res.ok) return;

    const balances = await res.json();
    const allZero = balances.every(b => Math.abs(Number(b.net)) < 0.01);

    const desktopTable = document.getElementById("desktopTable");
    const mobileCards = document.getElementById("expensesList");
    const allSettledCard = document.getElementById("allSettledMessage");

    if (allZero) {
      // Hide data views for both
      if (desktopTable) desktopTable.classList.add("d-none");
      if (mobileCards) mobileCards.classList.add("d-none");
      if (allSettledCard) allSettledCard.classList.remove("d-none");
    } else {
      // Normal mode
      if (window.innerWidth >= 768) {
        // Desktop: show table, hide mobile cards
        if (desktopTable) desktopTable.classList.remove("d-none");
        if (mobileCards) mobileCards.classList.add("d-none");
      } else {
        // Mobile: show cards, hide table
        if (mobileCards) mobileCards.classList.remove("d-none");
        if (desktopTable) desktopTable.classList.add("d-none");
      }
      if (allSettledCard) allSettledCard.classList.add("d-none");
    }
  } catch (err) {
    console.error("Error checking balances:", err);
  }
}

// -----------------------------
// Fetch one expense by ID
// -----------------------------
async function fetchExpenseById(expenseId) {
  const res = await fetch(`${API_URL}/expenses/exp/${expenseId}`, { method: "GET", headers: getHeaders() });
  if (!res.ok) throw new Error("Failed to load expense");
  return await res.json();
}

async function handleEditExpense(expenseId) {
  try {
    const expense = await fetchExpenseById(expenseId);
    console.log("res test ", expense);

    // Fill main fields
    document.getElementById("editExpenseId").value = expense.id;
    document.getElementById("editDescription").value = expense.description;
    document.getElementById("editAmount").value = expense.amount;
    document.getElementById("editCategory").value = expense.category || "";
    document.getElementById("editNote").value = expense.note || "";
    document.getElementById("editWallet").value = expense.wallet_id || "";
    // Update currency in expense modal
    const editCurrency = document.getElementById('editCurrency');
    if (editCurrency) {
      editCurrency.textContent = expense.currency || 'USD';
    }




    // Fill splits
    const members = await fetchMembers();
    const editSplitsContainer = document.getElementById("editSplitsContainer");
    if (editSplitsContainer) setTimeout(() => {
      editSplitsContainer.innerHTML = "";  // <-- clear old rows
      renderParticipateCheckboxList(editSplitsContainer, members, expense.splits);
    }, 50); // tiny delay



    // Show modal with delay to ensure DOM is ready
    setTimeout(() => {
      try {
        const modalEl = document.getElementById("editExpenseModal");
        if (modalEl) {
          let modal = bootstrap.Modal.getInstance(modalEl);
          if (!modal) {
            modal = new bootstrap.Modal(modalEl);
          }
          modal.show();
        }
      } catch (err) {
        console.error("Edit modal error:", err);
      }
    }, 100);

  } catch (err) {
    console.error(err);
    alert("Failed to load expense data.");
  }
}

function addSplitRow() {
  const container = document.getElementById("editSplitsContainer");
  container.insertAdjacentHTML("beforeend", `
    <div class="input-group mb-2 split-row">
      <input type="number" class="form-control split-user-id" placeholder="User ID">
      <input type="number" class="form-control split-amount" placeholder="Share amount">
      <button class="btn btn-outline-danger" type="button" onclick="this.parentElement.remove()">🗑️</button>
    </div>
  `);
}

// -----------------------------
// Save changes (submit edit form)
// -----------------------------
async function submitEditExpense() {
  const id = document.getElementById("editExpenseId").value;
  const description = document.getElementById("editDescription").value;
  const amount = parseFloat(document.getElementById("editAmount").value);
  const currency = document.getElementById("editCurrency").value;
  const category = document.getElementById("editCategory").value;
  const note = document.getElementById("editNote").value;
  const walletId = parseInt(document.getElementById("editWallet").value);
  const checked = document.querySelectorAll("#editExpenseModal #editSplitsContainer input[type=checkbox]:checked");
  const userIds = Array.from(checked).map(c => parseInt(c.value));

  // Debug: Log what's being selected
  console.log("🔍 Debug - Edit Expense Submission:");
  console.log("📋 All checkboxes:", document.querySelectorAll("#editExpenseModal #editSplitsContainer input[type=checkbox]"));
  console.log("✅ Checked checkboxes:", checked);
  console.log("👥 Selected user IDs:", userIds);
  console.log("💰 Amount:", amount);
  console.log("📝 Description:", description);

  // Validation
  if (!description.trim()) {
    return showError("Please enter a description");
  }

  if (isNaN(amount) || amount <= 0) {
    return showError("Amount must be a positive number");
  }

  if (userIds.length === 0) {
    return showError("Please select at least one member to split with");
  }

  // Wallet is optional - if not selected, wallet_id will be null

  // Collect splits
  const share = amount / userIds.length;
  const splits = userIds.map(id => ({ user_id: id, share_amount: share }));

  console.log("test for splitesss : ", splits);
  const payload = { description, amount, currency, category, note, wallet_id: walletId || null, splits };


  try {
    // Show loading state
    const submitBtn = document.querySelector('#editExpenseModal .btn-primary');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="bi bi-hourglass-split me-1"></i>Saving...';
    submitBtn.disabled = true;

    const res = await fetch(`${API_URL}/expenses/${id}`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.detail || "Failed to update expense");
    }

    const updated = await res.json();
    console.log("✅ Expense updated successfully:", updated);

    // Close modal
    setTimeout(() => {
      try {
        const modalEl = document.getElementById("editExpenseModal");
        if (modalEl) {
          const modal = bootstrap.Modal.getInstance(modalEl);
          if (modal) modal.hide();
        }
      } catch (err) {
        console.error("Modal hide error:", err);
      }
    }, 100);

    // Refresh data
    await loadExpenses(true); // Reset pagination
    await loadWallets();

    // Show success message
    showSuccess("Expense updated successfully!");

  } catch (err) {
    console.error("❌ Error updating expense:", err);
    showError(err.message || "Failed to update expense");
  } finally {
    // Restore button state
    const submitBtn = document.querySelector('#editExpenseModal .btn-primary');
    if (submitBtn) {
      submitBtn.innerHTML = '<i class="bi bi-check-circle me-1"></i>Save Changes';
      submitBtn.disabled = false;
    }
  }
}

function renderParticipateCheckboxList(container, members, expenseSplits = []) {
  container.innerHTML = "";
  container.className = "row g-3 justify-content-center"; // responsive grid spacing

  members.forEach(member => {
    const split = expenseSplits.find(s => Number(s.user_id) === Number(member.user_id));

    const col = document.createElement("div");
    col.className = "col-6 col-md-4 col-lg-3 col-xl-2"; // responsive grid

    const card = document.createElement("div");
    card.className = "member-card card text-center border-0 shadow-sm";
    card.style.cursor = "pointer";
    card.style.transition = "all 0.25s ease";
    card.style.userSelect = "none";
    card.style.padding = "1rem";

    const initials = (member.username || "U")
      .split(" ")
      .map(w => w[0])
      .join("")
      .toUpperCase();

    // Only check if there's an existing split AND it's not already been unchecked by user
    const shouldBeChecked = split ? "checked" : "";

    card.innerHTML = `
      <input class="form-check-input d-none split-checkbox" type="checkbox" value="${member.user_id}" id="member-${member.user_id}" ${shouldBeChecked}>
      <div class="avatar mx-auto mb-2 d-flex align-items-center justify-content-center rounded-circle bg-primary text-white" style="width:50px;height:50px;font-weight:bold;">
        ${initials}
      </div>
      <h6 class="mb-0 text-truncate">${member.username || member.user_id}</h6>
      <small class="text-muted">${member.is_admin ? "👑 Admin" : "👤 Member"}</small>
    `;

    // ✅ Set initial selected state
    const checkbox = card.querySelector("input[type='checkbox']");
    if (checkbox.checked) card.classList.add("selected");

    // ✅ Clickable card toggles checkbox
    card.addEventListener("click", (e) => {
      if (e.target.tagName !== "INPUT") {
        checkbox.checked = !checkbox.checked;
        card.classList.toggle("selected", checkbox.checked);

        // Debug: Log when checkbox state changes
        console.log(`Member ${member.username} (ID: ${member.user_id}) checkbox: ${checkbox.checked ? 'CHECKED' : 'UNCHECKED'}`);
      }
    });

    col.appendChild(card);
    container.appendChild(col);
  });

  // Debug: Log all checked checkboxes after rendering
  setTimeout(() => {
    const allChecked = document.querySelectorAll("#editExpenseModal #editSplitsContainer input[type=checkbox]:checked");
    console.log("🔍 All checked members after rendering:", Array.from(allChecked).map(cb => ({
      id: cb.value,
      name: cb.closest('.member-card').querySelector('h6').textContent
    })));
  }, 100);
}

// -----------------------------
// Attach edit button events
// -----------------------------
document.addEventListener("click", async (e) => {
  const btn = e.target.closest(".edit-btn");
  if (!btn) return;

  const id = btn.dataset.id;
  if (id) handleEditExpense(id);
});

// -----------------------------
// Leaving Groups 
// -----------------------------

async function checkCanLeave(groupId) {
  // Skip if not on expense page
  if (!window.location.pathname.includes("/expenses")) return;

  if (!groupId) {
    console.warn("Skipping checkCanLeave — no groupId found");
    return;
  }
  try {

    const res = await fetch(`${API_URL}/groups/${groupId}/can_leave`, { headers: getHeaders() });
    const data = await res.json();
    data.can_leave;
    document.getElementById("leaveGroupBtn").disabled = !data.can_leave;
  } catch (err) {
    console.error(err);
    document.getElementById("leaveGroupBtn").disabled = true;
  }
}

document.getElementById("leaveGroupBtn")?.addEventListener("click", async () => {
  if (!confirm("Are you sure you want to leave this group?")) return;

  const url = new URL(window.location.href);
  const groupId = url.searchParams.get("id");
  try {
    const res = await fetch(`${API_URL}/groups/${groupId}/leave`, {
      method: "POST",
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Failed to leave group");
    alert("You left the group successfully");
    window.location.href = "groups.html"; // redirect to groups list
  } catch (err) {
    alert(err.message);
  }
});

const url = new URL(window.location.href);
const groupId = url.searchParams.get("id");
console.log("check groupid", groupId);
// ✅ Call on page load
checkCanLeave(groupId);

// ----------------------------
// Init
// ----------------------------
document.addEventListener("DOMContentLoaded", () => {
  // Load initial data
  loadGroupInfo();
  loadExpenses();
  friendsListtoAddMember();
  loadMembers();
  loadWallets();
  loadPayersForExpense();
  loadMembersForExpense();
  initializeExpenseModal();

  // Add refresh functionality
  const refreshBtn = document.getElementById('refreshExpenses');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      loadExpenses(true); // Reset pagination
      loadWallets();
    });
  }

  // Add edit group button functionality
  const editGroupBtn = document.getElementById('editGroupBtn');
  if (editGroupBtn) {
    editGroupBtn.addEventListener('click', openEditGroupModalFromExpenses);
  }

  // Add edit group form submission
  const editGroupForm = document.getElementById('editGroupForm');
  if (editGroupForm) {
    editGroupForm.addEventListener('submit', saveGroupChanges);
  }

  // Add filter functionality
  const filterItems = document.querySelectorAll('[data-filter]');
  filterItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const filter = e.target.dataset.filter;
      applyFilter(filter);
    });
  });

  // Handle window resize for responsive behavior
  window.addEventListener('resize', async () => {
    if (allExpenses.length > 0) {
      const user = await fetchCurrentUser();
      if (user) {
        if (window.innerWidth >= 992) {
          renderDesktopTable(allExpenses, user, currentGroup);
        } else {
          renderMobileCards(allExpenses, user, currentGroup);
        }
      }
    }
  });

  // Infinite scroll detection
  let scrollTimeout;
  window.addEventListener('scroll', () => {
    // Debounce scroll events
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      handleScroll();
    }, 100);
  }, { passive: true });

  // "Show Expenses" button inside All Settled card
  const btn = document.getElementById("showExpensesBtn");
  if (btn) {
    btn.addEventListener("click", () => {
      const desktopTable = document.getElementById("desktopTable");
      const mobileCards = document.getElementById("expensesList");
      const allSettledCard = document.getElementById("allSettledMessage");

      // Hide Congrats
      if (allSettledCard) allSettledCard.classList.add("d-none");

      // Show appropriate view
      if (window.innerWidth >= 992) {
        if (desktopTable) desktopTable.classList.remove("d-none");
        if (mobileCards) mobileCards.classList.add("d-none");
      } else {
        if (mobileCards) mobileCards.classList.remove("d-none");
        if (desktopTable) desktopTable.classList.add("d-none");
      }
    });
  }

  // Balances page redirect
  const balanceBtn = document.getElementById("balanceId");
  if (balanceBtn) {
    balanceBtn.addEventListener("click", () => {
      const params = new URLSearchParams(window.location.search);
      const groupId = params.get("id");
      if (!groupId) return;
      window.location.href = `balances.html?id=${groupId}`;
    });
  }
});

// -----------------------------
// Filter functionality
// -----------------------------
async function applyFilter(filter) {
  if (!allExpenses.length) return;

  let filteredExpenses = allExpenses;
  const user = await fetchCurrentUser();

  if (!user) return;

  switch (filter) {
    case 'my':
      filteredExpenses = allExpenses.filter(e => e.payer_username === user.username);
      break;
    case 'recent':
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      filteredExpenses = allExpenses.filter(e => new Date(e.created_at) > weekAgo);
      break;
    case 'all':
    default:
      filteredExpenses = allExpenses;
      break;
  }

  // Re-render with filtered data
  if (window.innerWidth >= 992) {
    renderDesktopTable(filteredExpenses, user, currentGroup);
  } else {
    renderMobileCards(filteredExpenses, user, currentGroup);
  }
}





// Download Template
document.getElementById("downloadTemplateBtn")?.addEventListener("click", async () => {
  const url = new URL(window.location.href);
  const groupId = url.searchParams.get("id");
  
  if (!groupId) return alert("No group selected");

  const res = await fetch(`${API_URL}/expenses/${groupId}/download-template`, {
    headers: getHeaders()
  });
  if (!res.ok) return alert("Failed to download template");

  const blob = await res.blob();
  const url_obj = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url_obj;
  a.download = `group_${groupId}_template.xlsx`;
  a.click();
  window.URL.revokeObjectURL(url_obj);
});

// Upload Expenses - auto-upload when file is selected
document.getElementById("uploadFile")?.addEventListener("change", async (e) => {
  const url = new URL(window.location.href);
  const groupId = url.searchParams.get("id");
  const fileInput = e.target;
  const statusDiv = document.getElementById("uploadStatus");
  
  if (!groupId) return alert("No group selected");
  if (!fileInput?.files.length) return;

  if (statusDiv) {
    statusDiv.innerHTML = '<div class="spinner-border spinner-border-sm me-2" role="status"></div>Uploading...';
    statusDiv.className = "text-center mb-3 text-primary";
  }

  const formData = new FormData();
  formData.append("file", fileInput.files[0]);

  try {
  // Don't set Content-Type header for FormData - let the browser set it with boundary
  const headers = { ...getHeaders() };
  delete headers['Content-Type'];
  
  const res = await fetch(`${API_URL}/expenses/${groupId}/upload`, {
    method: "POST",
    headers: headers,
    body: formData
  });

    let data;
    try {
      data = await res.json();
    } catch (e) {
      data = { detail: "Server response error" };
    }
    
    if (res.ok) {
      // Check if there were errors in upload
      if (data.status === "error" && data.errors && data.errors.length > 0) {
        const errorList = data.errors.map(err => `<li>${err}</li>`).join('');
        if (statusDiv) {
          statusDiv.innerHTML = `
            <div class="alert alert-warning alert-sm">
              <strong>Upload completed with errors:</strong>
              <ul class="mb-0 text-start">${errorList}</ul>
            </div>`;
          statusDiv.className = "text-center mb-3";
        }
        showError(`Upload completed with ${data.errors.length} errors. See details below.`);
        
        // Clear status after 10 seconds
        setTimeout(() => {
          if (statusDiv) statusDiv.innerHTML = "";
        }, 10000);
      } else {
        // Success
        if (statusDiv) {
          statusDiv.innerHTML = `<div class="alert alert-success alert-sm mb-0">${data.message || "Expenses uploaded successfully!"}</div>`;
          statusDiv.className = "text-center mb-3";
        }
        showSuccess(data.message || "Expenses uploaded successfully!");
        fileInput.value = ""; // Clear file input
        await loadExpenses(true); // Reset pagination and reload expenses
        
        // Clear status after 3 seconds
        setTimeout(() => {
          if (statusDiv) statusDiv.innerHTML = "";
        }, 3000);
      }
    } else {
      // HTTP Error
      if (statusDiv) {
        const errorMsg = data.detail || data.message || "Failed to upload expenses";
        statusDiv.innerHTML = `<div class="alert alert-danger alert-sm mb-0">${errorMsg}</div>`;
        statusDiv.className = "text-center mb-3";
      }
      showError(data.detail || data.message || "Failed to upload expenses");
    }
  } catch (err) {
    if (statusDiv) {
      statusDiv.innerHTML = `<div class="alert alert-danger alert-sm mb-0">Error: ${err.message}</div>`;
      statusDiv.className = "text-center mb-3";
    }
    showError("Failed to upload expenses: " + err.message);
  }
});

// Download Current Expenses
document.getElementById("downloadExpensesBtn")?.addEventListener("click", async () => {
  const url = new URL(window.location.href);
  const groupId = url.searchParams.get("id");
  
  if (!groupId) return alert("No group selected");

  const res = await fetch(`${API_URL}/expenses/${groupId}/download`, {
    headers: getHeaders()
  });
  if (!res.ok) return alert("Failed to download expenses");

  const blob = await res.blob();
  const url_obj = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url_obj;
  a.download = `group_${groupId}_expenses.xlsx`;
  a.click();
  window.URL.revokeObjectURL(url_obj);
});
