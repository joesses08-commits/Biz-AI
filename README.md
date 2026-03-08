# BizAI — AI Business Intelligence Platform

> Prototype · Phase 1 complete

## What this is

Upload your company CSVs → get a live business dashboard → chat with an AI analyst that uses your actual data to diagnose problems and suggest decisions.

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 14 (App Router) + React |
| Styling | Tailwind CSS |
| Charts | Recharts |
| CSV Parsing | PapaParse |
| AI | Claude API (claude-sonnet-4) |
| Storage | Supabase (Postgres + Storage) |
| Deploy | Vercel |

---

## Getting Started

### 1. Clone and install

```bash
git clone <your-repo>
cd bizai-platform
npm install
```

### 2. Set up Supabase

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Open the **SQL Editor** and run the contents of `supabase-schema.sql`
3. Go to **Storage** and create a bucket named `csv-uploads` (private)
4. Copy your project URL and keys

### 3. Set up environment variables

```bash
cp .env.local.example .env.local
```

Fill in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
ANTHROPIC_API_KEY=sk-ant-...
```

### 4. Get your Anthropic API key

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Create an API key
3. Add it to `.env.local`

### 5. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 6. Deploy to Vercel

```bash
npm install -g vercel
vercel
```

Add your env vars in the Vercel dashboard under **Project Settings → Environment Variables**.

---

## Build Phases

| Phase | Status | Description |
|---|---|---|
| Phase 1 | ✅ Complete | Project setup, layout, routing, types |
| Phase 2 | 🔜 Next | CSV upload + Supabase storage |
| Phase 3 | ⏳ Pending | Dashboard + metrics computation |
| Phase 4 | ⏳ Pending | AI chat with Claude API |
| Phase 5 | ⏳ Pending | Polish + demo prep |

---

## CSV Format Guide

Your CSV files should have these columns (flexible — the parser is forgiving):

### sales.csv
`date, product_id, product_name, customer_id, customer_name, revenue, quantity, discount`

### costs.csv
`date, category, amount, vendor, description`

### products.csv
`product_id, name, unit_cost, unit_price, category, sku`

### customers.csv
`customer_id, name, segment, region, acquisition_date`

---

## Folder Structure

```
/app
  /upload       → Phase 2: CSV uploader
  /dashboard    → Phase 3: metrics
  /chat         → Phase 4: AI analyst
  /api/chat     → Claude API route
  /api/metrics  → metrics computation route
/components
  Sidebar.tsx
  (more coming per phase)
/lib
  supabase.ts   → DB client
  utils.ts      → helpers
  metrics.ts    → (Phase 3)
  prompt.ts     → (Phase 4)
/types
  index.ts      → all TypeScript types
```
