const request = require('supertest');
const app = require('../index');
const { pool } = require('../config/database');
const jwt = require('jsonwebtoken');
const initSystem = require('../models/init');
const path = require('path');
const fs = require('fs');

describe('System & Settings API Tests', () => {
    let tokenSuperAdmin = '';

    beforeAll(async () => {
        await initSystem();
        tokenSuperAdmin = jwt.sign({ id: 1, username: 'administrator', role: 'SuperAdmin' }, process.env.JWT_SECRET || 'Nabastala_Secret_Key_2026_XYZ!', { expiresIn: '1h' });
    });

    it('Harus bisa mengambil daftar pengaturan (Get Settings)', async () => {
        const res = await request(app)
            .get('/api/settings'); // Publik
        
        expect(res.status).toBe(200);
        expect(res.body.labels).toBeDefined();
    });

    it('Harus bisa memperbarui pengaturan (Update Settings)', async () => {
        const res = await request(app)
            .post('/api/settings')
            .set('Cookie', [`auth_token=${tokenSuperAdmin}`])
            .send({
                app_mode: 'edukasi',
                school_name: 'Sekolah Pengujian'
            });
        
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        
        // Verifikasi update
        const getRes = await request(app).get('/api/settings');
        expect(getRes.body.app_mode).toBe('edukasi');
        // Mode edukasi memakai label "Kelas" sesuai getDynamicLabels pada masterController.
        expect(getRes.body.labels.label_kelompok).toBe('Kelas');
    });

    it('Harus bisa mengambil log aktivitas (Audit Logs)', async () => {
        const res = await request(app)
            .get('/api/audit-logs')
            .set('Cookie', [`auth_token=${tokenSuperAdmin}`]);
        
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.length).toBeGreaterThan(0); // Harusnya ada log dari Update Settings
    });

    it('Harus bisa mengunduh file backup database', async () => {
        // Buat file dummy database.sqlite di direktori tes agar bisa didownload
        const os = require('os');
        const dbPath = path.join(os.homedir(), '.nebula-presence-app', 'database.sqlite');
        if (!fs.existsSync(dbPath)) {
            fs.writeFileSync(dbPath, 'dummy data');
        }

        const res = await request(app)
            .get('/api/backup')
            .set('Cookie', [`auth_token=${tokenSuperAdmin}`]);
        
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toBe('application/octet-stream');
        expect(res.headers['content-disposition']).toContain('attachment');
    });

    it('Harus menolak restore database tanpa file', async () => {
        const res = await request(app)
            .post('/api/restore')
            .set('Cookie', [`auth_token=${tokenSuperAdmin}`]);
            
        expect(res.status).toBe(400);
        expect(res.body.message).toContain('tidak terdeteksi');
    });
});
