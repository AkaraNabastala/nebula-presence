// --- 1. GLOBAL ERROR HANDLING ---
process.on('uncaughtException', (err) => {
    console.error('🔥 CRITICAL ERROR (UNCAUGHT)!', err);
});
process.on('unhandledRejection', (reason) => {
    console.error('⚠️ UNHANDLED REJECTION!', reason);
});

const express = require('express');
const http = require('http'); // <-- TAMBAHAN: http module
const { Server } = require('socket.io'); // <-- TAMBAHAN: socket.io
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser'); // <-- TAMBAHAN 1: Cookie Parser
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const authGuard = require('./middleware/authGuard');
const strictGuard = require('./middleware/strictGuard');
const initSystem = require('./models/init');
const initAutoAlfa = require('./cron/autoAlfa');
const apiRoutes = require('./routes/apiRoutes');
const cron = require('node-cron');
const { pool } = require('./config/database');
const ZKLib = require('node-zklib');

const app = express();
const PORT = process.env.PORT || 6990;

// --- PERBAIKAN PATH (PENTING UNTUK EXE STANDALONE) ---
// Menggunakan process.cwd() agar aplikasi mencari folder dist di mana file .exe dijalankan
const FRONTEND_BUILD_PATH = path.join(process.cwd(), 'dist');

// --- 2. MIDDLEWARE KEAMANAN & OPTIMASI ---
app.use(helmet({ 
    contentSecurityPolicy: false, 
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false, // Nonaktifkan isolasi opener agar socket lancar di IP LAN
    crossOriginResourcePolicy: false // Nonaktifkan isolasi resource
}));
app.use(compression()); 
app.use(cookieParser()); // <-- TAMBAHAN 2: Gunakan Cookie Parser untuk baca token

// --- 3. KONFIGURASI CORS ---
const corsOptions = {
    origin: function (origin, callback) {
        if (!origin || 
            origin.startsWith('http://localhost') || 
            origin.startsWith('http://127.0.0.1') || 
            origin.startsWith('http://192.168.') || 
            origin.startsWith('http://10.') || 
            origin.startsWith('http://172.')) {
            return callback(null, true);
        }
        callback(new Error('Akses Ditolak oleh CORS Policy'));
    },
    credentials: true,
    exposedHeaders: ['Content-Disposition'] 
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '70mb' }));
app.use(express.urlencoded({ limit: '70mb', extended: true }));

// --- 4. ROUTING ---

// A. API Routes
app.use('/api', strictGuard, apiRoutes); 

// B. File Statis
app.use(express.static(FRONTEND_BUILD_PATH));

// C. FALLBACK ROUTE
app.use((req, res, next) => {
    if (req.url.startsWith('/api')) {
        return next();
    }

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

// --- 6. ZKTECO REAL-TIME LISTENER ---
const { processScanCore } = require('./controllers/attendanceController');

const startZKTecoRealtime = async (io) => {
    try {
        const devices = await pool.query("SELECT * FROM devices WHERE status != 'disabled'");
        for (let dev of devices.rows) {
            const connectAndListen = async () => {
                let zkInstance = null;
                try {
                    zkInstance = new ZKLib(dev.ip_address, dev.port || 4370, 5200, 5000);
                    await zkInstance.createSocket();
                    console.log(`[Mesin Kehadiran] Siaga Real-Time di mesin: ${dev.name} (${dev.ip_address}:${dev.port || 4370})`);
                    
                    await zkInstance.getRealTimeLogs(async (log) => {
                        if (log && (log.userId || log.deviceUserId)) {
                            const uid = log.userId || log.deviceUserId;
                            console.log(`[Mesin Kehadiran] Sidik jari terdeteksi: UID ${uid}`);
                            const res = await processScanCore(uid, null, io);
                            if (!res.success) {
                                console.log(`[Mesin Kehadiran] Gagal diproses: ${res.message}`);
                                if (io) io.emit('scan_error', { message: res.message });
                            }
                        }
                    });
                } catch (err) {
                    console.log(`[Mesin Kehadiran] Gagal/Terputus dari ${dev.name} (${err.message || err}), mencoba lagi dalam 15 detik...`);
                    try { if (zkInstance) await zkInstance.disconnect(); } catch (e) {}
                    setTimeout(connectAndListen, 15000);
                }
            };
            connectAndListen();
        }
    } catch (e) {
        console.error("Gagal memulai listener Mesin Kehadiran", e);
    }
};

// --- 7. BOOTSTRAP (START SERVER) ---
const startServer = async () => {
    console.log(`=================================================`);
    console.log(`🛠️  Starting SI-MAS Standalone Server...`);
    
    try {
        // Setup database
        await initSystem();

        // Start Cron Jobs
        initAutoAlfa();

        // BUNGKUS DENGAN HTTP SERVER UNTUK SOCKET.IO
        const server = http.createServer(app);
        
        // SETUP SOCKET.IO
        const io = new Server(server, { cors: corsOptions });
        app.set('io', io); // Simpan io di express instance agar bisa diakses di controller

        // START ZKTECO REAL-TIME & AUTO-SYNC DATA MESIN SAAT SERVER MENYALA
        startZKTecoRealtime(io);
        const { performAutoSyncDevices } = require('./controllers/deviceController');
        setTimeout(() => {
            performAutoSyncDevices(io);
        }, 3000);

        io.on('connection', (socket) => {
            console.log(`📡 Socket terhubung: ${socket.id}`);
            socket.on('disconnect', () => {
                console.log(`🔌 Socket terputus: ${socket.id}`);
            });
        });

        // Menggunakan PORT tetap (6990) agar sinkron dengan Vite proxy di frontend
        // Menggunakan 0.0.0.0 agar dapat diakses oleh komputer lain di jaringan LAN
        server.listen(PORT, '0.0.0.0', () => {
            const assignedPort = server.address().port;
            console.log(`🚀 Server Running on Port: ${assignedPort}`);
            console.log(`🌍 URL: http://localhost:${assignedPort}`);
            console.log(`📁 Frontend Path: ${FRONTEND_BUILD_PATH}`);
            console.log(`=================================================`);
            
            // Buka browser otomatis di Windows dengan sedikit delay agar Socket.io siap sepenuhnya (Permasalahan 1)
            const { exec } = require('child_process');
            setTimeout(() => {
                exec(`start http://localhost:${assignedPort}`);
            }, 1500);
        });

        server.keepAliveTimeout = 60000;
    } catch (error) {
        console.error("❌ Gagal memulai server:", error.message);
        process.exit(1);
    }
};


if (process.env.NODE_ENV !== 'test') {
    startServer();
}

module.exports = app;