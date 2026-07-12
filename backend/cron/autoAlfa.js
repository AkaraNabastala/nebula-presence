const cron = require('node-cron');
const { pool } = require('../config/database');
const { addAuditLog } = require('../utils/logger');

// Berjalan setiap jam 23:55 setiap hari
const initAutoAlfa = () => {
    cron.schedule('55 23 * * *', async () => {
        console.log("⏰ Menjalankan Cron Job Auto-ALFA...");
        try {
            // 1. Dapatkan tanggal hari ini di zona waktu lokal
            const tzRes = await pool.query("SELECT setting_value FROM app_settings WHERE setting_key = 'timezone'");
            const tz = tzRes.rows.length > 0 ? tzRes.rows[0].setting_value : 'Asia/Jakarta';
            
            const dateOptions = { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' };
            const parts = new Intl.DateTimeFormat('en-CA', dateOptions).formatToParts(new Date());
            const localDate = `${parts.find(p => p.type === 'year').value}-${parts.find(p => p.type === 'month').value}-${parts.find(p => p.type === 'day').value}`;

            // Cek pengaturan jadwal aktif berdasarkan mode
            const configRes = await pool.query("SELECT setting_key, setting_value FROM app_settings WHERE setting_key IN ('app_mode', 'jadwal_sekolah')");
            const settingsMap = {};
            configRes.rows.forEach(r => settingsMap[r.setting_key] = r.setting_value);
            
            const appMode = settingsMap['app_mode'] || 'korporat';
            const today = new Date(new Date().toLocaleString("en-US", {timeZone: tz}));
            const dayOfWeek = today.getDay(); // 0 = Minggu

            if (appMode === 'edukasi' && settingsMap['jadwal_sekolah']) {
                try {
                    const daysMap = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
                    const todayName = daysMap[dayOfWeek];
                    const jadwal = JSON.parse(settingsMap['jadwal_sekolah'] || "[]");
                    const setHariIni = jadwal.find(j => j.day === todayName);
                    
                    if (setHariIni && !setHariIni.active) {
                        console.log(`Hari ini (${todayName}) diset LIBUR pada Jadwal Sekolah. Tidak ada proses ALFA.`);
                        return;
                    }
                } catch (e) {
                    console.warn("Gagal membaca setting jadwal operasional cron:", e);
                }
            } else {
                // Mode Korporat / Default: Minggu tetap libur
                if (dayOfWeek === 0) {
                    console.log("Hari ini adalah hari Minggu. Tidak ada proses ALFA.");
                    return;
                }
            }

            // Cek apakah hari ini adalah hari libur (Tanggal Merah)
            const checkHoliday = await pool.query('SELECT * FROM holidays WHERE holiday_date = $1', [localDate]);
            if (checkHoliday.rows.length > 0) {
                console.log(`Hari ini adalah Hari Libur: ${checkHoliday.rows[0].description}. Tidak ada proses ALFA.`);
                return;
            }

            // 2. Dapatkan semua member
            const members = await pool.query('SELECT id FROM members');

            let alfaCount = 0;

            for (const member of members.rows) {
                // 3. Cek apakah member ini sudah ada log hari ini
                const checkLog = await pool.query(
                    'SELECT id FROM attendance_logs WHERE member_id = $1 AND date_log = $2',
                    [member.id, localDate]
                );

                // 4. Jika belum ada, masukkan sebagai ALFA
                if (checkLog.rows.length === 0) {
                    await pool.query(
                        'INSERT INTO attendance_logs (member_id, status, date_log) VALUES ($1, $2, $3)',
                        [member.id, 'ALFA', localDate]
                    );
                    alfaCount++;
                }
            }

            if (alfaCount > 0) {
                console.log(`✅ Berhasil merekap ${alfaCount} anggota sebagai ALFA untuk tanggal ${localDate}.`);
                await addAuditLog('Sistem Cron', 'Auto-ALFA Rekap', `Jumlah: ${alfaCount} Anggota`);
            } else {
                console.log("✅ Semua anggota sudah absen hari ini.");
            }

        } catch (error) {
            console.error("❌ Auto-ALFA Cron Job Error:", error);
        }
    }, {
        scheduled: true,
        timezone: "Asia/Jakarta" 
    });
};

module.exports = initAutoAlfa;
