const { pool } = require('../config/database');
const fs = require('fs-extra');
const CryptoJS = require("crypto-js");
const { checkLicenseInternal, processActivationData, saveLicenseFile, LICENSE_PATH, SECRET_KEY } = require('../utils/licenseManager');
const { machineIdSync } = require('node-machine-id'); // <-- TAMBAHAN 1: Import pembaca ID Hardware

// Mengubah menjadi async karena kita perlu melakukan query HWID ke database
exports.checkStatus = async (req, res) => {
    const status = checkLicenseInternal();

    // <-- MULAI TAMBAHAN 2: Validasi Anti-Copy Paste File / Folder Lisensi
    // Kita cek HWID hardware fisik dengan HWID yang tersimpan di database saat aktivasi
    if (status.valid) {
        try {
            const hwidSaatIni = machineIdSync();
            const dbHwid = await pool.query("SELECT setting_value FROM app_settings WHERE setting_key = 'hardware_id'");

            if (dbHwid.rowCount > 0) {
                const hwidTersimpan = dbHwid.rows[0].setting_value;
                if (hwidSaatIni !== hwidTersimpan) {
                    return res.status(403).json({
                        valid: false,
                        isLocked: true,
                        machineId: hwidSaatIni,
                        message: "PELANGGARAN LISENSI: Aplikasi tidak sah! Terdeteksi pemindahan ke komputer lain."
                    });
                }
            }
        } catch (err) {
            console.error("Gagal memvalidasi HWID:", err.message);
        }
    }
    // <-- AKHIR TAMBAHAN 2

    const currentHwid = machineIdSync();
    if (!status.valid) {
        console.error(`[LISENSI DITOLAK] Alasan: ${status.message} | HWID: ${currentHwid}`);
        return res.status(403).json({ ...status, isLocked: true, machineId: currentHwid });
    }
    res.json({ ...status, machineId: currentHwid });
};

exports.activate = async (req, res) => {
    const { code } = req.body;
    if (!code) return res.status(400).json({ success: false, message: "Kode aktivasi kosong." });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const hwidKlien = machineIdSync(); // <-- TAMBAHAN 3: Ambil ID Hardware saat proses aktivasi dimulai

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

        // --- MULAI TAMBAHAN ANTI-PEMBAJAKAN ---
        const keyType = newData.type || 'perdana'; // Default perdana untuk kunci versi lama
        
        // --- VALIDASI HARDWARE LOCK PADA SAAT AKTIVASI ---
        if (newData.machineId && newData.machineId !== hwidKlien && keyType !== 'migrasi') {
            throw new Error(`KODE DITOLAK: Kode ini dibuat untuk ID Mesin lain. ID Mesin Anda: ${hwidKlien}`);
        }

        const dbHwidCheck = await client.query("SELECT setting_value FROM app_settings WHERE setting_key = 'hardware_id'");
        
        let isFreshOrMigrated = true;
        if (dbHwidCheck.rowCount > 0 && dbHwidCheck.rows[0].setting_value === hwidKlien) {
            isFreshOrMigrated = false; // Komputer ini sudah pernah di-setup dan HWID-nya cocok
        }

        // Jika ini komputer baru (atau copy-paste db dari komputer lain) dan user mencoba pakai kunci perpanjangan murah
        if (isFreshOrMigrated && keyType === 'perpanjangan') {
            throw new Error("KODE DITOLAK: Komputer ini belum pernah di-setup awal (atau HWID berubah). Anda wajib menggunakan Lisensi Perdana (Setup Awal)!");
        }

        // --- TAMBAHAN RESET PASSWORD ADMIN ---
        if (keyType === 'reset_password') {
            const bcrypt = require('bcryptjs'); // Pastikan bcrypt tersedia, kalau tidak pakai crypto
            const newPasswordHash = await bcrypt.hash('admin123', 10);
            await client.query(`
                INSERT INTO admins (username, password, nama_admin, role) 
                VALUES ('admin', $1, 'Administrator', 'SuperAdmin')
                ON CONFLICT (username) DO UPDATE SET password = $2
            `, [newPasswordHash, newPasswordHash]);
            
            // Catat kunci agar tidak bisa dipakai lagi
            await client.query('INSERT INTO used_licenses (license_hash, used_at) VALUES ($1, NOW())', [codeHash]);
            await client.query('COMMIT');
            
            return res.json({ 
                success: true, 
                message: "RESET BERHASIL: Password Admin telah dikembalikan menjadi 'admin123'." 
            });
        }
        // --- AKHIR TAMBAHAN ANTI-PEMBAJAKAN ---

        // 3. Logika Akumulasi Masa Aktif
        let finalExpiredDate = new Date(newData.expired);
        const currentStatus = checkLicenseInternal();
        
        if (currentStatus.valid && fs.existsSync(LICENSE_PATH)) {
            try {
                const oldCipher = fs.readFileSync(LICENSE_PATH, 'utf8').trim();
                const bytes = CryptoJS.AES.decrypt(oldCipher, SECRET_KEY);
                const oldData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
                const oldExp = new Date(oldData.expired);
                
                // Jika lisensi lama masih berlaku, tambahkan durasinya (KECUALI CABUT LISENSI)
                if (oldExp > new Date() && keyType !== 'cabut') {
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
            expired: finalExpiredDate.toISOString(),
            machineId: hwidKlien // <-- PERBAIKAN: Gunakan 'machineId' agar sesuai dengan licenseManager.js
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
            DO UPDATE SET setting_value = $2
        `, [finalData.owner, finalData.owner]);

        // <-- MULAI TAMBAHAN 5: Menyimpan HWID ke database app_settings sebagai kunci pembanding
        await client.query(`
            INSERT INTO app_settings (setting_key, setting_value) 
            VALUES ('hardware_id', $1) 
            ON CONFLICT (setting_key) 
            DO UPDATE SET setting_value = $2
        `, [hwidKlien, hwidKlien]);
        // <-- AKHIR TAMBAHAN 5

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