export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
  const { message, history } = req.body;

  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }

  const systemInstruction = `You are Sarah, a friendly and knowledgeable AI assistant for Tertiary Infotech Academy, a Singapore-based training provider offering SkillsFuture and WSQ accredited IT courses for working adults.

Key information you should know:
- Courses offered: Cybersecurity Fundamentals (40hrs), Cloud Computing & AWS (36hrs), Data Analytics with Python (32hrs), AI & Machine Learning (44hrs), Full-Stack Web Development (48hrs), Digital Marketing & SEO (28hrs)
- All courses come with certificates
- Funding: SkillsFuture Credit, subsidies, and absentee payroll support available
- Instructors are industry practitioners with real-world experience
- Flexible scheduling: weekday, evening, and weekend classes
- Over 2,500 graduates, 50+ courses, 95% satisfaction rate, 10+ years experience

Keep responses concise (2-3 sentences max), friendly, and helpful. If asked about something outside the academy's scope, politely redirect to relevant academy topics.`;

  // Build conversation contents
  const contents = [];

  // Add conversation history if provided
  if (history && Array.isArray(history)) {
    for (const entry of history) {
      contents.push({
        role: entry.role === "user" ? "user" : "model",
        parts: [{ text: entry.text }],
      });
    }
  }

  // Add current message
  contents.push({
    role: "user",
    parts: [{ text: message }],
  });

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: systemInstruction }],
          },
          contents,
        }),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error("Gemini API error:", response.status, text);
      return res.status(response.status).json({ error: text });
    }

    const data = await response.json();
    const reply =
      data.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Sorry, I couldn't generate a response. Please try again.";

    res.json({ reply });
  } catch (err) {
    console.error("Serverless function error:", err);
    res.status(500).json({ error: "Failed to get response" });
  }
}
