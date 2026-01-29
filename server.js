const express = require("express");
const cors = require("cors");
const path = require("path");

// Load environment variables if available
try { require("dotenv").config(); } catch (e) { console.log("Production mode: Using system env vars"); }

const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// --- English Fallback Data ---
const getFallbackSubtasks = (taskName) => {
  return [
    `Research requirements for ${taskName}`,
    `Prepare necessary tools and resources`,
    `Execute core steps of ${taskName}`,
    `Review progress and finalize details`
  ];
};

app.post("/api/ai/suggest-subtasks", async (req, res) => {
  const { taskName } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  console.log("📥 Processing task (English):", taskName);

  if (!apiKey) {
    console.warn("⚠️ No API Key found. Using fallback mode.");
    return res.json({ subtasks: getFallbackSubtasks(taskName) });
  }

  try {
    // Standard model URL
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ 
          parts: [{ text: `You are a productivity assistant. Break this task into 3-5 logical subtasks in English. Return ONLY a valid JSON object: { "subtasks": ["step 1", "step 2"] }. Task: "${taskName}"` }] 
        }],
        generationConfig: {
            response_mime_type: "application/json"
        }
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
        console.error("❌ Google API Error:", JSON.stringify(data, null, 2));
        throw new Error("API Connection Failed"); 
    }

    let text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
    
    res.json({ subtasks: parsed.subtasks || [] });

  } catch (err) {
    console.warn("⚠️ Fallback triggered due to API error:", err.message);
    // Returns English fallback so the UI never stays empty
    res.json({ subtasks: getFallbackSubtasks(taskName) });
  }
});

app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public/index.html")));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));