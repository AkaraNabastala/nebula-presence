const { pool } = require('../config/database');
const { addAuditLog } = require('../utils/logger');
const { dispatchAttendanceNotification } = require('../utils/notificationService');
const crypto = require('crypto');

exports.processScanCore = async (rfid_code, historicalDateObj, io) => {
    if (!rfid_code) return { success: false, message: "Kode ID Kosong" };
    const cleanCode = String(rfid_code).trim();
    if (!cleanCode) return { success: false, message: "Kode ID Kosong" };

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
               OR (COALESCE(m.identity_number, '') || COALESCE(m.identity_reference, '')) = $1
               OR LOWER(CAST(m.rfid_code AS TEXT)) = LOWER(CAST($1 AS TEXT)) 
               OR LOWER(CAST(m.identity_number AS TEXT)) = LOWER(CAST($1 AS TEXT))
               OR LOWER(CAST(m.identity_reference AS TEXT)) = LOWER(CAST($1 AS TEXT))
               OR LOWER(COALESCE(m.identity_number, '') || COALESCE(m.identity_reference, '')) = LOWER(CAST($1 AS TEXT))
            LIMIT 1
        `;
        const memberRes = await pool.query(findMemberQuery, [cleanCode]);

        if (memberRes.rows.length === 0) {
            return { success: false, message: "ID Tidak Terdaftar" };
        }
        const member = memberRes.rows[0];

        // B. LOGIKA WAKTU
        const tzRes = await pool.query("SELECT setting_value FROM app_settings WHERE setting_key = 'timezone'");
        let activeTimezone = 'Asia/Jakarta';
        if (tzRes.rows.length > 0 && tzRes.rows[0].setting_value) {
            activeTimezone = tzRes.rows[0].setting_value;
        }

        const now = historicalDateObj ? new Date(historicalDateObj) : new Date();
        const localDate = now.toLocaleDateString('en-CA', { timeZone: activeTimezone });
        const currentTime = now.toLocaleTimeString('en-GB', { timeZone: activeTimezone, hour12: false });
        const serverTimestamp = now.toISOString();

        // C. LOGIKA JADWAL & SHIFT
        const configRes = await pool.query("SELECT setting_key, setting_value FROM app_settings WHERE setting_key IN ('jadwal_sekolah', 'company_shifts', 'app_mode')");

        let limitIn = "07:00";
        let limitOut = "16:00";
        let isHoliday = false;

        const settingsMap = {};
        configRes.rows.forEach(r => settingsMap[r.setting_key] = r.setting_value);

        const appMode = settingsMap['app_mode'] || 'edukasi';
        const labelGroup = appMode === 'edukasi' ? 'Kelas' : 'Divisi';

        if (settingsMap['jadwal_sekolah']) {
            try {
                const daysMap = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
                const dayIndex = new Date(now.toLocaleString("en-US", { timeZone: activeTimezone })).getDay();
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

        // D. CEK HARI LIBUR NASIONAL
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

        // TITIK TENGAH WAKTU
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

            if (isAfterMidpoint) {
                if (isPulangAwal && member.allow_pulang_awal === 0) {
                    return { success: false, message: `${labelGroup} Anda tidak diizinkan Pulang Awal.` };
                }

                const syncId = crypto.randomUUID();
                await pool.query(
                    'INSERT INTO attendance_logs (member_id, status, date_log, scan_time, scan_out, shift_name, sync_id, is_synced, source) VALUES ($1, $2, $3, NULL, $4, $5, $6, 0, $7)',
                    [member.id, 'HADIR', localDate, currentTime, detectedShiftName, syncId, 'local']
                );

                const responsePayload = {
                    success: true, mode: 'PULANG',
                    nama: member.full_name,
                    role: member.role || 'siswa',
                    status: isPulangAwal ? 'PULANG AWAL' : 'PULANG',
                    waktu: currentTime, foto: member.photo,
                    info_id: member.identity_number,
                    nipd: member.identity_number,
                    nisn: member.identity_reference,
                    divisi: member.division_name,
                    isLupaMasuk: true
                };
                if (io) io.emit('new_scan', responsePayload);

                setImmediate(() => {
                    dispatchAttendanceNotification(pool, {
                        ...responsePayload,
                        telegram_chat_id: member.telegram_chat_id,
                        phone_number: member.phone_number
                    }).catch(e => console.warn("Notif error:", e));
                });

                return { success: true, data: responsePayload };
            } else {
                let statusKehadiran = 'HADIR';
                if (isOffDay) {
                    if (member.allow_lembur === 0) {
                        return { success: false, message: `Absen lembur/libur tidak diizinkan untuk ${labelGroup.toLowerCase()} Anda.` };
                    }
                    statusKehadiran = 'LEMBUR';
                } else {
                    const currentHHMM = currentTime.substring(0, 5);
                    statusKehadiran = (currentHHMM > limitIn) ? 'TERLAMBAT' : 'HADIR';
                }

                const scanTimeFormatted = `${localDate} ${currentTime}`;
                const syncId = crypto.randomUUID();

                // SATU KALI INSERT BERSIH DENGAN SYNC_ID
                await pool.query(
                    'INSERT INTO attendance_logs (member_id, status, date_log, scan_time, shift_name, sync_id, is_synced, source) VALUES ($1, $2, $3, $4, $5, $6, 0, $7)',
                    [member.id, statusKehadiran, localDate, scanTimeFormatted, detectedShiftName, syncId, 'local']
                );

                const responsePayload = {
                    success: true, mode: 'MASUK',
                    nama: member.full_name,
                    role: member.role || 'siswa',
                    status: statusKehadiran,
                    waktu: currentTime, foto: member.photo,
                    info_id: member.identity_number,
                    nipd: member.identity_number,
                    nisn: member.identity_reference,
                    divisi: member.division_name
                };
                if (io) io.emit('new_scan', responsePayload);

                setImmediate(() => {
                    dispatchAttendanceNotification(pool, {
                        ...responsePayload,
                        telegram_chat_id: member.telegram_chat_id,
                        phone_number: member.phone_number
                    }).catch(e => console.warn("Notif error:", e));
                });

                return { success: true, data: responsePayload };
            }
        }

        // === SCAN KEDUA HARI INI (CHECK OUT) ===
        else {
            const log = checkLog.rows[0];

            if (log.scan_out) return { success: false, message: "Anda Sudah Absen Pulang" };

            if (log.scan_time) {
                // Bandingkan jam lokal yang disimpan, bukan Date(string) yang dapat
                // ditafsirkan sebagai UTC dan meloloskan scan beruntun karena selisih zona waktu.
                const lastTime = String(log.scan_time).includes('T')
                    ? String(log.scan_time).split('T')[1].slice(0, 8)
                    : String(log.scan_time).split(' ').pop().slice(0, 8);
                const toSeconds = (value) => {
                    const [hours = 0, minutes = 0, seconds = 0] = String(value || '00:00:00')
                        .split(':').map(Number);
                    return (hours * 3600) + (minutes * 60) + seconds;
                };
                const diffSeconds = toSeconds(currentTime) - toSeconds(lastTime);
                if (diffSeconds >= 0 && diffSeconds < 120) {
                    return { success: false, message: "Sistem mengunci absen beruntun. Tunggu 2 menit." };
                }
            }

            const isPulangAwal = currentTime < limitOut;
            if (isPulangAwal && member.allow_pulang_awal === 0) {
                return { success: false, message: `${labelGroup} Anda tidak diizinkan Pulang Awal.` };
            }

            // SIMPAN SCAN PULANG & RESET IS_SYNCED = 0 AGAR DISINKRONKAN KE WEB
            await pool.query(
                'UPDATE attendance_logs SET scan_out=$1, is_synced=0 WHERE id=$2',
                [currentTime, log.id]
            );

            const responsePayload = {
                success: true, mode: 'PULANG',
                nama: member.full_name,
                role: member.role || 'siswa',
                status: isPulangAwal ? 'PULANG AWAL' : 'PULANG',
                waktu: currentTime, foto: member.photo,
                info_id: member.identity_number,
                nipd: member.identity_number,
                nisn: member.identity_reference,
                divisi: member.division_name
            };

            if (io) io.emit('new_scan', responsePayload);

            setImmediate(() => {
                dispatchAttendanceNotification(pool, {
                    ...responsePayload,
                    telegram_chat_id: member.telegram_chat_id,
                    phone_number: member.phone_number
                }).catch(e => console.warn("Notif error:", e));
            });

            return { success: true, data: responsePayload };
        }
    } catch (e) {
        console.error("Scan Error:", e);
        return { success: false, message: "Terjadi Kesalahan Sistem Database" };
    }
};

exports.scanRFID = async (req, res) => {
    const io = req.app.get('io');
    const timeParam = req.body.scan_time || req.body.tanggal;
    const historicalDateObj = timeParam ? new Date(timeParam) : null;

    console.log('[SCAN DEBUG] ID diterima:', req.body.rfid_code);

    const result = await exports.processScanCore(
        req.body.rfid_code,
        historicalDateObj,
        io
    );

    if (result.success) {
        return res.json(result.data);
    } else {
        const statusCode = result.message.includes("Tidak Terdaftar") ? 404 :
            result.message.includes("Database") ? 500 : 400;
        return res.status(statusCode).json({ message: result.message });
    }
};

exports.getDailyAttendance = async (req, res) => {
    const { tanggal, kelas } = req.query;
    let q = `
        SELECT m.id, m.identity_number, m.identity_number AS nipd,
               m.identity_reference AS nisn,
               m.full_name, m.full_name AS nama_lengkap,
               m.photo, m.photo AS foto,
               d.name AS kelas, d.name AS division_name,
               a.scan_time, a.scan_out, a.status, a.id AS log_id
        FROM members m
        LEFT JOIN divisions d ON m.division_id = d.id
        LEFT JOIN (
            SELECT member_id, status, scan_time, scan_out, id,
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
    const { student_id, status, tanggal, scan_time, clear_scan_time } = req.body;

    if (!student_id || !tanggal) {
        return res.status(400).json({ message: "Data tidak lengkap" });
    }

    try {
        const checkLog = await pool.query(
            'SELECT id FROM attendance_logs WHERE member_id = $1 AND date_log = $2',
            [student_id, tanggal]
        );

        if (!status || status === 'DELETE' || status === 'RESET') {
            await pool.query(
                'DELETE FROM attendance_logs WHERE member_id = $1 AND date_log = $2',
                [student_id, tanggal]
            );
            return res.json({ success: true, message: "Status absensi direset / dihapus" });
        }

        let formattedScanTime = null;
        if (clear_scan_time) {
            formattedScanTime = null;
        } else if (scan_time) {
            formattedScanTime = `${tanggal} ${scan_time}:00`;
        }

        if (checkLog.rows.length > 0) {
            if (formattedScanTime !== null || clear_scan_time) {
                await pool.query(
                    'UPDATE attendance_logs SET status = $1, scan_time = $2, is_synced = 0 WHERE id = $3',
                    [status, formattedScanTime, checkLog.rows[0].id]
                );
            } else {
                await pool.query(
                    'UPDATE attendance_logs SET status = $1, is_synced = 0 WHERE id = $2',
                    [status, checkLog.rows[0].id]
                );
            }
        } else {
            const syncId = crypto.randomUUID();
            await pool.query(
                'INSERT INTO attendance_logs (member_id, status, date_log, scan_time, sync_id, is_synced, source) VALUES ($1, $2, $3, $4, $5, 0, $6)',
                [student_id, status, tanggal, formattedScanTime, syncId, 'local']
            );
        }

        await addAuditLog(req.user?.nama_admin || 'Admin', 'Absensi Manual', `ID Member: ${student_id}, Status: ${status}`);

        // Notifikasi Telegram
        if (status !== 'DELETE' && status !== 'RESET') {
            const memberInfo = await pool.query(
                `SELECT m.*, d.name as division_name FROM members m LEFT JOIN divisions d ON m.division_id = d.id WHERE m.id = $1`,
                [student_id]
            );
            if (memberInfo.rows.length > 0) {
                const mem = memberInfo.rows[0];
                setImmediate(() => {
                    dispatchAttendanceNotification(pool, {
                        mode: 'MASUK',
                        nama: mem.full_name,
                        status: status,
                        waktu: scan_time || new Date().toLocaleTimeString('en-GB', { hour12: false }).substring(0, 5),
                        info_id: mem.identity_number,
                        divisi: mem.division_name,
                        telegram_chat_id: mem.telegram_chat_id,
                        phone_number: mem.phone_number
                    }).catch(e => console.warn("Notif error:", e));
                });
            }
        }

        res.json({ success: true });
    } catch (error) {
        console.error("Manual Attendance Error:", error);
        res.status(500).json({ message: "Gagal memproses absensi manual: " + error.message });
    }
};

exports.getReport = async (req, res) => {
    const { start_date, end_date, tanggal, month, year, kelas } = req.query;
    try {
        if (start_date || end_date || tanggal) {
            const start = start_date || tanggal;
            const end = end_date || tanggal || start;

            let q = `
                SELECT a.id AS log_id,
                       a.date_log AS tanggal,
                       m.id AS member_id,
                       m.identity_number AS nipd,
                       m.identity_number AS id_anggota,
                       m.identity_reference AS nisn,
                       m.full_name AS nama_lengkap,
                       d.name AS kelas,
                       d.name AS division_name,
                       a.scan_time AS scan_in,
                       a.scan_out,
                       a.status
                FROM attendance_logs a
                JOIN members m ON a.member_id = m.id
                LEFT JOIN divisions d ON m.division_id = d.id
                WHERE a.date_log >= $1 AND a.date_log <= $2
            `;
            const p = [start, end];
            if (kelas) {
                q += ` AND d.name = $3`;
                p.push(kelas);
            }
            q += ` ORDER BY a.date_log DESC, a.id DESC`;
            const r = await pool.query(q, p);
            return res.json(r.rows || []);
        }

        if (month && year) {
            const formattedMonth = String(month).padStart(2, '0');
            let q = `
                SELECT m.id, m.identity_number, m.identity_number AS nipd,
                       m.identity_reference AS nisn,
                       m.full_name, m.full_name AS nama_lengkap,
                       d.name AS kelas, d.name AS division_name,
                       COUNT(CASE WHEN a.status = 'HADIR' THEN 1 END) AS hadir,
                       COUNT(CASE WHEN a.status = 'TERLAMBAT' THEN 1 END) AS terlambat,
                       COUNT(CASE WHEN a.status = 'SAKIT' THEN 1 END) AS sakit,
                       COUNT(CASE WHEN a.status = 'IZIN' THEN 1 END) AS izin,
                       COUNT(CASE WHEN a.status = 'ALPA' THEN 1 END) AS alpa,
                       COUNT(CASE WHEN a.status = 'LEMBUR' THEN 1 END) AS lembur
                FROM members m
                LEFT JOIN divisions d ON m.division_id = d.id
                LEFT JOIN attendance_logs a ON m.id = a.member_id 
                     AND strftime('%m', a.date_log) = $1 
                     AND strftime('%Y', a.date_log) = $2
            `;
            const p = [formattedMonth, String(year)];
            if (kelas) {
                q += ` WHERE d.name = $3`;
                p.push(kelas);
            }
            q += ` GROUP BY m.id, m.identity_number, m.identity_reference, m.full_name, d.name ORDER BY m.full_name ASC`;
            const r = await pool.query(q, p);
            return res.json(r.rows || []);
        }

        res.json([]);
    } catch (e) {
        console.error("Error getReport:", e);
        res.status(500).json({
            success: false,
            message: "Gagal memuat laporan kehadiran. Periksa log backend.",
            detail: process.env.NODE_ENV === 'production' ? undefined : e.message
        });
    }
};

exports.getDashboardStats = async (req, res) => {
    try {
        const tzRes = await pool.query("SELECT setting_value FROM app_settings WHERE setting_key = 'timezone'");
        const tz = tzRes.rows.length > 0 && tzRes.rows[0].setting_value ? tzRes.rows[0].setting_value : 'Asia/Jakarta';
        const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: tz });

        const totalMembersRes = await pool.query("SELECT COUNT(*) as count FROM members");
        const totalMembers = parseInt(totalMembersRes.rows[0]?.count || 0, 10);

        const todayLogsRes = await pool.query(`
            SELECT status, COUNT(*) as count 
            FROM attendance_logs 
            WHERE date_log = $1 
            GROUP BY status
        `, [todayStr]);

        const stats = {
            total_members: totalMembers,
            hadir: 0,
            terlambat: 0,
            sakit: 0,
            izin: 0,
            alpa: 0,
            lembur: 0
        };

        todayLogsRes.rows.forEach(r => {
            const st = (r.status || '').toLowerCase();
            if (stats[st] !== undefined) {
                stats[st] = parseInt(r.count, 10);
            }
        });

        // 10 Scan Terakhir
        const recentLogsRes = await pool.query(`
            SELECT a.id, a.scan_time, a.status, m.full_name, m.photo, d.name as division_name
            FROM attendance_logs a
            JOIN members m ON a.member_id = m.id
            LEFT JOIN divisions d ON m.division_id = d.id
            WHERE a.date_log = $1
            ORDER BY a.id DESC
            LIMIT 10
        `, [todayStr]);

        res.json({
            success: true,
            stats,
            recent: recentLogsRes.rows || []
        });
    } catch (e) {
        console.error("Dashboard Stats Error:", e);
        res.status(500).json({ success: false, message: e.message });
    }
};

exports.getUnclosedNotifications = async (req, res) => {
    try {
        const tzRes = await pool.query("SELECT setting_value FROM app_settings WHERE setting_key = 'timezone'");
        const tz = tzRes.rows.length > 0 && tzRes.rows[0].setting_value ? tzRes.rows[0].setting_value : 'Asia/Jakarta';
        const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: tz });

        const r = await pool.query(`
            SELECT a.id, a.date_log, a.scan_time, m.full_name, d.name as division_name
            FROM attendance_logs a
            JOIN members m ON a.member_id = m.id
            LEFT JOIN divisions d ON m.division_id = d.id
            WHERE a.date_log = $1 AND a.scan_out IS NULL AND a.status IN ('HADIR', 'TERLAMBAT')
            ORDER BY a.scan_time ASC
        `, [todayStr]);

        res.json({ success: true, data: r.rows || [] });
    } catch (e) {
        res.status(500).json({ success: false, data: [] });
    }
};
