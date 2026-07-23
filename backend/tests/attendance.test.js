const request = require('supertest');
const app = require('../index');
const { pool } = require('../config/database');
const jwt = require('jsonwebtoken');
const initSystem = require('../models/init');

describe('Attendance API Tests', () => {
    let token = '';

    beforeAll(async () => {
        await initSystem();
        token = jwt.sign({ id: 1, username: 'administrator', role: 'SuperAdmin' }, process.env.JWT_SECRET || 'Nabastala_Secret_Key_2026_XYZ!', { expiresIn: '1h' });
        
        // Atur jadwal operasional tes (00:00 - 23:59) & mode edukasi agar tes deterministic terlepas dari jam tes dijalankan
        const testJadwal = JSON.stringify([
            { day: 'Minggu', in: '07:00', out: '23:59', active: true },
            { day: 'Senin', in: '07:00', out: '23:59', active: true },
            { day: 'Selasa', in: '07:00', out: '23:59', active: true },
            { day: 'Rabu', in: '07:00', out: '23:59', active: true },
            { day: 'Kamis', in: '07:00', out: '23:59', active: true },
            { day: 'Jumat', in: '07:00', out: '23:59', active: true },
            { day: 'Sabtu', in: '07:00', out: '23:59', active: true }
        ]);
        const testShift = JSON.stringify([
            { name: 'Shift Test', in: '07:00', out: '23:59' }
        ]);
        await pool.query("INSERT INTO app_settings (setting_key, setting_value) VALUES ('jadwal_sekolah', $1) ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value", [testJadwal]);
        await pool.query("INSERT INTO app_settings (setting_key, setting_value) VALUES ('company_shifts', $1) ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value", [testShift]);
        await pool.query("INSERT INTO app_settings (setting_key, setting_value) VALUES ('app_mode', 'edukasi') ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value");

        // Buat member tes
        await pool.query("INSERT INTO members (identity_number, full_name, rfid_code) VALUES ('ATT123', 'Siswa Tes Absen', 'RFID-X')");
    });

    it('Harus menolak scan absen jika ID/RFID tidak terdaftar', async () => {
        const res = await request(app)
            .post('/api/scan')
            .set('Cookie', [`auth_token=${token}`])
            .send({ rfid_code: 'GHOST-CARD' });
        
        expect(res.status).toBe(404);
        expect(res.body.message).toBe('ID Tidak Terdaftar');
    });

    it('Harus bisa melakukan scan MASUK pertama kali', async () => {
        const morningDate = new Date();
        morningDate.setHours(7, 15, 0, 0);

        const res = await request(app)
            .post('/api/scan')
            .set('Cookie', [`auth_token=${token}`])
            .send({ rfid_code: 'RFID-X', scan_time: morningDate.toISOString() });
        
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.mode).toBe('MASUK');
    });

    it('Harus menolak scan beruntun (kunci 2 menit) jika di-scan lagi seketika', async () => {
        const morningDate = new Date();
        morningDate.setHours(7, 15, 5, 0);

        const res = await request(app)
            .post('/api/scan')
            .set('Cookie', [`auth_token=${token}`])
            .send({ rfid_code: 'RFID-X', scan_time: morningDate.toISOString() });
        
        expect(res.status).toBe(400);
        expect(res.body.message).toContain('mengunci absen beruntun');
    });

    it('Harus dapat mengambil daftar notifikasi indikasi lupa absen pulang', async () => {
        const res = await request(app)
            .get('/api/attendance/unclosed-notifications')
            .set('Cookie', [`auth_token=${token}`]);
        
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.data)).toBe(true);
    });
});
