/**
 * server.js
 * Chatbot / AI Subtask API using GROQ
 * Render-compatible (Node 18+)
 */

const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

/* ---------------- FALLBACK DATA ---------------- */

function getFallbackSubtasks(taskName) {
  return [
    `Understand the task: ${taskName}`,
    `Plan the required steps`,
    `Execute the main work`,
    `Review and finalize`
  ];
}

/* ---------------- AI ENDPOINT ---------------- */

app.post("/api/ai/suggest-subtasks", async (req, res) => {
  const { taskName } = req.body;
  const apiKey = process.env.GROQ_API_KEY;

  console.log("📥 Incoming task:", taskName);

  if (!taskName) {
    return res.status(400).json({ error: "taskName is required" });
  }

  // No API key → fallback (Render vẫn sống)
  if (!apiKey) {
    console.warn("⚠️ GROQ_API_KEY missing → fallback mode");
    return res.json({ subtasks: getFallbackSubtasks(taskName) });
  }

  try {
    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "llama3-8b-8192",
          temperature: 0.3,
          messages: [
            {
              role: "system",
              content:
                "You are a productivity assistant. Always respond ONLY with valid JSON."
            },
            {
              role: "user",
              content: `
Break the following task into 3–5 logical subtasks in English.
Return ONLY valid JSON in this format:
{ "subtasks": ["step 1", "step 2"] }

Task: "${taskName}"
              `
            }
          ]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("❌ Groq API Error:", data);
      throw new Error("Groq API request failed");
    }

    const raw =
      data.choices?.[0]?.message?.content?.trim() || "{}";

    const clean = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    res.json({
      subtasks: Array.isArray(parsed.subtasks)
        ? parsed.subtasks
        : getFallbackSubtasks(taskName)
    });
  } catch (err) {
    console.warn("⚠️ AI error → fallback:", err.message);
    res.json({ subtasks: getFallbackSubtasks(taskName) });
  }
});

/* ---------------- HEALTH CHECK ---------------- */

app.get("/", (_, res) => {
  res.send("✅ Groq AI server is running on Render");
});

/* ---------------- START SERVER ---------------- */

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
