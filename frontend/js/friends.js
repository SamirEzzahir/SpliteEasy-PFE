// WebSocket for notifications
loadAuth();
let ws;
function initNotifications(userId) {
    ws = new WebSocket(`${API_URL.replace("http", "ws")}/Notifications/ws/${userId}`);
    ws.onmessage = (event) => {
        showToast(event.data, "info");
        loadFriends(); // refresh lists when needed
    };
}

// Show Bootstrap toast notification
function showToast(message, type = "primary") {
    const container = document.getElementById("toastContainer");
    const toastEl = document.createElement("div");
    toastEl.className = `toast align-items-center text-bg-${type} border-0`;
    toastEl.setAttribute("role", "alert");
    toastEl.setAttribute("aria-live", "assertive");
    toastEl.setAttribute("aria-atomic", "true");
    toastEl.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">${message}</div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
    `;
    container.appendChild(toastEl);
    const toast = new bootstrap.Toast(toastEl, { delay: 4000 });
    toast.show();
    toastEl.addEventListener("hidden.bs.toast", () => toastEl.remove());
}

// Search friends by username, email, or phone
async function searchFriend() {
    const query = document.getElementById("friendSearch").value.trim();
    const t = localStorage.getItem("token");
    if (!query) return;
    const res = await fetch(`${API_URL}/friends/search?query=${query}`, {
        headers: { Authorization: `Bearer ${t}` }
    });
    const results = res.ok ? await res.json() : [];
    const ul = document.getElementById("searchResults");
    ul.innerHTML = "";
    results.forEach(u => {
        const li = newLI(`${u.username || u.email || u.phone}`);
        const btnAdd = btn("Add", () => sendFriendRequest(u.id));
        li.appendChild(btnAdd);
        ul.appendChild(li);
    });
}

// Send friend request
async function sendFriendRequest(friendId) {
    const t = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/friends/request/${friendId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${t}` }
    });
    if (!res.ok) {
        const e = await res.json().catch(() => null);
        return showToast(e?.detail || "Failed to send request", "danger");
    }
    showToast("Friend request sent", "success");
    loadFriends();
}

// Remove friend
async function removeFriend(friendshipId) {
    if (!friendshipId) return showToast("Invalid friend ID", "danger");
    if (!confirm("Are you sure you want to remove this friend?")) return;
    const t = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/friends/remove/${friendshipId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${t}` }
    });
    if (!res.ok) {
        const e = await res.json().catch(() => null);
        return showToast(e?.detail || "Failed to remove friend", "danger");
    }
    showToast("Friend removed", "warning");
    loadFriends();
}

// Load all friend lists
async function loadFriends() {
    const t = localStorage.getItem("token");
    if (!t) return;

    // My friends
    let res = await fetch(`${API_URL}/friends/my`, { headers: { Authorization: `Bearer ${t}` }});
    const myFriends = res.ok ? await res.json() : [];
    const ul1 = document.getElementById("myFriends");
    ul1.innerHTML = "";
    myFriends.forEach(f => {
        const li = newLI(`${f.username || f.email || f.phone || f.user_id}`);
        const btnRemove = btn("Remove", () => removeFriend(f.friendship_id), "danger");
        li.appendChild(btnRemove);
        ul1.appendChild(li);
    });

    // Requests received
    res = await fetch(`${API_URL}/friends/requests/received`, { headers: { Authorization: `Bearer ${t}` }});
    const received = res.ok ? await res.json() : [];
    const ul2 = document.getElementById("requestsReceived");
    ul2.innerHTML = "";
    received.forEach(r => {
        const li = newLI(`${r.username || r.email || r.phone || r.user_email}`);
        const btnAccept = btn("Accept", () => respondRequest(r.id, true));
        const btnReject = btn("Reject", () => respondRequest(r.id, false), "danger");
        li.appendChild(btnAccept);
        li.appendChild(btnReject);
        ul2.appendChild(li);
    });

    // Requests sent
    res = await fetch(`${API_URL}/friends/requests/sent`, { headers: { Authorization: `Bearer ${t}` }});
    const sent = res.ok ? await res.json() : [];
    const ul3 = document.getElementById("requestsSent");
    ul3.innerHTML = "";
    sent.forEach(r => {
        const li = newLI(`${r.username || r.friend_email || r.phone}`);
        ul3.appendChild(li);
    });
}

// Respond to request
async function respondRequest(requestId, accept) {
    const t = localStorage.getItem("token");
    const url = `${API_URL}/friends/request/${requestId}/${accept ? "accept" : "reject"}`;
    const res = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${t}` }});
    if (!res.ok) {
        const e = await res.json().catch(() => null);
        return showToast(e?.detail || "Failed", "danger");
    }
    showToast(accept ? "Friend request accepted" : "Friend request rejected", accept ? "success" : "warning");
    loadFriends();
}

// Helpers
function newLI(text) {
    const li = document.createElement("li");
    li.className = "list-group-item d-flex justify-content-between align-items-center";
    li.textContent = text;
    return li;
}
function btn(text, fn, type="success") {
    const b = document.createElement("button");
    b.className = `btn btn-sm btn-${type} ms-2`;
    b.textContent = text;
    b.onclick = fn;
    return b;
}

// Initialize
document.addEventListener("DOMContentLoaded", () => {
    const userId = localStorage.getItem("user_id");
    if (userId) initNotifications(userId);
    loadFriends();
    document.getElementById("friendSearchBtn")?.addEventListener("click", searchFriend);
});
