document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("economeForm");
  const systemSelect = document.getElementById("system");
  const resultBox = document.getElementById("resultBox");
  const resultBody = document.getElementById("resultBody");
  const totalCell = document.getElementById("totalCell");

  try {
    const res = await fetch(`${API_URL}/econome/systems`);
    if (!res.ok) throw new Error("API not reachable");
    const systems = await res.json();

    for (const sysName in systems) {
      const option = document.createElement("option");
      option.value = sysName;
      option.textContent = sysName;
      systemSelect.appendChild(option);
    }
  } catch (err) {
    console.error("Failed to load systems", err);
    alert("❌ Could not load systems from API");
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    try {
      const res = await fetch(`${API_URL}/econome/calculate`, {
        method: "POST",
        body: formData
      });

      const data = await res.json();
      if (data.error) {
        alert(data.error);
        return;
      }

      resultBody.innerHTML = "";
      Object.entries(data).forEach(([key, val]) => {
        if (key !== "Total") {
          resultBody.insertAdjacentHTML(
            "beforeend",
            `<tr><td>${key}</td><td>${val.toFixed(2)}</td></tr>`
          );
        }
      });

      totalCell.textContent = data.Total.toFixed(2);
      resultBox.classList.remove("d-none");
    } catch (err) {
      console.error(err);
      alert("❌ API error");
    }
  });
});