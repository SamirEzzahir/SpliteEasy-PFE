// frontend/js/group.js
// create group, list groups, add members (only friends), fetch members
loadAuth();
async function fetchGroups() {
  const t = localStorage.getItem("token");
  if (!t) return [];
  const res = await fetch(`${API_URL}/groups`, { headers: { Authorization: `Bearer ${t}` } });
  if (!res.ok) return [];
  return await res.json();
}



// add members to group (expects friend checkboxes elsewhere)
async function addMembersToGroup(groupId, userIds, is_admin = false) {
  const t = localStorage.getItem("token");
  const res = await fetch(`${API_URL}/groups/${groupId}/add_members`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
    body: JSON.stringify({ user_ids: userIds, is_admin })
  });
  if (!res.ok) {
    const e = await res.json().catch(() => null);
    throw e || new Error("Failed to add members");
  }
  return await res.json();
}

// helper to populate friends checkboxes for group creation
async function loadFriendsCheckboxes(targetId) {
  const t = localStorage.getItem("token");
  if (!t) return;
  const res = await fetch(`${API_URL}/friends/my`, { headers: { Authorization: `Bearer ${t}` } });
  const friends = res.ok ? await res.json() : [];
  const container = document.getElementById(targetId);
  if (!container) return;
  container.innerHTML = "";
  friends.forEach(f => {
    const div = document.createElement("div");
    div.className = "form-check";
    div.innerHTML = `<input class="form-check-input" type="checkbox" value="${f.user_id}" id="friend_${f.user_id}"><label class="form-check-label ms-2" for="friend_${f.user_id}">${f.username || f.user_id}</label>`;
    container.appendChild(div);
  });
}

async function renderGroupsList() {
  const groups = await fetchGroups();
  const table = document.getElementById("groupsTable");
  if (table) {
    table.innerHTML = "";
    if (!groups.length) {
      table.innerHTML = `<tr><td colspan="6" class="text-center text-muted">No groups yet</td></tr>`;
    } else {
      groups.forEach(g => {
        const participants = (g.members_usernames || []).join(", ");
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${g.id}</td>
          <td>${g.title}</td>
          <td>${g.currency}</td>
          <td>${g.owner_username || g.owner_id}</td>
          <td>${participants}</td>
          <td>${new Date(g.created_at).toLocaleString()}</td>
          <td>
            <button class="btn btn-sm btn-primary" onclick="openGroup(${g.id})">Open</button>
            <button class="btn btn-sm btn-warning" onclick="editGroup(${g.id})">Edit</button>
            <button class="btn btn-sm btn-danger" onclick="deleteGroup(${g.id})">Delete</button>
          </td>
        `;
        table.appendChild(tr);
      });
    }
  }
}


// ==============================
// Render Groups for Mobile as Cards (Improved)
// ==============================
async function renderGroupsMobileCards() {
  const groups = await fetchGroups();
  const container = document.getElementById("groupsMobileCards");
  if (!container) return;

  container.innerHTML = "";

  if (!groups.length) {
    container.innerHTML = `<div class="text-center text-muted py-4">No groups yet.</div>`;
    return;
  }

  for (const g of groups) {
    // Avatar initials
    const initials = (g.title || "")
      .split(" ")
      .map(p => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "G";

    // Participants
    const participants = (g.members_usernames || []).join(", ") || "No members";

    // Recent expense
    const recent = g.expenses?.length
      ? `${g.expenses[0].payer_username ?? "Someone"} paid ${g.expenses[0].amount} ${g.expenses[0].currency}`
      : "No recent activity";

    const card = document.createElement("div");
card.className = "group-card card shadow-sm border-0 mb-3";

// Random gradient index (1–6)
const gradientIndex = (g.id % 6) + 1;

card.innerHTML = `
  <div class="card-body d-flex align-items-center">
    <div class="group-avatar rounded-circle d-flex align-items-center justify-content-center me-3"
         style="width:55px; height:55px;" data-color="${gradientIndex}">
      ${initials}
    </div>
    <div class="flex-grow-1">
      <h6 class="mb-1 fw-bold">${safe(g.title)}</h6>
      <small class="text-muted">👑 ${g.owner_username || "Unknown"}</small><br>
      <small class="text-muted">👥 ${participants}</small><br>
      <small class="text-muted">💰 ${recent}</small>
    </div>
    <div class="text-end">
      <div class="text-muted fw-bold mb-2">${g.currency || ""}</div>
      <button class="btn btn-sm btn-outline-primary mb-1" onclick="openGroup(${g.id})">Open</button><br>
      <button class="btn btn-sm btn-outline-warning mb-1" onclick="editGroup(${g.id})">Edit</button><br>
      <button class="btn btn-sm btn-outline-danger" onclick="deleteGroup(${g.id})">Delete</button>
    </div>
  </div>
`;

    container.appendChild(card);
  }
}


// helper to escape HTML
function safe(str) {
  return str ? str.replace(/[&<>"']/g, c => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  )) : "";
}

// ---------------------
// Create / Delete / Update / Open  Groups
// ---------------------

async function createGroup() {
  const t = localStorage.getItem("token");
  if (!t) return alert("Login required");
  const title = document.getElementById("groupTitle")?.value?.trim();
  const currency = document.getElementById("groupCurrency")?.value || "MAD";
  const type = document.getElementById("groupType")?.value || "Other";
  // selected friends checkboxes (friend_{id})
  const checks = document.querySelectorAll("#friendsTable input[type=checkbox]:checked");
  const member_ids = Array.from(checks).map(c => parseInt(c.value));
  if (!title) return alert("Group title required");
  const res = await fetch(`${API_URL}/groups`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
    body: JSON.stringify({ title, currency, type, member_ids })
  });
  if (!res.ok) {
    const e = await res.json().catch(() => null);
    return alert(e?.detail || "Failed to create group");
  }
  const g = await res.json();
  window.location.href = `expenses.html?id=${g.id}`;
}

function openGroup(id) { window.location.href = `expenses.html?id=${id}`; }


async function editGroup(newName, newCurrency) {
  if (!newName && !newCurrency) {
    alert("Provide a new name or currency");
    return;
  }

  const payload = {};
  if (newName) payload.name = newName;
  if (newCurrency) payload.currency = newCurrency;

  const res = await fetch(`${API_URL}/groups/${groupId}`, {
    method: "PUT",
    headers: {
      "Authorization": "Bearer " + token,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (res.ok) {
    const updatedGroup = await res.json();
    alert(`Group updated: ${updatedGroup.name} (${updatedGroup.currency})`);
    loadGroupDetails(); // optional: reload group info
  } else {
    const err = await res.json();
    console.error("Update failed:", err);
    alert("Failed to update group: " + JSON.stringify(err));
  }
}

async function deleteGroup(groupId) {
  if (!groupId) return;

  if (!confirm("Are you sure you want to delete this group?")) return;

  const res = await fetch(`${API_URL}/groups/${groupId}`, {
    method: "DELETE",
    headers: { "Authorization": "Bearer " + token }
  });

  if (res.ok) {
    //alert("Group deleted successfully");
    renderGroupsMobileCards();
    loadGroupsForExpense();
 // reload table
  } else {
    const err = await res.json();
    alert("Failed to delete group: " + JSON.stringify(err));
  }

}

// Load groups into the select
async function loadGroupsForExpense() {
  try {
    const res = await fetch(`${API_URL}/groups`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    const groups = await res.json();
    const select = document.getElementById("groupsListForExpenses");
    select.innerHTML = '<option value="">-- Select a group --</option>';
    groups.forEach(g => {
      const opt = document.createElement("option");
      opt.value = g.id;
      opt.textContent = g.title;
      select.appendChild(opt);
    });

    // Listen for selection change
    select.addEventListener("change", async (e) => {
      const groupId = e.target.value;
      if (groupId) {
        await loadMembersForGroup(groupId);
      } else {
        document.getElementById("friendsListAddExpense").innerHTML = "";
      }
    });

  } catch (err) {
    console.error("Failed to load groups:", err);
  }
}

// Load members for the selected group
async function loadMembersForGroup(groupId) {
  try {
    const res = await fetch(`${API_URL}/groups/${groupId}/members`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    if (!res.ok) throw new Error("Failed to fetch members");
    const members = await res.json();

    const membersContainer = document.getElementById("membersListForGroups");
    membersContainer.innerHTML = "";
    members.forEach(m => {
      const div = document.createElement("div");
      div.className = "form-check";
      div.innerHTML = `
        <input class="form-check-input" type="checkbox" value="${m.user_id}" id="member_${m.user_id}">
        <label class="form-check-label" for="member_${m.user_id}">${m.username || m.user_id}</label>
      `;
      membersContainer.appendChild(div);
    });

  } catch (err) {
    console.error(err);
  }
}




document.addEventListener("DOMContentLoaded", () => {
  // populate friends list for create group if element exists
  if (document.getElementById("friendsTable")) loadFriendsCheckboxes("friendsTable");
  if (document.getElementById("friendsList")) loadFriendsCheckboxes("friendsList");
  // render groups table
  if (document.getElementById("groupsTable")) renderGroupsList();
  if (document.getElementById("groupsMobileCards")) renderGroupsMobileCards();
  if (document.getElementById("groupsListForExpenses")) loadGroupsForExpense();
  
});







