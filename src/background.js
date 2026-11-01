chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === "open-psyren") {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) chrome.sidePanel.open({ tabId: tab.id });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GEMINI_REQUEST") {
    geminiRequest(message.payload).then(sendResponse).catch((error) => sendResponse({ error: error.message }));
    return true;
  }
  if (message.type === "CAPTURE_SCREENSHOT") {
    chrome.tabs.captureVisibleTab(null, { format: "png" }).then((dataUrl) => sendResponse({ dataUrl })).catch((error) => sendResponse({ error: error.message }));
    return true;
  }
});

async function geminiRequest({ apiKey, model, prompt, parts = [], temperature = 0.7 }) {
  if (!apiKey) throw new Error("Gemini API key missing. Add it in PSYREN Settings.");
  const body = {
    systemInstruction: { parts: [{ text: "You are PSYREN, a concise, helpful browser AI assistant. Answer accurately in the user's language. If uncertain, say so." }] },
    contents: [{ role: "user", parts: [{ text: prompt }, ...parts].filter((part) => part.text !== undefined || part.inlineData !== undefined) }],
    generationConfig: { temperature, maxOutputTokens: 2048 }
  };
  const selectedModel = model?.startsWith("gemini-2.") ? "gemini-3.8-flash" : (model || "gemini-3.8-flash");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  let response;
  try {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(selectedModel)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } catch (error) {
    if (error.name === "AbortError") throw new Error("Gemini took too long (45 seconds). Try a shorter request.");
    throw new Error(`Could not reach Gemini: ${error.message}`);
  } finally {
    clearTimeout(timeout);
  }
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message || "Gemini request failed");
  const text = result.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim();
  if (!text) throw new Error("Gemini returned an empty response");
  return { text };
}
