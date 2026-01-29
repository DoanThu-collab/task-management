const express = require("express");
const cors = require("cors");
const path = require("path");

// Cấu hình dotenv để code chạy được cả ở Local (nếu bạn tạo file .env) và Server
require("dotenv").config(); 

// Fix import node-fetch cho CommonJS
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const app = express();
app.use(cors());
app.use(express.json());

// =======================
// 1. Cấu hình phục vụ file tĩnh (Frontend)
// =======================
// Dựa vào ảnh bạn gửi: file index.html nằm trong thư mục 'public'
app.use(express.static(path.join(__dirname, "public")));

// =======================
// 2. AI API (Google Gemini)
// =======================
app.post("/api/ai/suggest-subtasks", async (req, res) => {
  console.log("📥 Incoming request:", req.body);
  const { taskName } = req.body;

  if (!taskName) {
    return res.status(400).json({ error: "Missing taskName" });
  }

  // Lấy API Key từ biến môi trường (Render hoặc file .env)
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    console.error("❌ ERROR: Missing GEMINI_API_KEY");
    return res.status(500).json({ error: "Server chưa được cấu hình API Key" });
  }

  const prompt = `
    Break this task into 3-5 subtasks.
    Return ONLY valid JSON in this format: { "subtasks": ["step 1", "step 2", "step 3"] }
    Task: "${taskName}"
  `;

  try {
    // FIX QUAN TRỌNG: Sửa tên model thành 'gemini-1.5-flash-latest' để tránh lỗi 404
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

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
      console.error("❌ Gemini API Error:", JSON.stringify(data, null, 2));
      throw new Error(data.error?.message || "Lỗi kết nối Gemini");
    }

    let text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("AI trả về rỗng");

    const parsed = JSON.parse(text);
    console.log("✅ AI Response:", parsed);

    res.json({ subtasks: parsed.subtasks || [] });

  } catch (err) {
    console.error("❌ SERVER ERROR:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// =======================
// 3. Fallback Route
// =======================
// Giúp load trang khi F5 hoặc truy cập đường dẫn bất kỳ
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
});