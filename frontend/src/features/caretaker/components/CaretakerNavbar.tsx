import React from 'react';
import {
  Calendar,
  Clock,
  Pill,
  BarChart2,
  FileText,
  Settings,
  Send,
  LogOut,
  Zap,
  Bell,
  RotateCcw,
} from 'lucide-react';
import type { CircleDetail, UserProfile } from '../../../types';

export type TabKey =
  | 'today'
  | 'meds'
  | 'appointments'
  | 'adherence'
  | 'suggestions'
  | 'activity'
  | 'notifications'
  | 'settings';

interface CaretakerNavbarProps {
  user: UserProfile | null;
  circle: CircleDetail | null;
  activeTab: TabKey;
  notificationsCount: number;
  onSelectTab: (tab: TabKey) => void;
  onTriggerDemo: () => void;
  onResetDemo: () => void;
  onLogout: () => void;
}

export const CaretakerNavbar: React.FC<CaretakerNavbarProps> = ({
  user,
  circle,
  activeTab,
  notificationsCount,
  onSelectTab,
  onTriggerDemo,
  onResetDemo,
  onLogout,
}) => {
  const isCaretaker = user?.role === 'CARETAKER';

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-extrabold text-xl">
            C
          </div>
          <div>
            <div className="font-extrabold text-lg leading-tight text-slate-900">
              {circle?.name || 'CareCircle'}
            </div>
            <div className="text-xs text-slate-500 font-semibold">
              Caring for {circle?.elderName || 'Elder'} • Role:{' '}
              <span className="text-blue-600 font-bold">{user?.role}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isCaretaker && (
            <>
              <button
                onClick={onTriggerDemo}
                className="hidden sm:flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-3 py-2 rounded-lg shadow-sm active:scale-95 transition"
                title="Trigger a missed dose to demonstrate real-time email escalation"
              >
                <Zap size={14} />
                <span>Demo Escalation</span>
              </button>
              <button
                onClick={onResetDemo}
                className="hidden sm:flex items-center gap-1.5 bg-slate-600 hover:bg-slate-700 text-white text-xs font-bold px-3 py-2 rounded-lg shadow-sm active:scale-95 transition"
                title="Reset demo circle back to initial seed state"
              >
                <RotateCcw size={14} />
                <span>Reset Demo</span>
              </button>
            </>
          )}
          <button
            onClick={onLogout}
            className="text-slate-500 hover:text-red-600 p-2 rounded-lg hover:bg-slate-100 transition"
            title="Log Out"
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="max-w-6xl mx-auto px-4 flex gap-1 overflow-x-auto text-sm font-semibold border-t border-slate-100">
        {[
          { id: 'today' as TabKey, label: 'Today', icon: Clock },
          { id: 'meds' as TabKey, label: 'Medications', icon: Pill },
          { id: 'appointments' as TabKey, label: 'Appointments', icon: Calendar },
          { id: 'adherence' as TabKey, label: 'Adherence', icon: BarChart2 },
          { id: 'suggestions' as TabKey, label: 'Suggestions', icon: Send },
          { id: 'activity' as TabKey, label: 'Activity Log', icon: FileText },
          ...(isCaretaker
            ? [
                {
                  id: 'notifications' as TabKey,
                  label: 'Notifications',
                  icon: Bell,
                  count: notificationsCount,
                },
              ]
            : []),
          { id: 'settings' as TabKey, label: 'Settings', icon: Settings },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`flex items-center gap-2 py-3 px-3.5 border-b-2 whitespace-nowrap transition ${
                isActive
                  ? 'border-blue-600 text-blue-600 font-bold'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className="text-[10px] bg-blue-100 text-blue-700 font-bold px-1.5 py-0.5 rounded-full">
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </header>
  );
};
