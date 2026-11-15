import React from 'react';
import { Plus } from 'lucide-react';
import type { Suggestion } from '../../../types';

interface SuggestionsTabProps {
  suggestions: Suggestion[];
  isCaretaker: boolean;
  onOpenSuggestModal: () => void;
  onApproveSuggestion: (id: string) => void;
  onDeclineSuggestion: (id: string) => void;
}

export const SuggestionsTab: React.FC<SuggestionsTabProps> = ({
  suggestions,
  isCaretaker,
  onOpenSuggestModal,
  onApproveSuggestion,
  onDeclineSuggestion,
}) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Family Suggestions</h2>
          <p className="text-slate-500 text-sm">
            Collaborative care requests submitted by family members and caretakers.
          </p>
        </div>
        <button
          onClick={onOpenSuggestModal}
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
                {typeof s.payload?.instructions === 'string' && (
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

            {isCaretaker && s.status === 'PROPOSED' && (
              <div className="mt-4 pt-3 border-t flex gap-2">
                <button
                  onClick={() => onApproveSuggestion(s.id)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-lg"
                >
                  Approve & Add to Schedule
                </button>
                <button
                  onClick={() => onDeclineSuggestion(s.id)}
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
  );
};
