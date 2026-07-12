const { pool } = require('../config/database');
const { addAuditLog } = require('../utils/logger');

exports.getHolidays = async (req, res) => {
    try {
        const { year, month } = req.query;
        let query = 'SELECT * FROM holidays ORDER BY holiday_date ASC';
        let params = [];
        
        if (year && month) {
            query = 'SELECT * FROM holidays WHERE EXTRACT(YEAR FROM holiday_date) = $1 AND EXTRACT(MONTH FROM holiday_date) = $2 ORDER BY holiday_date ASC';
            params = [year, month];
        }

        const r = await pool.query(query, params);
        res.json({ success: true, data: r.rows });
    } catch (e) {
        console.error("Error getHolidays:", e);
        res.status(500).json({ success: false, message: "Gagal memuat hari libur" });
    }
};

exports.addHoliday = async (req, res) => {
    const { date, description } = req.body;
    if (!date) return res.status(400).json({ success: false, message: "Tanggal harus diisi" });

    try {
        await pool.query('INSERT INTO holidays (holiday_date, description) VALUES ($1, $2)', [date, description]);
        await addAuditLog(req.user?.nama_admin || 'Admin', 'Tambah Hari Libur', `${date} - ${description}`);
        res.json({ success: true, message: "Hari libur ditambahkan" });
    } catch (e) {
        if (e.code === '23505') {
            return res.status(400).json({ success: false, message: "Tanggal ini sudah ditandai sebagai hari libur" });
        }
        res.status(500).json({ success: false, message: "Gagal menambahkan hari libur" });
    }
};

exports.deleteHoliday = async (req, res) => {
    try {
        await pool.query('DELETE FROM holidays WHERE id = $1', [req.params.id]);
        await addAuditLog(req.user?.nama_admin || 'Admin', 'Hapus Hari Libur', `ID: ${req.params.id}`);
        res.json({ success: true, message: "Hari libur dihapus" });
    } catch (e) {
        res.status(500).json({ success: false, message: "Gagal menghapus hari libur" });
    }
};
