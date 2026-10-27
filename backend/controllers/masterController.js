const { pool, rootPath, logDir } = require('../config/database');
const bcrypt = require('bcryptjs');
const path = require('path');
const { exec } = require('child_process');
const xlsx = require('xlsx');
const { addAuditLog } = require('../utils/logger');

const getDynamicLabels = (settings = {}) => {
    const isEdu = (settings.app_mode || 'edukasi').toLowerCase() === 'edukasi';
    if (isEdu) {
        return {
            app_mode: 'edukasi',
            label_kelompok: 'Kelas',
            label_pengguna: 'Siswa',
            label_wali: 'Wali Kelas',
            label_identitas: 'NIPD',
            label_identitas_ref: 'NISN',
            label_id_gabungan: 'NIPD / NISN'
        };
    } else {
        return {
            app_mode: 'korporat',
            label_kelompok: 'Divisi',
            label_pengguna: 'Karyawan',
            label_wali: 'Manager / Supervisor',
            label_identitas: 'ID Karyawan / NIK',
            label_identitas_ref: 'No. Identitas / KTP',
            label_id_gabungan: 'ID Karyawan / NIK'
        };
    }
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

        const q = `
            SELECT m.id, m.role, m.division_id,
                   m.identity_number, m.identity_reference AS nisn, m.identity_number AS nipd,
                   m.full_name, m.full_name AS nama_lengkap,
                   m.rfid_code, m.rfid_code AS kode_rfid,
                   m.photo, m.photo AS foto,
                   m.phone_number, m.phone_number AS nomor_telepon,
                   m.telegram_chat_id,
                   m.face_descriptor,
                   d.name AS division_name, d.name AS kelas 
            FROM members m 
            LEFT JOIN divisions d ON m.division_id = d.id 
            ORDER BY m.id DESC
        `;
        const r = await pool.query(q);
        res.json({ data: r.rows || [], labels });
    } catch (e) {
        console.error('getAllMembers failed:', e);
        res.status(500).json({ message: 'Gagal memuat daftar anggota. Periksa koneksi database dan log server.' });
    }
};

exports.getFaceMembers = async (req, res) => {
    try {
        const q = `
            SELECT id, 
                   identity_number, identity_number AS nipd,
                   identity_reference AS nisn,
                   full_name, full_name AS nama_lengkap,
                   rfid_code, rfid_code AS kode_rfid,
                   face_descriptor
            FROM members
            WHERE face_descriptor IS NOT NULL AND face_descriptor != ''
        `;
        const r = await pool.query(q);
        res.json({ data: r.rows || [] });
    } catch (e) {
        console.error("Gagal mengambil data face members:", e);
        res.json({ data: [] });
    }
};

exports.createMember = async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const identity_number = req.body.identity_number || req.body.nipd || '';
        const identity_reference = req.body.identity_reference || req.body.nisn || '';
        const full_name = req.body.full_name || req.body.nama_lengkap || '';
        const role = req.body.role || 'member';
        const rfid_code = req.body.rfid_code || req.body.kode_rfid || '';
        const photo = req.body.photo || req.body.foto || '';
        const face_descriptor = req.body.face_descriptor || null;
        const phone_number = req.body.phone_number || req.body.nomor_telepon || '';
        const telegram_chat_id = req.body.telegram_chat_id || '';
        const divisionInput = req.body.division_name || req.body.kelas || '';

        let division_id = req.body.division_id || null;

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
            'INSERT INTO members (identity_number, identity_reference, full_name, role, division_id, rfid_code, photo, face_descriptor, phone_number, telegram_chat_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
            [String(identity_number || '').trim(), String(identity_reference || '').trim(), String(full_name || ''), role, division_id, String(rfid_code || '').trim(), photo, face_descriptor, String(phone_number || '').trim(), String(telegram_chat_id || '').trim()]
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
        const face_descriptor = req.body.face_descriptor !== undefined ? req.body.face_descriptor : null;
        const phone_number = req.body.phone_number !== undefined ? req.body.phone_number : (req.body.nomor_telepon !== undefined ? req.body.nomor_telepon : null);
        const telegram_chat_id = req.body.telegram_chat_id !== undefined ? req.body.telegram_chat_id : null;

        let division_id = req.body.division_id || null;
        const divisionInput = req.body.division_name || req.body.kelas || '';

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
            'UPDATE members SET identity_number=$1, identity_reference=$2, full_name=$3, role=$4, division_id=$5, rfid_code=$6, photo=$7, face_descriptor=COALESCE($8, face_descriptor), phone_number=COALESCE($9, phone_number), telegram_chat_id=COALESCE($10, telegram_chat_id), is_synced=0 WHERE id=$11',
            [String(identity_number || '').trim(), String(identity_reference || '').trim(), String(full_name || ''), role, division_id, String(rfid_code || '').trim(), photo, face_descriptor, phone_number, telegram_chat_id, req.params.id]
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
            const phone = row['Nomor Telepon'] || row['No HP'] || row['Telepon'] || row['WhatsApp'] || '';
            const tgChatId = row['Telegram Chat ID'] || row['Chat ID Telegram'] || row['Telegram ID'] || '';

            if (!identity && identity_ref) {
                identity = identity_ref;
                identity_ref = '';
            }

            if (!identity || !name) continue;

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

            const cleanId = String(identity).trim();
            const cleanIdRef = String(identity_ref).trim();
            const cleanName = String(name).trim();
            const cleanRfid = String(rfid).trim();

            const checkMember = await client.query('SELECT id FROM members WHERE identity_number = $1', [cleanId]);
            if (checkMember.rows.length > 0) {
                await client.query(`
                    UPDATE members SET full_name = $1, division_id = $2, rfid_code = $3, identity_reference = $4,
                                       phone_number = COALESCE(NULLIF($5, ''), phone_number),
                                       telegram_chat_id = COALESCE(NULLIF($6, ''), telegram_chat_id)
                    WHERE identity_number = $7
                `, [cleanName, division_id, cleanRfid, cleanIdRef, String(phone).trim(), String(tgChatId).trim(), cleanId]);
            } else {
                await client.query(`
                    INSERT INTO members (identity_number, full_name, role, division_id, rfid_code, identity_reference, phone_number, telegram_chat_id) 
                    VALUES ($1, $2, 'member', $3, $4, $5, $6, $7)
                `, [cleanId, cleanName, division_id, cleanRfid, cleanIdRef, String(phone).trim(), String(tgChatId).trim()]);
            }

            successCount++;
        }

        await client.query('COMMIT');
        res.json({ success: true, message: `Berhasil mengimport ${successCount} data pengguna.` });
    } catch (e) {
        try { await client.query('ROLLBACK'); } catch (err) { }
        console.error("Import Error:", e);
        res.status(500).json({ message: "Gagal mengimpor file Excel: " + (e.message || "Unknown error") });
    } finally {
        client.release();
    }
};

// --- DIVISIONS (Kelas / Jabatan) ---
exports.getAllDivisions = async (req, res) => {
    try {
        const q = `
            SELECT d.id, d.name, d.name AS nama_kelas,
                   d.supervisor_name, d.supervisor_name AS wali_kelas,
                   COALESCE(d.allow_pulang_awal, 1) AS allow_pulang_awal,
                   COALESCE(d.allow_lembur, 1) AS allow_lembur,
                   COUNT(m.id) AS jumlah_siswa
            FROM divisions d
            LEFT JOIN members m ON m.division_id = d.id
            GROUP BY d.id, d.name, d.supervisor_name, d.allow_pulang_awal, d.allow_lembur
            ORDER BY d.name ASC
        `;
        const r = await pool.query(q);
        res.json({ data: r.rows || [] });
    } catch (e) {
        console.error("getAllDivisions Error:", e);
        res.json({ data: [] });
    }
};

exports.createDivision = async (req, res) => {
    try {
        const name = req.body.name || req.body.nama_kelas;
        const supervisor_name = req.body.supervisor_name || req.body.wali_kelas || '';
        const allow_pulang_awal = req.body.allow_pulang_awal === false || req.body.allow_pulang_awal === 0 ? 0 : 1;
        const allow_lembur = req.body.allow_lembur === false || req.body.allow_lembur === 0 ? 0 : 1;

        if (!name) return res.status(400).json({ message: "Nama wajib diisi" });
        await pool.query(
            'INSERT INTO divisions (name, supervisor_name, allow_pulang_awal, allow_lembur) VALUES ($1, $2, $3, $4)',
            [name.trim(), supervisor_name, allow_pulang_awal, allow_lembur]
        );

        if (supervisor_name) {
            try {
                await pool.query("UPDATE members SET is_synced = 0 WHERE full_name = $1 OR full_name LIKE $2", [supervisor_name, `%${supervisor_name}%`]);
            } catch (errSync) {}
        }

        res.json({ success: true });
    } catch (e) {
        if (e.code === '23505' || e.code === 'SQLITE_CONSTRAINT') {
            return res.status(400).json({ message: "Nama sudah terdaftar!" });
        }
        res.status(500).json({ message: "Gagal menyimpan data" });
    }
};

exports.updateDivision = async (req, res) => {
    try {
        const name = req.body.name || req.body.nama_kelas;
        const supervisor_name = req.body.supervisor_name || req.body.wali_kelas || '';
        const allow_pulang_awal = req.body.allow_pulang_awal === false || req.body.allow_pulang_awal === 0 ? 0 : 1;
        const allow_lembur = req.body.allow_lembur === false || req.body.allow_lembur === 0 ? 0 : 1;

        await pool.query(
            'UPDATE divisions SET name=$1, supervisor_name=$2, allow_pulang_awal=$3, allow_lembur=$4 WHERE id=$5',
            [name.trim(), supervisor_name, allow_pulang_awal, allow_lembur, req.params.id]
        );

        // Tandai supervisor & semua siswa di divisi ini agar disinkronkan ke Web Portal
        try {
            if (supervisor_name) {
                await pool.query("UPDATE members SET is_synced = 0 WHERE full_name = $1 OR full_name LIKE $2", [supervisor_name, `%${supervisor_name}%`]);
            }
            await pool.query("UPDATE members SET is_synced = 0 WHERE division_id = $1", [req.params.id]);
        } catch (errSync) {}

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ message: "Gagal memperbarui data" });
    }
};

exports.deleteDivision = async (req, res) => {
    try {
        await pool.query('DELETE FROM divisions WHERE id=$1', [req.params.id]);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ message: "Gagal menghapus data" });
    }
};


/**
 * Daftar akun login guru yang dikelola dari Nebula Presence.
 * Kata sandi/hash tidak pernah dikirim kembali ke UI.
 */
exports.getTeacherAccounts = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                m.id AS member_id,
                m.full_name,
                m.identity_number,
                m.identity_reference,
                m.role,
                d.name AS division_name,
                ta.username,
                ta.created_at
            FROM members m
            LEFT JOIN divisions d ON d.id = m.division_id
            LEFT JOIN teacher_accounts ta ON ta.member_id = m.id
            WHERE LOWER(REPLACE(REPLACE(TRIM(m.role), '_', ' '), '-', ' ')) IN ('guru', 'guru mapel', 'guru mata pelajaran', 'guru kelas', 'teacher', 'pengajar', 'wali kelas', 'walikelas')
            ORDER BY m.full_name ASC
        `);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('[Teacher Accounts] Gagal memuat akun:', error);
        res.status(500).json({ success: false, message: 'Gagal memuat akun login guru.' });
    }
};

exports.upsertTeacherAccount = async (req, res) => {
    const memberId = Number(req.params.memberId);
    const username = String(req.body?.username || '').trim();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!Number.isInteger(memberId) || memberId <= 0) {
        return res.status(400).json({ success: false, message: 'Guru yang dipilih tidak valid.' });
    }
    if (username.length < 3 || username.length > 80) {
        return res.status(400).json({ success: false, message: 'Username harus berisi 3–80 karakter.' });
    }
    if (password && (password.length < 8 || password.length > 200)) {
        return res.status(400).json({ success: false, message: 'Kata sandi baru minimal 8 karakter.' });
    }

    try {
        const memberResult = await pool.query(
            'SELECT id, full_name, role FROM members WHERE id = $1 LIMIT 1',
            [memberId]
        );
        const member = memberResult.rows[0];
        if (!member || !['guru', 'guru mapel', 'guru mata pelajaran', 'guru kelas', 'teacher', 'pengajar', 'wali kelas'].includes(String(member.role || '').trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' '))) {
            return res.status(404).json({ success: false, message: 'Data guru tidak ditemukan.' });
        }

        const existingResult = await pool.query(
            'SELECT id FROM teacher_accounts WHERE member_id = $1 LIMIT 1',
            [memberId]
        );
        const existing = existingResult.rows[0];
        if (!existing && !password) {
            return res.status(400).json({ success: false, message: 'Kata sandi wajib diisi saat membuat akun pertama kali.' });
        }

        if (existing) {
            if (password) {
                const passwordHash = await bcrypt.hash(password, 12);
                await pool.query(
                    'UPDATE teacher_accounts SET username = $1, password_hash = $2, is_active = 1 WHERE member_id = $3',
                    [username, passwordHash, memberId]
                );
            } else {
                await pool.query(
                    'UPDATE teacher_accounts SET username = $1, is_active = 1 WHERE member_id = $2',
                    [username, memberId]
                );
            }
        } else {
            const passwordHash = await bcrypt.hash(password, 12);
            await pool.query(
                'INSERT INTO teacher_accounts (member_id, username, password_hash) VALUES ($1, $2, $3)',
                [memberId, username, passwordHash]
            );
        }

        // Tandai anggota agar username/hash akun terbaru dikirim pada sinkronisasi berikutnya.
        await pool.query('UPDATE members SET is_synced = 0 WHERE id = $1', [memberId]);
        try {
            await addAuditLog(req.user?.nama_admin || 'Admin', 'Perbarui Akun Login Guru', member.full_name);
        } catch (_) {}

        res.json({ success: true, message: 'Akun guru tersimpan. Sinkronkan ke portal untuk mengaktifkan login.' });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({ success: false, message: 'Username tersebut sudah digunakan.' });
        }
        console.error('[Teacher Accounts] Gagal menyimpan akun:', error);
        res.status(500).json({ success: false, message: 'Gagal menyimpan akun login guru.' });
    }
};
