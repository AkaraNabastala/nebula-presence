const { pool } = require('../config/database');
const { addAuditLog } = require('../utils/logger');

exports.processScanCore = async (rfid_code, historicalDateObj, io) => {
    if (!rfid_code) return { success: false, message: "Kode ID Kosong" };
    const cleanCode = String(rfid_code).trim();

    try {
        // A. PENCARIAN MEMBER
        const findMemberQuery = `
            SELECT m.*, d.name as division_name, 
                   COALESCE(d.allow_pulang_awal, 1) as allow_pulang_awal,
                   COALESCE(d.allow_lembur, 1) as allow_lembur 
            FROM members m 
            LEFT JOIN divisions d ON m.division_id = d.id
            WHERE m.rfid_code = $1 
               OR m.identity_number = $1
               OR m.identity_reference = $1
               OR LOWER(CAST(m.rfid_code AS TEXT)) = LOWER(CAST($1 AS TEXT)) 
               OR LOWER(CAST(m.identity_number AS TEXT)) = LOWER(CAST($1 AS TEXT))
               OR LOWER(CAST(m.identity_reference AS TEXT)) = LOWER(CAST($1 AS TEXT))
            LIMIT 1
        `;
        const memberRes = await pool.query(findMemberQuery, [cleanCode]);

        if (memberRes.rows.length === 0) {
            return { success: false, message: "ID Tidak Terdaftar" };
        }
        const member = memberRes.rows[0];

        // B. LOGIKA WAKTU (Sinkronisasi JS dan PostgreSQL)
        const tzRes = await pool.query("SELECT setting_value FROM app_settings WHERE setting_key = 'timezone'");
        let activeTimezone = 'Asia/Jakarta';
        if (tzRes.rows.length > 0 && tzRes.rows[0].setting_value) {
            activeTimezone = tzRes.rows[0].setting_value;
        }

        // Jika historicalDateObj ada, gunakan itu. Jika tidak, gunakan waktu saat ini (Real-Time).
        const now = historicalDateObj ? new Date(historicalDateObj) : new Date();
        const localDate = now.toLocaleDateString('en-CA', { timeZone: activeTimezone }); 
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

        // D. CEK HARI LIBUR NASIONAL (TANGGAL MERAH)
        let isNationalHoliday = false;
        const checkNationalHoliday = await pool.query('SELECT * FROM holidays WHERE holiday_date = $1', [localDate]);
        if (checkNationalHoliday.rows.length > 0) {
            isNationalHoliday = true;
        }
        
        const isOffDay = isHoliday || isNationalHoliday;
        
        let detectedShiftName = null;
        if (appMode === 'korporat' && limitIn !== "07:00") {
             const shifts = JSON.parse(settingsMap['company_shifts'] || "[]");
             const foundShift = shifts.find(s => s.in === limitIn);
             if (foundShift) detectedShiftName = foundShift.name;
        }

        // HITUNG TITIK TENGAH (MIDPOINT) JADWAL OPERASIONAL
        const [inH, inM] = limitIn.split(':').map(Number);
        const [outH, outM] = limitOut.split(':').map(Number);
        const midMinutes = Math.floor(((inH * 60 + inM) + (outH * 60 + outM)) / 2);
        const [currH, currM] = currentTime.split(':').map(Number);
        const currentMinutes = currH * 60 + currM;
        const isAfterMidpoint = currentMinutes >= midMinutes;

        // E. CEK RIWAYAT HARI INI
        const checkLog = await pool.query('SELECT * FROM attendance_logs WHERE member_id=$1 AND date_log=$2', [member.id, localDate]);

        // === SCAN PERTAMA HARI INI ===
        if (checkLog.rows.length === 0) {
            const isPulangAwal = currentTime < limitOut;

            // Logika Cerdas: Jika scan pertama dilakukan SETELAH midpoint (waktu mendekati pulang) -> Diproses sebagai PULANG (Lupa Absen Masuk)
            if (isAfterMidpoint) {
                if (isPulangAwal && member.allow_pulang_awal === 0) {
                    return { success: false, message: "Kelompok Anda tidak diizinkan Pulang Awal." };
                }

                await pool.query(
                    'INSERT INTO attendance_logs (member_id, status, date_log, scan_time, scan_out, shift_name) VALUES ($1, $2, $3, NULL, $4, $5)', 
                    [member.id, 'HADIR', localDate, currentTime, detectedShiftName]
                );

                const responsePayload = {
                    success: true, mode: 'PULANG',
                    nama: member.full_name, status: isPulangAwal ? 'PULANG AWAL' : 'PULANG',
                    waktu: currentTime, foto: member.photo,
                    info_id: member.identity_number, 
                    divisi: member.division_name,
                    isLupaMasuk: true
                };
                if (io) io.emit('new_scan', responsePayload);
                return { success: true, data: responsePayload };
            } 
            
            // Scan Pertama di Pagi Hari (CHECK IN)
            else {
                let statusKehadiran = 'HADIR';
                if (isOffDay) {
                    if (member.allow_lembur === 0) {
                        return { success: false, message: "Absen lembur/libur tidak diizinkan untuk kelompok Anda." };
                    }
                    statusKehadiran = 'LEMBUR';
                } else {
                    const currentHHMM = currentTime.substring(0, 5);
                    statusKehadiran = (currentHHMM > limitIn) ? 'TERLAMBAT' : 'HADIR';
                }
                
                await pool.query(
                    'INSERT INTO attendance_logs (member_id, status, date_log, scan_time, shift_name) VALUES ($1, $2, $3, $4, $5)', 
                    [member.id, statusKehadiran, localDate, serverTimestamp, detectedShiftName]
                );

                const responsePayload = {
                    success: true, mode: 'MASUK',
                    nama: member.full_name, status: statusKehadiran,
                    waktu: currentTime, foto: member.photo,
                    info_id: member.identity_number, 
                    divisi: member.division_name
                };
                if (io) io.emit('new_scan', responsePayload);
                return { success: true, data: responsePayload };
            }
        } 
        
        // === SCAN KEDUA HARI INI (CHECK OUT) ===
        else {
            const log = checkLog.rows[0];

            if (log.scan_out) return { success: false, message: "Anda Sudah Absen Pulang" };

            if (log.scan_time) {
                const lastScan = new Date(log.scan_time); 
                const diffSeconds = (now - lastScan) / 1000; 
                if (diffSeconds < 60) return { success: false, message: "Sistem mengunci absen beruntun. Tunggu 1 menit." };
                if (diffSeconds < 3600) return { success: false, message: "Anda sudah melakukan absen masuk hari ini." };
            }

            const isPulangAwal = currentTime < limitOut;
            if (isPulangAwal && member.allow_pulang_awal === 0) {
                return { success: false, message: "Kelompok Anda tidak diizinkan Pulang Awal." };
            }

            await pool.query('UPDATE attendance_logs SET scan_out=$1 WHERE id=$2', [currentTime, log.id]);

            const responsePayload = {
                success: true, mode: 'PULANG',
                nama: member.full_name, 
                status: isPulangAwal ? 'PULANG AWAL' : 'PULANG',
                waktu: currentTime, foto: member.photo,
                info_id: member.identity_number,
                divisi: member.division_name
            };
            if (io) io.emit('new_scan', responsePayload);
            return { success: true, data: responsePayload };
        }
    } catch (e) { 
        console.error("Scan Error:", e);
        return { success: false, message: "Terjadi Kesalahan Sistem Database" }; 
    }
};

exports.scanRFID = async (req, res) => {
    const io = req.app.get('io');
    // Gunakan req.body.scan_time atau req.body.tanggal sebagai Date string jika ada
    const timeParam = req.body.scan_time || req.body.tanggal;
    const historicalDateObj = timeParam ? new Date(timeParam) : null;
    const result = await exports.processScanCore(req.body.rfid_code, historicalDateObj, io);
    if (result.success) {
        return res.json(result.data);
    } else {
        // Return 400 for logic errors (like Already Scanned), 404 for Not Found, 500 for System Error
        const statusCode = result.message.includes("Tidak Terdaftar") ? 404 : 
                          result.message.includes("Database") ? 500 : 400;
        return res.status(statusCode).json({ message: result.message });
    }
};

// Pastikan fungsi ini ada dan diexport seperti ini:
exports.getDailyAttendance = async (req, res) => {
    const { kelas, tanggal } = req.query;
    let q = `
        SELECT m.id, m.full_name as nama_lengkap, m.identity_number as nisn, m.photo as foto, d.name as kelas, 
               a.status, a.scan_time, a.scan_out 
        FROM members m 
        LEFT JOIN divisions d ON m.division_id = d.id
        LEFT JOIN (
            SELECT member_id, status, scan_time, scan_out,
                   ROW_NUMBER() OVER (PARTITION BY member_id ORDER BY id DESC) as rn
            FROM attendance_logs
            WHERE date_log = $1
        ) a ON m.id = a.member_id AND a.rn = 1
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

        const { scan_time, clear_scan_time } = req.body;

        // Cek apakah sudah ada log hari ini
        const checkLog = await pool.query(
            'SELECT id FROM attendance_logs WHERE member_id = $1 AND date_log = $2',
            [student_id, tanggal]
        );

        let finalScanTime = new Date().toISOString();
        if (clear_scan_time) {
            finalScanTime = null;
        } else if (scan_time) {
            finalScanTime = `${tanggal}T${scan_time}:00`;
        }

        if (checkLog.rows.length > 0) {
            // Update
            if (clear_scan_time) {
                await pool.query(
                    'UPDATE attendance_logs SET status = $1, scan_time = NULL WHERE id = $2',
                    [status, checkLog.rows[0].id]
                );
            } else if (scan_time) {
                await pool.query(
                    'UPDATE attendance_logs SET status = $1, scan_time = $2 WHERE id = $3',
                    [status, finalScanTime, checkLog.rows[0].id]
                );
            } else {
                await pool.query(
                    'UPDATE attendance_logs SET status = $1 WHERE id = $2',
                    [status, checkLog.rows[0].id]
                );
            }
        } else {
            // Insert baru
            await pool.query(
                'INSERT INTO attendance_logs (member_id, status, date_log, scan_time) VALUES ($1, $2, $3, $4)',
                [student_id, status, tanggal, finalScanTime]
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
    const { kelas, start_date, end_date, shift } = req.query;

    if (!start_date || !end_date) {
        return res.status(400).json({ message: "Tanggal tidak lengkap" });
    }

    try {
        let query = `
            SELECT m.identity_number as id_anggota, m.full_name as nama_lengkap, 
                   a.date_log as tanggal, a.scan_time as scan_in, a.scan_out as scan_out, a.status, a.shift_name, d.name as kelas 
            FROM members m 
            LEFT JOIN divisions d ON m.division_id = d.id
            LEFT JOIN attendance_logs a ON m.id = a.member_id AND a.date_log >= $1 AND a.date_log <= $2
            WHERE 1=1
        `;
        let params = [start_date, end_date];

        if (kelas) {
            query += ` AND d.name = $3`;
            params.push(kelas);
        }

        if (shift && shift !== 'Semua Shift') {
            query += ` AND (a.shift_name = $${params.length + 1} OR a.status IS NULL OR a.status = 'ALFA')`;
            params.push(shift);
        }

        query += ` ORDER BY m.full_name ASC, a.date_log ASC`;

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error("Error getReport:", error);
        res.status(500).json({ message: "Gagal mengambil data laporan" });
    }
};

exports.getDashboardStats = async (req, res) => {
    try {
        // Ambil zona waktu dari settings
        const tzRes = await pool.query("SELECT setting_value FROM app_settings WHERE setting_key = 'timezone'");
        const tz = (tzRes.rows.length > 0 && tzRes.rows[0].setting_value) ? tzRes.rows[0].setting_value : 'Asia/Jakarta';
        
        const today = new Date().toLocaleDateString('en-CA', { timeZone: tz });
        
        // Total Users
        const usersRes = await pool.query("SELECT COUNT(*) as count FROM members");
        const total_user = parseInt(usersRes.rows[0].count) || 0;

        // Stats Today
        const statsRes = await pool.query(`
            SELECT status, COUNT(*) as count 
            FROM attendance_logs 
            WHERE date_log = $1 
            GROUP BY status
        `, [today]);
        
        let hadir = 0, terlambat = 0, sakit_izin = 0;
        statsRes.rows.forEach(r => {
            const s = (r.status || '').toUpperCase();
            if (s === 'HADIR' || s === 'PULANG') hadir += parseInt(r.count);
            else if (s === 'TERLAMBAT') terlambat += parseInt(r.count);
            else if (s === 'SAKIT' || s === 'IZIN') sakit_izin += parseInt(r.count);
        });

        // Absen / Alfa
        let alfa = total_user - (hadir + terlambat + sakit_izin);
        if (alfa < 0) alfa = 0;

        // Recent Logs
        const logsRes = await pool.query(`
            SELECT a.scan_time as waktu, m.full_name as nama, m.identity_number as uid, d.name as division_name, a.status 
            FROM attendance_logs a
            JOIN members m ON a.member_id = m.id
            LEFT JOIN divisions d ON m.division_id = d.id
            ORDER BY a.id DESC 
            LIMIT 10
        `);

        res.json({
            total_user,
            hadir,
            terlambat,
            sakit_izin,
            alfa,
            recent_logs: logsRes.rows
        });
    } catch (error) {
        console.error("Error getDashboardStats:", error);
        res.status(500).json({ message: "Gagal mengambil statistik dashboard" });
    }
};

exports.getUnclosedNotifications = async (req, res) => {
    try {
        const tzRes = await pool.query("SELECT setting_value FROM app_settings WHERE setting_key = 'timezone'");
        const tz = (tzRes.rows.length > 0 && tzRes.rows[0].setting_value) ? tzRes.rows[0].setting_value : 'Asia/Jakarta';
        const today = new Date().toLocaleDateString('en-CA', { timeZone: tz });

        // Cari log hari-hari lalu yang punya scan_time tapi scan_out kosong
        const query = `
            SELECT a.id, a.date_log, a.scan_time, m.full_name, m.identity_number, d.name as division_name
            FROM attendance_logs a
            JOIN members m ON a.member_id = m.id
            LEFT JOIN divisions d ON m.division_id = d.id
            WHERE a.date_log < $1
              AND a.scan_time IS NOT NULL
              AND a.scan_out IS NULL
            ORDER BY a.date_log DESC, a.scan_time DESC
            LIMIT 50
        `;
        const result = await pool.query(query, [today]);
        res.json({ data: result.rows });
    } catch (error) {
        console.error("Error getUnclosedNotifications:", error);
        res.status(500).json({ data: [] });
    }
};