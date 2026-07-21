# Dunnes Stores FAQ Chatbot

A GitHub Pages chat widget backed by a Google Sheet (editable FAQ content) and Gemini
(answer generation), with a Vercel serverless function in the middle so neither API
key is ever exposed in the browser.

```
docs/          static chat UI  -> deploy to GitHub Pages
api/chat.js    serverless proxy -> deploy to Vercel
data/          FAQ content
```

**Content source:** `data/dunnes-faq-starter.csv` is paraphrased from the "How to
Shop" section of the official Dunnes Stores grocery FAQ
(dunnesstoresgrocery.com/sm/delivery/rsid/258/faq), covering the online ordering
flow (account setup, basket, substitutions, vouchers, alcohol hours, checkout,
amending orders). Other sections of that FAQ (Registering, My Order, Checkout &
Payments, Gift Card, Delivery & Returns, My Account, Technical Help, Click &
Collect) aren't included yet — add them the same way if needed. Re-check against
the live site periodically since policies (e.g. voucher terms, alcohol hours) can
change.

## 1. Set up the Google Sheet

1. Create a new Google Sheet.
2. Import `data/dunnes-faq-starter.csv` (File > Import > Upload), or paste its
   contents into `Sheet1`, starting at cell A1. Keep the header row
   (`Category, Question, Answer, Keywords`).
3. Share it as **"Anyone with the link — Viewer"** (Share button, top right).
   This is required for read-only API-key access without OAuth.
4. Copy the spreadsheet ID from the URL:
   `https://docs.google.com/spreadsheets/d/`**`THIS_PART`**`/edit`

## 2. Get a Google Sheets API key

1. In [Google Cloud Console](https://console.cloud.google.com/), create/select a project.
2. Enable the **Google Sheets API** (APIs & Services > Library).
3. Create an API key (APIs & Services > Credentials > Create Credentials > API key).
4. Restrict it:
   - **API restrictions:** Google Sheets API only.
   - **Application restrictions:** none needed (this key is called server-side from
     Vercel, not from the browser) — but you can restrict by IP if Vercel's
     outbound IPs are known to you.

## 3. Get a Gemini API key

Get a key from [Google AI Studio](https://aistudio.google.com/apikey) and paste it
in when you deploy (step 5). Restrict it to the Generative Language API in Cloud
Console if you want extra safety.

## 4. Deploy the proxy to Vercel

1. Push this folder to a GitHub repo (or connect the existing one) and import it
   into [Vercel](https://vercel.com/new).
2. In the Vercel project's **Settings > Environment Variables**, add:

   | Name | Value |
   |---|---|
   | `GEMINI_API_KEY` | your Gemini key |
   | `SHEETS_API_KEY` | your Sheets key |
   | `SPREADSHEET_ID` | the ID from step 1.4 |
   | `SHEET_RANGE` | `Sheet1!A:D` (default, adjust if you rename the tab) |
   | `GEMINI_MODEL` | `gemini-2.5-flash` (optional, this is the default) |
   | `ALLOWED_ORIGIN` | your GitHub Pages URL, e.g. `https://yourname.github.io` |

3. Deploy. Note the resulting URL, e.g. `https://dunnes-faq-chatbot.vercel.app`.
4. Sanity check:
   ```
   curl -X POST https://YOUR-PROJECT.vercel.app/api/chat \
     -H "Content-Type: application/json" \
     -d '{"message":"What is your returns policy?"}'
   ```

## 5. Deploy the frontend to GitHub Pages

1. Edit `docs/config.js` and set `CHAT_API_BASE` to your Vercel URL from step 4.3.
2. Push this repo to GitHub.
3. In the repo's **Settings > Pages**, set source to the `main` branch, `/docs` folder.
4. Your chatbot will be live at `https://yourname.github.io/your-repo/`.

## Updating FAQ content later

Just edit the Google Sheet directly — no redeploy needed. The proxy caches sheet
reads for 5 minutes (see `SHEET_CACHE_TTL_MS` in `api/chat.js`) to avoid hitting
Sheets API quota on every message; adjust that constant if you need fresher reads.

## Notes / things to revisit

- Gemini is instructed to answer only from the sheet content and to say "I don't
  know" rather than invent policy — but review real conversations before trusting
  it for sensitive info (e.g. refund amounts).
- `ALLOWED_ORIGIN` defaults to `*` if unset — lock it to your actual GitHub Pages
  origin before sharing the link publicly.
- If you outgrow API-key sheet access (e.g. need to write back, or the sheet must
  stay private), switch to a Google service account with domain-restricted sharing.
