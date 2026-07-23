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
        if (e.code === '23505' || e.code === 'SQLITE_CONSTRAINT' || (e.message && e.message.includes('UNIQUE constraint'))) {
            return res.status(400).json({ success: false, message: "IP Address ini sudah digunakan oleh perangkat lain" });
        }
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
        
        // Putuskan koneksi
        await zkInstance.disconnect();
        res.json({ success: true, message: "Koneksi berhasil ke mesin absensi!" });
    } catch (e) {
        console.error("Mesin Absensi Connect Error:", e);
        res.status(500).json({ success: false, message: "Gagal terhubung ke mesin absensi" });
    }
};

const performAutoSyncDevices = async (io) => {
    try {
        const devices = await pool.query("SELECT * FROM devices WHERE status != 'disabled'");
        if (devices.rows.length === 0) return;

        console.log(`[Tarik Data Otomatis] Menjalankan penarikan data dari ${devices.rows.length} mesin...`);

        const tzRes = await pool.query("SELECT setting_value FROM app_settings WHERE setting_key = 'timezone'");
        const tz = (tzRes.rows.length > 0 && tzRes.rows[0].setting_value) ? tzRes.rows[0].setting_value : 'Asia/Jakarta';
        const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: tz });
        const { processScanCore } = require('./attendanceController');

        for (const dev of devices.rows) {
            let zkInstance = null;
            try {
                zkInstance = new ZKLib(dev.ip_address, dev.port || 4370, 8000, 4000);
                await zkInstance.createSocket();
                const attendances = await zkInstance.getAttendances();
                try { await zkInstance.disconnect(); } catch (e) {}

                if (attendances && attendances.data && attendances.data.length > 0) {
                    const todayLogs = attendances.data.filter(log => {
                        if (!log.recordTime) return false;
                        const logDateStr = new Date(log.recordTime).toLocaleDateString('en-CA', { timeZone: tz });
                        return logDateStr === todayStr;
                    });

                    let count = 0;
                    for (const log of todayLogs) {
                        if (log.deviceUserId) {
                            const historicalDateObj = new Date(log.recordTime);
                            const result = await processScanCore(log.deviceUserId, historicalDateObj, io);
                            if (result.success) count++;
                        }
                    }
                    console.log(`[Tarik Data Otomatis] Mesin ${dev.name}: Berhasil menarik ${count} data absen.`);
                }
            } catch (err) {
                console.log(`[Tarik Data Otomatis] Mesin ${dev.name} (${dev.ip_address}): ${err.message || 'Gagal terhubung'}`);
                try { if (zkInstance) await zkInstance.disconnect(); } catch (e) {}
            }
        }
    } catch (e) {
        console.error("[Tarik Data Otomatis] Error:", e.message);
    }
};

exports.performAutoSyncDevices = performAutoSyncDevices;

exports.syncDeviceLogs = async (req, res) => {
    const { ip_address, port } = req.body;
    const { processScanCore } = require('./attendanceController');
    
    try {
        const zkInstance = new ZKLib(ip_address, port || 4370, 10000, 4000);
        await zkInstance.createSocket();
        
        // Dapatkan data riwayat absen dari mesin
        const attendances = await zkInstance.getAttendances();
        await zkInstance.disconnect();

        if (!attendances || !attendances.data || attendances.data.length === 0) {
            return res.json({ success: true, message: "Tidak ada data riwayat di mesin.", count: 0 });
        }

        // Saring hanya untuk log hari ini
        const tzRes = await pool.query("SELECT setting_value FROM app_settings WHERE setting_key = 'timezone'");
        const tz = (tzRes.rows.length > 0 && tzRes.rows[0].setting_value) ? tzRes.rows[0].setting_value : 'Asia/Jakarta';
        
        const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: tz });
        
        const todayLogs = attendances.data.filter(log => {
            if (!log.recordTime) return false;
            const logDateStr = new Date(log.recordTime).toLocaleDateString('en-CA', { timeZone: tz });
            return logDateStr === todayStr;
        });

        if (todayLogs.length === 0) {
            return res.json({ success: true, message: "Tidak ada riwayat absen untuk hari ini di mesin.", count: 0 });
        }

        let successCount = 0;
        
        for (const log of todayLogs) {
            if (log.deviceUserId) {
                const historicalDateObj = new Date(log.recordTime);
                const result = await processScanCore(log.deviceUserId, historicalDateObj, req.app.get('io'));
                if (result.success) {
                    successCount++;
                }
            }
        }

        res.json({ success: true, message: `Berhasil menyelamatkan ${successCount} riwayat absen hari ini.`, count: successCount });
    } catch (e) {
        console.error("Sync Offline Logs Error:", e);
        res.status(500).json({ success: false, message: "Gagal menarik data. Mesin mungkin offline." });
    }
};
