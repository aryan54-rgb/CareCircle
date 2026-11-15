import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { ElderView } from '../src/features/elder/ElderView';
import * as client from '../src/api/client';
import * as auth from '../src/context/useAuth';

vi.mock('../src/context/useAuth');
vi.mock('../src/api/client');

describe('Elder Hero Dose Card (Task 6 Frontend Tests)', () => {
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
  });

  it('renders the prominent hero dose card with medication name and touch targets', async () => {
    vi.spyOn(client, 'apiRequest').mockImplementation(async (path: string) => {
      if (path === '/doses') {
        return {
          heroDose: {
            id: '2026-11-15T09:00:00.000Z#med-1',
            circleId: 'circle-1',
            medId: 'med-1',
            medName: 'Metformin 500mg',
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

    render(<ElderView />);

    // Wait for the hero dose card to be populated
    await waitFor(() => {
      expect(screen.getByText('Metformin 500mg')).toBeDefined();
    });

    // Check that large touch action buttons exist
    expect(screen.getByText('✓ I TOOK IT')).toBeDefined();
    expect(screen.getByText('Skip Dose')).toBeDefined();
    expect(screen.getByText('Read Aloud')).toBeDefined();
  });

  it('renders the celebratory card when all doses for the day are complete', async () => {
    vi.spyOn(client, 'apiRequest').mockImplementation(async (path: string) => {
      if (path === '/doses') {
        return {
          heroDose: null,
          doses: [],
        } as any;
      }
      return { appointments: [], suggestions: [] } as any;
    });

    render(<ElderView />);

    await waitFor(() => {
      const messages = screen.getAllByText('All finished for today! Enjoy your day.');
      expect(messages.length).toBeGreaterThan(0);
    });
  });
});
