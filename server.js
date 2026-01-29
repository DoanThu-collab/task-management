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

function normalizeSubtasks(subtasks) {
  if (!Array.isArray(subtasks)) return [];

  return subtasks
    .map(item => {
      if (typeof item === "string") return item.trim();
      if (typeof item === "object" && item !== null) {
        return item.title || item.name || item.text || "";
      }
      return "";
    })
    .filter(Boolean);
}

function extractMainSubtasks(text) {
  return text
    .split("\n")
    .map(line =>
      line
        .replace(/^\s*[\d\-•*]+[.)]?\s*/, "")
        .replace(/\*\*/g, "")
        .replace(/:$/, "")
        .trim()
    )
    .filter(line => {
      if (!line) return false;
      if (/here are|below are|following/i.test(line)) return false;
      if (line.length > 80) return false;
      if (line.includes(".")) return false;
      return /^[A-Z]/.test(line);
    });
}

function enforceSubtaskLimit(subtasks, taskName) {
  const unique = [...new Set(subtasks)];

  if (unique.length >= 3 && unique.length <= 5) return unique;
  if (unique.length > 5) return unique.slice(0, 5);

  return [
    `Plan the task: ${taskName}`,
    `Prepare required resources`,
    `Execute main steps`,
    `Review and finalize`
  ].slice(0, 3);
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
    return res.json({
      subtasks: enforceSubtaskLimit([], taskName),
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
          temperature: 0.2,
          messages: [
            {
              role: "system",
              content: `
You are a task planning assistant.

Your job is to break a task into 3 to 5 HIGH-LEVEL subtasks only.

Rules:
- Each subtask must be a short action phrase (5–8 words max)
- Each subtask represents a MAIN STEP, not a detail
- Do NOT include explanations, descriptions, or examples
- Do NOT include sub-steps or bullet hierarchies
- Do NOT include introductory or concluding sentences
- Do NOT repeat the task name verbatim
- Output must be easy to use as a checklist item

Think in terms of: planning → preparation → execution → completion.
`
            },
            {
              role: "user",
              content: `Task to break down: "${taskName}"`
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

    let subtasks = [];
    try {
      const parsed = JSON.parse(raw.replace(/```json|```/g, ""));
      subtasks = normalizeSubtasks(parsed.subtasks);
    } catch {
      subtasks = extractMainSubtasks(raw);
    }

    const finalSubtasks = enforceSubtaskLimit(subtasks, taskName);
    console.log("✅ Final subtasks:", finalSubtasks);

    return res.json({ subtasks: finalSubtasks });

  } catch (err) {
    console.warn("⚠️ AI FAILED → fallback");
    console.warn("Reason:", err.message);

    return res.json({
      subtasks: enforceSubtaskLimit([], taskName),
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
