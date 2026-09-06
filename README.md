# CoachMoney

A beautiful dark-themed personal finance dashboard built with Next.js 15, Tailwind CSS, shadcn/ui, and Recharts.

![CoachMoney](https://img.shields.io/badge/Next.js-15-black) ![Tailwind](https://img.shields.io/badge/Tailwind-3-06B6D4) ![License](https://img.shields.io/badge/license-MIT-green)

## Features

- **Dashboard** — Live totals for income, expenses & net profit
- **Donut chart** — Spend breakdown by category with center total
- **Budget overview** — Color-coded progress bars per category
- **Transactions** — Add / delete / search / filter income & expenses
- **Analytics** — 7-day trend line + spending-by-category bar chart
- **Settings** — Reset to sample data or wipe everything
- **Persistence** — Uses `localStorage` (zero backend required)
- **Fully responsive** — Works on mobile, tablet and desktop

## Getting Started

```bash
yarn install
yarn dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy on Vercel

1. Push this repo to GitHub
2. Go to [vercel.com/new](https://vercel.com/new)
3. Import the repository
4. Framework will be auto-detected as **Next.js**
5. Click **Deploy** — no environment variables required

The app will be live at `https://<your-project>.vercel.app` in under a minute.

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Styling:** Tailwind CSS + shadcn/ui
- **Charts:** Recharts
- **Icons:** lucide-react
- **Animations:** Framer Motion
- **Language:** JavaScript (React 18)

## Project Structure

```
app/
├── layout.js        # Root layout + fonts
├── page.js          # Full CoachMoney UI
└── globals.css      # Ambient gradient background & tokens
components/ui/      # shadcn primitives (Button, Dialog, Select…)
```

## License

MIT
