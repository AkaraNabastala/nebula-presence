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

    return {
        enabled: settings['cloud_sync_active'] === '1',
        url: settings['cloud_sync_url'] || '',
        pendingCount: parseInt(pendingCountRes.rows[0]?.count || 0, 10),
        lastStatus: settings['cloud_sync_last_status'] || 'idle',
        lastTime: settings['cloud_sync_last_time'] || ''
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

        if (!isActive || !syncUrl) {
            return { success: false, message: "Sinkronisasi Cloud belum diaktifkan atau URL kosong." };
        }

        isSyncing = true;
        if (io) io.emit('cloud_sync_status', { state: 'syncing' });

        // 0. PUSH SCHOOL INFO: Kirim identitas & branding sekolah ke Web Portal
        try {
            const schoolRes = await pool.query(
                "SELECT setting_key, setting_value FROM app_settings WHERE setting_key IN ('nama_sekolah', 'alamat_sekolah', 'logo_sekolah')"
            );
            const schoolData = {};
            schoolRes.rows.forEach(r => schoolData[r.setting_key] = r.setting_value);

            if (schoolData.nama_sekolah || schoolData.logo_sekolah) {
                const infoEndpoint = `${syncUrl}/push-school-info`;
                await makeSyncRequest(infoEndpoint, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${syncToken}` }
                }, {
                    school_name: schoolData.nama_sekolah || '',
                    school_address: schoolData.alamat_sekolah || '',
                    school_logo: schoolData.logo_sekolah || ''
                });
            }
        } catch (infoErr) {
            console.warn("[Cloud Sync School Info Error]:", infoErr.message);
        }

        // 0.5. PUSH DIVISIONS: Kirim data rombel / kelas beserta wali kelas (supervisor_name)
        try {
            const divRes = await pool.query(
                "SELECT d.id, d.name, d.supervisor_name FROM divisions d ORDER BY d.id ASC"
            );
            if (divRes.rows.length > 0) {
                const divEndpoint = `${syncUrl}/push-divisions`;
                await makeSyncRequest(divEndpoint, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${syncToken}` }
                }, { divisions: divRes.rows });
            }
        } catch (divErr) {
            console.warn("[Cloud Sync Divisions Error]:", divErr.message);
        }

        // 1. PUSH MEMBERS: Kirim data siswa & guru beserta foto ke Web Portal
        try {
            const memberQuery = isManual
                ? `SELECT m.id, m.sync_id, m.identity_number as nipd, m.identity_reference as nisn,
                          m.full_name, m.role, m.rfid_code, m.photo, m.phone_number, m.telegram_chat_id,
                          d.name as division_name, d.supervisor_name
                   FROM members m
                   LEFT JOIN divisions d ON m.division_id = d.id
                   ORDER BY m.id ASC`
                 : `SELECT m.id, m.sync_id, m.identity_number as nipd, m.identity_reference as nisn,
                          m.full_name, m.role, m.rfid_code, m.photo, m.phone_number, m.telegram_chat_id,
                          d.name as division_name, d.supervisor_name
                   FROM members m
                   LEFT JOIN divisions d ON m.division_id = d.id
                   WHERE (m.is_synced = 0 OR m.is_synced IS NULL)
                   ORDER BY m.id ASC
                   LIMIT 100`;

            const pendingMembers = await pool.query(memberQuery);

            if (pendingMembers.rows.length > 0) {
                const memEndpoint = `${syncUrl}/push-members`;
                const memRes = await makeSyncRequest(memEndpoint, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${syncToken}` }
                }, { members: pendingMembers.rows });

                if (memRes.status === 200 && memRes.data?.success) {
                    for (const row of pendingMembers.rows) {
                        await pool.query("UPDATE members SET is_synced = 1 WHERE id = $1", [row.id]);
                    }
                }
            }
        } catch (memErr) {
            console.warn("[Cloud Sync Member Error]:", memErr.message);
        }

        // 2. PUSH ATTENDANCE: Ambil log presensi yang belum terkirim
        const logQuery = isManual
            ? `SELECT a.id, a.sync_id, a.status, a.date_log, a.scan_time, a.scan_out, a.shift_name, a.source,
                      m.identity_number as nipd, m.identity_reference as nisn, m.full_name, m.role,
                      d.name as division_name
               FROM attendance_logs a
               JOIN members m ON a.member_id = m.id
               LEFT JOIN divisions d ON m.division_id = d.id
               ORDER BY a.id ASC
               LIMIT 200`
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

        let pushSuccessCount = 0;
        if (pendingLogs.rows.length > 0) {
            const pushEndpoint = `${syncUrl}/push-attendance`;
            const pushRes = await makeSyncRequest(pushEndpoint, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${syncToken}` }
            }, { logs: pendingLogs.rows });

            if (pushRes.status === 200 && pushRes.data?.synced_ids) {
                const syncedIds = pushRes.data.synced_ids;
                if (syncedIds.length > 0) {
                    for (const sId of syncedIds) {
                        try {
                            await pool.query(
                                "UPDATE attendance_logs SET is_synced = 1 WHERE sync_id = $1 OR id = $2",
                                [sId, sId]
                            );
                        } catch (errSync) {
                            console.error("Gagal update status is_synced di attendance_logs:", errSync.message);
                        }
                    }
                    pushSuccessCount = syncedIds.length;
                }
            }
        }

        // 2. PULL: Tarik data Izin / Sakit yang diinput Wali Kelas dari web portal
        // Cursor pull dipisahkan dari waktu sinkronisasi UI. Cursor hanya maju
        // setelah portal menjawab sukses dan semua pembaruan dapat diproses.
        // Format SQL UTC dipakai agar cocok dengan CURRENT_TIMESTAMP pada SQLite portal.
        const lastPullTime = settings['cloud_sync_last_pull_time'] || '2000-01-01 00:00:00';
        const pullEndpoint = `${syncUrl}/pull-remote-updates?since=${encodeURIComponent(lastPullTime)}`;
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
            }
        } catch (pullErr) {
            // Pertahankan cursor agar pembaruan remote dapat dicoba lagi pada siklus berikutnya.
            pullSucceeded = false;
            console.warn("[Cloud Sync Pull Error]:", pullErr.message);
        }

        const now = new Date();
        const nowStr = now.toISOString();
        const nowSql = nowStr.slice(0, 19).replace('T', ' ');
        await pool.query(
            "INSERT INTO app_settings (setting_key, setting_value) VALUES ('cloud_sync_last_status', 'synced'), ('cloud_sync_last_time', $1) ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value",
            [nowStr]
        );

        if (pullSucceeded) {
            await pool.query(
                "INSERT INTO app_settings (setting_key, setting_value) VALUES ('cloud_sync_last_pull_time', $1) ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value",
                [nowSql]
            );
        }

        if (io) io.emit('cloud_sync_status', { state: 'synced', lastTime: nowStr, pushed: pushSuccessCount });

        return {
            success: true,
            message: `Berhasil sinkronisasi: ${pushSuccessCount} log terkirim ke Cloud.`,
            pushed: pushSuccessCount
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
