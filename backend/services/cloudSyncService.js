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
        "SELECT COUNT(*) as count FROM attendance_logs WHERE is_synced = 0"
    );

    let lastErrors = [];
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
        lastErrors
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
        const emitStage = (stage, message, details = {}) => {
            if (io) io.emit('cloud_sync_status', { state: 'syncing', stage, message, ...details });
        };
        emitStage('connecting', 'Menghubungkan ke Portal...', { progress: 5 });
        let portalNeedsBootstrap = false;
        try {
            const handshake = await makeSyncRequest(`${syncBaseUrl}/handshake`, { method: 'POST', headers: { 'Authorization': `Bearer ${syncToken}` } });
            if (handshake.status === 200 && handshake.data?.success) portalNeedsBootstrap = handshake.data?.bootstrap_required === true;
            else syncErrors.push(`Handshake Portal gagal (HTTP ${handshake.status}).`);
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
                if (infoPush.status !== 200 || !infoPush.data?.success) syncErrors.push(`Identitas sekolah gagal dikirim (HTTP ${infoPush.status}).`);
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
                        syncErrors.push(`Akun administrator gagal dikirim (HTTP ${accountRes.status}).`);
                        console.warn('[Cloud Sync Admin Error]:', accountRes.data?.message || `HTTP ${accountRes.status}`);
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
            if (divPush.status !== 200 || !divPush.data?.success) syncErrors.push(`Data kelas gagal dikirim (HTTP ${divPush.status}).`);
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
                   LEFT JOIN teacher_accounts ta ON ta.member_id = m.id AND LOWER(m.role) = 'guru'
                   ORDER BY m.id ASC`
                 : `SELECT m.id, m.sync_id, m.identity_number as nipd, m.identity_reference as nisn,
                          m.full_name, m.role, m.rfid_code, m.photo, m.phone_number, m.telegram_chat_id,
                          d.name as division_name, d.supervisor_name, ${credentialFields}
                   FROM members m
                   LEFT JOIN divisions d ON m.division_id = d.id
                   LEFT JOIN teacher_accounts ta ON ta.member_id = m.id AND LOWER(m.role) = 'guru'
                   WHERE (m.is_synced = 0 OR m.is_synced IS NULL)
                   ORDER BY m.id ASC
                   LIMIT 100`;

            const pendingMembers = await pool.query(memberQuery);

            if (pendingMembers.rows.length > 0 || isManual || portalNeedsBootstrap) {
                const memEndpoint = `${syncBaseUrl}/push-members`;
                const memRes = await makeSyncRequest(memEndpoint, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${syncToken}` }
                }, { members: pendingMembers.rows });

                if (memRes.status === 200 && Array.isArray(memRes.data?.synced_ids)) {
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
                    syncErrors.push(`Data siswa/guru gagal dikirim (HTTP ${memRes.status} atau respons tidak valid).`);
                }
            }
        } catch (memErr) {
            syncErrors.push(`Data siswa/guru: ${memErr.message}`);
            console.warn("[Cloud Sync Member Error]:", memErr.message);
        }

        // 1.5. PUSH TEACHING SCHEDULES: snapshot penuh agar Portal tidak menyimpan jadwal usang.
        emitStage('schedules', 'Mengirim dan mencocokkan jadwal pelajaran...', { progress: 55 });
        try {
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
            const schedulePush = await makeSyncRequest(`${syncBaseUrl}/push-teaching-schedules`, { method: 'POST', headers: { 'Authorization': `Bearer ${syncToken}` } }, { schedules: scheduleRes.rows });
            if (schedulePush.status !== 200 || !schedulePush.data?.success || Number(schedulePush.data?.skipped || 0) > 0) {
                const detail = schedulePush.data?.message || `HTTP ${schedulePush.status}`;
                syncErrors.push(`Jadwal tidak tersinkron sempurna: ${detail}`);
                console.warn('[Cloud Sync Schedules Error]:', detail);
            }
            emitStage('schedules', schedulePush.data?.message || 'Jadwal selesai diproses.', {
                progress: 65, total: scheduleRes.rows.length,
                processed: Number(schedulePush.data?.synced || 0),
                skipped: Number(schedulePush.data?.skipped || 0)
            });
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
                    syncErrors.push(`Log presensi batch gagal dikirim (HTTP ${pushRes.status}).`);
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
                }
            } else {
                pullSucceeded = false;
                syncErrors.push(`Pembaruan Portal gagal diperiksa (HTTP ${pullRes.status}).`);
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
        const safeSyncErrors = syncErrors.slice(0, 20).map(message =>
            String(message).replace(/(password|token|secret|authorization)\s*[:=]\s*[^,\s]+/gi, '$1=[REDACTED]').slice(0, 500)
        );
        await pool.query(
            "INSERT INTO app_settings (setting_key, setting_value) VALUES ('cloud_sync_last_status', $1), ('cloud_sync_last_time', $2), ('cloud_sync_last_errors', $3) ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value",
            [syncStatus, nowStr, JSON.stringify(safeSyncErrors)]
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
            errors: syncErrors, lastTime: nowStr, pushed: pushSuccessCount, pullSucceeded
        });

        return {
            success: syncStatus === 'synced',
            message: syncStatus === 'synced'
                ? `Sinkronisasi selesai: ${pushSuccessCount} log presensi terkirim dan semua tahap berhasil.`
                : `Sinkronisasi parsial: ${syncErrors.length} masalah terdeteksi. ${syncErrors.slice(0, 3).join(' ')}`,
            pushed: pushSuccessCount, pullSucceeded, errors: syncErrors
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
