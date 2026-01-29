const express = require("express");
const cors = require("cors");
const path = require("path");

// Fix lỗi crash nếu thiếu dotenv trên Render
try { require("dotenv").config(); } catch (e) { console.log("Running in production mode"); }

const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// --- Hàm tạo kết quả mẫu khi API lỗi (Fallback) ---
const getFallbackSubtasks = (taskName) => {
  return [
    `Nghiên cứu yêu cầu cho: ${taskName}`,
    `Chuẩn bị các công cụ cần thiết`,
    `Thực hiện các bước cốt lõi của ${taskName}`,
    `Kiểm tra chất lượng và hoàn thành`
  ];
};

app.post("/api/ai/suggest-subtasks", async (req, res) => {
  const { taskName } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  console.log("📥 Đang xử lý task:", taskName);

  // Nếu không có Key, trả về dữ liệu mẫu ngay lập tức
  if (!apiKey) {
    return res.json({ subtasks: getFallbackSubtasks(taskName) });
  }

  try {
    // SỬ DỤNG MODEL CHUẨN: gemini-1.5-flash (Không có -latest hay -001)
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ 
          parts: [{ text: `Chia nhỏ công việc này thành 3-5 bước bằng tiếng Việt. Trả về JSON: { "subtasks": ["bước 1", "bước 2"] }. Task: "${taskName}"` }] 
        }]
      })
    });

    const data = await response.json();
    
    // Nếu Google báo lỗi 404 hoặc bất kỳ lỗi nào khác
    if (!response.ok) {
        console.error("❌ Google API Error:", JSON.stringify(data, null, 2));
        throw new Error("API Google không phản hồi đúng"); 
    }

    let text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
    
    res.json({ subtasks: parsed.subtasks || [] });

  } catch (err) {
    console.warn("⚠️  Sử dụng chế độ Fallback do lỗi:", err.message);
    // Trả về kết quả giả để người dùng vẫn thấy subtasks
    res.json({ subtasks: getFallbackSubtasks(taskName) });
  }
});

app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public/index.html")));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server đang chạy tại port ${PORT}`));