const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');
const os = require('os');
require('dotenv').config();

// Path Frontend (Hasil Build React)
const frontendPath = path.join(__dirname, '../../src/dist');

// Folder Penyimpanan Data (Logs & Uploads) di Home Linux
const userDataPath = path.join(os.homedir(), '.si-mas-app');
const logDir = path.join(userDataPath, 'logs');
const uploadDir = path.join(userDataPath, 'uploads');

[userDataPath, logDir, uploadDir].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || '127.0.0.1',
    database: process.env.DB_NAME || 'db_absensimas',
    password: process.env.DB_PASSWORD || 'darksky',
    port: process.env.DB_PORT || 5432,
    connectionTimeoutMillis: 10000,
});

module.exports = { pool, logDir, frontendPath, userDataPath, uploadDir };