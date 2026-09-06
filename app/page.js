'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Wallet, Plus, LayoutGrid, Receipt, TrendingUp, Settings as SettingsIcon,
  ArrowUpRight, ArrowDownRight, Trash2, Search, Utensils, Bolt, Car, Film,
  ShoppingBag, HeartPulse, Home, Coffee, Briefcase, Gift, MoreHorizontal,
  Upload, Sparkles, FileText, Check, X, Loader2,
  MessageCircle, Send, Bot, User as UserIcon, RotateCcw,
  BrainCircuit, Paperclip
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  Tooltip, CartesianGrid, BarChart, Bar,
} from 'recharts'
import { motion, AnimatePresence } from 'framer-motion'

const CATEGORIES = [
  { key: 'Food & Dining',   color: '#ef4444', icon: Utensils },
  { key: 'Utilities',       color: '#eab308', icon: Bolt },
  { key: 'Transportation',  color: '#f97316', icon: Car },
  { key: 'Entertainment',   color: '#a855f7', icon: Film },
  { key: 'Shopping',        color: '#ec4899', icon: ShoppingBag },
  { key: 'Healthcare',      color: '#06b6d4', icon: HeartPulse },
  { key: 'Housing',         color: '#22c55e', icon: Home },
  { key: 'Coffee',          color: '#f59e0b', icon: Coffee },
  { key: 'Salary',          color: '#34d399', icon: Briefcase },
  { key: 'Gift',            color: '#f43f5e', icon: Gift },
  { key: 'Other',           color: '#94a3b8', icon: MoreHorizontal },
]

const catMeta = (name) => CATEGORIES.find(c => c.key === name) || CATEGORIES[CATEGORIES.length - 1]

// Normalize a note for fuzzy comparison
const normalizeNote = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '')

// Returns the existing tx that "matches" (looks like a duplicate) or null
const findDuplicate = (tx, existing) => {
  const txDate = new Date(tx.date).toISOString().slice(0, 10)
  const txAmount = Math.round(Number(tx.amount) * 100)
  const txNoteN = normalizeNote(tx.note)
  return existing.find(e => {
    const eDate = new Date(e.date).toISOString().slice(0, 10)
    const eAmount = Math.round(Number(e.amount) * 100)
    if (eDate !== txDate) return false
    if (eAmount !== txAmount) return false
    if (e.type !== tx.type) return false
    const eNoteN = normalizeNote(e.note)
    // If either note is empty, date+amount+type alone is enough
    if (!txNoteN || !eNoteN) return true
    // Otherwise require some overlap
    return eNoteN.includes(txNoteN) || txNoteN.includes(eNoteN) || eNoteN.slice(0, 4) === txNoteN.slice(0, 4)
  }) || null
}

const formatCurrency = (n) => `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function useClock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return now
}

function App() {
  const [transactions, setTransactions] = useState([])
  const [tab, setTab] = useState('dashboard')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  // AI Import state
  const [importOpen, setImportOpen] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState('')
  const [importPreview, setImportPreview] = useState(null) // array of tx from LLM
  const [importFileName, setImportFileName] = useState('')
  // Lyzr Financial Coach Agent state
  const [lyzrOpen, setLyzrOpen] = useState(false)

  // load / save
  useEffect(() => {
    try {
      const raw = localStorage.getItem('ft.transactions')
      if (raw) setTransactions(JSON.parse(raw))
    } catch {}
  }, [])
  useEffect(() => {
    try {
      localStorage.setItem('ft.transactions', JSON.stringify(transactions))
    } catch {}
  }, [transactions])

  const now = useClock()
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: '2-digit', year: 'numeric' }).toUpperCase()
  const timeStr = now.toLocaleTimeString('en-US', { hour12: false })

  const totals = useMemo(() => {
    let income = 0, expense = 0
    transactions.forEach(t => {
      if (t.type === 'income') income += Number(t.amount)
      else expense += Number(t.amount)
    })
    return { income, expense, net: income - expense }
  }, [transactions])

  // Real month-over-month deltas — replaces the previous hardcoded +14%.
  // We compare "this month so far" vs "same number of days in previous month"
  // so a partial current month doesn't produce misleading percentages.
  const deltas = useMemo(() => {
    const now = new Date()
    const dayOfMonth = now.getDate()
    const thisStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    // Same-day-of-month cutoff in the previous month (clamped to that month's length)
    const lastMonthLength = new Date(now.getFullYear(), now.getMonth(), 0).getDate()
    const lastCutoffDay = Math.min(dayOfMonth, lastMonthLength)
    const lastEnd = new Date(now.getFullYear(), now.getMonth() - 1, lastCutoffDay, 23, 59, 59)
    const inRange = (t, s, e) => { const d = new Date(t.date); return d >= s && d <= e }
    const sum = (arr, type) => arr.filter(t => t.type === type).reduce((s, t) => s + Number(t.amount), 0)
    const thisM = transactions.filter(t => inRange(t, thisStart, now))
    const lastM = transactions.filter(t => inRange(t, lastStart, lastEnd))
    const iThis = sum(thisM, 'income'),  iLast = sum(lastM, 'income')
    const eThis = sum(thisM, 'expense'), eLast = sum(lastM, 'expense')
    const nThis = iThis - eThis,         nLast = iLast - eLast
    const pct = (curr, prev) => {
      if (!prev) return curr > 0 ? 100 : curr < 0 ? -100 : 0
      return Math.round(((curr - prev) / Math.abs(prev)) * 100)
    }
    return {
      income:  pct(iThis, iLast),
      expense: pct(eThis, eLast),
      net:     pct(nThis, nLast),
      hasHistory: transactions.length > 0 && (iLast !== 0 || eLast !== 0),
    }
  }, [transactions])

  const byCategory = useMemo(() => {
    const m = {}
    transactions.filter(t => t.type === 'expense').forEach(t => {
      m[t.category] = (m[t.category] || 0) + Number(t.amount)
    })
    return Object.entries(m).map(([name, value]) => ({ name, value, color: catMeta(name).color })).sort((a,b) => b.value - a.value)
  }, [transactions])

  const donutTotal = byCategory.reduce((s, c) => s + c.value, 0)

  const trend = useMemo(() => {
    // Aggregate last 7 days income and expense
    const days = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      days.push({ key, label: d.toLocaleDateString('en-US', { weekday: 'short' }), income: 0, expense: 0 })
    }
    transactions.forEach(t => {
      const key = new Date(t.date).toISOString().slice(0, 10)
      const day = days.find(x => x.key === key)
      if (!day) return
      if (t.type === 'income') day.income += Number(t.amount)
      else day.expense += Number(t.amount)
    })
    return days
  }, [transactions])

  const removeTx = (id) => setTransactions(prev => prev.filter(t => t.id !== id))

  const handleImportFile = async (file) => {
    if (!file) return
    setImportError('')
    setImportPreview(null)
    setImporting(true)
    setImportFileName(file.name)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/import', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Import failed')
      if (!data.transactions?.length) throw new Error('No transactions found in the file')
      // Attach ids, run duplicate detection against existing transactions
      const enriched = data.transactions.map(t => {
        const dup = findDuplicate(t, transactions)
        return {
          ...t,
          id: crypto.randomUUID(),
          _keep: !dup,           // auto-uncheck duplicates
          _duplicate: dup ? {
            date: new Date(dup.date).toISOString().slice(0, 10),
            note: dup.note,
          } : null,
        }
      })
      setImportPreview(enriched)
    } catch (e) {
      setImportError(e.message)
    } finally {
      setImporting(false)
    }
  }

  const confirmImport = () => {
    if (!importPreview) return
    const kept = importPreview.filter(t => t._keep).map(t => ({
      id: t.id,
      type: t.type,
      category: t.category,
      amount: Number(t.amount),
      note: t.note,
      date: new Date(t.date).toISOString(),
    }))
    setTransactions(prev => [...kept, ...prev])
    setImportOpen(false)
    setImportPreview(null)
    setImportFileName('')
    setTab('transactions')
  }

  const updatePreviewRow = (id, patch) => {
    setImportPreview(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t))
  }

  const filteredTx = transactions
    .filter(t => filter === 'all' ? true : t.type === filter)
    .filter(t => search ? (t.note + ' ' + t.category).toLowerCase().includes(search.toLowerCase()) : true)

  return (
    <div className="min-h-screen w-full px-4 md:px-8 lg:px-12 py-6 md:py-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <header className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center mint-glow">
            <Wallet className="w-7 h-7 text-slate-900" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight bg-gradient-to-r from-emerald-200 via-emerald-100 to-teal-200 bg-clip-text text-transparent">Finance Tracker</h1>
            <div className="mt-1 flex items-center gap-3 text-xs md:text-sm font-semibold text-slate-400">
              <span className="tracking-widest">{dateStr}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-emerald-400 number-font">{timeStr}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={() => setLyzrOpen(true)} variant="outline" className="h-12 px-4 rounded-2xl border-violet-400/40 bg-violet-500/10 hover:bg-violet-500/20 text-violet-100 font-bold text-sm">
            <BrainCircuit className="w-4 h-4 mr-1.5 text-violet-300" /> Financial Coach Agent
          </Button>
          <Button onClick={() => setImportOpen(true)} className="h-12 px-5 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 hover:from-emerald-300 hover:to-teal-400 text-slate-900 font-bold text-base mint-glow">
            <Sparkles className="w-5 h-5 mr-1.5" strokeWidth={2.5} /> Import CSV / PDF
          </Button>
        </div>
      </header>

      {/* Tabs */}
      <nav className="mt-8 flex items-center gap-1 md:gap-2 flex-wrap">
        {[
          { key: 'dashboard',    label: 'Dashboard',    icon: LayoutGrid },
          { key: 'transactions', label: 'Transactions', icon: Receipt },
          { key: 'analytics',    label: 'Analytics',    icon: TrendingUp },
          { key: 'settings',     label: 'Settings',     icon: SettingsIcon },
        ].map(({ key, label, icon: Icon }) => {
          const active = tab === key
          return (
            <button key={key} onClick={() => setTab(key)} className={`flex items-center gap-2 h-11 px-4 md:px-5 rounded-xl text-sm font-semibold transition ${active ? 'bg-slate-900/90 text-white border border-white/10 shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}>
              <Icon className="w-4 h-4" /> {label}
            </button>
          )
        })}
      </nav>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }}>
          {tab === 'dashboard' && (
            <Dashboard totals={totals} deltas={deltas} byCategory={byCategory} donutTotal={donutTotal} transactions={transactions} onOpenImport={() => setImportOpen(true)} />
          )}
          {tab === 'transactions' && (
            <Transactions transactions={filteredTx} search={search} setSearch={setSearch} filter={filter} setFilter={setFilter} onDelete={removeTx} />
          )}
          {tab === 'analytics' && <Analytics trend={trend} byCategory={byCategory} />}
          {tab === 'settings' && <SettingsPanel onWipe={() => { localStorage.removeItem('ft.transactions'); setTransactions([]) }} />}
        </motion.div>
      </AnimatePresence>

      {/* Import CSV / PDF dialog */}
      <Dialog open={importOpen} onOpenChange={(v) => { setImportOpen(v); if (!v) { setImportPreview(null); setImportError(''); setImportFileName('') } }}>
        <DialogContent className="glass-card border-white/10 max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-emerald-400" /> AI Statement Import
            </DialogTitle>
            <p className="text-sm text-slate-400 mt-1">Drop a bank statement (.csv or .pdf) and GPT-4o will extract & categorize every transaction automatically.</p>
          </DialogHeader>

          {!importPreview && !importing && (
            <div className="mt-4">
              <label htmlFor="import-file" className="block cursor-pointer">
                <div className="rounded-2xl border-2 border-dashed border-white/10 hover:border-emerald-400/50 hover:bg-emerald-400/5 transition p-10 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto">
                    <Upload className="w-8 h-8 text-emerald-400" />
                  </div>
                  <div className="mt-4 font-semibold text-lg">Drop your file here or click to browse</div>
                  <div className="mt-1 text-sm text-slate-400">Supports .csv and .pdf up to 10 MB</div>
                </div>
                <input id="import-file" type="file" accept=".csv,text/csv,application/pdf,.pdf" className="hidden" onChange={e => handleImportFile(e.target.files?.[0])} />
              </label>
              {importError && <div className="mt-4 rounded-xl bg-rose-500/10 border border-rose-500/30 p-4 text-sm text-rose-300"><X className="w-4 h-4 inline mr-1" />{importError}</div>}
            </div>
          )}

          {importing && (
            <div className="mt-4 rounded-2xl border border-white/5 p-12 text-center">
              <Loader2 className="w-10 h-10 text-emerald-400 animate-spin mx-auto" />
              <div className="mt-4 font-semibold text-lg">Analyzing your statement…</div>
              <div className="mt-1 text-sm text-slate-400">Extracting text and asking GPT-4o to categorize {importFileName}</div>
            </div>
          )}

          {importPreview && (
            <>
              <div className="mt-4 flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-slate-300">
                  <FileText className="w-4 h-4 text-emerald-400" />
                  <span className="font-semibold">{importFileName}</span>
                  <span className="text-slate-500">·</span>
                  <span className="text-emerald-400">{importPreview.filter(t => t._keep).length} of {importPreview.length} selected</span>
                </div>
                <button onClick={() => { setImportPreview(null); setImportError('') }} className="text-slate-400 hover:text-white text-xs">Upload another file</button>
              </div>

              {(() => {
                const dupCount = importPreview.filter(t => t._duplicate).length
                if (dupCount === 0) return null
                return (
                  <div className="mt-3 rounded-xl bg-amber-500/10 border border-amber-500/30 px-4 py-3 text-sm flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                      <Sparkles className="w-4 h-4 text-amber-300" />
                    </div>
                    <div className="text-amber-100">
                      <span className="font-semibold">{dupCount} duplicate{dupCount !== 1 ? 's' : ''} detected</span>
                      <span className="text-amber-200/70"> — already in your ledger and auto-skipped. Re-check the box to import anyway.</span>
                    </div>
                  </div>
                )
              })()}

              <div className="mt-3 flex-1 overflow-auto rounded-xl border border-white/5">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-900/95 backdrop-blur">
                    <tr className="text-left text-xs text-slate-400 uppercase tracking-wider">
                      <th className="p-3 w-10"></th>
                      <th className="p-3">Date</th>
                      <th className="p-3">Description</th>
                      <th className="p-3">Category</th>
                      <th className="p-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {importPreview.map(tx => {
                      const meta = catMeta(tx.category)
                      return (
                        <tr key={tx.id} className={`${tx._keep ? '' : 'opacity-40'} ${tx._duplicate ? 'bg-amber-500/5' : ''}`}>
                          <td className="p-3">
                            <input type="checkbox" checked={tx._keep} onChange={e => updatePreviewRow(tx.id, { _keep: e.target.checked })} className="w-4 h-4 accent-emerald-500" />
                          </td>
                          <td className="p-3 text-slate-400 number-font whitespace-nowrap">{tx.date}</td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <input value={tx.note} onChange={e => updatePreviewRow(tx.id, { note: e.target.value })} className="bg-transparent focus:bg-slate-900/70 focus:outline-none focus:ring-1 focus:ring-emerald-500 rounded px-2 py-1 flex-1 min-w-0" />
                              {tx._duplicate && (
                                <span title={`Matches existing "${tx._duplicate.note}" on ${tx._duplicate.date}`} className="flex-shrink-0 inline-flex items-center gap-1 rounded-full bg-amber-500/15 text-amber-300 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 border border-amber-500/30">
                                  Duplicate
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3">
                            <Select value={tx.category} onValueChange={(v) => updatePreviewRow(tx.id, { category: v })}>
                              <SelectTrigger className="h-8 bg-slate-900/70 border-white/10 text-xs w-40">
                                <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{ background: meta.color }} />{tx.category}</div>
                              </SelectTrigger>
                              <SelectContent>
                                {CATEGORIES.map(c => (
                                  <SelectItem key={c.key} value={c.key}>
                                    <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{ background: c.color }} />{c.key}</div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className={`p-3 text-right font-bold number-font whitespace-nowrap ${tx.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {tx.type === 'income' ? '+' : '−'} {formatCurrency(tx.amount)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <DialogFooter className="mt-4">
                <Button variant="ghost" onClick={() => setImportOpen(false)} className="text-slate-400">Cancel</Button>
                <Button onClick={confirmImport} disabled={!importPreview.some(t => t._keep)} className="bg-gradient-to-br from-emerald-400 to-teal-500 hover:from-emerald-300 text-slate-900 font-bold">
                  <Check className="w-4 h-4 mr-1" strokeWidth={3} />
                  Import {importPreview.filter(t => t._keep).length} transaction{importPreview.filter(t => t._keep).length !== 1 ? 's' : ''}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Lyzr Financial Coach Agent dialog */}
      <LyzrCoachDialog open={lyzrOpen} onOpenChange={setLyzrOpen} />
    </div>
  )
}

function LyzrCoachDialog({ open, onOpenChange }) {
  const SUGGESTIONS = [
    'How much emergency fund should I have?',
    'How can I get out of debt faster?',
    'What is a good savings rate?',
    'Should I invest or pay off debt first?',
  ]
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [attachment, setAttachment] = useState(null) // File | null
  const listRef = useRef(null)
  const fileRef = useRef(null)

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages, loading])

  const pickFile = () => fileRef.current?.click()
  const onFileChosen = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    // 10 MB soft cap so uploads don't hang the browser
    if (f.size > 10 * 1024 * 1024) { setError('File too large — max 10 MB.'); return }
    setAttachment(f)
    setError('')
    e.target.value = ''
  }

  const send = async (raw) => {
    const text = (raw ?? input).trim()
    if ((!text && !attachment) || loading) return
    setInput('')
    setError('')
    setLoading(true)
    const displayed = attachment
      ? (text ? `${text}\n\n📎 ${attachment.name}` : `📎 ${attachment.name}`)
      : text
    setMessages(prev => [...prev, { role: 'user', content: displayed }])

    try {
      let res
      if (attachment) {
        const fd = new FormData()
        fd.append('message', text || `Please analyse this file: ${attachment.name}`)
        fd.append('file', attachment)
        res = await fetch('/api/lyzr', { method: 'POST', body: fd })
      } else {
        res = await fetch('/api/lyzr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text }),
        })
      }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setMessages(prev => [...prev, { role: 'assistant', content: data.response || '(empty response)' }])
      setAttachment(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const reset = () => { setMessages([]); setError(''); setAttachment(null) }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setError('') } }}>
      <DialogContent className="glass-card border-violet-400/30 max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-400 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/30">
                <BrainCircuit className="w-6 h-6 text-slate-900" strokeWidth={2.5} />
              </div>
              <div>
                <DialogTitle className="text-xl">Financial Coach Agent</DialogTitle>
                <p className="text-xs text-slate-400 mt-0.5">Powered by <span className="text-violet-300 font-semibold">Lyzr AI</span> — personalised money coaching</p>
              </div>
            </div>
            {messages.length > 0 && (
              <Button variant="ghost" size="sm" onClick={reset} className="text-slate-400 hover:text-white hover:bg-white/5 shrink-0">
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Reset
              </Button>
            )}
          </div>
        </DialogHeader>

        <div ref={listRef} className="mt-2 flex-1 overflow-y-auto rounded-2xl bg-slate-950/50 border border-white/5 p-4 space-y-3 min-h-[300px]">
          {messages.length === 0 && !loading ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-6">
              <BrainCircuit className="w-12 h-12 text-violet-400/60" />
              <div className="mt-3 text-sm text-slate-400">Ask the coach anything about your money.</div>
              <div className="mt-4 flex flex-wrap gap-2 justify-center max-w-md">
                {SUGGESTIONS.map(s => (
                  <button key={s} onClick={() => send(s)} className="text-xs font-semibold rounded-full px-3 py-1.5 border border-violet-400/30 bg-violet-500/10 text-violet-200 hover:bg-violet-500/20 transition">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((m, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
                  className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {m.role === 'assistant' && (
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-400 to-fuchsia-500 flex items-center justify-center flex-shrink-0">
                      <BrainCircuit className="w-4 h-4 text-slate-900" strokeWidth={2.5} />
                    </div>
                  )}
                  <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed max-w-[85%] ${m.role === 'user'
                    ? 'bg-gradient-to-br from-violet-500/90 to-fuchsia-500/90 text-slate-900 font-semibold'
                    : 'bg-slate-800/80 text-slate-100'}`}>
                    {m.role === 'assistant' ? (
                      <div className="prose prose-sm prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0 prose-strong:text-violet-200 prose-headings:text-violet-100">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <span>{m.content}</span>
                    )}
                  </div>
                  {m.role === 'user' && (
                    <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
                      <UserIcon className="w-4 h-4 text-slate-200" />
                    </div>
                  )}
                </motion.div>
              ))}
              {loading && (
                <div className="flex gap-2 justify-start">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-400 to-fuchsia-500 flex items-center justify-center flex-shrink-0">
                    <BrainCircuit className="w-4 h-4 text-slate-900" strokeWidth={2.5} />
                  </div>
                  <div className="rounded-2xl px-4 py-3 bg-slate-800/80 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-300 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-300 animate-bounce" style={{ animationDelay: '120ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-300 animate-bounce" style={{ animationDelay: '240ms' }} />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {error && <div className="mt-2 text-xs text-rose-300">{error}</div>}

        {/* Attachment chip */}
        {attachment && (
          <div className="mt-2 flex items-center gap-2 rounded-xl bg-violet-500/10 border border-violet-400/30 px-3 py-2 text-sm">
            <FileText className="w-4 h-4 text-violet-300 flex-shrink-0" />
            <div className="flex-1 min-w-0 truncate">
              <span className="text-violet-100 font-semibold">{attachment.name}</span>
              <span className="text-violet-300/70 ml-2">{(attachment.size / 1024).toFixed(1)} KB</span>
            </div>
            <button onClick={() => setAttachment(null)} disabled={loading} className="text-violet-300 hover:text-white flex-shrink-0" title="Remove">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <form onSubmit={(e) => { e.preventDefault(); send() }} className="mt-3 flex gap-2">
          <input ref={fileRef} type="file" accept=".csv,text/csv,application/pdf,.pdf" className="hidden" onChange={onFileChosen} />
          <Button
            type="button"
            onClick={pickFile}
            disabled={loading}
            variant="outline"
            className="h-11 px-3 rounded-md border-violet-400/30 bg-slate-900/70 hover:bg-violet-500/10 text-violet-200"
            title="Attach CSV or PDF"
          >
            <Paperclip className="w-4 h-4" />
          </Button>
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            placeholder={loading ? 'Coach is thinking…' : attachment ? 'Ask a question about this file…' : 'Ask the Financial Coach Agent…'}
            className="bg-slate-900/70 border-white/10 h-11 flex-1"
          />
          <Button type="submit" disabled={loading || (!input.trim() && !attachment)} className="h-11 px-4 bg-gradient-to-br from-violet-400 to-fuchsia-500 hover:from-violet-300 text-slate-900 font-bold">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function StatCard({ label, value, delta, tone, showDelta }) {
  const toneCls = tone === 'income' ? 'text-emerald-400' : tone === 'expense' ? 'text-rose-400' : 'text-emerald-400'
  // For expenses, an INCREASE is bad (rose); for income & net, an INCREASE is good (emerald).
  const goodDirection = tone === 'expense' ? (delta <= 0) : (delta >= 0)
  const deltaCls = goodDirection ? 'text-emerald-400' : 'text-rose-400'
  const Arrow = delta >= 0 ? ArrowUpRight : ArrowDownRight
  const sign = delta > 0 ? '+' : ''
  return (
    <div className="glass-card rounded-3xl p-6 md:p-7">
      <div className="text-slate-400 text-sm font-medium">{label}</div>
      <div className={`mt-3 text-4xl md:text-5xl font-black number-font ${toneCls}`}>{value}</div>
      {showDelta ? (
        <div className={`mt-3 text-xs font-semibold flex items-center gap-1 ${deltaCls}`}>
          {sign}{delta}% <Arrow className="w-3.5 h-3.5" />
          <span className="text-slate-500 font-normal ml-1">vs last month</span>
        </div>
      ) : (
        <div className="mt-3 text-xs text-slate-500">No prior month for comparison</div>
      )}
    </div>
  )
}

function Dashboard({ totals, deltas, byCategory, donutTotal, transactions, onOpenImport }) {
  const recent = transactions.slice(0, 6)
  const [insights, setInsights] = useState(null)
  const [insightsLoading, setInsightsLoading] = useState(false)
  const [insightsError, setInsightsError] = useState('')

  const loadInsights = async (force = false) => {
    if (!transactions.length) return
    // Check cache: valid for 30 min AND tx fingerprint matches
    const fingerprint = `${transactions.length}:${transactions[0]?.id || ''}`
    try {
      const cached = JSON.parse(localStorage.getItem('ft.insights') || 'null')
      if (!force && cached && cached.fingerprint === fingerprint && Date.now() - cached.at < 30 * 60 * 1000) {
        setInsights(cached.data)
        return
      }
    } catch {}

    setInsightsLoading(true); setInsightsError('')
    try {
      const res = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to generate insights')
      setInsights(data.insights || [])
      localStorage.setItem('ft.insights', JSON.stringify({ fingerprint, at: Date.now(), data: data.insights || [] }))
    } catch (e) {
      setInsightsError(e.message)
    } finally {
      setInsightsLoading(false)
    }
  }

  useEffect(() => { loadInsights(false) }, [transactions.length])

  return (
    <div className="mt-6 grid gap-5">
      {/* Empty-state onboarding */}
      {transactions.length === 0 && (
        <div className="glass-card rounded-3xl p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto">
            <Sparkles className="w-8 h-8 text-emerald-300" />
          </div>
          <h2 className="mt-4 text-2xl font-black">Nothing to show yet</h2>
          <p className="mt-1 text-slate-400 max-w-md mx-auto">Import a CSV or PDF bank statement and the app will fill up with your real numbers. GPT-4o will auto-categorise every row.</p>
          <div className="mt-5 flex items-center justify-center gap-3 flex-wrap">
            <Button onClick={onOpenImport} className="h-11 px-5 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 hover:from-emerald-300 text-slate-900 font-bold">
              <Sparkles className="w-4 h-4 mr-1.5" strokeWidth={2.5} /> Import Statement
            </Button>
            <a href="/sample-transactions.csv" download className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-300 hover:text-emerald-200 transition">
              <FileText className="w-4 h-4" /> Download sample CSV →
            </a>
          </div>
        </div>
      )}

      {/* Top stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <StatCard label="Total Income"   value={formatCurrency(totals.income)}  delta={deltas.income}  tone="income"  showDelta={!!deltas.hasHistory} />
        <StatCard label="Total Expenses" value={formatCurrency(totals.expense)} delta={deltas.expense} tone="expense" showDelta={!!deltas.hasHistory} />
        <StatCard label="Net Profit"     value={formatCurrency(totals.net)}     delta={deltas.net}     tone="income"  showDelta={!!deltas.hasHistory} />
      </div>

      {/* Smart Insights */}
      <InsightsSection insights={insights} loading={insightsLoading} error={insightsError} onRefresh={() => loadInsights(true)} hasData={transactions.length > 0} />

      {/* AI Coach - streaming chat with memory */}
      <CoachPanel transactions={transactions} />
      {/* Middle row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Donut */}
        <div className="glass-card rounded-3xl p-6 md:p-8">
          <h2 className="text-2xl md:text-3xl font-black">Income & Expenses</h2>
          <div className="mt-4 relative flex items-center justify-center h-[340px]">
            <div className="absolute donut-glow w-full h-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byCategory.length ? byCategory : [{ name: 'None', value: 1, color: '#334155' }]} innerRadius={95} outerRadius={140} paddingAngle={3} dataKey="value" stroke="none" cornerRadius={8}>
                    {(byCategory.length ? byCategory : [{ color: '#334155' }]).map((c, i) => <Cell key={i} fill={c.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="text-center relative z-10">
              <div className="text-5xl md:text-6xl font-black number-font">${Math.round(donutTotal)}</div>
              {deltas.hasHistory ? (
                <div className={`mt-1 text-xs font-semibold flex items-center justify-center gap-1 ${deltas.expense <= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {deltas.expense > 0 ? '+' : ''}{deltas.expense}% {deltas.expense >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                </div>
              ) : (
                <div className="mt-1 text-xs text-slate-500">this month</div>
              )}
            </div>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-4">
            {(() => {
              const total = (totals.income || 0) + (totals.expense || 0)
              const incomeArc  = total ? Math.round(((totals.income  || 0) / total) * 100) : 0
              const expenseArc = total ? Math.round(((totals.expense || 0) / total) * 100) : 0
              return (
                <>
                  <div className="flex items-center gap-3">
                    <div className="relative w-14 h-14">
                      <svg viewBox="0 0 40 40" className="w-14 h-14">
                        <circle cx="20" cy="20" r="16" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
                        <circle cx="20" cy="20" r="16" fill="none" stroke="#34d399" strokeWidth="4"
                          strokeDasharray={`${incomeArc} 100`} strokeDashoffset="25" strokeLinecap="round"
                          transform="rotate(-90 20 20)" />
                      </svg>
                      <ArrowUpRight className="absolute inset-0 m-auto w-5 h-5 text-emerald-400" strokeWidth={3} />
                    </div>
                    <div><div className="text-slate-400 text-sm">Income</div><div className="font-bold text-lg number-font">+ {formatCurrency(totals.income)}</div></div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="relative w-14 h-14">
                      <svg viewBox="0 0 40 40" className="w-14 h-14">
                        <circle cx="20" cy="20" r="16" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
                        <circle cx="20" cy="20" r="16" fill="none" stroke="#f43f5e" strokeWidth="4"
                          strokeDasharray={`${expenseArc} 100`} strokeDashoffset="25" strokeLinecap="round"
                          transform="rotate(-90 20 20)" />
                      </svg>
                      <ArrowDownRight className="absolute inset-0 m-auto w-5 h-5 text-rose-400" strokeWidth={3} />
                    </div>
                    <div><div className="text-slate-400 text-sm">Outcome</div><div className="font-bold text-lg number-font">− {formatCurrency(totals.expense)}</div></div>
                  </div>
                </>
              )
            })()}
          </div>
          <div className="mt-6 grid grid-cols-2 gap-4">
            {byCategory.slice(0, 4).map(c => {
              const pct = donutTotal ? (c.value / donutTotal) * 100 : 0
              return (
                <div key={c.name} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: c.color }} />
                    <div className="min-w-0">
                      <div className="text-slate-300 text-sm truncate">{c.name}</div>
                      <div className="font-bold number-font">${c.value.toFixed(0)}</div>
                    </div>
                  </div>
                  <div className="text-slate-400 text-sm font-semibold number-font">{pct.toFixed(1)}%</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Budget overview */}
        <div className="glass-card rounded-3xl p-6 md:p-8">
          <h2 className="text-2xl md:text-3xl font-black">Budget Overview</h2>
          <div className="mt-5 space-y-5">
            {byCategory.length === 0 && <div className="text-slate-400 text-sm">No expenses yet — add one to see your budget breakdown.</div>}
            {byCategory.map(c => {
              const pct = Math.min(100, (c.value / (donutTotal || 1)) * 100)
              return (
                <div key={c.name}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-slate-200 font-semibold">{c.name}</div>
                    <div className="font-bold number-font">{formatCurrency(c.value)}</div>
                  </div>
                  <div className="h-2 rounded-full bg-slate-800/80 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: c.color }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Recent transactions preview */}
      <div className="glass-card rounded-3xl p-6 md:p-8">
        <div className="flex items-center justify-between"><h2 className="text-2xl font-black">Recent Activity</h2></div>
        <div className="mt-4 divide-y divide-white/5">
          {recent.map(t => <TxRow key={t.id} t={t} />)}
          {recent.length === 0 && <div className="text-slate-400 py-6 text-sm">Nothing yet.</div>}
        </div>
      </div>
    </div>
  )
}

function CoachPanel({ transactions }) {
  const SUGGESTIONS = [
    'Why did dining spike?',
    'How can I save more?',
    'What is my biggest expense category?',
    'Am I on track this month?',
  ]

  const [sessionId] = useState(() => {
    if (typeof window === 'undefined') return ''
    const existing = localStorage.getItem('ft.coach.session')
    if (existing) return existing
    const id = crypto.randomUUID()
    localStorage.setItem('ft.coach.session', id)
    return id
  })
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState('')
  const listRef = useRef(null)
  const abortRef = useRef(null)

  // Load history once
  useEffect(() => {
    try {
      const raw = localStorage.getItem('ft.coach.messages')
      if (raw) setMessages(JSON.parse(raw))
    } catch {}
  }, [])

  // Persist + autoscroll on every message change
  useEffect(() => {
    try { localStorage.setItem('ft.coach.messages', JSON.stringify(messages)) } catch {}
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages])

  const send = async (raw) => {
    const text = (raw ?? input).trim()
    if (!text || streaming) return
    setInput('')
    setError('')
    setStreaming(true)

    const nextHistory = [...messages, { role: 'user', content: text }, { role: 'assistant', content: '' }]
    setMessages(nextHistory)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          session_id: sessionId,
          message: text,
          transactions,
          history: messages,
        }),
      })
      if (!res.ok || !res.body) throw new Error(`Coach API returned ${res.status}`)

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const parts = buf.split('\n\n')
        buf = parts.pop() || ''
        for (const part of parts) {
          if (!part.startsWith('data: ')) continue
          let payload
          try { payload = JSON.parse(part.slice(6)) } catch { continue }
          if (payload.error) { setError(payload.error); continue }
          if (payload.token) {
            setMessages(prev => {
              const clone = [...prev]
              const last = clone[clone.length - 1]
              clone[clone.length - 1] = { ...last, content: (last.content || '') + payload.token }
              return clone
            })
          }
          if (payload.done) {
            // final token already appended via last chunk
          }
        }
      }
    } catch (e) {
      if (e.name !== 'AbortError') setError(e.message)
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }

  const clearChat = () => {
    setMessages([])
    try { localStorage.removeItem('ft.coach.messages') } catch {}
  }

  return (
    <div className="glass-card rounded-3xl p-6 md:p-7">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center mint-glow">
              <MessageCircle className="w-5 h-5 text-slate-900" strokeWidth={2.5} />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-slate-950 animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-black leading-tight">AI Coach</h2>
            <p className="text-xs text-slate-400">Ask anything about your money — streamed answers, remembers context</p>
          </div>
        </div>
        {messages.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clearChat} className="text-slate-400 hover:text-white hover:bg-white/5">
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Clear
          </Button>
        )}
      </div>

      <div ref={listRef} className="mt-4 h-72 md:h-80 overflow-y-auto rounded-2xl bg-slate-950/50 border border-white/5 p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <Bot className="w-10 h-10 text-emerald-400/60" />
            <div className="mt-3 text-sm text-slate-400">Ask a follow-up about your spending. Try one of these:</div>
            <div className="mt-4 flex flex-wrap gap-2 justify-center max-w-md">
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => send(s)} className="text-xs font-semibold rounded-full px-3 py-1.5 border border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20 transition">
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
              className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-slate-900" strokeWidth={2.5} />
                </div>
              )}
              <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed max-w-[80%] ${m.role === 'user'
                ? 'bg-gradient-to-br from-emerald-500/90 to-teal-500/90 text-slate-900 font-semibold'
                : 'bg-slate-800/80 text-slate-100'}`}>
                {m.content || (streaming && i === messages.length - 1 ? <span className="inline-block w-1.5 h-4 bg-emerald-400 animate-pulse align-middle rounded-sm" /> : null)}
                {streaming && i === messages.length - 1 && m.content && (
                  <span className="inline-block w-1.5 h-4 bg-emerald-400 animate-pulse align-middle ml-0.5 rounded-sm" />
                )}
              </div>
              {m.role === 'user' && (
                <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
                  <UserIcon className="w-4 h-4 text-slate-200" />
                </div>
              )}
            </motion.div>
          ))
        )}
      </div>

      {error && <div className="mt-3 text-xs text-rose-300">{error}</div>}

      <form onSubmit={(e) => { e.preventDefault(); send() }} className="mt-3 flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={streaming}
          placeholder={streaming ? 'Coach is typing…' : 'Ask a follow-up question…'}
          className="bg-slate-900/70 border-white/10 h-11 flex-1"
        />
        <Button type="submit" disabled={streaming || !input.trim()} className="h-11 px-4 bg-gradient-to-br from-emerald-400 to-teal-500 hover:from-emerald-300 text-slate-900 font-bold">
          {streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </form>
    </div>
  )
}

function InsightsSection({ insights, loading, error, onRefresh, hasData }) {
  const toneStyles = {
    positive: { bg: 'bg-emerald-500/10',  border: 'border-emerald-500/30',  text: 'text-emerald-200',  accent: 'text-emerald-400' },
    warning:  { bg: 'bg-amber-500/10',    border: 'border-amber-500/30',    text: 'text-amber-100',    accent: 'text-amber-400'   },
    info:     { bg: 'bg-sky-500/10',      border: 'border-sky-500/30',      text: 'text-sky-100',      accent: 'text-sky-400'     },
  }

  return (
    <div className="glass-card rounded-3xl p-6 md:p-7">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-emerald-300" />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-black leading-tight">Smart Insights</h2>
            <p className="text-xs text-slate-400">Weekly nudges from GPT-4o about your spending</p>
          </div>
        </div>
        <Button onClick={onRefresh} disabled={loading || !hasData} variant="ghost" size="sm" className="text-slate-300 hover:text-white hover:bg-white/5">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Sparkles className="w-3.5 h-3.5 mr-1.5 text-emerald-400" /> Refresh</>}
        </Button>
      </div>

      {error && <div className="mt-4 rounded-xl bg-rose-500/10 border border-rose-500/30 p-3 text-sm text-rose-300">{error}</div>}

      {!error && loading && !insights && (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          {[0,1,2].map(i => (
            <div key={i} className="rounded-2xl p-4 border border-white/5 bg-slate-900/40 animate-pulse">
              <div className="w-10 h-10 rounded-xl bg-slate-800" />
              <div className="mt-3 h-4 bg-slate-800 rounded w-3/4" />
              <div className="mt-2 h-3 bg-slate-800 rounded w-full" />
              <div className="mt-1 h-3 bg-slate-800 rounded w-5/6" />
            </div>
          ))}
        </div>
      )}

      {!error && insights && (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {insights.map((ins, i) => {
            const t = toneStyles[ins.tone] || toneStyles.info
            return (
              <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className={`rounded-2xl p-4 border ${t.bg} ${t.border}`}>
                <div className="flex items-start gap-3">
                  <div className="text-3xl leading-none flex-shrink-0" aria-hidden>{ins.emoji}</div>
                  <div className="min-w-0">
                    <div className={`font-bold ${t.text} leading-snug`}>{ins.title}</div>
                    <div className="mt-1 text-sm text-slate-300/90 leading-relaxed">{ins.message}</div>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {!error && !loading && !insights && !hasData && (
        <div className="mt-4 rounded-xl border border-white/5 p-6 text-center text-sm text-slate-400">
          Add a few transactions and I'll spot patterns for you here.
        </div>
      )}
    </div>
  )
}

function TxRow({ t, onDelete }) {
  const meta = catMeta(t.category)
  const Icon = meta.icon
  const date = new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
  return (
    <div className="flex items-center gap-4 py-3">
      <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: `${meta.color}22` }}>
        <Icon className="w-5 h-5" style={{ color: meta.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold truncate">{t.note}</div>
        <div className="text-xs text-slate-400">{t.category} · {date}</div>
      </div>
      <div className={`font-bold number-font ${t.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>{t.type === 'income' ? '+' : '−'} {formatCurrency(t.amount)}</div>
      {onDelete && <button onClick={() => onDelete(t.id)} className="text-slate-500 hover:text-rose-400 transition"><Trash2 className="w-4 h-4" /></button>}
    </div>
  )
}

function Transactions({ transactions, search, setSearch, filter, setFilter, onDelete }) {
  return (
    <div className="mt-6 glass-card rounded-3xl p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl md:text-3xl font-black">All Transactions</h2>
        <div className="flex items-center gap-2">
          <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" className="pl-9 bg-slate-900/70 border-white/10 w-56 h-10" />
          </div>
          <div className="flex bg-slate-900/70 rounded-xl border border-white/5 p-1">
            {['all', 'income', 'expense'].map(f => (
              <button key={f} onClick={() => setFilter(f)} className={`h-8 px-3 rounded-lg text-xs font-semibold capitalize transition ${filter === f ? 'bg-white/10 text-white' : 'text-slate-400'}`}>{f}</button>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-4 divide-y divide-white/5">
        {transactions.map(t => <TxRow key={t.id} t={t} onDelete={onDelete} />)}
        {transactions.length === 0 && <div className="text-slate-400 py-10 text-center text-sm">No transactions match your filters.</div>}
      </div>
    </div>
  )
}

function Analytics({ trend, byCategory }) {
  return (
    <div className="mt-6 grid gap-5">
      <div className="glass-card rounded-3xl p-6 md:p-8">
        <h2 className="text-2xl md:text-3xl font-black">Last 7 days</h2>
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend}>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="label" stroke="#64748b" tickLine={false} axisLine={false} />
              <YAxis stroke="#64748b" tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: '#0b0f19', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }} />
              <Line type="monotone" dataKey="income" stroke="#34d399" strokeWidth={3} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="expense" stroke="#f43f5e" strokeWidth={3} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="glass-card rounded-3xl p-6 md:p-8">
        <h2 className="text-2xl md:text-3xl font-black">Spending by Category</h2>
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byCategory}>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="name" stroke="#64748b" tickLine={false} axisLine={false} />
              <YAxis stroke="#64748b" tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: '#0b0f19', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }} />
              <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                {byCategory.map((c, i) => <Cell key={i} fill={c.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

function SettingsPanel({ onWipe }) {
  return (
    <div className="mt-6 grid gap-5 max-w-2xl">
      <div className="glass-card rounded-3xl p-6 md:p-8">
        <h2 className="text-2xl md:text-3xl font-black">Preferences</h2>
        <div className="mt-5 space-y-4">
          <SettingRow title="Dark mode" desc="Always on. Because dashboards look better in the dark." control={<Switch defaultChecked disabled />} />
          <SettingRow title="Currency" desc="Display all amounts in USD." control={<Select defaultValue="USD"><SelectTrigger className="w-28 bg-slate-900/70 border-white/10"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="USD">USD</SelectItem><SelectItem value="EUR">EUR</SelectItem><SelectItem value="GBP">GBP</SelectItem></SelectContent></Select>} />
        </div>
      </div>
      <div className="glass-card rounded-3xl p-6 md:p-8">
        <h2 className="text-2xl md:text-3xl font-black">Data</h2>
        <p className="mt-1 text-sm text-slate-400">All transactions live in this browser's localStorage. Grab the sample CSV to populate the app, or wipe everything below.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <a href="/sample-transactions.csv" download className="inline-flex items-center gap-1.5 h-10 px-4 rounded-md bg-slate-900/70 border border-white/10 text-sm font-semibold text-emerald-300 hover:text-emerald-200 hover:bg-slate-800 transition">
            <FileText className="w-4 h-4" /> Download sample CSV
          </a>
          <Button onClick={onWipe} variant="destructive">Delete all transactions</Button>
        </div>
      </div>
    </div>
  )
}

function SettingRow({ title, desc, control }) {
  return (
    <div className="flex items-center justify-between gap-6 py-3 border-t border-white/5 first:border-0">
      <div>
        <div className="font-semibold">{title}</div>
        <div className="text-sm text-slate-400">{desc}</div>
      </div>
      {control}
    </div>
  )
}

export default App
