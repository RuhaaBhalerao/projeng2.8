import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Database from "better-sqlite3";

dotenv.config();

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

// Initialize database
const db = new Database("database.db");

// Create table
db.prepare(`
  CREATE TABLE IF NOT EXISTS problems (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    problem TEXT,
    pattern TEXT,
    createdAt TEXT
  )
`).run();

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/analyze", async (req, res) => {
  const { problem } = req.body;

  if (!problem) {
    return res.status(400).json({ error: "Problem statement is required" });
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "Accept": "application/json"
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

    const rawText = await response.text();
    let data;

    try {
      data = JSON.parse(rawText);
    } catch {
      throw new Error(`Upstream returned non-JSON (${response.status}): ${rawText.slice(0, 180)}`);
    }

    if (!response.ok) {
      const upstreamMessage = data?.error?.message || data?.message || `API Error: ${response.status}`;
      throw new Error(upstreamMessage);
    }

    if (!data?.choices?.[0]?.message?.content) {
      throw new Error("Upstream response missing choices[0].message.content");
    }

    const resultText = data.choices[0].message.content;

    // Extract pattern (simple version)
    const pattern = resultText.split("\n")[0];

    // Save to database
    db.prepare(`
      INSERT INTO problems (problem, pattern, createdAt)
      VALUES (?, ?, ?)
    `).run(problem, pattern, new Date().toISOString());

    res.json({ result: resultText });

  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: "Something went wrong", details: err.message });
  }
});

// GET - Read all problems
app.get("/problems", (req, res) => {
  const rows = db.prepare("SELECT * FROM problems").all();
  res.json(rows);
});

// PUT - Update a problem
app.put("/problems/:id", (req, res) => {
  const { id } = req.params;
  const { problem } = req.body;

  db.prepare(`
    UPDATE problems SET problem = ? WHERE id = ?
  `).run(problem, id);

  res.json({ message: "Updated" });
});

// DELETE - Delete a problem
app.delete("/problems/:id", (req, res) => {
  const { id } = req.params;

  db.prepare(`
    DELETE FROM problems WHERE id = ?
  `).run(id);

  res.json({ message: "Deleted" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
