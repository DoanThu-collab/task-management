const express = require("express");
const cors = require("cors");
const path = require("path");

// Fix import node-fetch cho CommonJS
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const app = express();
app.use(cors());
app.use(express.json());

// =======================
// 1. Serve Frontend
// =======================
app.use(express.static(path.join(__dirname, "public")));

// =======================
// 2. AI API (Google Gemini 1.5 Flash)
// =======================
app.post("/api/ai/suggest-subtasks", async (req, res) => {
  console.log("📥 Incoming request:", req.body);
  const { taskName } = req.body;

  if (!taskName) {
    return res.status(400).json({ error: "Missing taskName" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("❌ ERROR: Missing GEMINI_API_KEY in Environment Variables");
    return res.status(500).json({ error: "Server missing API Key" });
  }

  // Prompt cho AI
  const prompt = `
    Break this task into 3-5 subtasks.
    Return ONLY valid JSON in this format, do not use markdown code block:
    { "subtasks": ["subtask 1", "subtask 2", "subtask 3"] }
    
    Task: "${taskName}"
  `;

  try {
    // FIX QUAN TRỌNG:
    // 1. Dùng model 'gemini-1.5-flash' (Bản ổn định nhất hiện nay)
    // 2. Dùng endpoint 'v1beta' chuẩn
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }]
      })
    });

    const data = await response.json();

    // Log chi tiết lỗi nếu Google từ chối
    if (!response.ok) {
      console.error("❌ Gemini API Error Details:", JSON.stringify(data, null, 2));
      
      // Check lỗi cụ thể để báo user
      const errorMessage = data.error?.message || "Lỗi kết nối đến Gemini AI";
      if (data.error?.code === 404) {
        throw new Error("Model không tồn tại hoặc Key không hợp lệ. Hãy tạo Key mới tại aistudio.google.com");
      }
      throw new Error(errorMessage);
    }

    // Lấy nội dung trả về
    let text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("AI không trả về kết quả nào (Empty response)");

    // Làm sạch chuỗi JSON (xóa ```json ... ``` do AI hay thêm vào)
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();

    const parsed = JSON.parse(text);
    console.log("✅ AI Response Success:", parsed);

    res.json({ subtasks: parsed.subtasks || [] });

  } catch (err) {
    console.error("❌ SERVER ERROR:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// =======================
// 3. Fallback Route
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