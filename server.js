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
// Thay thế đoạn app.post cũ trong server.js bằng đoạn này:
app.post("/api/ai/suggest-subtasks", async (req, res) => {
  console.log("📥 Incoming request:", req.body);
  const { taskName } = req.body;

  if (!taskName) return res.status(400).json({ error: "Missing taskName" });
  
  // Nhớ đổi tên biến môi trường trên Render thành GEMINI_API_KEY nhé
  const apiKey = process.env.GEMINI_API_KEY; 
  if (!apiKey) return res.status(500).json({ error: "Server missing GEMINI_API_KEY" });

  const prompt = `
    Break this task into 3-5 subtasks.
    Return ONLY valid JSON in this format, do not use markdown code block:
    { "subtasks": ["subtask 1", "subtask 2", "subtask 3"] }
    
    Task: "${taskName}"
  `;

  try {
    // Gọi Google Gemini API qua REST (không cần cài thêm package)
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
        console.error("Gemini Error:", data);
        throw new Error(data.error?.message || "Gemini API Error");
    }

    // Lấy text trả về từ Gemini
    let text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) throw new Error("No text returned from AI");

    // Làm sạch chuỗi JSON (đôi khi AI trả về dính ```json ... ```)
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();

    const parsed = JSON.parse(text);
    console.log("✅ AI Response:", parsed);

    res.json({ subtasks: parsed.subtasks || [] });

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
