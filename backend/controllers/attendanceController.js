const { pool } = require('../config/database');

// --- 1. CORE SCAN LOGIC (THE BRAIN) ---
exports.scanRFID = async (req, res) => {
    const { rfid_code, tanggal } = req.body;
    
    if (!rfid_code) return res.status(400).json({ message: "Kode ID Kosong" });
    const cleanCode = String(rfid_code).trim();

    try {
        // A. PENCARIAN MEMBER (Menggunakan tabel members)
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

        // B. LOGIKA WAKTU
        const tzRes = await pool.query("SELECT setting_value FROM app_settings WHERE setting_key = 'timezone'");
        let activeTimezone = 'Asia/Jakarta';
        if (tzRes.rows.length > 0 && tzRes.rows[0].setting_value) {
            activeTimezone = tzRes.rows[0].setting_value;
        }

        const now = new Date();
        const localDate = tanggal || now.toLocaleDateString('en-CA', { timeZone: activeTimezone }); 
        const currentTime = now.toLocaleTimeString('en-GB', { timeZone: activeTimezone, hour12: false });

        // C. LOGIKA JADWAL & LIBUR
        const configRes = await pool.query("SELECT setting_value FROM app_settings WHERE setting_key = 'jadwal_sekolah'");
        let limitIn = "07:00"; 
        let limitOut = "16:00"; 
        let isHoliday = false;

        if (configRes.rows.length > 0) {
            try {
                const daysMap = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
                const dayIndex = new Date(now.toLocaleString("en-US", {timeZone: activeTimezone})).getDay();
                const todayName = daysMap[dayIndex];
                
                const jadwal = JSON.parse(configRes.rows[0].setting_value || "[]");
                const setHariIni = jadwal.find(j => j.day === todayName);
                if (setHariIni) {
                    if (!setHariIni.active) isHoliday = true;
                    limitIn = setHariIni.in || "07:00";
                    limitOut = setHariIni.out || "16:00";
                }
            } catch (e) {}
        }

        // D. CEK RIWAYAT HARI INI
        const checkLog = await pool.query('SELECT * FROM attendance_logs WHERE member_id=$1 AND date_log=$2', [member.id, localDate]);

        // === MASUK (CHECK IN) ===
        if (checkLog.rows.length === 0) {
            if (isHoliday) {
                return res.status(400).json({ message: "Jadwal Hari Ini Libur" });
            }
            
            let statusKehadiran = (currentTime > limitIn) ? 'TERLAMBAT' : 'HADIR';
            
            // Logika Baru: Langsung insert status tanpa menunggu absen pulang
            await pool.query(
                'INSERT INTO attendance_logs (member_id, status, date_log, scan_time) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)', 
                [member.id, statusKehadiran, localDate]
            );

            return res.json({
                success: true, mode: 'MASUK',
                nama: member.full_name, status: statusKehadiran,
                waktu: currentTime, foto: member.photo,
                info_id: member.identity_number, 
                divisi: member.division_name,
                // Fallback untuk frontend lama
                nisn: member.identity_number, kelas: member.division_name 
            });
        } 
        
        // === PULANG (CHECK OUT) ===
        else {
            const log = checkLog.rows[0];

            if (log.scan_out) return res.status(400).json({ message: "Anda Sudah Absen Pulang" });

            const lastScan = new Date(log.scan_time); 
            const diffMinutes = (now - lastScan) / 1000 / 60; 
            if (diffMinutes < 1) return res.status(400).json({ message: "Baru saja absen masuk. Tunggu sebentar." });

            if (currentTime < limitOut) {
                return res.status(400).json({ message: `Belum Waktunya Pulang! (Jadwal: ${limitOut})` });
            }

            // Update waktu pulang
            await pool.query('UPDATE attendance_logs SET scan_out=$1 WHERE id=$2', [currentTime, log.id]);

            return res.json({
                success: true, mode: 'PULANG',
                nama: member.full_name, status: 'PULANG',
                waktu: currentTime, foto: member.photo,
                info_id: member.identity_number,
                divisi: member.division_name,
                nisn: member.identity_number, kelas: member.division_name
            });
        }
    } catch (e) { 
        console.error("Scan Error:", e);
        res.status(500).json({ message: "Terjadi Kesalahan Sistem Database" }); 
    }
};

// --- 2. DASHBOARD DATA ---
exports.getDashboardStats = async (req, res) => {
    try {
        const tot = await pool.query('SELECT count(*) FROM members');
        const logs = await pool.query("SELECT status, count(*) as c FROM attendance_logs WHERE date_log=CURRENT_DATE GROUP BY status");
        
        const rec = await pool.query(`
            SELECT a.status, TO_CHAR(a.scan_time, 'HH24:MI') as scan_time, 
                   m.full_name as nama_lengkap, d.name as kelas, m.identity_number as nisn 
            FROM attendance_logs a 
            JOIN members m ON a.member_id = m.id 
            LEFT JOIN divisions d ON m.division_id = d.id
            WHERE date_log=CURRENT_DATE ORDER BY a.scan_time DESC LIMIT 10
        `);
        
        let stats = { total_siswa: parseInt(tot.rows[0]?.count || 0), hadir:0, terlambat:0, sakit:0, izin:0, alfa:0, logs: rec.rows || [] };
        logs.rows.forEach(r => {
            if(r.status==='HADIR') stats.hadir=parseInt(r.c);
            else if(r.status==='TERLAMBAT') stats.terlambat=parseInt(r.c);
            else if(r.status==='SAKIT') stats.sakit=parseInt(r.c);
            else if(r.status==='IZIN') stats.izin=parseInt(r.c);
        });
        res.json(stats);
    } catch(e) { res.status(500).json({ total_siswa:0, logs: [] }); }
};

// --- 3. REPORT API ---
exports.getReport = async (req, res) => {
    const { start_date, end_date, kelas } = req.query; // kelas ini merepresentasikan division name
    try {
        let q = `
            SELECT m.full_name as nama_lengkap, d.name as kelas, m.identity_number as id_anggota, 
                   TO_CHAR(a.date_log, 'YYYY-MM-DD') as tanggal, a.status, 
                   TO_CHAR(a.scan_time, 'HH24:MI:SS') as scan_in, TO_CHAR(a.scan_out, 'HH24:MI:SS') as scan_out 
            FROM members m 
            JOIN attendance_logs a ON m.id = a.member_id 
            LEFT JOIN divisions d ON m.division_id = d.id
            WHERE a.date_log BETWEEN $1 AND $2
        `;
        const p = [start_date, end_date];
        if (kelas) { 
            q += ` AND d.name = $3`; 
            p.push(kelas); 
        }
        q += ` ORDER BY a.date_log DESC, a.scan_time DESC`;
        const r = await pool.query(q, p);
        res.json(r.rows || []);
    } catch (err) { res.status(500).json([]); }
};

// --- 4. MANUAL ATTENDANCE (ADMIN EDIT) ---
exports.manualAttendance = async (req, res) => {
    const { student_id, status, tanggal } = req.body; 
    const member_id = student_id; // Mapping dari frontend lama
    
    if (!status) {
        await pool.query('DELETE FROM attendance_logs WHERE member_id=$1 AND date_log=$2', [member_id, tanggal]);
        return res.json({ success: true });
    }
    
    const check = await pool.query('SELECT id FROM attendance_logs WHERE member_id=$1 AND date_log=$2', [member_id, tanggal]);
    if(check.rows.length > 0) {
        await pool.query('UPDATE attendance_logs SET status=$1 WHERE id=$2', [status, check.rows[0].id]);
    } else {
        await pool.query('INSERT INTO attendance_logs (member_id, status, date_log, scan_time) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)', [member_id, status, tanggal]);
    }
    res.json({ success: true });
};

// --- 5. DAILY ATTENDANCE (LIST VIEW) ---
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
    } catch (e) { res.status(500).json([]); }
};