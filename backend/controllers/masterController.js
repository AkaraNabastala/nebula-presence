const { pool, rootPath, logDir } = require('../config/database');
const path = require('path');
const { exec } = require('child_process');
const xlsx = require('xlsx');
const { addAuditLog } = require('../utils/logger');

const getDynamicLabels = (settings) => {
    return {
        label_kelompok: 'Kelompok',
        label_pengguna: 'Pengguna',
        label_wali: 'Penanggung Jawab',
        label_identitas: 'ID Pengguna'
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
        await addAuditLog(req.user?.nama_admin || 'Admin', 'Update Pengaturan Sistem', Object.keys(req.body).join(', '));
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
                   m.identity_number, m.identity_reference AS nisn, m.identity_number AS nipd,
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
        
        // Kompatibilitas mundur: Memisahkan nipd dan nisn
        const identity_number = req.body.identity_number || req.body.nipd || '';
        const identity_reference = req.body.identity_reference || req.body.nisn || '';
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
            'INSERT INTO members (identity_number, identity_reference, full_name, role, division_id, rfid_code, photo) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [String(identity_number || '').trim(), String(identity_reference || '').trim(), String(full_name || ''), role, division_id, String(rfid_code || '').trim(), photo]
        );

        await client.query('COMMIT');
        res.json({ success: true });

    } catch (e) {
        await client.query('ROLLBACK');
        console.error("Create Member Error:", e);
        if (e.code === '23505' || e.code === 'SQLITE_CONSTRAINT' || (e.message && e.message.includes('UNIQUE constraint'))) {
            return res.status(400).json({ message: "Nomor Identitas atau Kode RFID tersebut sudah digunakan!" });
        }
        res.status(500).json({ message: e.message || "Gagal menyimpan data pengguna" });
    } finally {
        client.release();
    }
};

exports.updateMember = async (req, res) => { 
    try { 
        const identity_number = req.body.identity_number || req.body.nipd;
        const identity_reference = req.body.identity_reference || req.body.nisn;
        const full_name = req.body.full_name || req.body.nama_lengkap;
        const role = req.body.role || 'member';
        const rfid_code = req.body.rfid_code || req.body.kode_rfid;
        const photo = req.body.photo || req.body.foto;
        
        let division_id = req.body.division_id || null;
        const divisionInput = req.body.division_name || req.body.kelas || '';

        // Logika cerdas: Mencari ID divisi, jika tidak ada maka otomatis dibuatkan divisinya
        if (!division_id && divisionInput.trim()) {
            const checkDiv = await pool.query('SELECT id FROM divisions WHERE name = $1', [divisionInput.trim()]);
            if (checkDiv.rows.length === 0) {
                const newDiv = await pool.query('INSERT INTO divisions (name) VALUES ($1) RETURNING id', [divisionInput.trim()]);
                division_id = newDiv.rows[0].id;
            } else {
                division_id = checkDiv.rows[0].id;
            }
        }

        await pool.query(
            'UPDATE members SET identity_number=$1, identity_reference=$2, full_name=$3, role=$4, division_id=$5, rfid_code=$6, photo=$7 WHERE id=$8', 
            [String(identity_number || '').trim(), String(identity_reference || '').trim(), String(full_name || ''), role, division_id, String(rfid_code || '').trim(), photo, req.params.id]
        ); 
        res.json({ success: true }); 
    } catch (e) { 
        if (e.code === '23505' || e.code === 'SQLITE_CONSTRAINT' || (e.message && e.message.includes('UNIQUE constraint'))) {
            return res.status(400).json({ message: "Nomor Identitas atau Kode RFID tersebut sudah digunakan!" });
        }
        res.status(500).json({ message: "Gagal memperbarui data" }); 
    } 
};

exports.deleteMember = async (req, res) => { 
    try { 
        const id = req.params.id;
        if (!id) return res.status(400).json({ message: "ID tidak valid" });
        await pool.query('DELETE FROM members WHERE id=$1', [id]); 
        await addAuditLog(req.user?.nama_admin || 'Admin', 'Hapus Pengguna', `ID: ${id}`);
        res.json({ success: true }); 
    } catch (e) { 
        console.error("Delete Error:", e);
        res.status(500).json({ message: "Gagal menghapus data" }); 
    } 
};

exports.importMembers = async (req, res) => {
    if (!req.file) return res.status(400).json({ message: "File excel tidak ditemukan" });
    const client = await pool.connect();
    try {
        const fs = require('fs');
        const fileBuffer = fs.readFileSync(req.file.path);
        const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

        if (rows.length === 0) return res.status(400).json({ message: "File excel kosong" });

        await client.query('BEGIN');
        let successCount = 0;

        for (const row of rows) {
            let identity = row['ID Wajib'] || row['ID Pengguna (Wajib)'] || row['Nomor Identitas'] || row['NIPD'] || row['ID Karyawan'] || row['ID Pengguna'];
            let identity_ref = row['ID Opsional'] || row['NIK / ID Lain'] || row['NIK / ID Lainnya'] || row['NISN'] || '';
            const name = row['Nama Lengkap'] || row['Nama'];
            const divisionName = row['Kelompok'] || row['Kelompok/Jabatan'] || row['Unit'] || row['Kelas'] || row['Divisi'] || row['Divisi/Jabatan'];
            const rfid = row['Kode Kartu (Opsional)'] || row['Kode RFID'] || row['Kode Kartu'] || '';

            if (!identity && identity_ref) {
                identity = identity_ref;
                identity_ref = '';
            }

            if (!identity || !name) continue; // Skip jika data utama kosong

            let division_id = null;
            if (divisionName) {
                const cleanDiv = String(divisionName).trim();
                const checkDiv = await client.query('SELECT id FROM divisions WHERE name = $1', [cleanDiv]);
                if (checkDiv.rows.length === 0) {
                    const newDiv = await client.query('INSERT INTO divisions (name) VALUES ($1) RETURNING id', [cleanDiv]);
                    if (newDiv.rows.length > 0) {
                        division_id = newDiv.rows[0].id;
                    }
                } else {
                    division_id = checkDiv.rows[0].id;
                }
            }

            // Insert atau Update berdasarkan Identity Number secara manual untuk menghindari error UNIQUE constraint
            const cleanId = String(identity).trim();
            const cleanIdRef = String(identity_ref).trim();
            const cleanName = String(name).trim();
            const cleanRfid = String(rfid).trim();

            const checkMember = await client.query('SELECT id FROM members WHERE identity_number = $1', [cleanId]);
            if (checkMember.rows.length > 0) {
                await client.query(`
                    UPDATE members SET full_name = $1, division_id = $2, rfid_code = $3, identity_reference = $4 WHERE identity_number = $5
                `, [cleanName, division_id, cleanRfid, cleanIdRef, cleanId]);
            } else {
                await client.query(`
                    INSERT INTO members (identity_number, full_name, role, division_id, rfid_code, identity_reference) 
                    VALUES ($1, $2, 'member', $3, $4, $5)
                `, [cleanId, cleanName, division_id, cleanRfid, cleanIdRef]);
            }
            
            successCount++;
        }

        await client.query('COMMIT');
        res.json({ success: true, message: `Berhasil mengimport ${successCount} data pengguna.` });
    } catch (e) {
        try { await client.query('ROLLBACK'); } catch (err) {}
        console.error("Import Error:", e);
        try {
            const fs = require('fs');
            const path = require('path');
            const os = require('os');
            const logDir = path.join(os.homedir(), '.nebula-presence-app', 'logs');
            if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
            fs.appendFileSync(path.join(logDir, 'debug.log'), `\n[IMPORT ERROR]: ${e.message}\n${e.stack}\n`);
        } catch(logErr) {}
        res.status(500).json({ message: "DEBUG ERROR: " + (e.message || "Unknown error") + " STACK: " + String(e.stack).substring(0, 500) });
    } finally {
        client.release();
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
                   d.supervisor_name AS manager_name, d.supervisor_name AS wali_kelas, 
                   CAST((SELECT COUNT(*) FROM members m WHERE m.division_id = d.id) AS INTEGER) as total_members,
                   CAST((SELECT COUNT(*) FROM members m WHERE m.division_id = d.id) AS INTEGER) as jumlah_siswa
            FROM divisions d 
            ORDER BY d.name ASC
        `;
        const r = await pool.query(q);
        res.json({ data: r.rows || [], labels }); 
    } catch (e) { 
        console.error("Query Error:", e.message);
        res.status(500).json({ message: "Gagal mengambil data kelompok" }); 
    } 
};

exports.createDivision = async (req, res) => { 
    try { 
        const name = req.body.name || req.body.nama_kelas;
        const manager = req.body.manager_name || req.body.wali_kelas;
        await pool.query('INSERT INTO divisions (name, supervisor_name) VALUES ($1, $2)', [name, manager]); 
        res.json({ success: true }); 
    } catch (e) { 
        if (e.code === '23505' || e.code === 'SQLITE_CONSTRAINT' || (e.message && e.message.includes('UNIQUE constraint'))) {
            return res.status(400).json({ message: "Kelompok/Kelas dengan nama tersebut sudah ada!" });
        }
        res.status(500).json({ message: "Gagal menambah data" }); 
    } 
};

exports.updateDivision = async (req, res) => { 
    try { 
        const name = req.body.name || req.body.nama_kelas;
        const manager = req.body.manager_name || req.body.wali_kelas;
        await pool.query('UPDATE divisions SET name=$1, supervisor_name=$2 WHERE id=$3', [name, manager, req.params.id]); 
        res.json({ success: true }); 
    } catch (e) { 
        if (e.code === '23505' || e.code === 'SQLITE_CONSTRAINT' || (e.message && e.message.includes('UNIQUE constraint'))) {
            return res.status(400).json({ message: "Kelompok/Kelas dengan nama tersebut sudah ada!" });
        }
        res.status(500).json({ message: "Gagal memperbarui data" }); 
    } 
};

exports.deleteDivision = async (req, res) => { 
    try { 
        await pool.query('DELETE FROM divisions WHERE id=$1', [req.params.id]); 
        await addAuditLog(req.user?.nama_admin || 'Admin', 'Hapus Kelompok', `ID Kelompok: ${req.params.id}`);
        res.json({ success: true }); 
    } catch (e) { res.status(500).json({ message: "Gagal menghapus data" }); } 
};

// --- BACKUP DATABASE ---
exports.downloadBackup = (req, res) => {
    try {
        const os = require('os');
        const fs = require('fs');
        const path = require('path');
        const fileName = `backup_db_${new Date().toISOString().split('T')[0]}.sqlite`;
        const dbPath = path.join(os.homedir(), '.nebula-presence-app', 'database.sqlite');
        
        if (!fs.existsSync(dbPath)) {
            return res.status(404).json({ message: "Database tidak ditemukan" });
        }
        
        res.download(dbPath, fileName);
    } catch (e) {
        console.error("Backup Error:", e);
        res.status(500).json({ message: "Gagal mengunduh backup" });
    }
};