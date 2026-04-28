// frontend/js/auth.js
// Requires config.js (global API_URL, token)
//C:\Users\samir\Desktop\coding\python\SplitEasy\.venv\Scripts\activate.bat
//C:\Users\samir\Desktop\coding\python\SplitEasy\.venv\Scripts\savegit.bat
async function loginUser() {
  const data = new URLSearchParams();
  data.append("username", document.getElementById("loginUsername").value.trim());
  data.append("password", document.getElementById("loginPassword").value);

  try {
    const res = await fetch(`${API_URL}/auth/login`, { method: "POST", body: data });
    if (!res.ok) {
      const err = await res.json().catch(()=>null);
      alert(err?.detail || "Login failed");
      return;
    }
    const json = await res.json();
    token = json.access_token;
    localStorage.setItem("token", token);
    // fetch current user and save minimal info for UI convenience
    const cur = await fetchCurrentUser();
    if (cur) localStorage.setItem("currentUser", JSON.stringify(cur));
    window.location.href = "home.html";
  } catch (e) {
    console.error(e);
    alert("Network error");
  }
}

async function registerUser() {
  try {
    const body = {
      username: document.getElementById("username")?.value.trim(),
      email: document.getElementById("email")?.value.trim(),
      password: document.getElementById("password")?.value
    };
    const res = await fetch(`${API_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const err = await res.json().catch(()=>null);
      alert(err?.detail || "Register failed");
      return;
    }
    alert("Registered — please log in");
    window.location.href = "login.html";
  } catch (e) {
    //console.error(e);
    alert("Network error");
  }
}

