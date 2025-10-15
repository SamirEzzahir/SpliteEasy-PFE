loadAuth();
const groupTableBody = document.querySelector("#groupTable tbody");
const totalExpenses = document.getElementById("totalExpenses");
const fromDate = document.getElementById("fromDate");
const toDate = document.getElementById("toDate");
const applyFilterBtn = document.getElementById("applyFilter");



 

// Fetch with auth
async function fetchWithAuth(url) {
  const res = await fetch(url, { headers: getHeaders() });
  if (!res.ok) throw new Error(`Failed to fetch ${url} (${res.status})`);
  return res.json();
}

// Filter by date
function filterByDate(data, from, to) {
  if (!from && !to) return data;
  const fromDateObj = from ? new Date(from) : null;
  const toDateObj = to ? new Date(to) : null;
  return data.filter((item) => {
    const date = new Date(item.date);
    if (fromDateObj && date < fromDateObj) return false;
    if (toDateObj && date > toDateObj) return false;
    return true;
  });
}

// Render group stats
function renderGroupStats(groups) {
  groupTableBody.innerHTML = "";
  if (!groups.length) {
    groupTableBody.innerHTML = `<tr><td colspan="2" class="text-center text-muted">No data</td></tr>`;
    return;
  }
  groups.forEach((g) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${g.group_name}</td>
      <td>${g.amount.toFixed(2)}</td>
    `;
    groupTableBody.appendChild(tr);
  });
}




// Render daily chart
function renderDailyChart(data) {
  const ctx = document.getElementById("dailyChart").getContext("2d");
  const labels = data.map((d) => d.date);
  const values = data.map((d) => d.amount);

  // Only destroy if dailyChart is a Chart instance
  if (dailyChart instanceof Chart) {
    dailyChart.destroy();
  }

  dailyChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Daily Expenses",
        data: values,
        borderColor: "#007bff",
        backgroundColor: "rgba(0,123,255,0.2)",
        fill: true,
        tension: 0.3,
      }],
    },
    options: {
      responsive: true,
      scales: {
        y: { beginAtZero: true },
      },
    },
  });
}

 

 



// Load stats
async function loadStats() {
  try {

const from = fromDate.value; // e.g., "2025-10-12"
const to = toDate.value;     // e.g., "2025-10-14"

// Build URL with query parameters if dates are set
let groupUrl = `${API_URL}/stats/user/groups`;
const params = new URLSearchParams();
if (from) params.append("from_date", from);
if (to) params.append("to_date", to);
if (params.toString()) groupUrl += `?${params.toString()}`;


    const [userStats, groupStats, dailyStats] = await Promise.all([
      fetchWithAuth(`${API_URL}/stats/user`),
      fetchWithAuth(groupUrl), // <-- filtered by backend
      fetchWithAuth(`${API_URL}/stats/user/daily`)
    ]);

    // Update total expenses
    const filteredDaily = filterByDate(dailyStats, fromDate.value, toDate.value);
    totalExpenses.innerText = filteredDaily.reduce((sum, d) => sum + d.amount, 0).toFixed(2);

    // Render group totals
    renderGroupStats(groupStats);  // <-- already sums per group in backend

    // Render daily chart
    renderDailyChart(filteredDaily);

    console.log("✅ Stats loaded", { userStats, groupStats, dailyStats });
  } catch (err) {
    console.error("❌ Error loading stats:", err);
    alert("Failed to load statistics. See console for details.");
  }
}


// Apply filter button
applyFilterBtn.addEventListener("click", loadStats);

// Initial load
loadStats();

 
