import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import {
  format,
  startOfWeek,
  addWeeks,
  addDays,
  isAfter,
  setHours,
  setMinutes,
  parseISO,
  isSameDay,
} from 'date-fns'
import {
  ShieldCheck,
  Plus,
  X,
  Trash2,
  LogOut,
  LifeBuoy,
  Save,
  MessageSquare,
  KeyRound,
  RefreshCcw,
  CheckCircle2,
  Send,
  UserCheck,
} from 'lucide-react'

/**
 * CellBlock v5.5 - UI iOS restore + Admin tools
 * IMPORTANT: Mantiene la lógica de inicio simplificada (Anti-Chrome Hang).
 */

const ADMIN_CONFIG = {
  name: 'Emiliano Balderas',
  email: 'emiliano.balderas@ibt.unam.mx',
  footer: 'Grupo Palomares-Ramirez | Instituto de Biotecnología UNAM',
  tagline: 'Host Cell Lab Suite – Practical tools for high-performance biotechnology.',
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('Missing Supabase env vars: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY')
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const DAYS_NAME = ['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB', 'DOM']

// ----- Manual Hood metadata (no depende de columnas) -----
const HOOD_META = {
  'Campana 1': { lab: 'Lab 10', useKey: 'virus-free' },
  'Campana 2': { lab: 'Lab 401', useKey: 'virus-free' },
  'Campana 3': { lab: 'Lab 401', useKey: 'virus' },
  'Campana 4': { lab: 'Lab 401', useKey: 'insect' },
  'Campana 5': { lab: 'Lab 401', useKey: 'bacteria' },
}

const HOOD_USE_LABEL = {
  'virus-free': 'Virus-free',
  virus: 'Virus',
  insect: 'Células de insecto',
  bacteria: 'Bacterias',
}

function getHoodMeta(h) {
  const name = (h?.name || '').trim()
  const key = Object.keys(HOOD_META).find((k) => name.startsWith(k))
  if (!key) return { lab: '—', useLabel: 'Uso no especificado', useKey: null }
  const meta = HOOD_META[key]
  return { lab: meta.lab, useLabel: HOOD_USE_LABEL[meta.useKey] || 'Uso no especificado', useKey: meta.useKey }
}

// ----- Calendar cycle (2-week rolling) -----
const CYCLE_ANCHOR_MONDAY = new Date(2026, 0, 5, 0, 0, 0, 0)

function getCycleStart(now) {
  const nowWeekStart = startOfWeek(now, { weekStartsOn: 1 })
  const anchorWeekStart = startOfWeek(CYCLE_ANCHOR_MONDAY, { weekStartsOn: 1 })
  const msPerWeek = 7 * 24 * 60 * 60 * 1000
  const weeksSince = Math.floor((nowWeekStart.getTime() - anchorWeekStart.getTime()) / msPerWeek)
  const cycleIndex = Math.floor(weeksSince / 2)
  return addWeeks(anchorWeekStart, cycleIndex * 2)
}

function getReleaseTimeForCycle(cycleStart) {
  const week2Monday = addWeeks(cycleStart, 1)
  const saturdayWeek2 = addDays(week2Monday, 5)
  return setMinutes(setHours(saturdayWeek2, 11), 0)
}

function formatReleaseMessage(releaseTime) {
  return `Los horarios de esas semanas se liberan el sábado ${format(releaseTime, 'dd/MM')} a las 11:00 AM.`
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ])
}

export default function App() {
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  // ---------- State ----------
  const [authReady, setAuthReady] = useState(false)
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)

  const [loginData, setLoginData] = useState({ email: '', password: '' })
  const [showRegModal, setShowRegModal] = useState(false)
  const [showResetModal, setShowResetModal] = useState(false)
  const [regData, setRegData] = useState({ name: '', email: '', code: '', password: '' })
  const [resetEmail, setResetEmail] = useState('')

  const [hoods, setHoods] = useState([])
  const [selectedHood, setSelectedHood] = useState(null)
  const [bookings, setBookings] = useState([])
  const [viewWeekOffset, setViewWeekOffset] = useState(0)
  const [loadingData, setLoadingData] = useState(false)

  const [selectedBooking, setSelectedBooking] = useState(null)
  const [tempNotes, setTempNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [bookingBusy, setBookingBusy] = useState(false)

  const [pendingProfiles, setPendingProfiles] = useState([])
  const [loadingApprovals, setLoadingApprovals] = useState(false)

  // Admin: password reset tool
  const [adminResetEmail, setAdminResetEmail] = useState('')
  const [adminResetBusy, setAdminResetBusy] = useState(false)

  const [nowTick, setNowTick] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNowTick(new Date()), 60 * 1000)
    return () => clearInterval(id)
  }, [])

  // ---------- Calendar computations ----------
  const cycleStart = useMemo(() => getCycleStart(nowTick), [nowTick])
  const releaseTime = useMemo(() => getReleaseTimeForCycle(cycleStart), [cycleStart])
  const weekStart = useMemo(
    () => startOfWeek(addWeeks(cycleStart, viewWeekOffset), { weekStartsOn: 1 }),
    [cycleStart, viewWeekOffset]
  )
  const weekEnd = useMemo(() => addWeeks(weekStart, 1), [weekStart])

  const isWeekLocked = (offset) => {
    if (currentUser?.is_admin) return false
    if (offset <= 1) return false
    return !isAfter(new Date(), releaseTime)
  }

  const bookingMap = useMemo(() => {
    const m = new Map()
    for (const b of bookings) {
      const t = new Date(b.start_time).getTime()
      m.set(`${b.hood_id}|${t}`, b)
    }
    return m
  }, [bookings])

  // ---------- Auth init (KEEP: simplified anti-Chrome hang) ----------
  useEffect(() => {
    const init = async () => {
      try {
        const { data: { session } } = await withTimeout(supabase.auth.getSession(), 4000)
        if (session?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single()
          if (mountedRef.current && profile) setCurrentUser({ ...profile, id: session.user.id })
        }
      } catch (e) {
        console.warn('Auth init problem')
      } finally {
        if (mountedRef.current) setAuthReady(true)
      }
    }
    init()
  }, [])

  // ---------- Data helpers ----------
  const loadProfileForAuthUser = async (authUser) => {
    if (!authUser?.id) return null
    const { data, error } = await supabase.from('profiles').select('*').eq('id', authUser.id).single()
    return error ? null : { ...data, id: authUser.id }
  }

  const refreshApprovals = async () => {
    if (!currentUser?.is_admin) return
    setLoadingApprovals(true)
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_approved', false)
        .order('created_at', { ascending: true })
      if (mountedRef.current) setPendingProfiles(data || [])
    } finally {
      if (mountedRef.current) setLoadingApprovals(false)
    }
  }

  const refreshBookingsOnly = async () => {
    if (!currentUser?.is_approved || !selectedHood?.id) return
    const { data } = await supabase
      .from('bookings')
      .select('*')
      .eq('hood_id', selectedHood.id)
      .gte('start_time', weekStart.toISOString())
      .lt('start_time', weekEnd.toISOString())
    if (mountedRef.current) setBookings(data || [])
  }

  const refreshAll = async () => {
    if (!currentUser?.is_approved) return
    setLoadingData(true)
    try {
      const { data: hoodsData } = await supabase.from('hoods').select('*').order('name')
      if (!mountedRef.current) return
      const h = hoodsData || []
      setHoods(h)
      if (h.length && !selectedHood) setSelectedHood(h[0])
      if (currentUser.is_admin) await refreshApprovals()
    } finally {
      if (mountedRef.current) setLoadingData(false)
    }
  }

  useEffect(() => {
    if (currentUser?.is_approved) refreshAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, currentUser?.is_approved])

  useEffect(() => {
    refreshBookingsOnly()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewWeekOffset, selectedHood?.id, weekStart?.getTime()])

  // ---------- Auth handlers ----------
  const handleLogin = async (e) => {
    e.preventDefault()
    if (isLoggingIn) return
    setIsLoggingIn(true)
    try {
      const email = loginData.email.trim().toLowerCase()
      const password = loginData.password

      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error

      const profile = await loadProfileForAuthUser(data.user)
      if (profile) setCurrentUser(profile)
      else alert('Tu cuenta existe, pero no encuentro profile.')
    } catch (_err) {
      alert('Error de acceso. Revisa tus datos.')
    } finally {
      if (mountedRef.current) setIsLoggingIn(false)
    }
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    const email = regData.email.trim().toLowerCase()
    const { error } = await supabase.auth.signUp({
      email,
      password: regData.password,
      options: {
        data: {
          full_name: regData.name,
          user_code: (regData.code || '').toUpperCase(),
        },
      },
    })
    if (error) return alert(error.message)
    setShowRegModal(false)
    alert('Registro creado. Tu acceso queda pendiente de aprobación por soporte.')
  }

  const handlePasswordReset = async (e) => {
    e.preventDefault()
    const email = resetEmail.trim().toLowerCase()
    if (!email) return
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    if (error) return alert('No pude enviar el correo de restablecimiento.')
    setShowResetModal(false)
    alert('Listo. Revisa tu correo para restablecer contraseña.')
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    // Mantengo tu enfoque “estable”: recarga para limpiar estado en todos los browsers.
    window.location.reload()
  }

  // ---------- Booking handlers ----------
  const handleBooking = async (day, hour) => {
    if (!currentUser?.is_approved || bookingBusy) return
    if (isWeekLocked(viewWeekOffset)) return alert(formatReleaseMessage(releaseTime))

    setBookingBusy(true)
    try {
      const targetDate = setHours(addDays(weekStart, day), hour)

      // Restricción 3 horas seguidas
      const dayHours = bookings
        .filter((b) => b.user_id === currentUser.id && isSameDay(parseISO(b.start_time), targetDate))
        .map((b) => parseISO(b.start_time).getHours())

      const allSorted = [...dayHours, hour].sort((a, b) => a - b)
      let max = 1
      let curr = 1
      for (let i = 0; i < allSorted.length - 1; i++) {
        if (allSorted[i + 1] === allSorted[i] + 1) curr++
        else curr = 1
        max = Math.max(curr, max)
      }
      if (max > 3) return alert('Límite GPR: Máximo 3 horas consecutivas.')

      const { error } = await supabase.rpc('book_slot', {
        p_hood_id: selectedHood.id,
        p_start_time: targetDate.toISOString(),
      })

      if (error) alert(error.message)
      else refreshBookingsOnly()
    } finally {
      if (mountedRef.current) setBookingBusy(false)
    }
  }

  const saveNotes = async () => {
    setSavingNotes(true)
    const { error } = await supabase.rpc('update_booking_notes', {
      p_booking_id: selectedBooking.id,
      p_notes: tempNotes,
    })
    if (!error) {
      setSelectedBooking(null)
      refreshBookingsOnly()
    }
    setSavingNotes(false)
  }

  const deleteBooking = async () => {
    if (!window.confirm('¿Borrar reserva?')) return
    const { error } = await supabase.rpc('cancel_booking', { p_booking_id: selectedBooking.id })
    if (!error) {
      setSelectedBooking(null)
      refreshBookingsOnly()
    }
  }

  // ---------- Admin: Approve users ----------
  const approveProfile = async (id) => {
    if (!currentUser?.is_admin) return
    const { error } = await supabase.from('profiles').update({ is_approved: true }).eq('id', id)
    if (error) return alert('No pude aprobar. Revisa policies.')
    await refreshApprovals()
  }

  // ---------- Admin: Send reset email (from within session) ----------
  const adminSendReset = async () => {
    if (!currentUser?.is_admin) return
    const email = adminResetEmail.trim().toLowerCase()
    if (!email) return
    setAdminResetBusy(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email)
      if (error) return alert('No pude enviar el reset (rate limit o configuración).')
      alert('Listo: envié correo de restablecimiento.')
      setAdminResetEmail('')
    } finally {
      setAdminResetBusy(false)
    }
  }

  // ---------- UI components ----------
  const SupportBox = ({ compact = false } = {}) => (
    <div className={`p-6 bg-slate-900 rounded-[2rem] text-white shadow-xl border border-slate-800 ${compact ? 'p-5' : ''}`}>
      <div className="flex items-center gap-2 text-blue-300 mb-4">
        <LifeBuoy size={18} />
        <span className="text-[10px] font-black uppercase tracking-widest">Soporte Técnico</span>
      </div>
      <p className="text-sm font-bold mb-1">{ADMIN_CONFIG.name}</p>
      <a
        href={`mailto:${ADMIN_CONFIG.email}`}
        className="text-[10px] text-blue-300 hover:underline block mb-4"
      >
        {ADMIN_CONFIG.email}
      </a>
      {!compact && (
        <p className="text-[9px] text-slate-400 leading-relaxed border-t border-white/10 pt-4 italic">
          Si necesitas aprobación de cuenta o reportar una falla, contacta directamente a soporte.
        </p>
      )}
    </div>
  )

  const iosInput =
    'w-full px-6 py-4 bg-slate-50 rounded-2xl outline-none text-sm ring-1 ring-slate-100 focus:ring-2 focus:ring-blue-500'

  const Pill = ({ children, tone = 'slate' }) => {
    const tones = {
      slate: 'bg-slate-100 text-slate-700',
      blue: 'bg-blue-50 text-blue-700',
      amber: 'bg-amber-50 text-amber-800',
      red: 'bg-red-50 text-red-700',
    }
    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${tones[tone] || tones.slate}`}>
        {children}
      </span>
    )
  }

  // ---------- Views ----------
  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
        <div className="w-full max-w-sm bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-100 text-center">
          <div className="inline-flex p-4 bg-blue-600 rounded-3xl text-white mb-6 shadow-lg shadow-blue-100">
            <ShieldCheck size={32} />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tighter">Cargando…</h1>
          <p className="text-xs text-slate-400 mt-2">Inicializando sesión y sincronización</p>
        </div>
      </div>
    )
  }

  // ---------- Login ----------
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
        <div className="w-full max-w-sm">
          <div className="bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-100 text-center">
            <div className="inline-flex p-4 bg-blue-600 rounded-3xl text-white mb-6 shadow-lg shadow-blue-100">
              <ShieldCheck size={32} />
            </div>

            <h1 className="text-4xl font-black text-slate-900 tracking-tighter mb-1">CellBlock</h1>
            <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2">HostCell Suite</p>
            <p className="text-[11px] text-slate-500 mb-8">{ADMIN_CONFIG.tagline}</p>

            <form onSubmit={handleLogin} className="space-y-3">
              <input
                required
                type="email"
                placeholder="email@ibt.unam.mx"
                className={iosInput}
                value={loginData.email}
                onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
              />
              <input
                required
                type="password"
                placeholder="Contraseña"
                className={iosInput}
                value={loginData.password}
                onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
              />
              <button
                disabled={isLoggingIn}
                className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl hover:bg-black transition-all disabled:opacity-50"
              >
                {isLoggingIn ? 'Conectando…' : 'Entrar al Lab'}
              </button>
            </form>

            <div className="mt-5 flex items-center justify-between text-xs">
              <button
                onClick={() => setShowRegModal(true)}
                className="font-bold text-blue-600 hover:underline"
              >
                Solicitar Acceso
              </button>
              <button
                onClick={() => {
                  setResetEmail(loginData.email || '')
                  setShowResetModal(true)
                }}
                className="font-bold text-slate-500 hover:underline inline-flex items-center gap-1"
              >
                <KeyRound size={14} /> Restablecer
              </button>
            </div>

            <div className="mt-6">
              <SupportBox />
            </div>
          </div>
        </div>

        {/* REGISTER MODAL */}
        {showRegModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-white p-10 rounded-[3rem] w-full max-w-md relative shadow-2xl border border-slate-100">
              <button
                onClick={() => setShowRegModal(false)}
                className="absolute top-8 right-8 text-slate-300 hover:text-slate-500"
                title="Cerrar"
              >
                <X />
              </button>

              <div className="flex items-center justify-between mb-3">
                <h2 className="text-2xl font-black">Registro GPR</h2>
                <Pill tone="amber">
                  <UserCheck size={14} /> requiere aprobación
                </Pill>
              </div>

              <p className="text-xs text-slate-500 mb-6">
                Al crear tu cuenta, tu acceso queda <span className="font-bold">pendiente de aprobación</span>. Si urge,
                contacta soporte.
              </p>

              <form onSubmit={handleRegister} className="space-y-4">
                <input
                  required
                  placeholder="Nombre completo"
                  className={iosInput}
                  value={regData.name}
                  onChange={(e) => setRegData({ ...regData, name: e.target.value })}
                />
                <input
                  required
                  type="email"
                  placeholder="email@ibt.unam.mx"
                  className={iosInput}
                  value={regData.email}
                  onChange={(e) => setRegData({ ...regData, email: e.target.value })}
                />
                <input
                  required
                  placeholder="Código (3 letras)"
                  maxLength={3}
                  className={`${iosInput} uppercase font-black tracking-widest`}
                  value={regData.code}
                  onChange={(e) => setRegData({ ...regData, code: e.target.value })}
                />
                <input
                  required
                  type="password"
                  placeholder="Contraseña"
                  className={iosInput}
                  value={regData.password}
                  onChange={(e) => setRegData({ ...regData, password: e.target.value })}
                />

                <button
                  type="submit"
                  className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-blue-100 hover:brightness-95 transition"
                >
                  Registrar
                </button>
              </form>

              <div className="mt-6">
                <SupportBox />
              </div>
            </div>
          </div>
        )}

        {/* RESET MODAL */}
        {showResetModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-white p-10 rounded-[3rem] w-full max-w-md relative shadow-2xl border border-slate-100">
              <button
                onClick={() => setShowResetModal(false)}
                className="absolute top-8 right-8 text-slate-300 hover:text-slate-500"
                title="Cerrar"
              >
                <X />
              </button>

              <h2 className="text-2xl font-black mb-2">Restablecer contraseña</h2>
              <p className="text-xs text-slate-500 mb-6">
                Enviaremos un correo con un link para cambiar tu contraseña.
              </p>

              <form onSubmit={handlePasswordReset} className="space-y-4">
                <input
                  required
                  type="email"
                  placeholder="email@ibt.unam.mx"
                  className={iosInput}
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                />
                <button
                  type="submit"
                  className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl inline-flex items-center justify-center gap-2 hover:bg-black transition"
                >
                  <KeyRound size={18} /> Enviar correo
                </button>
              </form>

              <div className="mt-6">
                <SupportBox />
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ---------- Pending approval ----------
  if (currentUser && !currentUser.is_approved) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
        <div className="w-full max-w-md bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-100">
          <div className="flex items-center justify-between mb-6">
            <div className="inline-flex p-4 bg-blue-600 rounded-3xl text-white shadow-lg shadow-blue-100">
              <ShieldCheck size={32} />
            </div>
            <button onClick={signOut} className="p-2 text-red-400 hover:text-red-600" title="Salir">
              <LogOut size={20} />
            </button>
          </div>

          <Pill tone="amber">
            <UserCheck size={14} /> Pendiente de aprobación
          </Pill>

          <h1 className="text-2xl font-black text-slate-900 tracking-tighter mt-4 mb-2">
            Acceso pendiente de aprobación
          </h1>
          <p className="text-sm text-slate-600 mb-6">
            Tu cuenta existe, pero todavía no está aprobada para ver y reservar equipos.
          </p>

          <div className="mb-6 p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <p className="text-[10px] uppercase tracking-widest font-black text-slate-400 mb-2">Tu registro</p>
            <p className="text-sm font-bold text-slate-900">{currentUser.full_name || 'Sin nombre'}</p>
            <p className="text-xs text-slate-500">{currentUser.email || 'Sin email'}</p>
            <p className="text-xs text-slate-500">Código: {currentUser.user_code || '—'}</p>
          </div>

          <SupportBox />
        </div>
      </div>
    )
  }

  // ---------- Approved app ----------
  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 overflow-x-hidden">
      <nav className="bg-white border-b border-slate-200 px-6 md:px-10 py-6 flex justify-between items-center sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <div className="bg-blue-600 p-2.5 rounded-2xl text-white shadow-lg shadow-blue-100">
            <ShieldCheck size={22} />
          </div>
          <div className="leading-tight">
            <h1 className="text-xl font-black tracking-tighter">CellBlock</h1>
            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-tight">
              {ADMIN_CONFIG.tagline}
            </p>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
              {ADMIN_CONFIG.footer}
            </p>
          </div>
        </div>

        <button onClick={signOut} className="p-2 text-red-400 hover:text-red-600" title="Salir">
          <LogOut size={20} />
        </button>
      </nav>

      <div className="max-w-[1600px] mx-auto px-6 md:px-10 mt-8 grid grid-cols-12 gap-8 pb-20">
        {/* SIDEBAR */}
        <aside className="col-span-12 lg:col-span-2 space-y-6 flex flex-col">
          <div className="flex lg:flex-col gap-2 overflow-x-auto pb-4 lg:pb-0 scrollbar-hide">
            {hoods.map((h) => {
              const meta = getHoodMeta(h)
              const active = selectedHood?.id === h.id

              return (
                <button
                  key={h.id}
                  onClick={() => setSelectedHood(h)}
                  className={`w-full text-left px-5 py-4 rounded-2xl transition-all border ${
                    active
                      ? 'bg-blue-600 text-white shadow-lg border-blue-400'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div className="text-xs font-black uppercase tracking-tighter">{h.name}</div>
                  <div className="text-[10px] mt-1 font-bold flex justify-between uppercase opacity-90">
                    <span>{meta.lab}</span>
                    <span className={active ? 'text-blue-200' : 'text-blue-600'}>{meta.useLabel}</span>
                  </div>
                </button>
              )
            })}
          </div>

          {/* ADMIN PANEL */}
          {currentUser.is_admin && (
            <div className="p-6 bg-white rounded-[2rem] shadow-xl border border-slate-100 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Admin
                </p>
                <button
                  onClick={refreshApprovals}
                  className="text-[10px] font-black text-blue-600 hover:underline inline-flex items-center gap-1"
                  disabled={loadingApprovals}
                  title="Refrescar"
                >
                  <RefreshCcw size={14} /> {loadingApprovals ? '...' : 'Refrescar'}
                </button>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Aprobaciones
                </p>

                {pendingProfiles.length === 0 ? (
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 text-xs text-slate-500">
                    No hay usuarios pendientes.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pendingProfiles.map((p) => (
                      <div key={p.id} className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {p.full_name || 'Sin nombre'}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">{p.email || 'Sin email'}</p>
                        <div className="mt-2 flex gap-2">
                          <button
                            onClick={() => approveProfile(p.id)}
                            className="flex-1 bg-blue-600 text-white font-bold py-2.5 rounded-xl text-[11px] inline-flex items-center justify-center gap-2"
                          >
                            <CheckCircle2 size={16} /> Aprobar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Reset de contraseña
                </p>
                <input
                  className={iosInput}
                  placeholder="email@ibt.unam.mx"
                  value={adminResetEmail}
                  onChange={(e) => setAdminResetEmail(e.target.value)}
                />
                <button
                  onClick={adminSendReset}
                  disabled={adminResetBusy}
                  className="w-full bg-slate-900 text-white font-bold py-3 rounded-2xl inline-flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-black transition"
                >
                  <Send size={16} /> {adminResetBusy ? 'Enviando…' : 'Enviar correo de reset'}
                </button>
                <p className="text-[10px] text-slate-500">
                  Esto envía el correo estándar de Supabase. Puede haber rate limit.
                </p>
              </div>
            </div>
          )}

          <div className="hidden lg:block mt-auto">
            <SupportBox />
          </div>
        </aside>

        {/* MAIN */}
        <main className="col-span-12 lg:col-span-10 space-y-6">
          <div className="flex overflow-x-auto gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-200 scrollbar-hide">
            {[0, 1, 2, 3].map((offset) => (
              <button
                key={offset}
                onClick={() => setViewWeekOffset(offset)}
                className={`flex-1 min-w-[110px] py-3 text-[10px] font-black rounded-xl transition-all ${
                  viewWeekOffset === offset ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'
                }`}
              >
                SEMANA {offset + 1} {isWeekLocked(offset) ? '🔒' : ''}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-[3rem] border border-slate-200 shadow-2xl overflow-hidden relative">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse table-fixed min-w-[820px]">
                <thead>
                  <tr className="bg-slate-50/60 border-b border-slate-200">
                    <th className="w-20 p-5 text-[10px] font-black text-slate-500 uppercase sticky left-0 bg-slate-50/90 backdrop-blur-md z-20 border-r border-slate-200">
                      Hora
                    </th>
                    {DAYS_NAME.map((d, i) => (
                      <th
                        key={d}
                        className="p-5 text-[11px] font-black border-l border-slate-200 uppercase text-slate-700"
                      >
                        {d}
                        <span className="block text-[9px] text-slate-400 font-normal mt-1">
                          {format(addDays(weekStart, i), 'dd/MM')}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200">
                  {HOURS.map((hour) => (
                    <tr key={hour}>
                      <td className="p-4 text-[10px] font-black text-slate-500 text-center sticky left-0 bg-white/95 backdrop-blur-md z-20 border-r border-slate-200">
                        {hour}:00
                      </td>

                      {[0, 1, 2, 3, 4, 5, 6].map((day) => {
                        const slotDate = setHours(addDays(weekStart, day), hour)
                        const booking = bookingMap.get(`${selectedHood?.id}|${slotDate.getTime()}`)
                        const isMine = booking?.user_id === currentUser.id
                        const hasNote = Boolean((booking?.notes || '').trim())

                        return (
                          <td key={day} className="border-l border-slate-200 h-16 p-1.5">
                            {booking ? (
                              <button
                                onClick={() => {
                                  setSelectedBooking(booking)
                                  setTempNotes(booking.notes || '')
                                }}
                                className={`h-full w-full rounded-2xl p-3 flex flex-col justify-center transition-all border text-left ${
                                  isMine
                                    ? 'bg-blue-600 border-blue-400 text-white shadow-lg'
                                    : 'bg-slate-50 border-slate-200 text-slate-700'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[10px] font-black uppercase tracking-tighter truncate">
                                    {booking.user_name}
                                  </span>

                                  {hasNote && (
                                    <span
                                      className={`inline-flex items-center justify-center rounded-full px-2 py-1 text-[10px] font-black ${
                                        isMine
                                          ? 'bg-amber-400/20 text-amber-200'
                                          : 'bg-amber-500/15 text-amber-700'
                                      }`}
                                      title="Esta reserva tiene notas"
                                    >
                                      <MessageSquare size={14} />
                                    </span>
                                  )}
                                </div>
                              </button>
                            ) : (
                              <button
                                disabled={isWeekLocked(viewWeekOffset) || bookingBusy || loadingData}
                                onClick={() => handleBooking(day, hour)}
                                className="w-full h-full rounded-2xl border-2 border-dashed border-slate-200 hover:border-blue-300 transition-all flex items-center justify-center opacity-40 hover:opacity-100 disabled:opacity-20"
                                title={isWeekLocked(viewWeekOffset) ? 'Bloqueado' : 'Reservar'}
                              >
                                <Plus size={18} className="text-slate-300" />
                              </button>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="lg:hidden mt-10">
            <SupportBox />
          </div>
        </main>
      </div>

      {/* BOOKING DETAILS / NOTES MODAL */}
      {selectedBooking && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-50 flex items-center justify-center p-6">
          <div className="bg-white p-10 rounded-[3rem] w-full max-w-sm shadow-2xl relative border border-slate-100">
            <button
              onClick={() => setSelectedBooking(null)}
              className="absolute top-8 right-8 text-slate-300 hover:text-slate-500"
              title="Cerrar"
            >
              <X />
            </button>

            <h3 className="text-2xl font-black mb-1">Reserva</h3>
            <p className="text-xs text-slate-500 mb-6">
              {selectedHood?.name} · {format(new Date(selectedBooking.start_time), 'dd/MM HH:mm')}
            </p>

            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Notas / Observaciones</p>
                <textarea
                  disabled={!(currentUser.is_admin || selectedBooking.user_id === currentUser.id)}
                  value={tempNotes}
                  onChange={(e) => setTempNotes(e.target.value)}
                  className="w-full p-5 bg-slate-50 rounded-2xl text-sm min-h-[150px] outline-none ring-1 ring-slate-100 focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: usaré solo 30 min / material de cuidado / limpieza especial / etc."
                />
                <p className="text-[10px] text-slate-400 mt-2">Estas notas son visibles para todos los usuarios aprobados.</p>
              </div>

              {(currentUser.is_admin || selectedBooking.user_id === currentUser.id) && (
                <div className="flex gap-2">
                  <button
                    onClick={saveNotes}
                    disabled={savingNotes}
                    className="flex-1 bg-blue-600 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-blue-100 disabled:opacity-50 hover:brightness-95 transition"
                  >
                    <Save size={18} /> {savingNotes ? 'Guardando…' : 'Guardar'}
                  </button>
                  <button
                    onClick={deleteBooking}
                    className="bg-red-50 text-red-600 font-bold px-6 py-4 rounded-2xl hover:bg-red-100 transition"
                    title="Borrar"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}