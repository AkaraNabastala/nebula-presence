const { pool } = require('../config/database');

const addAuditLog = async (adminName, action, target) => {
    try {
        await pool.query(
            'INSERT INTO audit_logs (admin_name, action, target) VALUES ($1, $2, $3)',
            [adminName || 'Sistem', action, target || '-']
        );
    } catch (error) {
        console.error("Gagal mencatat audit log:", error);
    }
};

module.exports = { addAuditLog };
