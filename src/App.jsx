import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { format, startOfWeek, addWeeks, addDays, isAfter, setHours, setMinutes, isSameDay, parseISO, addHours } from 'date-fns';
import { ShieldCheck, Plus, X, Trash2, LogOut, Info, Smartphone, Mail, User, LifeBuoy, ChevronRight, Clock } from 'lucide-react';

const ADMIN_CONFIG = {
  name: "Emiliano Balderas",
  email: "emiliano.balderas@ibt.unam.mx",
  group: "Grupo Palomares-Ramírez | Instituto de biotecnología UNAM",
  suite: "HostCell",
  description: "una suite para cultivo celular y bioprocesos"
};

const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAYS_NAME = ['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB', 'DOM'];

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loginData, setLoginData] = useState({ identifier: '', password: '' });
  const [hoods, setHoods] = useState([]);
  const [selectedHood, setSelectedHood] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [viewWeekOffset, setViewWeekOffset] = useState(0);
  const [showRegModal, setShowRegModal] = useState(false);
  const [showPwaModal, setShowPwaModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);

  useEffect(() => {
    const session = localStorage.getItem('cellblock_user');
    if (session) setCurrentUser(JSON.parse(session));
    fetchData();
  }, []);

  async function fetchData() {
    const { data: h } = await supabase.from('hoods').select('*').order('name');
    setHoods(h || []);
    if (h?.length > 0 && !selectedHood) setSelectedHood(h[0]);
    const { data: b } = await supabase.from('bookings').select('*');
    setBookings(b || []);
  }

  // Login Dual: Correo o Código de 3 letras
  const handleLogin = async (e) => {
    e.preventDefault();
    const id = loginData.identifier.trim();
    const { data, error } = await supabase
      .from('authorized_users')
      .select('*')
      .or(`email.eq.${id},user_code.eq.${id.toUpperCase()}`)
      .eq('password', loginData.password)
      .single();

    if (error || !data) return alert("Credenciales incorrectas.");
    if (!data.is_approved) return alert("Acceso pendiente de aprobación por soporte.");
    
    setCurrentUser(data);
    localStorage.setItem('cellblock_user', JSON.stringify(data));
  };

  const isWeekLocked = (offset) => {
    if (currentUser?.is_admin) return false;
    if (offset <= 1) return false;
    const now = new Date();
    const releaseTime = setMinutes(setHours(addDays(startOfWeek(now, { weekStartsOn: 1 }), 12), 11), 0);
    return !isAfter(now, releaseTime);
  };

  const handleBooking = async (day, hour) => {
    if (isWeekLocked(viewWeekOffset)) return alert("Agenda bloqueada hasta el sábado 11:00 AM.");
    const weekStart = startOfWeek(addWeeks(new Date(), viewWeekOffset), { weekStartsOn: 1 });
    const targetDate = setHours(addDays(weekStart, day), hour);
    
    // Lógica 3h blindada
    const dayHours = bookings.filter(b => b.user_id === currentUser.id && b.hood_id === selectedHood.id && isSameDay(parseISO(b.start_time), targetDate)).map(b => parseISO(b.start_time).getHours());
    const allSorted = [...dayHours, hour].sort((a, b) => a - b);
    let max = 1, curr = 1;
    for (let i = 0; i < allSorted.length - 1; i++) {
      if (allSorted[i+1] === allSorted[i]+1) curr++; else curr = 1;
      max = Math.max(max, curr);
    }
    if (max > 3) return alert("Límite: Máximo 3 horas consecutivas.");

    await supabase.from('bookings').insert([{
      hood_id: selectedHood.id, user_id: currentUser.id, user_name: currentUser.user_code,
      start_time: targetDate.toISOString(), end_time: addHours(targetDate, 1).toISOString()
    }]);
    fetchData();
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
        <div className="w-full max-w-sm bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100 text-center">
          <div className="inline-flex p-4 bg-blue-600 rounded-3xl text-white shadow-lg mb-4">
            <ShieldCheck size={32} />
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter mb-1">CellBlock</h1>
          <p className="text-blue-600 font-bold text-[10px] uppercase tracking-widest mb-8">HostCell Suite</p>
          <form onSubmit={handleLogin} className="space-y-3">
            <input required placeholder="Email o Código (EBR)" className="w-full px-5 py-4 bg-slate-50 rounded-2xl outline-none text-sm" onChange={e => setLoginData({...loginData, identifier: e.target.value})} />
            <input required type="password" placeholder="Contraseña" className="w-full px-5 py-4 bg-slate-50 rounded-2xl outline-none text-sm" onChange={e => setLoginData({...loginData, password: e.target.value})} />
            <button className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl">Entrar</button>
          </form>
          <button onClick={() => setShowRegModal(true)} className="mt-4 text-xs font-bold text-blue-600">Solicitar Acceso</button>
        </div>
        {showRegModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-white p-8 rounded-[2.5rem] w-full max-w-md relative">
              <button onClick={() => setShowRegModal(false)} className="absolute top-6 right-6 text-slate-300"><X/></button>
              <h2 className="text-2xl font-black mb-6">Registro GPR</h2>
              <form onSubmit={async (e) => {
                e.preventDefault();
                const { error } = await supabase.from('authorized_users').insert([{ full_name: regData.name, email: regData.email, user_code: regData.code.toUpperCase(), password: regData.password, is_approved: false }]);
                if (error) alert("Error: Datos ya existentes."); else { alert("Enviado. Espera aprobación de Soporte."); setShowRegModal(false); }
              }} className="space-y-4">
                <input required placeholder="Nombre completo" className="w-full px-5 py-3 bg-slate-50 rounded-xl" onChange={e => setRegData({...regData, name: e.target.value})} />
                <input required placeholder="email@ibt.unam.mx" className="w-full px-5 py-3 bg-slate-50 rounded-xl" onChange={e => setRegData({...regData, email: e.target.value})} />
                <input required placeholder="Código 3 letras" maxLength={3} className="w-full px-5 py-3 bg-slate-50 rounded-xl uppercase font-bold" onChange={e => setRegData({...regData, code: e.target.value})} />
                <input required type="password" placeholder="Contraseña" className="w-full px-5 py-3 bg-slate-50 rounded-xl" onChange={e => setRegData({...regData, password: e.target.value})} />
                <button className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl">Registrar</button>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 overflow-x-hidden">
      {/* NAVBAR OPTIMIZADO PARA MÓVIL */}
      <nav className="bg-white border-b border-slate-100 px-4 md:px-10 py-4 flex justify-between items-center sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-xl text-white shadow-md"><ShieldCheck size={20}/></div>
          <div className="leading-tight">
            <h1 className="text-lg font-black tracking-tighter">CellBlock <span className="text-slate-400 font-normal">| {ADMIN_CONFIG.suite}</span></h1>
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">{ADMIN_CONFIG.group}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowPwaModal(true)} className="p-2 text-slate-400 hover:text-blue-600"><Smartphone size={18}/></button>
          <button onClick={() => {localStorage.clear(); window.location.reload();}} className="p-2 text-red-400"><LogOut size={18}/></button>
        </div>
      </nav>

      <div className="max-w-[1600px] mx-auto px-4 md:px-10 mt-6 grid grid-cols-12 gap-6 pb-20">
        {/* SIDEBAR / SOPORTE */}
        <aside className="col-span-12 lg:col-span-2 space-y-4">
          <div className="flex lg:flex-col gap-2 overflow-x-auto pb-2 lg:pb-0 scrollbar-hide">
            {hoods.map(h => (
              <button key={h.id} onClick={() => setSelectedHood(h)} className={`whitespace-nowrap px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${selectedHood?.id === h.id ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400'}`}>{h.name}</button>
            ))}
          </div>
          <div className="p-5 bg-slate-900 rounded-3xl text-white shadow-xl">
             <div className="flex items-center gap-2 text-blue-400 mb-3"><LifeBuoy size={16}/><span className="text-[10px] font-black uppercase tracking-widest">Soporte GPR</span></div>
             <p className="text-[11px] font-bold text-white mb-1">{ADMIN_CONFIG.adminName}</p>
             <p className="text-[9px] text-slate-400 break-all mb-4">{ADMIN_CONFIG.adminEmail}</p>
             <p className="text-[8px] opacity-40 leading-relaxed italic border-t border-white/10 pt-3">Contacta a soporte para aprobaciones o fallas en el sistema.</p>
          </div>
        </aside>

        <main className="col-span-12 lg:col-span-10 space-y-4">
          {/* SEMANAS OPTIMIZADO */}
          <div className="flex overflow-x-auto gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200 scrollbar-hide">
            {[0, 1, 2, 3].map(offset => (
              <button key={offset} onClick={() => setViewWeekOffset(offset)} className={`flex-1 min-w-[80px] py-2.5 text-[9px] font-black rounded-xl transition-all ${viewWeekOffset === offset ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>
                S{offset + 1} {isWeekLocked(offset) && '🔒'}
              </button>
            ))}
          </div>

          {/* TABLA OPTIMIZADA (STICKY TIME) */}
          <div className="bg-white rounded-[2rem] border border-slate-200 shadow-2xl overflow-hidden">
            <div className="overflow-x-auto scroll-smooth">
              <table className="w-full border-collapse table-fixed min-w-[700px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="w-16 p-3 text-[9px] font-black text-slate-300 uppercase sticky left-0 bg-slate-50 z-20">HR</th>
                    {DAYS_NAME.map((d, i) => (
                      <th key={d} className={`p-3 text-[10px] font-black border-l border-slate-100 uppercase text-slate-600`}>
                        {d} <span className="block text-[8px] text-slate-300 font-normal mt-1">{format(addDays(startOfWeek(addWeeks(new Date(), viewWeekOffset), { weekStartsOn: 1 }), i), 'dd/MM')}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {HOURS.map(hour => (
                    <tr key={hour}>
                      <td className="p-3 text-[10px] font-black text-slate-200 text-center sticky left-0 bg-white z-20 border-r border-slate-50">{hour}:00</td>
                      {[0,1,2,3,4,5,6].map(day => {
                        const slotDate = setHours(addDays(startOfWeek(addWeeks(new Date(), viewWeekOffset), { weekStartsOn: 1 }), day), hour);
                        const booking = bookings.find(b => b.hood_id === selectedHood?.id && new Date(b.start_time).getTime() === slotDate.getTime());
                        const isMine = booking?.user_id === currentUser.id;
                        return (
                          <td key={day} className="border-l border-slate-50 h-14 p-1 relative">
                            {booking ? (
                              <button onClick={() => setSelectedBooking(booking)} className={`h-full w-full rounded-xl p-2 flex flex-col justify-center transition-all border text-left ${isMine ? 'bg-blue-600 border-blue-400 text-white shadow-md' : 'bg-slate-50 border-slate-100 text-slate-700'}`}>
                                <span className="text-[9px] font-black uppercase tracking-tighter truncate">{booking.user_name}</span>
                              </button>
                            ) : (
                              <button disabled={isWeekLocked(viewWeekOffset)} onClick={() => handleBooking(day, hour)} className="w-full h-full rounded-xl border-2 border-dashed border-slate-50 hover:border-blue-100 transition-all flex items-center justify-center opacity-40 hover:opacity-100">
                                <Plus size={14} className="text-slate-200" />
                              </button>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {/* MODALES IGUALES PERO CON REDONDEO SUAVE */}
      {selectedBooking && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-6">
          <div className="bg-white p-8 rounded-[2.5rem] w-full max-w-sm shadow-2xl relative">
            <button onClick={() => setSelectedBooking(null)} className="absolute top-6 right-6 text-slate-300"><X/></button>
            <h3 className="text-xl font-black mb-6 flex items-center gap-2"><Clock className="text-blue-600"/> Reserva</h3>
            <div className="space-y-4">
               <div>
                 <p className="text-[9px] font-black text-slate-300 uppercase mb-2">Observaciones</p>
                 <textarea disabled={selectedBooking.user_id !== currentUser.id} defaultValue={selectedBooking.notes} className="w-full p-4 bg-slate-50 rounded-xl text-sm border-none focus:ring-1 focus:ring-blue-500 min-h-[100px] outline-none" onBlur={(e) => selectedBooking.user_id === currentUser.id && supabase.from('bookings').update({ notes: e.target.value }).eq('id', selectedBooking.id).then(() => fetchData())} />
               </div>
               {(currentUser.is_admin || selectedBooking.user_id === currentUser.id) && (
                 <button onClick={async () => { if(window.confirm("¿Borrar?")) { await supabase.from('bookings').delete().eq('id', selectedBooking.id); fetchData(); setSelectedBooking(null); } }} className="w-full py-4 rounded-xl bg-red-50 text-red-600 font-black text-xs uppercase">Eliminar Reserva</button>
               )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
