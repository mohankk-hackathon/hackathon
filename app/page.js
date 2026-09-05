'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Wallet, Plus, LayoutGrid, Receipt, TrendingUp, Settings as SettingsIcon,
  ArrowUpRight, ArrowDownRight, Trash2, Search, Utensils, Bolt, Car, Film,
  ShoppingBag, HeartPulse, Home, Coffee, Briefcase, Gift, MoreHorizontal,
  Upload, Sparkles, FileText, Check, X, Loader2
} from 'lucide-react'
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

const seedTransactions = () => {
  const today = new Date()
  const d = (offset) => new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset).toISOString()
  return [
    { id: crypto.randomUUID(), type: 'income',  category: 'Salary',         amount: 1850.00, note: 'October payroll',        date: d(2) },
    { id: crypto.randomUUID(), type: 'income',  category: 'Gift',           amount: 380.20,  note: 'Birthday from mom',      date: d(5) },
    { id: crypto.randomUUID(), type: 'expense', category: 'Food & Dining',  amount: 87.65,  note: 'Groceries',              date: d(1) },
    { id: crypto.randomUUID(), type: 'expense', category: 'Food & Dining',  amount: 24.20,  note: 'Ramen with friends',     date: d(3) },
    { id: crypto.randomUUID(), type: 'expense', category: 'Utilities',      amount: 82.49,  note: 'Electricity bill',       date: d(4) },
    { id: crypto.randomUUID(), type: 'expense', category: 'Transportation', amount: 43.50,  note: 'Uber rides',             date: d(6) },
    { id: crypto.randomUUID(), type: 'expense', category: 'Entertainment',  amount: 15.99,  note: 'Netflix',                date: d(2) },
    { id: crypto.randomUUID(), type: 'expense', category: 'Shopping',       amount: 129.99, note: 'New sneakers',           date: d(7) },
    { id: crypto.randomUUID(), type: 'expense', category: 'Healthcare',     amount: 60.00,  note: 'Pharmacy',               date: d(8) },
  ]
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
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ type: 'expense', category: 'Food & Dining', amount: '', note: '' })
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  // AI Import state
  const [importOpen, setImportOpen] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState('')
  const [importPreview, setImportPreview] = useState(null) // array of tx from LLM
  const [importFileName, setImportFileName] = useState('')

  // load / save
  useEffect(() => {
    try {
      const raw = localStorage.getItem('ft.transactions')
      if (raw) setTransactions(JSON.parse(raw))
      else setTransactions(seedTransactions())
    } catch { setTransactions(seedTransactions()) }
  }, [])
  useEffect(() => {
    if (transactions.length) localStorage.setItem('ft.transactions', JSON.stringify(transactions))
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

  const addTransaction = () => {
    if (!form.amount || Number(form.amount) <= 0) return
    const tx = {
      id: crypto.randomUUID(),
      type: form.type,
      category: form.category,
      amount: Number(form.amount),
      note: form.note || form.category,
      date: new Date().toISOString(),
    }
    setTransactions(prev => [tx, ...prev])
    setForm({ type: 'expense', category: 'Food & Dining', amount: '', note: '' })
    setOpen(false)
  }

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
        <div className="flex items-center gap-2">
          <Button onClick={() => setImportOpen(true)} variant="outline" className="h-12 px-4 rounded-2xl border-white/10 bg-slate-900/70 hover:bg-slate-800 text-slate-100 font-semibold text-sm">
            <Sparkles className="w-4 h-4 mr-1.5 text-emerald-400" /> Import CSV / PDF
          </Button>
          <Button onClick={() => setOpen(true)} className="h-12 px-5 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 hover:from-emerald-300 hover:to-teal-400 text-slate-900 font-bold text-base mint-glow">
            <Plus className="w-5 h-5 mr-1" strokeWidth={3} /> Add Transaction
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
            <Dashboard totals={totals} byCategory={byCategory} donutTotal={donutTotal} transactions={transactions} />
          )}
          {tab === 'transactions' && (
            <Transactions transactions={filteredTx} search={search} setSearch={setSearch} filter={filter} setFilter={setFilter} onDelete={removeTx} />
          )}
          {tab === 'analytics' && <Analytics trend={trend} byCategory={byCategory} />}
          {tab === 'settings' && <SettingsPanel onReset={() => { localStorage.removeItem('ft.transactions'); setTransactions(seedTransactions()) }} onWipe={() => { localStorage.removeItem('ft.transactions'); setTransactions([]) }} />}
        </motion.div>
      </AnimatePresence>

      {/* Add transaction dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass-card border-white/10 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">Add Transaction</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-2 bg-slate-900/70 p-1 rounded-xl border border-white/5">
              {['expense', 'income'].map((t) => (
                <button key={t} onClick={() => setForm({ ...form, type: t, category: t === 'income' ? 'Salary' : 'Food & Dining' })} className={`h-10 rounded-lg text-sm font-semibold capitalize transition ${form.type === t ? (t === 'income' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300') : 'text-slate-400'}`}>{t}</button>
              ))}
            </div>
            <div className="grid gap-2">
              <Label>Amount</Label>
              <Input type="number" step="0.01" placeholder="0.00" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className="bg-slate-900/70 border-white/10 h-12 text-lg number-font" />
            </div>
            <div className="grid gap-2">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger className="bg-slate-900/70 border-white/10 h-12"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.filter(c => form.type === 'income' ? ['Salary','Gift','Other'].includes(c.key) : !['Salary','Gift'].includes(c.key)).map(c => (
                    <SelectItem key={c.key} value={c.key}>
                      <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ background: c.color }} />{c.key}</div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Note (optional)</Label>
              <Input placeholder="e.g. Lunch with team" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} className="bg-slate-900/70 border-white/10 h-12" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} className="text-slate-400">Cancel</Button>
            <Button onClick={addTransaction} className="bg-gradient-to-br from-emerald-400 to-teal-500 hover:from-emerald-300 text-slate-900 font-bold">Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
    </div>
  )
}

function StatCard({ label, value, delta, tone }) {
  const toneCls = tone === 'income' ? 'text-emerald-400' : tone === 'expense' ? 'text-rose-400' : 'text-emerald-400'
  return (
    <div className="glass-card rounded-3xl p-6 md:p-7">
      <div className="text-slate-400 text-sm font-medium">{label}</div>
      <div className={`mt-3 text-4xl md:text-5xl font-black number-font ${toneCls}`}>{value}</div>
      <div className="mt-3 text-xs font-semibold text-emerald-400 flex items-center gap-1">+{delta}% <ArrowUpRight className="w-3.5 h-3.5" /></div>
    </div>
  )
}

function Dashboard({ totals, byCategory, donutTotal, transactions }) {
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
      {/* Top stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <StatCard label="Total Income" value={formatCurrency(totals.income)} delta={14} tone="income" />
        <StatCard label="Total Expenses" value={formatCurrency(totals.expense)} delta={14} tone="expense" />
        <StatCard label="Net Profit" value={formatCurrency(totals.net)} delta={14} tone="income" />
      </div>

      {/* Smart Insights */}
      <InsightsSection insights={insights} loading={insightsLoading} error={insightsError} onRefresh={() => loadInsights(true)} hasData={transactions.length > 0} />

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
              <div className="mt-1 text-xs font-semibold text-emerald-400 flex items-center justify-center gap-1">+14% <ArrowUpRight className="w-3 h-3" /></div>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <div className="relative w-14 h-14">
                <svg viewBox="0 0 40 40" className="w-14 h-14"><circle cx="20" cy="20" r="16" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" /><circle cx="20" cy="20" r="16" fill="none" stroke="#34d399" strokeWidth="4" strokeDasharray="75 100" strokeDashoffset="25" strokeLinecap="round" transform="rotate(-90 20 20)" /></svg>
                <ArrowUpRight className="absolute inset-0 m-auto w-5 h-5 text-emerald-400" strokeWidth={3} />
              </div>
              <div><div className="text-slate-400 text-sm">Income</div><div className="font-bold text-lg number-font">+ {formatCurrency(totals.income)}</div></div>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative w-14 h-14">
                <svg viewBox="0 0 40 40" className="w-14 h-14"><circle cx="20" cy="20" r="16" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" /><circle cx="20" cy="20" r="16" fill="none" stroke="#f43f5e" strokeWidth="4" strokeDasharray="55 100" strokeDashoffset="25" strokeLinecap="round" transform="rotate(-90 20 20)" /></svg>
                <ArrowDownRight className="absolute inset-0 m-auto w-5 h-5 text-rose-400" strokeWidth={3} />
              </div>
              <div><div className="text-slate-400 text-sm">Outcome</div><div className="font-bold text-lg number-font">− {formatCurrency(totals.expense)}</div></div>
            </div>
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

function SettingsPanel({ onReset, onWipe }) {
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
        <div className="mt-4 flex flex-wrap gap-3">
          <Button onClick={onReset} variant="outline" className="border-white/10 bg-slate-900/70">Reset to sample data</Button>
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
