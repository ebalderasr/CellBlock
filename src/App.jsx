import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { format, startOfWeek, addWeeks, addDays, isAfter, setHours, setMinutes, isSameDay, parseISO } from 'date-fns';
import { Calendar, Clock, UserPlus, ShieldCheck, ChevronRight, Plus, X } from 'lucide-react';

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

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!regData.email.endsWith('@ibt.unam.mx')) {
      alert("Por favor usa tu correo institucional @ibt.unam.mx");
      return;
    }
    const { error } = await supabase.from('authorized_users').insert([{
      full_name: regData.name,
      email: regData.email,
      user_code: regData.code.toUpperCase().slice(0, 3)
    }]);
    if (error) alert("Error: El correo o código ya podrían estar registrados.");
    else {
      setShowRegModal(false);
      fetchData();
    }
  };

  const handleBooking = async (day, hour) => {
    if (!selectedUser) {
      alert("Identifícate primero seleccionando tu nombre arriba.");
      return;
    }
    const startTime = setHours(addDays(startOfWeek(addWeeks(new Date(), viewWeekOffset), { weekStartsOn: 1 }), day), hour);
    
    const { error } = await supabase.from('bookings').insert([{
      hood_id: selectedHood.id,
      user_name: selectedUser.user_code, // Guardamos el código para visualización rápida
      start_time: startTime.toISOString(),
      end_time: setHours(startTime, hour + 1).toISOString()
    }]);

    if (error) alert(error.message);
    else fetchData();
  };

  const currentWeekStart = startOfWeek(addWeeks(new Date(), viewWeekOffset), { weekStartsOn: 1 });

  return (
    <div className="min-h-screen bg-gray-50 text-slate-900 font-sans antialiased">
      {/* HEADER TIPO GOOGLE */}
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex justify-between items-center sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg text-white shadow-sm">
            <ShieldCheck size={20} />
          </div>
          <h1 className="text-lg font-bold tracking-tight text-gray-800">CellBlock <span className="text-gray-400 font-light ml-1">Lab 10-401</span></h1>
        </div>

        <div className="flex items-center gap-3">
          <select 
            onChange={(e) => setSelectedUser(authUsers.find(u => u.id === e.target.value))}
            className="bg-gray-100 border-none rounded-lg px-4 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="">¿Quién eres?</option>
            {authUsers.map(u => <option key={u.id} value={u.id}>{u.full_name} ({u.user_code})</option>)}
          </select>
          <button onClick={() => setShowRegModal(true)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
            <UserPlus size={20} />
          </button>
        </div>
      </nav>

      <div className="max-w-[1600px] mx-auto px-6 mt-6 grid grid-cols-12 gap-6">
        {/* SIDEBAR */}
        <aside className="col-span-2 space-y-1">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-4 mb-2">Equipos</p>
          {hoods.map(h => (
            <button key={h.id} onClick={() => setSelectedHood(h)}
              className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${selectedHood?.id === h.id ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-gray-500 hover:bg-gray-100'}`}>
              {h.name}
            </button>
          ))}
        </aside>

        {/* CALENDARIO */}
        <main className="col-span-10 space-y-4">
          <div className="flex items-center justify-between bg-white p-2 rounded-xl border border-gray-200 shadow-sm">
             <div className="flex gap-1">
                {[0, 1, 2].map(offset => (
                  <button key={offset} onClick={() => setViewWeekOffset(offset)} className={`px-4 py-1.5 text-xs font-bold rounded-lg ${viewWeekOffset === offset ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
                    {offset === 0 ? 'Semana 1' : offset === 1 ? 'Semana 2' : 'Semana 3'}
                  </button>
                ))}
             </div>
             <div className="text-xs font-bold text-gray-500 px-4">
                {format(currentWeekStart, 'dd MMM')} — {format(addDays(currentWeekStart, 6), 'dd MMM yyyy')}
             </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
             <div className="overflow-y-auto max-h-[75vh]">
                <table className="w-full border-collapse">
                   <thead className="sticky top-0 z-20 bg-white">
                      <tr className="border-b border-gray-100">
                         <th className="w-16 p-3 text-[10px] font-bold text-gray-300 bg-gray-50/50">HR</th>
                         {DAYS_NAME.map((d, i) => (
                           <th key={d} className="p-3 text-[11px] font-bold text-gray-600 border-l border-gray-50 uppercase">
                             {d} <span className="block text-[9px] text-gray-400 font-normal mt-0.5">{format(addDays(currentWeekStart, i), 'dd/MM')}</span>
                           </th>
                         ))}
                      </tr>
                   </thead>
                   <tbody>
                      {HOURS.map(hour => (
                        <tr key={hour} className="border-b border-gray-50 last:border-0 group">
                           <td className="p-2 text-[10px] font-bold text-gray-300 text-center bg-gray-50/20">{hour}:00</td>
                           {[0,1,2,3,4,5,6].map(day => {
                              const slotDate = setHours(addDays(currentWeekStart, day), hour);
                              const booking = bookings.find(b => 
                                b.hood_id === selectedHood?.id && 
                                new Date(b.start_time).getTime() === slotDate.getTime()
                              );
                              return (
                                <td key={day} className="border-l border-gray-50 h-12 p-0.5 relative">
                                   {booking ? (
                                      <div className="h-full w-full bg-blue-50 border border-blue-100 rounded-lg flex items-center justify-center">
                                         <span className="text-[10px] font-black text-blue-700">{booking.user_name}</span>
                                      </div>
                                   ) : (
                                      <button onClick={() => handleBooking(day, hour)} className="w-full h-full rounded-md hover:bg-blue-50/50 flex items-center justify-center opacity-0 hover:opacity-100 transition-all">
                                         <Plus size={14} className="text-blue-300" />
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

      {/* MODAL DE REGISTRO */}
      {showRegModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 relative overflow-hidden">
            <button onClick={() => setShowRegModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X /></button>
            <h2 className="text-2xl font-bold text-gray-800 mb-1">Registro de Usuario</h2>
            <p className="text-gray-500 text-sm mb-6">Solo para personal del IBt UNAM</p>
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase ml-1">Nombre Completo</label>
                <input required type="text" placeholder="Ej. Emiliano Balderas" className="w-full mt-1 px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  onChange={e => setRegData({...regData, name: e.target.value})} />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase ml-1">Correo Institucional</label>
                <input required type="email" placeholder="usuario@ibt.unam.mx" className="w-full mt-1 px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  onChange={e => setRegData({...regData, email: e.target.value})} />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase ml-1">Código (3 letras)</label>
                <input required maxLength={3} type="text" placeholder="Ej. EBR" className="w-full mt-1 px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-mono"
                  onChange={e => setRegData({...regData, code: e.target.value})} />
              </div>
              <button type="submit" className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all mt-4">Completar Registro</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}