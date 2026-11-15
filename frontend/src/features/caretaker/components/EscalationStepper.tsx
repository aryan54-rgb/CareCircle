import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import type { DoseItem } from '../../../types';

interface EscalationStepperProps {
  doses: DoseItem[];
}

export const EscalationStepper: React.FC<EscalationStepperProps> = ({ doses }) => {
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const activeDose =
    doses.find((d) =>
      ['REMINDED', 'ESCALATED_1', 'ESCALATED_2', 'MISSED'].includes(d.status)
    ) || doses.find((d) => d.status === 'SCHEDULED');

  if (!activeDose) return null;

  const stageLevel =
    activeDose.status === 'REMINDED'
      ? 1
      : activeDose.status === 'ESCALATED_1'
      ? 2
      : activeDose.status === 'ESCALATED_2'
      ? 3
      : activeDose.status === 'MISSED'
      ? 4
      : 0;

  const secondsUntilNext = activeDose.nextActionAt
    ? Math.max(0, Math.round((new Date(activeDose.nextActionAt).getTime() - nowMs) / 1000))
    : 0;

  return (
    <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <span className="text-[11px] font-black uppercase text-blue-600 tracking-wider">
            ⚡ Live Escalation Timeline (Polling 10s)
          </span>
          <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2 mt-0.5">
            <span>{activeDose.medName}</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
              Due:{' '}
              {new Date(activeDose.dueAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </h3>
        </div>

        <div className="flex items-center gap-2">
          {activeDose.status !== 'MISSED' && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 animate-pulse">
              <Clock size={12} />
              <span>
                {secondsUntilNext > 0
                  ? `Next escalation in ~${secondsUntilNext}s`
                  : 'Action due now (awaiting ticker)'}
              </span>
            </div>
          )}
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
            Status: {activeDose.status}
          </span>
        </div>
      </div>

      {/* 4-Step Visual Stepper */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
        {[
          {
            step: 1,
            label: 'Elder Reminded',
            sub: 'Grandmother Shanti',
            activeBg: 'bg-blue-600 text-white',
            doneBg: 'bg-emerald-500 text-white',
          },
          {
            step: 2,
            label: 'Caretaker Alert',
            sub: 'Son Rajesh / Anita',
            activeBg: 'bg-amber-500 text-white',
            doneBg: 'bg-emerald-500 text-white',
          },
          {
            step: 3,
            label: 'Family Alert',
            sub: 'Daughter Priya',
            activeBg: 'bg-orange-500 text-white',
            doneBg: 'bg-emerald-500 text-white',
          },
          {
            step: 4,
            label: 'Marked Missed',
            sub: 'Adherence counted',
            activeBg: 'bg-red-600 text-white',
            doneBg: 'bg-red-600 text-white',
          },
        ].map((s) => {
          const isCurrent = stageLevel === s.step;
          const isPassed = stageLevel > s.step;
          return (
            <div
              key={s.step}
              className={`p-3 rounded-2xl border text-center transition ${
                isCurrent
                  ? `${s.activeBg} border-transparent shadow-md scale-102 font-bold animate-pulse`
                  : isPassed
                  ? `${s.doneBg} border-transparent`
                  : 'bg-slate-50 border-slate-200 text-slate-400'
              }`}
            >
              <div className="text-[10px] uppercase font-black tracking-wider opacity-80">
                Stage {s.step}
              </div>
              <div className="text-xs font-bold mt-0.5 leading-tight">{s.label}</div>
              <div className="text-[10px] opacity-75 mt-0.5 hidden sm:block">{s.sub}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
