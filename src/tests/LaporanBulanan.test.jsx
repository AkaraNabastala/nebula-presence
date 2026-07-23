import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import LaporanBulanan from '../pages/Laporan/LaporanBulanan.jsx';
import axios from 'axios';

// Mock axios completely
vi.mock('axios', () => {
  const mockApi = {
    get: vi.fn().mockImplementation((url) => {
      if (url === '/settings') return Promise.resolve({ data: { timezone: 'Asia/Jakarta', labels: { label_pengguna: 'Siswa', label_kelompok: 'Kelas' } } });
      if (url === '/divisions') return Promise.resolve({ data: [{ id: 1, nama_kelas: 'XII IPA 1' }] });
      if (url === '/attendance/report') return Promise.resolve({ data: [] });
      if (url === '/members') return Promise.resolve({ data: [] });
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

// Mock matchMedia
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

describe('Halaman Laporan Bulanan UI', () => {
  it('berhasil me-render halaman laporan bulanan beserta elemen toolbar dan legenda', async () => {
    render(
      <BrowserRouter>
        <LaporanBulanan />
      </BrowserRouter>
    );

    // Pastikan judul laporan muncul
    expect(await screen.findByText(/Laporan Bulanan/i)).toBeInTheDocument();

    // Pastikan legenda Keterangan (H, T, S, I, L, A) muncul
    expect(screen.getByText(/Hadir/i)).toBeInTheDocument();
    expect(screen.getByText(/Lembur/i)).toBeInTheDocument();
  });
});
