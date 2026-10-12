const https = require('https');

/**
 * Panggil Telegram API secara umum
 */
const callTelegramApi = (botToken, pathMethod, payload = null) => {
    return new Promise((resolve) => {
        try {
            let cleanToken = String(botToken).replace(/[^a-zA-Z0-9:_-]/g, '');
            if (cleanToken.toLowerCase().startsWith('bot')) {
                cleanToken = cleanToken.substring(3);
            }
            if (!cleanToken) return resolve({ ok: false, description: "Token kosong/tidak valid" });

            const data = payload ? JSON.stringify(payload) : null;
            const isGet = !payload && !pathMethod.includes('sendMessage');

            const options = {
                hostname: 'api.telegram.org',
                port: 443,
                path: encodeURI(`/bot${cleanToken}/${pathMethod}`),
                method: isGet ? 'GET' : 'POST',
                headers: {
                    ...(data ? {
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(data)
                    } : {})
                },
                timeout: 30000
            };

            const req = https.request(options, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(body);
                        resolve(parsed);
                    } catch {
                        resolve({ ok: false, description: body });
                    }
                });
            });

            req.on('error', (e) => resolve({ ok: false, description: e.message }));
            req.on('timeout', () => { req.destroy(); resolve({ ok: false, description: "Timeout" }); });
            if (data) req.write(data);
            req.end();
        } catch (err) {
            resolve({ ok: false, description: err.message });
        }
    });
};

/**
 * Kirim pesan ke Telegram Bot API
 */
const sendTelegram = async (botToken, chatId, text) => {
    if (!botToken || !chatId || !text) {
        return { success: false, message: "Parameter tidak lengkap" };
    }

    const cleanChatId = String(chatId).replace(/[^0-9-]/g, '');
    if (!cleanChatId) return { success: false, message: "Chat ID tidak valid" };

    const res = await callTelegramApi(botToken, 'sendMessage', {
        chat_id: cleanChatId,
        text: text,
        parse_mode: 'HTML'
    });

    if (res.ok) {
        return { success: true, data: res.result };
    } else {
        return { success: false, message: res.description || "Gagal dari API Telegram" };
    }
};

/**
 * Format string template dengan data absensi secara dinamis & cerdas
 */
const formatTemplate = (template, data, appMode = 'edukasi') => {
    let result = template;
    const isEdu = appMode.toLowerCase() === 'edukasi';
    const role = (data.role || '').toLowerCase();
    const isGuru = role === 'guru' || role === 'staff';

    // NIPD (ID Utama) & NISN (ID Secondary)
    const nipd = data.nipd || data.identity_number || data.info_id || '-';
    const nisn = data.nisn || data.identity_reference || '';

    let idGabungan = nipd;
    if (isEdu && nisn && nisn !== '-' && nisn !== nipd) {
        idGabungan = `${nipd} | NISN: ${nisn}`;
    }

    const kelasNama = data.kelas || data.divisi || data.division_name || '-';

    // Badge status & catatan hangat yang menarik
    let statusBadge = data.status || '-';
    let statusNote = '';

    if (data.mode === 'PULANG') {
        if (data.status === 'PULANG AWAL') {
            statusBadge = '🟡 PULANG AWAL';
            statusNote = isGuru
                ? '<i>Presensi kepulangan awal telah diverifikasi. Hati-hati di jalan Bapak/Ibu! 🛵</i>'
                : '<i>Ananda pulang lebih awal dari jadwal sekolah. Semoga selamat sampai tujuan! 🏡</i>';
        } else {
            statusBadge = '🔵 SELESAI / PULANG';
            statusNote = isGuru
                ? '<i>Terima kasih atas kerja keras dan dedikasinya membimbing siswa hari ini. Selamat beristirahat! 🌟</i>'
                : '<i>Hati-hati di perjalanan pulang dan selamat berkumpul kembali bersama keluarga tercinta! 🏡✨</i>';
        }
    } else {
        if (data.status === 'HADIR') {
            statusBadge = '🟢 TEPAT WAKTU';
            statusNote = isGuru
                ? '<i>Terima kasih telah hadir tepat waktu. Selamat mengajar & menginspirasi hari ini! 📚✨</i>'
                : '<i>Ananda hadir tepat waktu! Semangat belajar dan raih prestasi terbaik hari ini! 🚀✨</i>';
        } else if (data.status === 'TERLAMBAT') {
            statusBadge = '🟠 TERLAMBAT';
            statusNote = isGuru
                ? '<i>Presensi kehadiran telah tersimpan. Selamat menjalankan tugas mulia Bapak/Ibu! 📚</i>'
                : '<i>Tetap semangat belajar! Jangan lupa besok berangkat lebih awal ya ananda. ⏰✨</i>';
        } else if (data.status === 'LEMBUR') {
            statusBadge = '🟣 EXTRA / LIBUR';
            statusNote = '<i>Kehadiran tugas khusus di hari libur berhasil diverifikasi. 👍</i>';
        }
    }

    // Blok format ID yang rapi & terpisah
    let idSection = `🆔 <b>NIPD :</b> <code>${nipd}</code>`;
    if (isEdu && nisn && nisn !== '-' && nisn !== nipd) {
        idSection += `\n🎯 <b>NISN :</b> <code>${nisn}</code>`;
    } else if (!isEdu) {
        idSection = `🆔 <b>ID / NIK :</b> <code>${nipd}</code>`;
    }

    const replacements = {
        '{nama}': data.nama || data.full_name || '-',
        '{id_section}': idSection,
        '{id_pengguna}': idGabungan,
        '{nipd}': nipd,
        '{nisn}': (nisn && nisn !== '-') ? nisn : '-',
        '{status}': data.status || '-',
        '{status_badge}': statusBadge,
        '{status_note}': statusNote,
        '{waktu}': data.waktu || '-',
        '{tanggal}': data.tanggal || new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
        '{kelas}': kelasNama,
        '{divisi}': kelasNama,
        '{mode}': data.mode || '-',
        '{pesan}': data.pesan || '-'
    };

    for (const [key, val] of Object.entries(replacements)) {
        result = result.split(key).join(val);
    }
    return result;
};

/**
 * Pengiriman notifikasi absensi otomatis
 */
const dispatchAttendanceNotification = async (pool, scanData) => {
    try {
        const configRes = await pool.query(
            "SELECT setting_key, setting_value FROM app_settings WHERE setting_key LIKE 'notif_%' OR setting_key = 'app_mode'"
        );
        const settings = {};
        configRes.rows.forEach(r => settings[r.setting_key] = r.setting_value);

        const isTelegramActive = settings['notif_telegram_active'] === '1' || settings['notif_telegram_active'] === 'true';
        const botToken = settings['notif_telegram_bot_token'];

        if (!isTelegramActive || !botToken) return;

        const targetChatId = scanData.telegram_chat_id || settings['notif_telegram_default_chat_id'];
        if (!targetChatId) return;

        const appMode = (settings['app_mode'] || 'edukasi').toLowerCase();
        const isEdu = appMode === 'edukasi';
        const role = (scanData.role || '').toLowerCase();
        const isGuru = role === 'guru' || role === 'staff';

        console.log(`[Notification] Mengirim notifikasi (${scanData.mode}) untuk ${scanData.nama} ke Chat ID: ${targetChatId}...`);

        let defaultMasukTpl, defaultPulangTpl;

        if (isEdu) {
            if (isGuru) {
                // Template Khusus Guru / Pendidik
                defaultMasukTpl =
                    `🔔 <b>PRESENSI MASUK // PENDIDIK & STAF</b>\n` +
                    `━━━━━━━━━━━━━━━━━━━━━\n` +
                    `Presensi kehadiran Bapak/Ibu berhasil diverifikasi:\n\n` +
                    `👨‍🏫 <b>Nama Pendidik :</b> {nama}\n` +
                    `🏫 <b>Unit / Tugas  :</b> {kelas}\n` +
                    `🆔 <b>ID / NIP    :</b> <code>{nipd}</code>\n` +
                    `⏰ <b>Waktu Masuk   :</b> {waktu} WIB\n` +
                    `📌 <b>Status        :</b> <b>{status_badge}</b>\n\n` +
                    `{status_note}`;

                defaultPulangTpl =
                    `🔔 <b>PRESENSI PULANG // PENDIDIK & STAF</b>\n` +
                    `━━━━━━━━━━━━━━━━━━━━━\n` +
                    `Presensi kepulangan Bapak/Ibu berhasil diverifikasi:\n\n` +
                    `👨‍🏫 <b>Nama Pendidik :</b> {nama}\n` +
                    `🏫 <b>Unit / Tugas  :</b> {kelas}\n` +
                    `🆔 <b>ID / NIP      :</b> <code>{nipd}</code>\n` +
                    `⏰ <b>Waktu Pulang  :</b> {waktu} WIB\n` +
                    `📌 <b>Status        :</b> <b>{status_badge}</b>\n\n` +
                    `{status_note}`;
            } else {
                // Template Siswa (Untuk Orang Tua / Wali)
                defaultMasukTpl =
                    `🔔 <b>PRESENSI MASUK SEKOLAH</b>\n` +
                    `━━━━━━━━━━━━━━━━━━━━━\n` +
                    `Pemberitahuan: Ananda telah tiba di sekolah:\n\n` +
                    `👤 <b>Nama Siswa :</b> {nama}\n` +
                    `🏫 <b>Kelas      :</b> {kelas}\n` +
                    `{id_section}\n` +
                    `⏰ <b>Waktu Tiba :</b> {waktu} WIB\n` +
                    `📌 <b>Status     :</b> <b>{status_badge}</b>\n\n` +
                    `{status_note}`;

                defaultPulangTpl =
                    `🔔 <b>PRESENSI PULANG SEKOLAH</b>\n` +
                    `━━━━━━━━━━━━━━━━━━━━━\n` +
                    `Pemberitahuan: Ananda telah selesai belajar dan bersiap pulang:\n\n` +
                    `👤 <b>Nama Siswa :</b> {nama}\n` +
                    `🏫 <b>Kelas      :</b> {kelas}\n` +
                    `{id_section}\n` +
                    `⏰ <b>Waktu Selesai:</b> {waktu} WIB\n` +
                    `📌 <b>Status     :</b> <b>{status_badge}</b>\n\n` +
                    `{status_note}`;
            }
        } else {
            // Template Korporat / Kantor
            defaultMasukTpl =
                `💼 <b>PRESENSI MASUK KERJA</b>\n` +
                `━━━━━━━━━━━━━━━━━━━━━\n` +
                `👤 <b>Nama Karyawan :</b> {nama}\n` +
                `🏢 <b>Divisi / Unit :</b> {divisi}\n` +
                `🆔 <b>ID / NIK      :</b> <code>{nipd}</code>\n` +
                `⏰ <b>Waktu Check-In:</b> {waktu} WIB\n` +
                `📌 <b>Status        :</b> <b>{status_badge}</b>\n\n` +
                `{status_note}`;

            defaultPulangTpl =
                `💼 <b>PRESENSI PULANG KERJA</b>\n` +
                `━━━━━━━━━━━━━━━━━━━━━\n` +
                `👤 <b>Nama Karyawan :</b> {nama}\n` +
                `🏢 <b>Divisi / Unit :</b> {divisi}\n` +
                `🆔 <b>ID / NIK      :</b> <code>{nipd}</code>\n` +
                `⏰ <b>Waktu Pulang  :</b> {waktu} WIB\n` +
                `📌 <b>Status        :</b> <b>{status_badge}</b>\n\n` +
                `{status_note}`;
        }

        const template = scanData.mode === 'PULANG'
            ? (settings['notif_template_pulang'] || defaultPulangTpl)
            : (settings['notif_template_masuk'] || defaultMasukTpl);

        const messageText = formatTemplate(template, scanData, appMode);
        const result = await sendTelegram(botToken, targetChatId, messageText);
        console.log(`[Notification] Hasil pengiriman Telegram:`, result);

        // JIKA GAGAL TERKIRIM (OFFLINE / TIMEOUT), SIMPAN KE OUTBOX QUEUE
        if (!result.success) {
            await pool.query(
                `INSERT INTO notification_queue (chat_id, message_text, status, attempts, last_error) 
                 VALUES ($1, $2, 'PENDING', 1, $3)`,
                [targetChatId, messageText, result.message || 'Gagal terhubung ke Telegram']
            );
        }
    } catch (err) {
        console.error("[Notification Service Error]:", err);
        // Tangkap jika terjadi crash/koneksi internet sekolah terputus
        try {
            if (scanData.telegram_chat_id) {
                await pool.query(
                    `INSERT INTO notification_queue (chat_id, message_text, status, attempts, last_error) 
                     VALUES ($1, $2, 'PENDING', 1, $3)`,
                    [scanData.telegram_chat_id, "Notifikasi Presensi", err.message || 'Network Disconnect']
                );
            }
        } catch { }
    }
};

const handleIncomingMessage = async (pool, io, botToken, msg) => {
    const chatId = msg.chat.id;
    const text = (msg.text || '').trim();
    const senderName = [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(' ') || 'User';

    const modeRes = await pool.query("SELECT setting_value FROM app_settings WHERE setting_key = 'app_mode'");
    const appMode = (modeRes.rows[0]?.setting_value || 'edukasi').toLowerCase();
    const isEdu = appMode === 'edukasi';

    if (text.startsWith('/start')) {
        const parts = text.split(/\s+/);
        const param = parts[1];

        if (param) {
            const cleanParam = param.trim();

            const q = `
                SELECT m.*, d.name as division_name 
                FROM members m 
                LEFT JOIN divisions d ON m.division_id = d.id 
                WHERE m.identity_number = $1 
                   OR m.identity_reference = $1 
                   OR CAST(m.id AS TEXT) = $1 
                LIMIT 1
            `;
            const memRes = await pool.query(q, [cleanParam]);

            if (memRes.rows.length > 0) {
                const member = memRes.rows[0];
                const role = (member.role || '').toLowerCase();
                const isGuru = role === 'guru' || role === 'staff';

                await pool.query('UPDATE members SET telegram_chat_id = $1 WHERE id = $2', [String(chatId), member.id]);

                if (io) {
                    io.emit('member_telegram_updated', {
                        member_id: member.id,
                        telegram_chat_id: String(chatId)
                    });
                }

                const nipd = member.identity_number || '-';
                const nisn = member.identity_reference || '';

                let replyText = '';
                if (isEdu) {
                    if (isGuru) {
                        // Respons Menghubungkan untuk Guru
                        replyText =
                            `✅ <b>NOTIFIKASI TELEGRAM BERHASIL TERHUBUNG</b>\n` +
                            `━━━━━━━━━━━━━━━━━━━━━\n` +
                            `Yth. <b>Bapak/Ibu ${member.full_name}</b>,\n\n` +
                            `Akun Telegram Anda telah resmi tersambung dengan profil Pendidik & Staf:\n\n` +
                            `👨‍🏫 <b>Nama Pendidik :</b> ${member.full_name}\n` +
                            `🏫 <b>Unit / Tugas   :</b> ${member.division_name || 'Dewan Guru'}\n` +
                            `🆔 <b>ID / NIP       :</b> <code>${nipd}</code>\n\n` +
                            `🔔 <i>Notifikasi konfirmasi presensi harian (datang & kepulangan) Anda akan dikirimkan otomatis ke ruang obrolan ini. Selamat bertugas & sukses selalu! 📚✨</i>`;
                    } else {
                        // Respons Menghubungkan untuk Siswa (Format Rapi: NIPD Utama & NISN Terpisah)
                        replyText =
                            `✅ <b>NOTIFIKASI TELEGRAM BERHASIL TERHUBUNG</b>\n` +
                            `━━━━━━━━━━━━━━━━━━━━━\n` +
                            `Halo <b>${senderName}</b>,\n\n` +
                            `Akun Telegram Anda telah resmi tersambung dengan data presensi siswa:\n\n` +
                            `👤 <b>Nama Siswa   :</b> ${member.full_name}\n` +
                            `🏫 <b>Kelas        :</b> ${member.division_name || '-'}\n` +
                            `🆔 <b>NIPD         :</b> <code>${nipd}</code>\n` +
                            (nisn && nisn !== '-' ? `🎯 <b>NISN         :</b> <code>${nisn}</code>\n\n` : `\n`) +
                            `🔔 <i>Laporan presensi (datang & pulang) ananda akan dikirimkan otomatis secara real-time ke ruang obrolan ini untuk kenyamanan orang tua/wali. ✨</i>`;
                    }
                } else {
                    replyText =
                        `✅ <b>NOTIFIKASI TELEGRAM BERHASIL TERHUBUNG</b>\n` +
                        `━━━━━━━━━━━━━━━━━━━━━\n` +
                        `Halo <b>${member.full_name}</b>,\n\n` +
                        `Akun Telegram Anda telah resmi terhubung dengan profil karyawan:\n\n` +
                        `👤 <b>Nama Karyawan :</b> ${member.full_name}\n` +
                        `🏢 <b>Divisi / Unit :</b> ${member.division_name || '-'}\n` +
                        `🆔 <b>ID / NIK      :</b> <code>${nipd}</code>\n\n` +
                        `🔔 <i>Notifikasi log kehadiran presensi kerja Anda akan dikirimkan secara otomatis dan real-time ke obrolan ini. Selamat bekerja! 💼🚀</i>`;
                }

                await sendTelegram(botToken, chatId, replyText);
                console.log(`[Telegram Bot] Chat ID ${chatId} sukses tersambung ke: ${member.full_name}`);
            } else {
                const replyText =
                    `⚠️ <b>VERIFIKASI TIDAK DITEMUKAN</b>\n\n` +
                    `Kode ID <code>${cleanParam}</code> tidak cocok dengan data terdaftar di sistem.\n` +
                    `Silakan periksa kembali tautan yang dibagikan atau hubungi administrator.`;
                await sendTelegram(botToken, chatId, replyText);
            }
        } else {
            const replyText =
                `🔔 <b>SISTEM NOTIFIKASI PRESENSI</b>\n\n` +
                `Halo <b>${senderName}</b>,\n` +
                `Selamat datang di Bot Presensi Real-Time.\n\n` +
                `📌 <b>ID Chat Telegram Anda:</b> <code>${chatId}</code>\n\n` +
                `💡 <i>Untuk menghubungkan akun ini secara instan, silakan klik tautan aktivasi Telegram yang tertera pada aplikasi atau kartu pengenal.</i>`;
            await sendTelegram(botToken, chatId, replyText);
        }
    }
};

/**
 * Jalankan pengurasan antrean notifikasi tertunda saat internet kembali pulih
 */
const drainNotificationQueue = async (pool) => {
    try {
        const configRes = await pool.query(
            "SELECT setting_key, setting_value FROM app_settings WHERE setting_key IN ('notif_telegram_active', 'notif_telegram_bot_token')"
        );
        const settings = {};
        configRes.rows.forEach(r => settings[r.setting_key] = r.setting_value);
        if (settings['notif_telegram_active'] !== '1' || !settings['notif_telegram_bot_token']) return;

        const pendingList = await pool.query(
            "SELECT * FROM notification_queue WHERE status = 'PENDING' AND attempts < 5 ORDER BY id ASC LIMIT 10"
        );

        for (const item of pendingList.rows) {
            const res = await sendTelegram(settings['notif_telegram_bot_token'], item.chat_id, item.message_text);
            if (res.success) {
                await pool.query(
                    "UPDATE notification_queue SET status = 'SENT', sent_at = CURRENT_TIMESTAMP WHERE id = $1",
                    [item.id]
                );
            } else {
                await pool.query(
                    "UPDATE notification_queue SET attempts = attempts + 1, last_error = $1 WHERE id = $2",
                    [res.message || 'Gagal terkirim', item.id]
                );
            }
            // Jeda 250ms per pesan agar ramah rate-limit Telegram
            await new Promise(r => setTimeout(r, 250));
        }
    } catch (e) {
        // Silent error
    }
};

// ==========================================
// TELEGRAM BOT AUTO-LINKING POLLING SERVICE
// ==========================================
let isPollingActive = false;
let currentBotUsername = '';

const getBotInfo = () => ({
    username: currentBotUsername,
    active: isPollingActive
});

const startTelegramPolling = async (pool, io) => {
    if (isPollingActive) return;

    // Drain antrean notifikasi yang tertunda setiap 30 detik
    setInterval(() => {
        drainNotificationQueue(pool).catch(() => { });
    }, 30000);

    try {
        const configRes = await pool.query(
            "SELECT setting_key, setting_value FROM app_settings WHERE setting_key IN ('notif_telegram_active', 'notif_telegram_bot_token')"
        );
        const settings = {};
        configRes.rows.forEach(r => settings[r.setting_key] = r.setting_value);

        const isTelegramActive = settings['notif_telegram_active'] === '1' || settings['notif_telegram_active'] === 'true';
        const botToken = settings['notif_telegram_bot_token'];

        if (!isTelegramActive || !botToken) {
            console.log("[Telegram Bot] Bot tidak aktif atau belum diatur token. Polling dilewati.");
            return;
        }

        // 1. Ambil info bot (Username)
        const meRes = await callTelegramApi(botToken, 'getMe');
        if (!meRes.ok) {
            console.warn("[Telegram Bot] Gagal verifikasi bot:", meRes.description);
            return;
        }

        currentBotUsername = meRes.result.username;
        console.log(`🤖 [Telegram Bot] Berhasil terhubung sebagai @${currentBotUsername}`);

        // Simpan username bot ke app_settings
        await pool.query(
            `INSERT INTO app_settings (setting_key, setting_value) VALUES ('notif_telegram_bot_username', $1) 
             ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value`,
            [currentBotUsername]
        );

        isPollingActive = true;
        let lastOffset = 0;

        // Loop polling di background
        const pollLoop = async () => {
            while (isPollingActive) {
                try {
                    const updateRes = await callTelegramApi(botToken, `getUpdates?offset=${lastOffset}&timeout=15`);
                    if (updateRes.ok && Array.isArray(updateRes.result)) {
                        for (const update of updateRes.result) {
                            lastOffset = update.update_id + 1;
                            if (update.message && update.message.text) {
                                await handleIncomingMessage(pool, io, botToken, update.message);
                            }
                        }
                    } else if (updateRes.description && updateRes.description.includes('Conflict')) {
                        await new Promise(r => setTimeout(r, 15000));
                    }
                } catch (err) {
                    await new Promise(r => setTimeout(r, 5000));
                }
            }
        };

        pollLoop();
    } catch (err) {
        console.error("[Telegram Bot Polling Error]:", err);
    }
};

module.exports = {
    sendTelegram,
    formatTemplate,
    dispatchAttendanceNotification,
    drainNotificationQueue,
    startTelegramPolling,
    getBotInfo
};
