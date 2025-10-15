// frontend/js/navbar.js
// Inserts desktop + mobile nav markup and wires logout
loadAuth();
function buildNavHTML() {
  return `
<!-- ✅ Responsive Navbar -->
<nav class="navbar navbar-expand-lg navbar-dark bg-dark">
  <div class="container-fluid">
    <!-- Brand -->
    <a class="navbar-brand" href="index.html">
      <i class="bi bi-cash-stack"></i> SplitApp
    </a>

    <!-- Toggler button -->
    <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav"
      aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
      <span class="navbar-toggler-icon"></span>
    </button>

    <!-- Collapsible content -->
    <div class="collapse navbar-collapse" id="navbarNav">
      <!-- Left links -->
      <ul class="navbar-nav me-auto">
        <li class="nav-item"><a class="nav-link" href="Home.html"><i class="bi bi-house-door"></i> Home</a></li>
        <li class="nav-item"><a class="nav-link" href="groups.html"><i class="bi bi-people"></i> Groups</a></li>
        
        <li class="nav-item"><a class="nav-link" href="stats.html"><i class="bi bi-bar-chart-line"></i> Statistics</a></li>
        <li class="nav-item"><a class="nav-link" href="overview.html"><i class="bi bi-bar-chart-line"></i> Overview</a></li>
         <li class="nav-item"><a class="nav-link" href="test.html"><i class="bi bi-bar-chart-line"></i> test</a></li>
      </ul>

      <!-- Right side -->
      <ul class="navbar-nav">
        <li class="nav-item">
          <span class="nav-link">
             Welcome, <a href="account.html" id="currentUserNav" class="text-white fw-bold text-decoration-none"></a>
          </span>
        </li>
        <li class="nav-item">
          <button class="btn btn-outline-danger ms-2" id="logoutBtnHeader">
            <i class="bi bi-box-arrow-right"></i> Logout
          </button>
        </li>
      </ul>
    </div>
  </div>
</nav>`;
}

function buildMobileNavHTML() {
  return `
<!-- Bottom nav (mobile) -->
    <nav class="navbar fixed-bottom navbar-light bg-white border-top d-md-none">
      <div class="container-fluid d-flex justify-content-around">
         <a class="nav-link text-center" href="Home.html"><i class="bi bi-house-door"></i>
          <div class="small">Home</div>
        </a>
        <a class="nav-link text-center" href="groups.html"><i class="bi bi-people"></i>
          <div class="small">Groups</div>
        </a>
        <a class="nav-link text-center" href="friends.html"><i class="bi bi-person"></i>
          <div class="small">Friends</div>
        </a>
        <a class="nav-link text-center" href="stats.html"><i class="bi bi-list-task"></i>
          <div class="small">stats</div>
        </a>
        <a class="nav-link text-center" href="overview.html"><i class="bi bi-bar-chart-line"></i>
          <div class="small">overview</div>
        </a>
        <a class="nav-link text-center" href="account.html"><i class="bi bi-person-circle"></i>
          <div class="small">Account</div>
        </a>
      </div>
    </nav>`;
}

function attachNavbar() {
  const nav = document.getElementById("navbar");
  if (nav) nav.innerHTML = buildNavHTML();
  const navMobile = document.getElementById("navbarMobile");
  if (navMobile) navMobile.innerHTML = buildMobileNavHTML();

  // Insert current user name
  const cur = JSON.parse(localStorage.getItem("currentUser") || "null");
  if (cur && cur.username) {
    const el = document.getElementById("currentUserNav");
    const elh = document.getElementById("currentUserHome");
    if (el) el.textContent = cur.username;
    if (elh) elh.textContent = cur.username
  }




  // Logout
  const logoutBtn = document.getElementById("logoutBtnHeader");
  if (logoutBtn) logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("token");
    localStorage.removeItem("currentUser");
    window.location.href = "index.html";
  });
}

document.addEventListener("DOMContentLoaded", attachNavbar);


//<li class="nav-item"><a class="nav-link" href="expenses.html"><i class="bi bi-wallet2"></i> Expenses</a></li>
        //<li class="nav-item"><a class="nav-link" href="balances.html"><i class="bi bi-graph-up"></i> Balances</a></li>