import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import ManualAttendance from '../pages/ManualAttendance/index.jsx';
import axios from 'axios';

// Mock axios completely
vi.mock('axios', () => {
  const mockApi = {
    get: vi.fn().mockImplementation((url) => {
      if (url === '/settings') return Promise.resolve({ data: { timezone: 'Asia/Jakarta' } });
      if (url === '/divisions') return Promise.resolve({ data: [{ id: 1, nama_kelas: 'XII IPA 1' }] });
      return Promise.resolve({ data: [] });
    }),
    post: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() }
    }
  };
  return {
    default: {
      create: vi.fn(() => mockApi),
      defaults: { withCredentials: true }
    }
  };
});

// Mock matchMedia (sering dibutuhkan library UI)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

describe('Halaman Absensi Manual UI', () => {
  it('berhasil me-render halaman absensi manual', async () => {
    render(
      <BrowserRouter>
        <ManualAttendance />
      </BrowserRouter>
    );
    
    // Tunggu sampai komponen selesai mounting dan memanggil API (mock)
    expect(await screen.findByText(/Log Kehadiran/i)).toBeInTheDocument();
    
    // Pastikan input pencarian muncul
    expect(screen.getByPlaceholderText(/Cari Nama/i)).toBeInTheDocument();
  });
});
