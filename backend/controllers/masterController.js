const { pool, rootPath, logDir } = require('../config/database');
const path = require('path');
const { exec } = require('child_process');

// --- SETTINGS ---
exports.getSettings = async (req, res) => {
    try {
        const r = await pool.query('SELECT * FROM app_settings');
        const s = {};
        r.rows.forEach(x => s[x.setting_key] = x.setting_value);
        res.json(s);
    } catch (e) { res.status(500).json({}); }
};

exports.updateSettings = async (req, res) => {
    try {
        for (const [k, v] of Object.entries(req.body)) {
            await pool.query(`INSERT INTO app_settings (setting_key, setting_value) VALUES ($1, $2) ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value`, [k, v]);
        }
        res.json({ success: true });
    } catch (e) { res.status(500).json({ message: "Gagal menyimpan" }); }
};

// --- STUDENTS / MEMBERS ---
exports.getAllStudents = async (req, res) => { 
    try { 
        const r = await pool.query('SELECT * FROM students ORDER BY id DESC'); 
        res.json(r.rows || []); 
    } catch (e) { res.json([]); } 
};

// FITUR AUTO-CREATE DIVISI SAAT TAMBAH/IMPORT MEMBER
exports.createStudent = async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN'); // Mulai Transaksi

        // 1. Ambil data
        const { nisn, nipd, nama_lengkap, kode_rfid, foto } = req.body;
        const kelasInput = req.body.kelas ? req.body.kelas.trim() : '';

        // 2. Cek & Buat Divisi Otomatis jika belum ada
        if (kelasInput) {
            const checkDiv = await client.query('SELECT id FROM classes WHERE nama_kelas = $1', [kelasInput]);
            if (checkDiv.rows.length === 0) {
                // Buat Divisi Baru
                await client.query('INSERT INTO classes (nama_kelas) VALUES ($1)', [kelasInput]);
            }
        }

        // 3. Simpan Member
        await client.query(
            'INSERT INTO students (nisn, nipd, nama_lengkap, kelas, kode_rfid, foto) VALUES ($1, $2, $3, $4, $5, $6)',
            [nisn?.trim(), nipd?.trim(), nama_lengkap, kelasInput, kode_rfid?.trim(), foto]
        );

        await client.query('COMMIT'); // Simpan Permanen
        res.json({ success: true });

    } catch (e) {
        await client.query('ROLLBACK'); // Batalkan jika error
        console.error("Create Member Error:", e);
        res.status(500).json({ message: e.message || "Gagal menyimpan data" });
    } finally {
        client.release();
    }
};

exports.updateStudent = async (req, res) => { 
    try { 
        await pool.query('UPDATE students SET nisn=$1, nipd=$2, nama_lengkap=$3, kelas=$4, kode_rfid=$5, foto=$6 WHERE id=$7', 
        [req.body.nisn?.trim(), req.body.nipd?.trim(), req.body.nama_lengkap, req.body.kelas, req.body.kode_rfid?.trim(), req.body.foto, req.params.id]); 
        res.json({ success: true }); 
    } catch (e) { res.status(500).json({ message: "Gagal update" }); } 
};

// FIX TOMBOL HAPUS
exports.deleteStudent = async (req, res) => { 
    try { 
        // Pastikan ID valid
        const id = req.params.id;
        if (!id) return res.status(400).json({ message: "ID tidak valid" });

        await pool.query('DELETE FROM students WHERE id=$1', [id]); 
        res.json({ success: true }); 
    } catch (e) { 
        console.error("Delete Error:", e);
        res.status(500).json({ message: "Gagal hapus data" }); 
    } 
};

// --- CLASSES / DIVISIONS ---
exports.getAllClasses = async (req, res) => { 
    try { 
        const q = `SELECT c.*, (SELECT COUNT(*)::int FROM students s WHERE s.kelas = c.nama_kelas) as jumlah_siswa FROM classes c ORDER BY c.nama_kelas ASC`;
        const r = await pool.query(q);
        res.json(r.rows || []); 
    } catch (e) { 
        console.error("Query Error:", e.message);
        res.status(500).json({ message: "Gagal ambil data" }); 
    } 
};

exports.createClass = async (req, res) => { try { await pool.query('INSERT INTO classes (nama_kelas, wali_kelas) VALUES ($1, $2)', [req.body.nama_kelas, req.body.wali_kelas]); res.json({ success: true }); } catch (e) { res.status(500).json({ message: "Gagal tambah" }); } };
exports.updateClass = async (req, res) => { try { await pool.query('UPDATE classes SET nama_kelas=$1, wali_kelas=$2 WHERE id=$3', [req.body.nama_kelas, req.body.wali_kelas, req.params.id]); res.json({ success: true }); } catch (e) { res.status(500).json({ message: "Gagal update" }); } };
exports.deleteClass = async (req, res) => { try { await pool.query('DELETE FROM classes WHERE id=$1', [req.params.id]); res.json({ success: true }); } catch (e) { res.status(500).json({ message: "Gagal hapus" }); } };

// --- BACKUP ---
// --- BACKUP ---
exports.downloadBackup = (req, res) => {
    req.setTimeout(30000); 
    const fileName = `backup_db_${new Date().toISOString().split('T')[0]}.sql`;
    // PERBAIKAN: Ganti -p 5432 menjadi -p 5439 agar sesuai dengan port baru
    const backupCmd = `pg_dump -h 127.0.0.1 -U postgres -p 5439 db_absensimas`;
    const env = { ...process.env, PGPASSWORD: 'darksky' }; 
    exec(backupCmd, { env, maxBuffer: 1024 * 1024 * 100 }, (error, stdout, stderr) => {
        if (error) {
            console.error("PG_DUMP ERROR:", stderr);
            return res.status(500).send("Gagal membuat backup: " + stderr);
        }

        res.setHeader('Content-Type', 'application/sql');
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
        res.status(200).send(stdout);
    });
};