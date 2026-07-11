const { pool, rootPath, logDir } = require('../config/database');
const path = require('path');
const { exec } = require('child_process');

// --- HELPER DYNAMIC LABELS ---
// Mendeteksi mode aplikasi (Edukasi vs Korporat/Umum)
const getDynamicLabels = (settings) => {
    const isEdukasi = settings['app_mode'] === 'edukasi'; 
    return {
        label_unit: isEdukasi ? 'Kelas' : 'Departemen/Divisi',
        label_anggota: isEdukasi ? 'Siswa/Guru' : 'Karyawan/Staff',
        label_wali: isEdukasi ? 'Wali Kelas' : 'Manajer/Supervisor',
        label_identitas: isEdukasi ? 'NISN/NIPD' : 'ID Karyawan'
    };
};

// --- SETTINGS ---
exports.getSettings = async (req, res) => {
    try {
        const r = await pool.query('SELECT * FROM app_settings');
        const s = {};
        r.rows.forEach(x => s[x.setting_key] = x.setting_value);
        
        const labels = getDynamicLabels(s);
        res.json({ ...s, labels });
    } catch (e) { res.status(500).json({}); }
};

exports.updateSettings = async (req, res) => {
    try {
        for (const [k, v] of Object.entries(req.body)) {
            await pool.query(`INSERT INTO app_settings (setting_key, setting_value) VALUES ($1, $2) ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value`, [k, v]);
        }
        res.json({ success: true });
    } catch (e) { res.status(500).json({ message: "Gagal menyimpan pengaturan" }); }
};

// --- MEMBERS (Siswa, Guru, Karyawan, Manajer) ---
exports.getAllMembers = async (req, res) => { 
    try { 
        const settings = await pool.query('SELECT * FROM app_settings');
        const s = {}; settings.rows.forEach(x => s[x.setting_key] = x.setting_value);
        const labels = getDynamicLabels(s);

        // PERBAIKAN: Menambahkan ALIAS (AS) agar frontend lama tidak crash
        const q = `
            SELECT m.id, m.role, m.division_id,
                   m.identity_number, m.identity_number AS nisn, m.identity_number AS nipd,
                   m.full_name, m.full_name AS nama_lengkap,
                   m.rfid_code, m.rfid_code AS kode_rfid,
                   m.photo, m.photo AS foto,
                   d.name AS division_name, d.name AS kelas 
            FROM members m 
            LEFT JOIN divisions d ON m.division_id = d.id 
            ORDER BY m.id DESC
        `;
        const r = await pool.query(q); 
        res.json({ data: r.rows || [], labels }); 
    } catch (e) { res.json({ data: [], labels: {} }); } 
};

exports.createMember = async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Kompatibilitas mundur: Menerima payload lama maupun payload baru
        const identity_number = req.body.identity_number || req.body.nisn || req.body.nipd || '';
        const full_name = req.body.full_name || req.body.nama_lengkap || '';
        const role = req.body.role || 'member'; // Default role
        const rfid_code = req.body.rfid_code || req.body.kode_rfid || '';
        const photo = req.body.photo || req.body.foto || '';
        const divisionInput = req.body.division_name || req.body.kelas || '';

        let division_id = req.body.division_id || null;

        // Logika cerdas: Mencari ID divisi, jika tidak ada maka otomatis dibuatkan divisinya
        if (!division_id && divisionInput.trim()) {
            const checkDiv = await client.query('SELECT id FROM divisions WHERE name = $1', [divisionInput.trim()]);
            if (checkDiv.rows.length === 0) {
                const newDiv = await client.query('INSERT INTO divisions (name) VALUES ($1) RETURNING id', [divisionInput.trim()]);
                division_id = newDiv.rows[0].id;
            } else {
                division_id = checkDiv.rows[0].id;
            }
        }

        await client.query(
            'INSERT INTO members (identity_number, full_name, role, division_id, rfid_code, photo) VALUES ($1, $2, $3, $4, $5, $6)',
            [identity_number.trim(), full_name, role, division_id, rfid_code.trim(), photo]
        );

        await client.query('COMMIT');
        res.json({ success: true });

    } catch (e) {
        await client.query('ROLLBACK');
        console.error("Create Member Error:", e);
        res.status(500).json({ message: e.message || "Gagal menyimpan data anggota" });
    } finally {
        client.release();
    }
};

exports.updateMember = async (req, res) => { 
    try { 
        const identity_number = req.body.identity_number || req.body.nisn || req.body.nipd;
        const full_name = req.body.full_name || req.body.nama_lengkap;
        const role = req.body.role || 'member';
        const rfid_code = req.body.rfid_code || req.body.kode_rfid;
        const photo = req.body.photo || req.body.foto;
        const division_id = req.body.division_id; 

        await pool.query(
            'UPDATE members SET identity_number=$1, full_name=$2, role=$3, division_id=$4, rfid_code=$5, photo=$6 WHERE id=$7', 
            [identity_number?.trim(), full_name, role, division_id, rfid_code?.trim(), photo, req.params.id]
        ); 
        res.json({ success: true }); 
    } catch (e) { res.status(500).json({ message: "Gagal memperbarui data" }); } 
};

exports.deleteMember = async (req, res) => { 
    try { 
        const id = req.params.id;
        if (!id) return res.status(400).json({ message: "ID tidak valid" });
        await pool.query('DELETE FROM members WHERE id=$1', [id]); 
        res.json({ success: true }); 
    } catch (e) { 
        console.error("Delete Error:", e);
        res.status(500).json({ message: "Gagal menghapus data" }); 
    } 
};

// --- DIVISIONS (Kelas / Departemen) ---
exports.getAllDivisions = async (req, res) => { 
    try { 
        const settings = await pool.query('SELECT * FROM app_settings');
        const s = {}; settings.rows.forEach(x => s[x.setting_key] = x.setting_value);
        const labels = getDynamicLabels(s);

        // PERBAIKAN: Menambahkan ALIAS nama_kelas, wali_kelas, jumlah_siswa
        const q = `
            SELECT d.id, 
                   d.name, d.name AS nama_kelas, 
                   d.manager_name, d.manager_name AS wali_kelas, 
                   (SELECT COUNT(*)::int FROM members m WHERE m.division_id = d.id) as total_members,
                   (SELECT COUNT(*)::int FROM members m WHERE m.division_id = d.id) as jumlah_siswa
            FROM divisions d 
            ORDER BY d.name ASC
        `;
        const r = await pool.query(q);
        res.json({ data: r.rows || [], labels }); 
    } catch (e) { 
        console.error("Query Error:", e.message);
        res.status(500).json({ message: "Gagal mengambil data divisi" }); 
    } 
};

exports.createDivision = async (req, res) => { 
    try { 
        const name = req.body.name || req.body.nama_kelas;
        const manager = req.body.manager_name || req.body.wali_kelas;
        await pool.query('INSERT INTO divisions (name, manager_name) VALUES ($1, $2)', [name, manager]); 
        res.json({ success: true }); 
    } catch (e) { res.status(500).json({ message: "Gagal menambah data" }); } 
};

exports.updateDivision = async (req, res) => { 
    try { 
        const name = req.body.name || req.body.nama_kelas;
        const manager = req.body.manager_name || req.body.wali_kelas;
        await pool.query('UPDATE divisions SET name=$1, manager_name=$2 WHERE id=$3', [name, manager, req.params.id]); 
        res.json({ success: true }); 
    } catch (e) { res.status(500).json({ message: "Gagal memperbarui data" }); } 
};

exports.deleteDivision = async (req, res) => { 
    try { 
        await pool.query('DELETE FROM divisions WHERE id=$1', [req.params.id]); 
        res.json({ success: true }); 
    } catch (e) { res.status(500).json({ message: "Gagal menghapus data" }); } 
};

// --- BACKUP DATABASE ---
exports.downloadBackup = (req, res) => {
    req.setTimeout(30000); 
    const fileName = `backup_db_${new Date().toISOString().split('T')[0]}.sql`;
    
    // Menarik kredensial dari environment variable agar selalu dinamis dan aman
    const dbUser = process.env.DB_USER || 'postgres';
    const dbPort = process.env.DB_PORT || '5432';
    const dbName = process.env.DB_NAME || 'absensi_nabastala';
    const dbPass = process.env.DB_PASSWORD || 'darksky';

    const backupCmd = `pg_dump -h 127.0.0.1 -U ${dbUser} -p ${dbPort} ${dbName}`;
    const env = { ...process.env, PGPASSWORD: dbPass }; 
    
    exec(backupCmd, { env, maxBuffer: 1024 * 1024 * 100 }, (error, stdout, stderr) => {
        if (error) {
            console.error("PG_DUMP ERROR:", stderr);
            return res.status(500).send("Gagal membuat backup: " + stderr);
        }
        res.setHeader('Content-Type', 'application/sql');
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
        res.status(200).send(stdout);
    });
};