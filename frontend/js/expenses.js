// frontend/js/expenses.js
// handles listing expenses, creating group/individual expenses, edit/delete
// Assumes config.js defines API_URL and getHeaders() and setToken/token behavior
loadAuth();

// -----------------------------
// Fetch expenses for group
// -----------------------------
async function fetchExpensesForGroup(groupId) {
  if (!groupId) return [];
  const res = await fetch(`${API_URL}/expenses/${groupId}`, { headers: getHeaders() });
  if (!res.ok) return [];
  return await res.json();
}

// -----------------------------
// Load and render expenses
// -----------------------------
async function loadExpenses() {
  const curentuser = await fetchCurrentUser();
  const url = new URL(window.location.href);
  const groupId = url.searchParams.get("id");
  // fetch and render
  try {
    const expenses = groupId ? await fetchExpensesForGroup(groupId) : [];
    const table = document.getElementById("expensesTable");
    if (table) {
      table.innerHTML = "";
      if (!expenses.length) {
        table.innerHTML = `<tr><td colspan="10" class="text-center text-muted">No expenses</td></tr>`;
      } else {
        expenses.forEach(e => {
          const isOwner = e.payer_username === curentuser.username;
          const participants = (e.splits || []).map(s => s.username || s.user_id).join(", ");
          const distribution = (e.splits || []).map(s => `${s.username}: ${s.share_amount}${e.currency}`).join(", ");
          const tr = document.createElement("tr");
          tr.innerHTML = `
          <td>${e.id}</td>
          <td>${e.description}</td>
          <td>${Number(e.amount).toFixed(2)} ${e.currency}</td>
          <td>${e.payer_username || "Unknown"}</td>
          <td>${distribution}</td>
          <td>${e.category || "-"}</td>
          <td>${new Date(e.created_at).toLocaleString()}</td>
          <td>${new Date(e.updated_at).toLocaleString()}</td>
          <td>
            <button class="btn btn-sm btn-primary edit-btn"  data-id="${e.id}"  data-bs-toggle="modal" data-bs-target="#editExpenseModal" ${!isOwner ? "disabled" : ""}>
              <i class="bi bi-pencil"></i> Edit
            </button>
            <button class="btn btn-sm btn-danger" ${!isOwner ? "disabled" : ""} onclick="deleteExpense(${e.id})">
              <i class="bi bi-trash"></i> Delete
            </button>
          </td>`;
          table.appendChild(tr);
        });
      }
    }
    // Mobile cards
    const list = document.getElementById("expensesList");
    if (list) {
      list.innerHTML = "";
      (expenses || []).forEach(e => {
        const participants = (e.splits || []).map(s => s.username || s.user_id).join(", ");
        const distribution = (e.splits || []).map(s => `${s.username} ${s.share_amount} ${e.currency}`).join(", ");
        const card = document.createElement("div"); card.className = "card expense-card mb-2";
        const isOwner = e.payer_username === curentuser.username;
        card.innerHTML = `
        <div class="card-body">
          <div class="d-flex justify-content-between">
            <h6 class="mb-1">${e.description}</h6>
            <small class="text-muted">${new Date(e.created_at).toLocaleDateString()}</small>
          </div>
          <p class="mb-1">
            <b>${isOwner ? "You" : e.payer_username ?? "Unknown"}</b> paid 
            <span class="fw-bold">${Number(e.amount).toFixed(2)} ${e.currency}</span>
          </p>
          <small class="text-muted">Shared with: ${participants}</small><br>
          <small class="text-muted">Distribution: ${distribution}</small>
          <div class="mt-2 d-flex gap-2">
            <button class="btn btn-sm btn-primary edit-btn" data-id="${e.id}" data-bs-toggle="modal" data-bs-target="#editExpenseModal"  ${!isOwner ? "disabled" : ""}>
              <i class="bi bi-pencil"></i> Edit
            </button>
            <button class="btn btn-sm btn-danger delete-btn"  ${!isOwner ? "disabled" : ""} onclick="deleteExpense(${e.id})">
              <i class="bi bi-trash"></i> Delete
            </button>
          </div>
        </div>`;
        list.appendChild(card);
      });
    }

    // After rendering, check if all settled
    await checkIfAllSettled();

  } catch (e) { console.error(e); }
}

async function openExpenseModal(expenseId) {
  try {
    const curentuser = await fetchCurrentUser();
    const res = await fetch(`${API_URL}/expense/${expenseId}`, { headers: getHeaders() });
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
      <p><b>Split:</b><br>${participants || "No splits"}</p>
      <p class="text-muted"><small>Added by ${e.payer_username} on ${new Date(e.created_at).toLocaleString()}</small></p>
    `;

    // Buttons
    const isOwner = e.payer_username === curentuser.username;
    modalFooter.innerHTML = `
      <button class="btn btn-primary" ${!isOwner ? "disabled" : ""} onclick="editExpense(${e.id})">Edit</button>
      <button class="btn btn-danger" ${!isOwner ? "disabled" : ""} onclick="deleteExpense(${e.id})">Delete</button>
    `;

    const modal = new bootstrap.Modal(document.getElementById("expenseDetailModal"));
    modal.show();

  } catch (err) {
    console.error(err);
  }
}



// -----------------------------
// Add Expense from modal
// -----------------------------
async function addExpenseFromModal(modal) {
  const description = modal.querySelector("input[type=text]").value.trim();
  const amount = parseFloat(modal.querySelector("input[type=number]").value);
  const checked = modal.querySelectorAll("input[type=checkbox]:checked");
  const userIds = Array.from(checked).map(c => parseInt(c.value));
  const params = new URLSearchParams(window.location.search);
  const groupId = params.get("id");
  const currency = "MAD";

  if (!description || !userIds.length)
    return alert("Fill all fields and pick members");

  // Prevent negative or zero amount
  if (isNaN(amount) || amount <= 0) {
    return alert("Amount must be a positive number");
  }

  const share = amount / userIds.length;
  const splits = userIds.map(id => ({ user_id: id, share_amount: share }));

  const payload = groupId
    ? { group_id: parseInt(groupId), description, amount, currency, splits }
    : { description, amount, currency, splits };

  const res = await fetch(`${API_URL}/expenses/${groupId ? "" : ""}`, {
    method: "POST",
    headers: Object.assign({ "Content-Type": "application/json" }, getHeaders()),
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const e = await res.json().catch(() => null);
    return alert(e?.detail || "Failed to create expense");
  }

  alert("Expense created");
  // reload and re-check balances
  await loadExpenses();
}

// wrapper for modal save button
function addExpenseModalSubmit() {
  const modal = document.getElementById("addExpenseModal");
  addExpenseFromModal(modal);
  // close modal
  const bs = bootstrap.Modal.getInstance(modal);
  if (bs) bs.hide();
}

// -----------------------------
// Delete expense
// -----------------------------
async function deleteExpense(expenseId) {
  if (!confirm("Delete this expense?")) return;
  const res = await fetch(`${API_URL}/expenses/${expenseId}`, { method: "DELETE", headers: getHeaders() });
  if (res.ok) {
    await loadExpenses(); // reload
  } else {
    const e = await res.json().catch(() => null);
    alert(e?.detail || "Delete failed");
  }
}




// -----------------------------
// Friends list for add-member modal (unchanged)
// -----------------------------
async function friendsListtoAddMember() {
  const t = localStorage.getItem("token");
  if (!t) return;
  // My friends
  let res = await fetch(`${API_URL}/friends/my`, { headers: getHeaders() });
  const myFriends = res.ok ? await res.json() : [];

  const ul1 = document.getElementById("friendsListtoAddMember");
  if (!ul1) return;
  ul1.innerHTML = "";
  myFriends.forEach(f => {
    const div = document.createElement("div");
    div.className = "form-check mb-1";
    div.innerHTML = `
        <input class="form-check-input" type="checkbox" value="${f.user_id}" id="friend_${f.user_id}">
        <label class="form-check-label" for="friend_${f.user_id}">
            ${f.username || f.email || f.phone || f.user_id}
        </label>
    `;
    ul1.appendChild(div);
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
  members.forEach(m => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${m.user_id}</td>
      <td>${m.username || m.user_id}</td>
      <td>${m.is_admin ? "Yes" : "No"}</td>
      <td>
        <button class="btn btn-sm btn-warning" onclick="toggleAdmin(${m.user_id}, ${!m.is_admin})">Toggle Admin</button>
        <button class="btn btn-sm btn-danger" onclick="deleteMember(${m.user_id})">Delete</button>
      </td>`;
    container.appendChild(tr);
  });
}

function renderMembersMobileCards(container, members) {
  container.innerHTML = "";
  container.className = "row g-3"; // responsive spacing

  members.forEach(m => {
    const col = document.createElement("div");
    col.className = "col-12 col-sm-6"; // 2 per row on small devices

    const card = document.createElement("div");
    card.className = "card shadow-sm member-card";
    card.style.transition = "transform 0.2s";
    card.innerHTML = `
      <div class="card-body d-flex justify-content-between align-items-center">
        <div class="d-flex align-items-center">
          <div class="avatar rounded-circle bg-primary text-white d-flex align-items-center justify-content-center me-3" style="width:40px;height:40px;font-weight:bold;">
            ${(m.username || "U").split(" ").map(w => w[0]).join("").toUpperCase()}
          </div>
          <div>
            <h6 class="mb-0">${m.username || m.user_id}</h6>
            <small class="text-muted">${m.is_admin ? "👑 Admin" : "👤 Member"}</small>
          </div>
        </div>
        <div class="d-flex gap-1">
          <button class="btn btn-sm btn-warning" onclick="toggleAdmin(${m.user_id}, ${!m.is_admin})">Toggle</button>
          <button class="btn btn-sm btn-danger" onclick="deleteMember(${m.user_id})">Delete</button>
        </div>
      </div>
    `;

    // Hover effect
    card.addEventListener("mouseenter", () => card.style.transform = "scale(1.02)");
    card.addEventListener("mouseleave", () => card.style.transform = "scale(1)");

    col.appendChild(card);
    container.appendChild(col);
  });
}


function renderMembers(members) {
  const desktopContainer = document.getElementById("membersTable");
  const mobileContainer = document.getElementById("membersMobileCards");

  renderMembersTable(desktopContainer, members);
  renderMembersMobileCards(mobileContainer, members);
}



async function loadMembers() {
  try {
    const members = await fetchMembers();
  
    const checkboxList = document.querySelector("#membersList");
    if (checkboxList) renderMembersCheckboxList(checkboxList, members);
   /*   const tableBody = document.querySelector("#membersTable");
    if (tableBody) renderMembersTable(tableBody, members);
    const mobileCards = document.querySelector("#mobileMemberscard");
    if (mobileCards) renderMembersMobileCards(mobileCards, members);

*/


    
  } catch (err) {
    console.error(err);
  }
}






// Add Members
async function addMemberFromModal(modal) {
  const checked = modal.querySelectorAll("input[type=checkbox]:checked");
  if (!checked.length) return alert("Please select a friend!");
  const userIds = Array.from(checked).map(c => parseInt(c.value));
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
}

async function addMemberModalSubmit() {
  const modal = document.getElementById("manageMembersModal");
  await addMemberFromModal(modal);
  //const bs = bootstrap.Modal.getInstance(modal);
  //if (bs) bs.hide();
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

// ----------------------------
// Init
// ----------------------------
document.addEventListener("DOMContentLoaded", () => {
  loadExpenses();
  friendsListtoAddMember();
  loadMembers();

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
      if (window.innerWidth >= 768) {
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
 

// Fill splits
const members = await fetchMembers();
const editSplitsContainer = document.getElementById("editSplitsContainer");
if (editSplitsContainer) setTimeout(() => {
  renderParticipateCheckboxList(editSplitsContainer, members, expense.splits);
}, 50); // tiny delay




    // Show modal
    // Use the existing modal instance instead of creating a new one each time
    const modalEl = document.getElementById("editExpenseModal");
    let modal = bootstrap.Modal.getInstance(modalEl); // get existing instance
    if (!modal) {
      modal = new bootstrap.Modal(modalEl);
    }
    modal.show();

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
  const category = document.getElementById("editCategory").value;
  const note = document.getElementById("editNote").value;
  const checked = document.querySelectorAll("input[type=checkbox]:checked");
  const userIds = Array.from(checked).map(c => parseInt(c.value));


  // Prevent negative or zero amount
  if (isNaN(amount) || amount <= 0) {
    return alert("Amount must be a positive number");
  }
  // Collect splits
  const share = amount / userIds.length;
  const splits = userIds.map(id => ({ user_id: id, share_amount: share }));


  const payload = { description, amount, category, note, splits };


  try {
    const res = await fetch(`${API_URL}/expenses/${id}`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to update expense");

    const updated = await res.json();
    console.log("Updated expense:", updated);

    bootstrap.Modal.getInstance(document.getElementById("editExpenseModal")).hide();
    await loadExpenses(); // refresh table
  } catch (err) {
    console.error(err);
    alert("Failed to update expense");
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

    card.innerHTML = `
      <input class="form-check-input d-none split-checkbox" type="checkbox" value="${member.user_id}" id="member-${member.user_id}" ${split ? "checked" : ""}>
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
      if (e.target.tagName !== "INPUT") checkbox.checked = !checkbox.checked;
      card.classList.toggle("selected", checkbox.checked);
    });

    col.appendChild(card);
    container.appendChild(col);
  });
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
// ✅ Call on page load
checkCanLeave(groupId);
