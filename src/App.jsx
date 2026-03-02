import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { format, startOfWeek, addWeeks, addDays, isAfter, setHours, setMinutes } from 'date-fns';
import { Calendar as CalendarIcon, Clock, ShieldCheck, ChevronRight, Plus } from 'lucide-react';

const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);
const HOURS = Array.from({ length: 12 }, (_, i) => i + 8);

export default function App() {
  const [hoods, setHoods] = useState([]);
  const [selectedHood, setSelectedHood] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [isNextWeekOpen, setIsNextWeekOpen] = useState(false);
  const [viewNextWeek, setViewNextWeek] = useState(false);

  useEffect(() => {
    fetchData();
    const releaseTime = setMinutes(setHours(addDays(startOfWeek(new Date()), 5), 9), 0);
    setIsNextWeekOpen(isAfter(new Date(), releaseTime));
  }, []);

  async function fetchData() {
    const { data: h } = await supabase.from('hoods').select('*').order('name');
    setHoods(h || []);
    if (h?.length > 0 && !selectedHood) setSelectedHood(h[0]);
    const { data: b } = await supabase.from('bookings').select('*');
    setBookings(b || []);
  }

  const currentWeekStart = startOfWeek(viewNextWeek ? addWeeks(new Date(), 1) : new Date(), { weekStartsOn: 1 });

  const handleBooking = async (day, hour) => {
    if (viewNextWeek && !isNextWeekOpen) {
      alert("La agenda para la próxima semana se habilita el viernes a las 9:00 AM.");
      return;
    }
    const startTime = setHours(addDays(currentWeekStart, day), hour);
    const userName = prompt("Nombre del responsable:");
    if (!userName) return;

    const { error } = await supabase.from('bookings').insert([{
      hood_id: selectedHood.id,
      user_name: userName,
      user_email: `${userName.toLowerCase()}@ibt.unam.mx`,
      start_time: startTime.toISOString(),
      end_time: setHours(startTime, hour + 1).toISOString()
    }]);

    if (error) alert(error.message);
    else fetchData();
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 pb-12">
      {/* Navbar Minimalista */}
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 p-1.5 rounded-lg text-white">
            <ShieldCheck size={20} />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-gray-800">CellBlock <span className="text-gray-400 font-light">| Lab 10-401</span></h1>
        </div>
        <div className="text-sm font-medium text-gray-500 flex items-center gap-4">
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full ${isNextWeekOpen ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${isNextWeekOpen ? 'bg-green-500' : 'bg-amber-500'}`} />
            {isNextWeekOpen ? 'Próxima semana abierta' : 'Semana abierta el viernes 9:00'}
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Sidebar de Recursos */}
        <aside className="lg:col-span-3 space-y-2">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4 px-2">Equipos</h2>
          {hoods.map(h => (
            <button key={h.id} onClick={() => setSelectedHood(h)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all ${selectedHood?.id === h.id ? 'bg-blue-50 text-blue-700 shadow-sm' : 'hover:bg-gray-100 text-gray-600'}`}>
              <span className="truncate">{h.name}</span>
              {selectedHood?.id === h.id && <ChevronRight size={16} />}
            </button>
          ))}
        </aside>

        {/* Calendario Principal */}
        <main className="lg:col-span-9">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div className="flex bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
                <button onClick={() => setViewNextWeek(false)} className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${!viewNextWeek ? 'bg-gray-800 text-white shadow-md' : 'text-gray-500 hover:text-gray-700'}`}>Esta semana</button>
                <button onClick={() => setViewNextWeek(true)} className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${viewNextWeek ? 'bg-gray-800 text-white shadow-md' : 'text-gray-500 hover:text-gray-700'}`}>Siguiente semana</button>
              </div>
              <div className="flex items-center gap-2 text-gray-500">
                <CalendarIcon size={16} />
                <span className="text-sm font-medium">{format(currentWeekStart, 'MMMM yyyy')}</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-white">
                    <th className="p-4 text-xs font-medium text-gray-400 text-center border-b border-gray-100 w-20">HORA</th>
                    {['LUN','MAR','MIE','JUE','VIE'].map((d, i) => (
                      <th key={d} className="p-4 text-xs font-semibold text-gray-700 border-b border-gray-100 border-l border-gray-50">
                        {d} <span className="block text-[10px] text-gray-400 font-normal mt-0.5">{format(addDays(currentWeekStart, i), 'dd/MM')}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {HOURS.map(hour => (
                    <tr key={hour} className="group">
                      <td className="p-3 text-[11px] font-medium text-gray-400 text-center bg-gray-50/30 border-b border-gray-50">{hour}:00</td>
                      {[0,1,2,3,4].map(day => {
                        const slotDate = setHours(addDays(currentWeekStart, day), hour);
                        const booking = bookings.find(b => 
                          b.hood_id === selectedHood?.id && 
                          new Date(b.start_time).getTime() === slotDate.getTime()
                        );
                        return (
                          <td key={day} className="p-1 border-b border-gray-50 border-l border-gray-50 min-w-[120px] h-14 relative">
                            {booking ? (
                              <div className="h-full w-full bg-blue-50 border border-blue-100 rounded-lg p-2 flex flex-col justify-center transition-all hover:bg-blue-100">
                                <span className="text-[10px] font-bold text-blue-800 uppercase truncate leading-none">{booking.user_name}</span>
                                <div className="flex items-center gap-1 mt-1">
                                  <Clock size={10} className="text-blue-400" />
                                  <span className="text-[9px] text-blue-500 font-medium">{hour}:00 - {hour+1}:00</span>
                                </div>
                              </div>
                            ) : (
                              <button onClick={() => handleBooking(day, hour)} className="h-full w-full rounded-lg hover:bg-gray-50 flex items-center justify-center group/btn transition-all">
                                <Plus size={16} className="text-gray-200 group-hover/btn:text-blue-400 transition-colors" />
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