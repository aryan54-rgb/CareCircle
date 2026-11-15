import React from 'react';
import { Camera, AlertTriangle } from 'lucide-react';
import type { ScanPrescriptionResponse } from '../../../types';

interface ScanModalProps {
  scanLoading: boolean;
  scanError: string;
  scanResult: ScanPrescriptionResponse | null;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSwitchToManual: () => void;
  onConfirmDraft: () => void;
  onClose: () => void;
}

export const ScanModal: React.FC<ScanModalProps> = ({
  scanLoading,
  scanError,
  scanResult,
  onFileUpload,
  onSwitchToManual,
  onConfirmDraft,
  onClose,
}) => {
  return (
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
            onChange={onFileUpload}
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
              onClick={onSwitchToManual}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2.5 px-3 rounded-xl transition shadow-xs"
            >
              Enter Medication Details Manually
            </button>
          </div>
        )}

        {scanResult && scanResult.extracted && (
          <div className="space-y-3 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="flex items-center gap-1.5 text-xs text-amber-700 font-bold">
              <AlertTriangle size={14} />
              <span>Review AI extractions against physical container</span>
            </div>
            <div className="text-sm">
              <strong>Extracted:</strong> {scanResult.extracted.name} ({scanResult.extracted.strength})
            </div>
            <div className="text-xs text-slate-600">
              Times: {scanResult.extracted.times?.join(', ')} • {scanResult.extracted.instructions}
            </div>
            <button
              onClick={onConfirmDraft}
              className="w-full bg-emerald-600 text-white font-bold text-sm py-2 rounded-xl mt-2"
            >
              Review & Confirm Draft Form
            </button>
          </div>
        )}

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
