'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Wallet, Plus, LayoutGrid, Receipt, TrendingUp, Settings as SettingsIcon,
  ArrowUpRight, ArrowDownRight, Trash2, Search, Utensils, Bolt, Car, Film,
  ShoppingBag, HeartPulse, Home, Coffee, Briefcase, Gift, MoreHorizontal
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
        <Button onClick={() => setOpen(true)} className="h-12 px-5 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 hover:from-emerald-300 hover:to-teal-400 text-slate-900 font-bold text-base mint-glow">
          <Plus className="w-5 h-5 mr-1" strokeWidth={3} /> Add Transaction
        </Button>
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
  return (
    <div className="mt-6 grid gap-5">
      {/* Top stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <StatCard label="Total Income" value={formatCurrency(totals.income)} delta={14} tone="income" />
        <StatCard label="Total Expenses" value={formatCurrency(totals.expense)} delta={14} tone="expense" />
        <StatCard label="Net Profit" value={formatCurrency(totals.net)} delta={14} tone="income" />
      </div>

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
