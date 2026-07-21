// Vercel serverless function: POST /api/chat { message: string }
// Holds GEMINI_API_KEY and SHEETS_API_KEY server-side. Neither key is ever
// sent to the browser. Set these as Environment Variables in the Vercel
// project dashboard (see README.md).

const SHEET_CACHE_TTL_MS = 5 * 60 * 1000;
let sheetCache = { rows: null, fetchedAt: 0 };

function setCors(res) {
  const origin = process.env.ALLOWED_ORIGIN || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

async function fetchSheetRows() {
  const now = Date.now();
  if (sheetCache.rows && now - sheetCache.fetchedAt < SHEET_CACHE_TTL_MS) {
    return sheetCache.rows;
  }

  const { SPREADSHEET_ID, SHEETS_API_KEY, SHEET_RANGE } = process.env;
  if (!SPREADSHEET_ID || !SHEETS_API_KEY) {
    throw new Error("Sheet not configured (SPREADSHEET_ID / SHEETS_API_KEY missing)");
  }

  const range = encodeURIComponent(SHEET_RANGE || "Sheet1!A:D");
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}?key=${SHEETS_API_KEY}`;

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Sheets API error ${res.status}: ${body}`);
  }
  const data = await res.json();
  const rows = data.values || [];
  sheetCache = { rows, fetchedAt: now };
  return rows;
}

function rowsToContext(rows) {
  if (!rows.length) return "No FAQ data available.";
  const [header, ...body] = rows;
  return body
    .map((row) => {
      const entry = header.map((h, i) => `${h}: ${row[i] || ""}`).join(" | ");
      return `- ${entry}`;
    })
    .join("\n");
}

async function askGemini(question, context) {
  const { GEMINI_API_KEY, GEMINI_MODEL } = process.env;
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY missing");

  const model = GEMINI_MODEL || "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

  const prompt = [
    "You are a helpful customer support assistant for the Irish retailer Dunnes Stores.",
    "Answer the customer's question using ONLY the reference FAQ entries below.",
    "If the answer isn't covered by the reference entries, say you don't have that information and suggest checking dunnesstores.com or contacting customer service — do not invent policy details.",
    "Keep answers short, friendly, and to the point.",
    "",
    "Reference FAQ entries:",
    context,
    "",
    `Customer question: ${question}`,
  ].join("\n");

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${body}`);
  }

  const data = await res.json();
  const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  return reply || "Sorry, I couldn't generate a response just now.";
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { message } = req.body || {};
    if (!message || typeof message !== "string") {
      res.status(400).json({ error: "Missing 'message' in request body" });
      return;
    }

    const rows = await fetchSheetRows();
    const context = rowsToContext(rows);
    const reply = await askGemini(message, context);

    res.status(200).json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal error handling chat request" });
  }
}
