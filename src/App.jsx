import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { format, startOfWeek, addWeeks, addDays, isAfter, setHours, setMinutes, isSameDay, parseISO, addHours } from 'date-fns';
import { ShieldCheck, Plus, X, Trash2, LogOut, Smartphone, Mail, User, LifeBuoy, Clock, Save } from 'lucide-react';

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
  const [regData, setRegData] = useState({ name: '', email: '', code: '', password: '' });
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [tempNotes, setTempNotes] = useState("");

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

  const handleLogin = async (e) => {
    e.preventDefault();
    const id = loginData.identifier.trim();
    const { data, error } = await supabase
      .from('authorized_users')
      .select('*')
      .or(`email.eq."${id}",user_code.eq."${id.toUpperCase()}"`)
      .eq('password', loginData.password)
      .single();

    if (error || !data) return alert("Credenciales incorrectas.");
    if (!data.is_approved) return alert("Acceso pendiente de aprobación por soporte.");
    
    setCurrentUser(data);
    localStorage.setItem('cellblock_user', JSON.stringify(data));
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!regData.email.includes('@')) return alert("Ingresa un correo válido.");
    
    const { error } = await supabase.from('authorized_users').insert([{ 
      full_name: regData.name, 
      email: regData.email, 
      user_code: regData.code.toUpperCase(), 
      password: regData.password, 
      is_approved: false 
    }]);

    if (error) {
      console.error(error);
      alert("Error: El correo o código ya están registrados.");
    } else {
      alert("Registro exitoso. Contacta a Emiliano para la aprobación.");
      setShowRegModal(false);
    }
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
    
    const dayHours = bookings.filter(b => b.user_id === currentUser.id && b.hood_id === selectedHood.id && isSameDay(parseISO(b.start_time), targetDate)).map(b => parseISO(b.start_time).getHours());
    const allSorted = [...dayHours, hour].sort((a, b) => a - b);
    let max = 1, curr = 1;
    for (let i = 0; i < allSorted.length - 1; i++) {
      if (allSorted[i+1] === allSorted[i]+1) curr++; else curr = 1;
      max = Math.max(curr, max);
    }
    if (max > 3) return alert("Límite GPR: Máximo 3 horas consecutivas.");

    await supabase.from('bookings').insert([{
      hood_id: selectedHood.id, user_id: currentUser.id, user_name: currentUser.user_code,
      start_time: targetDate.toISOString(), end_time: addHours(targetDate, 1).toISOString()
    }]);
    fetchData();
  };

  const saveNotes = async () => {
    const { error } = await supabase.from('bookings').update({ notes: tempNotes }).eq('id', selectedBooking.id);
    if (error) alert("Error al guardar notas.");
    else {
      setSelectedBooking(null);
      fetchData();
    }
  };

  // Componente de Soporte Técnico reutilizable
  const SupportBox = () => (
    <div className="p-6 bg-slate-900 rounded-[2rem] text-white shadow-xl border border-slate-800">
       <div className="flex items-center gap-2 text-blue-400 mb-4">
         <LifeBuoy size={18}/><span className="text-[10px] font-black uppercase tracking-widest">Soporte Técnico</span>
       </div>
       <p className="text-sm font-bold mb-1">{ADMIN_CONFIG.name}</p>
       <a href={`mailto:${ADMIN_CONFIG.email}`} className="text-[10px] text-blue-400 hover:underline block mb-4">{ADMIN_CONFIG.email}</a>
       <p className="text-[9px] text-slate-500 leading-relaxed border-t border-white/10 pt-4 italic">
         Si necesitas aprobación de cuenta o reportar una falla, contacta directamente a soporte.
       </p>
    </div>
  );

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
        <div className="w-full max-w-sm bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-100 text-center">
          <div className="inline-flex p-4 bg-blue-600 rounded-3xl text-white mb-6">
            <ShieldCheck size={32} />
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter mb-1">CellBlock</h1>
          <p className="text-blue-600 font-bold text-[10px] uppercase tracking-widest mb-8">HostCell Suite</p>
          <form onSubmit={handleLogin} className="space-y-3">
            <input required placeholder="Email o Código (EBR)" className="w-full px-6 py-4 bg-slate-50 rounded-2xl outline-none text-sm" onChange={e => setLoginData({...loginData, identifier: e.target.value})} />
            <input required type="password" placeholder="Contraseña" className="w-full px-6 py-4 bg-slate-50 rounded-2xl outline-none text-sm" onChange={e => setLoginData({...loginData, password: e.target.value})} />
            <button className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl hover:bg-black transition-all">Entrar al Lab</button>
          </form>
          <button onClick={() => setShowRegModal(true)} className="mt-6 text-xs font-bold text-blue-600 hover:underline">Solicitar Acceso</button>
        </div>

        {showRegModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-white p-10 rounded-[3rem] w-full max-w-md relative">
              <button onClick={() => setShowRegModal(false)} className="absolute top-8 right-8 text-slate-300"><X/></button>
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
    );
  }

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 overflow-x-hidden">
      <nav className="bg-white border-b border-slate-100 px-6 md:px-10 py-5 flex justify-between items-center sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2.5 rounded-2xl text-white shadow-lg shadow-blue-100"><ShieldCheck size={22}/></div>
          <div className="leading-tight">
            <h1 className="text-xl font-black tracking-tighter italic">CellBlock <span className="text-slate-300 font-normal">| {ADMIN_CONFIG.suite}</span></h1>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{ADMIN_CONFIG.group}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => setShowPwaModal(true)} className="p-2 text-slate-300 hover:text-blue-600 transition-colors"><Smartphone size={20}/></button>
          <button onClick={() => {localStorage.clear(); window.location.reload();}} className="p-2 text-red-400 hover:text-red-600"><LogOut size={20}/></button>
        </div>
      </nav>

      <div className="max-w-[1600px] mx-auto px-6 md:px-10 mt-8 grid grid-cols-12 gap-8 pb-20">
        {/* SIDEBAR PC */}
        <aside className="col-span-12 lg:col-span-2 space-y-6 flex flex-col">
          <div className="flex lg:flex-col gap-2 overflow-x-auto pb-4 lg:pb-0 scrollbar-hide">
            {hoods.map(h => (
              <button key={h.id} onClick={() => setSelectedHood(h)} className={`whitespace-nowrap px-6 py-3.5 rounded-2xl text-xs font-bold transition-all ${selectedHood?.id === h.id ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400'}`}>{h.name}</button>
            ))}
          </div>
          <div className="hidden lg:block mt-auto">
            <SupportBox />
          </div>
        </aside>

        <main className="col-span-12 lg:col-span-10 space-y-6">
          <div className="flex overflow-x-auto gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-100 scrollbar-hide">
            {[0, 1, 2, 3].map(offset => (
              <button key={offset} onClick={() => setViewWeekOffset(offset)} className={`flex-1 min-w-[100px] py-3 text-[10px] font-black rounded-xl transition-all ${viewWeekOffset === offset ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-300'}`}>
                SEMANA {offset + 1} {isWeekLocked(offset) && '🔒'}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-[3rem] border border-slate-100 shadow-2xl overflow-hidden relative">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse table-fixed min-w-[800px]">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100">
                    <th className="w-20 p-5 text-[10px] font-black text-slate-300 uppercase sticky left-0 bg-slate-50/80 backdrop-blur-md z-20">Hora</th>
                    {DAYS_NAME.map((d, i) => (
                      <th key={d} className="p-5 text-[11px] font-black border-l border-slate-100 uppercase text-slate-700">
                        {d} <span className="block text-[9px] text-slate-300 font-normal mt-1">{format(addDays(startOfWeek(addWeeks(new Date(), viewWeekOffset), { weekStartsOn: 1 }), i), 'dd/MM')}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {HOURS.map(hour => (
                    <tr key={hour}>
                      <td className="p-4 text-[10px] font-black text-slate-200 text-center sticky left-0 bg-white/90 backdrop-blur-md z-20 border-r border-slate-50">{hour}:00</td>
                      {[0,1,2,3,4,5,6].map(day => {
                        const slotDate = setHours(addDays(startOfWeek(addWeeks(new Date(), viewWeekOffset), { weekStartsOn: 1 }), day), hour);
                        const booking = bookings.find(b => b.hood_id === selectedHood?.id && new Date(b.start_time).getTime() === slotDate.getTime());
                        const isMine = booking?.user_id === currentUser.id;
                        return (
                          <td key={day} className="border-l border-slate-50 h-16 p-1.5 relative">
                            {booking ? (
                              <button onClick={() => {setSelectedBooking(booking); setTempNotes(booking.notes || "");}} className={`h-full w-full rounded-2xl p-3 flex flex-col justify-center transition-all border text-left ${isMine ? 'bg-blue-600 border-blue-400 text-white shadow-lg' : 'bg-slate-50 border-slate-100 text-slate-700'}`}>
                                <span className="text-[10px] font-black uppercase tracking-tighter truncate">{booking.user_name}</span>
                              </button>
                            ) : (
                              <button disabled={isWeekLocked(viewWeekOffset)} onClick={() => handleBooking(day, hour)} className="w-full h-full rounded-2xl border-2 border-dashed border-slate-100 hover:border-blue-200 transition-all flex items-center justify-center opacity-40 hover:opacity-100">
                                <Plus size={18} className="text-slate-100" />
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
          
          {/* SOPORTE MÓVIL AL FINAL */}
          <div className="lg:hidden mt-10">
            <SupportBox />
          </div>
        </main>
      </div>

      {/* MODAL DETALLES / NOTAS */}
      {selectedBooking && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-50 flex items-center justify-center p-6">
          <div className="bg-white p-10 rounded-[3rem] w-full max-w-sm shadow-2xl relative">
            <button onClick={() => setSelectedBooking(null)} className="absolute top-8 right-8 text-slate-300"><X/></button>
            <h3 className="text-2xl font-black mb-8 flex items-center gap-2">Reserva</h3>
            <div className="space-y-6">
               <div>
                 <p className="text-[10px] font-black text-slate-300 uppercase mb-3">Notas del Experimento</p>
                 <textarea 
                   disabled={selectedBooking.user_id !== currentUser.id} 
                   value={tempNotes}
                   onChange={(e) => setTempNotes(e.target.value)}
                   className="w-full p-5 bg-slate-50 rounded-2xl text-sm border-none focus:ring-2 focus:ring-blue-500 min-h-[150px] outline-none" 
                   placeholder={selectedBooking.user_id === currentUser.id ? "Escribe aquí tus observaciones..." : "Sin notas."} 
                 />
               </div>
               
               <div className="flex gap-2">
                 {selectedBooking.user_id === currentUser.id && (
                   <button onClick={saveNotes} className="flex-1 bg-blue-600 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-blue-100">
                     <Save size={18}/> Guardar
                   </button>
                 )}
                 {(currentUser.is_admin || selectedBooking.user_id === currentUser.id) && (
                   <button onClick={async () => { if(window.confirm("¿Borrar?")) { await supabase.from('bookings').delete().eq('id', selectedBooking.id); fetchData(); setSelectedBooking(null); } }} className="bg-red-50 text-red-600 font-bold px-6 py-4 rounded-2xl"><Trash2 size={20}/></button>
                 )}
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}