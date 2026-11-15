import React from 'react';

export interface SuggestFormData {
  title: string;
  instructions: string;
  times: string;
}

interface SuggestModalProps {
  newSuggestion: SuggestFormData;
  setNewSuggestion: React.Dispatch<React.SetStateAction<SuggestFormData>>;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}

export const SuggestModal: React.FC<SuggestModalProps> = ({
  newSuggestion,
  setNewSuggestion,
  onSubmit,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl">
        <h3 className="text-2xl font-black text-slate-900 mb-2">Propose Suggestion</h3>
        <p className="text-sm text-slate-500 mb-4">
          Submit a medication or appointment request for elder approval.
        </p>
        <form onSubmit={onSubmit} className="space-y-4">
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
              onClick={onClose}
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
  );
};
