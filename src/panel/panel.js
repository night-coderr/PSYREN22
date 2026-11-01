const state = { page: null, pendingAction: null, history: [] };

const $ = (selector) => document.querySelector(selector);
const screens = { home: $("#home"), chat: $("#chat") };

function showScreen(name) {
  Object.values(screens).forEach((screen) => screen.classList.remove("active"));
  screens[name].classList.add("active");
  if (name === "chat") $("#prompt").focus();
}

function toast(message) {
  const element = $("#toast");
  element.textContent = message;
  element.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove("show"), 2200);
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function getPage() {
  $("#pageStatus").textContent = "Reading current page…";
  try {
    const tab = await activeTab();
    if (!tab?.id) throw new Error("No active tab");
    state.page = await chrome.tabs.sendMessage(tab.id, { type: "GET_PAGE_CONTEXT" });
    $("#pageStatus").textContent = `${state.page.title || tab.title} · ${state.page.text.length.toLocaleString()} characters`;
  } catch (error) {
    state.page = { title: "Page unavailable", url: "", text: "", isYoutube: false };
    $("#pageStatus").textContent = "Open a regular webpage, then refresh";
  }
}

function addMessage(role, text) {
  const message = document.createElement("div");
  message.className = `message ${role}`;
  message.textContent = text;
  $("#messages").appendChild(message);
  $("#messages").scrollTop = $("#messages").scrollHeight;
  return message;
}

async function aiRequest(prompt, imageDataUrl = null) {
  const saved = await chrome.storage.local.get(["apiKey", "model"]);
  const apiKey = saved.apiKey || "";
  const model = saved.model?.startsWith("gemini-2.") ? "gemini-3.8-flash" : (saved.model || "gemini-3.8-flash");
  if (!apiKey) throw new Error("API key missing. Open Settings and add your free Gemini API key.");
  const isTranslation = /translate the following/i.test(prompt);
  const pageLimit = isTranslation ? 2500 : 12000;
  const pageContext = !isTranslation && state.page?.text ? `PAGE TITLE: ${state.page.title}\nPAGE URL: ${state.page.url}\nPAGE CONTENT:\n${state.page.text.slice(0, pageLimit)}` : "";
  const memoryResult = await chrome.storage.local.get("memory");
  const memory = memoryResult.memory?.length ? `REMEMBERED MEMORY:\n${memoryResult.memory.join("\n")}\n\n` : "";
  const parts = [];
  if (imageDataUrl) {
    parts.push({ inlineData: { mimeType: "image/png", data: imageDataUrl.split(",")[1] } });
  }
  const response = await chrome.runtime.sendMessage({
    type: "GEMINI_REQUEST",
    payload: { apiKey, model, prompt: `${memory}${pageContext}\n\nUSER REQUEST:\n${prompt}`, parts }
  });
  if (response?.error) throw new Error(response.error);
  return response.text;
}

async function runPrompt(prompt, options = {}) {
  showScreen("chat");
  addMessage("user", options.userLabel || prompt);
  const loading = addMessage("assistant loading", "PSYREN is thinking…");
  try {
    const answer = await aiRequest(prompt, options.imageDataUrl);
    loading.remove();
    addMessage("assistant", answer);
    state.history.push({ prompt, answer });
    await rememberFromAnswer(prompt, answer);
  } catch (error) {
    loading.textContent = error.message;
    loading.className = "message assistant";
  }
}

async function rememberFromAnswer(prompt, answer) {
  const result = await chrome.storage.local.get("memory");
  const memory = result.memory || [];
  if (/remember this|yaad rakh|remember:/i.test(prompt)) {
    const fact = prompt.replace(/remember this:?|yaad rakh:?|remember: ?/i, "").trim();
    if (fact && !memory.includes(fact)) memory.push(fact.slice(0, 500));
    await chrome.storage.local.set({ memory });
    toast("Saved to memory");
  }
  return answer;
}

async function summarize() {
  if (!state.page?.text) await getPage();
  await runPrompt("Summarize this webpage clearly in Hindi with English terms where useful. Include: main topic, key points, important details, and a one-line conclusion.");
}

async function summarizeYoutube() {
  if (!state.page?.isYoutube) {
    showScreen("chat");
    addMessage("assistant", "YouTube summary works on an open YouTube video. Video captions may be unavailable in restricted videos.");
    return;
  }
  await runPrompt("Summarize this YouTube video using the available page transcript/context. Include topic, chapters, key moments, and actionable takeaways.");
}

async function translate() {
  let text = state.page?.selectedText?.trim();
  if (!text) {
    showScreen("chat");
    addMessage("assistant", "Translate करने के लिए पहले webpage पर English text select करें, फिर Translate button दबाएं। PSYREN अब whole page नहीं भेजेगा, इसलिए address, footer या Terms text नहीं आएंगे.");
    return;
  }
  if (text.length > 2500) {
    text = text.slice(0, 2500);
  }
  await runPrompt(`Translate the following English text naturally into conversational Hinglish. Keep technical terms in English and preserve meaning:\n\n${text || "No readable English text found on this page."}`);
}

async function captureScreenshot() {
  showScreen("chat");
  const loading = addMessage("assistant loading", "Capturing the visible screen…");
  const response = await chrome.runtime.sendMessage({ type: "CAPTURE_SCREENSHOT" });
  if (response.error) {
    loading.textContent = response.error;
    loading.className = "message assistant";
    return;
  }
  loading.remove();
  $("#attachment").innerHTML = `<span>Screenshot attached</span>`;
  $("#attachment").classList.remove("hidden");
  $("#attachment").dataset.image = response.dataUrl;
  await runPrompt("Analyze this screenshot. Describe what is visible, identify important text and UI elements, detect possible errors, and suggest useful next actions.", { userLabel: "Analyze my screenshot", imageDataUrl: response.dataUrl });
  $("#attachment").classList.add("hidden");
}

async function submitPrompt() {
  const prompt = $("#prompt").value.trim();
  if (!prompt) return;
  $("#prompt").value = "";
  if (/remember (this|that)|yaad rakh/i.test(prompt)) {
    await runPrompt(prompt);
    return;
  }
  const actionMatch = prompt.match(/\b(click|type|scroll|focus)\b/i);
  if (actionMatch && /click|type|scroll/i.test(prompt)) {
    addAgentSuggestion(prompt);
    return;
  }
  await runPrompt(prompt, { imageDataUrl: $("#attachment").dataset.image || null });
}

function addAgentSuggestion(prompt) {
  const lower = prompt.toLowerCase();
  let action;
  if (lower.includes("scroll to top")) action = { type: "scroll", direction: "top", description: "Scroll to the top of this page" };
  else if (lower.includes("scroll to bottom")) action = { type: "scroll", direction: "bottom", description: "Scroll to the bottom of this page" };
  else {
    const clickTarget = prompt.match(/click\s+(?:on\s+)?["']?([^"',.!]+)["']?/i)?.[1]?.trim();
    const typeMatch = prompt.match(/type\s+["']([^"']+)["']\s+(?:in|into)\s+["']?([^"',.!]+)["']?/i);
    action = typeMatch
      ? { type: "type", text: typeMatch[1], selector: typeMatch[2], description: `Type "${typeMatch[1]}" into "${typeMatch[2]}"` }
      : clickTarget ? { type: "click", selector: clickTarget, description: `Click "${clickTarget}"` } : null;
  }
  showScreen("chat");
  addMessage("user", prompt);
  if (!action) {
    addMessage("assistant", "I can prepare click, type, and scroll actions. Example: “click Sign in”, “type ‘hello world’ into search”, or “scroll to bottom”.");
    return;
  }
  state.pendingAction = action;
  $("#confirmText").textContent = `PSYREN wants to: ${action.description}. Allow?`;
  $("#confirmBox").classList.remove("hidden");
}

async function executePending(approved) {
  $("#confirmBox").classList.add("hidden");
  if (!approved) {
    state.pendingAction = null;
    toast("Action cancelled");
    return;
  }
  const tab = await activeTab();
  const response = await chrome.tabs.sendMessage(tab.id, { type: "EXECUTE_ACTION", action: state.pendingAction });
  state.pendingAction = null;
  addMessage("assistant", response.ok ? "Done. The page has been updated." : `Action stopped: ${response.error}`);
}

document.querySelectorAll("[data-action]").forEach((button) => {
  button.addEventListener("click", () => {
    ({ summary: summarize, youtube: summarizeYoutube, translate: translate, screenshot: captureScreenshot })[button.dataset.action]();
  });
});
$("#backHome").addEventListener("click", () => showScreen("home"));
$("#brand").addEventListener("click", () => showScreen("home"));
$("#openSettings").addEventListener("click", () => chrome.runtime.openOptionsPage());
$("#newChat").addEventListener("click", () => { $("#messages").replaceChildren(); showScreen("chat"); });
$("#refreshPage").addEventListener("click", getPage);
$("#send").addEventListener("click", submitPrompt);
$("#attachScreen").addEventListener("click", captureScreenshot);
$("#approveAction").addEventListener("click", () => executePending(true));
$("#denyAction").addEventListener("click", () => executePending(false));
$("#prompt").addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) { event.preventEventDefault?.(); event.preventDefault(); submitPrompt(); }
});

chrome.storage.local.get("requestedFeature").then((result) => {
  chrome.storage.local.remove("requestedFeature");
  if (result.requestedFeature === "summary") summarize();
});

getPage();
