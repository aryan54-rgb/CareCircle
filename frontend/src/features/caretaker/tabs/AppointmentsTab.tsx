import React from 'react';
import { Plus } from 'lucide-react';
import type { Appointment } from '../../../types';

interface AppointmentsTabProps {
  appointments: Appointment[];
  isCaretaker: boolean;
  onOpenApptModal: () => void;
}

export const AppointmentsTab: React.FC<AppointmentsTabProps> = ({
  appointments,
  isCaretaker,
  onOpenApptModal,
}) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Doctor Appointments</h2>
          <p className="text-slate-500 text-sm">
            Upcoming consultations with automatic 24-hour and 2-hour reminders.
          </p>
        </div>
        {isCaretaker && (
          <button
            onClick={onOpenApptModal}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm px-4 py-2.5 rounded-xl shadow-sm transition"
          >
            <Plus size={18} /> Schedule Visit
          </button>
        )}
      </div>

      <div className="space-y-3">
        {appointments.map((a) => (
          <div
            key={a.id}
            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
          >
            <div>
              <h3 className="text-lg font-bold text-slate-900">{a.doctor}</h3>
              <p className="text-sm font-semibold text-slate-600">📍 {a.place}</p>
              <p className="text-xs text-slate-500 mt-1">
                🗓️{' '}
                {new Date(a.startsAt).toLocaleDateString([], {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
              {a.notes && <p className="text-xs text-amber-800 bg-amber-50 p-2 rounded mt-2">{a.notes}</p>}
            </div>
            <span className="text-xs font-bold px-3 py-1 bg-blue-50 text-blue-700 rounded-full self-start md:self-center">
              {a.stage}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
