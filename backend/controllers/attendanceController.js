const { pool } = require('../config/database');
const { addAuditLog } = require('../utils/logger');

exports.scanRFID = async (req, res) => {
    const { rfid_code, tanggal } = req.body;
    
    if (!rfid_code) return res.status(400).json({ message: "Kode ID Kosong" });
    const cleanCode = String(rfid_code).trim();

    try {
        // A. PENCARIAN MEMBER
        const findMemberQuery = `
            SELECT m.*, d.name as division_name 
            FROM members m 
            LEFT JOIN divisions d ON m.division_id = d.id
            WHERE LOWER(m.rfid_code) = LOWER($1) 
               OR LOWER(m.identity_number) = LOWER($1)
            LIMIT 1
        `;
        const memberRes = await pool.query(findMemberQuery, [cleanCode]);

        if (memberRes.rows.length === 0) {
            return res.status(404).json({ message: "ID Tidak Terdaftar" });
        }
        const member = memberRes.rows[0];

        // B. LOGIKA WAKTU (Sinkronisasi JS dan PostgreSQL)
        const tzRes = await pool.query("SELECT setting_value FROM app_settings WHERE setting_key = 'timezone'");
        let activeTimezone = 'Asia/Jakarta';
        if (tzRes.rows.length > 0 && tzRes.rows[0].setting_value) {
            activeTimezone = tzRes.rows[0].setting_value;
        }

        const now = new Date();
        const localDate = tanggal || now.toLocaleDateString('en-CA', { timeZone: activeTimezone }); 
        const currentTime = now.toLocaleTimeString('en-GB', { timeZone: activeTimezone, hour12: false });
        
        // Buat ISO string untuk memastikan Database menerima waktu yang sama dengan server Node.js
        const serverTimestamp = now.toISOString(); 

        // C. LOGIKA JADWAL & SHIFT
        const configRes = await pool.query("SELECT setting_key, setting_value FROM app_settings WHERE setting_key IN ('jadwal_sekolah', 'company_shifts', 'app_mode')");
        
        let limitIn = "07:00"; 
        let limitOut = "16:00"; 
        let isHoliday = false;
        
        const settingsMap = {};
        configRes.rows.forEach(r => settingsMap[r.setting_key] = r.setting_value);
        
        const appMode = settingsMap['app_mode'] || 'korporat';

        if (settingsMap['jadwal_sekolah']) {
            try {
                const daysMap = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
                const dayIndex = new Date(now.toLocaleString("en-US", {timeZone: activeTimezone})).getDay();
                const todayName = daysMap[dayIndex];
                
                const jadwal = JSON.parse(settingsMap['jadwal_sekolah'] || "[]");
                const setHariIni = jadwal.find(j => j.day === todayName);
                if (setHariIni) {
                    if (!setHariIni.active) isHoliday = true;
                    // Hanya set limitIn/Out dari sini jika mode edukasi
                    if (appMode === 'edukasi') {
                        limitIn = setHariIni.in || limitIn;
                        limitOut = setHariIni.out || limitOut;
                    }
                }
            } catch (e) {
                console.warn("Gagal membaca setting jadwal operasional.");
            }
        }

        if (appMode === 'korporat' && settingsMap['company_shifts']) {
            try {
                // Logika Auto-Detect Shift untuk Karyawan
                const shifts = JSON.parse(settingsMap['company_shifts'] || "[]");
                if (shifts.length > 0) {
                    const [cHour, cMin] = currentTime.split(':').map(Number);
                    const currentMinutes = cHour * 60 + cMin;
                    
                    let bestShift = shifts[0];
                    let minDiff = Infinity;
                    
                    shifts.forEach(shift => {
                        const [sHour, sMin] = (shift.in || '00:00').split(':').map(Number);
                        const shiftMinutes = sHour * 60 + sMin;
                        const diff = Math.abs(currentMinutes - shiftMinutes);
                        
                        if (diff < minDiff) {
                            minDiff = diff;
                            bestShift = shift;
                        }
                    });
                    
                    limitIn = bestShift.in || limitIn;
                    limitOut = bestShift.out || limitOut;
                }
            } catch (e) {
                console.warn("Gagal mendeteksi shift, menggunakan default.");
            }
        }

        // D. CEK RIWAYAT HARI INI
        const checkLog = await pool.query('SELECT * FROM attendance_logs WHERE member_id=$1 AND date_log=$2', [member.id, localDate]);

        // === MASUK (CHECK IN) ===
        if (checkLog.rows.length === 0) {
            if (isHoliday) {
                return res.status(400).json({ message: "Jadwal Hari Ini Libur" });
            }
            
            let statusKehadiran = (currentTime > limitIn) ? 'TERLAMBAT' : 'HADIR';
            
            // Perbaikan: Gunakan timestamp dari Node.js untuk konsistensi, bukan CURRENT_TIMESTAMP SQL
            await pool.query(
                'INSERT INTO attendance_logs (member_id, status, date_log, scan_time) VALUES ($1, $2, $3, $4)', 
                [member.id, statusKehadiran, localDate, serverTimestamp]
            );

            const responsePayload = {
                success: true, mode: 'MASUK',
                nama: member.full_name, status: statusKehadiran,
                waktu: currentTime, foto: member.photo,
                info_id: member.identity_number, 
                divisi: member.division_name
            };
            req.app.get('io')?.emit('new_scan', responsePayload);
            return res.json(responsePayload);
        } 
        
        // === PULANG (CHECK OUT) ===
        else {
            const log = checkLog.rows[0];

            if (log.scan_out) return res.status(400).json({ message: "Anda Sudah Absen Pulang" });

            const lastScan = new Date(log.scan_time); 
            const diffMinutes = (now - lastScan) / 1000 / 60; 
            if (diffMinutes < 2) return res.status(400).json({ message: "Sistem mengunci absen beruntun. Tunggu beberapa saat." });

            if (currentTime < limitOut) {
                return res.status(400).json({ message: `Belum Waktunya Pulang! (Jadwal: ${limitOut})` });
            }

            await pool.query('UPDATE attendance_logs SET scan_out=$1 WHERE id=$2', [currentTime, log.id]);

            const responsePayload = {
                success: true, mode: 'PULANG',
                nama: member.full_name, status: 'PULANG',
                waktu: currentTime, foto: member.photo,
                info_id: member.identity_number,
                divisi: member.division_name
            };
            req.app.get('io')?.emit('new_scan', responsePayload);
            return res.json(responsePayload);
        }
    } catch (e) { 
        console.error("Scan Error:", e);
        res.status(500).json({ message: "Terjadi Kesalahan Sistem Database" }); 
    }
};

// Pastikan fungsi ini ada dan diexport seperti ini:
exports.getDailyAttendance = async (req, res) => {
    const { kelas, tanggal } = req.query;
    let q = `
        SELECT m.id, m.full_name as nama_lengkap, m.identity_number as nisn, d.name as kelas, 
               a.status, a.scan_time, a.scan_out 
        FROM members m 
        LEFT JOIN divisions d ON m.division_id = d.id
        LEFT JOIN attendance_logs a ON m.id = a.member_id AND a.date_log = $1
    `;
    const p = [tanggal];
    if (kelas) { 
        q += ` WHERE d.name = $2`; 
        p.push(kelas); 
    }
    q += ` ORDER BY m.full_name ASC`;
    try {
        const r = await pool.query(q, p);
        res.json(r.rows);
    } catch (e) { 
        console.error("Error getDailyAttendance:", e);
        res.status(500).json([]); 
    }
};

exports.manualAttendance = async (req, res) => {
    const { student_id, status, tanggal } = req.body;
    
    if (!student_id || !tanggal) {
        return res.status(400).json({ message: "Data tidak lengkap" });
    }

    try {
        if (status === null) {
            // Jika reset, hapus log absensi hari itu
            await pool.query(
                'DELETE FROM attendance_logs WHERE member_id = $1 AND date_log = $2',
                [student_id, tanggal]
            );
            return res.json({ success: true, message: "Absensi berhasil direset" });
        }

        // Cek apakah sudah ada log hari ini
        const checkLog = await pool.query(
            'SELECT id FROM attendance_logs WHERE member_id = $1 AND date_log = $2',
            [student_id, tanggal]
        );

        if (checkLog.rows.length > 0) {
            // Update
            await pool.query(
                'UPDATE attendance_logs SET status = $1 WHERE id = $2',
                [status, checkLog.rows[0].id]
            );
        } else {
            // Insert baru
            const scanTime = new Date().toISOString();
            await pool.query(
                'INSERT INTO attendance_logs (member_id, status, date_log, scan_time) VALUES ($1, $2, $3, $4)',
                [student_id, status, tanggal, scanTime]
            );
        }

        await addAuditLog(req.user?.nama_admin || 'Admin', 'Ubah Absensi Manual', `Member ID: ${student_id} -> ${status}`);

        res.json({ success: true, message: "Status berhasil diupdate" });
    } catch (error) {
        console.error("Error manualAttendance:", error);
        res.status(500).json({ message: "Terjadi kesalahan server" });
    }
};

exports.getReport = async (req, res) => {
    const { kelas, start_date, end_date } = req.query;

    if (!kelas || !start_date || !end_date) {
        return res.status(400).json({ message: "Parameter tidak lengkap" });
    }

    try {
        const query = `
            SELECT m.identity_number as id_anggota, m.full_name as nama_lengkap, 
                   a.date_log as tanggal, a.status 
            FROM attendance_logs a 
            JOIN members m ON a.member_id = m.id 
            JOIN divisions d ON m.division_id = d.id
            WHERE d.name = $1 
              AND a.date_log >= $2 
              AND a.date_log <= $3
        `;
        const result = await pool.query(query, [kelas, start_date, end_date]);
        res.json(result.rows);
    } catch (error) {
        console.error("Error getReport:", error);
        res.status(500).json({ message: "Gagal mengambil data laporan" });
    }
};