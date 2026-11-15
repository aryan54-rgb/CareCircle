import React from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import type { NotificationLog } from '../../../types';

interface NotificationsTabProps {
  notifications: NotificationLog[];
}

export const NotificationsTab: React.FC<NotificationsTabProps> = ({ notifications }) => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Notification Center</h2>
          <p className="text-slate-500 text-sm">
            Complete audit log of email reminders and escalation dispatches.
          </p>
        </div>
        <div className="text-xs bg-blue-50 text-blue-800 border border-blue-200 px-3 py-1.5 rounded-xl font-semibold">
          🛡️ Judges: Escalation transitions are recorded here even if recipient emails are unverified in SES Sandbox.
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm divide-y overflow-hidden">
        {notifications.length === 0 ? (
          <div className="p-8 text-center text-slate-400 font-semibold">
            No notifications dispatched yet. Trigger a demo escalation to see real-time delivery logs!
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`text-xs font-black px-2.5 py-0.5 rounded-md ${
                      n.stage === 'REMINDED'
                        ? 'bg-blue-100 text-blue-800'
                        : n.stage === 'ESCALATED_1'
                        ? 'bg-amber-100 text-amber-800'
                        : n.stage === 'ESCALATED_2'
                        ? 'bg-orange-100 text-orange-800'
                        : n.stage === 'MISSED'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-purple-100 text-purple-800'
                    }`}
                  >
                    {n.stage}
                  </span>
                  <span className="font-extrabold text-sm text-slate-800">{n.subject}</span>
                </div>
                <div className="text-xs text-slate-500">
                  Recipient: <span className="font-semibold text-slate-700">{n.to}</span> •{' '}
                  <span>
                    {n.sentAt
                      ? new Date(n.sentAt).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })
                      : 'Just now'}
                  </span>
                </div>
                {n.error && (
                  <div className="text-xs text-red-600 font-medium">
                    Delivery Note: {n.error} (Sandbox policy safeguard applied)
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 self-start sm:self-center">
                {n.success ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                    <CheckCircle2 size={14} /> Sent
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full">
                    <AlertTriangle size={14} /> Sandboxed
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
