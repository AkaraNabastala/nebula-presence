const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');
const os = require('os');
require('dotenv').config();

// Path Frontend (Hasil Build React)
const frontendPath = path.join(__dirname, '../dist');

// Folder Penyimpanan Data (Logs & Uploads) di Home user
const userDataPath = path.join(os.homedir(), '.si-mas-app');
const logDir = path.join(userDataPath, 'logs');
const uploadDir = path.join(userDataPath, 'uploads');

[userDataPath, logDir, uploadDir].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Konfigurasi Pool Database
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    connectionTimeoutMillis: 10000,
});

// Cek Koneksi Database
pool.on('connect', () => {
    console.log('Database connected successfully to:', process.env.DB_NAME);
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

module.exports = { pool, logDir, frontendPath, userDataPath, uploadDir };