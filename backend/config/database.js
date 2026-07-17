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

module.exports = { pool: mockPool, logDir, frontendPath, userDataPath, uploadDir };