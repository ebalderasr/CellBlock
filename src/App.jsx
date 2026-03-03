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
import { es } from 'date-fns/locale'
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
 * CellBlock v5.5 - Estabilidad y Lógica GPR
 */

const ADMIN_CONFIG = {
  name: 'Emiliano Balderas',
  email: 'emiliano.balderas@ibt.unam.mx',
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('Missing Supabase env vars: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY')
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

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

function withTimeout(promise, ms, label = 'timeout') {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(label)), ms)),
  ])
}

export default function App() {
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])
  const [authReady, setAuthReady] = useState(false)
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [loginData, setLoginData] = useState({ email: '', password: '' })
  const [showRegModal, setShowRegModal] = useState(false)
  const [showResetModal, setShowResetModal] = useState(false)
  const [regData, setRegData] = useState({ name: '', email: '', code: '', password: '' })
  const [resetEmail, setResetEmail] = useState('')
  const [showPwaModal, setShowPwaModal] = useState(false)
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
  const [nowTick, setNowTick] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNowTick(new Date()), 60 * 1000)
    return () => clearInterval(id)
  }, [])

  const cycleStart = useMemo(() => getCycleStart(nowTick), [nowTick])
  const releaseTime = useMemo(() => getReleaseTimeForCycle(cycleStart), [cycleStart])
  const weekStart = useMemo(() => startOfWeek(addWeeks(cycleStart, viewWeekOffset), { weekStartsOn: 1 }), [cycleStart, viewWeekOffset])
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

  const signOut = async () => {
    await supabase.auth.signOut()
    if (mountedRef.current) {
      setCurrentUser(null)
      setBookings([])
      setHoods([])
      setSelectedHood(null)
    }
  }

  const loadProfileForAuthUser = async (authUser) => {
    if (!authUser?.id) return null
    const { data, error } = await supabase.from('profiles').select('*').eq('id', authUser.id).single()
    return error ? null : { ...data, id: authUser.id }
  }

  const fetchHoods = async () => {
    const { data, error } = await supabase.from('hoods').select('*').order('name')
    return error ? [] : (data || [])
  }

  const fetchBookingsForWeekAndHood = async (hoodId, start, end) => {
    if (!hoodId) return []
    const { data, error } = await supabase.from('bookings').select('*').eq('hood_id', hoodId).gte('start_time', start.toISOString()).lt('start_time', end.toISOString())
    return error ? [] : (data || [])
  }

  const refreshApprovals = async () => {
    if (!currentUser?.is_admin) return
    setLoadingApprovals(true)
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('is_approved', false).order('created_at', { ascending: true })
      if (!error && mountedRef.current) setPendingProfiles(data || [])
    } finally {
      if (mountedRef.current) setLoadingApprovals(false)
    }
  }

  const refreshAll = async ({ keepHood = true } = {}) => {
    if (!currentUser?.is_approved) return
    setLoadingData(true)
    try {
      const h = await fetchHoods()
      if (!mountedRef.current) return
      setHoods(h)
      let hood = selectedHood
      if (!keepHood || !hood) hood = h?.[0] || null
      setSelectedHood(hood)
      if (hood?.id) {
        const b = await fetchBookingsForWeekAndHood(hood.id, weekStart, weekEnd)
        if (mountedRef.current) setBookings(b)
      }
    } finally {
      if (mountedRef.current) setLoadingData(false)
    }
  }

  const refreshBookingsOnly = async () => {
    if (!currentUser?.is_approved || !selectedHood?.id) return
    const b = await fetchBookingsForWeekAndHood(selectedHood.id, weekStart, weekEnd)
    if (mountedRef.current) setBookings(b)
  }

    useEffect(() => {
      const init = async () => {
        try {
          // Usamos getSession para recuperar la sesión local sin esperar al servidor
          const { data: { session }, error } = await withTimeout(
            supabase.auth.getSession(),
            5000,
            'auth_timeout'
          );
          
          if (error) throw error;

          if (session?.user) {
            const profile = await loadProfileForAuthUser(session.user);
            if (mountedRef.current && profile) setCurrentUser(profile);
          }
        } catch (e) {
          console.warn('Auth init problem:', e);
          // Si hay error, limpiamos la sesión para que el login manual no se bloquee
          await supabase.auth.signOut();
        } finally {
          if (mountedRef.current) setAuthReady(true);
        }
      };

      init();

      const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_OUT') {
          if (mountedRef.current) { 
            setCurrentUser(null); 
            setBookings([]); 
            setHoods([]); 
          }
        } else if (session?.user) {
          const profile = await loadProfileForAuthUser(session.user);
          if (mountedRef.current) setCurrentUser(profile);
        }
      });

      return () => {
        if (sub?.subscription) sub.subscription.unsubscribe();
      };
    }, []);

  useEffect(() => {
    if (currentUser?.is_approved) {
      refreshAll({ keepHood: false })
      if (currentUser.is_admin) refreshApprovals()
    }
  }, [currentUser?.id, currentUser?.is_approved])

  useEffect(() => {
    if (currentUser?.is_approved) refreshBookingsOnly()
  }, [viewWeekOffset, selectedHood?.id, weekStart?.getTime(), cycleStart?.getTime()])

  const handleLogin = async (e) => {
    e.preventDefault();
    if (isLoggingIn) return; // Evita clics dobles
    
    setIsLoggingIn(true); // Bloqueamos el botón visualmente
    try {
      const email = loginData.email.trim().toLowerCase();
      const password = loginData.password;

      // Usamos el timeout para que no se quede trabado 30 segundos
      const res = await withTimeout(
        supabase.auth.signInWithPassword({ email, password }),
        8000,
        'login_timeout'
      );

      if (res.error) throw res.error;

      const profile = await loadProfileForAuthUser(res.data.user);
      if (!profile) throw new Error('No profile found');

      setCurrentUser(profile);
    } catch (err) {
      console.error("Error de login:", err);
      alert("Error al entrar: Revisa tu correo/contraseña o la conexión.");
    } finally {
      setIsLoggingIn(false); // IMPORTANTE: Esto libera el botón siempre
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault()
    const { data, error } = await supabase.auth.signUp({
      email: regData.email.trim().toLowerCase(),
      password: regData.password,
      options: { data: { full_name: regData.name, user_code: (regData.code || '').toUpperCase() } }
    })
    if (error) return alert(error.message)
    setShowRegModal(false)
    alert('Registro enviado para aprobación.')
  }

  const handleBooking = async (day, hour) => {
    if (!currentUser?.is_approved) return
    if (isWeekLocked(viewWeekOffset)) return alert(formatReleaseMessage(releaseTime))
    if (bookingBusy) return
    setBookingBusy(true)
    try {
      const targetDate = setHours(addDays(weekStart, day), hour)
      // Restricción 3 horas seguidas
      const dayHours = bookings.filter(b => b.user_id === currentUser.id && isSameDay(parseISO(b.start_time), targetDate)).map(b => parseISO(b.start_time).getHours())
      const allSorted = [...dayHours, hour].sort((a, b) => a - b)
      let max = 1, curr = 1
      for (let i = 0; i < allSorted.length - 1; i++) {
        if (allSorted[i + 1] === allSorted[i] + 1) curr++; else curr = 1
        max = Math.max(curr, max)
      }
      if (max > 3) return alert('Límite GPR: Máximo 3 horas consecutivas.')
      const { error } = await supabase.rpc('book_slot', { p_hood_id: selectedHood.id, p_start_time: targetDate.toISOString() })
      if (error) alert(error.message); else refreshBookingsOnly()
    } finally { if (mountedRef.current) setBookingBusy(false) }
  }

  const saveNotes = async () => {
    setSavingNotes(true)
    const { error } = await supabase.rpc('update_booking_notes', { p_booking_id: selectedBooking.id, p_notes: tempNotes })
    if (!error) { setSelectedBooking(null); refreshBookingsOnly(); }
    setSavingNotes(false)
  }

  const deleteBooking = async () => {
    if (!window.confirm('¿Borrar reserva?')) return
    const { error } = await supabase.rpc('cancel_booking', { p_booking_id: selectedBooking.id })
    if (!error) { setSelectedBooking(null); refreshBookingsOnly(); }
  }

  const approveProfile = async (id) => {
    const { error } = await supabase.from('profiles').update({ is_approved: true }).eq('id', id)
    if (!error) refreshApprovals()
  }

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white p-10 rounded-[3rem] shadow-2xl text-center">
          <ShieldCheck size={48} className="mx-auto text-blue-600 mb-6" />
          <h1 className="text-2xl font-black text-slate-900">Cargando…</h1>
        </div>
      </div>
    )
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white p-10 rounded-[3rem] shadow-2xl text-center">
          <ShieldCheck size={48} className="mx-auto text-blue-600 mb-6" />
          <h1 className="text-4xl font-black text-slate-900 mb-1">CellBlock</h1>
          <p className="text-blue-600 font-bold text-[10px] uppercase tracking-widest mb-8">HostCell Suite</p>
          <form onSubmit={handleLogin} className="space-y-3">
            <input required type="email" placeholder="email@ibt.unam.mx" className="w-full px-6 py-4 bg-slate-50 rounded-2xl outline-none" onChange={e => setLoginData({...loginData, email: e.target.value})} />
            <input required type="password" placeholder="Contraseña" className="w-full px-6 py-4 bg-slate-50 rounded-2xl outline-none" onChange={e => setLoginData({...loginData, password: e.target.value})} />
            <button 
              disabled={isLoggingIn}
              className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl hover:bg-black transition-all disabled:opacity-50"
            >
              {isLoggingIn ? "Conectando..." : "Entrar al Lab"}
            </button>
          </form>
          <button onClick={() => setShowRegModal(true)} className="mt-6 text-xs font-bold text-blue-600 underline">Solicitar Acceso</button>
        </div>
        {showRegModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-white p-10 rounded-[3rem] w-full max-w-md relative">
              <button onClick={() => setShowRegModal(false)} className="absolute top-8 right-8 text-slate-300"><X /></button>
              <h2 className="text-2xl font-black mb-6">Registro GPR</h2>
              <form onSubmit={handleRegister} className="space-y-4">
                <input required placeholder="Nombre completo" className="w-full px-5 py-3.5 bg-slate-50 rounded-xl" onChange={e => setRegData({...regData, name: e.target.value})} />
                <input required type="email" placeholder="email@ibt.unam.mx" className="w-full px-5 py-3.5 bg-slate-50 rounded-xl" onChange={e => setRegData({...regData, email: e.target.value})} />
                <input required placeholder="Código (3 letras)" maxLength={3} className="w-full px-5 py-3.5 bg-slate-50 rounded-xl uppercase font-bold" onChange={e => setRegData({...regData, code: e.target.value})} />
                <input required type="password" placeholder="Contraseña" className="w-full px-5 py-3.5 bg-slate-50 rounded-xl" onChange={e => setRegData({...regData, password: e.target.value})} />
                <button type="submit" className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl shadow-lg">Registrar</button>
              </form>
            </div>
          </div>
        )}
      </div>
    )
  }

  if (currentUser && !currentUser.is_approved) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white p-10 rounded-[3rem] shadow-2xl text-center">
          <ShieldCheck size={48} className="mx-auto text-blue-600 mb-6" />
          <h1 className="text-2xl font-black text-slate-900 mb-2">Acceso Pendiente</h1>
          <p className="text-sm text-slate-500 mb-8">Tu cuenta está en espera de aprobación por el administrador.</p>
          <button onClick={signOut} className="text-red-500 font-bold text-xs uppercase tracking-widest">Cerrar Sesión</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 overflow-x-hidden">
      {/* HEADER REFINADO: No cursiva, text-5xl, bordes opacos */}
      <nav className="bg-white border-b border-slate-300 px-6 md:px-10 py-8 flex justify-between items-center sticky top-0 z-40">
        <div className="flex flex-col gap-1">
          <h1 className="text-5xl font-black tracking-tighter text-slate-900">CellBlock</h1>
          <p className="text-sm font-bold text-blue-600">Host Cell Lab Suite – Practical tools for high-performance biotechnology.</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Grupo Palomares-Ramirez | Instituto de Biotecnología UNAM</p>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => setShowPwaModal(true)} className="p-2 text-slate-300 hover:text-blue-600"><Smartphone size={24} /></button>
          <button onClick={signOut} className="p-2 text-red-400 hover:text-red-600"><LogOut size={24} /></button>
        </div>
      </nav>

      <div className="max-w-[1600px] mx-auto px-6 md:px-10 mt-8 grid grid-cols-12 gap-8 pb-20">
        <aside className="col-span-12 lg:col-span-2 space-y-6">
          <div className="flex lg:flex-col gap-2 overflow-x-auto pb-4 scrollbar-hide">
            {hoods.map(h => (
              <button key={h.id} onClick={() => setSelectedHood(h)} className={`w-full text-left px-5 py-4 rounded-2xl transition-all border ${selectedHood?.id === h.id ? 'bg-blue-600 text-white shadow-lg border-blue-400' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}`}>
                <div className="text-xs font-black uppercase tracking-tighter">{h.name}</div>
                <div className="text-[10px] mt-1 font-bold flex justify-between uppercase opacity-80">
                  <span>Lab {h.lab_room || '—'}</span>
                  <span className={selectedHood?.id === h.id ? 'text-blue-200' : 'text-blue-600'}>{formatHoodUse(h.biosafety_use)}</span>
                </div>
              </button>
            ))}
          </div>
          {currentUser.is_admin && (
            <div className="p-6 bg-white rounded-[2rem] shadow-xl border border-slate-300">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Aprobaciones</p>
              <div className="space-y-3">
                {pendingProfiles.map(p => (
                  <div key={p.id} className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                    <p className="text-xs font-bold text-slate-900 truncate">{p.full_name}</p>
                    <button onClick={() => approveProfile(p.id)} className="mt-2 w-full bg-blue-600 text-white font-bold py-2 rounded-xl text-[10px]">Aprobar</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>

        <main className="col-span-12 lg:col-span-10 space-y-6">
          <div className="flex overflow-x-auto gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-300 scrollbar-hide">
            {[0, 1, 2, 3].map(offset => (
              <button key={offset} onClick={() => setViewWeekOffset(offset)} className={`flex-1 min-w-[100px] py-3 text-[10px] font-black rounded-xl transition-all ${viewWeekOffset === offset ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>
                SEMANA {offset + 1} {isWeekLocked(offset) ? '🔒' : ''}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-[3rem] border border-slate-300 shadow-2xl overflow-hidden relative">
            <div className="overflow-x-auto">
              {/* TABLA: Bordes border-slate-300 y Horas text-slate-500 */}
              <table className="w-full border-collapse table-fixed min-w-[800px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-300">
                    <th className="w-20 p-5 text-[10px] font-black text-slate-500 uppercase sticky left-0 bg-slate-50 z-20">Hora</th>
                    {DAYS_NAME.map((d, i) => (
                      <th key={d} className="p-5 text-[11px] font-black border-l border-slate-300 uppercase text-slate-700">
                        {d} <span className="block text-[9px] text-slate-400 font-normal mt-1">{format(addDays(weekStart, i), 'dd/MM')}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {HOURS.map(hour => (
                    <tr key={hour}>
                      <td className="p-4 text-[10px] font-black text-slate-500 text-center sticky left-0 bg-white z-20 border-r border-slate-300">{hour}:00</td>
                      {[0,1,2,3,4,5,6].map(day => {
                        const slotDate = setHours(addDays(weekStart, day), hour)
                        const booking = bookingMap.get(`${selectedHood?.id}|${slotDate.getTime()}`)
                        const isMine = booking?.user_id === currentUser.id
                        return (
                          <td key={day} className="border-l border-slate-300 h-16 p-1.5 relative">
                            {booking ? (
                              <button onClick={() => {setSelectedBooking(booking); setTempNotes(booking.notes || '')}} className={`h-full w-full rounded-2xl p-3 flex flex-col justify-center transition-all border text-left ${isMine ? 'bg-blue-600 border-blue-400 text-white shadow-lg' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[10px] font-black uppercase tracking-tighter truncate">{booking.user_name}</span>
                                  {booking.notes && <MessageSquare size={14} className={isMine ? 'text-blue-200' : 'text-blue-500'} />}
                                </div>
                              </button>
                            ) : (
                              <button disabled={isWeekLocked(viewWeekOffset) || bookingBusy} onClick={() => handleBooking(day, hour)} className="w-full h-full rounded-2xl border-2 border-dashed border-slate-200 hover:border-blue-300 transition-all flex items-center justify-center opacity-40 hover:opacity-100 disabled:opacity-5">
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
        </main>
      </div>

      {/* MODAL DETALLES */}
      {selectedBooking && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-50 flex items-center justify-center p-6">
          <div className="bg-white p-10 rounded-[3rem] w-full max-w-sm shadow-2xl relative">
            <button onClick={() => setSelectedBooking(null)} className="absolute top-8 right-8 text-slate-300"><X/></button>
            <h3 className="text-2xl font-black mb-1">Reserva</h3>
            <p className="text-xs text-slate-500 mb-6">{selectedHood?.name} · {format(new Date(selectedBooking.start_time), 'dd/MM HH:mm')}</p>
            <textarea 
              disabled={!(currentUser.is_admin || selectedBooking.user_id === currentUser.id)}
              value={tempNotes} onChange={e => setTempNotes(e.target.value)}
              className="w-full p-5 bg-slate-50 rounded-2xl text-sm min-h-[150px] outline-none mb-6" placeholder="Notas..." 
            />
            <div className="flex gap-2">
              {(currentUser.is_admin || selectedBooking.user_id === currentUser.id) && (
                <>
                  <button onClick={saveNotes} className="flex-1 bg-blue-600 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-blue-100"><Save size={18}/> Guardar</button>
                  <button onClick={deleteBooking} className="bg-red-50 text-red-600 font-bold px-6 py-4 rounded-2xl"><Trash2 size={20}/></button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}