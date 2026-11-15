import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../api/client';
import {
  Calendar,
  Clock,
  Pill,
  BarChart2,
  FileText,
  Settings,
  Plus,
  Camera,
  AlertTriangle,
  Send,
  LogOut,
  RefreshCw,
  Zap,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

export const CaretakerView: React.FC = () => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<
    'today' | 'meds' | 'appointments' | 'adherence' | 'suggestions' | 'activity' | 'settings'
  >('today');

  // Data states
  const [todayData, setTodayData] = useState<any>(null);
  const [meds, setMeds] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [adherence, setAdherence] = useState<any>(null);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [circle, setCircle] = useState<any>(null);
  const [, setLoading] = useState<boolean>(true);

  // Form modals / states
  const [showAddMedModal, setShowAddMedModal] = useState<boolean>(false);
  const [showScanModal, setShowScanModal] = useState<boolean>(false);
  const [showApptModal, setShowApptModal] = useState<boolean>(false);
  const [showSuggestModal, setShowSuggestModal] = useState<boolean>(false);
  const [inviteCodeResult, setInviteCodeResult] = useState<string>('');
  const [demoTriggerMsg, setDemoTriggerMsg] = useState<string>('');

  // Form models
  const [newMed, setNewMed] = useState({
    name: '',
    strength: '',
    form: 'tablet',
    instructions: '',
    times: '09:00, 21:00',
    startDate: new Date().toISOString().split('T')[0],
    pillCount: 30,
    refillThreshold: 5,
  });

  const [newAppt, setNewAppt] = useState({
    doctor: '',
    place: '',
    notes: '',
    startsAt: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 16),
  });

  const [newSuggestion, setNewSuggestion] = useState({
    title: '',
    instructions: '',
    times: '09:00',
  });

  // Scan state
  const [scanLoading, setScanLoading] = useState<boolean>(false);
  const [scanResult, setScanResult] = useState<any>(null);
  const [scanError, setScanError] = useState<string>('');

  const loadAll = async () => {
    try {
      const [dosesRes, medsRes, apptsRes, adhRes, suggRes, actRes, circRes] =
        await Promise.all([
          apiRequest('/doses'),
          apiRequest('/meds'),
          apiRequest('/appointments'),
          apiRequest('/adherence?days=7'),
          apiRequest('/suggestions'),
          apiRequest('/activity'),
          apiRequest('/circle'),
        ]);
      setTodayData(dosesRes);
      setMeds(medsRes.medications || []);
      setAppointments(apptsRes.appointments || []);
      setAdherence(adhRes);
      setSuggestions(suggRes.suggestions || []);
      setActivities(actRes.activities || []);
      setCircle(circRes);
    } catch (err) {
      console.error('Error loading dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    const interval = setInterval(loadAll, 15000);
    return () => clearInterval(interval);
  }, []);

  // Handlers
  const handleMarkDose = async (id: string, action: 'take' | 'skip') => {
    try {
      await apiRequest(`/doses/${encodeURIComponent(id)}/${action}`, { method: 'POST' });
      await loadAll();
    } catch (err: any) {
      alert(err.message || 'Failed to update dose');
    }
  };

  const handleCreateMed = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const timesArray = newMed.times.split(',').map((t) => t.trim());
      await apiRequest('/meds', {
        method: 'POST',
        body: JSON.stringify({
          ...newMed,
          times: timesArray,
          pillCount: Number(newMed.pillCount),
          refillThreshold: Number(newMed.refillThreshold),
        }),
      });
      setShowAddMedModal(false);
      await loadAll();
    } catch (err: any) {
      alert(err.message || 'Failed to add medication');
    }
  };

  const handleCreateAppt = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/appointments', {
        method: 'POST',
        body: JSON.stringify({
          ...newAppt,
          startsAt: new Date(newAppt.startsAt).toISOString(),
        }),
      });
      setShowApptModal(false);
      await loadAll();
    } catch (err: any) {
      alert(err.message || 'Failed to schedule appointment');
    }
  };

  const handleSubmitSuggestion = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/suggestions', {
        method: 'POST',
        body: JSON.stringify({
          type: 'NEW_MED',
          title: newSuggestion.title,
          payload: {
            name: newSuggestion.title,
            instructions: newSuggestion.instructions,
            times: [newSuggestion.times],
          },
        }),
      });
      setShowSuggestModal(false);
      await loadAll();
    } catch (err: any) {
      alert(err.message || 'Failed to submit suggestion');
    }
  };

  const handleApproveSuggestion = async (id: string) => {
    try {
      await apiRequest(`/suggestions/${id}/approve`, { method: 'POST' });
      await loadAll();
    } catch (err: any) {
      alert(err.message || 'Failed to approve suggestion');
    }
  };

  const handleDeclineSuggestion = async (id: string) => {
    try {
      await apiRequest(`/suggestions/${id}/decline`, { method: 'POST' });
      await loadAll();
    } catch (err: any) {
      alert(err.message || 'Failed to decline suggestion');
    }
  };

  const handleGenerateInvite = async (role: 'ELDER' | 'CARETAKER' | 'FAMILY') => {
    try {
      const res = await apiRequest('/circle/invites', {
        method: 'POST',
        body: JSON.stringify({ role }),
      });
      setInviteCodeResult(`New ${role} Invite Code: ${res.code} (Valid for 48 hours)`);
    } catch (err: any) {
      alert(err.message || 'Failed to generate invite');
    }
  };

  const handleTriggerMissedDemo = async () => {
    try {
      const res = await apiRequest('/demo/trigger-missed', { method: 'POST' });
      setDemoTriggerMsg(
        `✓ Demo Missed Triggered for ${res.medName}! Escalation ticker will now advance every 1 minute.`
      );
      await loadAll();
      setTimeout(() => setDemoTriggerMsg(''), 8000);
    } catch (err: any) {
      alert(err.message || 'Could not trigger demo');
    }
  };

  // Prescription Photo Upload -> Bedrock AI extraction
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setScanLoading(true);
      setScanError('');
      setScanResult(null);
      try {
        const res = await apiRequest('/scan/prescription', {
          method: 'POST',
          body: JSON.stringify({ imageBase64: base64, mimeType: file.type || 'image/jpeg' }),
        });
        setScanResult(res);
        // Prepopulate add medication form with AI extracted fields
        if (res.extracted) {
          setNewMed({
            name: res.extracted.name || '',
            strength: res.extracted.strength || '',
            form: res.extracted.form || 'tablet',
            instructions: res.extracted.instructions || '',
            times: (res.extracted.times || ['09:00']).join(', '),
            startDate: new Date().toISOString().split('T')[0],
            pillCount: 30,
            refillThreshold: 5,
          });
        }
      } catch (err: any) {
        console.warn('Prescription scan failed:', err);
        setScanError('Scan unavailable, enter manually. The AI service could not be reached.');
      } finally {
        setScanLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const isCaretaker = user?.role === 'CARETAKER';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      {/* Top Navbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-extrabold text-xl">
              C
            </div>
            <div>
              <div className="font-extrabold text-lg leading-tight text-slate-900">
                {circle?.circle?.name || 'CareCircle'}
              </div>
              <div className="text-xs text-slate-500 font-semibold">
                Caring for {circle?.circle?.elderName || 'Elder'} • Role:{' '}
                <span className="text-blue-600 font-bold">{user?.role}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isCaretaker && (
              <button
                onClick={handleTriggerMissedDemo}
                className="hidden sm:flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-3 py-2 rounded-lg shadow-sm active:scale-95 transition"
                title="Trigger a missed dose to demonstrate real-time email escalation"
              >
                <Zap size={14} />
                <span>Demo Escalation</span>
              </button>
            )}
            <button
              onClick={logout}
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
            { id: 'today', label: 'Today', icon: Clock },
            { id: 'meds', label: 'Medications', icon: Pill },
            { id: 'appointments', label: 'Appointments', icon: Calendar },
            { id: 'adherence', label: 'Adherence', icon: BarChart2 },
            { id: 'suggestions', label: 'Suggestions', icon: Send },
            { id: 'activity', label: 'Activity Log', icon: FileText },
            { id: 'settings', label: 'Settings', icon: Settings },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 py-3 px-3.5 border-b-2 whitespace-nowrap transition ${
                  isActive
                    ? 'border-blue-600 text-blue-600 font-bold'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Demo Notification Banner */}
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

      {/* Main Tab Views */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* ========================================================= */}
        {/* TAB: TODAY VIEW */}
        {/* ========================================================= */}
        {activeTab === 'today' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black text-slate-900">Today's Medication Schedule</h2>
                <p className="text-slate-500 text-sm">
                  Track and verify morning, afternoon, and evening doses.
                </p>
              </div>
              <button
                onClick={loadAll}
                className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-white border px-3 py-2 rounded-lg hover:bg-slate-50 shadow-sm"
              >
                <RefreshCw size={14} /> Refresh
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {todayData?.doses && todayData.doses.length > 0 ? (
                todayData.doses.map((dose: any) => {
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
                            onClick={() => handleMarkDose(dose.id, 'take')}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 rounded-lg"
                          >
                            Mark on Behalf
                          </button>
                          <button
                            onClick={() => handleMarkDose(dose.id, 'skip')}
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
        )}

        {/* ========================================================= */}
        {/* TAB: MEDICATIONS */}
        {/* ========================================================= */}
        {activeTab === 'meds' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-slate-900">Medications</h2>
                <p className="text-slate-500 text-sm">Active prescriptions, pill inventory, and schedules.</p>
              </div>
              {isCaretaker && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowScanModal(true)}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm px-4 py-2.5 rounded-xl shadow-sm transition"
                  >
                    <Camera size={18} />
                    <span>Scan Prescription (AI)</span>
                  </button>
                  <button
                    onClick={() => setShowAddMedModal(true)}
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
        )}

        {/* ========================================================= */}
        {/* TAB: APPOINTMENTS */}
        {/* ========================================================= */}
        {activeTab === 'appointments' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black text-slate-900">Doctor Appointments</h2>
                <p className="text-slate-500 text-sm">
                  Upcoming consultations with automatic 24-hour and 2-hour reminders.
                </p>
              </div>
              {isCaretaker && (
                <button
                  onClick={() => setShowApptModal(true)}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm px-4 py-2.5 rounded-xl shadow-sm transition"
                >
                  <Plus size={18} /> Schedule Visit
                </button>
              )}
            </div>

            <div className="space-y-3">
              {appointments.map((a) => (
                <div
                  key={a.id}
                  className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">{a.doctor}</h3>
                    <p className="text-sm font-semibold text-slate-600">📍 {a.place}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      🗓️{' '}
                      {new Date(a.startsAt).toLocaleDateString([], {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                    {a.notes && <p className="text-xs text-amber-800 bg-amber-50 p-2 rounded mt-2">{a.notes}</p>}
                  </div>
                  <span className="text-xs font-bold px-3 py-1 bg-blue-50 text-blue-700 rounded-full self-start md:self-center">
                    {a.stage}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB: ADHERENCE STATS */}
        {/* ========================================================= */}
        {activeTab === 'adherence' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-black text-slate-900">Adherence Analytics</h2>
              <p className="text-slate-500 text-sm">Real-time stats calculated deterministically from taken and missed doses.</p>
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

            {/* Recharts 7-Day Adherence Chart */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Daily Adherence Rate (Past 7 Days)</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={adherence?.dailyStats || []}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
                    <YAxis stroke="#94a3b8" fontSize={12} domain={[0, 100]} />
                    <Tooltip />
                    <Bar dataKey="rate" name="Adherence %" fill="#2563eb" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Per-Medication breakdown */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Per-Medication Compliance</h3>
              <div className="space-y-3">
                {adherence?.medicationStats?.map((m: any) => (
                  <div key={m.medId} className="flex items-center justify-between border-b pb-3">
                    <div>
                      <div className="font-bold text-slate-900">{m.medName}</div>
                      <div className="text-xs text-slate-500">
                        Taken: {m.taken} • Skipped: {m.skipped} • Missed: {m.missed}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-extrabold text-blue-600">{m.rate}%</div>
                      {m.needsRefill && <span className="text-xs text-red-600 font-bold">Needs Refill</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB: SUGGESTIONS */}
        {/* ========================================================= */}
        {activeTab === 'suggestions' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black text-slate-900">Family Suggestions</h2>
                <p className="text-slate-500 text-sm">
                  Collaborative care requests submitted by family members and caretakers.
                </p>
              </div>
              <button
                onClick={() => setShowSuggestModal(true)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm px-4 py-2.5 rounded-xl shadow-sm transition"
              >
                <Plus size={18} /> Propose Suggestion
              </button>
            </div>

            <div className="space-y-4">
              {suggestions.map((s) => (
                <div key={s.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-bold uppercase text-slate-500">
                        Proposed by {s.proposedByName} ({s.proposedByRole})
                      </span>
                      <h3 className="text-xl font-bold text-slate-900 mt-0.5">{s.title}</h3>
                      {s.payload?.instructions && (
                        <p className="text-sm text-slate-600 mt-2">{s.payload.instructions}</p>
                      )}
                    </div>
                    <span
                      className={`text-xs font-bold px-3 py-1 rounded-full ${
                        s.status === 'APPROVED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : s.status === 'DECLINED'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-amber-100 text-amber-800 font-extrabold'
                      }`}
                    >
                      {s.status}
                    </span>
                  </div>

                  {isCaretaker && s.status === 'PENDING' && (
                    <div className="mt-4 pt-3 border-t flex gap-2">
                      <button
                        onClick={() => handleApproveSuggestion(s.id)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-lg"
                      >
                        Approve & Add to Schedule
                      </button>
                      <button
                        onClick={() => handleDeclineSuggestion(s.id)}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold px-4 py-2 rounded-lg"
                      >
                        Decline
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB: ACTIVITY LOG */}
        {/* ========================================================= */}
        {activeTab === 'activity' && (
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
        )}

        {/* ========================================================= */}
        {/* TAB: SETTINGS & INVITES */}
        {/* ========================================================= */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-black text-slate-900">Circle Settings & Members</h2>
              <p className="text-slate-500 text-sm">Manage members, generate invite codes, and configure escalation timing.</p>
            </div>

            {isCaretaker && (
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900 mb-2">Generate New Invite Code</h3>
                <p className="text-sm text-slate-500 mb-4">
                  Passcode-based access for family members, doctors, or caretakers.
                </p>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => handleGenerateInvite('ELDER')}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs px-4 py-2.5 rounded-xl"
                  >
                    + Invite Elder
                  </button>
                  <button
                    onClick={() => handleGenerateInvite('CARETAKER')}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs px-4 py-2.5 rounded-xl"
                  >
                    + Invite Caretaker
                  </button>
                  <button
                    onClick={() => handleGenerateInvite('FAMILY')}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs px-4 py-2.5 rounded-xl"
                  >
                    + Invite Family Member
                  </button>
                </div>
                {inviteCodeResult && (
                  <div className="mt-4 p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl font-bold text-sm">
                    {inviteCodeResult}
                  </div>
                )}
              </div>
            )}

            {/* Members List */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Circle Members</h3>
              <div className="space-y-3">
                {circle?.members?.map((m: any) => (
                  <div key={m.memberId} className="flex justify-between items-center py-2 border-b">
                    <div>
                      <span className="font-bold text-slate-800">{m.name}</span>
                      <span className="text-xs text-slate-500 ml-2">({m.email})</span>
                    </div>
                    <span className="text-xs font-bold px-3 py-1 bg-blue-50 text-blue-700 rounded-full">
                      {m.role}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ========================================================= */}
      {/* MODAL: ADD MEDICATION */}
      {/* ========================================================= */}
      {showAddMedModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl">
            <h3 className="text-2xl font-black text-slate-900 mb-4">Add Medication</h3>
            <form onSubmit={handleCreateMed} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Medication Name</label>
                <input
                  type="text"
                  required
                  value={newMed.name}
                  onChange={(e) => setNewMed({ ...newMed, name: e.target.value })}
                  placeholder="e.g. Metformin"
                  className="w-full border p-2.5 rounded-xl text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Strength</label>
                  <input
                    type="text"
                    required
                    value={newMed.strength}
                    onChange={(e) => setNewMed({ ...newMed, strength: e.target.value })}
                    placeholder="e.g. 500mg"
                    className="w-full border p-2.5 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Form</label>
                  <input
                    type="text"
                    required
                    value={newMed.form}
                    onChange={(e) => setNewMed({ ...newMed, form: e.target.value })}
                    placeholder="tablet, capsule"
                    className="w-full border p-2.5 rounded-xl text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Daily Times (comma-separated)</label>
                <input
                  type="text"
                  required
                  value={newMed.times}
                  onChange={(e) => setNewMed({ ...newMed, times: e.target.value })}
                  placeholder="09:00, 21:00"
                  className="w-full border p-2.5 rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Instructions</label>
                <input
                  type="text"
                  value={newMed.instructions}
                  onChange={(e) => setNewMed({ ...newMed, instructions: e.target.value })}
                  placeholder="Take after meals with water"
                  className="w-full border p-2.5 rounded-xl text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Pill Count</label>
                  <input
                    type="number"
                    value={newMed.pillCount}
                    onChange={(e) => setNewMed({ ...newMed, pillCount: Number(e.target.value) })}
                    className="w-full border p-2.5 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Refill Threshold</label>
                  <input
                    type="number"
                    value={newMed.refillThreshold}
                    onChange={(e) => setNewMed({ ...newMed, refillThreshold: Number(e.target.value) })}
                    className="w-full border p-2.5 rounded-xl text-sm"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddMedModal(false)}
                  className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow"
                >
                  Save & Generate 7-Day Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: PRESCRIPTION SCANNER (BEDROCK AI) */}
      {/* ========================================================= */}
      {showScanModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl">
            <h3 className="text-2xl font-black text-slate-900 mb-2">Prescription Scan (AI)</h3>
            <p className="text-sm text-slate-500 mb-6">
              Upload a prescription photo or doctor's note. Amazon Bedrock extracts the schedule details into an editable draft.
            </p>

            <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center hover:border-blue-500 transition cursor-pointer mb-6 relative">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <Camera size={36} className="mx-auto text-slate-400 mb-2" />
              <p className="text-sm font-bold text-slate-700">Click to upload or take a photo</p>
              <p className="text-xs text-slate-400 mt-1">JPEG or PNG up to 5 MB</p>
            </div>

            {scanLoading && (
              <div className="p-4 bg-blue-50 text-blue-700 rounded-xl text-sm font-bold text-center mb-4 animate-pulse">
                Analyzing document with Amazon Bedrock Converse API...
              </div>
            )}

            {scanError && (
              <div className="p-4 bg-amber-50 border border-amber-300 text-amber-900 rounded-2xl text-sm mb-4">
                <div className="font-extrabold flex items-center gap-1.5 mb-1 text-amber-800">
                  <AlertTriangle size={16} className="text-amber-600 flex-shrink-0" />
                  <span>Scan unavailable, enter manually</span>
                </div>
                <p className="text-xs text-amber-700 mb-3">
                  AI prescription extraction is currently unavailable. You can easily enter the medication schedule details manually.
                </p>
                <button
                  onClick={() => {
                    setShowScanModal(false);
                    setShowAddMedModal(true);
                  }}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2.5 px-3 rounded-xl transition shadow-xs"
                >
                  Enter Medication Details Manually
                </button>
              </div>
            )}

            {scanResult && (
              <div className="space-y-3 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="flex items-center gap-1.5 text-xs text-amber-700 font-bold">
                  <AlertTriangle size={14} />
                  <span>{scanResult.disclaimer}</span>
                </div>
                <div className="text-sm">
                  <strong>Extracted:</strong> {scanResult.extracted.name} ({scanResult.extracted.strength})
                </div>
                <div className="text-xs text-slate-600">
                  Times: {scanResult.extracted.times?.join(', ')} • {scanResult.extracted.instructions}
                </div>
                <button
                  onClick={() => {
                    setShowScanModal(false);
                    setShowAddMedModal(true);
                  }}
                  className="w-full bg-emerald-600 text-white font-bold text-sm py-2 rounded-xl mt-2"
                >
                  Review & Confirm Draft Form
                </button>
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={() => {
                  setShowScanModal(false);
                  setScanResult(null);
                }}
                className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: SCHEDULE APPOINTMENT */}
      {/* ========================================================= */}
      {showApptModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl">
            <h3 className="text-2xl font-black text-slate-900 mb-4">Schedule Appointment</h3>
            <form onSubmit={handleCreateAppt} className="space-y-4">
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
                  onClick={() => setShowApptModal(false)}
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
      )}

      {/* ========================================================= */}
      {/* MODAL: PROPOSE SUGGESTION */}
      {/* ========================================================= */}
      {showSuggestModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl">
            <h3 className="text-2xl font-black text-slate-900 mb-2">Propose Suggestion</h3>
            <p className="text-sm text-slate-500 mb-4">
              Submit a medication or appointment request for elder approval.
            </p>
            <form onSubmit={handleSubmitSuggestion} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Suggestion Title</label>
                <input
                  type="text"
                  required
                  value={newSuggestion.title}
                  onChange={(e) => setNewSuggestion({ ...newSuggestion, title: e.target.value })}
                  placeholder="e.g. Vitamin D3 1000 IU Daily"
                  className="w-full border p-2.5 rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Instructions / Reason</label>
                <input
                  type="text"
                  value={newSuggestion.instructions}
                  onChange={(e) =>
                    setNewSuggestion({ ...newSuggestion, instructions: e.target.value })
                  }
                  placeholder="e.g. Recommended by doctor to boost energy"
                  className="w-full border p-2.5 rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Proposed Time</label>
                <input
                  type="text"
                  value={newSuggestion.times}
                  onChange={(e) => setNewSuggestion({ ...newSuggestion, times: e.target.value })}
                  placeholder="09:00"
                  className="w-full border p-2.5 rounded-xl text-sm"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowSuggestModal(false)}
                  className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow"
                >
                  Submit Suggestion
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
