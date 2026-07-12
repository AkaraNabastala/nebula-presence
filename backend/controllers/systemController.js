const { pool, rootPath } = require('../config/database');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { addAuditLog } = require('../utils/logger');

// Ambil kredensial dari environment agar aman dan dinamis
const dbName = process.env.DB_NAME || 'absensi_nabastala'; 
const dbUser = process.env.DB_USER || 'postgres';
const dbPass = process.env.DB_PASSWORD || 'darksky';
const dbPort = process.env.DB_PORT || '5432';

exports.restoreDatabase = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: "File backup tidak terdeteksi." });
        }
        
        const filePath = req.file.path;
        console.log("📥 Menjalankan Restore Database dari:", filePath);

        const restoreCmd = process.platform === 'win32'
            ? `"${path.join(rootPath || '', 'pgsql', 'bin', 'psql.exe')}" -h 127.0.0.1 -U ${dbUser} -p ${dbPort} -d ${dbName} -f "${filePath}"`
            : `psql -h 127.0.0.1 -U ${dbUser} -p ${dbPort} -d ${dbName} -f "${filePath}"`;

        const env = { ...process.env, PGPASSWORD: dbPass }; 

        exec(restoreCmd, { env }, (error, stdout, stderr) => {
            // Hapus file sementara setelah diproses
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

            if (error) {
                console.error("❌ Restore Error:", stderr || error.message);
                return res.status(500).json({ 
                    success: false, 
                    message: "Gagal memproses file SQL ke database.",
                    error: stderr 
                });
            }
            
            console.log("✅ Database berhasil dipulihkan!");
            addAuditLog(req.user?.nama_admin || 'Admin', 'Restore Database', 'Sistem');
            res.json({ success: true, message: "Restore berhasil! Data telah diperbarui." });
        });

    } catch (e) {
        console.error("🔥 Critical Restore Error:", e.message);
        res.status(500).json({ success: false, message: "Terjadi kesalahan sistem internal." });
    }
};

exports.backupDatabase = async (req, res) => {
    try {
        console.log("📤 Menyiapkan Backup Database...");

        const backupCmd = process.platform === 'win32'
            ? `"${path.join(rootPath || '', 'pgsql', 'bin', 'pg_dump.exe')}" -h 127.0.0.1 -U ${dbUser} -p ${dbPort} -d ${dbName}`
            : `pg_dump -h 127.0.0.1 -U ${dbUser} -p ${dbPort} -d ${dbName}`;

        const env = { ...process.env, PGPASSWORD: dbPass };

        exec(backupCmd, { env, maxBuffer: 1024 * 1024 * 50 }, (error, stdout, stderr) => {
            if (error) {
                console.error("Backup Exec Error:", stderr || error.message);
                return res.status(500).json({ message: "Gagal membuat backup" });
            }

            const fileName = `backup_${dbName}_${new Date().toISOString().split('T')[0]}.sql`;
            res.setHeader('Content-Type', 'application/sql');
            res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
            
            addAuditLog(req.user?.nama_admin || 'Admin', 'Backup Database', fileName);
            res.send(stdout);
        });

    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, message: "Gagal Backup Database" });
    }
};

exports.uploadPhotoBase64 = async (req, res) => {
    // nipd/nisn sekarang dianggap sebagai identity_number
    const { nipd, foto } = req.body; 
    if(!nipd || !foto) return res.status(400).json({message: "Data tidak lengkap"});

    try {
        // PERBAIKAN: Gunakan tabel members dan identity_number
        await pool.query('UPDATE members SET photo=$1 WHERE identity_number=$2', [foto, nipd]);
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