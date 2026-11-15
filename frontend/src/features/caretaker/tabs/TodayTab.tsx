import React from 'react';
import { RefreshCw } from 'lucide-react';
import { EscalationStepper } from '../components/EscalationStepper';
import type { TodayDosesResponse } from '../../../types';

interface TodayTabProps {
  todayData: TodayDosesResponse | null;
  isCaretaker: boolean;
  onRefresh: () => void;
  onMarkDose: (id: string, action: 'take' | 'skip') => void;
}

export const TodayTab: React.FC<TodayTabProps> = ({
  todayData,
  isCaretaker,
  onRefresh,
  onMarkDose,
}) => {
  const doses = todayData?.doses || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Today's Medication Schedule</h2>
          <p className="text-slate-500 text-sm">
            Track and verify morning, afternoon, and evening doses.
          </p>
        </div>
        <button
          onClick={onRefresh}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-white border px-3 py-2 rounded-lg hover:bg-slate-50 shadow-sm"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Live Escalation State Machine Stepper */}
      <EscalationStepper doses={doses} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {doses.length > 0 ? (
          doses.map((dose) => {
            const isTaken = dose.status === 'TAKEN';
            const isSkipped = dose.status === 'SKIPPED';
            return (
              <div
                key={dose.id}
                className={`bg-white p-5 rounded-2xl border shadow-sm flex flex-col justify-between ${
                  isTaken
                    ? 'border-emerald-200 bg-emerald-50/20'
                    : isSkipped
                    ? 'border-slate-200 opacity-60'
                    : 'border-slate-200'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-extrabold uppercase px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                      {new Date(dose.dueAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <span
                      className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                        isTaken
                          ? 'bg-emerald-100 text-emerald-800'
                          : isSkipped
                          ? 'bg-slate-200 text-slate-700'
                          : dose.status.startsWith('ESCALATED')
                          ? 'bg-amber-100 text-amber-800 animate-pulse'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {dose.status}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">{dose.medName}</h3>
                  {dose.takenByName && (
                    <p className="text-xs text-slate-500 mt-1 font-medium">
                      Confirmed by: {dose.takenByName}
                    </p>
                  )}
                </div>

                {/* Caretaker Action Controls */}
                {isCaretaker && !isTaken && !isSkipped && (
                  <div className="mt-4 pt-3 border-t flex gap-2">
                    <button
                      onClick={() => onMarkDose(dose.id, 'take')}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 rounded-lg"
                    >
                      Mark on Behalf
                    </button>
                    <button
                      onClick={() => onMarkDose(dose.id, 'skip')}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold py-2 px-3 rounded-lg"
                    >
                      Skip
                    </button>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="col-span-full bg-white p-12 text-center text-slate-500 border rounded-2xl">
            No doses scheduled for today.
          </div>
        )}
      </div>
    </div>
  );
};
