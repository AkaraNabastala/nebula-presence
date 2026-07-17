const request = require('supertest');
const app = require('../index');
const { pool } = require('../config/database');
const jwt = require('jsonwebtoken');
const initSystem = require('../models/init');



describe('Devices API Tests', () => {
    let token = '';
    let deviceId = '';

    beforeAll(async () => {
        await initSystem();
        token = jwt.sign({ id: 1, username: 'administrator', role: 'SuperAdmin' }, process.env.JWT_SECRET || 'Nabastala_Secret_Key_2026_XYZ!', { expiresIn: '1h' });
    });

    it('Harus bisa menambahkan mesin ZKTeco baru (Create Device)', async () => {
        const res = await request(app)
            .post('/api/devices')
            .set('Cookie', [`auth_token=${token}`])
            .send({
                name: 'Pintu Depan',
                ip_address: '192.168.1.201',
                port: 4370
            });
        
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.device).toBeDefined();
        deviceId = res.body.device.id;
    });

    it('Harus menolak jika IP Address mesin duplikat (Unique Constraint)', async () => {
        const res = await request(app)
            .post('/api/devices')
            .set('Cookie', [`auth_token=${token}`])
            .send({
                name: 'Mesin Ganda',
                ip_address: '192.168.1.201', // IP yang sama
                port: 4370
            });
        
        expect(res.status).toBe(400);
        expect(res.body.message).toContain('sudah digunakan');
    });

    it('Harus bisa mengambil daftar mesin (Read Devices)', async () => {
        const res = await request(app)
            .get('/api/devices')
            .set('Cookie', [`auth_token=${token}`]);
        
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.devices.length).toBeGreaterThan(0);
    });



    it('Harus bisa menghapus mesin (Delete Device)', async () => {
        const res = await request(app)
            .delete(`/api/devices/${deviceId}`)
            .set('Cookie', [`auth_token=${token}`]);
        
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        
        // Verify deletion
        const getRes = await request(app).get('/api/devices').set('Cookie', [`auth_token=${token}`]);
        expect(getRes.body.devices.find(d => d.id === deviceId)).toBeUndefined();
    });
});
