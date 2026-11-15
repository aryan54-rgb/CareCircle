import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/useAuth';
import { apiRequest } from '../../api/client';
import { speakText } from '../../lib/speech';
import { elderI18n, type ElderLanguage } from './translations';
import { Volume2, Check, X, Calendar, MessageSquare, Sun, Clock, LogOut, Globe } from 'lucide-react';
import type { TodayDosesResponse, Appointment, Suggestion } from '../../types';
import { usePolling } from '../caretaker/hooks/usePolling';

export const ElderView: React.FC = () => {
  const { user, logout } = useAuth();
  const [lang, setLang] = useState<ElderLanguage>('en');
  const t = elderI18n[lang];

  const [activeTab, setActiveTab] = useState<'today' | 'appointments' | 'suggestions'>('today');
  const [todayData, setTodayData] = useState<TodayDosesResponse | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [actionMessage, setActionMessage] = useState<string>('');

  const loadData = useCallback(async () => {
    try {
      const [dosesRes, apptsRes, suggsRes] = await Promise.all([
        apiRequest<TodayDosesResponse>('/doses'),
        apiRequest<{ appointments: Appointment[] }>('/appointments'),
        apiRequest<{ suggestions: Suggestion[] }>('/suggestions'),
      ]);
      setTodayData(dosesRes);
      setAppointments(apptsRes.appointments || []);
      setSuggestions(suggsRes.suggestions || []);
    } catch {
      // Background load failed, keep existing state
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    const init = async () => {
      if (!ignore) {
        await loadData();
      }
    };
    void init();
    return () => {
      ignore = true;
    };
  }, [loadData]);

  usePolling(loadData, 20000);

  const handleTakeDose = async (doseId: string, medName: string) => {
    try {
      await apiRequest(`/doses/${encodeURIComponent(doseId)}/take`, { method: 'POST' });
      setActionMessage(`✓ ${t.confirmTakenVoice}: ${medName}.`);
      speakText(`${t.confirmTakenVoice}: ${medName}.`, t.langCode);
      await loadData();
      setTimeout(() => setActionMessage(''), 5000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg || 'Could not record dose.');
    }
  };

  const handleSkipDose = async (doseId: string, medName: string) => {
    if (!confirm(`Are you sure you want to skip your dose of ${medName}?`)) return;
    try {
      await apiRequest(`/doses/${encodeURIComponent(doseId)}/skip`, { method: 'POST' });
      setActionMessage(`${t.confirmSkippedVoice}: ${medName}.`);
      speakText(`${t.confirmSkippedVoice}: ${medName}.`, t.langCode);
      await loadData();
      setTimeout(() => setActionMessage(''), 5000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg || 'Could not skip dose.');
    }
  };

  const handleApproveSuggestion = async (id: string, title: string) => {
    try {
      await apiRequest(`/suggestions/${id}/approve`, { method: 'POST' });
      setActionMessage(`✓ ${t.approvedVoice}: "${title}".`);
      speakText(`${t.approvedVoice}: ${title}.`, t.langCode);
      await loadData();
      setTimeout(() => setActionMessage(''), 5000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg || 'Failed to approve.');
    }
  };

  const handleDeclineSuggestion = async (id: string, title: string) => {
    try {
      await apiRequest(`/suggestions/${id}/decline`, { method: 'POST' });
      setActionMessage(`${t.declinedVoice}: "${title}".`);
      speakText(`${t.declinedVoice}: ${title}.`, t.langCode);
      await loadData();
      setTimeout(() => setActionMessage(''), 5000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg || 'Failed to decline.');
    }
  };

  const handleReadAloudHero = () => {
    if (todayData?.heroDose) {
      const time = new Date(todayData.heroDose.dueAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
      if (lang === 'hi') {
        speakText(`अगली दवा का समय है ${todayData.heroDose.medName}. समय: ${time}. कृपया इसे पानी के साथ लें।`, t.langCode);
      } else if (lang === 'mr') {
        speakText(`पुढील औषधाची वेळ आहे ${todayData.heroDose.medName}. वेळ: ${time}. कृपया वेळेवर घ्या.`, t.langCode);
      } else {
        speakText(`Next dose due: ${todayData.heroDose.medName}. Scheduled for ${time}. Please take it with water.`, t.langCode);
      }
    } else {
      speakText(t.noDoses, t.langCode);
    }
  };

  return (
    <div className="min-h-screen bg-amber-50/40 text-slate-900 pb-28">
      {/* Top Banner (High Contrast, Large 24px+ Text, Language Switcher) */}
      <header className="bg-blue-800 text-white px-6 py-5 shadow-md flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <span className="text-blue-200 text-lg uppercase tracking-wider font-extrabold">{t.greeting}</span>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">{user?.name}</h1>
        </div>

        <div className="flex items-center gap-3">
          {/* Elder Language Toggle: English / Hindi / Marathi */}
          <div className="bg-blue-900/80 p-1 rounded-2xl flex items-center border border-blue-600 shadow-inner">
            <span className="text-blue-300 px-2 py-1 flex items-center">
              <Globe size={18} />
            </span>
            {(['en', 'hi', 'mr'] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`px-3 py-1.5 rounded-xl font-black text-sm transition focus:ring-2 focus:ring-blue-300 ${
                  lang === l
                    ? 'bg-amber-400 text-slate-950 shadow-md scale-102'
                    : 'text-blue-200 hover:text-white'
                }`}
                aria-label={`Switch language to ${l === 'en' ? 'English' : l === 'hi' ? 'Hindi' : 'Marathi'}`}
              >
                {l === 'en' ? 'English' : l === 'hi' ? 'हिंदी' : 'मराठी'}
              </button>
            ))}
          </div>

          <button
            onClick={logout}
            className="flex items-center gap-2 bg-blue-900 hover:bg-blue-950 px-4 py-2.5 rounded-2xl text-base font-bold border border-blue-700 active:scale-95 transition focus:ring-4 focus:ring-blue-400"
            title={t.logOut}
          >
            <LogOut size={20} />
            <span className="hidden sm:inline">{t.logOut}</span>
          </button>
        </div>
      </header>

      {/* Floating Action Notification */}
      {actionMessage && (
        <div className="mx-6 mt-4 p-4 bg-emerald-600 text-white text-xl font-bold rounded-2xl shadow-lg flex items-center justify-between animate-fade-in">
          <span>{actionMessage}</span>
          <button onClick={() => setActionMessage('')} className="p-1 focus:ring-2 focus:ring-white rounded-lg">
            <X size={26} />
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main className="max-w-2xl mx-auto px-6 py-6">
        {/* ========================================================= */}
        {/* TAB 1: TODAY VIEW (HERO CARD & SCHEDULE) */}
        {/* ========================================================= */}
        {activeTab === 'today' && (
          <div>
            {/* HERO CARD: NEXT DOSE */}
            {todayData?.heroDose ? (
              <section className="bg-white border-4 border-blue-600 rounded-3xl p-6 md:p-8 shadow-xl mb-8 relative">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <span className="bg-blue-100 text-blue-900 text-lg font-extrabold px-4 py-1.5 rounded-full flex items-center gap-2">
                    <Clock size={20} />
                    <span>{t.nextDoseTitle.toUpperCase()}</span>
                  </span>
                  <button
                    onClick={handleReadAloudHero}
                    className="flex items-center gap-2 bg-amber-100 text-amber-900 hover:bg-amber-200 px-4 py-2.5 rounded-2xl font-black text-lg active:scale-95 transition focus:ring-4 focus:ring-amber-400 shadow-xs"
                    title={t.readAloud}
                  >
                    <Volume2 size={24} />
                    <span>{t.readAloud}</span>
                  </button>
                </div>

                <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-2">
                  {todayData.heroDose.medName}
                </h2>
                <p className="text-2xl font-bold text-slate-600 mb-8">
                  {t.dueAt}{' '}
                  {new Date(todayData.heroDose.dueAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>

                {/* BIG 64px+ ACCESSIBLE TOUCH TARGETS */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <button
                    onClick={() =>
                      handleTakeDose(todayData.heroDose!.id, todayData.heroDose!.medName)
                    }
                    className="flex-1 min-h-[68px] bg-emerald-600 hover:bg-emerald-700 text-white text-2xl font-black py-4 px-6 rounded-2xl shadow-lg flex items-center justify-center gap-3 active:scale-98 transition focus:ring-4 focus:ring-emerald-400"
                  >
                    <Check size={32} strokeWidth={3} />
                    <span>{t.iTookIt}</span>
                  </button>
                  <button
                    onClick={() =>
                      handleSkipDose(todayData.heroDose!.id, todayData.heroDose!.medName)
                    }
                    className="min-h-[68px] bg-slate-200 hover:bg-slate-300 text-slate-700 text-xl font-bold py-4 px-6 rounded-2xl active:scale-98 transition focus:ring-4 focus:ring-slate-400"
                  >
                    <span>{t.skip}</span>
                  </button>
                </div>
              </section>
            ) : (
              <div className="bg-white rounded-3xl p-8 text-center border-2 border-emerald-300 shadow-md mb-8">
                <div className="text-5xl mb-3">🎉</div>
                <h2 className="text-3xl font-extrabold text-emerald-800 mb-2">{t.noDoses}</h2>
              </div>
            )}

            {/* REST OF TODAY'S ROUTINE */}
            <h3 className="text-2xl font-extrabold text-slate-800 mb-4 flex items-center gap-2">
              <Sun className="text-amber-500" size={28} />
              <span>{t.todaySchedule}</span>
            </h3>

            <div className="space-y-4">
              {todayData?.doses && todayData.doses.length > 0 ? (
                todayData.doses.map((dose) => (
                  <div
                    key={dose.id}
                    className={`bg-white p-5 rounded-2xl border-2 flex items-center justify-between shadow-sm ${
                      dose.status === 'TAKEN'
                        ? 'border-emerald-300 bg-emerald-50/30'
                        : dose.status === 'SKIPPED'
                        ? 'border-slate-300 opacity-60'
                        : 'border-slate-200'
                    }`}
                  >
                    <div>
                      <div className="text-2xl font-bold text-slate-900">{dose.medName}</div>
                      <div className="text-lg font-semibold text-slate-500">
                        {new Date(dose.dueAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                    <div>
                      {dose.status === 'TAKEN' ? (
                        <span className="bg-emerald-100 text-emerald-800 text-lg font-bold px-4 py-2 rounded-xl flex items-center gap-1.5">
                          <Check size={20} strokeWidth={3} /> {t.alreadyTaken}
                        </span>
                      ) : dose.status === 'SKIPPED' ? (
                        <span className="bg-slate-200 text-slate-700 text-lg font-bold px-4 py-2 rounded-xl">
                          {t.alreadySkipped}
                        </span>
                      ) : (
                        <button
                          onClick={() => handleTakeDose(dose.id, dose.medName)}
                          className="min-h-[56px] bg-emerald-600 hover:bg-emerald-700 text-white text-lg font-black px-5 py-2.5 rounded-xl shadow active:scale-95 focus:ring-4 focus:ring-emerald-400"
                        >
                          {t.iTookIt}
                        </button>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="bg-white p-6 rounded-2xl text-center text-xl text-slate-500 border">
                  {t.noDoses}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: APPOINTMENTS */}
        {/* ========================================================= */}
        {activeTab === 'appointments' && (
          <div>
            <h2 className="text-3xl font-extrabold text-slate-900 mb-6 flex items-center justify-between">
              <span>{t.upcomingVisits}</span>
              <button
                onClick={() => {
                  const text = appointments.length
                    ? `You have ${appointments.length} upcoming appointments. First is with ${appointments[0].doctor}.`
                    : t.noAppts;
                  speakText(text, t.langCode);
                }}
                className="flex items-center gap-2 bg-amber-100 text-amber-900 hover:bg-amber-200 px-4 py-2 rounded-xl font-bold text-lg focus:ring-4 focus:ring-amber-400"
              >
                <Volume2 size={24} /> {t.readAloud}
              </button>
            </h2>

            <div className="space-y-5">
              {appointments.length > 0 ? (
                appointments.map((a) => (
                  <div
                    key={a.id}
                    className="bg-white border-2 border-blue-200 p-6 rounded-3xl shadow-sm"
                  >
                    <div className="text-2xl font-black text-blue-900 mb-1">{a.doctor}</div>
                    <div className="text-xl font-bold text-slate-700 mb-2">📍 {a.place}</div>
                    <div className="text-lg font-semibold text-slate-500 mb-3">
                      🗓️{' '}
                      {new Date(a.startsAt).toLocaleDateString([], {
                        weekday: 'long',
                        month: 'short',
                        day: 'numeric',
                      })}{' '}
                      at{' '}
                      {new Date(a.startsAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                    {a.notes && (
                      <div className="bg-amber-50 p-3 rounded-xl text-lg text-amber-900 border border-amber-200">
                        <strong>Note:</strong> {a.notes}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="bg-white p-8 rounded-3xl text-center text-2xl text-slate-500 border">
                  {t.noAppts}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 3: SUGGESTIONS / FAMILY REQUESTS */}
        {/* ========================================================= */}
        {activeTab === 'suggestions' && (
          <div>
            <h2 className="text-3xl font-extrabold text-slate-900 mb-6">{t.suggestionsTitle}</h2>
            <div className="space-y-6">
              {suggestions.filter((s) => s.status === 'PENDING').length > 0 ? (
                suggestions
                  .filter((s) => s.status === 'PENDING')
                  .map((s) => (
                    <div
                      key={s.id}
                      className="bg-white border-4 border-amber-400 p-6 md:p-8 rounded-3xl shadow-lg"
                    >
                      <div className="text-lg font-extrabold text-amber-700 uppercase mb-2">
                        {s.proposedByName} suggests:
                      </div>
                      <div className="text-3xl font-black text-slate-900 mb-4">{s.title}</div>
                      <p className="text-xl text-slate-600 mb-6">
                        {typeof s.payload?.instructions === 'string'
                          ? s.payload.instructions
                          : 'Would you like to add this to your schedule?'}
                      </p>

                      <div className="flex flex-col sm:flex-row gap-4">
                        <button
                          onClick={() => handleApproveSuggestion(s.id, s.title)}
                          className="flex-1 min-h-[64px] bg-emerald-600 hover:bg-emerald-700 text-white text-2xl font-black py-3 px-6 rounded-2xl flex items-center justify-center gap-2 active:scale-98 focus:ring-4 focus:ring-emerald-400"
                        >
                          <Check size={28} strokeWidth={3} />
                          <span>{t.approve}</span>
                        </button>
                        <button
                          onClick={() => handleDeclineSuggestion(s.id, s.title)}
                          className="min-h-[64px] bg-slate-200 hover:bg-slate-300 text-slate-700 text-xl font-bold py-3 px-6 rounded-2xl active:scale-98 focus:ring-4 focus:ring-slate-400"
                        >
                          {t.decline}
                        </button>
                      </div>
                    </div>
                  ))
              ) : (
                <div className="bg-white p-8 rounded-3xl text-center text-2xl text-slate-500 border">
                  {t.noSuggestions}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ========================================================= */}
      {/* ELDER FIXED BOTTOM NAVIGATION (MAX 3 ITEMS, 68px TALL) */}
      {/* ========================================================= */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-slate-300 py-2 px-6 flex justify-around shadow-2xl z-50">
        <button
          onClick={() => setActiveTab('today')}
          className={`flex flex-col items-center justify-center min-h-[68px] min-w-[100px] px-3 py-1 rounded-2xl font-black text-lg transition focus:ring-4 focus:ring-blue-400 ${
            activeTab === 'today'
              ? 'text-blue-700 bg-blue-100 border-2 border-blue-600'
              : 'text-slate-600'
          }`}
          aria-label={t.todayTab}
        >
          <Clock size={28} />
          <span>{t.todayTab}</span>
        </button>

        <button
          onClick={() => setActiveTab('appointments')}
          className={`flex flex-col items-center justify-center min-h-[68px] min-w-[100px] px-3 py-1 rounded-2xl font-black text-lg transition focus:ring-4 focus:ring-blue-400 ${
            activeTab === 'appointments'
              ? 'text-blue-700 bg-blue-100 border-2 border-blue-600'
              : 'text-slate-600'
          }`}
          aria-label={t.apptsTab}
        >
          <Calendar size={28} />
          <span>{t.apptsTab}</span>
        </button>

        <button
          onClick={() => setActiveTab('suggestions')}
          className={`flex flex-col items-center justify-center min-h-[68px] min-w-[100px] px-3 py-1 rounded-2xl font-black text-lg transition relative focus:ring-4 focus:ring-blue-400 ${
            activeTab === 'suggestions'
              ? 'text-blue-700 bg-blue-100 border-2 border-blue-600'
              : 'text-slate-600'
          }`}
          aria-label={t.askTab}
        >
          <MessageSquare size={28} />
          <span>{t.askTab}</span>
          {suggestions.filter((s) => s.status === 'PENDING').length > 0 && (
            <span className="absolute top-1 right-2 bg-amber-500 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
              {suggestions.filter((s) => s.status === 'PENDING').length}
            </span>
          )}
        </button>
      </nav>
    </div>
  );
};
