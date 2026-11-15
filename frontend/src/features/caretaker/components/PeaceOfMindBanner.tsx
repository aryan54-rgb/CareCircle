import React from 'react';
import { AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';
import type { DoseItem, AdherenceReport } from '../../../types';

interface PeaceOfMindBannerProps {
  doses: DoseItem[];
  adherence: AdherenceReport | null;
}

export const PeaceOfMindBanner: React.FC<PeaceOfMindBannerProps> = ({ doses, adherence }) => {
  const pendingDoses = doses.filter((d) =>
    ['REMINDED', 'ESCALATED_1', 'ESCALATED_2'].includes(d.status)
  );
  const missedDoses = doses.filter((d) => d.status === 'MISSED');
  const careScore =
    adherence?.overallRate !== undefined ? Math.round(adherence.overallRate * 100) : 100;

  let peaceBanner = {
    status: 'good',
    text: 'All doses on track today',
    sub: 'No missed medications or pending escalations.',
  };

  if (missedDoses.length > 0) {
    peaceBanner = {
      status: 'danger',
      text: `${missedDoses.length} dose${missedDoses.length > 1 ? 's' : ''} MISSED today (${missedDoses.map((d) => d.medName).join(', ')})`,
      sub: 'Escalation complete. Immediate caretaker attention required.',
    };
  } else if (pendingDoses.length > 0) {
    const earliest = pendingDoses[0];
    const scheduledTime = new Date(earliest.dueAt).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    peaceBanner = {
      status: 'warning',
      text: `${pendingDoses.length} dose pending since ${scheduledTime} (${earliest.medName})`,
      sub: `Current stage: ${earliest.status.replace('_', ' ')}. Escalation in progress.`,
    };
  }

  return (
    <div
      className={`p-4 rounded-2xl border mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs transition ${
        peaceBanner.status === 'danger'
          ? 'bg-red-50 border-red-200 text-red-950'
          : peaceBanner.status === 'warning'
          ? 'bg-amber-50 border-amber-200 text-amber-950'
          : 'bg-emerald-50 border-emerald-200 text-emerald-950'
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            peaceBanner.status === 'danger'
              ? 'bg-red-600 text-white'
              : peaceBanner.status === 'warning'
              ? 'bg-amber-500 text-white'
              : 'bg-emerald-600 text-white'
          }`}
        >
          {peaceBanner.status === 'danger' ? (
            <AlertTriangle size={20} />
          ) : peaceBanner.status === 'warning' ? (
            <Clock size={20} />
          ) : (
            <CheckCircle2 size={20} />
          )}
        </div>
        <div>
          <div className="text-base font-extrabold tracking-tight">{peaceBanner.text}</div>
          <div className="text-xs opacity-80 font-medium">{peaceBanner.sub}</div>
        </div>
      </div>
      <div className="flex items-center gap-2 self-start sm:self-auto bg-white/90 px-3.5 py-1.5 rounded-xl border border-black/5 shadow-2xs">
        <span className="text-xs text-slate-500 font-semibold">Weekly Care Score:</span>
        <span className="text-sm font-black text-blue-600">{careScore}%</span>
      </div>
    </div>
  );
};
