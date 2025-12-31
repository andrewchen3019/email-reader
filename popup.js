// popup.js
const voicesSelect = document.getElementById('voices');
const rate = document.getElementById('rate');
const pitch = document.getElementById('pitch');
const rateVal = document.getElementById('rateVal');
const pitchVal = document.getElementById('pitchVal');
const textArea = document.getElementById('text');
const playBtn = document.getElementById('play');
const stopBtn = document.getElementById('stop');
const readSelectionBtn = document.getElementById('read-selection');
const readGmailBtn = document.getElementById('read-gmail');

let synth = window.speechSynthesis;
let currentUtter = null;

function populateVoices() {
  const voices = synth.getVoices();
  voicesSelect.innerHTML = "";
  
  const preferred = voices.filter(v => (v.lang && v.lang.toLowerCase().startsWith('en-in')) || /india|indian|hindi/i.test(v.name));
  const others = voices.filter(v => !preferred.includes(v));
  const list = [...preferred, ...others];
  list.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v.name;
    opt.textContent = `${v.name} — ${v.lang || ''}${v.default ? ' (default)' : ''}`;
    voicesSelect.appendChild(opt);
  });
  if (voicesSelect.options.length === 0) {
    const opt = document.createElement('option');
    opt.textContent = 'No voices available';
    voicesSelect.appendChild(opt);
  }
}

synth.onvoiceschanged = populateVoices;
populateVoices();

rate.addEventListener('input', () => rateVal.textContent = rate.value);
pitch.addEventListener('input', () => pitchVal.textContent = pitch.value);

function speakText(t) {
  if (!t || t.trim().length === 0) return;
  synth.cancel();
  const utter = new SpeechSynthesisUtterance(t);
  const selectedName = voicesSelect.value;
  const voices = synth.getVoices();
  const voice = voices.find(v => v.name === selectedName) || voices.find(v => v.lang && v.lang.toLowerCase().startsWith('en-in')) || voices[0];
  if (voice) utter.voice = voice;
  utter.rate = parseFloat(rate.value);
  utter.pitch = parseFloat(pitch.value);
  currentUtter = utter;
  synth.speak(utter);
}

playBtn.addEventListener('click', () => {
  const t = textArea.value;
  if (!t || t.trim().length === 0) {
    alert('No text to read. Try selecting text on the page and press "Read Selected Text", or paste text here.');
    return;
  }
  speakText(t);
});

stopBtn.addEventListener('click', () => {
  synth.cancel();
});

// Read selected text by executing a script in the active tab to get selection, then speak from popup.
readSelectionBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return;
  // run a small script to return window.getSelection().toString()
  try {
    const res = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.getSelection ? window.getSelection().toString() : ""
    });
    const sel = (res && res[0] && res[0].result) || "";
    if (!sel || sel.trim().length === 0) {
      alert('No text selected on the page.');
      return;
    }
    textArea.value = sel;
    speakText(sel);
  } catch (e) {
    console.error(e);
    alert('Could not get selection from page.');
  }
});
// Read open Gmail message (best-effort): inject content-script logic to extract message body




readGmailBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return;
  try {
    // Execute the helper function (content-script logic inline)
    const res = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        // same logic as content-script.js but inline (returns extracted text)
        function detectClient() {
            const host = (location.hostname || "").toLowerCase();
            const href = (location.href || "").toLowerCase();
            if (host.includes("mail.google.com") || href.includes("mail.google.com") || href.includes("gmail.com")) return "gmail";
            if (host.includes("outlook.live.com") || host.includes("outlook.office.com") || host.includes("outlook.office365.com") ||
                href.includes("outlook.live.com") || href.includes("owa") || href.includes("office.com")) return "outlook";
            if (document.querySelector("div.a3s, div.ii.gt, table.gs") ) return "gmail";
            if (document.querySelector("[aria-label='Message content'], [aria-label='Message body'], .ReadingPaneContainer, .ms-Message") ) return "outlook";
            return "unknown";
        }
        function getTextFromNode(node) {
          if (!node) return "";
          const clone = node.cloneNode(true);
          clone.querySelectorAll("script, style, noscript").forEach(n => n.remove());
          return clone.innerText || clone.textContent || "";
        }
        const client = detectClient();
        let text = "";
        if(client == "gmail"){
            const selectors = [
            "div.a3s",
            "div.ii.gt",
            "div[role='main'] div[jscontroller] .a3s",
            "article",
            "div.mail-body",
            "body"
            ];

            for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el) {
                text = getTextFromNode(el).trim();
                if (text.length > 50) break;
            }
            }
            if ((!text || text.length < 10) && window.getSelection) {
            const sel = window.getSelection().toString().trim();
            if (sel && sel.length > 0) text = sel;
            }
        }else if(client == "outlook"){
            const body = document.querySelector("[data-test-id='mailMessageBodyContainer']");
            text += getTextFromNode(body);
        }
        return text;
      }
    });
    const extracted = (res && res[0] && res[0].result) || "";
    if (!extracted || extracted.trim().length === 0) {
      alert('Could not automatically find a message body on this page. Try selecting text, or paste text into the box.');
      return;
    }
    textArea.value = extracted;
    speakText(extracted);
  } catch (e) {
    console.error(e);
    alert('Failed to extract message body from page.');
  }
});