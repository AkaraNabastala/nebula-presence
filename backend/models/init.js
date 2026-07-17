const { pool } = require('../config/database');
const bcrypt = require('bcryptjs');

const initSystem = async () => {
    try {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            
            // Tabel Master
            await client.query(`CREATE TABLE IF NOT EXISTS admins (id SERIAL PRIMARY KEY, username VARCHAR(50) UNIQUE NOT NULL, password VARCHAR(255) NOT NULL, nama_admin VARCHAR(100), role VARCHAR(20) DEFAULT 'SuperAdmin');`);
            // Tambahkan kolom role jika belum ada (untuk migrasi database yang sudah ada)
            try { await client.query(`ALTER TABLE admins ADD COLUMN role VARCHAR(20) DEFAULT 'SuperAdmin';`); } catch (e) {}
            await client.query(`CREATE TABLE IF NOT EXISTS app_settings (setting_key VARCHAR(50) PRIMARY KEY, setting_value TEXT);`);
            await client.query(`CREATE TABLE IF NOT EXISTS divisions (id SERIAL PRIMARY KEY, name VARCHAR(100) UNIQUE NOT NULL, supervisor_name VARCHAR(100));`);
            await client.query(`CREATE TABLE IF NOT EXISTS members (id SERIAL PRIMARY KEY, identity_number VARCHAR(50) UNIQUE, full_name VARCHAR(100) NOT NULL, role VARCHAR(50) DEFAULT 'member', division_id INTEGER REFERENCES divisions(id) ON DELETE SET NULL, rfid_code VARCHAR(50), photo TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`);
            // Tambahkan kolom identity_reference jika belum ada
            try { await client.query(`ALTER TABLE members ADD COLUMN identity_reference VARCHAR(50);`); } catch (e) {}
            
            // Tabel Absensi
            await client.query(`CREATE TABLE IF NOT EXISTS attendance_logs (id SERIAL PRIMARY KEY, member_id INTEGER REFERENCES members(id) ON DELETE CASCADE, scan_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP, status VARCHAR(20) NOT NULL, date_log DATE DEFAULT CURRENT_DATE, scan_out TIME);`);
            // Tambahkan kolom scan_out jika belum ada (untuk migrasi database lama)
            try { await client.query(`ALTER TABLE attendance_logs ADD COLUMN scan_out TIME;`); } catch (e) {}
            // Tambahkan kolom shift_name jika belum ada
            try { await client.query(`ALTER TABLE attendance_logs ADD COLUMN shift_name VARCHAR(50);`); } catch (e) {}
            // Migrasi dari student_id ke member_id (untuk database lama)
            try { await client.query(`ALTER TABLE attendance_logs RENAME COLUMN student_id TO member_id;`); } catch (e) {}
            
            // Tabel Devices (ZKTeco)
            await client.query(`CREATE TABLE IF NOT EXISTS devices (id SERIAL PRIMARY KEY, name VARCHAR(100), ip_address VARCHAR(50) UNIQUE, port INTEGER DEFAULT 4370, status VARCHAR(20) DEFAULT 'offline');`);
            
            // Tabel Lisensi (POWERFULL UPDATE: license_hash)
            await client.query(`CREATE TABLE IF NOT EXISTS used_licenses (id SERIAL PRIMARY KEY, license_hash TEXT UNIQUE NOT NULL, used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`);

            // Tabel Holidays (Hari Libur)
            await client.query(`CREATE TABLE IF NOT EXISTS holidays (id SERIAL PRIMARY KEY, holiday_date DATE UNIQUE NOT NULL, description VARCHAR(255));`);

            // Tabel Audit Logs (Log Aktivitas)
            await client.query(`CREATE TABLE IF NOT EXISTS audit_logs (id SERIAL PRIMARY KEY, admin_name VARCHAR(100), action VARCHAR(255), target VARCHAR(255), timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`);

            // Index untuk mempercepat pencarian absensi harian dan rekap bulanan (Permasalahan 6)
            try {
                await client.query(`CREATE INDEX IF NOT EXISTS idx_attendance_logs_lookup ON attendance_logs (member_id, date_log);`);
            } catch (e) {}

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