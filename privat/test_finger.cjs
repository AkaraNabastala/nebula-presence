const ZKLib = require('node-zklib');

async function test() {
    const ip = '192.168.1.230';
    const port = 4370;
    console.log(`Mencoba koneksi ke ZKTeco pada IP: ${ip}, Port: ${port}`);
    
    try {
        const zkInstance = new ZKLib(ip, port, 5200, 5000);
        await zkInstance.createSocket();
        console.log("Socket dibuat...");
        
        await zkInstance.connect();
        console.log("✅ BERHASIL TERHUBUNG!");
        
        const info = await zkInstance.getInfo();
        console.log("Info Mesin:", info);
        
        await zkInstance.disconnect();
    } catch (e) {
        console.error("🔥 GAGAL TERHUBUNG. Pesan Error Asli:");
        console.error(e);
    }
}

test();
