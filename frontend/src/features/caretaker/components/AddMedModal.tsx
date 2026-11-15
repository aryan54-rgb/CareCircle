import React from 'react';
import { AlertTriangle } from 'lucide-react';
import type { ScanPrescriptionResponse } from '../../../types';

export interface MedFormData {
  name: string;
  strength: string;
  form: string;
  instructions: string;
  times: string;
  startDate: string;
  pillCount: number;
  refillThreshold: number;
}

interface AddMedModalProps {
  newMed: MedFormData;
  setNewMed: React.Dispatch<React.SetStateAction<MedFormData>>;
  scanResult: ScanPrescriptionResponse | null;
  confirmedConfidence: boolean;
  setConfirmedConfidence: (val: boolean) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}

export const AddMedModal: React.FC<AddMedModalProps> = ({
  newMed,
  setNewMed,
  scanResult,
  confirmedConfidence,
  setConfirmedConfidence,
  onSubmit,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl">
        <h3 className="text-2xl font-black text-slate-900 mb-2">Add Medication</h3>
        {scanResult ? (
          <div className="mb-4 p-3.5 bg-amber-50 border border-amber-300 rounded-2xl text-amber-950 text-xs flex items-start gap-2.5">
            <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-extrabold text-amber-900">
                AI-Assisted Scan Review (Confidence: {Math.round((scanResult.extracted?.confidence ?? 0.8) * 100)}%)
              </div>
              <div className="text-amber-800 mt-0.5">
                Fields below were drafted by Bedrock AI. Check each field carefully against the physical bottle before saving.
              </div>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-500 mb-4">
            Enter schedule details to automatically project doses for the next 7 days.
          </p>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-bold text-slate-700">Medication Name</label>
              {scanResult && (
                <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">
                  AI Extracted
                </span>
              )}
            </div>
            <input
              type="text"
              required
              value={newMed.name}
              onChange={(e) => setNewMed({ ...newMed, name: e.target.value })}
              placeholder="e.g. Metformin"
              className={`w-full border p-2.5 rounded-xl text-sm transition ${
                scanResult ? 'border-amber-400 bg-amber-50/20' : 'border-slate-300'
              }`}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-bold text-slate-700">Strength</label>
                {scanResult && (
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-md">
                    Check
                  </span>
                )}
              </div>
              <input
                type="text"
                required
                value={newMed.strength}
                onChange={(e) => setNewMed({ ...newMed, strength: e.target.value })}
                placeholder="e.g. 500mg"
                className={`w-full border p-2.5 rounded-xl text-sm transition ${
                  scanResult ? 'border-amber-400 bg-amber-50/20' : 'border-slate-300'
                }`}
              />
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-bold text-slate-700">Form</label>
              </div>
              <input
                type="text"
                required
                value={newMed.form}
                onChange={(e) => setNewMed({ ...newMed, form: e.target.value })}
                placeholder="tablet, capsule"
                className="w-full border border-slate-300 p-2.5 rounded-xl text-sm"
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-bold text-slate-700">Daily Times (comma-separated)</label>
              {scanResult && (
                <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">
                  Verify
                </span>
              )}
            </div>
            <input
              type="text"
              required
              value={newMed.times}
              onChange={(e) => setNewMed({ ...newMed, times: e.target.value })}
              placeholder="09:00, 21:00"
              className={`w-full border p-2.5 rounded-xl text-sm transition ${
                scanResult ? 'border-amber-400 bg-amber-50/20' : 'border-slate-300'
              }`}
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Instructions</label>
            <input
              type="text"
              value={newMed.instructions}
              onChange={(e) => setNewMed({ ...newMed, instructions: e.target.value })}
              placeholder="Take after meals with water"
              className="w-full border border-slate-300 p-2.5 rounded-xl text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Pill Count</label>
              <input
                type="number"
                value={newMed.pillCount}
                onChange={(e) => setNewMed({ ...newMed, pillCount: Number(e.target.value) })}
                className="w-full border border-slate-300 p-2.5 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Refill Threshold</label>
              <input
                type="number"
                value={newMed.refillThreshold}
                onChange={(e) => setNewMed({ ...newMed, refillThreshold: Number(e.target.value) })}
                className="w-full border border-slate-300 p-2.5 rounded-xl text-sm"
              />
            </div>
          </div>

          {/* Confidence Verification Checkbox for Scans (Requirement #15) */}
          {scanResult && (
            <label className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-300 rounded-xl cursor-pointer select-none">
              <input
                type="checkbox"
                checked={confirmedConfidence}
                onChange={(e) => setConfirmedConfidence(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-amber-400 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-xs text-amber-950 font-semibold leading-relaxed">
                I have physically verified the medication name, strength, dosage, and schedule against the prescription container label.
              </span>
            </label>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={Boolean(scanResult && !confirmedConfidence)}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl shadow-xs transition"
            >
              Save & Generate 7-Day Schedule
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
