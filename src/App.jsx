import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { format, startOfWeek, addWeeks, addDays, isAfter, setHours, setMinutes, isSameDay, parseISO, addHours } from 'date-fns';
import { ShieldCheck, UserPlus, Plus, X, Trash2, MessageSquare, LogOut, Info, Smartphone, Mail, User, HelpCircle, Monitor } from 'lucide-react';

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
  const [regData, setRegData] = useState({ name: '', email: '', code: '', password: '' });
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

  // --- LÓGICA DE 3 HORAS BLINDADA ---
  const checkConsecutiveLimit = (day, hour) => {
    const weekStart = startOfWeek(addWeeks(new Date(), viewWeekOffset), { weekStartsOn: 1 });
    const targetDate = setHours(addDays(weekStart, day), hour);
    
    // Obtener todas las horas del usuario este día y equipo
    const userHours = bookings
      .filter(b => b.user_id === currentUser.id && b.hood_id === selectedHood.id && isSameDay(parseISO(b.start_time), targetDate))
      .map(b => parseISO(b.start_time).getHours());

    // Algoritmo: Insertar la hora hipotética y buscar secuencias de 4
    const allSorted = [...userHours, hour].sort((a, b) => a - b);
    
    let currentStreak = 1;
    for (let i = 0; i < allSorted.length - 1; i++) {
      if (allSorted[i + 1] === allSorted[i] + 1) {
        currentStreak++;
      } else {
        currentStreak = 1;
      }
      if (currentStreak > 3) return false; // Bloquea si detecta 4 seguidas
    }
    return true;
  };

  const handleBooking = async (day, hour) => {
    if (!checkConsecutiveLimit(day, hour)) return alert("Límite GPR: No se permiten más de 3 horas consecutivas.");
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
    if (!canDelete) return alert("No tienes permisos para borrar esta reserva.");
    
    if (!window.confirm("¿Liberar este espacio?")) return;
    await supabase.from('bookings').delete().eq('id', id);
    setSelectedBooking(null);
    fetchData();
  };

  if (!currentUser) {
    // Renderizado de Login similar al previo... (omitido para brevedad en el prompt pero debe incluirse en tu App.jsx real)
    return <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="bg-white p-12 rounded-[3rem] shadow-2xl text-center max-w-sm w-full border border-slate-100">
        <ShieldCheck size={48} className="mx-auto text-blue-600 mb-4"/>
        <h1 className="text-3xl font-black italic">CellBlock</h1>
        <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-8">{ADMIN_CONFIG.suite} Suite</p>
        <form onSubmit={async (e) => {
          e.preventDefault();
          const { data, error } = await supabase.from('authorized_users').select('*').eq('email', loginData.email).eq('password', loginData.password).single();
          if (error || !data) return alert("Error de acceso.");
          if (!data.is_approved) return alert("Espera a que el administrador apruebe tu cuenta.");
          setCurrentUser(data);
          localStorage.setItem('cellblock_user', JSON.stringify(data));
        }} className="space-y-4">
          <input required type="email" placeholder="Correo Institucional" className="w-full px-6 py-4 bg-slate-50 rounded-2xl outline-none border-none text-sm" onChange={e => setLoginData({...loginData, email: e.target.value})} />
          <input required type="password" placeholder="Contraseña" className="w-full px-6 py-4 bg-slate-50 rounded-2xl outline-none border-none text-sm" onChange={e => setLoginData({...loginData, password: e.target.value})} />
          <button className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl">Entrar</button>
        </form>
        <button onClick={() => setShowRegModal(true)} className="mt-6 text-xs text-blue-600 font-bold">Solicitar acceso</button>
      </div>
      {/* Modal de registro aquí... */}
    </div>;
  }

  return (
    <div className="min-h-screen bg-[#FDFDFD] font-sans antialiased">
      {/* HEADER REFINADO */}
      <nav className="bg-white/90 backdrop-blur-md border-b border-slate-100 px-10 py-6 sticky top-0 z-40">
        <div className="max-w-[1600px] mx-auto flex justify-between items-center">
          <div className="flex items-center gap-5">
            <div className="bg-blue-600 p-3 rounded-2xl text-white shadow-xl shadow-blue-100"><ShieldCheck size={28}/></div>
            <div>
              <h1 className="text-2xl font-black tracking-tight italic">CellBlock <span className="text-slate-300 font-normal">| {ADMIN_CONFIG.suite}</span></h1>
              <p className="text-[11px] font-bold text-blue-500 uppercase tracking-tight">{ADMIN_CONFIG.description}</p>
              <div className="mt-1 flex items-center gap-2 text-slate-400">
                 <span className="text-[9px] font-bold uppercase tracking-widest">{ADMIN_CONFIG.group}</span>
                 <span className="text-[9px] opacity-30">|</span>
                 <span className="text-[9px] font-bold uppercase tracking-widest">{ADMIN_CONFIG.institute}</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-8">
            <button onClick={() => setShowPwaModal(true)} className="flex items-center gap-2 text-slate-400 hover:text-blue-600 transition-colors">
              <Smartphone size={18} className="animate-pulse"/>
              <span className="text-[10px] font-black uppercase tracking-widest">Instalable App</span>
            </button>
            <div className="h-10 w-[1px] bg-slate-100"></div>
            <div className="text-right">
               <p className="text-xs font-black">{currentUser.full_name} {currentUser.is_admin && <span className="bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full text-[8px] ml-1">ADMIN</span>}</p>
               <button onClick={() => {localStorage.clear(); window.location.reload();}} className="text-[9px] font-bold text-red-400 hover:text-red-600 uppercase mt-1">Salir</button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-[1600px] mx-auto px-10 mt-12 grid grid-cols-12 gap-10">
        <aside className="col-span-12 lg:col-span-2 space-y-8">
          <div className="space-y-3">
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest px-2">Campanas GPR</p>
            {hoods.map(h => (
              <button key={h.id} onClick={() => setSelectedHood(h)}
                className={`w-full text-left px-6 py-4 rounded-2xl text-xs font-black transition-all ${selectedHood?.id === h.id ? 'bg-blue-600 text-white shadow-2xl shadow-blue-200 translate-x-1' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}>
                {h.name}
              </button>
            ))}
          </div>

          <div className="p-8 bg-slate-900 rounded-[2.5rem] text-white space-y-5">
             <p className="text-[10px] leading-relaxed font-medium opacity-70 italic">
               "{ADMIN_CONFIG.suite} is a growing suite of practical tools built by {ADMIN_CONFIG.adminName} ({ADMIN_CONFIG.institute})."
             </p>
             <div className="pt-4 border-t border-white/10 text-[9px] font-bold space-y-2 opacity-50">
                <p>CONTACT ADMIN:</p>
                <p className="text-blue-400">{ADMIN_CONFIG.adminEmail}</p>
             </div>
          </div>
        </aside>

        <main className="col-span-12 lg:col-span-10 space-y-8 pb-32">
          {/* Navegación de semanas y tabla... similar a versión previa */}
          <div className="flex bg-white p-2 rounded-3xl border border-slate-100 shadow-sm w-fit">
            {[0, 1, 2, 3].map(offset => (
              <button key={offset} onClick={() => setViewWeekOffset(offset)} className={`px-8 py-3 text-[10px] font-black rounded-2xl transition-all ${viewWeekOffset === offset ? 'bg-slate-900 text-white' : 'text-slate-400 hover:text-slate-600'}`}>
                S{offset + 1}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-[3.5rem] border border-slate-100 shadow-2xl shadow-slate-200/50 overflow-hidden">
             {/* Renderizado de tabla HOURS y DAYS corregido con lógica deleteBooking(id, user_id) */}
             <div className="overflow-x-auto">
               <table className="w-full border-collapse min-w-[1000px]">
                 <thead>
                   <tr className="bg-slate-50/50">
                     <th className="w-20 p-6 text-[9px] font-black text-slate-300 uppercase border-b border-slate-100">HR</th>
                     {DAYS_NAME.map((d, i) => (
                       <th key={d} className="p-6 text-[11px] font-black border-l border-slate-100 border-b border-slate-100 uppercase text-slate-700">
                         {d} <span className="block text-[9px] text-slate-400 font-normal mt-1">{format(addDays(startOfWeek(addWeeks(new Date(), viewWeekOffset), { weekStartsOn: 1 }), i), 'dd/MM')}</span>
                       </th>
                     ))}
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-50">
                   {HOURS.map(hour => (
                     <tr key={hour} className="group">
                        <td className="p-4 text-[10px] font-black text-slate-300 text-center">{hour}:00</td>
                        {[0,1,2,3,4,5,6].map(day => {
                          const slotDate = setHours(addDays(startOfWeek(addWeeks(new Date(), viewWeekOffset), { weekStartsOn: 1 }), day), hour);
                          const booking = bookings.find(b => b.hood_id === selectedHood?.id && new Date(b.start_time).getTime() === slotDate.getTime());
                          const isMine = booking?.user_id === currentUser.id;
                          const canAdminDelete = currentUser.is_admin && booking;

                          return (
                            <td key={day} className="border-l border-slate-50 h-20 p-1.5 relative">
                              {booking ? (
                                <button onClick={() => setSelectedBooking(booking)} className={`h-full w-full rounded-[1.3rem] p-3 flex flex-col justify-center transition-all border text-left ${isMine ? 'bg-blue-600 border-blue-400 text-white' : 'bg-slate-50 border-slate-100 text-slate-700'}`}>
                                  <span className="text-[11px] font-black uppercase tracking-tighter">{booking.user_name}</span>
                                  {canAdminDelete && !isMine && <span className="text-[7px] bg-red-100 text-red-600 px-1 rounded absolute top-2 right-2">ADMIN CTRL</span>}
                                </button>
                              ) : (
                                <button onClick={() => handleBooking(day, hour)} className="w-full h-full rounded-[1.3rem] border-2 border-dashed border-slate-100 hover:border-blue-100 hover:bg-white transition-all flex items-center justify-center opacity-40 hover:opacity-100">
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
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl z-50 flex items-center justify-center p-6">
          <div className="bg-white p-12 rounded-[3.5rem] w-full max-w-lg shadow-2xl relative">
            <button onClick={() => setShowPwaModal(false)} className="absolute top-10 right-10 text-slate-300"><X size={24}/></button>
            <Smartphone size={40} className="text-blue-600 mb-6"/>
            <h2 className="text-3xl font-black mb-2 tracking-tighter">Instalar CellBlock</h2>
            <p className="text-slate-400 text-sm mb-10 font-medium">Lleva el control del GPR en tu pantalla de inicio como una App nativa.</p>
            
            <div className="space-y-8">
               <div className="flex gap-4">
                 <div className="bg-slate-100 h-8 w-8 rounded-full flex items-center justify-center text-xs font-black">1</div>
                 <div>
                    <p className="text-xs font-black uppercase tracking-widest text-blue-600 mb-1">PC / Mac (Chrome)</p>
                    <p className="text-sm text-slate-600 font-medium">Haz clic en el icono de <Monitor size={14} className="inline mx-1"/> "Instalar" en la barra de direcciones.</p>
                 </div>
               </div>
               <div className="flex gap-4">
                 <div className="bg-slate-100 h-8 w-8 rounded-full flex items-center justify-center text-xs font-black">2</div>
                 <div>
                    <p className="text-xs font-black uppercase tracking-widest text-blue-600 mb-1">iPhone / iOS (Safari)</p>
                    <p className="text-sm text-slate-600 font-medium">Toca el botón "Compartir" y selecciona "Añadir a la pantalla de inicio".</p>
                 </div>
               </div>
               <div className="flex gap-4">
                 <div className="bg-slate-100 h-8 w-8 rounded-full flex items-center justify-center text-xs font-black">3</div>
                 <div>
                    <p className="text-xs font-black uppercase tracking-widest text-blue-600 mb-1">Android (Chrome)</p>
                    <p className="text-sm text-slate-600 font-medium">Toca los 3 puntos verticales y selecciona "Instalar aplicación".</p>
                 </div>
               </div>
            </div>
            <button onClick={() => setShowPwaModal(false)} className="w-full mt-12 bg-slate-900 text-white font-bold py-5 rounded-2xl">Entendido</button>
          </div>
        </div>
      )}

      {/* MODAL DE DETALLES (Admin delete logic) */}
      {selectedBooking && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-6">
          <div className="bg-white p-12 rounded-[3.5rem] w-full max-w-sm shadow-2xl relative">
            <button onClick={() => setSelectedBooking(null)} className="absolute top-10 right-10 text-slate-300"><X/></button>
            <h3 className="text-2xl font-black mb-8">Gestión de Reserva</h3>
            <div className="space-y-6">
              <div>
                <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">Usuario</p>
                <p className="font-bold text-slate-700">{selectedBooking.user_name}</p>
              </div>
              {(currentUser.is_admin || selectedBooking.user_id === currentUser.id) && (
                <button onClick={() => deleteBooking(selectedBooking.id, selectedBooking.user_id)} className="w-full bg-red-50 text-red-600 font-black py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-red-100 transition-all">
                  <Trash2 size={18}/> {currentUser.is_admin && selectedBooking.user_id !== currentUser.id ? "Borrar (Admin Mode)" : "Liberar espacio"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}