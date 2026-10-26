const { pool } = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { addAuditLog } = require('../utils/logger');

exports.login = async (req, res) => {
    const { username, password } = req.body;
    try {
        const r = await pool.query('SELECT * FROM admins WHERE username=$1', [username]);
        if (r.rows.length === 0) return res.status(404).json({ message: "Username atau Password salah" }); // Samarkan pesan error untuk keamanan
        
        if (!await bcrypt.compare(password, r.rows[0].password)) return res.status(401).json({ message: "Username atau Password salah" });
        
        const user = r.rows[0];
        // Nebula Presence hanya menerima akun admin dengan role SuperAdmin.
        if (user.role !== 'SuperAdmin') {
            return res.status(403).json({ message: 'Akses Nebula Presence hanya untuk admin.' });
        }
        delete user.password;

        // Wajib mengamankan Secret Key
        const secretKey = process.env.JWT_SECRET || 'Nabastala_Secret_Key_2026_XYZ!';

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role || 'SuperAdmin' }, 
            secretKey,
            { expiresIn: '1d' }
        );

        res.cookie('auth_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 24 * 60 * 60 * 1000
        });

        await addAuditLog(user.nama_admin, 'User Login', 'Sistem Absensi');

        res.json({ success: true, user });
    } catch (e) { 
        console.error(e);
        res.status(500).json({ message: "Terjadi kesalahan internal server" }); 
    }
};

// Fungsi Logout Baru
exports.logout = (req, res) => {
    res.clearCookie('auth_token');
    res.json({ success: true, message: "Berhasil logout" });
};

exports.updateProfile = async (req, res) => {
    // PENTING: req.user.id didapat dari JWT Middleware, BUKAN dari req.body
    // Pastikan rute ini dilindungi oleh middleware token Anda
    const id = req.user.id; 
    const { nama, username, password } = req.body;

    try {
        if (password) {
            const h = await bcrypt.hash(password, 10);
            await pool.query('UPDATE admins SET nama_admin=$1, username=$2, password=$3 WHERE id=$4', [nama, username, h, id]);
        } else {
            await pool.query('UPDATE admins SET nama_admin=$1, username=$2 WHERE id=$3', [nama, username, id]);
        }
        
        const u = await pool.query('SELECT id, username, nama_admin, role FROM admins WHERE id=$1', [id]);
        await addAuditLog(nama, 'Update Profil Admin', `Username: ${username}`);
        res.json({ success: true, user: u.rows[0] });
    } catch (e) { 
        if (e.code === '23505' || e.code === 'SQLITE_CONSTRAINT' || (e.message && e.message.includes('UNIQUE constraint'))) {
            return res.status(400).json({ message: "Username sudah digunakan!" });
        }
        res.status(500).json({ message: "Gagal memperbarui profil" }); 
    }
};

exports.resetPassword = async (req, res) => {
    const { machineId, resetCode } = req.body;
    
    if (!machineId || !resetCode) {
        return res.status(400).json({ message: "Data tidak lengkap." });
    }

    try {
        let isValid = false;

        // Hanya gunakan AES decrypt (Satu metode saja sesuai permintaan User)
        const { processActivationData } = require('../utils/licenseManager');
        try {
            const newData = processActivationData(resetCode);
            if (newData && newData.type === 'reset_password' && newData.machineId === machineId) {
                isValid = true;
            }
        } catch (err) {
            // Ignore error parsing, isValid remains false
        }

        if (!isValid) {
            return res.status(401).json({ message: "Kode Reset tidak valid atau sudah kadaluarsa!" });
        }

        // Reset password ke default (admin123) agar konsisten dengan licenseController
        const defaultPassword = "admin123";
        const hashedPassword = await bcrypt.hash(defaultPassword, 10);
        
        // Update password untuk semua admin (karena lupa) atau admin dengan role 'SuperAdmin'
        await pool.query("UPDATE admins SET password = $1 WHERE role = 'SuperAdmin'", [hashedPassword]);
        
        await addAuditLog('System', 'Reset Password', 'SuperAdmin password reset via System Code');
        
        res.json({ success: true, message: "Kata sandi berhasil di-reset menjadi 'admin123'. Silakan login." });
    } catch (error) {
        console.error("Reset Password Error:", error);
        res.status(500).json({ message: "Terjadi kesalahan server." });
    }
};

// Login guru terpisah dari login admin.
exports.teacherLogin = async (req, res) => {
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');

    if (!username || !password) {
        return res.status(400).json({ message: 'Username dan password wajib diisi.' });
    }

    try {
        const result = await pool.query(`
            SELECT ta.id AS account_id, ta.member_id, ta.username,
                   ta.password_hash, ta.is_active,
                   m.full_name, m.role
            FROM teacher_accounts ta
            JOIN members m ON m.id = ta.member_id
            WHERE ta.username = $1 AND LOWER(m.role) = 'guru'
            LIMIT 1
        `, [username]);

        const account = result.rows[0];
        if (!account || Number(account.is_active) !== 1 ||
            !await bcrypt.compare(password, account.password_hash)) {
            return res.status(401).json({ message: 'Username atau password salah.' });
        }

        const secret = process.env.JWT_SECRET || 'Nabastala_Secret_Key_2026_XYZ!';
        const token = jwt.sign({
            id: account.member_id,
            member_id: account.member_id,
            username: account.username,
            role: 'guru',
            type: 'teacher'
        }, secret, { expiresIn: '1d' });

        res.cookie('auth_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 24 * 60 * 60 * 1000
        });

        res.json({
            success: true,
            user: {
                id: account.member_id,
                username: account.username,
                nama: account.full_name,
                role: 'guru',
                type: 'teacher'
            },
            token
        });
    } catch (error) {
        console.error('Login guru gagal:', error);
        res.status(500).json({ message: 'Gagal memproses login guru.' });
    }
};

// Pembuatan akun hanya dilakukan admin melalui rute yang dilindungi roleGuard.
exports.createTeacherAccount = async (req, res) => {
    const memberId = Number(req.body?.member_id);
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');

    if (!Number.isInteger(memberId) || memberId < 1 ||
        !/^[a-zA-Z0-9._-]{3,80}$/.test(username) ||
        password.length < 8 || password.length > 200) {
        return res.status(400).json({
            message: 'ID guru harus valid, username 3-80 karakter, dan password 8-200 karakter.'
        });
    }

    try {
        const member = await pool.query(
            "SELECT id FROM members WHERE id = $1 AND LOWER(role) = 'guru'",
            [memberId]
        );
        if (!member.rows.length) {
            return res.status(404).json({ message: 'Data guru tidak ditemukan.' });
        }

        const hash = await bcrypt.hash(password, 10);
        const result = await pool.query(`
            INSERT INTO teacher_accounts (member_id, username, password_hash)
            VALUES ($1, $2, $3)
            RETURNING id, member_id, username, is_active
        `, [memberId, username, hash]);
        // Pastikan akun baru ikut dikirim pada sinkronisasi otomatis berikutnya.
        await pool.query('UPDATE members SET is_synced = 0 WHERE id = $1', [memberId]);

        res.status(201).json({
            success: true,
            account: result.rows[0]
        });
    } catch (error) {
        const message = String(error.message || '');
        if (/UNIQUE constraint|unique/i.test(message) ||
            error.code === '23505' || error.code === 'SQLITE_CONSTRAINT') {
            return res.status(409).json({
                message: 'Guru tersebut sudah memiliki akun atau username sudah digunakan.'
            });
        }
        console.error('Pembuatan akun guru gagal:', error);
        res.status(500).json({ message: 'Gagal membuat akun guru.' });
    }
};
