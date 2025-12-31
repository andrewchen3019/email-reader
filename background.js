// background.js (service worker)
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "read-selection",
    title: "Read selection",
    contexts: ["selection"]
  });
});

// When user clicks the context menu, execute a script in the page to speak the selected text.
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab || !tab.id) return;
  const text = info.selectionText || "";
  // Execute a function in the page that uses speechSynthesis to speak text
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (text) => {
      // This runs in page context
      (function speakText(t) {
        if (!t || t.trim().length === 0) return;

        const synth = window.speechSynthesis;
        let voices = synth.getVoices();
        // A helper to pick voice
        function pickVoice() {
          voices = synth.getVoices(); // refresh
          // prefer locale en-IN
          let found = voices.find(v => v.lang && v.lang.toLowerCase().startsWith("en-in"));
          if (found) return found;
          
          found = voices.find(v => /india|indian|hindi/i.test(v.name));
          if (found) return found;
          // try any English voice
          found = voices.find(v => /^en\b/i.test(v.lang || ""));
          if (found) return found;
          // final fallback
          return voices[0] || null;
        }

        function ensureVoicesLoaded(cb) {
          if (speechSynthesis.getVoices().length > 0) return cb();
          // some browsers populate asynchronously
          speechSynthesis.onvoiceschanged = () => {
            speechSynthesis.onvoiceschanged = null;
            cb();
          };
        }

        ensureVoicesLoaded(() => {
          const voice = pickVoice();
          const utter = new SpeechSynthesisUtterance(t);
          if (voice) utter.voice = voice;
        
          utter.rate = 0.95;
          utter.pitch = 1.0;
          
          speechSynthesis.cancel();
          speechSynthesis.speak(utter);
        });
      })(text);
    },
    args: [text]
  });
});
