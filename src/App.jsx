import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { format, startOfWeek, addWeeks, addDays, isAfter, setHours, setMinutes, isSameDay, parseISO, addHours } from 'date-fns';
import { Calendar, Clock, UserPlus, ShieldCheck, Plus, X, Info } from 'lucide-react';

const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAYS_NAME = ['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB', 'DOM'];

export default function App() {
  const [hoods, setHoods] = useState([]);
  const [selectedHood, setSelectedHood] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [authUsers, setAuthUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [viewWeekOffset, setViewWeekOffset] = useState(0);
  const [showRegModal, setShowRegModal] = useState(false);
  const [regData, setRegData] = useState({ name: '', email: '', code: '' });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const { data: h } = await supabase.from('hoods').select('*').order('name');
    setHoods(h || []);
    if (h?.length > 0 && !selectedHood) setSelectedHood(h[0]);
    const { data: b } = await supabase.from('bookings').select('*');
    setBookings(b || []);
    const { data: u } = await supabase.from('authorized_users').select('*').order('full_name');
    setAuthUsers(u || []);
  }

  // Lógica de liberación de 2 semanas
  const isSlotLocked = (weekOffset) => {
    if (weekOffset <= 1) return false; // Las primeras 2 semanas siempre abiertas
    const now = new Date();
    const startOfCurrentWeek = startOfWeek(now, { weekStartsOn: 1 });
    // El viernes de la segunda semana a las 9:00 AM
    const releaseTime = setMinutes(setHours(addDays(startOfCurrentWeek, 11), 9), 0);
    return !isAfter(now, releaseTime);
  };

  const checkConsecutiveLimit = (day, hour) => {
    const currentWeekStart = startOfWeek(addWeeks(new Date(), viewWeekOffset), { weekStartsOn: 1 });
    const targetDate = setHours(addDays(currentWeekStart, day), hour);
    
    // Filtramos las reservas del usuario en esta campana y este día
    const myBookings = bookings
      .filter(b => b.user_name === selectedUser.user_code && b.hood_id === selectedHood.id && isSameDay(parseISO(b.start_time), targetDate))
      .map(b => parseISO(b.start_time).getHours());

    myBookings.push(hour);
    myBookings.sort((a, b) => a - b);

    let consecutive = 1;
    for (let i = 0; i < myBookings.length - 1; i++) {
      if (myBookings[i+1] === myBookings[i] + 1) consecutive++;
      else consecutive = 1;
      if (consecutive > 3) return false;
    }
    return true;
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('authorized_users').insert([{
      full_name: regData.name,
      email: regData.email,
      user_code: regData.code.toUpperCase().slice(0, 3)
    }]);
    if (error) alert("Error: Los datos ya existen o el sistema falló.");
    else { setShowRegModal(false); fetchData(); }
  };

  const handleBooking = async (day, hour) => {
    if (!selectedUser) return alert("Selecciona tu nombre arriba.");
    if (isSlotLocked(viewWeekOffset)) return alert("Este bloque se libera el viernes a las 9:00 AM.");
    if (!checkConsecutiveLimit(day, hour)) return alert("Límite: Máximo 3 horas seguidas por usuario.");

    const startTime = setHours(addDays(startOfWeek(addWeeks(new Date(), viewWeekOffset), { weekStartsOn: 1 }), day), hour);
    
    const { error } = await supabase.from('bookings').insert([{
      hood_id: selectedHood.id,
      user_name: selectedUser.user_code,
      user_email: selectedUser.email, // <--- AQUÍ FIXEAMOS EL ERROR
      start_time: startTime.toISOString(),
      end_time: addHours(startTime, 1).toISOString()
    }]);

    if (error) alert(error.message);
    else fetchData();
  };

  const currentWeekStart = startOfWeek(addWeeks(new Date(), viewWeekOffset), { weekStartsOn: 1 });

  return (
    <div className="min-h-screen bg-[#F5F7FA] text-slate-800 font-sans antialiased">
      <nav className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-xl text-white">
            <ShieldCheck size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">CellBlock</h1>
            <p className="text-[10px] text-blue-500 font-bold uppercase tracking-widest leading-none mt-1">Lab 10-401 System</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <select 
            onChange={(e) => setSelectedUser(authUsers.find(u => u.id === e.target.value))}
            className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none min-w-[220px]"
          >
            <option value="">¿Quién reserva?</option>
            {authUsers.map(u => <option key={u.id} value={u.id}>{u.full_name} ({u.user_code})</option>)}
          </select>
          <button onClick={() => setShowRegModal(true)} className="flex items-center gap-2 bg-white border border-gray-200 px-4 py-2 rounded-xl text-sm font-bold hover:bg-gray-50 transition-all shadow-sm">
            <UserPlus size={18} className="text-blue-600" />
            <span>Registro</span>
          </button>
        </div>
      </nav>

      <div className="max-w-[1600px] mx-auto px-8 mt-8 grid grid-cols-12 gap-8">
        <aside className="col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
            <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">Equipos</h3>
            <div className="space-y-2">
              {hoods.map(h => (
                <button key={h.id} onClick={() => setSelectedHood(h)}
                  className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all ${selectedHood?.id === h.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'text-gray-500 hover:bg-gray-50'}`}>
                  {h.name}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-start gap-2 p-4 bg-blue-50 rounded-xl border border-blue-100">
            <Info size={16} className="text-blue-600 mt-0.5" />
            <p className="text-[10px] text-blue-700 leading-relaxed font-medium">
              Uso 24/7. Máximo 3 horas consecutivas. Las semanas se liberan quincenalmente los viernes 9:00 AM.
            </p>
          </div>
        </aside>

        <main className="col-span-10 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex bg-white p-1.5 rounded-2xl border border-gray-200 shadow-sm">
              {[0, 1, 2, 3].map(offset => (
                <button key={offset} onClick={() => setViewWeekOffset(offset)} 
                  className={`px-6 py-2 text-xs font-bold rounded-xl transition-all ${viewWeekOffset === offset ? 'bg-slate-900 text-white' : 'text-gray-400 hover:text-gray-600'}`}>
                  {offset === 0 ? 'S1' : offset === 1 ? 'S2' : offset === 2 ? 'S3' : 'S4'}
                </button>
              ))}
            </div>
            <div className="text-sm font-bold text-gray-400 bg-white px-6 py-2.5 rounded-2xl border border-gray-200 shadow-sm">
              {format(currentWeekStart, 'dd MMM')} — {format(addDays(currentWeekStart, 6), 'dd MMM yyyy')}
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-gray-200 shadow-xl shadow-gray-200/50 overflow-hidden">
            <div className="overflow-y-auto max-h-[65vh]">
              <table className="w-full border-collapse table-fixed">
                <thead className="sticky top-0 z-30 bg-white">
                  <tr>
                    <th className="w-24 p-4 text-[10px] font-bold text-gray-300 border-b border-gray-100 uppercase">Hora</th>
                    {DAYS_NAME.map((d, i) => (
                      <th key={d} className={`p-4 text-[11px] font-bold border-b border-gray-100 border-l border-gray-50 uppercase ${i >= 5 ? 'bg-gray-50/50 text-blue-400' : 'text-gray-700'}`}>
                        {d} <span className="block text-[9px] text-gray-400 font-normal mt-1">{format(addDays(currentWeekStart, i), 'dd/MM')}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {HOURS.map(hour => (
                    <tr key={hour} className="group border-b border-gray-50 last:border-0">
                      <td className="p-3 text-[10px] font-bold text-gray-300 text-center bg-gray-50/20">{hour}:00</td>
                      {[0,1,2,3,4,5,6].map(day => {
                        const slotDate = setHours(addDays(currentWeekStart, day), hour);
                        const booking = bookings.find(b => 
                          b.hood_id === selectedHood?.id && 
                          new Date(b.start_time).getTime() === slotDate.getTime()
                        );
                        return (
                          <td key={day} className={`border-l border-gray-50 h-16 p-1 relative ${day >= 5 ? 'bg-gray-50/30' : ''}`}>
                            {booking ? (
                              <div className="h-full w-full bg-white border border-blue-100 rounded-xl p-2 flex flex-col justify-center shadow-sm hover:border-blue-300 transition-all">
                                <span className="text-[10px] font-black text-blue-700 uppercase tracking-tighter leading-none">{booking.user_name}</span>
                                <span className="text-[8px] text-gray-400 font-bold mt-1 uppercase">{hour}:00</span>
                              </div>
                            ) : (
                              <button onClick={() => handleBooking(day, hour)} className="w-full h-full rounded-xl hover:bg-white hover:shadow-md flex items-center justify-center opacity-0 hover:opacity-100 transition-all group/btn">
                                <Plus size={16} className="text-blue-300 group-hover/btn:scale-125 transition-transform" />
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

      {showRegModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-md p-10 relative">
            <button onClick={() => setShowRegModal(false)} className="absolute top-6 right-6 text-gray-300 hover:text-gray-500"><X size={24}/></button>
            <h2 className="text-3xl font-black text-gray-800 mb-2">Registro</h2>
            <p className="text-gray-400 text-sm mb-8">Únete a la red de CellBlock Lab 10-401.</p>
            <form onSubmit={handleRegister} className="space-y-5">
              <input required type="text" placeholder="Nombre completo" className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium"
                onChange={e => setRegData({...regData, name: e.target.value})} />
              <input required type="email" placeholder="email@ibt.unam.mx" className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium"
                onChange={e => setRegData({...regData, email: e.target.value})} />
              <input required maxLength={3} type="text" placeholder="Código (Ej: EBR)" className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-black uppercase"
                onChange={e => setRegData({...regData, code: e.target.value})} />
              <button type="submit" className="w-full bg-blue-600 text-white font-black py-5 rounded-[20px] shadow-xl shadow-blue-200 hover:bg-blue-700 hover:scale-[1.02] transition-all">Crear Perfil</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}