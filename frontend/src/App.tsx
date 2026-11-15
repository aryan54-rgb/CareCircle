import React from 'react';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/useAuth';
import { LoginJoin } from './pages/LoginJoin';
import { ElderView } from './features/elder/ElderView';
import { CaretakerView } from './features/caretaker/CaretakerView';

const MainApp: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-bold text-slate-600">Loading CareCircle...</p>
      </div>
    );
  }

  if (!user) {
    return <LoginJoin />;
  }

  // Role-based distinct views (Section 8 of SPEC.md)
  if (user.role === 'ELDER') {
    return <ElderView />;
  }

  return <CaretakerView />;
};

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
