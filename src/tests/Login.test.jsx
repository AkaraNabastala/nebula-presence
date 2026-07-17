import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import Login from '../pages/Login/index.jsx';

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

describe('Halaman Login UI', () => {
  it('berhasil me-render form login', () => {
    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );
    
    // Pastikan tombol login muncul
    expect(screen.getByRole('button', { name: /Masuk Dashboard/i })).toBeInTheDocument();
    
    // Pastikan input username dan password muncul
    expect(screen.getByPlaceholderText(/Username/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Password/i)).toBeInTheDocument();
  });

  it('bisa mengetik di kolom username dan password', () => {
    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );
    
    const userinput = screen.getByPlaceholderText(/Username/i);
    const passinput = screen.getByPlaceholderText(/Password/i);

    fireEvent.change(userinput, { target: { value: 'admin_test' } });
    fireEvent.change(passinput, { target: { value: 'rahasia123' } });

    expect(userinput.value).toBe('admin_test');
    expect(passinput.value).toBe('rahasia123');
  });
});
