// content-script.js
// This file is not automatically injected by manifest; it will be executed via scripting.executeScript from popup when requested.
// Attempts to locate the visible Gmail message body and return its plain text.
(function findGmailBody() {
  // Gmail message content often uses div.a3s inside the message viewer.
  function getTextFromNode(node) {
    if (!node) return "";
    const clone = node.cloneNode(true);
    // remove script/style
    clone.querySelectorAll("script, style, noscript").forEach(n => n.remove());
    return clone.innerText || clone.textContent || "";
  }

  // Try common selectors
  const selectors = [
    "div.a3s",                          // message body container in Gmail
    "div.ii.gt",                        // older Gmail selector
    "div[role='main'] div[jscontroller] .a3s", // more specific
    "article",                          // outlook / other services
    "div.mail-body",                    // fallback
    "body"
  ];

  let text = "";
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) {
      text = getTextFromNode(el).trim();
      if (text.length > 50) break;
    }
  }

  // If not found or too short, try to get selected text
  if ((!text || text.length < 10) && window.getSelection) {
    const sel = window.getSelection().toString().trim();
    if (sel && sel.length > 0) text = sel;
  }

  return text;
})();
