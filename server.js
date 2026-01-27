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

  // Render cannot read your local .env file, so this check is vital
  if (!process.env.OPENAI_API_KEY) {
    console.error("❌ Missing API Key");
    return res.status(500).json({ error: "Server missing API Key configuration" });
  }

  const prompt = `
  Break the task into 3–5 subtasks.
  Return ONLY valid JSON in this format:
  { "subtasks": ["..."] }
  
  Task: "${taskName}"
  `;

  try {
    // FIX: Use the correct Chat Completions endpoint
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [ // FIX: Use 'messages' instead of 'input'
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" } // Ensure JSON response
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
        console.error("OpenAI Error:", data);
        throw new Error(data.error?.message || "OpenAI API Error");
    }

    // FIX: Correct path to extract content from OpenAI response
    const text = data.choices[0].message.content;
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
