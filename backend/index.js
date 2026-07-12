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
require('dotenv').config();

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
    crossOriginEmbedderPolicy: false 
}));
app.use(compression()); 
app.use(cookieParser()); // <-- TAMBAHAN 2: Gunakan Cookie Parser untuk baca token

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

// --- 6. BACKGROUND JOBS (ZKTeco Sync) ---
cron.schedule('*/5 * * * *', async () => {
    try {
        const devices = await pool.query("SELECT * FROM devices WHERE status != 'disabled'");
        for (let dev of devices.rows) {
            try {
                const zkInstance = new ZKLib(dev.ip_address, dev.port, 5200, 5000);
                await zkInstance.createSocket();
                await zkInstance.connect();
                const logs = await zkInstance.getAttendances();
                
                // Di dunia nyata, filter log berdasarkan waktu terakhir sync.
                // Simulasi memproses data
                if (logs && logs.data && logs.data.length > 0) {
                    console.log(`[ZKTeco] Menarik ${logs.data.length} log dari ${dev.name}`);
                }
                await zkInstance.disconnect();
            } catch (err) {
                console.log(`[ZKTeco] Gagal sync mesin ${dev.name} (${dev.ip_address})`);
            }
        }
    } catch (e) {
        // error query
    }
});

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

        io.on('connection', (socket) => {
            console.log(`📡 Socket terhubung: ${socket.id}`);
            socket.on('disconnect', () => {
                console.log(`🔌 Socket terputus: ${socket.id}`);
            });
        });

        server.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 Server Running on Port: ${PORT}`);
            console.log(`🌍 URL: http://localhost:${PORT}`);
            console.log(`📁 Frontend Path: ${FRONTEND_BUILD_PATH}`);
            console.log(`=================================================`);
        });

        server.keepAliveTimeout = 60000;
    } catch (error) {
        console.error("❌ Gagal memulai server:", error.message);
        process.exit(1);
    }
};

startServer();