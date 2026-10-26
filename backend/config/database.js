const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const os = require('os');
require('dotenv').config();

const frontendPath = path.join(__dirname, '../../dist');
const userDataPath = path.join(os.homedir(), '.nebula-presence-app');
const logDir = path.join(userDataPath, 'logs');
const uploadDir = path.join(userDataPath, 'uploads');

[userDataPath, logDir, uploadDir].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const isTest = process.env.NODE_ENV === 'test';
const dbFile = isTest ? ':memory:' : path.join(userDataPath, 'database.sqlite');
const pendingRestorePath = path.join(userDataPath, 'database.restore-pending.sqlite');

// Terapkan restore yang sudah divalidasi hanya saat startup, sebelum koneksi DB dibuka.
// Ini menghindari mengganti file database yang sedang aktif dipakai proses berjalan.
if (!isTest && fs.existsSync(pendingRestorePath)) {
    const walPath = `${dbFile}-wal`;
    const shmPath = `${dbFile}-shm`;
    let previousDbPath = null;
    try {
        if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
        if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
        if (fs.existsSync(dbFile)) {
            previousDbPath = `${dbFile}.pre-restore-${Date.now()}`;
            fs.renameSync(dbFile, previousDbPath);
        }
        fs.renameSync(pendingRestorePath, dbFile);
        console.log('✅ Backup database tervalidasi berhasil diterapkan saat startup.');
    } catch (restoreErr) {
        console.error('❌ Gagal menerapkan restore terjadwal:', restoreErr.message);
        if (!fs.existsSync(dbFile) && previousDbPath && fs.existsSync(previousDbPath)) {
            try { fs.renameSync(previousDbPath, dbFile); } catch (rollbackErr) {
                console.error('❌ Rollback database juga gagal:', rollbackErr.message);
            }
        }
        throw restoreErr;
    }
}
const db = new sqlite3.Database(dbFile, (err) => {
    if (err) console.error('Failed to connect to SQLite:', err.message);
    else console.log(`✅ SQLite Local Database Connected: ${dbFile}`);
});

// Magic Wrapper to simulate pg Pool
const mockPool = {
    connect: async () => {
        return {
            query: async (sqlText, params = []) => {
                return mockPool.query(sqlText, params);
            },
            release: () => {}
        };
    },
    query: (sqlText, params = []) => {
        return new Promise((resolve, reject) => {
            let newParams = [];
            let sqliteQuery = sqlText.replace(/\$(\d+)/g, (match, p1) => {
                const idx = parseInt(p1, 10) - 1;
                newParams.push(params[idx]);
                return '?';
            });

            // Translate PostgreSQL syntax to SQLite
            sqliteQuery = sqliteQuery
                .replace(/SERIAL PRIMARY KEY/g, 'INTEGER PRIMARY KEY AUTOINCREMENT')
                .replace(/UNIQUE NOT NULL/gi, 'UNIQUE NOT NULL')
                .replace(/VARCHAR\(\d+\)/gi, 'TEXT')
                .replace(/INTEGER REFERENCES/gi, 'INTEGER REFERENCES')
                .replace(/\bNOW\(\)/gi, "datetime('now', 'localtime')");

            const isSelect = sqliteQuery.trim().toUpperCase().startsWith('SELECT');
            const isReturning = sqliteQuery.toUpperCase().includes('RETURNING');
            const isCount = sqliteQuery.toUpperCase().includes('COUNT(');

            const callback = function(err, rows) {
                if (err) return reject(err);
                
                let resultRows = rows || [];
                
                // Hack to support 'count' alias expected by postgres pg library
                if (isCount && resultRows.length > 0) {
                    const keys = Object.keys(resultRows[0]);
                    const countKey = keys.find(k => k.toLowerCase().includes('count'));
                    if (countKey && countKey !== 'count') {
                        resultRows[0].count = resultRows[0][countKey];
                    }
                }

                resolve({ 
                    rows: resultRows, 
                    rowCount: resultRows.length || this.changes || 0,
                    insertId: this.lastID 
                });
            };

            if (isSelect || isReturning || sqliteQuery.toUpperCase().startsWith('PRAGMA') || sqliteQuery.trim().toUpperCase().startsWith('WITH')) {
                db.all(sqliteQuery, newParams, callback);
            } else {
                db.run(sqliteQuery, newParams, callback);
            }
        });
    },
    on: (event, cb) => {
        if (event === 'connect') cb();
    }
};

// SQLite online backup API menghasilkan snapshot konsisten, termasuk perubahan yang
// masih berada di WAL; menyalin database.sqlite secara langsung bisa kehilangan data.
const createConsistentBackup = (destination) => new Promise((resolve, reject) => {
    db.backup(destination, (err) => {
        if (err) return reject(err);
        resolve(destination);
    });
});

module.exports = { pool: mockPool, logDir, frontendPath, userDataPath, uploadDir, createConsistentBackup };