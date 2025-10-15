// frontend/js/config.js
const API_URL = "http://pcrox.ddns.net:8000";
// const API_URL = "http://192.168.1.3:8004"; // local option

// -------------------------
// AUTH STATE MANAGEMENT
// -------------------------
let token = null;
let currentUser = null;

// ✅ Load from localStorage safely
function loadAuth() {
  try {
    token = localStorage.getItem("token") || null;
    const u = localStorage.getItem("user");
    currentUser = u ? JSON.parse(u) : null; 
  } catch (err) {
    console.warn("⚠️ Could not parse user:", err);
    currentUser = null;
  }
}

// ✅ Save functions
function setToken(t) {
  token = t;
  if (t) localStorage.setItem("token", t);
  else localStorage.removeItem("token");
}

function setUser(u) {
  currentUser = u;
  if (u) localStorage.setItem("user", JSON.stringify(u));
  else localStorage.removeItem("user");
}

// ✅ Get headers
function getHeaders(json = true) {
  const h = {};
  if (json) h["Content-Type"] = "application/json";
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

// ✅ Check login (safe)
function checkLogin(redirect = true) {
  loadAuth();


  
  // small delay to avoid redirect loop during DOM load
  if (!token || !currentUser || !currentUser.id) {
    console.warn("🔒 Not authenticated");
    if (redirect) {
      setTimeout(() => {
        window.location.href = "login.html";
      }, 200);
    }
    return false;
  }

  // ✅ all good
  return true;
}
