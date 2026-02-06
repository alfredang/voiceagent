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

// Expose to onclick attributes
window.startVoiceCall = startVoiceCall;
