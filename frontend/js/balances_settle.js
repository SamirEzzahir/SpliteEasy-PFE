//frontend\js\Balances.js
const params = new URLSearchParams(window.location.search);
const groupId = params.get("id");
//frontend\js\Balances.js

async function loadBalances() {
  try {
    const res = await fetch(`${API_URL}/settle/${groupId}/balances`, {
      headers: { "Authorization": "Bearer " + token }
    });
    const data = await res.json();
    const table = document.querySelector("#balancesTable tbody");
    table.innerHTML = "";

    if (data.length === 0) {
      table.innerHTML = `<tr><td colspan="2" class="text-center text-muted">No balances found</td></tr>`;
      return;
    }

    data.forEach(b => {
      const row = document.createElement("tr");
      const balanceClass = b.net > 0 ? "text-success fw-bold" : (b.net < 0 ? "text-danger fw-bold" : "text-muted");
      row.innerHTML = `
        <td>${b.username}</td>
        <td class="${balanceClass}">${b.net}</td>
        
      `;
      table.appendChild(row);
    });
  } catch (error) {
    console.error("Error loading balances:", error);
  }
}

 // Example logout logic
    document.getElementById("routerToExpenses").addEventListener("click", () => {
      window.location.href = `expenses.html?id=${groupId}`;
    });

 

async function loadSettlements() {
  try {
    const res = await fetch(`${API_URL}/settle/${groupId}/settlements`, {
      headers: { "Authorization": "Bearer " + token }
    });
    const data = await res.json();
    const table = document.querySelector("#settlementsTable tbody");
    table.innerHTML = "";

    if (data.length === 0) {
      table.innerHTML = `<tr><td colspan="3" class="text-center text-muted">No settlements needed 🎉</td></tr>`;
      return;
    }
 
    data.forEach(s => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${s.from_username}</td>
        <td>${s.to_username}</td>
        <td>${s.amount}</td>
      `;
      table.appendChild(row);
    });
  } catch (error) {
    console.error("Error loading settlements:", error);
  }
}

// Charger au démarrage
document.addEventListener("DOMContentLoaded", () => {
  loadBalances();
  loadSettlements();
});


