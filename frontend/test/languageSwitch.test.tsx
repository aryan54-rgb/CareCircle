import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { ElderView } from '../src/features/elder/ElderView';
import * as client from '../src/api/client';
import * as auth from '../src/context/useAuth';

vi.mock('../src/context/useAuth');
vi.mock('../src/api/client');

describe('Elder Multilingual Language Switcher (Task 6 Frontend Tests)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(auth, 'useAuth').mockReturnValue({
      user: {
        memberId: 'elder-1',
        circleId: 'circle-1',
        name: 'Grandmother Shanti',
        email: 'shanti@demo.com',
        role: 'ELDER',
      },
      token: 'mock-token',
      loading: false,
      login: vi.fn(),
      join: vi.fn(),
      createCircle: vi.fn(),
      logout: vi.fn(),
      refreshProfile: vi.fn(),
    });

    vi.spyOn(client, 'apiRequest').mockImplementation(async (path: string) => {
      if (path === '/doses') {
        return {
          heroDose: {
            id: '2026-11-15T09:00:00.000Z#med-1',
            circleId: 'circle-1',
            medId: 'med-1',
            medName: 'Amlodipine 5mg',
            dueAt: '2026-11-15T09:00:00.000Z',
            status: 'REMINDED',
            createdAt: '2026-11-15T00:00:00.000Z',
            updatedAt: '2026-11-15T00:00:00.000Z',
          },
          doses: [],
        } as any;
      }
      return { appointments: [], suggestions: [] } as any;
    });
  });

  it('switches dynamically between English, Hindi, and Marathi', async () => {
    render(<ElderView />);

    // Default language is English
    await waitFor(() => {
      expect(screen.getByText('✓ I TOOK IT')).toBeDefined();
      expect(screen.getByText('Read Aloud')).toBeDefined();
    });

    // 1. Switch to Hindi (हिंदी)
    const hindiButton = screen.getByText('हिंदी');
    fireEvent.click(hindiButton);

    expect(screen.getByText('✓ मैंने ले ली')).toBeDefined();
    expect(screen.getByText('छोड़ें')).toBeDefined();
    expect(screen.getByText('सुनें (बोलकर बताएं)')).toBeDefined();

    // 2. Switch to Marathi (मराठी)
    const marathiButton = screen.getByText('मराठी');
    fireEvent.click(marathiButton);

    expect(screen.getByText('✓ मी घेतले')).toBeDefined();
    expect(screen.getByText('वगळा')).toBeDefined();
    expect(screen.getByText('ऐका (मोठ्याने वाचा)')).toBeDefined();

    // 3. Switch back to English
    const englishButton = screen.getByText('English');
    fireEvent.click(englishButton);

    expect(screen.getByText('✓ I TOOK IT')).toBeDefined();
    expect(screen.getByText('Skip Dose')).toBeDefined();
    expect(screen.getByText('Read Aloud')).toBeDefined();
  });
});
