const { pool } = require('./config/database');
const bcrypt = require('bcryptjs');

async function resetPassword() {
    // Gunakan username yang tadi Anda temukan
    const username = 'administrator'; 
    const newPassword = 'password123'; // Ini password baru Anda
    
    const h = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE admins SET password=$1 WHERE username=$2', [h, username]);
    
    console.log(`Password untuk user '${username}' telah direset menjadi: ${newPassword}`);
    process.exit();
}

resetPassword();