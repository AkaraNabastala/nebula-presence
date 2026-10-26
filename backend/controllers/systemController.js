const { pool, createConsistentBackup } = require('../config/database');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { addAuditLog } = require('../utils/logger');

// Ambil kredensial dari environment agar aman dan dinamis
const dbName = process.env.DB_NAME || 'absensi_nabastala'; 
const dbUser = process.env.DB_USER || 'postgres';
const dbPass = process.env.DB_PASSWORD || 'darksky';
const dbPort = process.env.DB_PORT || '5432';

exports.restoreDatabase = async (req, res) => {
    let stagedPath = null;
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: "File backup tidak terdeteksi." });
        }

        const os = require('os');
        const sqlite3 = require('sqlite3').verbose();
        const userDataPath = path.join(os.homedir(), '.nebula-presence-app');
        const backupDir = path.join(userDataPath, 'backups');
        const filePath = req.file.path;
        const pendingRestorePath = path.join(userDataPath, 'database.restore-pending.sqlite');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

        const valid = await new Promise((resolve, reject) => {
            let handle;
            try {
                handle = fs.openSync(filePath, 'r');
                const header = Buffer.alloc(16);
                const bytesRead = fs.readSync(handle, header, 0, 16, 0);
                fs.closeSync(handle);
                handle = null;
                if (bytesRead !== 16 || header.toString('utf8') !== 'SQLite format 3\u0000') {
                    return reject(new Error('File bukan database SQLite yang valid.'));
                }
            } catch (err) {
                if (handle !== undefined && handle !== null) {
                    try { fs.closeSync(handle); } catch {}
                }
                return reject(err);
            }

            const checkDb = new sqlite3.Database(filePath, sqlite3.OPEN_READONLY, (openErr) => {
                if (openErr) return reject(openErr);
                checkDb.get('PRAGMA integrity_check', (checkErr, row) => {
                    if (checkErr) {
                        return checkDb.close(() => reject(checkErr));
                    }
                    if (row?.integrity_check !== 'ok') {
                        return checkDb.close(() => reject(new Error('Pemeriksaan integritas database gagal.')));
                    }
                    checkDb.all("SELECT name FROM sqlite_master WHERE type = 'table'", (tableErr, rows) => {
                        if (tableErr) return checkDb.close(() => reject(tableErr));
                        const names = new Set((rows || []).map(item => item.name));
                        const required = ['members', 'attendance_logs', 'app_settings'];
                        const missing = required.filter(name => !names.has(name));
                        checkDb.close((closeErr) => {
                            if (closeErr) return reject(closeErr);
                            if (missing.length) return reject(new Error(`Backup tidak kompatibel; tabel wajib tidak ditemukan: ${missing.join(', ')}.`));
                            resolve(true);
                        });
                    });
                });
            });
        });

        if (!valid) throw new Error('Validasi backup gagal.');
        fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });

        // Simpan snapshot database aktif sebelum mengantrekan restore.
        const preRestorePath = path.join(backupDir, `pre-restore-${timestamp}.sqlite`);
        await createConsistentBackup(preRestorePath);
        try { fs.chmodSync(preRestorePath, 0o600); } catch {}

        stagedPath = path.join(userDataPath, `database.restore-staging-${crypto.randomUUID()}.sqlite`);
        fs.copyFileSync(filePath, stagedPath);
        try { fs.chmodSync(stagedPath, 0o600); } catch {}
        fs.renameSync(stagedPath, pendingRestorePath);
        stagedPath = null;
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

        addAuditLog(req.user?.nama_admin || 'Admin', 'Restore Database Queued', path.basename(pendingRestorePath));
        return res.json({
            success: true,
            message: "Backup valid dan restore sudah dijadwalkan. Tutup lalu buka kembali Nebula Presence agar database diterapkan. Snapshot sebelum restore disimpan di folder backup."
        });
    } catch (e) {
        console.error("🔥 Restore Validation/Queue Error:", e.message);
        if (stagedPath && fs.existsSync(stagedPath)) {
            try { fs.unlinkSync(stagedPath); } catch {}
        }
        if (req.file && fs.existsSync(req.file.path)) {
            try { fs.unlinkSync(req.file.path); } catch {}
        }
        return res.status(400).json({ success: false, message: e.message || "File backup tidak dapat dipulihkan." });
    }
};

exports.backupDatabase = async (req, res) => {
    let tempPath = null;
    const cleanup = () => {
        if (tempPath && fs.existsSync(tempPath)) {
            try { fs.unlinkSync(tempPath); } catch (err) {
                console.warn('[Database Backup] Gagal membersihkan file sementara:', err.message);
            }
        }
    };

    try {
        console.log("📤 Menyiapkan snapshot backup database SQLite...");
        const dbPath = path.join(os.homedir(), '.nebula-presence-app', 'database.sqlite');

        if (!fs.existsSync(dbPath)) {
            return res.status(404).json({ success: false, message: "Database tidak ditemukan." });
        }

        const dateStamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `backup_db_${dateStamp}.sqlite`;
        tempPath = path.join(os.tmpdir(), `nebula-backup-${crypto.randomUUID()}.sqlite`);
        await createConsistentBackup(tempPath);

        addAuditLog(req.user?.nama_admin || 'Admin', 'Backup Database', fileName);
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

        res.on('finish', cleanup);
        res.on('close', cleanup);
        const fileStream = fs.createReadStream(tempPath);
        fileStream.on('error', (err) => {
            console.error('[Database Backup] Gagal membaca snapshot:', err.message);
            cleanup();
            if (!res.headersSent) res.status(500).json({ success: false, message: "Gagal membaca file backup." });
            else res.destroy(err);
        });
        fileStream.pipe(res);
    } catch (e) {
        console.error("Backup Error:", e.message);
        cleanup();
        if (!res.headersSent) res.status(500).json({ success: false, message: "Gagal membuat snapshot backup database." });
    }
};

exports.uploadPhotoBase64 = async (req, res) => {
    // nipd/nisn sekarang dianggap sebagai identity_number
    const { nipd, foto } = req.body; 
    if(!nipd || !foto) return res.status(400).json({message: "Data tidak lengkap"});

    try {
        // PERBAIKAN: Gunakan tabel members dan identity_number
        await pool.query('UPDATE members SET photo=$1, is_synced=0 WHERE identity_number=$2', [foto, nipd]);
        await addAuditLog(req.user?.nama_admin || 'Admin', 'Update Foto Profil', `NIPD/NISN: ${nipd}`);
        res.json({ success: true });
    } catch (e) {
        console.error("Upload Photo Error:", e);
        res.status(500).json({ message: "Gagal menyimpan foto" });
    }
};

exports.getAuditLogs = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 100');
        res.json({ success: true, data: result.rows });
    } catch (e) {
        res.status(500).json({ success: false, message: "Gagal memuat log aktivitas" });
    }
};