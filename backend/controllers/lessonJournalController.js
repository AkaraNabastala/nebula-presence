const { pool } = require("../config/database");

const VALID_ATTENDANCE = new Set(["HADIR", "IZIN", "SAKIT", "ALFA"]);
const DAY_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

function teacherOnly(req, res) {
    if (req.user?.type !== "teacher" || !Number.isInteger(Number(req.user?.member_id))) {
        res.status(403).json({ message: "Endpoint ini khusus akun guru." });
        return false;
    }
    return true;
}

function validDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return false;
    const parsed = new Date(`${value}T00:00:00`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function dateIsFuture(value) {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
    return value > today;
}

async function getScheduleAccess(scheduleId, lessonDate, teacherId) {
    const result = await pool.query(
        `SELECT ts.id, ts.day_of_week, ts.start_time, ts.end_time,
                ta.teacher_id, ta.division_id, ta.subject_id,
                d.name AS class_name, s.name AS subject_name
         FROM teaching_schedules ts
         JOIN teaching_assignments ta ON ta.id = ts.assignment_id
         JOIN divisions d ON d.id = ta.division_id
         JOIN subjects s ON s.id = ta.subject_id
         WHERE ts.id = $1
           AND ts.is_active = 1
           AND ta.is_active = 1
           AND ta.teacher_id = $2`,
        [scheduleId, teacherId]
    );

    const schedule = result.rows?.[0];
    if (!schedule) {
        return { ok: false, reason: 'Jadwal aktif milik guru tidak ditemukan.' };
    }

    const dayIndex = new Date(`${lessonDate}T00:00:00`).getDay();
    if (schedule.day_of_week !== DAY_NAMES[dayIndex]) {
        return { ok: false, reason: 'Tanggal tidak sesuai dengan hari jadwal.' };
    }

    const holiday = await pool.query(
        'SELECT holiday_date FROM holidays WHERE holiday_date = $1',
        [lessonDate]
    );
    if (holiday.rows?.length) {
        return { ok: false, reason: 'Tanggal tersebut merupakan hari libur.' };
    }

    const absence = await pool.query(
        `SELECT status FROM attendance_logs
         WHERE member_id = $1
           AND date_log = $2
           AND UPPER(status) IN ('SAKIT', 'IZIN', 'ALFA')
         LIMIT 1`,
        [teacherId, lessonDate]
    );
    if (absence.rows?.length) {
        return { ok: false, reason: 'Guru tercatat tidak hadir pada tanggal tersebut.' };
    }

    return { ok: true, schedule };
}

async function getMySchedules(req, res) {
    if (!teacherOnly(req, res)) return;

    try {
        const teacherId = Number(req.user.member_id);
        const result = await pool.query(
            `SELECT ts.id AS schedule_id, ts.day_of_week,
                    ts.start_time, ts.end_time,
                    ta.id AS assignment_id, ta.division_id,
                    ta.subject_id, d.name AS class_name,
                    s.name AS subject_name
             FROM teaching_schedules ts
             JOIN teaching_assignments ta ON ta.id = ts.assignment_id
             JOIN divisions d ON d.id = ta.division_id
             JOIN subjects s ON s.id = ta.subject_id
             WHERE ts.is_active = 1
               AND ta.is_active = 1
               AND ta.teacher_id = $1
             ORDER BY
               CASE ts.day_of_week
                 WHEN 'Senin' THEN 1 WHEN 'Selasa' THEN 2
                 WHEN 'Rabu' THEN 3 WHEN 'Kamis' THEN 4
                 WHEN 'Jumat' THEN 5 WHEN 'Sabtu' THEN 6
                 ELSE 7
               END,
               ts.start_time`,
            [teacherId]
        );

        return res.json({ schedules: result.rows || [] });
    } catch (error) {
        console.error('Gagal mengambil jadwal jurnal:', error);
        return res.status(500).json({
            message: 'Jadwal mengajar gagal dimuat.'
        });
    }
}


async function saveJournal(req, res) {
    if (!teacherOnly(req, res)) return;

    const teacherId = Number(req.user.member_id);
    const body = req.body || {};
    const scheduleId = Number(body.schedule_id);
    const lessonDate = body.lesson_date;
    const topic = typeof body.topic === "string" ? body.topic.trim() : "";

    if (!Number.isInteger(scheduleId) || !validDate(lessonDate) ||
        dateIsFuture(lessonDate) || !topic) {
        return res.status(400).json({
            message: "Jadwal, tanggal yang valid, dan topik wajib diisi."
        });
    }

    try {
        const access = await getScheduleAccess(scheduleId, lessonDate, teacherId);
        if (!access.ok) {
            return res.status(403).json({ message: access.reason });
        }

        const existing = await pool.query(
            "SELECT id, status FROM lesson_journals WHERE schedule_id = $1 AND lesson_date = $2",
            [scheduleId, lessonDate]
        );

        if (existing.rows.length && existing.rows[0].status !== "DRAFT") {
            return res.status(409).json({
                message: "Jurnal sudah dikirim atau dibatalkan dan tidak dapat diubah."
            });
        }

        let journalId;
        if (existing.rows.length) {
            journalId = Number(existing.rows[0].id);
            await pool.query(
                `UPDATE lesson_journals
                 SET topic = $1, materials = $2, notes = $3,
                     filled_by_teacher_id = $4, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $5 AND status = 'DRAFT'`,
                [topic, body.materials || null, body.notes || null, teacherId, journalId]
            );
        } else {
            const inserted = await pool.query(
                `INSERT INTO lesson_journals
                 (schedule_id, lesson_date, assigned_teacher_id,
                  filled_by_teacher_id, topic, materials, notes)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 RETURNING id`,
                [scheduleId, lessonDate, teacherId, teacherId, topic,
                 body.materials || null, body.notes || null]
            );
            journalId = Number(inserted.rows[0]?.id || inserted.insertId);
        }

        await pool.query(
            `INSERT INTO lesson_journal_audit
             (journal_id, actor_member_id, action, details)
             VALUES ($1, $2, $3, $4)`,
            [journalId, teacherId, "SAVE_DRAFT", JSON.stringify({ scheduleId, lessonDate })]
        );

        return res.json({
            message: "Jurnal tersimpan sebagai draf.",
            journal_id: journalId
        });
    } catch (error) {
        console.error("Gagal menyimpan jurnal:", error);
        return res.status(500).json({ message: "Jurnal gagal disimpan." });
    }
}


async function getLessonStudents(req, res) {
    if (!teacherOnly(req, res)) return;

    const teacherId = Number(req.user.member_id);
    const scheduleId = Number(req.params.scheduleId);
    const lessonDate = String(req.query.date || "");

    if (!Number.isInteger(scheduleId) || !validDate(lessonDate) ||
        dateIsFuture(lessonDate)) {
        return res.status(400).json({
            message: "Jadwal atau tanggal tidak valid."
        });
    }

    try {
        const access = await getScheduleAccess(scheduleId, lessonDate, teacherId);
        if (!access.ok) {
            return res.status(403).json({ message: access.reason });
        }

        const result = await pool.query(
            `SELECT id, full_name
             FROM members
             WHERE division_id = $1 AND LOWER(role) = 'siswa'
             ORDER BY full_name`,
            [access.schedule.division_id]
        );

        return res.json({ students: result.rows || [] });
    } catch (error) {
        console.error("Gagal mengambil daftar siswa:", error);
        return res.status(500).json({
            message: "Daftar siswa gagal dimuat."
        });
    }
}


async function saveLessonAttendance(req, res) {
    if (!teacherOnly(req, res)) return;

    const teacherId = Number(req.user.member_id);
    const body = req.body || {};
    const scheduleId = Number(body.schedule_id);
    const lessonDate = body.lesson_date;
    const attendance = body.attendance;

    if (!Number.isInteger(scheduleId) || !validDate(lessonDate) ||
        dateIsFuture(lessonDate) || !Array.isArray(attendance)) {
        return res.status(400).json({
            message: "Jadwal, tanggal, dan daftar absensi harus valid."
        });
    }

    try {
        const access = await getScheduleAccess(scheduleId, lessonDate, teacherId);
        if (!access.ok) {
            return res.status(403).json({ message: access.reason });
        }

        const journalResult = await pool.query(
            `SELECT id, status FROM lesson_journals
             WHERE schedule_id = $1 AND lesson_date = $2`,
            [scheduleId, lessonDate]
        );

        if (!journalResult.rows.length) {
            return res.status(409).json({
                message: "Simpan jurnal mengajar terlebih dahulu."
            });
        }

        const journal = journalResult.rows[0];
        if (journal.status !== "DRAFT") {
            return res.status(409).json({
                message: "Absensi hanya dapat diubah ketika jurnal berstatus draf."
            });
        }

        const studentResult = await pool.query(
            `SELECT id FROM members
             WHERE division_id = $1 AND LOWER(role) = 'siswa'`,
            [access.schedule.division_id]
        );
        const allowed = new Set(studentResult.rows.map(row => Number(row.id)));
        const seen = new Set();

        for (const item of attendance) {
            const studentId = Number(item && item.student_id);
            const status = String(item && item.status || "").toUpperCase();

            if (!Number.isInteger(studentId) || !allowed.has(studentId) ||
                seen.has(studentId) ||
                !["HADIR", "IZIN", "SAKIT", "ALFA"].includes(status)) {
                return res.status(400).json({
                    message: "Ada siswa duplikat, siswa di luar kelas, atau status tidak valid."
                });
            }
            seen.add(studentId);
        }

        // Validasi semua baris dilakukan sebelum mulai menulis.
        // Adapter SQLite saat ini belum menyediakan transaksi aman.
        for (const item of attendance) {
            const studentId = Number(item.student_id);
            const status = String(item.status).toUpperCase();
            const note = typeof item.notes === "string" ? item.notes : null;

            const previous = await pool.query(
                `SELECT id FROM lesson_attendance
                 WHERE journal_id = $1 AND student_id = $2`,
                [Number(journal.id), studentId]
            );

            if (previous.rows.length) {
                await pool.query(
                    `UPDATE lesson_attendance
                     SET status = $1, notes = $2, updated_at = CURRENT_TIMESTAMP
                     WHERE id = $3`,
                    [status, note, Number(previous.rows[0].id)]
                );
            } else {
                await pool.query(
                    `INSERT INTO lesson_attendance
                     (journal_id, student_id, status, notes)
                     VALUES ($1, $2, $3, $4)`,
                    [Number(journal.id), studentId, status, note]
                );
            }
        }

        await pool.query(
            `INSERT INTO lesson_journal_audit
             (journal_id, actor_member_id, action, details)
             VALUES ($1, $2, $3, $4)`,
            [Number(journal.id), teacherId, "SAVE_ATTENDANCE",
             JSON.stringify({ count: attendance.length })]
        );

        return res.json({
            message: "Absensi mata pelajaran berhasil disimpan.",
            saved_count: attendance.length
        });
    } catch (error) {
        console.error("Gagal menyimpan absensi mata pelajaran:", error);
        return res.status(500).json({
            message: "Absensi gagal disimpan. Periksa data sebelum mencoba ulang."
        });
    }
}

module.exports = {
    teacherOnly,
    validDate,
    dateIsFuture,
    getScheduleAccess,
    getMySchedules,
    saveJournal,
    getLessonStudents,
    saveLessonAttendance
};
