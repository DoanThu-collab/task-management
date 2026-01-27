const express = require("express");
const cors = require("cors");
const path = require("path");

const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const app = express();
app.use(cors());
app.use(express.json());

// ✅ Serve frontend
app.use(express.static(path.join(__dirname, "public")));

// ✅ API AI
app.post("/api/ai/suggest-subtasks", async (req, res) => {
  const { taskName } = req.body;
  if (!taskName) return res.status(400).json({ error: "Missing taskName" });

  const prompt = `
Break the task into 3–5 subtasks.
Return ONLY JSON:
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
        input: prompt
      })
    });

    const data = await response.json();
    const text = data?.output?.[0]?.content?.[0]?.text;
    const parsed = JSON.parse(text);

    res.json({ subtasks: parsed.subtasks });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Fallback route
app.get("*", (_, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`✅ Server running on port ${PORT}`)
);
