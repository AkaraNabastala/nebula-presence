const { pool } = require('../config/database');
const { getSyncStatus, performCloudSync } = require('../services/cloudSyncService');

exports.getStatus = async (req, res) => {
    try {
        const status = await getSyncStatus(pool);
        res.json({ success: true, ...status });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
};

exports.triggerSync = async (req, res) => {
    try {
        const io = req.app.get('io');
        const result = await performCloudSync(pool, io, true);
        res.json(result);
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
};

exports.saveSettings = async (req, res) => {
    const { cloud_sync_active, cloud_sync_url, cloud_sync_token } = req.body;
    try {
        const updates = [
            ['cloud_sync_active', cloud_sync_active ? '1' : '0'],
            ['cloud_sync_url', cloud_sync_url || ''],
            ['cloud_sync_token', cloud_sync_token || '']
        ];
        for (const [k, v] of updates) {
            await pool.query(
                `INSERT INTO app_settings (setting_key, setting_value) VALUES ($1, $2) ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value`,
                [k, v]
            );
        }
        res.json({ success: true, message: "Pengaturan Cloud Sync tersimpan!" });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
};
