import { createContext } from 'react';
import type { UserProfile } from '../types';

export interface CreateCircleData {
  name: string;
  elderName: string;
  caretakerName: string;
  caretakerEmail: string;
  caretakerPasscode: string;
}

export interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  loading: boolean;
  login: (email: string, passcode: string) => Promise<void>;
  join: (inviteCode: string, name: string, email: string, passcode: string) => Promise<void>;
  createCircle: (data: CreateCircleData) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
