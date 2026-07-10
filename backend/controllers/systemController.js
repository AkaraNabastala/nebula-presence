const { pool, rootPath } = require('../config/database');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

exports.restoreDatabase = async (req, res) => {
    try {
        // 1. Cek apakah file benar-benar sampai di server
        if (!req.file) {
            return res.status(400).json({ success: false, message: "File backup tidak terdeteksi." });
        }
        
        const filePath = req.file.path;
        const dbName = 'db_absensimas'; // Pastikan nama DB ini benar
        console.log("📥 Menjalankan Restore Database dari:", filePath);

        // 2. Perintah Restore yang lebih "Powerfull" (Menambahkan host agar password terbaca)
        // Kita gunakan -h 127.0.0.1 untuk memaksa koneksi TCP/IP (menghindari Peer Auth Error)
        const restoreCmd = process.platform === 'win32'
            ? `"${path.join(process.env.rootPath || '', 'pgsql', 'bin', 'psql.exe')}" -h 127.0.0.1 -U postgres -d ${dbName} -f "${filePath}"`
            : `psql -h 127.0.0.1 -U postgres -d ${dbName} -f "${filePath}"`;

        const env = { ...process.env, PGPASSWORD: 'darksky' }; 

        // 3. Eksekusi Perintah
        exec(restoreCmd, { env }, (error, stdout, stderr) => {
            // Hapus file sementara setelah diproses agar tidak nyampah
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
            res.json({ success: true, message: "Restore berhasil! Data telah diperbarui." });
        });

    } catch (e) {
        console.error("🔥 Critical Restore Error:", e.message);
        res.status(500).json({ success: false, message: "Terjadi kesalahan sistem internal." });
    }
};
// --- BACKUP DATABASE (DITAMBAHKAN) ---
exports.backupDatabase = async (req, res) => {
    try {
        console.log("📤 Menyiapkan Backup Database...");

        // Mengikuti logika platform milik Anda (psql -> pg_dump)
        const backupCmd = process.platform === 'win32'
            ? `"${path.join(rootPath, 'pgsql', 'bin', 'pg_dump.exe')}" -U postgres -p 5432 -d db_absensimas`
            : `pg_dump -U postgres -p 5432 -d db_absensimas`;

        const { exec } = require('child_process');
        const env = { ...process.env, PGPASSWORD: 'darksky' }; // Sesuaikan password dengan milik Anda

        // Kita gunakan exec (bukan execSync) agar bisa streaming data besar
        exec(backupCmd, { env, maxBuffer: 1024 * 1024 * 50 }, (error, stdout, stderr) => {
            if (error) {
                console.error("Backup Exec Error:", error);
                return res.status(500).json({ message: "Gagal membuat backup" });
            }

            // Set header agar browser mendownload sebagai file .sql
            const fileName = `backup_db_absensi_${new Date().toISOString().split('T')[0]}.sql`;
            res.setHeader('Content-Type', 'application/sql');
            res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
            
            // Kirim isi database (stdout) ke frontend
            res.send(stdout);
        });

    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, message: "Gagal Backup Database" });
    }
};
// --- UPLOAD FOTO (FROM ZIP) ---
exports.uploadPhotoBase64 = async (req, res) => {
    const { nipd, foto } = req.body; 
    if(!nipd || !foto) return res.status(400).json({message: "Data tidak lengkap"});

    try {
        await pool.query('UPDATE students SET foto=$1 WHERE nipd=$2', [foto, nipd]);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ message: "Gagal simpan foto" });
    }
};