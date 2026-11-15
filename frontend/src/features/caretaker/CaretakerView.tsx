import React, { useState } from 'react';
import { useAuth } from '../../context/useAuth';
import { apiRequest } from '../../api/client';
import { useCircleData } from './hooks/useCircleData';
import { useCaretakerModals } from './hooks/useCaretakerModals';
import { CaretakerNavbar, type TabKey } from './components/CaretakerNavbar';
import { PeaceOfMindBanner } from './components/PeaceOfMindBanner';
import { AddMedModal } from './components/AddMedModal';
import { ScanModal } from './components/ScanModal';
import { ApptModal } from './components/ApptModal';
import { SuggestModal } from './components/SuggestModal';
import { TodayTab } from './tabs/TodayTab';
import { MedsTab } from './tabs/MedsTab';
import { AppointmentsTab } from './tabs/AppointmentsTab';
import { AdherenceTab } from './tabs/AdherenceTab';
import { SuggestionsTab } from './tabs/SuggestionsTab';
import { ActivityTab } from './tabs/ActivityTab';
import { NotificationsTab } from './tabs/NotificationsTab';
import { SettingsTab } from './tabs/SettingsTab';
import type { DeepHealthCheck } from '../../types';

export const CaretakerView: React.FC = () => {
  const { user, logout } = useAuth();
  const isCaretaker = user?.role === 'CARETAKER';
  const [activeTab, setActiveTab] = useState<TabKey>('today');

  const {
    todayData,
    meds,
    appointments,
    adherence,
    suggestions,
    activities,
    notifications,
    circle,
    refresh: loadAll,
  } = useCircleData(isCaretaker, 10000);

  const [deepHealth, setDeepHealth] = useState<DeepHealthCheck | null>(null);
  const [healthLoading, setHealthLoading] = useState<boolean>(false);
  const [demoTriggerMsg, setDemoTriggerMsg] = useState<string>('');
  const [demoResetMsg, setDemoResetMsg] = useState<string>('');

  const modals = useCaretakerModals(loadAll);

  const fetchDeepHealth = async () => {
    setHealthLoading(true);
    try {
      const res = await apiRequest<DeepHealthCheck>('/health/deep');
      setDeepHealth(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setDeepHealth({ status: 'error', error: msg, timestamp: new Date().toISOString() });
    } finally {
      setHealthLoading(false);
    }
  };

  const handleResetDemo = async () => {
    if (!confirm('Reset Kalyan Family Circle back to original seed state?')) return;
    try {
      await apiRequest('/demo/reset', { method: 'POST' });
      setDemoResetMsg('✓ Demo Circle reset to initial state!');
      await loadAll();
      setTimeout(() => setDemoResetMsg(''), 6000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg || 'Failed to reset demo');
    }
  };

  const handleMarkDose = async (id: string, action: 'take' | 'skip') => {
    try {
      await apiRequest(`/doses/${encodeURIComponent(id)}/${action}`, { method: 'POST' });
      await loadAll();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg || 'Failed to update dose');
    }
  };

  const handleApproveSuggestion = async (id: string) => {
    try {
      await apiRequest(`/suggestions/${id}/approve`, { method: 'POST' });
      await loadAll();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg || 'Failed to approve suggestion');
    }
  };

  const handleDeclineSuggestion = async (id: string) => {
    try {
      await apiRequest(`/suggestions/${id}/decline`, { method: 'POST' });
      await loadAll();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg || 'Failed to decline suggestion');
    }
  };

  const handleTriggerMissedDemo = async () => {
    try {
      const res = await apiRequest<{ medName: string }>('/demo/trigger-missed', { method: 'POST' });
      setDemoTriggerMsg(
        `✓ Demo Missed Triggered for ${res.medName}! Escalation ticker will now advance every 1 minute.`
      );
      await loadAll();
      setTimeout(() => setDemoTriggerMsg(''), 8000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg || 'Could not trigger demo');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      <CaretakerNavbar
        user={user}
        circle={circle}
        activeTab={activeTab}
        notificationsCount={notifications.length}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          if (tab === 'settings' && !deepHealth) {
            void fetchDeepHealth();
          }
        }}
        onTriggerDemo={handleTriggerMissedDemo}
        onResetDemo={handleResetDemo}
        onLogout={logout}
      />

      {demoTriggerMsg && (
        <div className="max-w-6xl mx-auto px-4 mt-4">
          <div className="p-4 bg-amber-100 border border-amber-300 text-amber-900 rounded-xl font-bold flex items-center justify-between">
            <span>{demoTriggerMsg}</span>
            <button onClick={() => setDemoTriggerMsg('')} className="p-1">
              ✕
            </button>
          </div>
        </div>
      )}
      {demoResetMsg && (
        <div className="max-w-6xl mx-auto px-4 mt-4">
          <div className="p-4 bg-emerald-100 border border-emerald-300 text-emerald-900 rounded-xl font-bold flex items-center justify-between">
            <span>{demoResetMsg}</span>
            <button onClick={() => setDemoResetMsg('')} className="p-1">
              ✕
            </button>
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 py-6">
        <PeaceOfMindBanner doses={todayData?.doses || []} adherence={adherence} />

        {activeTab === 'today' && (
          <TodayTab
            todayData={todayData}
            isCaretaker={isCaretaker}
            onRefresh={loadAll}
            onMarkDose={handleMarkDose}
          />
        )}
        {activeTab === 'meds' && (
          <MedsTab
            meds={meds}
            isCaretaker={isCaretaker}
            onOpenScanModal={() => modals.setShowScanModal(true)}
            onOpenAddMedModal={() => modals.setShowAddMedModal(true)}
          />
        )}
        {activeTab === 'appointments' && (
          <AppointmentsTab
            appointments={appointments}
            isCaretaker={isCaretaker}
            onOpenApptModal={() => modals.setShowApptModal(true)}
          />
        )}
        {activeTab === 'adherence' && <AdherenceTab adherence={adherence} />}
        {activeTab === 'suggestions' && (
          <SuggestionsTab
            suggestions={suggestions}
            isCaretaker={isCaretaker}
            onOpenSuggestModal={() => modals.setShowSuggestModal(true)}
            onApproveSuggestion={handleApproveSuggestion}
            onDeclineSuggestion={handleDeclineSuggestion}
          />
        )}
        {activeTab === 'activity' && <ActivityTab activities={activities} />}
        {activeTab === 'notifications' && (
          <NotificationsTab notifications={notifications} />
        )}
        {activeTab === 'settings' && (
          <SettingsTab
            circle={circle}
            isCaretaker={isCaretaker}
            deepHealth={deepHealth}
            healthLoading={healthLoading}
            inviteCodeResult={modals.inviteCodeResult}
            onFetchDeepHealth={fetchDeepHealth}
            onResetDemo={handleResetDemo}
            onGenerateInvite={modals.handleGenerateInvite}
          />
        )}
      </main>

      {modals.showAddMedModal && (
        <AddMedModal
          newMed={modals.newMed}
          setNewMed={modals.setNewMed}
          scanResult={modals.scanResult}
          confirmedConfidence={modals.confirmedConfidence}
          setConfirmedConfidence={modals.setConfirmedConfidence}
          onSubmit={modals.handleCreateMed}
          onClose={() => {
            modals.setShowAddMedModal(false);
            modals.setScanResult(null);
            modals.setConfirmedConfidence(false);
          }}
        />
      )}

      {modals.showScanModal && (
        <ScanModal
          scanLoading={modals.scanLoading}
          scanError={modals.scanError}
          scanResult={modals.scanResult}
          onFileUpload={modals.handleFileUpload}
          onSwitchToManual={() => {
            modals.setShowScanModal(false);
            modals.setShowAddMedModal(true);
          }}
          onConfirmDraft={() => {
            modals.setShowScanModal(false);
            modals.setShowAddMedModal(true);
          }}
          onClose={() => {
            modals.setShowScanModal(false);
            modals.setScanResult(null);
          }}
        />
      )}

      {modals.showApptModal && (
        <ApptModal
          newAppt={modals.newAppt}
          setNewAppt={modals.setNewAppt}
          onSubmit={modals.handleCreateAppt}
          onClose={() => modals.setShowApptModal(false)}
        />
      )}

      {modals.showSuggestModal && (
        <SuggestModal
          newSuggestion={modals.newSuggestion}
          setNewSuggestion={modals.setNewSuggestion}
          onSubmit={modals.handleSubmitSuggestion}
          onClose={() => modals.setShowSuggestModal(false)}
        />
      )}
    </div>
  );
};
