const request = require('supertest');
const app = require('../index');
const { pool } = require('../config/database');
const jwt = require('jsonwebtoken');
const initSystem = require('../models/init');

describe('Master Data (Anggota & Divisi) Tests', () => {
    let token = '';
    let memberId = '';
    let divisionId = '';
    const testIdentity = `TEST-${Date.now()}`;

    beforeAll(async () => {
        await initSystem();
        token = jwt.sign({ id: 1, username: 'administrator', role: 'SuperAdmin' }, process.env.JWT_SECRET || 'Nabastala_Secret_Key_2026_XYZ!', { expiresIn: '1h' });
    });

    // --- DIVISIONS CRUD ---
    it('Harus bisa membuat divisi baru (Create Division)', async () => {
        const res = await request(app)
            .post('/api/divisions')
            .set('Cookie', [`auth_token=${token}`])
            .send({
                name: 'Kelas 10A',
                manager_name: 'Budi Guru'
            });
        
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('Harus bisa mengambil daftar divisi (Read Divisions)', async () => {
        const res = await request(app)
            .get('/api/divisions')
            .set('Cookie', [`auth_token=${token}`]);
        
        expect(res.status).toBe(200);
        expect(res.body.data.length).toBeGreaterThan(0);
        
        // Simpan ID divisi untuk update/delete
        divisionId = res.body.data[0].id;
        expect(res.body.data[0].name).toBe('Kelas 10A');
    });

    it('Harus bisa mengupdate divisi (Update Division)', async () => {
        const res = await request(app)
            .put(`/api/divisions/${divisionId}`)
            .set('Cookie', [`auth_token=${token}`])
            .send({
                name: 'Kelas 10B',
                manager_name: 'Andi Guru'
            });
        
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        
        // Verify update
        const getRes = await request(app).get('/api/divisions').set('Cookie', [`auth_token=${token}`]);
        expect(getRes.body.data.find(d => d.id === divisionId).name).toBe('Kelas 10B');
    });

    // --- MEMBERS CRUD ---
    it('Harus bisa menambahkan anggota baru (Create Member)', async () => {
        const res = await request(app)
            .post('/api/members')
            .set('Cookie', [`auth_token=${token}`])
            .send({
                identity_number: testIdentity,
                full_name: 'Budi Santoso',
                role: 'member',
                rfid_code: 'AABBCCDD',
                division_id: divisionId
            });
        
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('Harus menolak (400) jika menambahkan anggota dengan NISN/ID duplikat', async () => {
        const res = await request(app)
            .post('/api/members')
            .set('Cookie', [`auth_token=${token}`])
            .send({
                identity_number: testIdentity, // Sama dengan sebelumnya
                full_name: 'Andi Mawar',
                role: 'member'
            });
        
        expect(res.status).toBe(400); 
        expect(res.body.message).toContain('sudah digunakan');
    });

    it('Harus bisa mengambil daftar anggota (Read Members)', async () => {
        const res = await request(app)
            .get('/api/members')
            .set('Cookie', [`auth_token=${token}`]);
        
        expect(res.status).toBe(200);
        expect(res.body.data.length).toBeGreaterThan(0);
        
        // Simpan ID member untuk update/delete
        const member = res.body.data.find(m => m.identity_number === testIdentity);
        expect(member).toBeDefined();
        memberId = member.id;
        expect(member.full_name).toBe('Budi Santoso');
    });

    it('Harus bisa mengupdate anggota (Update Member) menggunakan payload gaya Frontend', async () => {
        const res = await request(app)
            .put(`/api/members/${memberId}`)
            .set('Cookie', [`auth_token=${token}`])
            .send({
                identity_number: testIdentity,
                full_name: 'Budi Santoso Update',
                role: 'member',
                rfid_code: 'NEW_RFID',
                kelas: 'Kelas 10B' // <-- Menggunakan gaya payload frontend (teks, bukan ID)
            });
        
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        
        // Verify update and integration logic
        const getRes = await request(app).get('/api/members').set('Cookie', [`auth_token=${token}`]);
        const updatedMember = getRes.body.data.find(m => m.id === memberId);
        expect(updatedMember.full_name).toBe('Budi Santoso Update');
        expect(updatedMember.kelas).toBe('Kelas 10B'); // Memastikan konversi teks Kelas -> ID berhasil di backend
    });

    // --- DELETIONS ---
    it('Harus bisa menghapus anggota (Delete Member)', async () => {
        const res = await request(app)
            .delete(`/api/members/${memberId}`)
            .set('Cookie', [`auth_token=${token}`]);
        
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        
        // Verify deletion
        const getRes = await request(app).get('/api/members').set('Cookie', [`auth_token=${token}`]);
        expect(getRes.body.data.find(m => m.id === memberId)).toBeUndefined();
    });

    it('Harus bisa menghapus divisi (Delete Division)', async () => {
        const res = await request(app)
            .delete(`/api/divisions/${divisionId}`)
            .set('Cookie', [`auth_token=${token}`]);
        
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        
        // Verify deletion
        const getRes = await request(app).get('/api/divisions').set('Cookie', [`auth_token=${token}`]);
        expect(getRes.body.data.find(d => d.id === divisionId)).toBeUndefined();
    });
});
