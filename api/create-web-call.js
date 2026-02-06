export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const RETELL_API_KEY = process.env.RETELL_API_KEY || "";

  try {
    const response = await fetch("https://api.retellai.com/v2/create-web-call", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RETELL_API_KEY}`,
      },
      body: JSON.stringify({ agent_id: req.body.agent_id }),
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ error: text });
    }

    const data = await response.json();
    res.json({ access_token: data.access_token });
  } catch (err) {
    console.error("Serverless function error:", err);
    res.status(500).json({ error: "Failed to create web call" });
  }
}
