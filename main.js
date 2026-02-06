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

// ── Hide default Retell widget FAB & programmatically open chat ──
// The Retell widget uses an open Shadow DOM inside a fixed-position div.
// Inside: #retell-fab (button), #retell-chat (chat window), #retell-input (text input).
// The widget's own FAB click handler just toggles retell-chat display between none/flex.
// We hide the FAB and directly toggle the chat window ourselves.
let retellShadowRoot = null;

function findRetellWidget() {
  for (const el of document.querySelectorAll("body > *")) {
    if (!el.shadowRoot) continue;
    const sr = el.shadowRoot;
    const fab = sr.getElementById("retell-fab");
    if (fab) {
      retellShadowRoot = sr;
      fab.style.setProperty("display", "none", "important");
      return true;
    }
  }
  return false;
}

const _hi = setInterval(() => {
  if (findRetellWidget()) clearInterval(_hi);
}, 500);
setTimeout(() => clearInterval(_hi), 30000);

// Helper: programmatically open the Retell chat widget
function openRetellChat() {
  if (!retellShadowRoot) findRetellWidget();
  if (!retellShadowRoot) return;

  // Directly show the chat window (same as what the widget's FAB click does)
  const chat = retellShadowRoot.getElementById("retell-chat");
  if (chat) {
    chat.style.display = "flex";
    const input = retellShadowRoot.getElementById("retell-input");
    if (input) setTimeout(() => input.focus(), 150);
  }
}

// ── Assistant Popup ──
const fab = document.getElementById("assistant-fab");
const popup = document.getElementById("assistant-popup");
const apClose = document.getElementById("ap-close");
const apChatBtn = document.getElementById("ap-chat-btn");
const apTalkBtn = document.getElementById("ap-talk-btn");
const apInput = document.getElementById("ap-input");
const apSendBtn = document.getElementById("ap-send-btn");

function togglePopup() {
  popup.classList.toggle("open");
}

function closePopup() {
  popup.classList.remove("open");
}

fab.addEventListener("click", togglePopup);
apClose.addEventListener("click", closePopup);

// Chat option → open Retell chat directly
apChatBtn.addEventListener("click", () => {
  apChatBtn.classList.add("ap-option-active");
  apTalkBtn.classList.remove("ap-option-active");
  closePopup();
  openRetellChat();
});

// Talk option → start voice call
apTalkBtn.addEventListener("click", () => {
  apTalkBtn.classList.add("ap-option-active");
  apChatBtn.classList.remove("ap-option-active");
  closePopup();
  startVoiceCall();
});

// Send message → open Retell chat with the typed message
function sendMessage() {
  const msg = apInput.value.trim();
  if (!msg) return;
  apInput.value = "";
  closePopup();
  openRetellChat();
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
