const cron = require('node-cron');
const { pool } = require('../config/database');
const { addAuditLog } = require('../utils/logger');

// Fungsi untuk merekap ALFA pada tanggal spesifik (YYYY-MM-DD)
const runAutoAlfaForDate = async (targetDateStr, tz = 'Asia/Jakarta') => {
    try {
        const targetDateObj = new Date(targetDateStr + "T00:00:00");
        const dayOfWeek = targetDateObj.getDay(); // 0 = Minggu

        const configRes = await pool.query("SELECT setting_key, setting_value FROM app_settings WHERE setting_key IN ('app_mode', 'jadwal_sekolah')");
        const settingsMap = {};
        configRes.rows.forEach(r => settingsMap[r.setting_key] = r.setting_value);
        
        const appMode = settingsMap['app_mode'] || 'korporat';

        if (appMode === 'edukasi' && settingsMap['jadwal_sekolah']) {
            try {
                const daysMap = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
                const todayName = daysMap[dayOfWeek];
                const jadwal = JSON.parse(settingsMap['jadwal_sekolah'] || "[]");
                const setHariIni = jadwal.find(j => j.day === todayName);
                
                if (setHariIni && !setHariIni.active) {
                    console.log(`Tanggal ${targetDateStr} (${todayName}) diset LIBUR pada Jadwal Sekolah. Tidak ada proses ALFA.`);
                    return 0;
                }
            } catch (e) {
                console.warn("Gagal membaca setting jadwal operasional cron:", e);
            }
        } else {
            if (dayOfWeek === 0) {
                console.log(`Tanggal ${targetDateStr} adalah hari Minggu. Tidak ada proses ALFA.`);
                return 0;
            }
        }

        // Cek apakah tanggal tersebut adalah hari libur (Tanggal Merah)
        const checkHoliday = await pool.query('SELECT * FROM holidays WHERE holiday_date = $1', [targetDateStr]);
        if (checkHoliday.rows.length > 0) {
            console.log(`Tanggal ${targetDateStr} adalah Hari Libur: ${checkHoliday.rows[0].description}. Tidak ada proses ALFA.`);
            return 0;
        }

        // Dapatkan semua member
        const members = await pool.query('SELECT id FROM members');
        let alfaCount = 0;

        for (const member of members.rows) {
            const checkLog = await pool.query(
                'SELECT id FROM attendance_logs WHERE member_id = $1 AND date_log = $2',
                [member.id, targetDateStr]
            );

            if (checkLog.rows.length === 0) {
                await pool.query(
                    'INSERT INTO attendance_logs (member_id, status, date_log) VALUES ($1, $2, $3)',
                    [member.id, 'ALFA', targetDateStr]
                );
                alfaCount++;
            }
        }

        if (alfaCount > 0) {
            console.log(`✅ Berhasil merekap ${alfaCount} pengguna sebagai ALFA untuk tanggal ${targetDateStr}.`);
            await addAuditLog('Sistem Cron', 'Auto-ALFA Rekap', `Tanggal ${targetDateStr}: ${alfaCount} Pengguna`);
        }
        return alfaCount;
    } catch (error) {
        console.error(`❌ Auto-ALFA Error untuk tanggal ${targetDateStr}:`, error);
        return 0;
    }
};

// Pengecekan susulan saat server baru menyala (merekap 7 hari ke belakang hingga kemarin jika server sempat mati)
const runCatchupAutoAlfa = async (tz = 'Asia/Jakarta') => {
    console.log("🔍 Menjalankan Pengecekan Auto-ALFA Susulan (Catch-up Check)...");
    try {
        const today = new Date(new Date().toLocaleString("en-US", { timeZone: tz }));
        for (let i = 1; i <= 7; i++) {
            const pastDateObj = new Date(today);
            pastDateObj.setDate(today.getDate() - i);
            const year = pastDateObj.getFullYear();
            const month = String(pastDateObj.getMonth() + 1).padStart(2, '0');
            const day = String(pastDateObj.getDate()).padStart(2, '0');
            const pastDateStr = `${year}-${month}-${day}`;
            await runAutoAlfaForDate(pastDateStr, tz);
        }
    } catch (e) {
        console.error("❌ Gagal mengeksekusi Catch-up Auto-ALFA:", e);
    }
};

// Berjalan setiap jam 23:55 setiap hari & saat startup
const initAutoAlfa = async () => {
    let tz = 'Asia/Jakarta';
    try {
        const tzRes = await pool.query("SELECT setting_value FROM app_settings WHERE setting_key = 'timezone'");
        if (tzRes.rows.length > 0 && tzRes.rows[0].setting_value) tz = tzRes.rows[0].setting_value;
    } catch (e) {}

    // Jalankan pengecekan susulan saat server baru menyala
    runCatchupAutoAlfa(tz);

    cron.schedule('55 23 * * *', async () => {
        console.log("⏰ Menjalankan Cron Job Auto-ALFA Harian...");
        const tzRes = await pool.query("SELECT setting_value FROM app_settings WHERE setting_key = 'timezone'");
        const currentTz = tzRes.rows.length > 0 ? tzRes.rows[0].setting_value : 'Asia/Jakarta';
        
        const dateOptions = { timeZone: currentTz, year: 'numeric', month: '2-digit', day: '2-digit' };
        const parts = new Intl.DateTimeFormat('en-CA', dateOptions).formatToParts(new Date());
        const localDate = `${parts.find(p => p.type === 'year').value}-${parts.find(p => p.type === 'month').value}-${parts.find(p => p.type === 'day').value}`;

        await runAutoAlfaForDate(localDate, currentTz);
    }, {
        scheduled: true,
        timezone: tz 
    });
};

module.exports = initAutoAlfa;
