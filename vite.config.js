import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Sistem Absensi Pintar',
        short_name: 'SI-MAS',
        description: 'Aplikasi Absensi Karyawan dan Siswa',
        theme_color: '#ffffff'
      }
    })
  ],
  resolve: {
    alias: {
      stream: path.resolve(__dirname, 'src/shims/empty.js'),
      fs: path.resolve(__dirname, 'src/shims/empty.js'),
      crypto: path.resolve(__dirname, 'src/shims/empty.js'),
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-utils': ['axios', 'xlsx-js-style', 'jszip'],
          'vendor-ui': ['lucide-react', 'recharts', 'sweetalert2']
        }
      }
    },
    chunkSizeWarningLimit: 1000,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.js'
  }
})
