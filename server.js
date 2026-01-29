/**
 * server.js
 * Groq AI + Frontend-safe output
 * Render ready (Node 18+)
 */

const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

/* ================= FRONTEND ================= */

const publicDir = path.join(__dirname, "public");
app.use(express.static(publicDir));

/* ================= UTILS ================= */

/**
 * Ensure subtasks is always string[]
 * Fixes [object Object] bug
 */
function normalizeSubtasks(subtasks) {
  if (!Array.isArray(subtasks)) return [];

  return subtasks
    .map(item => {
      if (typeof item === "string") return item;
      if (typeof item === "object" && item !== null) {
        return (
          item.title ||
          item.name ||
          item.text ||
          JSON.stringify(item)
        );
      }
      return String(item);
    })
    .filter(Boolean);
}

function getFallbackSubtasks(taskName) {
  return normalizeSubtasks([
    `Analyze task: ${taskName}`,
    `Break down requirements`,
    `Execute main steps`,
    `Review and complete`
  ]);
}

/* ================= AI ENDPOINT ================= */

app.post("/api/ai/suggest-subtasks", async (req, res) => {
  const { taskName } = req.body;
  const apiKey = process.env.GROQ_API_KEY;

  console.log("🧠 AI Breakdown requested:", taskName);

  if (!taskName) {
    console.error("❌ taskName missing");
    return res.status(400).json({
      subtasks: [],
      error: "taskName is required"
    });
  }

  if (!apiKey) {
    console.warn("⚠️ GROQ_API_KEY missing → fallback");
    return res.json({
      subtasks: getFallbackSubtasks(taskName),
      fallback: true
    });
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
          model: "llama-3.1-8b-instant",
          temperature: 0.3,
          messages: [
            {
              role: "system",
              content:
                'Return ONLY valid JSON in this format: { "subtasks": [] }'
            },
            {
              role: "user",
              content: `Break this task into 3–5 actionable subtasks:\n"${taskName}"`
            }
          ]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("❌ Groq API ERROR:", data);
      throw new Error(data?.error?.message || "Groq API failed");
    }

    const raw = data.choices?.[0]?.message?.content || "{}";
    const clean = raw.replace(/```json|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch (e) {
      console.error("❌ JSON parse failed:", clean);
      throw new Error("Invalid JSON from AI");
    }

    console.log("🧪 RAW AI subtasks:", parsed.subtasks);

    const normalized = normalizeSubtasks(parsed.subtasks);

    if (!normalized.length) {
      throw new Error("AI returned empty subtasks");
    }

    console.log("✅ Subtasks sent to frontend:", normalized.length);
    return res.json({ subtasks: normalized });

  } catch (err) {
    console.warn("⚠️ AI FAILED → fallback");
    console.warn("Reason:", err.message);

    return res.json({
      subtasks: getFallbackSubtasks(taskName),
      fallback: true,
      error: err.message
    });
  }
});

/* ================= SPA FALLBACK ================= */

app.get("*", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

/* ================= START ================= */

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
