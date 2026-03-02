import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { format, startOfWeek, addWeeks, addDays, isAfter, setHours, setMinutes, isSameDay, parseISO, addHours } from 'date-fns';
import { ShieldCheck, UserPlus, Plus, X, Trash2, MessageSquare, LogOut, Info, Smartphone, Mail, User, Monitor, ChevronRight } from 'lucide-react';

const ADMIN_CONFIG = {
  name: "Emiliano Balderas Ramírez",
  email: "emiliano.balderas@ibt.unam.mx",
  group: "Grupo Palomares-Ramírez (GPR)",
  institute: "Instituto de Biotecnología UNAM",
  suite: "HostCell",
  description: "una suite para cultivo celular y bioprocesos"
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
  const [showPwaModal, setShowPwaModal] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [regData, setRegData] = useState({ name: '', email: '', code: '', password: '' });
  const [selectedBooking, setSelectedBooking] = useState(null);

  useEffect(() => {
    const session = localStorage.getItem('cellblock_user');
    if (session) setCurrentUser(JSON.parse(session));
    fetchData();

    // Capturar evento de instalación para Chrome (PC)
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    });
  }, []);

  async function fetchData() {
    const { data: h } = await supabase.from('hoods').select('*').order('name');
    setHoods(h || []);
    if (h?.length > 0 && !selectedHood) setSelectedHood(h[0]);
    const { data: b } = await supabase.from('bookings').select('*');
    setBookings(b || []);
  }

  // --- LÓGICA DE LIBERACIÓN SÁBADO 11:00 AM ---
  const isWeekLocked = (offset) => {
    if (currentUser?.is_admin) return false; // El administrador puede anotar el día que quiera
    if (offset <= 1) return false; // Primeras 2 semanas siempre abiertas
    
    const now = new Date();
    const startOfCurrentWeek = startOfWeek(now, { weekStartsOn: 1 });
    // Sábado de la segunda semana (día 12 contando desde el lunes de la sem 1) a las 11:00 AM
    const releaseDate = setMinutes(setHours(addDays(startOfCurrentWeek, 12), 11), 0);
    
    return !isAfter(now, releaseDate);
  };

  // --- LÓGICA DE 3 HORAS BLINDADA ---
  const checkConsecutiveLimit = (day, hour) => {
    const weekStart = startOfWeek(addWeeks(new Date(), viewWeekOffset), { weekStartsOn: 1 });
    const targetDate = setHours(addDays(weekStart, day), hour);
    
    const userHours = bookings
      .filter(b => b.user_id === currentUser.id && b.hood_id === selectedHood.id && isSameDay(parseISO(b.start_time), targetDate))
      .map(b => parseISO(b.start_time).getHours());

    const allSorted = [...userHours, hour].sort((a, b) => a - b);
    
    let currentStreak = 1;
    let maxStreak = 1;

    for (let i = 0; i < allSorted.length - 1; i++) {
      if (allSorted[i + 1] === allSorted[i] + 1) {
        currentStreak++;
      } else {
        currentStreak = 1;
      }
      maxStreak = Math.max(maxStreak, currentStreak);
    }
    
    return maxStreak <= 3;
  };

  const handleBooking = async (day, hour) => {
    if (isWeekLocked(viewWeekOffset)) return alert("Este bloque se libera el sábado de la segunda semana a las 11:00 AM.");
    if (!checkConsecutiveLimit(day, hour)) return alert("Límite GPR: Máximo 3 horas consecutivas.");
    
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

  const deleteBooking = async (id, userId) => {
    const canDelete = currentUser.is_admin || userId === currentUser.id;
    if (!canDelete) return alert("Solo el administrador o el dueño pueden borrar esta reserva.");
    
    if (!window.confirm("¿Liberar este espacio de campana?")) return;
    await supabase.from('bookings').delete().eq('id', id);
    setSelectedBooking(null);
    fetchData();
  };

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') setInstallPrompt(null);
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="inline-flex p-4 bg-blue-600 rounded-3xl text-white shadow-xl mb-4">
              <ShieldCheck size={42} />
            </div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tighter">CellBlock</h1>
            <p className="text-blue-600 font-bold text-[10px] uppercase tracking-[0.3em]">HostCell Suite</p>
          </div>
          <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100">
            <form onSubmit={async (e) => {
              e.preventDefault();
              const { data, error } = await supabase.from('authorized_users').select('*').eq('email', loginData.email).eq('password', loginData.password).single();
              if (error || !data) return alert("Error de acceso.");
              if (!data.is_approved) return alert("Tu cuenta debe ser aprobada por el administrador.");
              setCurrentUser(data);
              localStorage.setItem('cellblock_user', JSON.stringify(data));
            }} className="space-y-4">
              <input required type="email" placeholder="Email @ibt.unam.mx" className="w-full px-5 py-4 bg-slate-50 rounded-2xl outline-none text-sm" onChange={e => setLoginData({...loginData, email: e.target.value})} />
              <input required type="password" placeholder="Contraseña" className="w-full px-5 py-4 bg-slate-50 rounded-2xl outline-none text-sm" onChange={e => setLoginData({...loginData, password: e.target.value})} />
              <button className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl hover:bg-black transition-all">Entrar</button>
            </form>
            <button onClick={() => setShowRegModal(true)} className="w-full mt-6 text-xs font-bold text-blue-600 hover:underline">Solicitar Acceso</button>
          </div>
        </div>
        {showRegModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-6">
            <div className="bg-white p-10 rounded-[3rem] w-full max-w-md">
              <button onClick={() => setShowRegModal(false)} className="absolute top-8 right-8 text-slate-300"><X/></button>
              <h2 className="text-2xl font-black mb-6 italic">Registro de Miembro</h2>
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

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900">
      {/* HEADER REFINADO */}
      <nav className="bg-white/95 border-b border-slate-100 px-10 py-6 sticky top-0 z-40">
        <div className="max-w-[1600px] mx-auto flex justify-between items-center">
          <div className="flex items-center gap-6">
            <div className="bg-blue-600 p-3 rounded-2xl text-white shadow-xl shadow-blue-50"><ShieldCheck size={28}/></div>
            <div>
              <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
                CellBlock <span className="text-slate-200">|</span> <span className="text-slate-800">{ADMIN_CONFIG.suite}</span>
              </h1>
              <p className="text-[11px] font-bold text-blue-600 uppercase tracking-tight">{ADMIN_CONFIG.description}</p>
              <div className="mt-1 flex items-center gap-2 text-slate-400 font-bold uppercase text-[9px]">
                 <span>{ADMIN_CONFIG.group}</span>
                 <span className="text-slate-200">•</span>
                 <span>{ADMIN_CONFIG.institute}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-8">
            <button onClick={() => setShowPwaModal(true)} className="flex items-center gap-2 text-slate-400 hover:text-blue-600 transition-colors">
              <Smartphone size={18} className="animate-bounce" />
              <span className="text-[10px] font-black uppercase tracking-widest">App Instalable</span>
            </button>
            <div className="text-right">
               <p className="text-xs font-black">{currentUser.full_name} {currentUser.is_admin && <span className="bg-blue-100 text-blue-600 px-2 py-0.5 rounded-md text-[8px] ml-1">ADMIN</span>}</p>
               <button onClick={() => {localStorage.clear(); window.location.reload();}} className="text-[9px] font-bold text-red-500 hover:underline mt-1 uppercase">Cerrar Sesión</button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-[1600px] mx-auto px-10 mt-12 grid grid-cols-12 gap-10 pb-20">
        <aside className="col-span-12 lg:col-span-2 space-y-8">
          <div className="space-y-3">
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] px-2 mb-4">Campanas GPR</p>
            {hoods.map(h => (
              <button key={h.id} onClick={() => setSelectedHood(h)}
                className={`w-full text-left px-6 py-4 rounded-2xl text-xs font-black transition-all ${selectedHood?.id === h.id ? 'bg-blue-600 text-white shadow-2xl shadow-blue-100' : 'text-slate-400 hover:bg-slate-50'}`}>
                {h.name}
              </button>
            ))}
          </div>
          <div className="p-8 bg-slate-900 rounded-[2.5rem] text-white space-y-6">
             <div className="flex items-center gap-2 text-blue-400"><Info size={16}/><span className="text-[10px] font-black uppercase">Créditos</span></div>
             <p className="text-[10px] leading-relaxed font-medium opacity-60">
                PulseGrowth y CellBlock son parte de {ADMIN_CONFIG.suite}, herramientas bioprocesales construidas por {ADMIN_CONFIG.adminName}.
             </p>
             <div className="pt-4 border-t border-white/10 text-[9px] font-bold text-slate-400">
                <p>ADMIN: {ADMIN_CONFIG.adminName}</p>
                <p className="mt-1">{ADMIN_CONFIG.adminEmail}</p>
             </div>
          </div>
        </aside>

        <main className="col-span-12 lg:col-span-10 space-y-8">
          <div className="flex items-center justify-between">
            <div className="flex bg-slate-50 p-1.5 rounded-2xl border border-slate-100 w-fit">
               {[0, 1, 2, 3].map(offset => (
                 <button key={offset} onClick={() => setViewWeekOffset(offset)} className={`px-8 py-3 text-[10px] font-black rounded-xl transition-all ${viewWeekOffset === offset ? 'bg-white text-blue-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>
                   SEMANA {offset + 1} {isWeekLocked(offset) && '🔒'}
                 </button>
               ))}
            </div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-6 py-3 rounded-2xl border border-slate-100">
              {format(startOfWeek(addWeeks(new Date(), viewWeekOffset), { weekStartsOn: 1 }), 'dd MMM')} — {format(addDays(startOfWeek(addWeeks(new Date(), viewWeekOffset), { weekStartsOn: 1 }), 6), 'dd MMM yyyy')}
            </div>
          </div>

          <div className="bg-white rounded-[3.5rem] border border-slate-100 shadow-2xl shadow-slate-100 overflow-hidden">
             <div className="overflow-x-auto">
               <table className="w-full border-collapse table-fixed min-w-[1000px]">
                 <thead>
                   <tr className="bg-slate-50/50 border-b border-slate-100">
                     <th className="w-20 p-6 text-[9px] font-black text-slate-300 uppercase tracking-widest">Hora</th>
                     {DAYS_NAME.map((d, i) => (
                       <th key={d} className={`p-6 text-[11px] font-black border-l border-slate-100 uppercase ${i >= 5 ? 'text-blue-400' : 'text-slate-700'}`}>
                         {d} <span className="block text-[9px] text-slate-300 font-normal mt-1">{format(addDays(startOfWeek(addWeeks(new Date(), viewWeekOffset), { weekStartsOn: 1 }), i), 'dd/MM')}</span>
                       </th>
                     ))}
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-50">
                   {HOURS.map(hour => (
                     <tr key={hour} className="group hover:bg-slate-50/30 transition-colors">
                        <td className="p-4 text-[10px] font-black text-slate-200 text-center">{hour}:00</td>
                        {[0,1,2,3,4,5,6].map(day => {
                          const slotDate = setHours(addDays(startOfWeek(addWeeks(new Date(), viewWeekOffset), { weekStartsOn: 1 }), day), hour);
                          const booking = bookings.find(b => b.hood_id === selectedHood?.id && new Date(b.start_time).getTime() === slotDate.getTime());
                          const isMine = booking?.user_id === currentUser.id;

                          return (
                            <td key={day} className={`border-l border-slate-50 h-20 p-1.5 relative ${isWeekLocked(viewWeekOffset) ? 'opacity-30 cursor-not-allowed' : ''}`}>
                              {booking ? (
                                <button onClick={() => setSelectedBooking(booking)} className={`h-full w-full rounded-2xl p-3 flex flex-col justify-center transition-all border text-left ${isMine ? 'bg-blue-600 border-blue-400 text-white shadow-lg' : 'bg-slate-50 border-slate-100 text-slate-700 hover:border-slate-300'}`}>
                                  <span className="text-[11px] font-black uppercase tracking-tighter">{booking.user_name}</span>
                                  {booking.notes && <div className={`text-[8px] mt-1 truncate ${isMine ? 'text-blue-200' : 'text-slate-400'}`}>{booking.notes}</div>}
                                </button>
                              ) : (
                                <button disabled={isWeekLocked(viewWeekOffset)} onClick={() => handleBooking(day, hour)} className="w-full h-full rounded-2xl border-2 border-dashed border-slate-50 hover:border-blue-100 hover:bg-white transition-all flex items-center justify-center opacity-40 hover:opacity-100">
                                  <Plus size={18} className="text-slate-200" />
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

      {/* MODAL PWA INSTRUCTIONS */}
      {showPwaModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xl z-50 flex items-center justify-center p-6">
          <div className="bg-white p-12 rounded-[3.5rem] w-full max-w-lg shadow-2xl relative">
            <button onClick={() => setShowPwaModal(false)} className="absolute top-10 right-10 text-slate-300 hover:text-slate-600"><X size={24}/></button>
            <Smartphone size={40} className="text-blue-600 mb-6"/>
            <h2 className="text-3xl font-black mb-1 tracking-tighter">Instalar App</h2>
            <p className="text-slate-400 text-sm mb-10 font-bold uppercase tracking-widest">CellBlock Lab 10-401</p>
            
            <div className="space-y-6">
               <div className="flex gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <Monitor size={24} className="text-blue-600 shrink-0" />
                  <div>
                    <p className="text-xs font-black uppercase text-blue-600 mb-1">Computadora (Chrome / Edge)</p>
                    <p className="text-[13px] text-slate-600 font-medium">Busca el icono de <strong>Instalar</strong> en la barra de direcciones (derecha) o en el menú de 3 puntos.</p>
                    {installPrompt && (
                      <button onClick={handleInstall} className="mt-3 bg-blue-600 text-white text-[10px] font-black px-4 py-2 rounded-lg uppercase">Instalar ahora en PC</button>
                    )}
                  </div>
               </div>
               <div className="flex gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <Smartphone size={24} className="text-blue-600 shrink-0" />
                  <div>
                    <p className="text-xs font-black uppercase text-blue-600 mb-1">iPhone / iPad (Safari)</p>
                    <p className="text-[13px] text-slate-600 font-medium">Toca <strong>Compartir</strong> y selecciona <strong>Añadir a la pantalla de inicio</strong>.</p>
                  </div>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE DETALLES */}
      {selectedBooking && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-6">
          <div className="bg-white p-12 rounded-[3rem] w-full max-w-sm shadow-2xl relative">
            <button onClick={() => setSelectedBooking(null)} className="absolute top-10 right-10 text-slate-300"><X/></button>
            <div className="flex items-center gap-4 mb-8">
               <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl"><Info size={24}/></div>
               <div>
                  <h3 className="text-2xl font-black">{selectedBooking.user_name}</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{format(parseISO(selectedBooking.start_time), 'EEEE HH:00')}</p>
               </div>
            </div>
            <div className="space-y-6">
               <div>
                 <p className="text-[10px] font-black text-slate-300 uppercase mb-3 tracking-widest">Observaciones</p>
                 <textarea 
                   disabled={selectedBooking.user_id !== currentUser.id}
                   defaultValue={selectedBooking.notes}
                   className="w-full p-5 bg-slate-50 rounded-2xl text-sm border-none focus:ring-1 focus:ring-blue-500 min-h-[120px] outline-none"
                   placeholder={selectedBooking.user_id === currentUser.id ? "Añade notas aquí..." : "Sin notas."}
                   onBlur={(e) => selectedBooking.user_id === currentUser.id && supabase.from('bookings').update({ notes: e.target.value }).eq('id', selectedBooking.id).then(() => fetchData())}
                 />
               </div>
               {(currentUser.is_admin || selectedBooking.user_id === currentUser.id) && (
                 <button onClick={() => deleteBooking(selectedBooking.id, selectedBooking.user_id)} className="w-full flex items-center justify-center gap-2 py-5 rounded-[20px] bg-red-50 text-red-600 font-black hover:bg-red-100 transition-all text-xs uppercase">
                   <Trash2 size={16} /> <span>{currentUser.is_admin && selectedBooking.user_id !== currentUser.id ? "Borrar (Admin Mode)" : "Liberar espacio"}</span>
                 </button>
               )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}