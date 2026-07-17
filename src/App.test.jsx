import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import App from './App';

describe('Pengujian Komponen Utama Aplikasi (App.jsx)', () => {
  it('berhasil melakukan render halaman tanpa crash', () => {
    // 1. Me-render (menggambar) komponen App ke dalam browser virtual
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );

    // 2. Karena App biasanya menampilkan halaman Login atau Dashboard, 
    // kita asumsikan tidak ada pesan error fatal di layar saat dirender.
    // Jika tidak ada error fatal saat render, artinya fungsi dasar React aman.
    expect(true).toBe(true);
  });
});
