/**
 * server.js
 * Groq AI – Bulletproof version
 * Fix JSON + text response
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
 * Normalize subtasks → always string[]
 */
function normalizeSubtasks(subtasks) {
  if (!Array.isArray(subtasks)) return [];

  return subtasks
    .map(item => {
      if (typeof item === "string") return item.trim();
      if (typeof item === "object" && item !== null) {
        return item.title || item.name || item.text || "";
      }
      return String(item).trim();
    })
    .filter(Boolean);
}

/**
 * Extract subtasks from plain text (1. 2. - •)
 */
function extractSubtasksFromText(text) {
  return text
    .split("\n")
    .map(line =>
      line
        .replace(/^\s*[\d\-•*]+[.)]?\s*/, "")
        .replace(/\*\*/g, "")
        .trim()
    )
    .filter(line => line.length > 5 && line.length < 200);
}

function getFallbackSubtasks(taskName) {
  return [
    `Analyze task: ${taskName}`,
    `Break down requirements`,
    `Execute main steps`,
    `Review and complete`
  ];
}

/* ================= AI ENDPOINT ================= */

app.post("/api/ai/suggest-subtasks", async (req, res) => {
  const { taskName } = req.body;
  const apiKey = process.env.GROQ_API_KEY;

  console.log("🧠 AI Breakdown requested:", taskName);

  if (!taskName) {
    return res.status(400).json({ subtasks: [] });
  }

  if (!apiKey) {
    console.warn("⚠️ GROQ_API_KEY missing → fallback");
    return res.json({ subtasks: getFallbackSubtasks(taskName), fallback: true });
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
                "Break tasks into clear actionable subtasks."
            },
            {
              role: "user",
              content: `Break the task into 3–5 subtasks:\n"${taskName}"`
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

    const raw = data.choices?.[0]?.message?.content || "";
    console.log("🧪 RAW AI RESPONSE:\n", raw);

    // 1️⃣ Try JSON parse
    let subtasks = [];
    try {
      const parsed = JSON.parse(raw.replace(/```json|```/g, ""));
      subtasks = normalizeSubtasks(parsed.subtasks);
    } catch {
      // 2️⃣ Extract from text
      console.warn("⚠️ JSON failed → extracting from text");
      subtasks = extractSubtasksFromText(raw);
    }

    // 3️⃣ Final fallback safety
    if (!subtasks.length) {
      console.warn("⚠️ Extraction empty → local fallback");
      subtasks = getFallbackSubtasks(taskName);
    }

    console.log("✅ Subtasks sent:", subtasks.length);
    return res.json({ subtasks });

  } catch (err) {
    console.warn("⚠️ AI FAILED HARD → fallback");
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
