
// Call it once to initialize when script loads
loadAuth();

const params = new URLSearchParams(window.location.search);
const groupId = params.get("id");

let balancesData = [];

async function loadBalances() {
  const container = document.querySelector("#balancesCards");
  container.innerHTML = `<div class="text-center text-muted">Loading...</div>`;

  try {
    const res = await fetch(`${API_URL}/settle/${groupId}/balances`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    balancesData = data;

    container.innerHTML = "";
    if (!data.length) {
      container.innerHTML = `<div class="text-center text-muted">No balances found</div>`;
      return;
    }

    data.forEach((b) => {
      const color =
        b.net > 0 ? "success" : b.net < 0 ? "danger" : "secondary";
      const icon =
        b.net > 0 ? "💰" : b.net < 0 ? "💸" : "⚖️";

      const card = document.createElement("div");
      card.className = "col-12 col-sm-6 col-md-4 col-lg-3";
      card.innerHTML = `
        <div class="card border-${color} balance-card shadow-sm h-100">
          <div class="card-body text-center">
            <h5 class="card-title">${b.username}</h5>
            <p class="card-text fw-bold text-${color}">
              ${icon} ${b.net.toFixed(2)} MAD
            </p>
          </div>
        </div>
      `;
      container.appendChild(card);
    });
  } catch (err) {
    console.error(err);
    container.innerHTML = `<div class="text-danger text-center">Error loading balances</div>`;
  }
}


async function loadSettlements() {
  const tbody = document.querySelector("#settlementsTable tbody");
  tbody.innerHTML = `<tr><td colspan="3" class="text-center text-muted">Loading...</td></tr>`;

  try {
    const res = await fetch(`${API_URL}/settle/${groupId}/settlements`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    tbody.innerHTML = "";
    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="3" class="text-center text-muted">No settlements needed 🎉</td></tr>`;
      return;
    }

    data.forEach(s => {
      const row = document.createElement("tr");
      row.innerHTML = `<td>${s.from_username}</td><td>${s.to_username}</td><td class="fw-bold">${s.amount.toFixed(2)}</td>`;
      tbody.appendChild(row);
    });
  } catch (err) {
    console.error(err);
    tbody.innerHTML = `<tr><td colspan="3" class="text-danger text-center">Error loading settlements</td></tr>`;
  }
}

async function loadHistory() {
  const tbody = document.querySelector("#historyTable tbody");
  tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">Loading...</td></tr>`;

  try {
    const res = await fetch(`${API_URL}/settle/${groupId}/history`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    tbody.innerHTML = "";
    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">No settlement history</td></tr>`;
      return;
    }

    data.forEach(s => {
      const row = document.createElement("tr");
      row.innerHTML = `<td>${s.from_username}</td><td>${s.to_username}</td><td>${s.amount.toFixed(2)}</td><td>${new Date(s.created_at).toLocaleString()}</td>`;
      tbody.appendChild(row);
    });
  } catch (err) {
    console.error(err);
    tbody.innerHTML = `<tr><td colspan="4" class="text-danger text-center">Error loading history</td></tr>`;
  }
}

async function loadcurrntuser() {
   const cur = await fetchCurrentUser();
currentUser =cur;
 
}

  const select = document.getElementById("toUserSelect");
  const amountInput = document.getElementById("settleAmount");




function openSettlementModal() {
  if (!balancesData || !currentUser) {
    alert("User data missing — please re-login");
    return;
  }


  select.innerHTML = "";
  amountInput.value = "";

  // ✅ Get current user's balance
  const myBalance = balancesData.find(b => b.user_id === currentUser.id);
  if (!myBalance) {
    alert("Your balance info is missing");
    return;
  }

  // ✅ User owes money (negative balance)
  if (myBalance.net < 0) {
    // We only show users who are owed money (net > 0)
    const creditors = balancesData.filter(b => b.net > 0 && b.user_id !== currentUser.id);

    if (creditors.length === 0) {
      const option = document.createElement("option");
      option.textContent = "No users to settle with";
      option.disabled = true;
      option.selected = true;
      select.appendChild(option);
    } else {
      creditors.forEach(b => {
        // ⚖️ Calculate how much the current user owes this creditor
        const myDebt = Math.min(Math.abs(myBalance.net), b.net);
        const option = document.createElement("option");
        option.value = b.user_id;
        option.textContent = `${b.username} (-${myDebt.toFixed(2)} MAD)`;
        option.dataset.amount = myDebt.toFixed(2); // save value for autofill
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



  // ✅ Auto-fill the amount field when user selects someone
  select.addEventListener("change", () => {
    const selected = select.options[select.selectedIndex];
    amountInput.value = selected.dataset.amount || "";
  });
  
  // ✅ Open modal
  const modal = new bootstrap.Modal(document.getElementById("recordSettlementModal"));
  modal.show();

  // ✅ Form submission
  const form = document.getElementById("settlementForm");
  form.onsubmit = async e => {
    e.preventDefault();

    const payload = {
      to_user_id: parseInt(select.value),
      amount: parseFloat(amountInput.value),
    };

    const res = await fetch(`${API_URL}/settle/${groupId}/record`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      alert("✅ Settlement recorded!");
      modal.hide();
      await Promise.all([loadBalances(), loadSettlements(), loadHistory()]);
    } else {
      const err = await res.json();
      alert(`❌ ${err.detail || "Error recording settlement"}`);
    }
  };
}


document.addEventListener("DOMContentLoaded", async () => {
  await loadcurrntuser(); // wait for user to load
  await loadBalances();
  await loadSettlements();
  await loadHistory();

  document.getElementById("routerToExpenses").addEventListener("click", () => {
    window.location.href = `expenses.html?id=${groupId}`;
  });
  document.getElementById("recordBtn").addEventListener("click", openSettlementModal);
});

