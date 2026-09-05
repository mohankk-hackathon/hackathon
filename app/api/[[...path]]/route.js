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

async function classify(text) {
  const openai = new OpenAI({
    apiKey: process.env.EMERGENT_LLM_KEY,
    baseURL: process.env.EMERGENT_BASE_URL,
  })

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
