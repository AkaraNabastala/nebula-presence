const { pool } = require("../config/database");

function validMonth(value) {
    return /^\d{4}-(0[1-9]|1[0-2])$/.test(String(value || ""));
}

function optionalId(value) {
    if (value === undefined || value === null || value === "") {
        return { valid: true, value: null };
    }

    const id = Number(value);
    if (!Number.isSafeInteger(id) || id <= 0) {
        return { valid: false, value: null };
    }

    return { valid: true, value: id };
}

exports.getAcademicMonitoring = async (req, res) => {
    const month = String(req.query.month || "");
    const classFilter = optionalId(req.query.class_id);
    const subjectFilter = optionalId(req.query.subject_id);
    const teacherFilter = optionalId(req.query.teacher_id);

    if (
        !validMonth(month) ||
        !classFilter.valid ||
        !subjectFilter.valid ||
        !teacherFilter.valid
    ) {
        return res.status(400).json({
            message: "Parameter bulan atau filter monitoring tidak valid."
        });
    }

    try {
        const journalsParams = [month];
        let journalFilter = "substr(CAST(lj.lesson_date AS TEXT), 1, 7) = $1";

        if (classFilter.value !== null) {
            journalsParams.push(classFilter.value);
            journalFilter += ` AND ta.division_id = $${journalsParams.length}`;
        }

        if (subjectFilter.value !== null) {
            journalsParams.push(subjectFilter.value);
            journalFilter += ` AND ta.subject_id = $${journalsParams.length}`;
        }

        if (teacherFilter.value !== null) {
            journalsParams.push(teacherFilter.value);
            journalFilter += ` AND ta.teacher_id = $${journalsParams.length}`;
        }

        const journalsResult = await pool.query(
            `SELECT
                lj.id AS journal_id,
                lj.lesson_date AS activity_date,
                d.name AS class_name,
                s.name AS subject_name,
                teacher.full_name AS teacher_name,
                lj.topic AS journal,
                lj.notes AS notes,
                lj.status AS journal_status
             FROM lesson_journals lj
             JOIN teaching_schedules ts
               ON ts.id = lj.schedule_id
             JOIN teaching_assignments ta
               ON ta.id = ts.assignment_id
             JOIN divisions d
               ON d.id = ta.division_id
             JOIN subjects s
               ON s.id = ta.subject_id
             JOIN members teacher
               ON teacher.id = ta.teacher_id
             WHERE ${journalFilter}
               AND lj.status = 'SUBMITTED'
             ORDER BY lj.lesson_date DESC, d.name, s.name, teacher.full_name`,
            journalsParams
        );

        const attendanceParams = [month];
        let attendanceFilter =
            "substr(CAST(lj.lesson_date AS TEXT), 1, 7) = $1";

        if (classFilter.value !== null) {
            attendanceParams.push(classFilter.value);
            attendanceFilter += ` AND ta.division_id = $${attendanceParams.length}`;
        }

        if (subjectFilter.value !== null) {
            attendanceParams.push(subjectFilter.value);
            attendanceFilter += ` AND ta.subject_id = $${attendanceParams.length}`;
        }

        if (teacherFilter.value !== null) {
            attendanceParams.push(teacherFilter.value);
            attendanceFilter += ` AND ta.teacher_id = $${attendanceParams.length}`;
        }

        const attendanceResult = await pool.query(
            `SELECT
                lj.lesson_date AS attendance_date,
                d.name AS class_name,
                s.name AS subject_name,
                teacher.full_name AS teacher_name,
                student.full_name AS student_name,
                la.status AS status,
                la.notes AS notes
             FROM lesson_attendance la
             JOIN lesson_journals lj
               ON lj.id = la.journal_id
             JOIN teaching_schedules ts
               ON ts.id = lj.schedule_id
             JOIN teaching_assignments ta
               ON ta.id = ts.assignment_id
             JOIN divisions d
               ON d.id = ta.division_id
             JOIN subjects s
               ON s.id = ta.subject_id
             JOIN members teacher
               ON teacher.id = ta.teacher_id
             JOIN members student
               ON student.id = la.student_id
             WHERE ${attendanceFilter}
               AND lj.status = 'SUBMITTED'
             ORDER BY lj.lesson_date DESC, d.name, student.full_name`,
            attendanceParams
        );

        return res.json({
            data: {
                journals: journalsResult.rows || [],
                attendance: attendanceResult.rows || []
            }
        });
    } catch (error) {
        console.error("Gagal memuat monitoring akademik:", error);

        return res.status(500).json({
            message: "Monitoring akademik gagal dimuat."
        });
    }
};
