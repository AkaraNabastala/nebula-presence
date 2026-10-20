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