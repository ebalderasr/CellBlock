import React from 'react';
import { X, Save, Trash2 } from 'lucide-react';

export default function BookingModal({ booking, currentUser, tempNotes, onNotesChange, onSave, onDelete, onClose }) {
  if (!booking) return null;

  const isOwner = booking.user_id === currentUser.id;
  const canDelete = currentUser.is_admin || isOwner;

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-50 flex items-center justify-center p-6">
      <div className="bg-white p-10 rounded-[3rem] w-full max-w-sm shadow-2xl relative">
        <button onClick={onClose} className="absolute top-8 right-8 text-slate-300">
          <X />
        </button>
        <h3 className="text-2xl font-black mb-8">Booking</h3>
        <div className="space-y-6">
          <div>
            <p className="text-[10px] font-black text-slate-300 uppercase mb-3">Experiment Notes</p>
            <textarea
              disabled={!isOwner}
              value={tempNotes}
              onChange={e => onNotesChange(e.target.value)}
              className="w-full p-5 bg-slate-50 rounded-2xl text-sm border-none focus:ring-2 focus:ring-blue-500 min-h-[150px] outline-none"
              placeholder={isOwner ? 'Write your observations here…' : 'No notes.'}
            />
          </div>
          <div className="flex gap-2">
            {isOwner && (
              <button
                onClick={onSave}
                className="flex-1 bg-blue-600 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-blue-100"
              >
                <Save size={18} /> Save
              </button>
            )}
            {canDelete && (
              <button
                onClick={onDelete}
                className="bg-red-50 text-red-600 font-bold px-6 py-4 rounded-2xl"
              >
                <Trash2 size={20} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
