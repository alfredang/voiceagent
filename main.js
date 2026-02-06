import { RetellWebClient } from "https://cdn.jsdelivr.net/npm/retell-client-js-sdk/+esm";

// ── Configuration ──
// TODO: Replace with your backend endpoint that calls Retell's
// POST https://api.retellai.com/v2/create-web-call API and returns { access_token }.
// Do NOT put your Retell API key in client-side code in production.
const CREATE_WEB_CALL_URL = "/api/create-web-call";
const AGENT_ID = "agent_e94708d2be383cc9083a9f9621";

// ── Retell client ──
const retellClient = new RetellWebClient();
let callActive = false;
let timerInterval = null;
let seconds = 0;

// ── DOM refs ──
const nav = document.getElementById("navbar");
const modal = document.getElementById("voice-modal");
const modalStatus = document.getElementById("vm-status");
const modalTimer = document.getElementById("vm-timer");
const modalAvatar = document.getElementById("vm-avatar");
const hangupBtn = document.getElementById("vm-hangup");

// ── Navbar scroll shadow ──
window.addEventListener("scroll", () => {
  nav.classList.toggle("scrolled", window.scrollY > 10);
});

// ── Voice call functions ──
function showModal() {
  modal.classList.add("active");
  document.body.style.overflow = "hidden";
}

function hideModal() {
  modal.classList.remove("active");
  document.body.style.overflow = "";
  stopTimer();
  modalAvatar.classList.remove("speaking");
  modalStatus.textContent = "Connecting...";
  modalTimer.textContent = "00:00";
}

function startTimer() {
  seconds = 0;
  timerInterval = setInterval(() => {
    seconds++;
    const m = String(Math.floor(seconds / 60)).padStart(2, "0");
    const s = String(seconds % 60).padStart(2, "0");
    modalTimer.textContent = `${m}:${s}`;
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
}

async function startVoiceCall() {
  if (callActive) return;
  showModal();
  modalStatus.textContent = "Connecting...";

  try {
    const res = await fetch(CREATE_WEB_CALL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent_id: AGENT_ID }),
    });

    if (!res.ok) throw new Error(`Server returned ${res.status}`);

    const data = await res.json();
    await retellClient.startCall({ accessToken: data.access_token });
  } catch (err) {
    console.error("Failed to start voice call:", err);
    modalStatus.textContent = "Connection failed";
    setTimeout(hideModal, 2000);
  }
}

async function endVoiceCall() {
  retellClient.stopCall();
}

// ── Retell SDK events ──
retellClient.on("call_started", () => {
  callActive = true;
  modalStatus.textContent = "Speaking with Sarah";
  startTimer();
});

retellClient.on("call_ended", () => {
  callActive = false;
  modalStatus.textContent = "Call ended";
  modalAvatar.classList.remove("speaking");
  stopTimer();
  setTimeout(hideModal, 1500);
});

retellClient.on("agent_start_talking", () => {
  modalAvatar.classList.add("speaking");
});

retellClient.on("agent_stop_talking", () => {
  modalAvatar.classList.remove("speaking");
});

retellClient.on("error", (e) => {
  console.error("Retell error:", e);
  callActive = false;
  modalStatus.textContent = "Something went wrong";
  stopTimer();
  setTimeout(hideModal, 2000);
});

// ── Button wiring ──
hangupBtn.addEventListener("click", endVoiceCall);

// Close modal on backdrop click
modal.addEventListener("click", (e) => {
  if (e.target === modal && !callActive) hideModal();
});

// ── Retell Chat Widget (hidden — used as backend for our custom popup) ──
let retellShadowRoot = null;
let retellChatReady = false;
let retellObserver = null;
let lastKnownMessageCount = 0;

function findRetellWidget() {
  for (const el of document.querySelectorAll("body > *")) {
    if (!el.shadowRoot) continue;
    const sr = el.shadowRoot;
    const fab = sr.getElementById("retell-fab");
    if (fab) {
      retellShadowRoot = sr;
      // Hide the entire widget container off-screen
      el.style.setProperty("position", "fixed", "important");
      el.style.setProperty("left", "-9999px", "important");
      el.style.setProperty("top", "-9999px", "important");
      el.style.setProperty("opacity", "0", "important");
      el.style.setProperty("pointer-events", "none", "important");
      return true;
    }
  }
  return false;
}

const _hi = setInterval(() => {
  if (findRetellWidget()) {
    clearInterval(_hi);
    initRetellChat();
  }
}, 500);
setTimeout(() => clearInterval(_hi), 30000);

// Open the hidden Retell chat and set up a MutationObserver to capture responses
function initRetellChat() {
  if (!retellShadowRoot) return;

  // Click the FAB to open the chat session
  const retellFab = retellShadowRoot.getElementById("retell-fab");
  if (retellFab) retellFab.click();

  // Fallback: force display
  const chat = retellShadowRoot.getElementById("retell-chat");
  if (chat && chat.style.display !== "flex") {
    chat.style.display = "flex";
  }

  // Watch #retell-messages for new bot responses
  const messagesEl = retellShadowRoot.getElementById("retell-messages");
  if (messagesEl) {
    lastKnownMessageCount = messagesEl.children.length;
    retellObserver = new MutationObserver(() => {
      const currentCount = messagesEl.children.length;
      if (currentCount > lastKnownMessageCount) {
        // New messages appeared — check for bot responses
        for (let i = lastKnownMessageCount; i < currentCount; i++) {
          const msgEl = messagesEl.children[i];
          const text = msgEl?.textContent?.trim();
          // Skip user messages (they contain our own sent text)
          if (text && !msgEl.classList.contains("user") && !msgEl.querySelector("[data-user]")) {
            removeTypingIndicator();
            addMessage("sarah", text);
          }
        }
        lastKnownMessageCount = currentCount;
      }
    });
    retellObserver.observe(messagesEl, { childList: true, subtree: true });
    retellChatReady = true;
  }
}

// Send a message to the hidden Retell chat widget
function sendToRetell(text) {
  if (!retellShadowRoot) return false;

  const input = retellShadowRoot.getElementById("retell-input");
  if (!input) return false;

  // Set value using native setter to trigger framework reactivity
  const nativeSetter =
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (nativeSetter) nativeSetter.call(input, text);
  else input.value = text;
  input.dispatchEvent(new Event("input", { bubbles: true }));

  // Click the send button
  setTimeout(() => {
    const sendBtn = retellShadowRoot.querySelector(".retell-send-btn")
      || retellShadowRoot.querySelector("button[type='submit']");
    if (sendBtn) sendBtn.click();
  }, 100);

  return true;
}

// ── Assistant Popup ──
const fab = document.getElementById("assistant-fab");
const popup = document.getElementById("assistant-popup");
const apClose = document.getElementById("ap-close");
const apChatBtn = document.getElementById("ap-chat-btn");
const apTalkBtn = document.getElementById("ap-talk-btn");
const apInput = document.getElementById("ap-input");
const apSendBtn = document.getElementById("ap-send-btn");
const apMessages = document.getElementById("ap-messages");

function togglePopup() {
  popup.classList.toggle("open");
  if (popup.classList.contains("open")) {
    setTimeout(() => apInput.focus(), 300);
  }
}

function closePopup() {
  popup.classList.remove("open");
}

fab.addEventListener("click", togglePopup);
apClose.addEventListener("click", closePopup);

// Chat option — just highlight (messages are already inline)
apChatBtn.addEventListener("click", () => {
  apChatBtn.classList.add("ap-option-active");
  apTalkBtn.classList.remove("ap-option-active");
  apInput.focus();
});

// Talk option → start voice call
apTalkBtn.addEventListener("click", () => {
  apTalkBtn.classList.add("ap-option-active");
  apChatBtn.classList.remove("ap-option-active");
  closePopup();
  startVoiceCall();
});

// Add a message bubble to the popup
function addMessage(sender, text) {
  const div = document.createElement("div");
  div.className = `chat-message ${sender}`;
  const p = document.createElement("p");
  p.textContent = text;
  div.appendChild(p);
  apMessages.appendChild(div);
  // Scroll to bottom
  const body = popup.querySelector(".ap-body");
  if (body) body.scrollTop = body.scrollHeight;
}

function showTypingIndicator() {
  if (apMessages.querySelector(".typing-indicator")) return;
  const div = document.createElement("div");
  div.className = "typing-indicator";
  div.innerHTML = "<span></span><span></span><span></span>";
  apMessages.appendChild(div);
  const body = popup.querySelector(".ap-body");
  if (body) body.scrollTop = body.scrollHeight;
}

function removeTypingIndicator() {
  const indicator = apMessages.querySelector(".typing-indicator");
  if (indicator) indicator.remove();
}

// Send a chat message
function sendMessage() {
  const msg = apInput.value.trim();
  if (!msg) return;

  apInput.value = "";
  addMessage("user", msg);
  showTypingIndicator();

  // Send to the hidden Retell widget
  if (!sendToRetell(msg)) {
    // If Retell widget isn't ready, show a fallback response
    setTimeout(() => {
      removeTypingIndicator();
      addMessage("sarah", "I'm still loading — please try again in a moment!");
    }, 1000);
  }
}

apSendBtn.addEventListener("click", sendMessage);
apInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendMessage();
});

// Quick question chips
document.querySelectorAll(".ap-chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    apInput.value = chip.dataset.q;
    sendMessage();
  });
});

// Expose to onclick attributes
window.startVoiceCall = startVoiceCall;
