const express = require("express");
const cors = require("cors");
const path = require("path");

// Import node-fetch (hỗ trợ các phiên bản nodejs cũ/mới)
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const app = express();
app.use(cors());
app.use(express.json());

// =======================
// 1. Serve Frontend
// =======================
// Đảm bảo bạn đã tạo folder 'public' và bỏ file index.html vào đó
app.use(express.static(path.join(__dirname, "public")));

// =======================
// 2. AI API (Google Gemini)
// =======================
app.post("/api/ai/suggest-subtasks", async (req, res) => {
  console.log("📥 Incoming request:", req.body);
  const { taskName } = req.body;

  // Validate input
  if (!taskName) {
    return res.status(400).json({ error: "Missing taskName" });
  }

  // Lấy API Key từ Environment Variable (Trên Render)
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("❌ Lỗi: Chưa cấu hình GEMINI_API_KEY trên Render");
    return res.status(500).json({ error: "Server configuration error: Missing API Key" });
  }

  const prompt = `
    Break this task into 3-5 subtasks.
    Return ONLY valid JSON in this format, do not use markdown code block:
    { "subtasks": ["subtask 1", "subtask 2", "subtask 3"] }
    
    Task: "${taskName}"
  `;

  try {
    // FIX: Sử dụng model 'gemini-pro' (ổn định nhất, không bị lỗi 404)
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
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

    // Xử lý lỗi từ Google API
    if (!response.ok) {
        console.error("Gemini API Error:", JSON.stringify(data, null, 2));
        throw new Error(data.error?.message || "Lỗi kết nối đến Gemini AI");
    }

    // Lấy text trả về
    let text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) throw new Error("AI không trả về kết quả nào");

    // Làm sạch chuỗi JSON (xóa ```json và ``` nếu có)
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();

    // Parse JSON
    const parsed = JSON.parse(text);
    console.log("✅ AI Response Success:", parsed);

    res.json({ subtasks: parsed.subtasks || [] });

  } catch (err) {
    console.error("❌ AI ERROR:", err.message);
    // Trả lỗi về cho Frontend biết đường hiển thị
    res.status(500).json({ error: "Không thể tạo subtask lúc này. " + err.message });
  }
});

// =======================
// 3. Fallback Route (Chống lỗi 404 khi F5 trang)
// =======================
app.use((req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

// =======================
// Start Server
// =======================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});