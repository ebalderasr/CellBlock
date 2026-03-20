import React, { useState, useEffect } from 'react';
import {
  startOfWeek, addWeeks, addDays, setHours, setMinutes,
  isAfter, isSameDay, parseISO, addHours,
} from 'date-fns';
import { ShieldCheck, LogOut } from 'lucide-react';

import { LAB_CONFIG } from './config/lab.config';
import { useBookings } from './hooks/useBookings';
import LoginScreen from './components/LoginScreen';
import SupportBox from './components/SupportBox';
import BookingCalendar from './components/BookingCalendar';
import BookingModal from './components/BookingModal';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedHood, setSelectedHood] = useState(null);
  const [viewWeekOffset, setViewWeekOffset] = useState(0);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [tempNotes, setTempNotes] = useState('');

  const { hoods, bookings, createBooking, deleteBooking, updateBookingNotes } = useBookings();

  // Restore session on mount
  useEffect(() => {
    const session = localStorage.getItem('cellblock_user');
    if (session) setCurrentUser(JSON.parse(session));
  }, []);

  // Auto-select first hood when hoods load
  useEffect(() => {
    if (hoods.length > 0 && !selectedHood) setSelectedHood(hoods[0]);
  }, [hoods]);

  function handleLogin(user) {
    setCurrentUser(user);
    localStorage.setItem('cellblock_user', JSON.stringify(user));
  }

  function handleLogout() {
    localStorage.clear();
    window.location.reload();
  }

  // ── Booking rules ────────────────────────────────────────────────────────────

  function isWeekLocked(offset) {
    if (currentUser?.is_admin) return false;
    if (offset < LAB_CONFIG.booking.lockedFromWeek) return false;
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const releaseTime = setMinutes(
      setHours(addDays(weekStart, LAB_CONFIG.booking.unlockDay), LAB_CONFIG.booking.unlockHour),
      0
    );
    return !isAfter(now, releaseTime);
  }

  async function handleSlotClick(day, hour) {
    if (isWeekLocked(viewWeekOffset)) {
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      alert(`Schedule locked until ${dayNames[LAB_CONFIG.booking.unlockDay]} at ${LAB_CONFIG.booking.unlockHour}:00.`);
      return;
    }

    const weekStart = startOfWeek(addWeeks(new Date(), viewWeekOffset), { weekStartsOn: 1 });
    const targetDate = setHours(addDays(weekStart, day), hour);

    // Enforce consecutive hours limit
    const dayHours = bookings
      .filter(b =>
        b.user_id === currentUser.id &&
        b.hood_id === selectedHood.id &&
        isSameDay(parseISO(b.start_time), targetDate)
      )
      .map(b => parseISO(b.start_time).getHours());

    const allSorted = [...dayHours, hour].sort((a, b) => a - b);
    let max = 1, curr = 1;
    for (let i = 0; i < allSorted.length - 1; i++) {
      if (allSorted[i + 1] === allSorted[i] + 1) curr++;
      else curr = 1;
      max = Math.max(curr, max);
    }
    if (max > LAB_CONFIG.booking.maxConsecutiveHours) {
      alert(`Limit: max ${LAB_CONFIG.booking.maxConsecutiveHours} consecutive hours per hood per day.`);
      return;
    }

    try {
      await createBooking({
        hoodId: selectedHood.id,
        userId: currentUser.id,
        userCode: currentUser.user_code,
        startTime: targetDate.toISOString(),
        endTime: addHours(targetDate, 1).toISOString(),
      });
    } catch (err) {
      alert('Error creating booking: ' + err.message);
    }
  }

  async function handleSaveNotes() {
    try {
      await updateBookingNotes(selectedBooking.id, tempNotes);
      setSelectedBooking(null);
    } catch {
      alert('Error saving notes.');
    }
  }

  async function handleDeleteBooking() {
    if (!window.confirm('Delete this booking?')) return;
    try {
      await deleteBooking(selectedBooking.id);
      setSelectedBooking(null);
    } catch (err) {
      alert('Error deleting booking: ' + err.message);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  if (!currentUser) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 overflow-x-hidden">

      {/* Navigation */}
      <nav className="bg-white border-b border-slate-100 px-6 md:px-10 py-5 flex justify-between items-center sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2.5 rounded-2xl text-white shadow-lg shadow-blue-100">
            <ShieldCheck size={22} />
          </div>
          <div className="leading-tight">
            <h1 className="text-xl font-black tracking-tighter italic">
              {LAB_CONFIG.appName}{' '}
              <span className="text-slate-300 font-normal">| {LAB_CONFIG.suite}</span>
            </h1>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
              {LAB_CONFIG.labName} · {LAB_CONFIG.institution}
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="p-2 text-red-400 hover:text-red-600"
          title="Log out"
        >
          <LogOut size={20} />
        </button>
      </nav>

      {/* Main layout */}
      <div className="max-w-[1600px] mx-auto px-6 md:px-10 mt-8 grid grid-cols-12 gap-8 pb-20">

        {/* Sidebar — hood selector + support */}
        <aside className="col-span-12 lg:col-span-2 space-y-6 flex flex-col">
          <div className="flex lg:flex-col gap-2 overflow-x-auto pb-4 lg:pb-0 scrollbar-hide">
            {hoods.map(h => (
              <button
                key={h.id}
                onClick={() => setSelectedHood(h)}
                className={`whitespace-nowrap px-6 py-3.5 rounded-2xl text-xs font-bold transition-all ${
                  selectedHood?.id === h.id
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'bg-slate-50 text-slate-400'
                }`}
              >
                {h.name}
              </button>
            ))}
          </div>
          <div className="hidden lg:block mt-auto">
            <SupportBox />
          </div>
        </aside>

        {/* Calendar */}
        <main className="col-span-12 lg:col-span-10 space-y-6">
          <BookingCalendar
            bookings={bookings}
            selectedHood={selectedHood}
            currentUser={currentUser}
            viewWeekOffset={viewWeekOffset}
            onWeekChange={setViewWeekOffset}
            onSlotClick={handleSlotClick}
            onBookingClick={b => { setSelectedBooking(b); setTempNotes(b.notes || ''); }}
            isWeekLocked={isWeekLocked}
          />
          <div className="lg:hidden">
            <SupportBox />
          </div>
        </main>
      </div>

      {/* Booking detail modal */}
      <BookingModal
        booking={selectedBooking}
        currentUser={currentUser}
        tempNotes={tempNotes}
        onNotesChange={setTempNotes}
        onSave={handleSaveNotes}
        onDelete={handleDeleteBooking}
        onClose={() => setSelectedBooking(null)}
      />
    </div>
  );
}
