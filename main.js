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

// ── Gemini Chat Backend ──
const CHAT_API_URL = "/api/chat";
let chatHistory = [];

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

// Send a chat message via Gemini API
async function sendMessage() {
  const msg = apInput.value.trim();
  if (!msg) return;

  apInput.value = "";
  addMessage("user", msg);
  showTypingIndicator();

  // Track in history
  chatHistory.push({ role: "user", text: msg });

  try {
    const res = await fetch(CHAT_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: msg, history: chatHistory.slice(0, -1) }),
    });

    if (!res.ok) throw new Error(`Server returned ${res.status}`);

    const data = await res.json();
    removeTypingIndicator();
    addMessage("sarah", data.reply);
    chatHistory.push({ role: "assistant", text: data.reply });
  } catch (err) {
    console.error("Chat error:", err);
    removeTypingIndicator();
    addMessage("sarah", "Sorry, something went wrong. Please try again!");
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
