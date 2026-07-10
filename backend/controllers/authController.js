const { pool } = require('../config/database');
const bcrypt = require('bcryptjs');

exports.login = async (req, res) => {
    const { username, password } = req.body;
    try {
        const r = await pool.query('SELECT * FROM admins WHERE username=$1', [username]);
        if (r.rows.length === 0) return res.status(404).json({ message: "User tidak ditemukan" });
        
        if (!await bcrypt.compare(password, r.rows[0].password)) return res.status(401).json({ message: "Password salah" });
        
        const user = r.rows[0]; delete user.password;
        res.json({ success: true, user });
    } catch (e) { res.status(500).json({ message: "Internal Error" }); }
};

exports.updateProfile = async (req, res) => {
    const { id, nama, username, password } = req.body;
    try {
        if (password) {
            const h = await bcrypt.hash(password, 10);
            await pool.query('UPDATE admins SET nama_admin=$1, username=$2, password=$3 WHERE id=$4', [nama, username, h, id]);
        } else {
            await pool.query('UPDATE admins SET nama_admin=$1, username=$2 WHERE id=$3', [nama, username, id]);
        }
        const u = await pool.query('SELECT * FROM admins WHERE id=$1', [id]);
        delete u.rows[0].password;
        res.json({ success: true, user: u.rows[0] });
    } catch (e) { res.status(500).json({ message: "Gagal update" }); }
};