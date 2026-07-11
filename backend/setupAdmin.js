const bcrypt = require('bcryptjs');
const { pool } = require('./config/database');

async function setup() {
    try {
        // Enkripsi kata sandi 'admin123'
        const hashedPassword = await bcrypt.hash('admin123', 10);
        
        // Cek apakah admin sudah ada
        const check = await pool.query("SELECT * FROM admins WHERE username = 'admin'");
        
        if (check.rows.length > 0) {
            // Update jika sudah ada
            await pool.query("UPDATE admins SET password = $1 WHERE username = 'admin'", [hashedPassword]);
            console.log("Berhasil! Password admin telah dienkripsi (Hash di-update).");
        } else {
            // Insert jika belum ada
            await pool.query(
                "INSERT INTO admins (username, password, nama_admin) VALUES ($1, $2, $3)", 
                ['admin', hashedPassword, 'Administrator Utama']
            );
            console.log("Berhasil! Akun admin baru dibuat dengan password terenkripsi.");
        }
    } catch (error) {
        console.error("Terjadi kesalahan:", error);
    } finally {
        process.exit(); // Matikan skrip setelah selesai
    }
}

setup();