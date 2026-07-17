const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const CryptoJS = require("crypto-js");
const { machineIdSync } = require('node-machine-id');

const userDataPath = path.join(os.homedir(), '.nebula-presence-app');
fs.ensureDirSync(userDataPath);
const LICENSE_PATH = path.join(userDataPath, 'license.key');
// Pastikan tidak ada spasi di sekitar kunci ini
const SECRET_KEY = process.env.LICENSE_KEY || "Nabastala_2026_Digital_Solution@16092001";

const getMachineID = () => machineIdSync();

const checkLicenseInternal = () => {
    try {
        if (!fs.existsSync(LICENSE_PATH)) {
            return { valid: false, message: "File lisensi tidak ditemukan." };
        }

        const ciphertext = fs.readFileSync(LICENSE_PATH, 'utf8').trim();
        const bytes = CryptoJS.AES.decrypt(ciphertext, SECRET_KEY);
        const originalText = bytes.toString(CryptoJS.enc.Utf8);

        if (!originalText) return { valid: false, message: "Lisensi rusak/tidak valid." };

        const data = JSON.parse(originalText);
        const now = new Date();
        const expiredDate = new Date(data.expired);
        const createdDate = new Date(data.createdAt);

        // 1. HARDWARE LOCK
        if (data.machineId !== getMachineID()) {
            return { valid: false, message: "Lisensi terkunci pada perangkat lain!" };
        }

        // 2. ANTI TIME TRAVEL (Dengan toleransi 24 jam untuk mengatasi bug perbedaan waktu server/klien/WSL)
        const driftTolerance = 24 * 60 * 60 * 1000; 
        if (now.getTime() < (createdDate.getTime() - driftTolerance)) {
            return { valid: false, message: "Manipulasi waktu terdeteksi! Perbaiki jam sistem." };
        }

        const remainingSeconds = Math.floor((expiredDate.getTime() - now.getTime()) / 1000);
        if (remainingSeconds <= 0) {
            return { valid: false, expired: true, owner: data.owner, remainingSeconds: 0 };
        }

        return {
            valid: true,
            owner: data.owner,
            machineId: data.machineId,
            type: data.type || 'perdana', // Default to perdana for backward compatibility
            expired: data.expired,
            remainingSeconds
        };
    } catch (error) {
        return { valid: false, message: "Gagal verifikasi lisensi." };
    }
};

const processActivationData = (code) => {
    try {
        // --- POWERFULL FIX: Anti-Spasi & Anti-Enter ---
        // Menghapus semua jenis spasi, enter, atau tab yang tidak sengaja ter-copy dari terminal
        const cleanCode = code.replace(/\s/g, ''); 
        
        const bytes = CryptoJS.AES.decrypt(cleanCode, SECRET_KEY);
        const text = bytes.toString(CryptoJS.enc.Utf8);
        
        if (!text) return null; // Jika dekripsi gagal karena kunci salah
        
        return JSON.parse(text);
    } catch (e) { 
        return null; 
    }
};

const saveLicenseFile = (finalData) => {
    const dataToSave = { ...finalData, machineId: getMachineID() };
    const finalCipher = CryptoJS.AES.encrypt(JSON.stringify(dataToSave), SECRET_KEY).toString();
    fs.writeFileSync(LICENSE_PATH, finalCipher);
};

module.exports = { 
    checkLicenseInternal, 
    processActivationData, 
    saveLicenseFile, 
    getMachineID, 
    SECRET_KEY, 
    LICENSE_PATH 
};