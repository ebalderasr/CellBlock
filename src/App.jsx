import React, { useEffect, useMemo, useState } from 'react'
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
  addHours,
  isSameDay,
} from 'date-fns'
import {
  ShieldCheck,
  Plus,
  X,
  Trash2,
  LogOut,
  Smartphone,
  LifeBuoy,
  Save,
  MessageSquare,
  KeyRound,
} from 'lucide-react'

/**
 * Sprint 1 assumptions (Supabase side):
 * - Auth enabled (email/password)
 * - public.profiles exists with: id(uuid, auth.users), email, full_name, user_code, is_admin, is_approved
 * - RLS ON for profiles, hoods, bookings
 * - RPC functions exist and are granted to authenticated:
 *    - book_slot(p_hood_id uuid, p_start_time timestamptz) returns uuid
 *    - update_booking_notes(p_booking_id uuid, p_notes text) returns void
 *    - cancel_booking(p_booking_id uuid) returns void
 */

const ADMIN_CONFIG = {
  name: 'Emiliano Balderas',
  email: 'emiliano.balderas@ibt.unam.mx',
}

// Hardening opcional: si faltan envs, falla rápido
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error(
    'Missing Supabase env vars: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY'
  )
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const DAYS_NAME = ['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB', 'DOM']

// ----- Hood labels -----
const HOOD_USE_LABEL = {
  'virus-free': 'Virus-free',
  virus: 'Virus',
  insect: 'Células de insecto',
  bacteria: 'Bacterias',
}
function formatHoodUse(biosafety_use) {
  return HOOD_USE_LABEL[biosafety_use] || (biosafety_use ? String(biosafety_use) : 'Uso no especificado')
}

// ----- Calendar cycle (2-week rolling cycle) -----
// Anchor Monday for stable two-week grouping. Any Monday works.
const CYCLE_ANCHOR_MONDAY = new Date(2026, 0, 5, 0, 0, 0, 0) // 2026-01-05 local time

function getCycleStart(now) {
  const nowWeekStart = startOfWeek(now, { weekStartsOn: 1 })
  const anchorWeekStart = startOfWeek(CYCLE_ANCHOR_MONDAY, { weekStartsOn: 1 })
  const msPerWeek = 7 * 24 * 60 * 60 * 1000
  const weeksSince = Math.floor((nowWeekStart.getTime() - anchorWeekStart.getTime()) / msPerWeek)
  const cycleIndex = Math.floor(weeksSince / 2) // 2-week cycles
  return addWeeks(anchorWeekStart, cycleIndex * 2)
}

function getReleaseTimeForCycle(cycleStart) {
  // Saturday of Week 2 at 11:00 AM
  // cycleStart = Monday of Week 1
  // Week 2 starts at cycleStart + 1 week
  // Saturday = +5 days from Monday
  const week2Monday = addWeeks(cycleStart, 1)
  const saturdayWeek2 = addDays(week2Monday, 5)
  return setMinutes(setHours(saturdayWeek2, 11), 0)
}

function formatReleaseMessage(releaseTime) {
  // “sábado 08/03 a las 11:00 AM”
  return `Los horarios de esas semanas se liberan el sábado ${format(releaseTime, 'dd/MM')} a las 11:00 AM.`
}

export default function App() {
  // Auth/Profile
  const [authReady, setAuthReady] = useState(false)
  const [currentUser, setCurrentUser] = useState(null) // profile + id

  // Login/Register UI
  const [loginData, setLoginData] = useState({ email: '', password: '' })
  const [showRegModal, setShowRegModal] = useState(false)
  const [showResetModal, setShowResetModal] = useState(false)
  const [regData, setRegData] = useState({ name: '', email: '', code: '', password: '' })
  const [resetEmail, setResetEmail] = useState('')

  // PWA modal
  const [showPwaModal, setShowPwaModal] = useState(false)

  // Data
  const [hoods, setHoods] = useState([])
  const [selectedHood, setSelectedHood] = useState(null)
  const [bookings, setBookings] = useState([])
  const [viewWeekOffset, setViewWeekOffset] = useState(0) // 0..3
  const [loadingData, setLoadingData] = useState(false)

  // Booking details / notes
  const [selectedBooking, setSelectedBooking] = useState(null)
  const [tempNotes, setTempNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [bookingBusy, setBookingBusy] = useState(false)

  // Admin approvals
  const [pendingProfiles, setPendingProfiles] = useState([])
  const [loadingApprovals, setLoadingApprovals] = useState(false)

  // "Now" ticker to allow cycle rollover at Sunday midnight automatically
  const [nowTick, setNowTick] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNowTick(new Date()), 60 * 1000) // every minute
    return () => clearInterval(id)
  }, [])

  // ----- Cycle-based week window -----
  const cycleStart = useMemo(() => getCycleStart(nowTick), [nowTick])
  const releaseTime = useMemo(() => getReleaseTimeForCycle(cycleStart), [cycleStart])

  const weekStart = useMemo(() => {
    return startOfWeek(addWeeks(cycleStart, viewWeekOffset), { weekStartsOn: 1 })
  }, [cycleStart, viewWeekOffset])

  const weekEnd = useMemo(() => addWeeks(weekStart, 1), [weekStart])

  const isWeekLocked = (offset) => {
    if (currentUser?.is_admin) return false
    // Week 1 & 2 open (offset 0,1)
    if (offset <= 1) return false
    // Week 3 & 4 locked until Saturday of Week 2 at 11:00
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

  const signOut = async () => {
    await supabase.auth.signOut()
    setCurrentUser(null)
    setBookings([])
    setHoods([])
    setSelectedHood(null)
  }

  // ---------- Fetch profile from auth session ----------
  const loadProfileForAuthUser = async (authUser) => {
    if (!authUser?.id) return null
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .single()

    if (error) return null
    return { ...data, id: authUser.id }
  }

  // ---------- Data loading ----------
  const fetchHoods = async () => {
    const { data, error } = await supabase.from('hoods').select('*').order('name')
    if (error) return []
    return data || []
  }

  const fetchBookingsForWeekAndHood = async (hoodId, start, end) => {
    if (!hoodId) return []
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('hood_id', hoodId)
      .gte('start_time', start.toISOString())
      .lt('start_time', end.toISOString())

    if (error) return []
    return data || []
  }

  const refreshAll = async ({ keepHood = true } = {}) => {
    if (!currentUser?.is_approved) return

    setLoadingData(true)
    try {
      const h = await fetchHoods()
      setHoods(h)

      let hood = selectedHood
      if (!keepHood || !hood) hood = h?.[0] || null
      setSelectedHood(hood)

      if (hood?.id) {
        const b = await fetchBookingsForWeekAndHood(hood.id, weekStart, weekEnd)
        setBookings(b)
      } else {
        setBookings([])
      }
    } finally {
      setLoadingData(false)
    }
  }

  const refreshBookingsOnly = async () => {
    if (!currentUser?.is_approved) return
    if (!selectedHood?.id) return
    const b = await fetchBookingsForWeekAndHood(selectedHood.id, weekStart, weekEnd)
    setBookings(b)
  }

  const refreshApprovals = async () => {
    if (!currentUser?.is_admin) return
    setLoadingApprovals(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_approved', false)
        .order('created_at', { ascending: true })

      if (!error) setPendingProfiles(data || [])
    } finally {
      setLoadingApprovals(false)
    }
  }

  // ---------- Boot: attach to auth state ----------
  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser()
      const authUser = data?.user

      if (authUser) {
        const profile = await loadProfileForAuthUser(authUser)
        if (profile) setCurrentUser(profile)
      }

      setAuthReady(true)
    }

    init()

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const authUser = session?.user
      if (!authUser) {
        setCurrentUser(null)
        setBookings([])
        setHoods([])
        setSelectedHood(null)
        return
      }

      const profile = await loadProfileForAuthUser(authUser)
      setCurrentUser(profile)
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  // When user becomes approved, load data.
  useEffect(() => {
    if (!currentUser?.id) return
    if (currentUser.is_approved) {
      refreshAll({ keepHood: false })
      if (currentUser.is_admin) refreshApprovals()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, currentUser?.is_approved])

  // Reload bookings when week/hood/cycle changes
  useEffect(() => {
    if (!currentUser?.is_approved) return
    refreshBookingsOnly()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewWeekOffset, selectedHood?.id, cycleStart?.getTime()])

  // ---------- Auth handlers ----------
  const handleLogin = async (e) => {
    e.preventDefault()

    const email = loginData.email.trim().toLowerCase()
    const password = loginData.password

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error || !data?.user) {
      return alert('No pude iniciar sesión. Verifica correo/contraseña o usa “Restablecer contraseña”.')
    }

    const profile = await loadProfileForAuthUser(data.user)
    if (!profile) {
      await supabase.auth.signOut()
      return alert('Tu cuenta existe, pero no encuentro profile. Revisa el trigger de profiles en Supabase.')
    }

    setCurrentUser(profile)

    if (!profile.is_approved) {
      return
    }

    await refreshAll({ keepHood: false })
    if (profile.is_admin) await refreshApprovals()
  }

  const handleRegister = async (e) => {
    e.preventDefault()

    const email = regData.email.trim().toLowerCase()
    if (!email.includes('@')) return alert('Ingresa un correo válido.')

    const { data, error } = await supabase.auth.signUp({
      email,
      password: regData.password,
      options: {
        data: {
          full_name: regData.name,
          user_code: (regData.code || '').toUpperCase(),
        },
      },
    })

    if (error) {
      const msg = (error.message || '').toLowerCase()
      if (msg.includes('already') || msg.includes('exists') || msg.includes('registered')) {
        return alert('Ese correo ya existe. Intenta “Entrar” o usa “Restablecer contraseña”.')
      }
      console.error(error)
      return alert('No pude registrar el usuario. Revisa consola.')
    }

    setShowRegModal(false)
    alert('Registro creado. Tu acceso quedará pendiente de aprobación por el admin.')

    if (data?.session?.user) {
      // onAuthStateChange handles it
    }
  }

  const handlePasswordReset = async (e) => {
    e.preventDefault()
    const email = resetEmail.trim().toLowerCase()
    if (!email.includes('@')) return alert('Ingresa un correo válido.')

    const { error } = await supabase.auth.resetPasswordForEmail(email)
    if (error) {
      console.error(error)
      return alert('No pude enviar el correo de restablecimiento.')
    }

    setShowResetModal(false)
    alert('Listo. Revisa tu correo para restablecer contraseña.')
  }

  // ---------- Booking handlers (RPC) ----------
  const handleBooking = async (day, hour) => {
    if (!currentUser?.is_approved) return alert('Tu cuenta está pendiente de aprobación.')
    if (!selectedHood?.id) return alert('No hay equipo seleccionado.')

    if (isWeekLocked(viewWeekOffset)) {
      return alert(formatReleaseMessage(releaseTime))
    }

    if (bookingBusy) return
    setBookingBusy(true)

    try {
      const targetDate = setHours(addDays(weekStart, day), hour)

      const dayHours = bookings
        .filter(
          (b) =>
            b.user_id === currentUser.id &&
            b.hood_id === selectedHood.id &&
            isSameDay(parseISO(b.start_time), targetDate)
        )
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

      if (error) return alert(error.message || 'No se pudo reservar.')

      await refreshBookingsOnly()
    } finally {
      setBookingBusy(false)
    }
  }

  const openBookingDetails = (booking) => {
    setSelectedBooking(booking)
    setTempNotes(booking?.notes || '')
  }

  const hasNotes = (booking) => {
    return Boolean((booking?.notes || '').trim())
  }

  const saveNotes = async () => {
    if (!selectedBooking?.id) return
    if (!currentUser?.is_approved) return alert('Tu cuenta está pendiente de aprobación.')

    const isOwner = selectedBooking.user_id === currentUser.id
    const canEdit = isOwner || currentUser.is_admin
    if (!canEdit) return

    setSavingNotes(true)
    try {
      const { error } = await supabase.rpc('update_booking_notes', {
        p_booking_id: selectedBooking.id,
        p_notes: tempNotes,
      })

      if (error) return alert(error.message || 'Error al guardar notas.')

      setSelectedBooking(null)
      await refreshBookingsOnly()
    } finally {
      setSavingNotes(false)
    }
  }

  const deleteBooking = async () => {
    if (!selectedBooking?.id) return
    if (!currentUser?.is_approved) return alert('Tu cuenta está pendiente de aprobación.')

    const isOwner = selectedBooking.user_id === currentUser.id
    const canDelete = isOwner || currentUser.is_admin
    if (!canDelete) return

    if (!window.confirm('¿Borrar esta reserva?')) return

    const { error } = await supabase.rpc('cancel_booking', {
      p_booking_id: selectedBooking.id,
    })

    if (error) return alert(error.message || 'No se pudo borrar.')

    setSelectedBooking(null)
    await refreshBookingsOnly()
  }

  // ---------- Admin: approve user ----------
  const approveProfile = async (profileId) => {
    if (!currentUser?.is_admin) return
    const { error } = await supabase.from('profiles').update({ is_approved: true }).eq('id', profileId)
    if (error) return alert('No pude aprobar. Revisa policies de profiles (admin update).')
    await refreshApprovals()
  }

  // ---------- Reusable SupportBox ----------
  const SupportBox = () => (
    <div className="p-6 bg-slate-900 rounded-[2rem] text-white shadow-xl border border-slate-800">
      <div className="flex items-center gap-2 text-blue-400 mb-4">
        <LifeBuoy size={18} />
        <span className="text-[10px] font-black uppercase tracking-widest">Soporte Técnico</span>
      </div>
      <p className="text-sm font-bold mb-1">{ADMIN_CONFIG.name}</p>
      <a
        href={`mailto:${ADMIN_CONFIG.email}`}
        className="text-[10px] text-blue-400 hover:underline block mb-4"
      >
        {ADMIN_CONFIG.email}
      </a>
      <p className="text-[9px] text-slate-500 leading-relaxed border-t border-white/10 pt-4 italic">
        Si necesitas aprobación de cuenta o reportar una falla, contacta directamente a soporte.
      </p>
    </div>
  )

  // ---------- Views ----------
  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
        <div className="w-full max-w-sm bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-100 text-center">
          <div className="inline-flex p-4 bg-blue-600 rounded-3xl text-white mb-6">
            <ShieldCheck size={32} />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tighter">Cargando…</h1>
        </div>
      </div>
    )
  }

  // Not logged in
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
        <div className="w-full max-w-sm bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-100 text-center">
          <div className="inline-flex p-4 bg-blue-600 rounded-3xl text-white mb-6">
            <ShieldCheck size={32} />
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter mb-1">CellBlock</h1>
          <p className="text-blue-600 font-bold text-[10px] uppercase tracking-widest mb-8">
            HostCell Suite
          </p>

          <form onSubmit={handleLogin} className="space-y-3">
            <input
              required
              type="email"
              placeholder="email@ibt.unam.mx"
              className="w-full px-6 py-4 bg-slate-50 rounded-2xl outline-none text-sm"
              value={loginData.email}
              onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
            />
            <input
              required
              type="password"
              placeholder="Contraseña"
              className="w-full px-6 py-4 bg-slate-50 rounded-2xl outline-none text-sm"
              value={loginData.password}
              onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
            />
            <button className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl hover:bg-black transition-all">
              Entrar al Lab
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
        </div>

        {/* REGISTER MODAL */}
        {showRegModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-white p-10 rounded-[3rem] w-full max-w-md relative">
              <button
                onClick={() => setShowRegModal(false)}
                className="absolute top-8 right-8 text-slate-300"
              >
                <X />
              </button>
              <h2 className="text-2xl font-black mb-6">Registro GPR</h2>
              <form onSubmit={handleRegister} className="space-y-4">
                <input
                  required
                  placeholder="Nombre completo"
                  className="w-full px-5 py-3.5 bg-slate-50 rounded-xl"
                  value={regData.name}
                  onChange={(e) => setRegData({ ...regData, name: e.target.value })}
                />
                <input
                  required
                  type="email"
                  placeholder="email@ibt.unam.mx"
                  className="w-full px-5 py-3.5 bg-slate-50 rounded-xl"
                  value={regData.email}
                  onChange={(e) => setRegData({ ...regData, email: e.target.value })}
                />
                <input
                  required
                  placeholder="Código (3 letras)"
                  maxLength={3}
                  className="w-full px-5 py-3.5 bg-slate-50 rounded-xl uppercase font-bold"
                  value={regData.code}
                  onChange={(e) => setRegData({ ...regData, code: e.target.value })}
                />
                <input
                  required
                  type="password"
                  placeholder="Contraseña"
                  className="w-full px-5 py-3.5 bg-slate-50 rounded-xl"
                  value={regData.password}
                  onChange={(e) => setRegData({ ...regData, password: e.target.value })}
                />
                <button
                  type="submit"
                  className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl shadow-lg"
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
            <div className="bg-white p-10 rounded-[3rem] w-full max-w-md relative">
              <button
                onClick={() => setShowResetModal(false)}
                className="absolute top-8 right-8 text-slate-300"
              >
                <X />
              </button>
              <h2 className="text-2xl font-black mb-2">Restablecer contraseña</h2>
              <p className="text-xs text-slate-500 mb-6">
                Si tu correo “ya existe” pero no recuerdas la contraseña, usa este flujo.
              </p>
              <form onSubmit={handlePasswordReset} className="space-y-4">
                <input
                  required
                  type="email"
                  placeholder="email@ibt.unam.mx"
                  className="w-full px-5 py-3.5 bg-slate-50 rounded-xl"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                />
                <button
                  type="submit"
                  className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl inline-flex items-center justify-center gap-2"
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

  // Logged in but not approved
  if (currentUser && !currentUser.is_approved) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
        <div className="w-full max-w-md bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-100">
          <div className="flex items-center justify-between mb-6">
            <div className="inline-flex p-4 bg-blue-600 rounded-3xl text-white">
              <ShieldCheck size={32} />
            </div>
            <button
              onClick={signOut}
              className="p-2 text-red-400 hover:text-red-600"
              title="Salir"
            >
              <LogOut size={20} />
            </button>
          </div>

          <h1 className="text-2xl font-black text-slate-900 tracking-tighter mb-2">
            Acceso pendiente de aprobación
          </h1>
          <p className="text-sm text-slate-600 mb-6">
            Tu cuenta existe, pero todavía no está aprobada para ver y reservar equipos.
          </p>

          <div className="mb-6 p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <p className="text-[10px] uppercase tracking-widest font-black text-slate-400 mb-2">
              Tu registro
            </p>
            <p className="text-sm font-bold text-slate-900">{currentUser.full_name || 'Sin nombre'}</p>
            <p className="text-xs text-slate-500">{currentUser.email || 'Sin email'}</p>
            <p className="text-xs text-slate-500">Código: {currentUser.user_code || '—'}</p>
          </div>

          <SupportBox />
        </div>
      </div>
    )
  }

  // Approved main app
  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 overflow-x-hidden">
      <nav className="bg-white border-b border-slate-100 px-6 md:px-10 py-5 flex justify-between items-center sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <div className="bg-blue-600 p-2.5 rounded-2xl text-white shadow-lg shadow-blue-100">
            <ShieldCheck size={22} />
          </div>
          <div className="leading-tight">
            <h1 className="text-xl font-black tracking-tighter">CellBlock</h1>
            <p className="text-[10px] font-bold text-slate-600 tracking-tight">
              Host Cell Lab Suite – Practical tools for high-performance biotechnology.
            </p>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
              Grupo Palomares-Ramirez | Instituto de Biotecnología UNAM
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowPwaModal(true)}
            className="p-2 text-slate-300 hover:text-blue-600 transition-colors"
            title="Instalar (PWA)"
          >
            <Smartphone size={20} />
          </button>
          <button onClick={signOut} className="p-2 text-red-400 hover:text-red-600" title="Salir">
            <LogOut size={20} />
          </button>
        </div>
      </nav>

      <div className="max-w-[1600px] mx-auto px-6 md:px-10 mt-8 grid grid-cols-12 gap-8 pb-20">
        {/* SIDEBAR */}
        <aside className="col-span-12 lg:col-span-2 space-y-6 flex flex-col">
          <div className="flex lg:flex-col gap-2 overflow-x-auto pb-4 lg:pb-0 scrollbar-hide">
            {hoods.map((h) => (
              <button
                key={h.id}
                onClick={() => setSelectedHood(h)}
                className={`w-full text-left px-5 py-4 rounded-2xl transition-all border ${
                  selectedHood?.id === h.id
                    ? 'bg-blue-600 text-white shadow-lg border-blue-400'
                    : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div className="text-xs font-black uppercase tracking-tighter">{h.name}</div>
                <div className="text-[10px] mt-1 font-bold flex justify-between uppercase opacity-80">
                  <span>Lab {h.lab_room || '—'}</span>
                  <span className={selectedHood?.id === h.id ? 'text-blue-200' : 'text-blue-600'}>
                    {formatHoodUse(h.biosafety_use)}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {/* Admin approvals */}
          {currentUser.is_admin && (
            <div className="p-6 bg-white rounded-[2rem] shadow-xl border border-slate-100">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Aprobaciones
                </p>
                <button
                  onClick={refreshApprovals}
                  className="text-[10px] font-black text-blue-600 hover:underline"
                  disabled={loadingApprovals}
                >
                  {loadingApprovals ? 'Cargando…' : 'Refrescar'}
                </button>
              </div>

              {pendingProfiles.length === 0 ? (
                <p className="text-xs text-slate-500">No hay usuarios pendientes.</p>
              ) : (
                <div className="space-y-3">
                  {pendingProfiles.map((p) => (
                    <div key={p.id} className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                      <p className="text-xs font-bold text-slate-900 truncate">
                        {p.full_name || 'Sin nombre'}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">{p.email || 'Sin email'}</p>
                      <p className="text-[11px] text-slate-500">Código: {p.user_code || '—'}</p>
                      <button
                        onClick={() => approveProfile(p.id)}
                        className="mt-2 w-full bg-blue-600 text-white font-bold py-2.5 rounded-xl text-xs"
                      >
                        Aprobar
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="hidden lg:block mt-auto">
            <SupportBox />
          </div>
        </aside>

        <main className="col-span-12 lg:col-span-10 space-y-6">
          {/* Selected hood info */}
          {selectedHood && (
            <div className="px-2">
              <div className="text-sm font-black">{selectedHood.name}</div>
              <div className="text-xs text-slate-500 font-bold">
                {formatHoodUse(selectedHood.biosafety_use)} · Lab {selectedHood.lab_room || '—'}
              </div>
            </div>
          )}

          <div className="flex overflow-x-auto gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-200 scrollbar-hide">
            {[0, 1, 2, 3].map((offset) => (
              <button
                key={offset}
                onClick={() => setViewWeekOffset(offset)}
                className={`flex-1 min-w-[100px] py-3 text-[10px] font-black rounded-xl transition-all ${
                  viewWeekOffset === offset ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'
                }`}
                title={isWeekLocked(offset) ? formatReleaseMessage(releaseTime) : 'Disponible'}
              >
                SEMANA {offset + 1} {isWeekLocked(offset) ? '🔒' : ''}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-[3rem] border border-slate-200 shadow-2xl overflow-hidden relative">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse table-fixed min-w-[800px]">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-200">
                    <th className="w-20 p-5 text-[10px] font-black text-slate-400 uppercase sticky left-0 bg-slate-50/80 backdrop-blur-md z-20">
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

                <tbody className="divide-y divide-slate-100">
                  {HOURS.map((hour) => (
                    <tr key={hour}>
                      <td className="p-4 text-[10px] font-black text-slate-400 text-center sticky left-0 bg-white/90 backdrop-blur-md z-20 border-r border-slate-200">
                        {hour}:00
                      </td>

                      {[0, 1, 2, 3, 4, 5, 6].map((day) => {
                        const slotDate = setHours(addDays(weekStart, day), hour)
                        const key = `${selectedHood?.id}|${slotDate.getTime()}`
                        const booking = selectedHood?.id ? bookingMap.get(key) : null
                        const isMine = booking?.user_id === currentUser.id
                        const showNote = booking && hasNotes(booking)

                        return (
                          <td key={day} className="border-l border-slate-200 h-16 p-1.5 relative">
                            {booking ? (
                              <button
                                onClick={() => openBookingDetails(booking)}
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

                                  {showNote && (
                                    <span
                                      className={`inline-flex items-center gap-1 text-[10px] font-black ${
                                        isMine ? 'text-amber-200' : 'text-amber-500'
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
                                title={
                                  isWeekLocked(viewWeekOffset)
                                    ? formatReleaseMessage(releaseTime)
                                    : 'Reservar'
                                }
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

      {/* PWA MODAL */}
      {showPwaModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-50 flex items-center justify-center p-6">
          <div className="bg-white p-10 rounded-[3rem] w-full max-w-md shadow-2xl relative">
            <button
              onClick={() => setShowPwaModal(false)}
              className="absolute top-8 right-8 text-slate-300"
            >
              <X />
            </button>
            <h3 className="text-2xl font-black mb-3 flex items-center gap-2">
              <Smartphone size={20} /> Instalar
            </h3>
            <p className="text-sm text-slate-600 mb-6">
              En Chrome: menú ⋮ → “Instalar app”. En iOS Safari: compartir → “Add to Home Screen”.
            </p>
            <button
              onClick={() => setShowPwaModal(false)}
              className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl"
            >
              Ok
            </button>
          </div>
        </div>
      )}

      {/* BOOKING DETAILS / NOTES MODAL */}
      {selectedBooking && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-50 flex items-center justify-center p-6">
          <div className="bg-white p-10 rounded-[3rem] w-full max-w-sm shadow-2xl relative">
            <button
              onClick={() => setSelectedBooking(null)}
              className="absolute top-8 right-8 text-slate-300"
            >
              <X />
            </button>

            <h3 className="text-2xl font-black mb-2 flex items-center gap-2">Reserva</h3>

            <p className="text-xs text-slate-500 mb-6">
              {selectedHood?.name || 'Equipo'} ·{' '}
              {format(new Date(selectedBooking.start_time), 'dd/MM HH:mm')}–{format(
                new Date(selectedBooking.end_time),
                'HH:mm'
              )}{' '}
              · {selectedBooking.user_name}
            </p>

            <div className="space-y-6">
              <div>
                <p className="text-[10px] font-black text-slate-300 uppercase mb-3">
                  Notas / Observaciones
                </p>

                <textarea
                  disabled={!(currentUser.is_admin || selectedBooking.user_id === currentUser.id)}
                  value={tempNotes}
                  onChange={(e) => setTempNotes(e.target.value)}
                  className="w-full p-5 bg-slate-50 rounded-2xl text-sm border-none focus:ring-2 focus:ring-blue-500 min-h-[150px] outline-none"
                  placeholder="Ej: usaré solo 30 min / material de cuidado / limpieza especial / etc."
                />
                <p className="text-[10px] text-slate-400 mt-2">
                  Estas notas son visibles para todos los usuarios aprobados.
                </p>
              </div>

              <div className="flex gap-2">
                {(currentUser.is_admin || selectedBooking.user_id === currentUser.id) && (
                  <button
                    onClick={saveNotes}
                    disabled={savingNotes}
                    className="flex-1 bg-blue-600 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-blue-100 disabled:opacity-50"
                  >
                    <Save size={18} /> {savingNotes ? 'Guardando…' : 'Guardar'}
                  </button>
                )}

                {(currentUser.is_admin || selectedBooking.user_id === currentUser.id) && (
                  <button
                    onClick={deleteBooking}
                    className="bg-red-50 text-red-600 font-bold px-6 py-4 rounded-2xl"
                    title="Borrar"
                  >
                    <Trash2 size={20} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}