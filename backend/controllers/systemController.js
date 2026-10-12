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
        console.log("📥 Menjalankan Restore Database (SQLite) dari:", filePath);

        const os = require('os');
        const dbPath = path.join(os.homedir(), '.nebula-presence-app', 'database.sqlite');

        // Overwrite existing database file
        fs.copyFileSync(filePath, dbPath);

        // Hapus file sementara setelah diproses
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            
        console.log("✅ Database berhasil dipulihkan! Minta pengguna merestart aplikasi.");
        addAuditLog(req.user?.nama_admin || 'Admin', 'Restore Database', 'Sistem');
        res.json({ success: true, message: "Restore berhasil! HARAP TUTUP DAN BUKA KEMBALI APLIKASI (Restart) agar database dapat terbaca dengan normal." });

    } catch (e) {
        console.error("🔥 Critical Restore Error:", e.message);
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ success: false, message: "Terjadi kesalahan sistem internal." });
    }
};

exports.backupDatabase = async (req, res) => {
    try {
        console.log("📤 Menyiapkan Backup Database (SQLite)...");
        
        const os = require('os');
        const dbPath = path.join(os.homedir(), '.nebula-presence-app', 'database.sqlite');
        
        if (!fs.existsSync(dbPath)) {
            return res.status(404).json({ success: false, message: "Database tidak ditemukan." });
        }

        const fileName = `backup_db_${new Date().toISOString().split('T')[0]}.sqlite`;
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
        
        addAuditLog(req.user?.nama_admin || 'Admin', 'Backup Database', fileName);
        
        const fileStream = fs.createReadStream(dbPath);
        fileStream.pipe(res);

    } catch (e) {
        console.error("Backup Exec Error:", e.message);
        res.status(500).json({ success: false, message: "Gagal Backup Database" });
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