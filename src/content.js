(() => {
  const PAGE_TIMEOUT = 8000;

  function visibleText(root = document.body) {
    const clone = root.cloneNode(true);
    clone.querySelectorAll("script,style,noscript,svg,canvas").forAll?.((node) => node.remove());
    clone.querySelectorAll("script,style,noscript,svg,canvas").forEach((node) => node.remove());
    return (clone.innerText || clone.textContent || "")
      .replace(/\s+/g, " ")
      .replace(/\u00a0/g, " ")
      .trim()
      .slice(0, 50000);
  }

  function readableArticle() {
    const selectors = ["article", "main", '[role="main"]', ".post-content", ".entry-content"];
    const candidates = selectors
      .map((selector) => document.querySelector(selector))
      .filter(Boolean)
      .map((node) => visibleText(node))
      .filter((text) => text.length > 120);
    candidates.sort((a, b) => b.length - a.length);
    return candidates[0] || visibleText();
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "GET_PAGE_CONTEXT") {
      const page = {
        title: document.title,
        url: location.href,
        text: readableArticle(),
        description: document.querySelector('meta[name="description"]')?.content || "",
        isYoutube: location.hostname.includes("youtube.com"),
        selectedText: window.getSelection()?.toString().trim() || ""
      };
      sendResponse(page);
      return true;
    }

    if (message.type === "EXECUTE_ACTION") {
      try {
        const action = message.action;
        if (action.type === "focus") focusElement(action.selector);
        if (action.type === "click") clickElement(action.selector);
        if (action.type === "type") typeElement(action.selector, action.text);
        if (action.type === "scroll") {
          window.scrollTo({ top: action.direction === "bottom" ? document.body.scrollHeight : 0, behavior: "smooth" });
        }
        sendResponse({ ok: true, url: location.href });
      } catch (error) {
        sendResponse({ ok: false, error: error.message });
      }
      return true;
    }
  });

  function resolveSelector(selector) {
    if (!selector) throw new Error("Element selector is missing");
    let element = document.querySelector(selector);
    if (!element) {
      const normalized = selector.toLowerCase();
      element = [...document.querySelectorAll("button,input,textarea,a,[role='button'],[contenteditable='true']")]
        .find((node) => (node.innerText || node.value || node.getAttribute("aria-label") || node.placeholder || node.textContent || "")
          .toLowerCase().includes(normalized));
    }
    if (!element) throw new Error(`Element not found: ${selector}`);
    return element;
  }

  function focusElement(selector) {
    resolveSelector(selector).focus();
  }

  function clickElement(selector) {
    const element = resolveSelector(selector);
    element.scrollIntoView({ block: "center", behavior: "smooth" });
    element.click();
  }

  function typeElement(selector, text) {
    const element = resolveSelector(selector);
    element.focus();
    if (element.isContentEditable) {
      element.textContent = text;
      element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
    } else {
      element.value = text;
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }
})();
