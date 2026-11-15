import React from 'react';
import { RefreshCw, RotateCcw } from 'lucide-react';
import type { CircleDetail, DeepHealthCheck } from '../../../types';

interface SettingsTabProps {
  circle: CircleDetail | null;
  isCaretaker: boolean;
  deepHealth: DeepHealthCheck | null;
  healthLoading: boolean;
  inviteCodeResult: string;
  onFetchDeepHealth: () => void;
  onResetDemo: () => void;
  onGenerateInvite: (role: 'ELDER' | 'CARETAKER' | 'FAMILY') => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  circle,
  isCaretaker,
  deepHealth,
  healthLoading,
  inviteCodeResult,
  onFetchDeepHealth,
  onResetDemo,
  onGenerateInvite,
}) => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-slate-900">Circle Settings & Members</h2>
        <p className="text-slate-500 text-sm">
          Manage members, generate invite codes, and configure escalation timing.
        </p>
      </div>

      {/* Deep Health & Cloud Diagnostics Panel */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-lg font-black text-slate-900">Platform Health & Cloud Diagnostics</h3>
            <p className="text-xs text-slate-500">
              Live verification of DynamoDB single-table, Amazon SES, and Bedrock Converse API.
            </p>
          </div>
          <button
            onClick={onFetchDeepHealth}
            disabled={healthLoading}
            className="self-start sm:self-auto flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold px-3.5 py-2 rounded-xl transition disabled:opacity-50"
          >
            <RefreshCw size={14} className={healthLoading ? 'animate-spin' : ''} />
            <span>{healthLoading ? 'Running...' : 'Run Diagnostics'}</span>
          </button>
        </div>

        {deepHealth && deepHealth.components ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            {/* DynamoDB card */}
            <div className="p-4 rounded-2xl border bg-slate-50 border-slate-200">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-extrabold text-slate-700">Amazon DynamoDB</span>
                <span
                  className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                    deepHealth.components.dynamodb?.status === 'ok'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {deepHealth.components.dynamodb?.status === 'ok' ? 'ONLINE' : 'ERROR'}
                </span>
              </div>
              <div className="text-xs text-slate-500 space-y-0.5 mt-2">
                <div>
                  Table:{' '}
                  <span className="font-semibold text-slate-700">
                    {deepHealth.components.dynamodb?.table || 'carecircle-dev-table'}
                  </span>
                </div>
                <div>
                  Latency:{' '}
                  <span className="font-semibold text-slate-700">
                    {deepHealth.components.dynamodb?.latencyMs ?? 0}ms
                  </span>
                </div>
              </div>
            </div>

            {/* Amazon SES card */}
            <div className="p-4 rounded-2xl border bg-slate-50 border-slate-200">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-extrabold text-slate-700">Amazon SES v2</span>
                <span
                  className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                    deepHealth.components.ses?.status === 'ok'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {deepHealth.components.ses?.status === 'ok' ? 'ACTIVE' : 'DEGRADED'}
                </span>
              </div>
              <div className="text-xs text-slate-500 space-y-0.5 mt-2">
                <div>
                  Sender:{' '}
                  <span className="font-semibold text-slate-700 truncate block">
                    {deepHealth.components.ses?.fromAddress || 'sesFrom'}
                  </span>
                </div>
                <div>
                  Mode:{' '}
                  <span className="font-semibold text-slate-700">
                    {deepHealth.components.ses?.productionAccess ? 'Production' : 'Sandbox'}
                  </span>
                </div>
                <div>
                  Identity:{' '}
                  <span className="font-semibold text-slate-700">
                    {deepHealth.components.ses?.identityVerified ? 'Verified' : 'Unverified'}
                  </span>
                </div>
              </div>
            </div>

            {/* Amazon Bedrock card */}
            <div className="p-4 rounded-2xl border bg-slate-50 border-slate-200">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-extrabold text-slate-700">Amazon Bedrock</span>
                <span
                  className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                    deepHealth.components.bedrock?.status === 'ok'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {deepHealth.components.bedrock?.status === 'ok' ? 'ONLINE' : 'UNAVAILABLE'}
                </span>
              </div>
              <div className="text-xs text-slate-500 space-y-0.5 mt-2">
                <div>
                  Model:{' '}
                  <span className="font-semibold text-slate-700">
                    {deepHealth.components.bedrock?.modelId?.split(':')?.[0]}
                  </span>
                </div>
                <div>
                  Region:{' '}
                  <span className="font-semibold text-slate-700">
                    {deepHealth.components.bedrock?.region}
                  </span>
                </div>
                <div className="truncate">
                  Status:{' '}
                  <span className="font-semibold text-slate-700">
                    {deepHealth.components.bedrock?.message || 'Ready'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-xs text-slate-400 py-2">
            Click &quot;Run Diagnostics&quot; to perform live health queries on cloud infrastructure.
          </div>
        )}
      </div>

      {/* Reset Demo Card */}
      {isCaretaker && circle?.settings?.demoMode && (
        <div className="bg-white p-6 rounded-3xl border border-red-100 shadow-sm">
          <h3 className="text-lg font-black text-red-900 mb-1">Demo Environment Controls</h3>
          <p className="text-xs text-slate-500 mb-4">
            Restore Kalyan Family Circle to its original seed state (schedules, grandmother, caretaker, and 7-day adherence history).
          </p>
          <button
            onClick={onResetDemo}
            className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold px-4 py-2.5 rounded-xl transition flex items-center gap-2"
          >
            <RotateCcw size={14} />
            <span>Reset Demo Circle to Seed State</span>
          </button>
        </div>
      )}

      {isCaretaker && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-2">Generate New Invite Code</h3>
          <p className="text-sm text-slate-500 mb-4">
            Passcode-based access for family members, doctors, or caretakers.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => onGenerateInvite('ELDER')}
              className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs px-4 py-2.5 rounded-xl"
            >
              + Invite Elder
            </button>
            <button
              onClick={() => onGenerateInvite('CARETAKER')}
              className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs px-4 py-2.5 rounded-xl"
            >
              + Invite Caretaker
            </button>
            <button
              onClick={() => onGenerateInvite('FAMILY')}
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
          {circle?.members?.map((m) => (
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
  );
};
