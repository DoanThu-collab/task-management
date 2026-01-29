const express = require("express");
const cors = require("cors");
const path = require("path");

// Fix lỗi crash nếu thiếu dotenv
try { require("dotenv").config(); } catch (e) {}

const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.post("/api/ai/suggest-subtasks", async (req, res) => {
  const { taskName } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) return res.status(500).json({ error: "Thiếu API Key" });

  try {
    // FIX FINAL: Chuyển về 'gemini-pro' (Model ổn định nhất, không bị lỗi 404)
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;
    
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ 
          parts: [{ 
            text: `You are a task manager. Break this task into 3-5 subtasks. Return valid JSON only: { "subtasks": ["step 1", "step 2"] }. Task: "${taskName}"` 
          }] 
        }]
        // Đã bỏ generationConfig để tương thích với gemini-pro
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
        console.error("❌ Google AI Error:", JSON.stringify(data, null, 2));
        throw new Error(data.error?.message || "Lỗi kết nối Gemini");
    }

    let text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    
    // Làm sạch chuỗi JSON vì gemini-pro hay trả về kèm text thừa
    const jsonString = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(jsonString);
    
    res.json({ subtasks: parsed.subtasks || [] });

  } catch (err) {
    console.error("❌ SERVER ERROR:", err.message);
    // Trả về dữ liệu giả lập nếu AI vẫn lỗi để app không bị treo
    res.json({ 
        subtasks: ["Lên kế hoạch", "Thực hiện", "Kiểm tra lại (AI đang bận)"] 
    });
  }
});

app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public/index.html")));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server chạy port ${PORT}`));