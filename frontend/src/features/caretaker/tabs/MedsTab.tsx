import React from 'react';
import { Camera, Plus, AlertTriangle } from 'lucide-react';
import type { Medication } from '../../../types';

interface MedsTabProps {
  meds: Medication[];
  isCaretaker: boolean;
  onOpenScanModal: () => void;
  onOpenAddMedModal: () => void;
}

export const MedsTab: React.FC<MedsTabProps> = ({
  meds,
  isCaretaker,
  onOpenScanModal,
  onOpenAddMedModal,
}) => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Medications</h2>
          <p className="text-slate-500 text-sm">Active prescriptions, pill inventory, and schedules.</p>
        </div>
        {isCaretaker && (
          <div className="flex gap-2">
            <button
              onClick={onOpenScanModal}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm px-4 py-2.5 rounded-xl shadow-sm transition"
            >
              <Camera size={18} />
              <span>Scan Prescription (AI)</span>
            </button>
            <button
              onClick={onOpenAddMedModal}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm px-4 py-2.5 rounded-xl shadow-sm transition"
            >
              <Plus size={18} />
              <span>Add Medicine</span>
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {meds.map((m) => (
          <div key={m.medId} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-xl font-black text-slate-900">
                {m.name} <span className="text-sm font-semibold text-slate-500">({m.strength})</span>
              </h3>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                {m.form}
              </span>
            </div>
            <p className="text-sm text-slate-600 mb-4">{m.instructions || 'Follow prescription instructions.'}</p>
            <div className="text-xs text-slate-500 space-y-1 mb-4">
              <div>
                <strong>Times:</strong> {m.times.join(', ')}
              </div>
              <div>
                <strong>Inventory:</strong>{' '}
                <span
                  className={
                    m.pillCount <= (m.refillThreshold || 5)
                      ? 'text-red-600 font-extrabold'
                      : 'text-slate-700'
                  }
                >
                  {m.pillCount ?? 'N/A'} pills left
                </span>
              </div>
            </div>
            {m.pillCount <= (m.refillThreshold || 5) && (
              <div className="p-2 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs font-bold flex items-center gap-1.5">
                <AlertTriangle size={14} />
                <span>Refill required soon!</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
