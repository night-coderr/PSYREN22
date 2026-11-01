async function load() {
  const settings = await chrome.storage.local.get(["apiKey", "model", "memory"]);
  $("#apiKey").value = settings.apiKey || "";
  $("#model").value = settings.model?.startsWith("gemini-2.") ? "gemini-3.8-flash" : (settings.model || "gemini-3.8-flash");
  renderMemory(settings.memory || []);
}
function $(selector) { return document.querySelector(selector); }
function renderMemory(memory) {
  $("#memoryCount").textContent = `${memory.length} item${memory.length === 1 ? "" : "s"}`;
  $("#memoryList").replaceChildren();
  memory.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "memory-item";
    row.innerHTML = `<span></span><button aria-label="Delete memory">×</button>`;
    row.querySelector("span").textContent = item;
    row.querySelector("button").addEventListener("click", async () => {
      memory.splice(index, 1);
      await chrome.storage.local.set({ memory });
      renderMemory(memory);
    });
    $("#memoryList").appendChild(row);
  });
}
$("#toggleKey").addEventListener("click", () => {
  const input = $("#apiKey");
  input.type = input.type === "password" ? "text" : "password";
  $("#toggleKey").textContent = input.type === "password" ? "Show" : "Hide";
});
$("#save").addEventListener("click", async () => {
  await chrome.storage.local.set({ apiKey: $("#apiKey").value.trim(), model: $("#model").value });
  $("#saved").style.opacity = "1";
  setTimeout(() => $("#saved").style.opacity = "0", 1600);
});
$("#clearMemory").addEventListener("click", async () => {
  await chrome.storage.local.set({ memory: [] });
  renderMemory([]);
});
load();
