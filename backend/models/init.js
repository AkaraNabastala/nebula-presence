const { pool } = require('../config/database');
const bcrypt = require('bcryptjs');

const initSystem = async () => {
    try {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            
            // Tabel Master
            await client.query(`CREATE TABLE IF NOT EXISTS admins (id SERIAL PRIMARY KEY, username VARCHAR(50) UNIQUE NOT NULL, password VARCHAR(255) NOT NULL, nama_admin VARCHAR(100));`);
            await client.query(`CREATE TABLE IF NOT EXISTS app_settings (setting_key VARCHAR(50) PRIMARY KEY, setting_value TEXT);`);
            await client.query(`CREATE TABLE IF NOT EXISTS classes (id SERIAL PRIMARY KEY, nama_kelas VARCHAR(50) UNIQUE NOT NULL, wali_kelas VARCHAR(100));`);
            await client.query(`CREATE TABLE IF NOT EXISTS students (id SERIAL PRIMARY KEY, nisn VARCHAR(50), nipd VARCHAR(50), nama_lengkap VARCHAR(100) NOT NULL, kelas VARCHAR(50), kode_rfid VARCHAR(50), foto TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE(nisn));`);
            
            // Tabel Absensi
            await client.query(`CREATE TABLE IF NOT EXISTS attendance_logs (id SERIAL PRIMARY KEY, student_id INTEGER REFERENCES students(id) ON DELETE CASCADE, scan_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP, status VARCHAR(20) NOT NULL, date_log DATE DEFAULT CURRENT_DATE, scan_out TIME);`);
            
            // Tabel Lisensi (POWERFULL UPDATE: license_hash)
            await client.query(`CREATE TABLE IF NOT EXISTS used_licenses (id SERIAL PRIMARY KEY, license_hash TEXT UNIQUE NOT NULL, used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`);

            await client.query('COMMIT');
            console.log("✅ Struktur Database Siap.");
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally { client.release(); }

        // Buat Admin Default jika kosong
        const check = await pool.query("SELECT count(*) FROM admins");
        if (parseInt(check.rows[0].count) === 0) {
            const hash = await bcrypt.hash("admin123", 10);
            await pool.query("INSERT INTO admins (username, password, nama_admin) VALUES ($1, $2, $3)", ['administrator', hash, 'Super Admin']);
        }
    } catch (err) {
        console.error("❌ Init System Gagal:", err.message);
    }
};

module.exports = initSystem;