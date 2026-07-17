const request = require('supertest');
const app = require('../index');
const { pool } = require('../config/database');
const jwt = require('jsonwebtoken');
const initSystem = require('../models/init');

describe('Holidays API Tests', () => {
    let tokenSuperAdmin = '';
    let tokenAdmin = '';
    let holidayId = '';

    beforeAll(async () => {
        await initSystem();
        // SuperAdmin token
        tokenSuperAdmin = jwt.sign({ id: 1, username: 'administrator', role: 'SuperAdmin' }, process.env.JWT_SECRET || 'Nabastala_Secret_Key_2026_XYZ!', { expiresIn: '1h' });
        // Normal Admin token (should be rejected for holiday actions)
        tokenAdmin = jwt.sign({ id: 2, username: 'admin_biasa', role: 'Admin' }, process.env.JWT_SECRET || 'Nabastala_Secret_Key_2026_XYZ!', { expiresIn: '1h' });
    });

    it('Harus menolak (403) jika role Admin biasa mencoba menambahkan hari libur', async () => {
        const res = await request(app)
            .post('/api/holidays')
            .set('Cookie', [`auth_token=${tokenAdmin}`])
            .send({
                date: '2026-08-17',
                description: 'Hari Kemerdekaan'
            });
        
        expect(res.status).toBe(403);
    });

    it('Harus bisa menambahkan hari libur oleh SuperAdmin (Create Holiday)', async () => {
        const res = await request(app)
            .post('/api/holidays')
            .set('Cookie', [`auth_token=${tokenSuperAdmin}`])
            .send({
                date: '2026-08-17',
                description: 'Hari Kemerdekaan'
            });
        
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('Harus menolak (400) jika menambahkan hari libur di tanggal yang sama', async () => {
        const res = await request(app)
            .post('/api/holidays')
            .set('Cookie', [`auth_token=${tokenSuperAdmin}`])
            .send({
                date: '2026-08-17',
                description: 'Cuti Bersama'
            });
        
        expect(res.status).toBe(400);
        expect(res.body.message).toContain('sudah ditandai');
    });

    it('Harus bisa mengambil daftar hari libur (Read Holidays)', async () => {
        const res = await request(app)
            .get('/api/holidays')
            .set('Cookie', [`auth_token=${tokenSuperAdmin}`]);
        
        expect(res.status).toBe(200);
        expect(res.body.data.length).toBeGreaterThan(0);
        
        const holiday = res.body.data.find(h => h.holiday_date === '2026-08-17');
        expect(holiday).toBeDefined();
        holidayId = holiday.id;
    });

    it('Harus bisa menghapus hari libur oleh SuperAdmin (Delete Holiday)', async () => {
        const res = await request(app)
            .delete(`/api/holidays/${holidayId}`)
            .set('Cookie', [`auth_token=${tokenSuperAdmin}`]);
        
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        
        // Verify deletion
        const getRes = await request(app).get('/api/holidays').set('Cookie', [`auth_token=${tokenSuperAdmin}`]);
        expect(getRes.body.data.find(h => h.id === holidayId)).toBeUndefined();
    });
});
