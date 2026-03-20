import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export function useBookings() {
  const [hoods, setHoods] = useState([]);
  const [bookings, setBookings] = useState([]);

  const fetchData = useCallback(async () => {
    const { data: h } = await supabase.from('hoods').select('*').order('name');
    setHoods(h || []);
    const { data: b } = await supabase.from('bookings').select('*');
    setBookings(b || []);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function createBooking({ hoodId, userId, userCode, startTime, endTime }) {
    const { error } = await supabase.from('bookings').insert([{
      hood_id: hoodId,
      user_id: userId,
      user_name: userCode,
      start_time: startTime,
      end_time: endTime,
    }]);
    if (error) throw error;
    await fetchData();
  }

  async function deleteBooking(bookingId) {
    const { error } = await supabase.from('bookings').delete().eq('id', bookingId);
    if (error) throw error;
    await fetchData();
  }

  async function updateBookingNotes(bookingId, notes) {
    const { error } = await supabase.from('bookings').update({ notes }).eq('id', bookingId);
    if (error) throw error;
    await fetchData();
  }

  return { hoods, bookings, fetchData, createBooking, deleteBooking, updateBookingNotes };
}
