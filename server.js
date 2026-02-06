require("dotenv").config();
const express = require("express");
const app = express();
const PORT = 3000;

// ── Your Retell SECRET API key ──
// This is NOT the public key. Get the secret key from:
// https://dashboard.retellai.com → Settings → API Keys (starts with "key_")
const RETELL_API_KEY = process.env.RETELL_API_KEY || "";

app.use(express.json());
app.use(express.static(__dirname)); // serves index.html, styles.css, main.js

// Endpoint that main.js calls to get an access token
app.post("/api/create-web-call", async (req, res) => {
  try {
    const response = await fetch("https://api.retellai.com/v2/create-web-call", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RETELL_API_KEY}`,
      },
      body: JSON.stringify({
        agent_id: req.body.agent_id,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Retell API error:", response.status, text);
      return res.status(response.status).json({ error: text });
    }

    const data = await response.json();
    res.json({ access_token: data.access_token });
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ error: "Failed to create web call" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
