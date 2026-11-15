import React, { useState } from 'react';
import { apiRequest } from '../../../api/client';
import type { ScanPrescriptionResponse } from '../../../types';
import type { MedFormData } from '../components/AddMedModal';
import type { ApptFormData } from '../components/ApptModal';
import type { SuggestFormData } from '../components/SuggestModal';

export function useCaretakerModals(onSuccess: () => Promise<void>) {
  // Modal visibility
  const [showAddMedModal, setShowAddMedModal] = useState<boolean>(false);
  const [showScanModal, setShowScanModal] = useState<boolean>(false);
  const [showApptModal, setShowApptModal] = useState<boolean>(false);
  const [showSuggestModal, setShowSuggestModal] = useState<boolean>(false);
  const [inviteCodeResult, setInviteCodeResult] = useState<string>('');

  // Form states with initializer functions for purity compliance
  const [newMed, setNewMed] = useState<MedFormData>(() => ({
    name: '',
    strength: '',
    form: 'tablet',
    instructions: '',
    times: '09:00, 21:00',
    startDate: new Date().toISOString().split('T')[0],
    pillCount: 30,
    refillThreshold: 5,
  }));

  const [newAppt, setNewAppt] = useState<ApptFormData>(() => ({
    doctor: '',
    place: '',
    notes: '',
    startsAt: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 16),
  }));

  const [newSuggestion, setNewSuggestion] = useState<SuggestFormData>(() => ({
    title: '',
    instructions: '',
    times: '09:00',
  }));

  // AI Scan state
  const [scanLoading, setScanLoading] = useState<boolean>(false);
  const [scanResult, setScanResult] = useState<ScanPrescriptionResponse | null>(null);
  const [scanError, setScanError] = useState<string>('');
  const [confirmedConfidence, setConfirmedConfidence] = useState<boolean>(false);

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
      setScanResult(null);
      setConfirmedConfidence(false);
      await onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg || 'Failed to add medication');
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
      await onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg || 'Failed to schedule appointment');
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
      await onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg || 'Failed to submit suggestion');
    }
  };

  const handleGenerateInvite = async (role: 'ELDER' | 'CARETAKER' | 'FAMILY') => {
    try {
      const res = await apiRequest<{ code: string }>('/circle/invites', {
        method: 'POST',
        body: JSON.stringify({ role }),
      });
      setInviteCodeResult(`New ${role} Invite Code: ${res.code} (Valid for 48 hours)`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg || 'Failed to generate invite');
    }
  };

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
        const res = await apiRequest<ScanPrescriptionResponse>('/scan/prescription', {
          method: 'POST',
          body: JSON.stringify({ imageBase64: base64, mimeType: file.type || 'image/jpeg' }),
        });
        setScanResult(res);
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
      } catch {
        setScanError('Scan unavailable, enter manually. The AI service could not be reached.');
      } finally {
        setScanLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  return {
    showAddMedModal,
    setShowAddMedModal,
    showScanModal,
    setShowScanModal,
    showApptModal,
    setShowApptModal,
    showSuggestModal,
    setShowSuggestModal,
    inviteCodeResult,
    newMed,
    setNewMed,
    newAppt,
    setNewAppt,
    newSuggestion,
    setNewSuggestion,
    scanLoading,
    scanResult,
    setScanResult,
    scanError,
    confirmedConfidence,
    setConfirmedConfidence,
    handleCreateMed,
    handleCreateAppt,
    handleSubmitSuggestion,
    handleGenerateInvite,
    handleFileUpload,
  };
}
