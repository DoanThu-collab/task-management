const express = require("express");
const cors = require("cors");
const path = require("path");

const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const app = express();
app.use(cors());
app.use(express.json());

// =======================
// Serve frontend
// =======================
app.use(express.static(path.join(__dirname, "public")));

// =======================
// AI API
// =======================
app.post("/api/ai/suggest-subtasks", async (req, res) => {
  console.log("📥 Incoming request:", req.body);

  const { taskName } = req.body;
  if (!taskName) {
    return res.status(400).json({ error: "Missing taskName" });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
  }

  const prompt = `
Break the task into 3–5 subtasks.
Return ONLY valid JSON in this format:
{ "subtasks": ["..."] }

Task: "${taskName}"
`;

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        input: [
          {
            role: "user",
            content: prompt
          }
        ]
      })
    });

    const data = await response.json();
    console.log("🧠 OpenAI raw:", JSON.stringify(data, null, 2));

    const text =
      data?.output_text ||
      data?.output?.[0]?.content?.find(c => c.type === "output_text")?.text;

    if (!text) {
      return res.status(500).json({
        error: "AI returned no text",
        raw: data
      });
    }

    const parsed = JSON.parse(text);

    res.json({
      subtasks: parsed.subtasks || []
    });

  } catch (err) {
    console.error("❌ AI ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// =======================
// Fallback route (NO WILDCARD BUG)
// =======================
app.use((req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

// =======================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
