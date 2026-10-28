const { pool } = require('../config/database');

const DAYS = [
    'Senin', 'Selasa', 'Rabu', 'Kamis',
    'Jumat', 'Sabtu', 'Minggu'
];

function validTime(value) {
    return typeof value === 'string' &&
        /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function parseInput(body) {
    const assignmentId = Number(body.assignment_id);
    const teacherId = Number(body.teacher_id);
    const divisionId = Number(body.division_id);
    const subjectId = Number(body.subject_id);
    const academicYear = String(body.academic_year || '').trim();
    const semester = Number(body.semester);
    const day = String(body.day_of_week || '');
    const start = String(body.start_time || '');
    const end = String(body.end_time || '');

    const legacyInput = Number.isInteger(assignmentId) && assignmentId > 0;
    const directInput =
        Number.isInteger(teacherId) && teacherId > 0 &&
        Number.isInteger(divisionId) && divisionId > 0 &&
        Number.isInteger(subjectId) && subjectId > 0 &&
        academicYear.length > 0 && academicYear.length <= 30 &&
        [1, 2].includes(semester);

    if ((!legacyInput && !directInput) || !DAYS.includes(day) ||
        !validTime(start) || !validTime(end) || start >= end) {
        return null;
    }

    return {
        assignmentId: legacyInput ? assignmentId : null,
        teacherId, divisionId, subjectId, academicYear, semester,
        day, start, end, directInput
    };
}

async function resolveAssignment(input) {
    if (!input.directInput) {
        const result = await pool.query(
            'SELECT id FROM teaching_assignments WHERE id = $1 AND is_active = 1',
            [input.assignmentId]
        );
        if (!result.rows.length) {
            const error = new Error('Penugasan guru tidak ditemukan atau tidak aktif.');
            error.status = 400;
            throw error;
        }
        return input.assignmentId;
    }

    const teacher = await pool.query(
        'SELECT id FROM members WHERE id = $1 AND LOWER(role) = $2',
        [input.teacherId, 'guru']
    );
    if (!teacher.rows.length) {
        const error = new Error('Guru yang dipilih tidak ditemukan.');
        error.status = 400;
        throw error;
    }

    const division = await pool.query(
        'SELECT id FROM divisions WHERE id = $1',
        [input.divisionId]
    );
    if (!division.rows.length) {
        const error = new Error('Kelas yang dipilih tidak ditemukan.');
        error.status = 400;
        throw error;
    }

    const subject = await pool.query(
        'SELECT id FROM subjects WHERE id = $1 AND is_active = 1',
        [input.subjectId]
    );
    if (!subject.rows.length) {
        const error = new Error('Mata pelajaran tidak ditemukan atau tidak aktif.');
        error.status = 400;
        throw error;
    }

    const existing = await pool.query(`
        SELECT id, is_active FROM teaching_assignments
        WHERE teacher_id = $1 AND division_id = $2 AND subject_id = $3
          AND academic_year = $4 AND semester = $5
    `, [
        input.teacherId, input.divisionId, input.subjectId,
        input.academicYear, input.semester
    ]);

    if (existing.rows.length) {
        if (Number(existing.rows[0].is_active) !== 1) {
            const error = new Error(
                'Penugasan lama untuk kombinasi ini nonaktif. Aktifkan penugasan tersebut terlebih dahulu.'
            );
            error.status = 409;
            throw error;
        }
        return existing.rows[0].id;
    }

    const created = await pool.query(`
        INSERT INTO teaching_assignments
            (teacher_id, division_id, subject_id, academic_year, semester)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
    `, [
        input.teacherId, input.divisionId, input.subjectId,
        input.academicYear, input.semester
    ]);

    return created.rows[0].id;
}

async function findConflict(input, excludeId = null) {
    const result = await pool.query(`
        SELECT ts.id, ts.start_time, ts.end_time,
               incoming.teacher_id, incoming.division_id
        FROM teaching_schedules ts
        JOIN teaching_assignments existing
          ON existing.id = ts.assignment_id
        JOIN teaching_assignments incoming
          ON incoming.id = $1
        WHERE ts.is_active = 1
          AND existing.is_active = 1
          AND ts.day_of_week = $2
          AND existing.academic_year = incoming.academic_year
          AND existing.semester = incoming.semester
          AND (
              existing.teacher_id = incoming.teacher_id
              OR existing.division_id = incoming.division_id
          )
          AND ts.start_time < $4
          AND ts.end_time > $3
          AND ($5 IS NULL OR ts.id <> $5)
        LIMIT 1
    `, [
        input.assignmentId,
        input.day,
        input.start,
        input.end,
        excludeId
    ]);

    return result.rows[0] || null;
}

exports.getSchedules = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                ts.id, ts.assignment_id, ts.day_of_week,
                ts.start_time, ts.end_time, ts.is_active,
                ta.teacher_id, teacher.full_name AS teacher_name,
                ta.division_id, d.name AS division_name,
                ta.subject_id, s.name AS subject_name, s.code AS subject_code,
                ta.academic_year, ta.semester,
                CASE
                    WHEN ta.id IS NULL THEN 'ASSIGNMENT_MISSING'
                    WHEN teacher.id IS NULL THEN 'TEACHER_MISSING'
                    WHEN d.id IS NULL THEN 'DIVISION_MISSING'
                    WHEN s.id IS NULL THEN 'SUBJECT_MISSING'
                    ELSE 'OK'
                END AS relation_status
            FROM teaching_schedules ts
            LEFT JOIN teaching_assignments ta ON ta.id = ts.assignment_id
            LEFT JOIN members teacher ON teacher.id = ta.teacher_id
            LEFT JOIN divisions d ON d.id = ta.division_id
            LEFT JOIN subjects s ON s.id = ta.subject_id
            ORDER BY
                CASE ts.day_of_week
                    WHEN 'Senin' THEN 1 WHEN 'Selasa' THEN 2
                    WHEN 'Rabu' THEN 3 WHEN 'Kamis' THEN 4
                    WHEN 'Jumat' THEN 5 WHEN 'Sabtu' THEN 6
                    ELSE 7
                END,
                ts.start_time, d.name
        `);

        res.json(result.rows);
    } catch (error) {
        console.error('Gagal mengambil jadwal mengajar:', error);
        res.status(500).json({ message: error.message });
    }
};

exports.createSchedule = async (req, res) => {
    try {
        const input = parseInput(req.body);
        if (!input) {
            return res.status(400).json({
                message: 'Penugasan, hari, dan rentang waktu harus valid. Waktu selesai harus setelah waktu mulai.'
            });
        }

        input.assignmentId = await resolveAssignment(input);

        const conflict = await findConflict(input);
        if (conflict) {
            return res.status(409).json({
                message: 'Jadwal bentrok: guru atau kelas sudah memiliki jadwal pada rentang waktu tersebut.',
                conflict
            });
        }

        const result = await pool.query(`
            INSERT INTO teaching_schedules
                (assignment_id, day_of_week, start_time, end_time)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `, [
            input.assignmentId,
            input.day,
            input.start,
            input.end
        ]);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Gagal membuat jadwal mengajar:', error);
        res.status(error.status || 500).json({ message: error.message });
    }
};

exports.updateSchedule = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const input = parseInput(req.body);

        if (!Number.isInteger(id) || id < 1 || !input) {
            return res.status(400).json({
                message: 'ID, penugasan, hari, atau waktu jadwal tidak valid.'
            });
        }

        const current = await pool.query(
            'SELECT id FROM teaching_schedules WHERE id = $1',
            [id]
        );

        if (!current.rows.length) {
            return res.status(404).json({ message: 'Jadwal tidak ditemukan.' });
        }

        input.assignmentId = await resolveAssignment(input);

        const conflict = await findConflict(input, id);
        if (conflict) {
            return res.status(409).json({
                message: 'Jadwal bentrok: guru atau kelas sudah memiliki jadwal pada rentang waktu tersebut.',
                conflict
            });
        }

        const result = await pool.query(`
            UPDATE teaching_schedules
            SET assignment_id = $1,
                day_of_week = $2,
                start_time = $3,
                end_time = $4,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $5
            RETURNING *
        `, [
            input.assignmentId,
            input.day,
            input.start,
            input.end,
            id
        ]);

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Gagal mengubah jadwal mengajar:', error);
        res.status(error.status || 500).json({ message: error.message });
    }
};

exports.setScheduleStatus = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const status = req.body.is_active;

        if (!Number.isInteger(id) || id < 1 ||
            ![true, false, 1, 0].includes(status)) {
            return res.status(400).json({ message: 'ID atau status tidak valid.' });
        }

        const current = await pool.query(`
            SELECT id, assignment_id, day_of_week, start_time, end_time
            FROM teaching_schedules
            WHERE id = $1
        `, [id]);

        if (!current.rows.length) {
            return res.status(404).json({ message: 'Jadwal tidak ditemukan.' });
        }

        if (Boolean(status)) {
            const row = current.rows[0];
            const input = {
                assignmentId: row.assignment_id,
                day: row.day_of_week,
                start: row.start_time,
                end: row.end_time
            };

            const assignment = await pool.query(`
                SELECT id FROM teaching_assignments
                WHERE id = $1 AND is_active = 1
            `, [input.assignmentId]);

            if (!assignment.rows.length) {
                return res.status(400).json({
                    message: 'Penugasan guru tidak ditemukan atau tidak aktif.'
                });
            }

            const conflict = await findConflict(input, id);
            if (conflict) {
                return res.status(409).json({
                    message: 'Jadwal tidak dapat diaktifkan karena bentrok dengan jadwal guru atau kelas.',
                    conflict
                });
            }
        }

        const result = await pool.query(`
            UPDATE teaching_schedules
            SET is_active = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING *
        `, [Number(Boolean(status)), id]);

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Gagal mengubah status jadwal mengajar:', error);
        res.status(500).json({ message: error.message });
    }
};
