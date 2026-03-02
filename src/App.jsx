import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { format, startOfWeek, addWeeks, addDays, isAfter, setHours, setMinutes, isSameDay, parseISO, addHours, differenceInHours } from 'date-fns';
import { Lock, Unlock, UserPlus, ShieldCheck, Plus, X, Trash2, MessageSquare, LogOut } from 'lucide-react';

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
    const { data, error } = await supabase
      .from('authorized_users')
      .select('*')
      .eq('email', loginData.email)
      .eq('password', loginData.password)
      .single();

    if (error || !data) return alert("Credenciales incorrectas");
    if (!data.is_approved) return alert("Tu cuenta está pendiente de aprobación por Emiliano.");
    
    setCurrentUser(data);
    localStorage.setItem('cellblock_user', JSON.stringify(data));
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('authorized_users').insert([{
      full_name: regData.name,
      email: regData.email,
      user_code: regData.code.toUpperCase(),
      password: regData.password,
      is_approved: false
    }]);
    if (error) alert("Error en el registro. Quizás el correo ya existe.");
    else { alert("Registro exitoso. Avisa a Emiliano para que te autorice."); setShowRegModal(false); }
  };

  const checkConsecutiveHours = (day, hour) => {
    const weekStart = startOfWeek(addWeeks(new Date(), viewWeekOffset), { weekStartsOn: 1 });
    const target = setHours(addDays(weekStart, day), hour);
    
    const dayBookings = bookings
      .filter(b => b.user_id === currentUser.id && b.hood_id === selectedHood.id && isSameDay(parseISO(b.start_time), target))
      .map(b => parseISO(b.start_time).getHours())
      .concat(hour)
      .sort((a, b) => a - b);

    let consecutive = 1;
    for (let i = 0; i < dayBookings.length - 1; i++) {
      if (dayBookings[i+1] === dayBookings[i] + 1) consecutive++;
      else consecutive = 1;
      if (consecutive > 3) return false;
    }
    return true;
  };

  const handleBooking = async (day, hour) => {
    if (!checkConsecutiveHours(day, hour)) return alert("Límite: Máximo 3 horas consecutivas.");
    const notes = prompt("Observaciones (opcional):");
    const startTime = setHours(addDays(startOfWeek(addWeeks(new Date(), viewWeekOffset), { weekStartsOn: 1 }), day), hour);
    
    await supabase.from('bookings').insert([{
      hood_id: selectedHood.id,
      user_id: currentUser.id,
      user_name: currentUser.user_code,
      start_time: startTime.toISOString(),
      end_time: addHours(startTime, 1).toISOString(),
      notes: notes
    }]);
    fetchData();
  };

  const deleteBooking = async (id) => {
    if (!window.confirm("¿Borrar esta reserva?")) return;
    await supabase.from('bookings').delete().eq('id', id);
    fetchData();
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6 font-sans">
        <div className="bg-white p-10 rounded-[40px] shadow-2xl w-full max-w-md border border-slate-200">
          <div className="bg-blue-600 w-16 h-16 rounded-3xl flex items-center justify-center text-white mb-6 mx-auto shadow-lg">
            <ShieldCheck size={32} />
          </div>
          <h1 className="text-3xl font-black text-center text-slate-800 mb-2">CellBlock</h1>
          <p className="text-center text-slate-400 text-sm mb-8 italic">Lab 10-401 Access Control</p>
          <form onSubmit={handleLogin} className="space-y-4">
            <input required type="email" placeholder="Email institucional" className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all" 
              onChange={e => setLoginData({...loginData, email: e.target.value})} />
            <input required type="password" placeholder="Contraseña" className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all" 
              onChange={e => setLoginData({...loginData, password: e.target.value})} />
            <button className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl hover:bg-black transition-all shadow-lg">Entrar</button>
          </form>
          <button onClick={() => setShowRegModal(true)} className="w-full mt-4 text-sm font-bold text-blue-600 hover:text-blue-800">Solicitar acceso</button>
        </div>
        {showRegModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <div className="bg-white p-8 rounded-[40px] w-full max-w-md relative shadow-2xl">
              <button onClick={() => setShowRegModal(false)} className="absolute top-6 right-6 text-slate-300"><X /></button>
              <h2 className="text-2xl font-black mb-6">Nuevo Perfil</h2>
              <form onSubmit={handleRegister} className="space-y-4">
                <input required placeholder="Nombre completo" className="w-full px-5 py-3 bg-slate-50 rounded-xl" onChange={e => setRegData({...regData, name: e.target.value})} />
                <input required placeholder="email@ibt.unam.mx" className="w-full px-5 py-3 bg-slate-50 rounded-xl" onChange={e => setRegData({...regData, email: e.target.value})} />
                <input required placeholder="Código (3 letras)" maxLength={3} className="w-full px-5 py-3 bg-slate-50 rounded-xl uppercase" onChange={e => setRegData({...regData, code: e.target.value})} />
                <input required type="password" placeholder="Contraseña segura" className="w-full px-5 py-3 bg-slate-50 rounded-xl" onChange={e => setRegData({...regData, password: e.target.value})} />
                <button className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-100">Registrar y esperar aprobación</button>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans antialiased text-slate-900">
      <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200 px-8 py-4 flex justify-between items-center sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="bg-slate-900 p-2 rounded-xl text-white shadow-md"><ShieldCheck size={20}/></div>
          <h1 className="text-xl font-black tracking-tighter">CellBlock <span className="text-blue-600">.</span></h1>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-xs font-black leading-none">{currentUser.full_name}</p>
            <p className="text-[10px] text-blue-500 font-bold uppercase mt-1 tracking-widest">{currentUser.user_code}</p>
          </div>
          <button onClick={() => {localStorage.clear(); window.location.reload();}} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><LogOut size={20}/></button>
        </div>
      </nav>

      <div className="max-w-[1600px] mx-auto px-8 mt-8 grid grid-cols-12 gap-8">
        <aside className="col-span-2 space-y-2">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4 mb-4 italic">Campanas Disponibles</p>
          {hoods.map(h => (
            <button key={h.id} onClick={() => setSelectedHood(h)}
              className={`w-full text-left px-5 py-3.5 rounded-2xl text-xs font-black transition-all ${selectedHood?.id === h.id ? 'bg-white shadow-xl shadow-slate-200/50 border border-blue-100 text-blue-600 scale-[1.02]' : 'text-slate-400 hover:bg-white hover:text-slate-600'}`}>
              {h.name}
            </button>
          ))}
        </aside>

        <main className="col-span-10 space-y-6">
          <div className="flex items-center justify-between bg-white p-2 rounded-2xl border border-slate-100 shadow-sm">
             <div className="flex gap-1">
                {[0, 1, 2, 3].map(offset => (
                  <button key={offset} onClick={() => setViewWeekOffset(offset)} className={`px-6 py-2.5 text-[10px] font-black rounded-xl transition-all ${viewWeekOffset === offset ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}>
                    SEMANA {offset + 1}
                  </button>
                ))}
             </div>
             <p className="text-[11px] font-black text-slate-400 px-6 uppercase tracking-widest">
               {format(startOfWeek(addWeeks(new Date(), viewWeekOffset), { weekStartsOn: 1 }), 'dd MMM')} — {format(addDays(startOfWeek(addWeeks(new Date(), viewWeekOffset), { weekStartsOn: 1 }), 6), 'dd MMM yyyy')}
             </p>
          </div>

          <div className="bg-white rounded-[40px] border border-slate-200 shadow-2xl shadow-slate-200/50 overflow-hidden">
            <div className="overflow-y-auto max-h-[70vh]">
              <table className="w-full border-collapse table-fixed">
                <thead className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm">
                  <tr className="border-b border-slate-50">
                    <th className="w-20 p-4 text-[9px] font-black text-slate-300 uppercase tracking-tighter">Hora</th>
                    {DAYS_NAME.map((d, i) => (
                      <th key={d} className={`p-4 text-[11px] font-black border-l border-slate-50 uppercase ${i >= 5 ? 'text-blue-300' : 'text-slate-700'}`}>
                        {d} <span className="block text-[9px] text-slate-400 font-medium mt-1">{format(addDays(startOfWeek(addWeeks(new Date(), viewWeekOffset), { weekStartsOn: 1 }), i), 'dd/MM')}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {HOURS.map(hour => (
                    <tr key={hour} className="border-b border-slate-50 group hover:bg-slate-50/30 transition-colors">
                      <td className="p-3 text-[10px] font-black text-slate-300 text-center">{hour}:00</td>
                      {[0,1,2,3,4,5,6].map(day => {
                        const slotDate = setHours(addDays(startOfWeek(addWeeks(new Date(), viewWeekOffset), { weekStartsOn: 1 }), day), hour);
                        const booking = bookings.find(b => b.hood_id === selectedHood?.id && new Date(b.start_time).getTime() === slotDate.getTime());
                        const isMine = booking?.user_id === currentUser.id;

                        return (
                          <td key={day} className="border-l border-slate-50 h-16 p-1 relative">
                            {booking ? (
                              <div className={`h-full w-full rounded-2xl p-2 flex flex-col justify-center transition-all border ${isMine ? 'bg-blue-600 border-blue-400 shadow-lg shadow-blue-100' : 'bg-slate-50 border-slate-100'}`}>
                                <div className="flex items-center justify-between">
                                  <span className={`text-[10px] font-black uppercase tracking-tighter ${isMine ? 'text-white' : 'text-slate-600'}`}>{booking.user_name}</span>
                                  {isMine && <button onClick={() => deleteBooking(booking.id)} className="text-white/60 hover:text-white transition-colors"><Trash2 size={10}/></button>}
                                </div>
                                {booking.notes && (
                                  <div className="flex items-center gap-1 mt-1">
                                    <MessageSquare size={8} className={isMine ? 'text-blue-200' : 'text-slate-300'} />
                                    <span className={`text-[8px] truncate italic ${isMine ? 'text-blue-100' : 'text-slate-400'}`}>{booking.notes}</span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <button onClick={() => handleBooking(day, hour)} className="w-full h-full rounded-2xl hover:bg-white hover:shadow-md flex items-center justify-center opacity-0 hover:opacity-100 transition-all">
                                <Plus size={16} className="text-blue-200" />
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
    </div>
  );
}