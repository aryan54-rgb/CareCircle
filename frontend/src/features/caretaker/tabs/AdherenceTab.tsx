import React, { Suspense } from 'react';
import type { AdherenceReport } from '../../../types';

const AdherenceChart = React.lazy(() => import('../components/AdherenceChart'));

interface AdherenceTabProps {
  adherence: AdherenceReport | null;
}

export const AdherenceTab: React.FC<AdherenceTabProps> = ({ adherence }) => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-slate-900">Adherence Analytics</h2>
        <p className="text-slate-500 text-sm">
          Real-time stats calculated deterministically from taken and missed doses.
        </p>
      </div>

      {/* Metrics cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-xs font-bold text-slate-500 uppercase">Overall Rate</div>
          <div className="text-3xl font-black text-blue-600 mt-1">{adherence?.overallRate ?? 100}%</div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-xs font-bold text-slate-500 uppercase">Doses Taken</div>
          <div className="text-3xl font-black text-emerald-600 mt-1">{adherence?.takenCount ?? 0}</div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-xs font-bold text-slate-500 uppercase">Doses Skipped</div>
          <div className="text-3xl font-black text-slate-600 mt-1">{adherence?.skippedCount ?? 0}</div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-xs font-bold text-slate-500 uppercase">Doses Missed</div>
          <div className="text-3xl font-black text-red-600 mt-1">{adherence?.missedCount ?? 0}</div>
        </div>
      </div>

      {/* Lazy-loaded Recharts 7-Day Adherence Chart */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900 mb-4">Daily Adherence Rate (Past 7 Days)</h3>
        <Suspense
          fallback={
            <div className="h-64 flex items-center justify-center text-slate-400 text-sm">
              Loading analytics chart...
            </div>
          }
        >
          <AdherenceChart data={adherence?.days || []} />
        </Suspense>
      </div>

      {/* Per-Medication breakdown */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900 mb-4">Per-Medication Compliance</h3>
        <div className="space-y-3">
          {adherence?.medicationStats?.map((m) => (
            <div key={m.medId} className="flex items-center justify-between border-b pb-3">
              <div>
                <div className="font-bold text-slate-900">{m.name}</div>
                <div className="text-xs text-slate-500">
                  Taken: {m.takenCount} • Skipped: {m.skippedCount} • Missed: {m.missedCount}
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-extrabold text-blue-600">{m.rate}%</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
