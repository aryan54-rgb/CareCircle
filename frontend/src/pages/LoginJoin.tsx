import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Heart } from 'lucide-react';

export const LoginJoin: React.FC = () => {
  const { login, join, createCircle } = useAuth();
  const [mode, setMode] = useState<'login' | 'join' | 'create'>('login');

  // Login form
  const [email, setEmail] = useState('');
  const [passcode, setPasscode] = useState('');

  // Join form
  const [inviteCode, setInviteCode] = useState('');
  const [joinName, setJoinName] = useState('');
  const [joinEmail, setJoinEmail] = useState('');
  const [joinPasscode, setJoinPasscode] = useState('');

  // Create form
  const [circleName, setCircleName] = useState('');
  const [elderName, setElderName] = useState('');
  const [caretakerName, setCaretakerName] = useState('');
  const [caretakerEmail, setCaretakerEmail] = useState('');
  const [caretakerPasscode, setCaretakerPasscode] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    try {
      await login(email, passcode);
    } catch (err: any) {
      setErrorMsg(err.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (demoEmail: string, demoPass: string) => {
    setLoading(true);
    setErrorMsg('');
    try {
      await login(demoEmail, demoPass);
    } catch (err: any) {
      setErrorMsg(err.message || 'Quick login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    try {
      await join(inviteCode, joinName, joinEmail, joinPasscode);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to join circle. Check your invite code.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    try {
      await createCircle({
        name: circleName,
        elderName,
        caretakerName,
        caretakerEmail,
        caretakerPasscode,
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create care circle.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-slate-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 text-white shadow-lg mb-4">
          <Heart size={36} fill="currentColor" />
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">CareCircle</h1>
        <p className="mt-2 text-sm font-semibold text-slate-600">
          Elderly Care & Smart Medication Management
        </p>
      </div>

      {/* Demo Quick Login Shortcut Buttons */}
      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-amber-100/70 border border-amber-300 rounded-2xl p-4 shadow-sm mb-4">
          <span className="text-xs font-black uppercase text-amber-900 tracking-wider block mb-2">
            ⚡ Quick Demo Logins
          </span>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => handleQuickLogin('shanti@demo.com', 'shanti123')}
              className="bg-white hover:bg-amber-50 text-amber-900 border border-amber-300 p-2 rounded-xl text-xs font-bold text-center shadow-xs active:scale-95 transition"
            >
              👵 Elder<br /><span className="text-[10px] text-slate-500 font-normal">Shanti</span>
            </button>
            <button
              onClick={() => handleQuickLogin('rajesh@demo.com', 'rajesh123')}
              className="bg-white hover:bg-amber-50 text-amber-900 border border-amber-300 p-2 rounded-xl text-xs font-bold text-center shadow-xs active:scale-95 transition"
            >
              👨‍⚕️ Caretaker<br /><span className="text-[10px] text-slate-500 font-normal">Son Rajesh</span>
            </button>
            <button
              onClick={() => handleQuickLogin('priya@demo.com', 'priya123')}
              className="bg-white hover:bg-amber-50 text-amber-900 border border-amber-300 p-2 rounded-xl text-xs font-bold text-center shadow-xs active:scale-95 transition"
            >
              👩 Family<br /><span className="text-[10px] text-slate-500 font-normal">Daughter Priya</span>
            </button>
          </div>
        </div>

        {/* Card Form */}
        <div className="bg-white py-8 px-6 shadow-xl rounded-3xl border border-slate-200">
          {/* Mode Switcher */}
          <div className="flex border-b border-slate-200 pb-3 mb-6 gap-4 text-sm font-bold justify-center">
            <button
              onClick={() => setMode('login')}
              className={`pb-1 transition ${
                mode === 'login'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setMode('join')}
              className={`pb-1 transition ${
                mode === 'join'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Join with Code
            </button>
            <button
              onClick={() => setMode('create')}
              className={`pb-1 transition ${
                mode === 'create'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              New Circle
            </button>
          </div>

          {errorMsg && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-sm font-bold">
              {errorMsg}
            </div>
          )}

          {/* SIGN IN FORM */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full border p-3 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Passcode</label>
                <input
                  type="password"
                  required
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="••••••••"
                  className="w-full border p-3 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl shadow-md transition disabled:opacity-50"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          )}

          {/* JOIN FORM */}
          {mode === 'join' && (
            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Invite Code</label>
                <input
                  type="text"
                  required
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="e.g. 9PFZ4U"
                  className="w-full border p-3 rounded-xl text-sm uppercase tracking-widest font-black focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Your Full Name</label>
                <input
                  type="text"
                  required
                  value={joinName}
                  onChange={(e) => setJoinName(e.target.value)}
                  placeholder="e.g. Shanti Devi"
                  className="w-full border p-3 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Your Email</label>
                <input
                  type="email"
                  required
                  value={joinEmail}
                  onChange={(e) => setJoinEmail(e.target.value)}
                  placeholder="shanti@example.com"
                  className="w-full border p-3 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Create Passcode</label>
                <input
                  type="password"
                  required
                  value={joinPasscode}
                  onChange={(e) => setJoinPasscode(e.target.value)}
                  placeholder="At least 4 characters"
                  className="w-full border p-3 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl shadow-md transition disabled:opacity-50"
              >
                {loading ? 'Joining...' : 'Join Care Circle'}
              </button>
            </form>
          )}

          {/* CREATE CIRCLE FORM */}
          {mode === 'create' && (
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Circle Name</label>
                <input
                  type="text"
                  required
                  value={circleName}
                  onChange={(e) => setCircleName(e.target.value)}
                  placeholder="e.g. Kalyan Family Circle"
                  className="w-full border p-3 rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Elder's Name</label>
                <input
                  type="text"
                  required
                  value={elderName}
                  onChange={(e) => setElderName(e.target.value)}
                  placeholder="e.g. Grandmother Shanti"
                  className="w-full border p-3 rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Caretaker Name (Owner)</label>
                <input
                  type="text"
                  required
                  value={caretakerName}
                  onChange={(e) => setCaretakerName(e.target.value)}
                  placeholder="e.g. Son Rajesh"
                  className="w-full border p-3 rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Caretaker Email</label>
                <input
                  type="email"
                  required
                  value={caretakerEmail}
                  onChange={(e) => setCaretakerEmail(e.target.value)}
                  placeholder="rajesh@example.com"
                  className="w-full border p-3 rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Caretaker Passcode</label>
                <input
                  type="password"
                  required
                  value={caretakerPasscode}
                  onChange={(e) => setCaretakerPasscode(e.target.value)}
                  placeholder="••••••••"
                  className="w-full border p-3 rounded-xl text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl shadow-md transition disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create Care Circle'}
              </button>
            </form>
          )}
        </div>
      </div>

      <footer className="mt-8 text-center text-xs text-slate-500">
        CareCircle helps organise routines. It is not medical advice. Always follow your doctor's instructions.
      </footer>
    </div>
  );
};
