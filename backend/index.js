// --- 1. GLOBAL ERROR HANDLING ---
process.on('uncaughtException', (err) => {
    console.error('🔥 CRITICAL ERROR (UNCAUGHT)!', err);
});
process.on('unhandledRejection', (reason) => {
    console.error('⚠️ UNHANDLED REJECTION!', reason);
});

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const compression = require('compression');
require('dotenv').config();

// --- IMPORTS ---
const apiRoutes = require('./routes/apiRoutes');
const initSystem = require('./models/init');
const strictGuard = require('./middleware/strictGuard'); 

const app = express();
const PORT = process.env.PORT || 6990;

// Tentukan path frontend secara eksplisit
// Sesuaikan '../../src/dist' dengan lokasi folder 'dist' hasil build React Anda
const FRONTEND_BUILD_PATH = path.join(__dirname, 'dist');

// --- 2. MIDDLEWARE KEAMANAN & OPTIMASI ---
app.use(helmet({ 
    contentSecurityPolicy: false, 
    crossOriginEmbedderPolicy: false 
}));
app.use(compression()); 

// --- 3. KONFIGURASI CORS ---
const corsOptions = {
    origin: function (origin, callback) {
        if (!origin || 
            origin.startsWith('http://localhost') || 
            origin.startsWith('http://127.0.0.1') || 
            origin.startsWith('http://192.168.')) {
            return callback(null, true);
        }
        callback(new Error('Akses Ditolak oleh CORS Policy'));
    },
    credentials: true,
    // TAMBAHKAN BARIS DI BAWAH INI:
    exposedHeaders: ['Content-Disposition'] 
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '70mb' }));
app.use(express.urlencoded({ limit: '70mb', extended: true }));

// --- 4. ROUTING ---

// A. API Routes (Harus didaftarkan pertama)
app.use('/api', strictGuard, apiRoutes); 

// B. File Statis (CSS, JS, Gambar dari React)
app.use(express.static(FRONTEND_BUILD_PATH));

// C. FALLBACK ROUTE (Solusi Anti-Error Path)
// Kita gunakan middleware tanpa string path agar tidak memicu 'PathError'
app.use((req, res, next) => {
    // Jika request diawali /api tapi tidak ditemukan rutenya, biarkan lanjut ke error handling
    if (req.url.startsWith('/api')) {
        return next();
    }

    // Untuk semua request halaman (browser), kirimkan index.html (React Router)
    const indexPath = path.join(FRONTEND_BUILD_PATH, 'index.html');
    
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send(`
            <div style="text-align: center; padding-top: 50px; font-family: sans-serif;">
                <h2>Frontend Build Not Found</h2>
                <p>Path: ${FRONTEND_BUILD_PATH}</p>
                <hr>
                <p>Silakan jalankan <b>npm run build</b> di folder frontend agar file tersedia.</p>
            </div>
        `);
    }
});

// --- 5. GLOBAL ERROR HANDLING ---
app.use((err, req, res, next) => {
    console.error('❌ Server Error:', err.message);
    if (res.headersSent) return next(err);
    res.status(500).json({ 
        status: 'error',
        message: "Terjadi kesalahan internal pada server." 
    });
});

// --- 6. BOOTSTRAP (START SERVER) ---
const startServer = async () => {
    console.log(`=================================================`);
    console.log(`🛠️  Starting SI-MAS Standalone Server...`);
    
    try {
        // Inisialisasi Database (Memastikan tabel sudah ada)
        await initSystem();
        
        const server = app.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 Server Running on Port: ${PORT}`);
            console.log(`🌍 URL: http://localhost:${PORT}`);
            console.log(`📁 Frontend: ${FRONTEND_BUILD_PATH}`);
            console.log(`=================================================`);
        });

        server.keepAliveTimeout = 60000;
    } catch (error) {
        console.error("❌ Gagal memulai server:", error.message);
        process.exit(1);
    }
};

startServer();