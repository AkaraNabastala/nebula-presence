const https = require('https');
const http = require('http');

/**
 * Helper HTTP Request fleksibel untuk Sync
 */
const makeSyncRequest = (urlStr, options = {}, payload = null) => {
    return new Promise((resolve, reject) => {
        try {
            const parsedUrl = new URL(urlStr);
            const client = parsedUrl.protocol === 'https:' ? https : http;

            const reqOptions = {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
                path: parsedUrl.pathname + parsedUrl.search,
                method: options.method || 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    ...(options.headers || {})
                },
                timeout: 10000 // 10 detik timeout
            };

            const data = payload ? JSON.stringify(payload) : null;
            if (data) {
                reqOptions.headers['Content-Length'] = Buffer.byteLength(data);
            }

            const req = client.request(reqOptions, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(body);
                        resolve({ status: res.statusCode, data: parsed });
                    } catch {
                        resolve({ status: res.statusCode, raw: body });
                    }
                });
            });

            req.on('error', (err) => reject(err));
            req.on('timeout', () => {
                req.destroy();
                reject(new Error("Koneksi ke Web Cloud Timeout (10s)"));
            });

            if (data) req.write(data);
            req.end();
        } catch (err) {
            reject(err);
        }
    });
};

const responseHint = (response) => {
    const raw = String(response?.raw || '').trim();
    if (/^<!doctype html|^<html[\s>]/i.test(raw)) {
        return ' — Server mengembalikan HTML, bukan JSON API. Periksa URL/port: arahkan ke backend Portal (lokal default http://localhost:5000), bukan server frontend Vite.';
    }
    const detail = response?.data?.message || response?.data?.error || raw;
    const safeDetail = String(detail)
        .replace(/(password|token|secret|authorization)\s*[:=]\s*[^,\s]+/gi, '$1=[REDACTED]')
        .replace(/[\r\n\t]+/g, ' ').trim().slice(0, 180);
    return safeDetail ? ` — ${safeDetail}` : '';
};

/**
 * Status Live Sync untuk Dashboard / Settings
 */
const getSyncStatus = async (pool) => {
    const configRes = await pool.query(
        "SELECT setting_key, setting_value FROM app_settings WHERE setting_key LIKE 'cloud_sync_%'"
    );
    const settings = {};
    configRes.rows.forEach(r => settings[r.setting_key] = r.setting_value);

    const pendingCountRes = await pool.query(
        "SELECT COUNT(*) as count FROM attendance_logs WHERE is_synced = 0 OR is_synced IS NULL"
    );

    let lastErrors = [];
    let lastSummary = null;
    try {
        const parsedSummary = JSON.parse(settings['cloud_sync_last_summary'] || 'null');
        if (parsedSummary && typeof parsedSummary === 'object') lastSummary = parsedSummary;
    } catch {
        lastSummary = null;
    }
    try {
        const parsedErrors = JSON.parse(settings['cloud_sync_last_errors'] || '[]');
        if (Array.isArray(parsedErrors)) lastErrors = parsedErrors;
    } catch {
        lastErrors = [];
    }

    return {
        enabled: settings['cloud_sync_active'] === '1',
        url: settings['cloud_sync_url'] || '',
        pendingCount: parseInt(pendingCountRes.rows[0]?.count || 0, 10),
        lastStatus: settings['cloud_sync_last_status'] || 'idle',
        lastTime: settings['cloud_sync_last_time'] || '',
        lastErrors,
        lastSummary
    };
};

/**
 * Eksekusi Sinkronisasi Dua Arah (Push Lokal -> Cloud & Pull Izin Guru -> Lokal)
 */
let isSyncing = false;

const performCloudSync = async (pool, io, isManual = false) => {
    if (isSyncing) return { success: false, message: "Sinkronisasi sedang berlangsung..." };

    try {
        const configRes = await pool.query(
            "SELECT setting_key, setting_value FROM app_settings WHERE setting_key LIKE 'cloud_sync_%'"
        );
        const settings = {};
        configRes.rows.forEach(r => settings[r.setting_key] = r.setting_value);

        const isActive = settings['cloud_sync_active'] === '1';
        const syncUrl = (settings['cloud_sync_url'] || '').trim().replace(/\/+$/, '');
        const syncToken = settings['cloud_sync_token'] || '';
        // Portal Absensi exposes sync handlers under /api/sync/*, not at the site root.
        // Accept a site origin, an /api base, or an already-normalized /api/sync URL.
        let syncBaseUrl = syncUrl;
        try {
            const configuredPortal = new URL(syncUrl);
            let syncPath = configuredPortal.pathname.replace(/\/+$/, '');

            // Accept a site origin, /api, /api/sync, or a copied sync endpoint URL.
            // If a full endpoint (for example /api/sync/handshake) was pasted into
            // settings, normalize it back to the shared /api/sync base to avoid 404s.
            const syncApiMarker = '/api/sync/';
            const endpointIndex = syncPath.indexOf(syncApiMarker);
            if (endpointIndex >= 0) {
                syncPath = syncPath.slice(0, endpointIndex + '/api/sync'.length);
            }

            if (syncPath.endsWith('/api/sync')) {
                // Already configured for the sync API.
            } else if (syncPath.endsWith('/api')) {
                syncPath += '/sync';
            } else {
                syncPath += '/api/sync';
            }
            syncBaseUrl = `${configuredPortal.origin}${syncPath}`;
        } catch {
            syncBaseUrl = syncUrl;
        }
        let canSendCredentialHashes = false;
        try {
            const portalUrl = new URL(syncUrl);
            const isLoopback = ['localhost', '127.0.0.1', '::1'].includes(portalUrl.hostname.replace(/^\[|\]$/g, '').toLowerCase());
            canSendCredentialHashes = portalUrl.protocol === 'https:' || (portalUrl.protocol === 'http:' && isLoopback);
        } catch {
            canSendCredentialHashes = false;
        }

        if (!isActive || !syncUrl) {
            return { success: false, message: "Sinkronisasi Cloud belum diaktifkan atau URL kosong." };
        }

        isSyncing = true;
        const syncErrors = [];
        const syncSummary = {
            schoolInfo: 0,
            adminAccounts: 0,
            classesSent: 0,
            membersSent: 0,
            membersConfirmed: 0,
            membersSkipped: 0,
            teacherCredentialsSent: 0,
            teacherCredentialsConfirmed: 0,
            schedulesSent: 0,
            schedulesConfirmed: 0,
            schedulesSkipped: 0,
            attendanceSent: 0,
            attendanceConfirmed: 0,
            remoteUpdatesReceived: 0,
            remoteUpdatesApplied: 0
        };
        const emitStage = (stage, message, details = {}) => {
            if (io) io.emit('cloud_sync_status', { state: 'syncing', stage, message, ...details });
        };
        emitStage('connecting', 'Menghubungkan ke Portal...', { progress: 5 });
        console.info(`[Cloud Sync] Target portal sync base: ${syncBaseUrl}`);
        let portalNeedsBootstrap = false;
        try {
            const handshake = await makeSyncRequest(`${syncBaseUrl}/handshake`, { method: 'POST', headers: { 'Authorization': `Bearer ${syncToken}` } });
            if (handshake.status === 200 && handshake.data?.success) {
                portalNeedsBootstrap = handshake.data?.bootstrap_required === true;
                console.info(`[Cloud Sync Portal] Handshake berhasil; bootstrap=${portalNeedsBootstrap ? 'ya' : 'tidak'}.`);
            }
            else syncErrors.push(`Handshake Portal gagal (POST ${syncBaseUrl}/handshake, HTTP ${handshake.status}${responseHint(handshake)}).`);
        } catch (handshakeErr) {
            syncErrors.push(`Handshake Portal: ${handshakeErr.message}`);
            console.warn('[Cloud Sync Handshake Error]:', handshakeErr.message);
        }

        // 0. PUSH SCHOOL INFO: Kirim identitas & branding sekolah ke Web Portal
        emitStage('school', 'Mengirim identitas sekolah...', { progress: 12 });
        try {
            const schoolRes = await pool.query(
                "SELECT setting_key, setting_value FROM app_settings WHERE setting_key IN ('nama_sekolah', 'alamat_sekolah', 'logo_sekolah')"
            );
            const schoolData = {};
            schoolRes.rows.forEach(r => schoolData[r.setting_key] = r.setting_value);

            if (schoolData.nama_sekolah || schoolData.logo_sekolah) {
                const infoEndpoint = `${syncBaseUrl}/push-school-info`;
                const infoPush = await makeSyncRequest(infoEndpoint, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${syncToken}` }
                }, {
                    school_name: schoolData.nama_sekolah || '',
                    school_address: schoolData.alamat_sekolah || '',
                    school_logo: schoolData.logo_sekolah || ''
                });
                if (infoPush.status !== 200 || !infoPush.data?.success) syncErrors.push(`Identitas sekolah gagal dikirim (POST ${infoEndpoint}, HTTP ${infoPush.status}${responseHint(infoPush)}).`);
                else {
                    syncSummary.schoolInfo = 1;
                    console.info('[Cloud Sync Portal] Identitas sekolah dan branding berhasil dikirim.');
                }
            }
        } catch (infoErr) {
            syncErrors.push(`Identitas sekolah: ${infoErr.message}`);
            console.warn("[Cloud Sync School Info Error]:", infoErr.message);
        }

        // 0.25. PUSH ADMIN ACCOUNT: hanya hash bcrypt dan hanya melalui HTTPS.
        emitStage('admin', 'Memeriksa sinkronisasi akun administrator...', { progress: 20 });
        try {
            // Password hashes may only travel over HTTPS or loopback HTTP.
            if (canSendCredentialHashes) {
                const adminRes = await pool.query("SELECT username, password AS password_hash FROM admins WHERE role = 'SuperAdmin' ORDER BY id ASC LIMIT 1");
                const admin = adminRes.rows[0];
                if (admin?.username && admin?.password_hash) {
                    const accountRes = await makeSyncRequest(`${syncBaseUrl}/push-admin-account`, { method: 'POST', headers: { 'Authorization': `Bearer ${syncToken}` } }, { username: admin.username, password_hash: admin.password_hash });
                    if (accountRes.status !== 200 || !accountRes.data?.success) {
                        syncErrors.push(`Akun administrator gagal dikirim (POST ${syncBaseUrl}/push-admin-account, HTTP ${accountRes.status}${responseHint(accountRes)}).`);
                        console.warn(`[Cloud Sync Admin Error] POST ${syncBaseUrl}/push-admin-account -> HTTP ${accountRes.status}${responseHint(accountRes)}`);
                    } else {
                        syncSummary.adminAccounts = 1;
                        console.info('[Cloud Sync Portal] Kredensial administrator berhasil dikirim melalui koneksi aman.');
                    }
                }
            } else {
                syncErrors.push('Akun administrator tidak dikirim: gunakan HTTPS untuk server Portal jarak jauh. HTTP hanya diizinkan untuk localhost.');
                console.warn('[Cloud Sync Admin Error]: Admin credential sync requires HTTPS for non-loopback hosts; account hash was not sent.');
            }
        } catch (adminErr) {
            syncErrors.push(`Akun administrator: ${adminErr.message}`);
            console.warn('[Cloud Sync Admin Error]:', adminErr.message);
        }

        // 0.5. PUSH DIVISIONS: Kirim data rombel / kelas beserta wali kelas (supervisor_name)
        emitStage('divisions', 'Mengirim data kelas...', { progress: 28 });
        try {
            const divRes = await pool.query(
                "SELECT d.id, d.name, d.supervisor_name FROM divisions d ORDER BY d.id ASC"
            );
            const divEndpoint = `${syncBaseUrl}/push-divisions`;
            const divPush = await makeSyncRequest(divEndpoint, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${syncToken}` }
            }, { divisions: divRes.rows });
            if (divPush.status !== 200 || !divPush.data?.success) syncErrors.push(`Data kelas gagal dikirim (POST ${divEndpoint}, HTTP ${divPush.status}${responseHint(divPush)}).`);
            else {
                syncSummary.classesSent = divRes.rows.length;
                console.info(`[Cloud Sync Portal] Data kelas terkirim: ${divRes.rows.length} kelas.`);
            }
        } catch (divErr) {
            syncErrors.push(`Data kelas: ${divErr.message}`);
            console.warn("[Cloud Sync Divisions Error]:", divErr.message);
        }

        // 1. PUSH MEMBERS: Kirim data siswa & guru beserta foto ke Web Portal
        emitStage('members', 'Mengirim data siswa dan guru...', { progress: 38 });
        try {
            const credentialFields = canSendCredentialHashes
                ? 'ta.username AS login_username, ta.password_hash AS login_password_hash'
                : 'NULL AS login_username, NULL AS login_password_hash';
            const memberQuery = (isManual || portalNeedsBootstrap)
                ? `SELECT m.id, m.sync_id, m.identity_number as nipd, m.identity_reference as nisn,
                          m.full_name, m.role, m.rfid_code, m.photo, m.phone_number, m.telegram_chat_id,
                          d.name as division_name, d.supervisor_name, ${credentialFields}
                   FROM members m
                   LEFT JOIN divisions d ON m.division_id = d.id
                   LEFT JOIN teacher_accounts ta ON ta.member_id = m.id AND ta.is_active = 1
                        AND LOWER(REPLACE(REPLACE(TRIM(m.role), '_', ' '), '-', ' ')) IN ('guru', 'guru mapel', 'guru mata pelajaran', 'guru kelas', 'teacher', 'pengajar', 'wali kelas', 'walikelas')
                   ORDER BY m.id ASC`
                 : `SELECT m.id, m.sync_id, m.identity_number as nipd, m.identity_reference as nisn,
                          m.full_name, m.role, m.rfid_code, m.photo, m.phone_number, m.telegram_chat_id,
                          d.name as division_name, d.supervisor_name, ${credentialFields}
                   FROM members m
                   LEFT JOIN divisions d ON m.division_id = d.id
                   LEFT JOIN teacher_accounts ta ON ta.member_id = m.id AND ta.is_active = 1
                        AND LOWER(REPLACE(REPLACE(TRIM(m.role), '_', ' '), '-', ' ')) IN ('guru', 'guru mapel', 'guru mata pelajaran', 'guru kelas', 'teacher', 'pengajar', 'wali kelas', 'walikelas')
                   WHERE (m.is_synced = 0 OR m.is_synced IS NULL)
                   ORDER BY m.id ASC
                   LIMIT 100`;

            const pendingMembers = await pool.query(memberQuery);
            syncSummary.membersSent = pendingMembers.rows.length;
            console.info(`[Cloud Sync Portal] Data anggota disiapkan untuk dikirim: ${pendingMembers.rows.length} siswa/guru.`);
            if (pendingMembers.rows.length === 0 && !isManual && !portalNeedsBootstrap) {
                console.info('[Cloud Sync Portal] Tidak ada anggota baru yang menunggu sinkronisasi otomatis; jalankan sinkronisasi manual untuk mengirim snapshot lengkap.');
            }

            if (pendingMembers.rows.length > 0 || isManual || portalNeedsBootstrap) {
                const memEndpoint = `${syncBaseUrl}/push-members`;
                const memRes = await makeSyncRequest(memEndpoint, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${syncToken}` }
                }, {
                    members: pendingMembers.rows,
                    full_snapshot: Boolean(isManual || portalNeedsBootstrap)
                });

                if (memRes.status === 200 && Array.isArray(memRes.data?.synced_ids)) {
                    syncSummary.membersConfirmed = memRes.data.synced_ids.length;
                    syncSummary.membersSkipped = Number(memRes.data.skipped || 0);
                    console.info(`[Cloud Sync Portal] Data anggota diterima: ${memRes.data.synced_ids.length} anggota; dilewati=${memRes.data.skipped || 0}.`);
                    const acknowledgedIds = new Set(memRes.data.synced_ids.map(id => String(id)));
                    for (const row of pendingMembers.rows) {
                        if (acknowledgedIds.has(String(row.id))) {
                            await pool.query("UPDATE members SET is_synced = 1 WHERE id = $1", [row.id]);
                        }
                    }
                    if (acknowledgedIds.size < pendingMembers.rows.length || Number(memRes.data?.skipped || 0) > 0) {
                        syncErrors.push(`Data siswa/guru: ${acknowledgedIds.size} dari ${pendingMembers.rows.length} data dikonfirmasi Portal; ${Number(memRes.data?.skipped || 0)} dilewati. Data yang belum dikonfirmasi akan dicoba lagi.`);
                    }
                } else {
                    syncErrors.push(`Data siswa/guru gagal dikirim (POST ${memEndpoint}, HTTP ${memRes.status} atau respons tidak valid${responseHint(memRes)}).`);
                }
            }
        } catch (memErr) {
            syncErrors.push(`Data siswa/guru: ${memErr.message}`);
            console.warn("[Cloud Sync Member Error]:", memErr.message);
        }

        // 1.25. PUSH TEACHER CREDENTIALS: perubahan password guru tidak selalu menandai member sebagai baru.
        // Kirim ulang akun guru aktif setiap siklus, hanya jika koneksi aman untuk mengirim hash.
        try {
            const teacherAccountsRes = await pool.query(`
                SELECT m.id, m.sync_id, m.identity_number AS nipd, m.identity_reference AS nisn,
                       m.full_name, m.role, m.rfid_code, m.photo, m.phone_number,
                       d.name AS division_name, d.supervisor_name,
                       ta.username AS login_username, ta.password_hash AS login_password_hash
                FROM members m
                JOIN teacher_accounts ta ON ta.member_id = m.id AND ta.is_active = 1
                LEFT JOIN divisions d ON m.division_id = d.id
                WHERE LOWER(REPLACE(REPLACE(TRIM(m.role), '_', ' '), '-', ' ')) IN
                    ('guru', 'guru mapel', 'guru mata pelajaran', 'guru kelas', 'teacher', 'pengajar', 'wali kelas', 'walikelas')
                ORDER BY m.id ASC
            `);

            if (teacherAccountsRes.rows.length > 0 && canSendCredentialHashes) {
                const teacherPush = await makeSyncRequest(`${syncBaseUrl}/push-members`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${syncToken}` }
                }, { members: teacherAccountsRes.rows, full_snapshot: false });

                const acknowledged = Array.isArray(teacherPush.data?.synced_ids)
                    ? teacherPush.data.synced_ids.length : 0;
                syncSummary.teacherCredentialsSent = teacherAccountsRes.rows.length;
                syncSummary.teacherCredentialsConfirmed = acknowledged;
                if (teacherPush.status !== 200 || !teacherPush.data?.success ||
                    acknowledged < teacherAccountsRes.rows.length || Number(teacherPush.data?.skipped || 0) > 0) {
                    syncErrors.push(`Kredensial guru belum tersinkron lengkap: ${acknowledged} dari ${teacherAccountsRes.rows.length} akun dikonfirmasi.`);
                    console.warn(`[Cloud Sync Teacher Credentials] Konfirmasi ${acknowledged}/${teacherAccountsRes.rows.length}; HTTP ${teacherPush.status}${responseHint(teacherPush)}`);
                } else {
                    console.info(`[Cloud Sync Portal] Kredensial ${acknowledged} akun guru diperiksa dan disinkronkan.`);
                }
            } else if (teacherAccountsRes.rows.length > 0) {
                syncErrors.push('Kredensial guru tidak dikirim karena koneksi bukan HTTPS atau loopback HTTP.');
                console.warn('[Cloud Sync Teacher Credentials] Kredensial guru tidak dikirim melalui koneksi yang tidak aman.');
            }
        } catch (teacherCredentialErr) {
            syncErrors.push(`Kredensial guru: ${teacherCredentialErr.message}`);
            console.warn('[Cloud Sync Teacher Credentials Error]:', teacherCredentialErr.message);
        }

        // 1.5. PUSH TEACHING SCHEDULES: snapshot penuh agar Portal tidak menyimpan jadwal usang.
        emitStage('schedules', 'Mengirim dan mencocokkan jadwal pelajaran...', { progress: 55 });
        try {
            // COUNT(*) AS count is portable across SQLite and PostgreSQL adapters.
            const scheduleSourceCount = await pool.query('SELECT COUNT(*) AS count FROM teaching_schedules');
            const assignmentSourceCount = await pool.query('SELECT COUNT(*) AS count FROM teaching_assignments');
            const scheduleRes = await pool.query(`
                SELECT ts.id, ts.assignment_id, ts.day_of_week, ts.start_time, ts.end_time, ts.is_active,
                       teacher.identity_number AS teacher_identity_number,
                       teacher.identity_reference AS teacher_identity_reference,
                       d.name AS division_name, s.name AS subject_name, s.code AS subject_code,
                       ta.academic_year, ta.semester
                FROM teaching_schedules ts
                JOIN teaching_assignments ta ON ta.id = ts.assignment_id
                JOIN members teacher ON teacher.id = ta.teacher_id
                JOIN divisions d ON d.id = ta.division_id
                JOIN subjects s ON s.id = ta.subject_id
                ORDER BY ts.id ASC
            `);
            if (scheduleRes.rows.length === 0) {
                const sourceSchedules = Number(scheduleSourceCount.rows[0]?.count || 0);
                const sourceAssignments = Number(assignmentSourceCount.rows[0]?.count || 0);
                if (sourceSchedules > 0) {
                    syncErrors.push(`Jadwal tersimpan (${sourceSchedules}) tetapi tidak ada yang lolos relasi sinkronisasi; periksa rincian [Cloud Sync Schedules Audit] di log backend.`);
                    console.warn(`[Cloud Sync Schedules Audit] Mulai diagnosis: source schedules=${sourceSchedules}, assignments=${sourceAssignments}, hasil join wajib=0.`);
                    try {
                        const diagnosticRes = await pool.query(`
                            SELECT ts.id AS schedule_id, ts.assignment_id,
                                   ta.id AS matched_assignment_id, ta.teacher_id, teacher.id AS matched_teacher_id,
                                   teacher.identity_number AS teacher_identity_number,
                                   teacher.identity_reference AS teacher_identity_reference,
                                   ta.division_id, d.id AS matched_division_id, d.name AS division_name,
                                   ta.subject_id, s.id AS matched_subject_id, s.name AS subject_name
                            FROM teaching_schedules ts
                            LEFT JOIN teaching_assignments ta ON ta.id = ts.assignment_id
                            LEFT JOIN members teacher ON teacher.id = ta.teacher_id
                            LEFT JOIN divisions d ON d.id = ta.division_id
                            LEFT JOIN subjects s ON s.id = ta.subject_id
                            ORDER BY ts.id ASC
                        `);
                        const relationAudit = [];
                        for (const row of diagnosticRes.rows || []) {
                            const missing = [];
                            if (!row.matched_assignment_id) missing.push(`assignment_id=${row.assignment_id} tidak ditemukan`);
                            else {
                                if (!row.matched_teacher_id) missing.push(`teacher_id=${row.teacher_id} tidak ditemukan di members`);
                                if (!row.matched_division_id) missing.push(`division_id=${row.division_id} tidak ditemukan di divisions`);
                                if (!row.matched_subject_id) missing.push(`subject_id=${row.subject_id} tidak ditemukan di subjects`);
                            }
                            const detail = missing.length ? missing.join('; ') : `relasi ID ditemukan tetapi join jadwal kosong; guru identity_number=${row.teacher_identity_number || '-'}, identity_reference=${row.teacher_identity_reference || '-'}, kelas=${row.division_name || '-'}, mapel=${row.subject_name || '-'}`;
                            relationAudit.push(`jadwal ${row.schedule_id}: ${detail}`);
                            console.warn(`[Cloud Sync Schedules Audit] schedule_id=${row.schedule_id}; ${detail}`);
                        }
                        if (relationAudit.length) syncErrors.push(`Rincian relasi jadwal: ${relationAudit.join(' | ').slice(0, 700)}`);
                    } catch (diagnosticError) {
                        console.warn('[Cloud Sync Schedules Audit] Diagnosis relasi gagal:', diagnosticError.message);
                    }
                } else {
                    console.info(`[Cloud Sync Schedules] Belum ada jadwal sumber. teaching_assignments=${sourceAssignments}.`);
                }
            }
            const schedulePush = await makeSyncRequest(`${syncBaseUrl}/push-teaching-schedules`, { method: 'POST', headers: { 'Authorization': `Bearer ${syncToken}` } }, { schedules: scheduleRes.rows });
            if (schedulePush.status !== 200 || !schedulePush.data?.success || Number(schedulePush.data?.skipped || 0) > 0) {
                const detail = schedulePush.data?.message || `HTTP ${schedulePush.status}`;
                syncErrors.push(`Jadwal tidak tersinkron sempurna: ${detail}`);
                console.warn(`[Cloud Sync Schedules Error] POST ${syncBaseUrl}/push-teaching-schedules -> HTTP ${schedulePush.status}${responseHint(schedulePush)}; ${detail}`);
            }
            syncSummary.schedulesSent = scheduleRes.rows.length;
            syncSummary.schedulesConfirmed = Number(schedulePush.data?.synced || 0);
            syncSummary.schedulesSkipped = Number(schedulePush.data?.skipped || 0);
            emitStage('schedules', schedulePush.data?.message || 'Jadwal selesai diproses.', {
                progress: 65, total: scheduleRes.rows.length,
                processed: Number(schedulePush.data?.synced || 0),
                skipped: Number(schedulePush.data?.skipped || 0)
            });
            console.info(`[Cloud Sync Portal] Jadwal pelajaran: ${Number(schedulePush.data?.synced || 0)} terkirim, ${Number(schedulePush.data?.skipped || 0)} dilewati dari ${scheduleRes.rows.length} jadwal.`);
        } catch (scheduleErr) {
            syncErrors.push(`Jadwal pelajaran: ${scheduleErr.message}`);
            console.warn('[Cloud Sync Schedules Error]:', scheduleErr.message);
        }

        // 2. PUSH ATTENDANCE: Ambil log presensi yang belum terkirim
        emitStage('attendance', 'Mengirim log presensi...', { progress: 72 });
        const logQuery = isManual
            ? `SELECT a.id, a.sync_id, a.status, a.date_log, a.scan_time, a.scan_out, a.shift_name, a.source,
                      m.identity_number as nipd, m.identity_reference as nisn, m.full_name, m.role,
                      d.name as division_name
               FROM attendance_logs a
               JOIN members m ON a.member_id = m.id
               LEFT JOIN divisions d ON m.division_id = d.id
               ORDER BY a.id ASC`
            : `SELECT a.id, a.sync_id, a.status, a.date_log, a.scan_time, a.scan_out, a.shift_name, a.source,
                      m.identity_number as nipd, m.identity_reference as nisn, m.full_name, m.role,
                      d.name as division_name
               FROM attendance_logs a
               JOIN members m ON a.member_id = m.id
               LEFT JOIN divisions d ON m.division_id = d.id
               WHERE (a.is_synced = 0 OR a.is_synced IS NULL)
               ORDER BY a.id ASC
               LIMIT 100`;

        const pendingLogs = await pool.query(logQuery);
        syncSummary.attendanceSent = pendingLogs.rows.length;
        console.info(`[Cloud Sync Portal] Log presensi disiapkan untuk dikirim: ${pendingLogs.rows.length} baris.`);
        const attendanceBatchSize = 200;
        let pushSuccessCount = 0;

        // Manual sync sends all records in bounded batches. Automatic sync only
        // sends pending records. Never treat an unacknowledged row as delivered.
        for (let offset = 0; offset < pendingLogs.rows.length; offset += attendanceBatchSize) {
            const batch = pendingLogs.rows.slice(offset, offset + attendanceBatchSize);
            try {
                const pushRes = await makeSyncRequest(`${syncBaseUrl}/push-attendance`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${syncToken}` }
                }, { logs: batch });

                if (pushRes.status !== 200 || pushRes.data?.success !== true || !Array.isArray(pushRes.data?.synced_ids)) {
                    syncErrors.push(`Log presensi batch gagal dikirim (POST ${syncBaseUrl}/push-attendance, HTTP ${pushRes.status}${responseHint(pushRes)}).`);
                    break;
                }

                const syncedIds = pushRes.data.synced_ids;
                for (const sId of syncedIds) {
                    try {
                        await pool.query(
                            "UPDATE attendance_logs SET is_synced = 1 WHERE sync_id = $1 OR id = $2",
                            [sId, sId]
                        );
                    } catch (errSync) {
                        syncErrors.push(`Gagal menandai log sebagai terkirim: ${errSync.message}`);
                        console.error("Gagal update status is_synced di attendance_logs:", errSync.message);
                    }
                }
                pushSuccessCount += syncedIds.length;
                console.info(`[Cloud Sync Portal] Log presensi terkirim: ${syncedIds.length} dari ${batch.length} pada batch ini.`);

                if (syncedIds.length < batch.length) {
                    syncErrors.push(`Log presensi: ${batch.length - syncedIds.length} dari ${batch.length} log batch ini belum dikonfirmasi Portal.`);
                    // Stop here so unresolved records are not skipped by later batches.
                    break;
                }
            } catch (pushErr) {
                syncErrors.push(`Log presensi: ${pushErr.message}`);
                console.warn("[Cloud Sync Attendance Error]:", pushErr.message);
                break;
            }
        }

        // 2. PULL: Tarik data Izin / Sakit yang diinput Wali Kelas dari web portal
        emitStage('pull', 'Memeriksa pembaruan dari Portal...', { progress: 85 });
        // Cursor pull dipisahkan dari waktu sinkronisasi UI. Cursor hanya maju
        // setelah portal menjawab sukses dan semua pembaruan dapat diproses.
        // Format SQL UTC dipakai agar cocok dengan CURRENT_TIMESTAMP pada SQLite portal.
        const lastPullTime = settings['cloud_sync_last_pull_time'] || '2000-01-01 00:00:00';
        const pullEndpoint = `${syncBaseUrl}/pull-remote-updates?since=${encodeURIComponent(lastPullTime)}`;
        let pullSucceeded = false;

        try {
            const pullRes = await makeSyncRequest(pullEndpoint, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${syncToken}` }
            });

            if (pullRes.status === 200 && Array.isArray(pullRes.data?.updates)) {
                pullSucceeded = true;
                syncSummary.remoteUpdatesReceived = pullRes.data.updates.length;
                console.info(`[Cloud Sync Portal] Pembaruan dari Portal diterima: ${pullRes.data.updates.length} item.`);
                for (const update of pullRes.data.updates) {
                    // Jika anggota belum dikenal, jangan majukan cursor agar update dicoba lagi.
                    const memberIdentity = update.nipd || update.nisn;
                    const memRes = await pool.query(
                        "SELECT id FROM members WHERE identity_number = $1 OR identity_reference = $1 LIMIT 1",
                        [memberIdentity]
                    );
                    if (memRes.rows.length === 0) {
                        pullSucceeded = false;
                        syncErrors.push('Ada pembaruan Portal yang belum diterapkan karena anggota tidak ditemukan di Nebula.');
                        continue;
                    }

                    const mId = memRes.rows[0].id;
                    const existLog = await pool.query(
                        "SELECT id FROM attendance_logs WHERE member_id = $1 AND date_log = $2",
                        [mId, update.date_log]
                    );
                    if (existLog.rows.length > 0) {
                        await pool.query(
                            "UPDATE attendance_logs SET status = $1, source = 'cloud', is_synced = 1 WHERE id = $2",
                            [update.status, existLog.rows[0].id]
                        );
                    } else {
                        await pool.query(
                            "INSERT INTO attendance_logs (member_id, status, date_log, scan_time, sync_id, is_synced, source) VALUES ($1, $2, $3, $4, $5, 1, 'cloud')",
                            [mId, update.status, update.date_log, `${update.date_log} 07:00:00`, update.sync_id || require('crypto').randomUUID()]
                        );
                    }
                    syncSummary.remoteUpdatesApplied += 1;
                }
            } else {
                pullSucceeded = false;
                syncErrors.push(`Pembaruan Portal gagal diperiksa (GET ${pullEndpoint}, HTTP ${pullRes.status}${responseHint(pullRes)}).`);
            }
        } catch (pullErr) {
            // Pertahankan cursor agar pembaruan remote dapat dicoba lagi pada siklus berikutnya.
            pullSucceeded = false;
            syncErrors.push(`Pembaruan Portal: ${pullErr.message}`);
            console.warn("[Cloud Sync Pull Error]:", pullErr.message);
        }

        const now = new Date();
        const nowStr = now.toISOString();
        const nowSql = nowStr.slice(0, 19).replace('T', ' ');
        const syncStatus = pullSucceeded && syncErrors.length === 0 ? 'synced' : 'partial';
        syncSummary.attendanceConfirmed = pushSuccessCount;
        if (syncErrors.length > 0) {
            console.warn(`[Cloud Sync] Sinkronisasi selesai dengan ${syncErrors.length} masalah:`);
            syncErrors.forEach((message, index) => {
                console.warn(`[Cloud Sync Error ${index + 1}/${syncErrors.length}] ${String(message).slice(0, 500)}`);
            });
        }
        const safeSyncErrors = syncErrors.slice(0, 20).map(message =>
            String(message).replace(/(password|token|secret|authorization)\s*[:=]\s*[^,\s]+/gi, '$1=[REDACTED]').slice(0, 500)
        );
        await pool.query(
            "INSERT INTO app_settings (setting_key, setting_value) VALUES ('cloud_sync_last_status', $1), ('cloud_sync_last_time', $2), ('cloud_sync_last_errors', $3), ('cloud_sync_last_summary', $4) ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value",
            [syncStatus, nowStr, JSON.stringify(safeSyncErrors), JSON.stringify(syncSummary)]
        );

        if (pullSucceeded) {
            await pool.query(
                "INSERT INTO app_settings (setting_key, setting_value) VALUES ('cloud_sync_last_pull_time', $1) ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value",
                [nowSql]
            );
        }

        if (io) io.emit('cloud_sync_status', {
            state: syncStatus, stage: 'complete', progress: 100,
            message: syncStatus === 'synced' ? 'Semua tahap sinkronisasi berhasil.' : 'Sinkronisasi selesai dengan sebagian data gagal.',
            errors: syncErrors, lastTime: nowStr, pushed: pushSuccessCount, pullSucceeded, summary: syncSummary
        });

        return {
            success: syncStatus === 'synced',
            message: syncStatus === 'synced'
                ? `Sinkronisasi selesai: ${pushSuccessCount} log presensi terkirim dan semua tahap berhasil.`
                : `Sinkronisasi parsial: ${syncErrors.length} masalah terdeteksi. ${syncErrors.slice(0, 3).join(' ')}`,
            pushed: pushSuccessCount, pullSucceeded, errors: syncErrors, summary: syncSummary
        };
    } catch (err) {
        console.warn("[Cloud Sync Offline/Error]:", err.message);
        await pool.query(
            "INSERT INTO app_settings (setting_key, setting_value) VALUES ('cloud_sync_last_status', 'offline') ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value"
        );
        if (io) io.emit('cloud_sync_status', { state: 'offline', error: err.message });
        return { success: false, message: "Gagal terhubung ke Cloud: " + err.message };
    } finally {
        isSyncing = false;
    }
};

/**
 * Worker Latar Belakang yang Berjalan Berkala
 */
const startCloudSyncWorker = (pool, io) => {
    setInterval(() => {
        performCloudSync(pool, io, false).catch(() => { });
    }, 30000); // Otomatis sync setiap 30 detik
};

module.exports = {
    getSyncStatus,
    performCloudSync,
    startCloudSyncWorker
};
