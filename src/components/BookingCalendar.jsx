import React from 'react';
import { format, startOfWeek, addWeeks, addDays, setHours } from 'date-fns';
import { Plus } from 'lucide-react';
import { LAB_CONFIG } from '../config/lab.config';

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function BookingCalendar({
  bookings,
  selectedHood,
  currentUser,
  viewWeekOffset,
  onWeekChange,
  onSlotClick,
  onBookingClick,
  isWeekLocked,
}) {
  const weekStart = startOfWeek(addWeeks(new Date(), viewWeekOffset), { weekStartsOn: 1 });

  return (
    <div className="space-y-6">
      {/* Week selector */}
      <div className="flex overflow-x-auto gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-100 scrollbar-hide">
        {Array.from({ length: LAB_CONFIG.booking.weeksAhead }, (_, offset) => (
          <button
            key={offset}
            onClick={() => onWeekChange(offset)}
            className={`flex-1 min-w-[100px] py-3 text-[10px] font-black rounded-xl transition-all ${
              viewWeekOffset === offset ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-300'
            }`}
          >
            WEEK {offset + 1} {isWeekLocked(offset) && '🔒'}
          </button>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="bg-white rounded-[3rem] border border-slate-100 shadow-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse table-fixed min-w-[800px]">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="w-20 p-5 text-[10px] font-black text-slate-300 uppercase sticky left-0 bg-slate-50/80 backdrop-blur-md z-20">
                  Time
                </th>
                {DAYS.map((d, i) => (
                  <th key={d} className="p-5 text-[11px] font-black border-l border-slate-100 uppercase text-slate-700">
                    {d}
                    <span className="block text-[9px] text-slate-300 font-normal mt-1">
                      {format(addDays(weekStart, i), 'dd/MM')}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {HOURS.map(hour => (
                <tr key={hour}>
                  <td className="p-4 text-[10px] font-black text-slate-200 text-center sticky left-0 bg-white/90 backdrop-blur-md z-20 border-r border-slate-50">
                    {hour}:00
                  </td>
                  {[0, 1, 2, 3, 4, 5, 6].map(day => {
                    const slotDate = setHours(addDays(weekStart, day), hour);
                    const booking = bookings.find(
                      b =>
                        b.hood_id === selectedHood?.id &&
                        new Date(b.start_time).getTime() === slotDate.getTime()
                    );
                    const isMine = booking?.user_id === currentUser.id;
                    return (
                      <td key={day} className="border-l border-slate-50 h-16 p-1.5 relative">
                        {booking ? (
                          <button
                            onClick={() => onBookingClick(booking)}
                            className={`h-full w-full rounded-2xl p-3 flex flex-col justify-center transition-all border text-left ${
                              isMine
                                ? 'bg-blue-600 border-blue-400 text-white shadow-lg'
                                : 'bg-slate-50 border-slate-100 text-slate-700'
                            }`}
                          >
                            <span className="text-[10px] font-black uppercase tracking-tighter truncate">
                              {booking.user_name}
                            </span>
                          </button>
                        ) : (
                          <button
                            disabled={isWeekLocked(viewWeekOffset)}
                            onClick={() => onSlotClick(day, hour)}
                            className="w-full h-full rounded-2xl border-2 border-dashed border-slate-100 hover:border-blue-200 transition-all flex items-center justify-center opacity-40 hover:opacity-100"
                          >
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
    </div>
  );
}
