const crypto = require('crypto');

const machineId = process.argv[2];

if (!machineId) {
    console.log("=========================================");
    console.log("❌ ERROR: Machine ID tidak disertakan!");
    console.log("Cara penggunaan:");
    console.log("node generator_reset.js <MACHINE_ID_KLIEN>");
    console.log("=========================================");
    process.exit(1);
}

// Secret Salt harus sama dengan yang ada di backend (authController)
const secretSalt = "NebulaTech_MasterReset_2026";

// Buat hash dari Machine ID + Salt
const hash = crypto.createHash('sha256').update(machineId + secretSalt).digest('hex');

// Ambil 6 karakter pertama sebagai kode reset dan jadikan huruf kapital
const resetCode = hash.substring(0, 6).toUpperCase();

console.log(`\n========================================`);
console.log(` ✨ NEBULA TECH - RESET GENERATOR ✨`);
console.log(`========================================`);
console.log(`🔑 Machine ID : ${machineId}`);
console.log(`🔓 KODE RESET : ${resetCode}`);
console.log(`========================================`);
console.log(`Berikan KODE RESET ini kepada klien.`);
console.log(`\n`);
