import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiRequest } from '../api/client';

export type Role = 'ELDER' | 'CARETAKER' | 'FAMILY';

export interface UserProfile {
  memberId: string;
  circleId: string;
  name: string;
  email: string;
  role: Role;
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  loading: boolean;
  login: (email: string, passcode: string) => Promise<void>;
  join: (inviteCode: string, name: string, email: string, passcode: string) => Promise<void>;
  createCircle: (data: {
    name: string;
    elderName: string;
    caretakerName: string;
    caretakerEmail: string;
    caretakerPasscode: string;
  }) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('carecircle_token'));
  const [loading, setLoading] = useState<boolean>(true);

  const refreshProfile = async () => {
    try {
      const data = await apiRequest<{ memberId: string; circleId: string; name: string; email: string; role: Role }>(
        '/me'
      );
      setUser(data);
    } catch {
      localStorage.removeItem('carecircle_token');
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      refreshProfile();
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = async (email: string, passcode: string) => {
    const res = await apiRequest<{ token: string; member: UserProfile }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, passcode }),
    });
    localStorage.setItem('carecircle_token', res.token);
    setToken(res.token);
    setUser(res.member);
  };

  const join = async (inviteCode: string, name: string, email: string, passcode: string) => {
    const res = await apiRequest<{ token: string; member: UserProfile }>('/auth/join', {
      method: 'POST',
      body: JSON.stringify({ inviteCode, name, email, passcode }),
    });
    localStorage.setItem('carecircle_token', res.token);
    setToken(res.token);
    setUser(res.member);
  };

  const createCircle = async (data: any) => {
    const res = await apiRequest<{ token: string; member: UserProfile }>('/auth/circles', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    localStorage.setItem('carecircle_token', res.token);
    setToken(res.token);
    setUser(res.member);
  };

  const logout = () => {
    localStorage.removeItem('carecircle_token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        join,
        createCircle,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
