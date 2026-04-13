import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/analyze", async (req, res) => {
  const { problem } = req.body;

  if (!problem) {
    return res.status(400).json({ error: "Problem statement is required" });
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: `You are a DSA expert.

Analyze this problem:
${problem}

Return:
1. Pattern
2. Why
3. Approach`
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    res.json({ result: data.choices[0].message.content });

  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: "Something went wrong", details: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
