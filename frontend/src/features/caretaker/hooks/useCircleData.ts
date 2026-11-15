import { useState, useCallback, useEffect } from 'react';
import { apiRequest } from '../../../api/client';
import type {
  TodayDosesResponse,
  Medication,
  Appointment,
  AdherenceReport,
  Suggestion,
  ActivityItem,
  NotificationLog,
  CircleDetail,
} from '../../../types';
import { usePolling } from './usePolling';

export interface CircleDataState {
  todayData: TodayDosesResponse | null;
  meds: Medication[];
  appointments: Appointment[];
  adherence: AdherenceReport | null;
  suggestions: Suggestion[];
  activities: ActivityItem[];
  notifications: NotificationLog[];
  circle: CircleDetail | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useCircleData(isCaretaker: boolean, pollIntervalMs: number = 10000): CircleDataState {
  const [todayData, setTodayData] = useState<TodayDosesResponse | null>(null);
  const [meds, setMeds] = useState<Medication[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [adherence, setAdherence] = useState<AdherenceReport | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationLog[]>([]);
  const [circle, setCircle] = useState<CircleDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [dosesRes, medsRes, apptsRes, adhRes, suggRes, actRes, circRes, notifRes] =
        await Promise.all([
          apiRequest<TodayDosesResponse>('/doses'),
          apiRequest<{ medications: Medication[] }>('/meds'),
          apiRequest<{ appointments: Appointment[] }>('/appointments'),
          apiRequest<AdherenceReport>('/adherence?days=7'),
          apiRequest<{ suggestions: Suggestion[] }>('/suggestions'),
          apiRequest<{ activities: ActivityItem[] }>('/activity'),
          apiRequest<CircleDetail>('/circle'),
          isCaretaker
            ? apiRequest<{ notifications: NotificationLog[] }>('/circle/notifications').catch(() => ({
                notifications: [],
              }))
            : Promise.resolve({ notifications: [] }),
        ]);

      setTodayData(dosesRes);
      setMeds(medsRes.medications || []);
      setAppointments(apptsRes.appointments || []);
      setAdherence(adhRes);
      setSuggestions(suggRes.suggestions || []);
      setActivities(actRes.activities || []);
      setCircle(circRes);
      setNotifications(notifRes.notifications || []);
      setError(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [isCaretaker]);

  useEffect(() => {
    let ignore = false;
    const initialLoad = async () => {
      if (!ignore) {
        await refresh();
      }
    };
    void initialLoad();
    return () => {
      ignore = true;
    };
  }, [refresh]);

  usePolling(refresh, pollIntervalMs);

  return {
    todayData,
    meds,
    appointments,
    adherence,
    suggestions,
    activities,
    notifications,
    circle,
    loading,
    error,
    refresh,
  };
}
