# Red Pen AI

> Detect AI writing. Fix it. Sound human again.

Red Pen is a writing toolkit powered by Claude AI. Paste any text and it will scan for AI-generated patterns, check grammar, verify originality, and rewrite it to sound like a real person wrote it.

---

## Features

- **AI Detect** — Scores text 0–100 for AI patterns across four categories: Content, Language, Style, and Filler. Returns a verdict badge, category breakdown, and per-finding annotations with exact quoted phrases.
- **Grammar** — Grades writing A–F. Shows Original → Corrected diff cards for every issue, plus a full corrected version.
- **Originality** — Uses live web search to look up distinctive phrases and check whether they appear in published sources. Returns a risk level and source links.
- **Humanize** — Three-stage pipeline: draft rewrite → AI self-audit → final polished rewrite. Optional voice matching (paste a sample of your own writing).
- **AI Chat** — A context-aware writing coach with full conversation history. Load your working text as context, then ask anything.

---

## Tech Stack

- **React 19** + **Vite**
- **Claude API** (claude-sonnet-4) via Vercel Serverless Function
- No database, no backend framework — one serverless function handles all API calls

---

## Project Structure

```
redpen-ai/
├── api/
│   └── messages.js      # Serverless function — proxies Claude API calls
├── src/
│   ├── App.jsx          # Main app (all five tools)
│   └── main.jsx
├── .env.local           # Local dev only — never committed
├── vite.config.js
└── package.json
```

---

## Running Locally

**Prerequisites:** Node.js 20+, Vercel CLI

```bash
# Install Vercel CLI (once)
npm install -g vercel

# Install dependencies
npm install

# Add your API key
echo "ANTHROPIC_API_KEY=sk-ant-your-key-here" > .env.local

# Start the dev server (React + serverless function together)
npm run dev
```

Open `http://localhost:3000`

---

## Deploying to Vercel

1. Push this repo to GitHub
2. Import the repo on [vercel.com](https://vercel.com)
3. Add your environment variable in **Project Settings → Environment Variables**:
   ```
   ANTHROPIC_API_KEY = sk-ant-your-real-key-here
   ```
4. Deploy — Vercel handles the build automatically on every push to `main`

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Your Anthropic API key — get one at [console.anthropic.com](https://console.anthropic.com) |

---

## License

MIT
