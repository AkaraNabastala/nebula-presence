/* global require, process */
const CryptoJS = require("crypto-js");
const readline = require("readline");

// ⚠️ PENTING: KEY INI HARUS SAMA PERSIS DENGAN DI BACKEND (.env)
const SECRET_KEY = "Nabastala_2026_Digital_Solution@16092001";

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const askQuestion = (q) => {
    return new Promise(resolve => rl.question(q, resolve));
};

const createLicenseToken = (owner, machineId, days, type) => {
    const now = new Date();
    let expiredDate;

    // Logika durasi
    if (days === 0) {
        expiredDate = new Date();
        expiredDate.setFullYear(expiredDate.getFullYear() + 100); 
    } else {
        expiredDate = new Date();
        expiredDate.setTime(now.getTime() + (days * 24 * 60 * 60 * 1000));
    }

    // OBJEK DATA (Sekarang menyertakan machineId untuk Hardware Lock dan type)
    const data = {
        owner: owner,
        machineId: machineId.trim(), // Ini kunci keamanannya
        type: type, // 'perdana', 'perpanjangan', 'migrasi', 'reset_password'
        createdAt: now.toISOString(),
        expired: expiredDate.toISOString()
    };

    const ciphertext = CryptoJS.AES.encrypt(
        JSON.stringify(data),
        SECRET_KEY
    ).toString();

    console.log(`\n============================================`);
    console.log(` 🛡️  NABASTALA SECURE TOKEN GENERATED`);
    console.log(`============================================`);
    console.log(`Pemilik    : ${owner}`);
    console.log(`ID Perangkat: ${machineId}`);
    console.log(`Tipe Lisensi: ${type.toUpperCase()}`);
    console.log(`Durasi     : ${days === 0 ? "UNLIMITED (100 Tahun)" : days + " Hari"}`);
    console.log(`Expired    : ${expiredDate.toLocaleString("id-ID")}`);
    console.log(`\n>>> SALIN TOKEN DI BAWAH INI <<<\n`);
    console.log(ciphertext);
    console.log(`\n============================================\n`);
};

(async () => {
    try {
        console.log("--- GENERATOR LISENSI NABASTALA ---");
        
        const owner = await askQuestion("1. Masukkan Nama Instansi: ");
        const mid = await askQuestion("2. Masukkan Machine ID Client: ");
        
        console.log("\n--- TIPE LISENSI ---");
        console.log("1. Perdana (Setup Awal / Komputer Baru)");
        console.log("2. Perpanjangan (Perpanjang lisensi lama)");
        console.log("3. Pindah Device (Ganti Komputer/HWID)");
        console.log("4. RESET PASSWORD ADMIN (Lupa Password)");
        console.log("5. CABUT LISENSI (Kunci Reset/Expired Cepat)");
        const typeChoice = await askQuestion("Pilih Tipe (1/2/3/4/5): ");
        
        let type = 'perdana';
        let isReset = false;
        let isResetPassword = false;
        
        if (typeChoice === '2') type = 'perpanjangan';
        if (typeChoice === '3') type = 'migrasi';
        if (typeChoice === '4') {
            type = 'reset_password';
            isResetPassword = true;
        }
        if (typeChoice === '5') {
            type = 'perpanjangan'; // Dianggap perpanjangan agar bisa masuk ke sistem lama
            isReset = true;
        }
        
        let days = 0;
        if (isReset) {
            days = -1; // Otomatis expired
            console.log("\n⚠️ Membuat kunci pemblokiran instan...");
        } else if (isResetPassword) {
            days = 1; // Berlaku 1 hari saja untuk reset
            console.log("\n⚠️ Membuat kunci darurat Reset Password (admin123)...");
        } else {
            const durationInput = await askQuestion("3. Masukkan Durasi (hari) | 0 = UNLIMITED: ");
            days = parseInt(durationInput);
        }

        if (isNaN(days) || (!isReset && days < 0) || !mid) {
            console.log("❌ Data tidak valid! Pastikan Machine ID terisi.");
        } else {
            createLicenseToken(owner, mid, days, type);
        }
    } catch (err) {
        console.error("Terjadi kesalahan:", err);
    } finally {
        rl.close();
    }
})();
