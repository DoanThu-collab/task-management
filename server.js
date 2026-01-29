const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

/* ---------- FRONTEND ---------- */

const publicDir = path.join(__dirname, "public");
app.use(express.static(publicDir));

/* ---------- FALLBACK ---------- */

function getFallbackSubtasks(taskName) {
  return [
    `Understand the task: ${taskName}`,
    `Plan the required steps`,
    `Execute the main work`,
    `Review and finalize`
  ];
}

/* ---------- AI API ---------- */

app.post("/api/ai/suggest-subtasks", async (req, res) => {
  const { taskName } = req.body;
  const apiKey = process.env.GROQ_API_KEY;

  if (!taskName) {
    return res.status(400).json({ error: "taskName is required" });
  }

  if (!apiKey) {
    return res.json({ subtasks: getFallbackSubtasks(taskName) });
  }

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
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
            content: "Respond ONLY with valid JSON."
          },
          {
            role: "user",
            content: `
Break the task into 3–5 subtasks.
Return JSON only:
{ "subtasks": ["step 1", "step 2"] }

Task: "${taskName}"
            `
          }
        ]
      })
    });

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(raw.replace(/```json|```/g, ""));

    res.json({
      subtasks: parsed.subtasks || getFallbackSubtasks(taskName)
    });
  } catch (e) {
    res.json({ subtasks: getFallbackSubtasks(taskName) });
  }
});

/* ---------- SPA FALLBACK ---------- */

app.get("*", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

/* ---------- START ---------- */

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
