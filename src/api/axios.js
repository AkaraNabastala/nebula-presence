import axios from 'axios';

const API_BASE_URL = 'http://localhost:6990/api';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    }
});

// --- SURGICAL INTERCEPTOR (Penyaring Otomatis) ---
api.interceptors.response.use(
  (response) => response, // Jika sukses, lewatkan saja
  (error) => {
    // Jika server kirim 403 (Lisensi Mati)
    if (error.response && error.response.status === 403) {
      // Kirim "Sinyal Rahasia" ke App.jsx tanpa perlu refresh halaman
      window.dispatchEvent(new Event("licenseExpired"));
    }
    return Promise.reject(error);
  }
);

export default api;