// --- 1. GLOBAL ERROR HANDLING ---
process.on('uncaughtException', (err) => {
    console.error('🔥 CRITICAL ERROR (UNCAUGHT)!', err);
});
process.on('unhandledRejection', (reason) => {
    console.error('⚠️ UNHANDLED REJECTION!', reason);
});

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
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

// Path frontend static untuk mode .exe standalone
const FRONTEND_BUILD_PATH = path.resolve(__dirname, '../dist');

// --- 2. MIDDLEWARE KEAMANAN & OPTIMASI ---
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false
}));
app.use(compression());
app.use(cookieParser());

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
app.use('/api', (req, res, next) => {
    if (req.path === '/scan') {
        console.log('[SCAN DEBUG] Masuk ke middleware API');
    }
    next();
}, strictGuard, (req, res, next) => {
    if (req.path === '/scan') {
        console.log('[SCAN DEBUG] Lolos strictGuard');
    }
    next();
}, apiRoutes);
app.use(express.static(FRONTEND_BUILD_PATH));

// Fallback Route untuk Single Page Application
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

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('❌ Server Error:', err.message);
    if (res.headersSent) return next(err);
    res.status(500).json({
        status: 'error',
        message: "Terjadi kesalahan internal pada server."
    });
});

// --- 5. ZKTECO REAL-TIME LISTENER ---
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
                    try { if (zkInstance) await zkInstance.disconnect(); } catch (e) { }
                    setTimeout(connectAndListen, 15000);
                }
            };
            connectAndListen();
        }
    } catch (e) {
        console.error("Gagal memulai listener Mesin Kehadiran", e);
    }
};

// --- 6. BOOTSTRAP (START SERVER) ---
const startServer = async () => {
    console.log(`=================================================`);
    console.log(`🛠️  Starting SI-MAS Standalone Server...`);

    try {
        // Setup database lokal & index
        await initSystem();

        // Backup SQLite otomatis setiap hari pukul 02.00 waktu lokal.
        // File dibatasi hanya untuk user OS saat ini dan backup otomatis lama dipangkas.
        const fs = require('fs');
        const { createConsistentBackup, userDataPath } = require('./config/database');
        const backupDir = path.join(userDataPath, 'backups');
        fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
        cron.schedule('0 2 * * *', async () => {
            const stamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupPath = path.join(backupDir, `auto-backup-${stamp}.sqlite`);
            try {
                await createConsistentBackup(backupPath);
                try { fs.chmodSync(backupPath, 0o600); } catch {}
                const backups = fs.readdirSync(backupDir)
                    .filter(name => /^auto-backup-.*\.sqlite$/.test(name))
                    .sort()
                    .reverse();
                for (const oldName of backups.slice(14)) {
                    try { fs.unlinkSync(path.join(backupDir, oldName)); } catch (cleanupErr) {
                        console.warn('[Database Backup] Gagal menghapus backup lama:', cleanupErr.message);
                    }
                }
                console.log('[Database Backup] Backup otomatis berhasil:', path.basename(backupPath));
            } catch (backupErr) {
                console.error('[Database Backup] Backup otomatis gagal:', backupErr.message);
            }
        });

        // Start Cron Jobs (Auto Alfa)
        initAutoAlfa();

        // BUNGKUS DENGAN HTTP SERVER UNTUK SOCKET.IO
        const server = http.createServer(app);
        const io = new Server(server, { cors: corsOptions });
        app.set('io', io);

        // 1. Start Telegram Bot Auto-Linking & Background Worker
        const { startTelegramPolling } = require('./utils/notificationService');
        startTelegramPolling(pool, io);

        // 2. Start Cloud Sync Worker (Local-First Offline-Ready Engine)
        const { startCloudSyncWorker } = require('./services/cloudSyncService');
        startCloudSyncWorker(pool, io);

        // 3. Start ZKTeco Real-Time Listener & Penarikan Otomatis
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

        server.listen(PORT, '0.0.0.0', () => {
            const assignedPort = server.address().port;
            console.log(`🚀 Server Running on Port: ${assignedPort}`);
            console.log(`🌍 URL: http://localhost:${assignedPort}`);
            console.log(`📁 Frontend Path: ${FRONTEND_BUILD_PATH}`);
            console.log(`=================================================`);

            // Buka browser otomatis di Windows
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
