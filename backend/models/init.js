const { pool } = require('../config/database');
const bcrypt = require('bcryptjs');

const initSystem = async () => {
    try {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 1. Tabel Master Admin & App Settings
            await client.query(`CREATE TABLE IF NOT EXISTS admins (id SERIAL PRIMARY KEY, username VARCHAR(50) UNIQUE NOT NULL, password VARCHAR(255) NOT NULL, nama_admin VARCHAR(100), role VARCHAR(20) DEFAULT 'SuperAdmin');`);
            try { await client.query(`ALTER TABLE admins ADD COLUMN role VARCHAR(20) DEFAULT 'SuperAdmin';`); } catch (e) { }
            await client.query(`CREATE TABLE IF NOT EXISTS app_settings (setting_key VARCHAR(50) PRIMARY KEY, setting_value TEXT);`);

            // 2. Tabel Divisi / Kelas
            await client.query(`CREATE TABLE IF NOT EXISTS divisions (id SERIAL PRIMARY KEY, name VARCHAR(100) UNIQUE NOT NULL, supervisor_name VARCHAR(100), allow_pulang_awal INTEGER DEFAULT 1, allow_lembur INTEGER DEFAULT 1);`);
            try { await client.query(`ALTER TABLE divisions ADD COLUMN allow_pulang_awal INTEGER DEFAULT 1;`); } catch (e) { }
            try { await client.query(`ALTER TABLE divisions ADD COLUMN allow_lembur INTEGER DEFAULT 1;`); } catch (e) { }
            try { await client.query(`ALTER TABLE divisions ADD COLUMN sync_id TEXT;`); } catch (e) { }
            try { await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_divisions_sync_id ON divisions (sync_id);`); } catch (e) { }
            try { await client.query(`ALTER TABLE divisions ADD COLUMN is_synced INTEGER DEFAULT 0;`); } catch (e) { }

            // 3. Tabel Members (Siswa / Guru / Karyawan)
            await client.query(`CREATE TABLE IF NOT EXISTS members (id SERIAL PRIMARY KEY, identity_number VARCHAR(50) UNIQUE, full_name VARCHAR(100) NOT NULL, role VARCHAR(50) DEFAULT 'member', division_id INTEGER REFERENCES divisions(id) ON DELETE SET NULL, rfid_code VARCHAR(50), photo TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`);
            try { await client.query(`ALTER TABLE members ADD COLUMN identity_reference VARCHAR(50);`); } catch (e) { }
            try { await client.query(`ALTER TABLE members ADD COLUMN face_descriptor TEXT;`); } catch (e) { }
            try { await client.query(`ALTER TABLE members ADD COLUMN phone_number VARCHAR(50);`); } catch (e) { }
            try { await client.query(`ALTER TABLE members ADD COLUMN telegram_chat_id VARCHAR(50);`); } catch (e) { }
            try { await client.query(`ALTER TABLE members ADD COLUMN sync_id TEXT;`); } catch (e) { }
            try { await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_members_sync_id ON members (sync_id);`); } catch (e) { }
            try { await client.query(`ALTER TABLE members ADD COLUMN is_synced INTEGER DEFAULT 0;`); } catch (e) { }
            try { await client.query(`ALTER TABLE members ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;`); } catch (e) { }

            // 4. Tabel Absensi (Local-First Offline-Ready)
            await client.query(`CREATE TABLE IF NOT EXISTS attendance_logs (id SERIAL PRIMARY KEY, member_id INTEGER REFERENCES members(id) ON DELETE CASCADE, scan_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP, status VARCHAR(20) NOT NULL, date_log DATE DEFAULT CURRENT_DATE, scan_out TIME);`);
            try { await client.query(`ALTER TABLE attendance_logs ADD COLUMN scan_out TIME;`); } catch (e) { }
            try { await client.query(`ALTER TABLE attendance_logs ADD COLUMN shift_name VARCHAR(50);`); } catch (e) { }
            try { await client.query(`ALTER TABLE attendance_logs RENAME COLUMN student_id TO member_id;`); } catch (e) { }
            try { await client.query(`ALTER TABLE attendance_logs ADD COLUMN sync_id TEXT;`); } catch (e) { }
            try { await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_logs_sync_id ON attendance_logs (sync_id);`); } catch (e) { }
            try { await client.query(`ALTER TABLE attendance_logs ADD COLUMN is_synced INTEGER DEFAULT 0;`); } catch (e) { }
            try { await client.query(`ALTER TABLE attendance_logs ADD COLUMN synced_at TIMESTAMP;`); } catch (e) { }
            try { await client.query(`ALTER TABLE attendance_logs ADD COLUMN source VARCHAR(20) DEFAULT 'local';`); } catch (e) { }

            // 5. Tabel Mesin Absensi (ZKTeco)
            await client.query(`CREATE TABLE IF NOT EXISTS devices (id SERIAL PRIMARY KEY, name VARCHAR(100), ip_address VARCHAR(50) UNIQUE, port INTEGER DEFAULT 4370, status VARCHAR(20) DEFAULT 'offline');`);

            // 6. Tabel Lisensi (Anti-Piracy Hash)
            await client.query(`CREATE TABLE IF NOT EXISTS used_licenses (id SERIAL PRIMARY KEY, license_hash TEXT UNIQUE NOT NULL, used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`);

            // 7. Tabel Hari Libur
            await client.query(`CREATE TABLE IF NOT EXISTS holidays (id SERIAL PRIMARY KEY, holiday_date DATE UNIQUE NOT NULL, description VARCHAR(255));`);

            // 8. Tabel Log Aktivitas (Audit Trail)
            await client.query(`CREATE TABLE IF NOT EXISTS audit_logs (id SERIAL PRIMARY KEY, admin_name VARCHAR(100), action VARCHAR(255), target VARCHAR(255), timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`);

            // 9. Tabel Outbox Notifikasi (Offline-Resilient Telegram Queue)
            await client.query(`CREATE TABLE IF NOT EXISTS notification_queue (
                id SERIAL PRIMARY KEY,
                chat_id VARCHAR(50) NOT NULL,
                message_text TEXT NOT NULL,
                status VARCHAR(20) DEFAULT 'PENDING',
                attempts INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                sent_at TIMESTAMP,
                last_error TEXT
            );`);

            // Index Performa untuk Pencarian Cepat & Sinkronisasi Cloud
            try { await client.query(`CREATE INDEX IF NOT EXISTS idx_attendance_logs_lookup ON attendance_logs (member_id, date_log);`); } catch (e) { }
            try { await client.query(`CREATE INDEX IF NOT EXISTS idx_attendance_logs_sync ON attendance_logs (is_synced, date_log);`); } catch (e) { }
            try { await client.query(`CREATE INDEX IF NOT EXISTS idx_attendance_logs_sync_id ON attendance_logs (sync_id);`); } catch (e) { }
            try { await client.query(`CREATE INDEX IF NOT EXISTS idx_notif_queue_status ON notification_queue (status, attempts);`); } catch (e) { }

            // Setting Default Sinkronisasi Cloud
            const defaultCloudSettings = [
                ['cloud_sync_active', '0'],
                ['cloud_sync_url', ''],
                ['cloud_sync_token', ''],
                ['cloud_sync_interval', '30'],
                ['cloud_sync_last_status', 'idle'],
                ['cloud_sync_last_time', '']
            ];
            for (const [key, val] of defaultCloudSettings) {
                try {
                    await client.query(
                        `INSERT INTO app_settings (setting_key, setting_value) VALUES ($1, $2) ON CONFLICT (setting_key) DO NOTHING;`,
                        [key, val]
                    );
                } catch (e) { }
            }

            // Backfill sync_id untuk data riwayat yang belum memiliki UUID
            const crypto = require('crypto');
            try {
                const logsWithoutSync = await client.query("SELECT id FROM attendance_logs WHERE sync_id IS NULL OR sync_id = '' LIMIT 500");
                for (const row of logsWithoutSync.rows) {
                    await client.query("UPDATE attendance_logs SET sync_id = $1 WHERE id = $2", [crypto.randomUUID(), row.id]);
                }
            } catch (e) { }

            try {
                const membersWithoutSync = await client.query("SELECT id FROM members WHERE sync_id IS NULL OR sync_id = '' LIMIT 500");
                for (const row of membersWithoutSync.rows) {
                    await client.query("UPDATE members SET sync_id = $1 WHERE id = $2", [crypto.randomUUID(), row.id]);
                }
            } catch (e) { }

            await client.query('COMMIT');
            console.log("✅ Struktur Database Siap & Local-First Columns Aktif.");
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
