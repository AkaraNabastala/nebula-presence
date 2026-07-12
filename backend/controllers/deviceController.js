const { pool } = require('../config/database');
const ZKLib = require('node-zklib');

exports.getAllDevices = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM devices ORDER BY id ASC');
        res.json({ success: true, devices: result.rows });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, message: "Gagal memuat perangkat" });
    }
};

exports.addDevice = async (req, res) => {
    const { name, ip_address, port } = req.body;
    try {
        const r = await pool.query(
            'INSERT INTO devices (name, ip_address, port, status) VALUES ($1, $2, $3, $4) RETURNING *',
            [name, ip_address, port || 4370, 'offline']
        );
        res.json({ success: true, message: "Perangkat ditambahkan", device: r.rows[0] });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, message: "Gagal menambah perangkat" });
    }
};

exports.deleteDevice = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM devices WHERE id=$1', [id]);
        res.json({ success: true, message: "Perangkat dihapus" });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, message: "Gagal menghapus perangkat" });
    }
};

exports.testConnection = async (req, res) => {
    const { ip_address, port } = req.body;
    try {
        const zkInstance = new ZKLib(ip_address, port || 4370, 5200, 5000);
        await zkInstance.createSocket();
        
        // Coba konek
        await zkInstance.connect(); // ini akan throw error jika gagal

        // Putuskan koneksi
        await zkInstance.disconnect();
        res.json({ success: true, message: "Koneksi berhasil ke perangkat ZKTeco!" });
    } catch (e) {
        console.error("ZKTeco Connect Error:", e);
        res.status(400).json({ success: false, message: "Gagal terhubung ke IP tersebut. Pastikan jaringan satu segmen dan port benar." });
    }
};
