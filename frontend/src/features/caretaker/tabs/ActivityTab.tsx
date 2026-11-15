import React from 'react';
import type { ActivityItem } from '../../../types';

interface ActivityTabProps {
  activities: ActivityItem[];
}

export const ActivityTab: React.FC<ActivityTabProps> = ({ activities }) => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-slate-900">Activity Log</h2>
        <p className="text-slate-500 text-sm">
          Transparent chronological log of every dose taken, schedule edit, and suggestion.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y">
        {activities.map((a) => (
          <div key={a.id} className="p-4 flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-blue-500 mt-2" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-800">{a.summary}</p>
              <span className="text-xs text-slate-400">
                {new Date(a.createdAt).toLocaleString([], {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
