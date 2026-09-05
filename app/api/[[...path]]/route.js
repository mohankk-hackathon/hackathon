import { NextResponse } from 'next/server'
import OpenAI from 'openai'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const CATEGORIES = [
  'Food & Dining', 'Utilities', 'Transportation', 'Entertainment',
  'Shopping', 'Healthcare', 'Housing', 'Coffee', 'Salary', 'Gift', 'Other',
]

function cors(response) {
  response.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  return response
}

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 200 }))
}

async function extractText(file) {
  const buf = Buffer.from(await file.arrayBuffer())
  const name = (file.name || '').toLowerCase()

  if (name.endsWith('.pdf') || file.type === 'application/pdf') {
    // Lazy-load pdf-parse to avoid its debug harness at module load time
    const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default
    const parsed = await pdfParse(buf)
    return parsed.text
  }
  // CSV / text
  return buf.toString('utf-8')
}

function getOpenAI() {
  return new OpenAI({
    apiKey: process.env.EMERGENT_LLM_KEY,
    baseURL: process.env.EMERGENT_BASE_URL,
  })
}

async function classify(text) {
  const openai = getOpenAI()

  const trimmed = text.length > 80000 ? text.slice(0, 80000) : text

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0,
    messages: [
      {
        role: 'system',
        content: `You extract and classify bank / credit-card statement lines.
Return every transaction you can find in the input.
Rules:
- Use ONLY these categories: ${CATEGORIES.join(', ')}.
- "type" is "income" for credits/deposits/refunds/payroll and "expense" for debits/withdrawals/purchases.
- "amount" must be a positive number (absolute value), no currency symbol.
- "date" must be YYYY-MM-DD. If the year is missing, use the current year.
- "note" is a short cleaned merchant / description (e.g. "AMZN MKTPLACE" -> "Amazon").
- Skip balance rows, headers, page numbers, and empty lines.
- Never invent transactions.`,
      },
      {
        role: 'user',
        content: `Statement text:\n\n${trimmed}`,
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'bank_transactions',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            transactions: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  date: { type: 'string' },
                  note: { type: 'string' },
                  amount: { type: 'number' },
                  type: { type: 'string', enum: ['income', 'expense'] },
                  category: { type: 'string', enum: CATEGORIES },
                },
                required: ['date', 'note', 'amount', 'type', 'category'],
              },
            },
          },
          required: ['transactions'],
        },
      },
    },
  })

  const raw = completion.choices?.[0]?.message?.content
  if (!raw) return []
  const parsed = JSON.parse(raw)
  return parsed.transactions || []
}

// Build a compact stats summary from transactions so the LLM has facts, not raw data
function buildStats(transactions) {
  const now = new Date()
  const y = now.getFullYear(), m = now.getMonth()
  const thisMonthStart = new Date(y, m, 1)
  const lastMonthStart = new Date(y, m - 1, 1)
  const lastMonthEnd = new Date(y, m, 0, 23, 59, 59)

  const bucket = (tx, start, end) => tx.filter(t => {
    const d = new Date(t.date)
    return d >= start && d <= end
  })

  const thisMonth = bucket(transactions, thisMonthStart, now)
  const lastMonth = bucket(transactions, lastMonthStart, lastMonthEnd)

  const sum = (arr, type) => arr.filter(t => t.type === type).reduce((s, t) => s + Number(t.amount), 0)
  const byCat = (arr) => {
    const m = {}
    arr.filter(t => t.type === 'expense').forEach(t => { m[t.category] = (m[t.category] || 0) + Number(t.amount) })
    return m
  }
  const byMerchant = (arr) => {
    const m = {}
    arr.filter(t => t.type === 'expense').forEach(t => {
      const k = (t.note || t.category).trim()
      if (!m[k]) m[k] = { count: 0, total: 0 }
      m[k].count += 1
      m[k].total += Number(t.amount)
    })
    return m
  }

  const thisCats = byCat(thisMonth)
  const lastCats = byCat(lastMonth)
  const allCats = Array.from(new Set([...Object.keys(thisCats), ...Object.keys(lastCats)]))
  const catCompare = allCats.map(c => ({
    category: c,
    thisMonth: Math.round((thisCats[c] || 0) * 100) / 100,
    lastMonth: Math.round((lastCats[c] || 0) * 100) / 100,
    changePct: lastCats[c] ? Math.round(((thisCats[c] || 0) - lastCats[c]) / lastCats[c] * 100) : null,
  })).sort((a, b) => b.thisMonth - a.thisMonth)

  const merchants = Object.entries(byMerchant(thisMonth))
    .map(([name, v]) => ({ name, count: v.count, total: Math.round(v.total * 100) / 100 }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)

  return {
    monthLabel: now.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
    thisMonth: {
      income: Math.round(sum(thisMonth, 'income') * 100) / 100,
      expense: Math.round(sum(thisMonth, 'expense') * 100) / 100,
      count: thisMonth.length,
    },
    lastMonth: {
      income: Math.round(sum(lastMonth, 'income') * 100) / 100,
      expense: Math.round(sum(lastMonth, 'expense') * 100) / 100,
      count: lastMonth.length,
    },
    categoryChanges: catCompare.slice(0, 8),
    topMerchants: merchants,
  }
}

async function generateInsights(transactions) {
  const stats = buildStats(transactions)
  const openai = getOpenAI()

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.7,
    messages: [
      {
        role: 'system',
        content: `You are a warm, friendly personal-finance coach. Given the user's monthly spending stats, produce 3 to 5 short, punchy insights.
Rules:
- Each insight is 1 short sentence + 1 encouraging follow-up sentence.
- Use concrete numbers and percentages from the stats. Never invent numbers.
- Vary tone: use "warning" when spending jumped notably, "positive" when they saved or reduced spending, "info" for neutral observations.
- Pick one clear emoji per insight (food, transport, coffee, savings, etc).
- Keep language plain, friendly, non-judgmental — like a supportive friend texting you.
- If a category grew by less than 10% or shrank by less than 10%, don't flag it unless it's a top-3 spend category.
- If there's very little data (few transactions), give one gentle onboarding-style insight instead of forcing 3-5.`,
      },
      {
        role: 'user',
        content: `Here are my stats:\n\n${JSON.stringify(stats, null, 2)}`,
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'insights',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            insights: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  emoji: { type: 'string' },
                  title: { type: 'string' },
                  message: { type: 'string' },
                  tone: { type: 'string', enum: ['positive', 'warning', 'info'] },
                },
                required: ['emoji', 'title', 'message', 'tone'],
              },
            },
          },
          required: ['insights'],
        },
      },
    },
  })

  const raw = completion.choices?.[0]?.message?.content
  if (!raw) return { insights: [], stats }
  const parsed = JSON.parse(raw)
  return { insights: parsed.insights || [], stats }
}

async function handleRoute(request, { params }) {
  const { path = [] } = await params
  const route = `/${path.join('/')}`
  const method = request.method

  try {
    if (route === '/' && method === 'GET') {
      return cors(NextResponse.json({ message: 'Finance Tracker API' }))
    }

    if (route === '/import' && method === 'POST') {
      const form = await request.formData()
      const file = form.get('file')
      if (!file || typeof file === 'string') {
        return cors(NextResponse.json({ error: 'file is required' }, { status: 400 }))
      }

      const text = await extractText(file)
      if (!text || text.trim().length < 5) {
        return cors(NextResponse.json({ error: 'Could not extract text from file' }, { status: 422 }))
      }

      const transactions = await classify(text)

      return cors(NextResponse.json({
        count: transactions.length,
        transactions,
        preview: text.slice(0, 500),
      }))
    }

    if (route === '/insights' && method === 'POST') {
      const body = await request.json()
      const txs = Array.isArray(body?.transactions) ? body.transactions : []
      if (txs.length === 0) {
        return cors(NextResponse.json({
          insights: [{
            emoji: '👋',
            title: 'Add your first transaction',
            message: "Once you have a few entries, I'll spot patterns and share friendly nudges here.",
            tone: 'info',
          }],
        }))
      }
      const result = await generateInsights(txs)
      return cors(NextResponse.json(result))
    }

    if (route === '/coach' && method === 'POST') {
      const body = await request.json()
      const txs = Array.isArray(body?.transactions) ? body.transactions : []
      const history = Array.isArray(body?.history) ? body.history : []
      const message = String(body?.message || '').trim()
      if (!message) {
        return cors(NextResponse.json({ error: 'message is required' }, { status: 400 }))
      }

      const stats = buildStats(txs)
      const system = `You are the user's warm, practical AI Finance Coach.
Answer their question with concrete numbers from the data below.
Rules:
- Keep answers short (2-4 sentences), plain-English, non-judgemental.
- Reference actual dollar amounts and percentages from the stats.
- If the user asks about specific merchants or categories, quote the numbers.
- If they ask something the data can't answer, say so gently and suggest what to track next.
- Never invent figures.

USER'S CURRENT DATA:
${JSON.stringify(stats, null, 2)}`

      const openai = getOpenAI()
      const stream = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        stream: true,
        temperature: 0.6,
        messages: [
          { role: 'system', content: system },
          ...history.slice(-10).map(m => ({ role: m.role, content: m.content })),
          { role: 'user', content: message },
        ],
      })

      const encoder = new TextEncoder()
      const readable = new ReadableStream({
        async start(controller) {
          let full = ''
          try {
            for await (const chunk of stream) {
              const token = chunk?.choices?.[0]?.delta?.content || ''
              if (token) {
                full += token
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token })}\n\n`))
              }
            }
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, full })}\n\n`))
          } catch (err) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: err?.message || 'stream failed' })}\n\n`))
          } finally {
            controller.close()
          }
        },
      })

      return new Response(readable, {
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
          'Access-Control-Allow-Origin': process.env.CORS_ORIGINS || '*',
        },
      })
    }

    return cors(NextResponse.json({ error: `Route ${route} not found` }, { status: 404 }))
  } catch (error) {
    console.error('API Error:', error?.message, error?.stack)
    return cors(NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 },
    ))
  }
}

export const GET = handleRoute
export const POST = handleRoute
export const PUT = handleRoute
export const DELETE = handleRoute
export const PATCH = handleRoute
