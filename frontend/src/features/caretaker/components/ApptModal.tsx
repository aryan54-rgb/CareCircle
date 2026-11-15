import React from 'react';

export interface ApptFormData {
  doctor: string;
  place: string;
  notes: string;
  startsAt: string;
}

interface ApptModalProps {
  newAppt: ApptFormData;
  setNewAppt: React.Dispatch<React.SetStateAction<ApptFormData>>;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}

export const ApptModal: React.FC<ApptModalProps> = ({
  newAppt,
  setNewAppt,
  onSubmit,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl">
        <h3 className="text-2xl font-black text-slate-900 mb-4">Schedule Appointment</h3>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Doctor Name / Specialty</label>
            <input
              type="text"
              required
              value={newAppt.doctor}
              onChange={(e) => setNewAppt({ ...newAppt, doctor: e.target.value })}
              placeholder="e.g. Dr. Ramesh Sharma (Cardiologist)"
              className="w-full border p-2.5 rounded-xl text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Clinic / Hospital Location</label>
            <input
              type="text"
              required
              value={newAppt.place}
              onChange={(e) => setNewAppt({ ...newAppt, place: e.target.value })}
              placeholder="e.g. Apollo Heart Clinic, Room 302"
              className="w-full border p-2.5 rounded-xl text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Date & Time</label>
            <input
              type="datetime-local"
              required
              value={newAppt.startsAt}
              onChange={(e) => setNewAppt({ ...newAppt, startsAt: e.target.value })}
              className="w-full border p-2.5 rounded-xl text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Notes / Instructions</label>
            <input
              type="text"
              value={newAppt.notes}
              onChange={(e) => setNewAppt({ ...newAppt, notes: e.target.value })}
              placeholder="e.g. Fasting blood sugar test before visit"
              className="w-full border p-2.5 rounded-xl text-sm"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow"
            >
              Schedule Visit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
