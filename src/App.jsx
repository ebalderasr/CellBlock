import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { format, startOfWeek, addWeeks, addDays, isAfter, setHours, setMinutes, isSameDay, parseISO, addHours } from 'date-fns';
import { ShieldCheck, UserPlus, Plus, X, Trash2, MessageSquare, LogOut, Info, Smartphone, Mail, User } from 'lucide-react';

// --- CONFIGURACIÓN EDITABLE DEL ADMINISTRADOR ---
const ADMIN_CONFIG = {
  name: "Emiliano Balderas Ramírez",
  email: "emiliano.balderas@ibt.unam.mx",
  group: "Palomares-Ramírez (GPR)",
  institute: "IBt-UNAM",
  suite: "Host Cell"
};

const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAYS_NAME = ['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB', 'DOM'];

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [hoods, setHoods] = useState([]);
  const [selectedHood, setSelectedHood] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [viewWeekOffset, setViewWeekOffset] = useState(0);
  const [showRegModal, setShowRegModal] = useState(false);
  const [regData, setRegData] = useState({ name: '', email: '', code: '', password: '' });
  const [selectedBooking, setSelectedBooking] = useState(null);

  useEffect(() => {
    const session = localStorage.getItem('cellblock_user');
    if (session) setCurrentUser(JSON.parse(session));
    fetchData();
    // Registro del Service Worker para PWA
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(err => console.log("SW error", err));
    }
  }, []);

  async function fetchData() {
    const { data: h } = await supabase.from('hoods').select('*').order('name');
    setHoods(h || []);
    if (h?.length > 0 && !selectedHood) setSelectedHood(h[0]);
    const { data: b } = await supabase.from('bookings').select('*');
    setBookings(b || []);
  }

  // Lógica Robusta de 3 horas (Verifica cadenas en cualquier orden)
  const checkConsecutiveLimit = (day, hour) => {
    const weekStart = startOfWeek(addWeeks(new Date(), viewWeekOffset), { weekStartsOn: 1 });
    const targetDate = setHours(addDays(weekStart, day), hour);
    
    // Obtener todas las horas del usuario para ese día y campana
    const userHours = bookings
      .filter(b => b.user_id === currentUser.id && b.hood_id === selectedHood.id && isSameDay(parseISO(b.start_time), targetDate))
      .map(b => parseISO(b.start_time).getHours());

    // Añadir la hora que intenta reservar y ordenar
    const allHours = [...userHours, hour].sort((a, b) => a - b);
    
    let maxConsecutive = 1;
    let currentStreak = 1;

    for (let i = 0; i < allHours.length - 1; i++) {
      if (allHours[i + 1] === allHours[i] + 1) {
        currentStreak++;
      } else {
        currentStreak = 1;
      }
      maxConsecutive = Math.max(maxConsecutive, currentStreak);
    }
    
    return maxConsecutive <= 3;
  };

  const handleBooking = async (day, hour) => {
    if (!checkConsecutiveLimit(day, hour)) {
      alert("Límite GPR: No se permiten más de 3 horas consecutivas.");
      return;
    }
    const startTime = setHours(addDays(startOfWeek(addWeeks(new Date(), viewWeekOffset), { weekStartsOn: 1 }), day), hour);
    
    const { error } = await supabase.from('bookings').insert([{
      hood_id: selectedHood.id,
      user_id: currentUser.id,
      user_name: currentUser.user_code,
      start_time: startTime.toISOString(),
      end_time: addHours(startTime, 1).toISOString()
    }]);
    if (error) alert(error.message);
    else fetchData();
  };

  const updateNotes = async (id, notes) => {
    await supabase.from('bookings').update({ notes }).eq('id', id);
    setSelectedBooking(null);
    fetchData();
  };

  const deleteBooking = async (id) => {
    if (!window.confirm("¿Liberar este espacio de campana?")) return;
    await supabase.from('bookings').delete().eq('id', id);
    setSelectedBooking(null);
    fetchData();
  };

  // --- COMPONENTE DE LOGIN ---
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="inline-flex p-4 bg-blue-600 rounded-3xl text-white shadow-xl mb-4">
              <ShieldCheck size={42} />
            </div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tighter">CellBlock</h1>
            <p className="text-blue-600 font-bold text-[10px] uppercase tracking-[0.3em]">{ADMIN_CONFIG.suite} Suite</p>
          </div>
          
          <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100">
            <form onSubmit={async (e) => {
              e.preventDefault();
              const { data, error } = await supabase.from('authorized_users').select('*').eq('email', loginData.email).eq('password', loginData.password).single();
              if (error || !data) return alert("Credenciales incorrectas.");
              if (!data.is_approved) return alert("Acceso pendiente de aprobación por el administrador.");
              setCurrentUser(data);
              localStorage.setItem('cellblock_user', JSON.stringify(data));
            }} className="space-y-4">
              <input required type="email" placeholder="Correo @ibt.unam.mx" className="w-full px-5 py-4 bg-slate-50 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 text-sm" onChange={e => setLoginData({...loginData, email: e.target.value})} />
              <input required type="password" placeholder="Contraseña" className="w-full px-5 py-4 bg-slate-50 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 text-sm" onChange={e => setLoginData({...loginData, password: e.target.value})} />
              <button className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl hover:bg-black transition-all">Entrar</button>
            </form>
            <button onClick={() => setShowRegModal(true)} className="w-full mt-6 text-xs font-bold text-blue-600 hover:underline">Solicitar Acceso al GPR</button>
          </div>
        </div>

        {showRegModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-6">
            <div className="bg-white p-10 rounded-[3rem] w-full max-w-md relative">
              <button onClick={() => setShowRegModal(false)} className="absolute top-8 right-8 text-slate-300"><X/></button>
              <h2 className="text-2xl font-black mb-1">Registro</h2>
              <p className="text-slate-400 text-sm mb-8">Tu acceso requiere validación del administrador.</p>
              <form onSubmit={async (e) => {
                e.preventDefault();
                const { error } = await supabase.from('authorized_users').insert([{ 
                  full_name: regData.name, email: regData.email, user_code: regData.code.toUpperCase(), password: regData.password, is_approved: false 
                }]);
                if (error) alert("Error: El correo o código ya están en uso.");
                else { alert("Solicitud enviada. Espera la aprobación del administrador."); setShowRegModal(false); }
              }} className="space-y-4">
                <input required placeholder="Nombre completo" className="w-full px-5 py-3.5 bg-slate-50 rounded-xl" onChange={e => setRegData({...regData, name: e.target.value})} />
                <input required placeholder="email@ibt.unam.mx" className="w-full px-5 py-3.5 bg-slate-50 rounded-xl" onChange={e => setRegData({...regData, email: e.target.value})} />
                <input required placeholder="Código 3 letras (ej. EBR)" maxLength={3} className="w-full px-5 py-3.5 bg-slate-50 rounded-xl uppercase font-bold" onChange={e => setRegData({...regData, code: e.target.value})} />
                <input required type="password" placeholder="Contraseña nueva" className="w-full px-5 py-3.5 bg-slate-50 rounded-xl" onChange={e => setRegData({...regData, password: e.target.value})} />
                <button className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl shadow-lg">Enviar a Revisión</button>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- VISTA PRINCIPAL ---
  return (
    <div className="min-h-screen bg-[#F9FAFB] font-sans text-slate-900">
      <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200 px-8 py-4 flex justify-between items-center sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <div className="bg-blue-600 p-2.5 rounded-2xl text-white shadow-lg shadow-blue-100"><ShieldCheck size={22}/></div>
          <div>
            <h1 className="text-xl font-black tracking-tighter italic">CellBlock <span className="text-blue-600 font-normal">/ {ADMIN_CONFIG.group}</span></h1>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{ADMIN_CONFIG.institute}</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-black">{currentUser.full_name}</p>
            <p className="text-[10px] text-blue-500 font-bold tracking-widest">{currentUser.user_code}</p>
          </div>
          <button onClick={() => {localStorage.clear(); window.location.reload();}} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><LogOut size={20}/></button>
        </div>
      </nav>

      <div className="max-w-[1600px] mx-auto px-8 mt-10 grid grid-cols-12 gap-8">
        <aside className="col-span-12 lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
            <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest mb-4">Equipos GPR</p>
            <div className="space-y-2">
              {hoods.map(h => (
                <button key={h.id} onClick={() => setSelectedHood(h)}
                  className={`w-full text-left px-5 py-3.5 rounded-2xl text-xs font-bold transition-all ${selectedHood?.id === h.id ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}>
                  {h.name}
                </button>
              ))}
            </div>
          </div>

          <div className="p-6 bg-blue-600 rounded-[2rem] text-white space-y-4 shadow-xl shadow-blue-100">
             <div className="flex items-center gap-2"><Info size={16}/><span className="text-xs font-black uppercase tracking-tighter">Host Cell Info</span></div>
             <p className="text-[10px] leading-relaxed font-medium opacity-90">
                CellBlock is part of the <strong>{ADMIN_CONFIG.suite}</strong> lab suite. Optimized for {ADMIN_CONFIG.group} workflows.
             </p>
             <div className="pt-2 border-t border-white/20 text-[9px] font-bold">
                <p className="flex items-center gap-1"><User size={10}/> {ADMIN_CONFIG.adminName}</p>
                <p className="flex items-center gap-1 mt-1"><Mail size={10}/> {ADMIN_CONFIG.adminEmail}</p>
             </div>
          </div>
        </aside>

        <main className="col-span-12 lg:col-span-10 space-y-6 pb-20">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
             <div className="flex bg-white p-1.5 rounded-[1.5rem] border border-slate-200 shadow-sm">
                {[0, 1, 2, 3].map(offset => (
                  <button key={offset} onClick={() => setViewWeekOffset(offset)} className={`px-6 py-2.5 text-[10px] font-black rounded-xl transition-all ${viewWeekOffset === offset ? 'bg-slate-900 text-white' : 'text-slate-400 hover:text-slate-600'}`}>
                    SEMANA {offset + 1}
                  </button>
                ))}
             </div>
             <div className="flex items-center gap-4 bg-white px-6 py-3 rounded-2xl border border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-widest">
               <Smartphone size={14} className="text-blue-600 animate-pulse" />
               <span>Instalable en iOS / Android</span>
             </div>
          </div>

          <div className="bg-white rounded-[3rem] border border-slate-200 shadow-2xl shadow-slate-200/40 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse table-fixed min-w-[1000px]">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="w-20 p-5 text-[9px] font-black text-slate-300 uppercase tracking-widest border-b border-slate-100">Hora</th>
                    {DAYS_NAME.map((d, i) => (
                      <th key={d} className={`p-5 text-[11px] font-black border-l border-slate-100 border-b border-slate-100 uppercase ${i >= 5 ? 'text-blue-400' : 'text-slate-700'}`}>
                        {d} <span className="block text-[9px] text-slate-400 font-medium mt-1">{format(addDays(startOfWeek(addWeeks(new Date(), viewWeekOffset), { weekStartsOn: 1 }), i), 'dd/MM')}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {HOURS.map(hour => (
                    <tr key={hour} className="group hover:bg-slate-50/30 transition-colors">
                      <td className="p-4 text-[10px] font-black text-slate-300 text-center">{hour}:00</td>
                      {[0,1,2,3,4,5,6].map(day => {
                        const slotDate = setHours(addDays(startOfWeek(addWeeks(new Date(), viewWeekOffset), { weekStartsOn: 1 }), day), hour);
                        const booking = bookings.find(b => b.hood_id === selectedHood?.id && new Date(b.start_time).getTime() === slotDate.getTime());
                        const isMine = booking?.user_id === currentUser.id;

                        return (
                          <td key={day} className="border-l border-slate-50 h-20 p-1.5 relative">
                            {booking ? (
                              <button onClick={() => setSelectedBooking(booking)} className={`h-full w-full rounded-2xl p-3 flex flex-col justify-center transition-all border text-left ${isMine ? 'bg-blue-600 border-blue-400 shadow-lg shadow-blue-100' : 'bg-white border-slate-200'}`}>
                                <span className={`text-[11px] font-black uppercase tracking-tighter ${isMine ? 'text-white' : 'text-slate-800'}`}>{booking.user_name}</span>
                                {booking.notes && <div className={`text-[8px] mt-1 truncate ${isMine ? 'text-blue-200' : 'text-slate-400'}`}>{booking.notes}</div>}
                              </button>
                            ) : (
                              <button onClick={() => handleBooking(day, hour)} className="w-full h-full rounded-2xl border-2 border-dashed border-slate-100 hover:border-blue-200 hover:bg-white flex items-center justify-center opacity-40 hover:opacity-100 transition-all">
                                <Plus size={18} className="text-slate-300" />
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

      {/* MODAL DE DETALLES (MÁS LIMPIO) */}
      {selectedBooking && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-6 z-50">
          <div className="bg-white p-10 rounded-[3rem] w-full max-w-sm shadow-2xl relative">
            <button onClick={() => setSelectedBooking(null)} className="absolute top-8 right-8 text-slate-300 hover:text-slate-600"><X/></button>
            <div className="flex items-center gap-4 mb-8">
               <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl"><MessageSquare size={24}/></div>
               <div>
                  <h3 className="text-2xl font-black">Detalles</h3>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-tighter">{selectedBooking.user_name} | {format(parseISO(selectedBooking.start_time), 'HH:00')}</p>
               </div>
            </div>
            
            <div className="space-y-6">
               <div>
                 <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-3">Observaciones / Notas</p>
                 <textarea 
                   disabled={selectedBooking.user_id !== currentUser.id}
                   defaultValue={selectedBooking.notes}
                   className="w-full p-5 bg-slate-50 rounded-2xl text-sm border-none focus:ring-2 focus:ring-blue-500 min-h-[120px]"
                   placeholder={selectedBooking.user_id === currentUser.id ? "Añade notas aquí..." : "Sin notas."}
                   onBlur={(e) => selectedBooking.user_id === currentUser.id && updateNotes(selectedBooking.id, e.target.value)}
                 />
               </div>

               {selectedBooking.user_id === currentUser.id && (
                 <button onClick={() => deleteBooking(selectedBooking.id)} className="w-full flex items-center justify-center gap-2 py-5 rounded-[20px] bg-red-50 text-red-600 font-bold hover:bg-red-100 transition-all">
                   <Trash2 size={18} /> <span>Liberar Campana</span>
                 </button>
               )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}