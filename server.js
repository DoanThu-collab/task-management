/**
 * server.js - DeepSeek API (Render compatible)
 * --------------------------------------------
 * Node: 18+
 * Render: Web Service
 */

const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

/* ---------------- SAFE STATIC (OPTIONAL) ---------------- */

const publicDir = path.join(__dirname, "public");
app.use(express.static(publicDir));

/* ---------------- FALLBACK DATA ---------------- */

function getFallbackSubtasks(taskName) {
  return [
    `Understand requirements of ${taskName}`,
    `Prepare tools and resources`,
    `Execute main steps of ${taskName}`,
    `Review and finalize ${taskName}`
  ];
}

/* ---------------- AI ENDPOINT ---------------- */

app.post("/api/ai/suggest-subtasks", async (req, res) => {
  const { taskName } = req.body;
  const apiKey = process.env.DEEPSEEK_API_KEY;

  console.log("📥 Incoming task:", taskName);

  if (!taskName) {
    return res.status(400).json({ error: "taskName is required" });
  }

  if (!apiKey) {
    console.warn("⚠️ DEEPSEEK_API_KEY missing → fallback");
    return res.json({ subtasks: getFallbackSubtasks(taskName) });
  }

  try {
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
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
Return ONLY valid JSON:
{ "subtasks": ["step 1", "step 2"] }

Task: "${taskName}"
            `
          }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("❌ DeepSeek API Error:", data);
      throw new Error("DeepSeek API failed");
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

/* ---------------- FRONTEND FALLBACK ---------------- */

app.get("*", (req, res) => {
  res.send("✅ Server is running");
});

/* ---------------- START SERVER ---------------- */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
