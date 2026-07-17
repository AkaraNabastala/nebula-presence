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
        const res = await request(app)
            .post('/api/scan')
            .set('Cookie', [`auth_token=${token}`])
            .send({ rfid_code: 'RFID-X' });
        
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.mode).toBe('MASUK');
    });

    it('Harus menolak scan beruntun (kunci 2 menit) jika di-scan lagi seketika', async () => {
        const res = await request(app)
            .post('/api/scan')
            .set('Cookie', [`auth_token=${token}`])
            .send({ rfid_code: 'RFID-X' });
        
        expect(res.status).toBe(400);
        expect(res.body.message).toContain('mengunci absen beruntun');
    });
});
