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

const createLicenseToken = (owner, machineId, days) => {
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

    // OBJEK DATA (Sekarang menyertakan machineId untuk Hardware Lock)
    const data = {
        owner: owner,
        machineId: machineId.trim(), // Ini kunci keamanannya
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
        const durationInput = await askQuestion("3. Masukkan Durasi (hari) | 0 = UNLIMITED: ");

        const days = parseInt(durationInput);

        if (isNaN(days) || days < 0 || !mid) {
            console.log("❌ Data tidak valid! Pastikan Machine ID terisi.");
        } else {
            createLicenseToken(owner, mid, days);
        }
    } catch (err) {
        console.error("Terjadi kesalahan:", err);
    } finally {
        rl.close();
    }
})();