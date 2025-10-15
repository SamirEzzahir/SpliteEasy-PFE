// frontend/js/account.js
loadAuth();

async function loadAccount() {
    const token = localStorage.getItem("token");
    if (!token) return window.location.href = "login.html";

    try {
        const res = await fetch(`${API_URL}/users/user/me`, {
            headers: getHeaders()
        });
        if (!res.ok) throw new Error("Failed to load user");

        const user = await res.json();
        window.currentUserId = user.id;
        localStorage.setItem("currentUser", JSON.stringify(user));

        // Profile card
        document.getElementById("profileName").textContent = user.first_name + " " + user.last_name || user.username;
        document.getElementById("profileEmail").textContent = user.email || "";
        document.getElementById("profilePhone").textContent = user.phone || "";
        document.getElementById("profilePhoto").src = user.profile_photo || "https://via.placeholder.com/80";

        // Modal form
        document.getElementById("modal_username").value = user.username || "";
        document.getElementById("modal_first_name").value = user.first_name || "";
        document.getElementById("modal_last_name").value = user.last_name || "";
        document.getElementById("modal_gender").value = user.gender || "";
        document.getElementById("modal_email").value = user.email || "";
        document.getElementById("modal_phone").value = user.phone || "";
        document.getElementById("modal_profile_photo").value = user.profile_photo || "";
        document.getElementById("modalPhotoPreview").src = user.profile_photo || "https://via.placeholder.com/80";

    } catch (err) {
        console.error(err);
        alert("Failed to load account.");
    }
}

// Live photo preview for URL only
document.getElementById("modal_profile_photo").addEventListener("input", (e) => {
    document.getElementById("modalPhotoPreview").src = e.target.value || "https://via.placeholder.com/80";
});

// Update account
document.getElementById("modalAccountForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
        username: document.getElementById("modal_username").value,
        first_name: document.getElementById("modal_first_name").value,
        last_name: document.getElementById("modal_last_name").value,
        email: document.getElementById("modal_email").value,
        phone: document.getElementById("modal_phone").value,
        gender: document.getElementById("modal_gender").value || null,
        profile_photo: document.getElementById("modal_profile_photo").value || null
    };
    try {
        const res = await fetch(`${API_URL}/users/${window.currentUserId}`, {
            method: "PUT",
            headers: getHeaders(),
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error("Failed to update account");
        const updated = await res.json();
        alert("Profile updated!");
        localStorage.setItem("currentUser", JSON.stringify(updated));
        loadAccount();
        bootstrap.Modal.getInstance(document.getElementById("editProfileModal")).hide();
    } catch (err) {
        console.error(err);
        alert("Error updating account");
    }
});

// Deactivate account
document.getElementById("modalDeleteBtn").addEventListener("click", async () => {
    if (!confirm("Are you sure you want to deactivate your account?")) return;
    try {
        const res = await fetch(`${API_URL}/users/${window.currentUserId}`, {
            method: "DELETE",
            headers: getHeaders()
        });
        if (!res.ok) throw new Error("Failed to deactivate account");
        alert("Account deactivated.");
        localStorage.clear();
        window.location.href = "login.html";
    } catch (err) {
        console.error(err);
        alert("Error deactivating account");
    }
});

  // Logout
  const logoutBtn = document.getElementById("logoutBtnAccount");
  if (logoutBtn) logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("token");
    localStorage.removeItem("currentUser");
    window.location.href = "index.html";
  });
 


document.addEventListener("DOMContentLoaded", loadAccount);


async function loadActivity() {
  try {
    const response = await fetch(`${API_URL}/activity`, {
      headers: getHeaders()
    });

    if (!response.ok) {
      console.error("Failed to fetch activities:", response.status);
      return;
    }

    const logs = await response.json();

    if (!Array.isArray(logs)) {
      console.error("Expected logs to be an array", logs);
      return;
    }

    const ul = document.getElementById("activityList");
    if (!ul) {
      console.error("Element #activityList not found in DOM");
      return;
    }

    ul.innerHTML = "";

    if (logs.length === 0) {
      ul.innerHTML = `<li class="list-group-item text-center text-muted">No recent activities</li>`;
      return;
    }

   logs.forEach(log => {
  const li = document.createElement("li");
  li.className = "list-group-item d-flex justify-content-between align-items-center";

  const date = new Date(log.created_at);
  const formattedDate = isNaN(date.getTime()) ? "Unknown date" : date.toLocaleString();

  li.innerHTML = `
    <div>
      <strong>${log.username}</strong> ${log.action}
      <br><small class="text-muted">${formattedDate}</small>
    </div>
    <span class="badge bg-light text-dark">${log.target_type || ""}</span>
  `;

  ul.appendChild(li);
});


  } catch (err) {
    console.error("Failed to load activity:", err);
  }
}

// Auto-load when page ready
document.addEventListener("DOMContentLoaded", () => {
  loadActivity();
});
