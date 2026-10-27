const request = require('supertest');
const app = require('../index');
const { pool } = require('../config/database');
const initSystem = require('../models/init');

describe('Auth & License API Tests', () => {
    beforeAll(async () => {
        await initSystem();
    });

    it('Harus menolak login dengan kredensial salah', async () => {
        const res = await request(app)
            .post('/api/login')
            .send({ username: 'admin', password: 'wrongpassword' });
        
        expect(res.status).toBe(404); // Sesuai logika di authController baris 10
    });

    it('Harus berhasil login dengan kredensial default administrator', async () => {
        const res = await request(app)
            .post('/api/login')
            .send({ username: 'administrator', password: 'admin123' });
        
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.headers['set-cookie']).toBeDefined();
    });

    it('Harus menolak alur reset kata sandi lama yang tidak aman', async () => {
        const res = await request(app)
            .post('/api/reset-password')
            .send({ machineId: 'TEST-HWID', resetCode: 'U2FsdGVkX1+TokenPalsuTipePerdana' });

        expect(res.status).toBe(410);
        expect(res.body.message).toContain('dinonaktifkan');
    });
});
