import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../api/client';
import type { UserProfile } from '../types';
import type { CreateCircleData } from './authContextDef';
import { AuthContext } from './authContextDef';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('carecircle_token'));
  const [loading, setLoading] = useState<boolean>(() => Boolean(localStorage.getItem('carecircle_token')));

  const refreshProfile = useCallback(async () => {
    try {
      const data = await apiRequest<UserProfile>('/me');
      setUser(data);
    } catch {
      localStorage.removeItem('carecircle_token');
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    async function loadUser() {
      try {
        const data = await apiRequest<UserProfile>('/me');
        if (!ignore) {
          setUser(data);
        }
      } catch {
        if (!ignore) {
          localStorage.removeItem('carecircle_token');
          setToken(null);
          setUser(null);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    if (token) {
      void loadUser();
    }
    return () => {
      ignore = true;
    };
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

  const createCircle = async (data: CreateCircleData) => {
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
