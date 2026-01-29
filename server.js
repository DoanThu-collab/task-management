const express = require("express");
const cors = require("cors");
const path = require("path");

// FIX: Bọc try-catch để tránh crash nếu dotenv chưa cài được (phòng hờ)
try {
  require("dotenv").config();
} catch (e) {
  console.log("ℹ️  Info: Không tìm thấy dotenv, sẽ dùng biến môi trường hệ thống.");
}

// Fix import node-fetch
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const app = express();
app.use(cors());
app.use(express.json());

// 1. Serve Frontend
app.use(express.static(path.join(__dirname, "public")));

// 2. AI API
app.post("/api/ai/suggest-subtasks", async (req, res) => {
  const { taskName } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    return res.status(500).json({ error: "Server chưa cấu hình API Key" });
  }

  const prompt = `
    Break this task into 3-5 subtasks.
    Return ONLY valid JSON: { "subtasks": ["step 1", "step 2", "step 3"] }
    Task: "${taskName}"
  `;

  try {
    // FIX QUAN TRỌNG: Dùng tên phiên bản 'gemini-1.5-flash-001' (bản ổn định nhất)
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-001:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { response_mime_type: "application/json" }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("❌ Google AI Error:", JSON.stringify(data, null, 2));
      
      // Nếu vẫn lỗi 404, thử fallback về model cũ gemini-pro
      if (data.error?.code === 404) {
         throw new Error("Model không khả dụng. Hãy thử đổi sang 'gemini-pro'.");
      }
      throw new Error(data.error?.message || "Lỗi kết nối Gemini");
    }

    let text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("AI trả về rỗng");

    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
    res.json({ subtasks: parsed.subtasks || [] });

  } catch (err) {
    console.error("❌ SERVER ERROR:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// 3. Fallback Route
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});