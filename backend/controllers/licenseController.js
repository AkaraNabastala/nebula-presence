const { pool } = require('../config/database');
const fs = require('fs-extra');
const CryptoJS = require("crypto-js");
const { checkLicenseInternal, processActivationData, saveLicenseFile, LICENSE_PATH, SECRET_KEY } = require('../utils/licenseManager');

exports.checkStatus = (req, res) => {
    const status = checkLicenseInternal();
    if (!status.valid) return res.status(403).json({ ...status, isLocked: true });
    res.json(status);
};

exports.activate = async (req, res) => {
    const { code } = req.body;
    if (!code) return res.status(400).json({ success: false, message: "Kode aktivasi kosong." });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Hashing kode untuk pengecekan di Database
        const codeHash = CryptoJS.SHA256(code).toString();

        // FIX: Mengubah 'SELECT id' menjadi 'SELECT license_hash' karena kolom 'id' tidak ada
        const checkDb = await client.query(
            'SELECT license_hash FROM used_licenses WHERE license_hash = $1', 
            [codeHash]
        );

        if (checkDb.rowCount > 0) {
            throw new Error("KODE GAGAL: Kode lisensi ini sudah pernah digunakan sebelumnya!");
        }

        // 2. Dekripsi dan validasi isi kode
        const newData = processActivationData(code);
        if (!newData) {
            throw new Error("KODE GAGAL: Format kode tidak valid atau kunci enkripsi salah.");
        }

        // 3. Logika Akumulasi Masa Aktif
        let finalExpiredDate = new Date(newData.expired);
        const currentStatus = checkLicenseInternal();
        
        if (currentStatus.valid && fs.existsSync(LICENSE_PATH)) {
            try {
                const oldCipher = fs.readFileSync(LICENSE_PATH, 'utf8').trim();
                const bytes = CryptoJS.AES.decrypt(oldCipher, SECRET_KEY);
                const oldData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
                const oldExp = new Date(oldData.expired);
                
                // Jika lisensi lama masih berlaku, tambahkan durasinya
                if (oldExp > new Date()) {
                    const durationToAdd = new Date(newData.expired).getTime() - new Date(newData.createdAt).getTime();
                    finalExpiredDate = new Date(oldExp.getTime() + durationToAdd);
                }
            } catch (err) {
                // Abaikan jika file lama rusak, gunakan tanggal dari kode baru
            }
        }

        const finalData = {
            owner: newData.owner,
            createdAt: new Date().toISOString(),
            expired: finalExpiredDate.toISOString()
        };

        // 4. Simpan ke File fisik (license.key)
        saveLicenseFile(finalData);

        // 5. Catat Hash kode ke Database agar tidak bisa dipakai ulang
        await client.query(
            'INSERT INTO used_licenses (license_hash, used_at) VALUES ($1, NOW())', 
            [codeHash]
        );

        await client.query(`
            INSERT INTO app_settings (setting_key, setting_value) 
            VALUES ('nama_sekolah', $1) 
            ON CONFLICT (setting_key) 
            DO UPDATE SET setting_value = $1
        `, [finalData.owner]);

        await client.query('COMMIT');
        res.json({ success: true, message: "Aktivasi Berhasil! Sistem Anda kini aktif." });

    } catch (e) {
        await client.query('ROLLBACK');
        console.error("Activation Error:", e.message);
        res.status(400).json({ 
            success: false, 
            message: e.message || "Terjadi kesalahan saat aktivasi." 
        });
    } finally {
        client.release();
    }
};