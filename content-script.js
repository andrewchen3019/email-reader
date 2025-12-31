// content-script.js
// Run this in-page (via scripting.executeScript) to extract a likely email body text.
// Detects Gmail vs Outlook and uses tailored selectors. Returns a string (may be empty).

(function extractEmailBody() {
  function getTextFromNode(node) {
    if (!node) return "";
    try {
      const clone = node.cloneNode(true);
      clone.querySelectorAll("script, style, noscript, iframe").forEach(n => n.remove());
      return (clone.innerText || clone.textContent || "").trim();
    } catch (e) {
      return (node.innerText || node.textContent || "").trim();
    }
  }

  function isVisible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    const style = window.getComputedStyle(el);
    if (style && (style.visibility === 'hidden' || style.display === 'none' || parseFloat(style.opacity || '1') === 0)) return false;
    return true;
  }

  // Client detection
  function detectClient() {
    const host = (location.hostname || "").toLowerCase();
    const href = (location.href || "").toLowerCase();

    // Gmail detection
    if (host.includes("mail.google.com") || href.includes("mail.google.com") || href.includes("gmail.com")) {
      return "gmail";
    }
    // Outlook / Office 365 / Outlook Live / OWA detection
    if (host.includes("outlook.live.com") || host.includes("outlook.office.com") || host.includes("outlook.office365.com") ||
        href.includes("outlook.live.com") || href.includes("owa") || href.includes("office.com")) {
      return "outlook";
    }

    // Heuristic: look for Gmail-specific DOM markers
    if (document.querySelector("div.a3s, div.ii.gt, table.gs") ) return "gmail";
    // Heuristic: look for Outlook-specific DOM markers
    if (document.querySelector("[aria-label='Message content'], [aria-label='Message body'], .ReadingPaneContainer, .ms-Message") ) return "outlook";

    return "unknown";
  }

  // Selector sets tuned per client
  const SELECTORS = {
    gmail: [
      "div.a3s", "div.ii.gt", "div[role='main'] div[jscontroller] .a3s",
      "div[role='main'] table.ii", "div.adn", // extra gmail-ish candidates
      "article"
    ],
    outlook: [
      "div[aria-label='Message content']",
      "div[aria-label='Message body']",
      "div.readMsg, div.readmessage, .ReadingPaneContainer, .ms-Message",
      "div._n_6", // possible obfuscated classes
      "article", "div[role='article']"
    ],
    generic: [
      "article",
      "div[role='article']",
      "div[role='main']",
      "div.mail-body",
      "div[aria-label*='message']",
      "div, article, section, p, td"
    ]
  };

  function extractUsingSelectorsFromDoc(doc, selectors) {
    try {
      for (const sel of selectors) {
        try {
          const el = doc.querySelector(sel);
          if (el) {
            const txt = getTextFromNode(el);
            if (txt && txt.length > 40) return txt;
          }
        } catch (e) { /* ignore selector errors */ }
      }
      return "";
    } catch (err) {
      return "";
    }
  }

  function extractFromDocument(doc, client) {
    try {
      // 1) Client-specific selectors
      if (client && SELECTORS[client]) {
        const txt = extractUsingSelectorsFromDoc(doc, SELECTORS[client]);
        if (txt && txt.length > 40) return txt;
      }

      // 2) Generic selectors as fallback
      const txt2 = extractUsingSelectorsFromDoc(doc, SELECTORS.generic);
      if (txt2 && txt2.length > 40) return txt2;

      // 3) aria-label elements
      const ariaEls = doc.querySelectorAll("[aria-label*='message'], [aria-label*='Message'], [aria-label*='body'], [aria-label*='Body']");
      for (const el of ariaEls) {
        const t = getTextFromNode(el);
        if (t && t.length > 40) return t;
      }

      // 4) largest visible text block heuristic
      const candidates = Array.from(doc.querySelectorAll("div, article, section, p, td"));
      let best = { el: null, len: 0 };
      for (const c of candidates) {
        if (!isVisible(c)) continue;
        const txt = getTextFromNode(c);
        const l = (txt || "").length;
        if (l > best.len) best = { el: c, len: l };
      }
      if (best.el && best.len > 40) return getTextFromNode(best.el);

      // 5) page body fallback
      const bodyText = getTextFromNode(doc.body || doc.documentElement || {});
      if (bodyText && bodyText.length > 20) return bodyText;

      return "";
    } catch (err) {
      return "";
    }
  }

  // Main extraction flow
  try {
    const client = detectClient();

    // 1) try current document using detected client
    let result = extractFromDocument(document, client);
    if (result && result.length > 0) {
      // return with client hint for callers that might want it
      return JSON.stringify({ client, text: result });
    }

    // 2) try same-origin iframes (Outlook may embed frames)
    try {
      for (let i = 0; i < window.frames.length; i++) {
        try {
          const f = window.frames[i];
          const doc = f.document;
          const txt = extractFromDocument(doc, client);
          if (txt && txt.length > 40) return JSON.stringify({ client, text: txt });
        } catch (e) {
          // cross-origin or inaccessible frame - ignore
        }
      }
    } catch (e) {
      // ignore
    }

    // 3) fallback to selection
    try {
      const sel = window.getSelection ? window.getSelection().toString().trim() : "";
      if (sel && sel.length > 0) return JSON.stringify({ client, text: sel });
    } catch (e) {}

    // 4) nothing found
    return JSON.stringify({ client, text: "" });
  } catch (err) {
    return JSON.stringify({ client: "unknown", text: "" });
  }
})();
