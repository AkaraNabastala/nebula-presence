
const { pool } = require('../config/database');

const extracurricularController = {
    // Daftar ekskul beserta jumlah peserta
    async getAll(req, res) {
        try {
            const result = await pool.query(`
                SELECT e.*,
                    (
                        SELECT COUNT(*)
                        FROM extracurricular_members em
                        WHERE em.extracurricular_id = e.id
                    ) AS total_peserta
                FROM extracurriculars e
                ORDER BY e.name
            `);

            res.json({ success: true, data: result.rows });
        } catch (err) {
            console.error('getAll extracurricular:', err);
            res.status(500).json({ success: false, message: 'Gagal mengambil data ekskul.' });
        }
    },

    // Tambah ekskul
    async create(req, res) {
        try {
            const { name, supervisor_name, schedule, description } = req.body;
            if (!name || !name.trim()) {
                return res.status(400).json({ success: false, message: 'Nama ekskul wajib diisi.' });
            }

            const result = await pool.query(`
                INSERT INTO extracurriculars (name, supervisor_name, schedule, description)
                VALUES ($1, $2, $3, $4)
                RETURNING *
            `, [name.trim(), supervisor_name || null, schedule || null, description || null]);

            res.status(201).json({ success: true, data: result.rows[0] });
        } catch (err) {
            if (err.code === '23505' || err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                return res.status(409).json({ success: false, message: 'Nama ekskul sudah terdaftar.' });
            }
            console.error('create extracurricular:', err);
            res.status(500).json({ success: false, message: 'Gagal menambahkan ekskul.' });
        }
    },

    // Absensi ekskul berdasarkan tanggal
    async getAttendance(req, res) {
        try {
            const { date, start_date, end_date, extracurricular_id } = req.query;

            let sql = `
                SELECT a.*, m.full_name, m.identity_number,
                    e.name AS extracurricular_name
                FROM extracurricular_attendance a
                JOIN members m ON m.id = a.member_id
                JOIN extracurriculars e ON e.id = a.extracurricular_id
                WHERE 1 = 1
            `;

            const params = [];

            if (extracurricular_id) {
                params.push(extracurricular_id);
                sql += ` AND a.extracurricular_id = $${params.length}`;
            }

            if (date) {
                params.push(date);
                sql += ` AND a.attendance_date = $${params.length}`;
            } else {
                if (start_date) {
                    params.push(start_date);
                    sql += ` AND a.attendance_date >= $${params.length}`;
                }

                if (end_date) {
                    params.push(end_date);
                    sql += ` AND a.attendance_date <= $${params.length}`;
                }

                if (!start_date && !end_date) {
                    sql += ` AND a.attendance_date = CURRENT_DATE`;
                }
            }

            sql += ` ORDER BY a.attendance_date, e.name, m.full_name`;

            const result = await pool.query(sql, params);

            res.json({ success: true, data: result.rows });
        } catch (err) {
            console.error('getAttendance extracurricular:', err);
            res.status(500).json({
                success: false,
                message: 'Gagal mengambil absensi ekskul.'
            });
        }
    },

    // Simpan atau perbarui absensi peserta
    async saveAttendance(req, res) {
        try {
            const { extracurricular_id, member_id, attendance_date, status, notes } = req.body;
            const allowed = ['Hadir', 'Izin', 'Sakit', 'Alpa'];

            if (!extracurricular_id || !member_id || !allowed.includes(status)) {
                return res.status(400).json({ success: false, message: 'Ekskul, peserta, dan status absensi wajib valid.' });
            }

            const result = await pool.query(`
                INSERT INTO extracurricular_attendance
                    (extracurricular_id, member_id, attendance_date, status, notes)
                VALUES ($1, $2, COALESCE($3, CURRENT_DATE), $4, $5)
                ON CONFLICT (extracurricular_id, member_id, attendance_date)
                DO UPDATE SET status = EXCLUDED.status, notes = EXCLUDED.notes
                RETURNING *
            `, [extracurricular_id, member_id, attendance_date || null, status, notes || null]);

            res.json({ success: true, data: result.rows[0] });
        } catch (err) {
            console.error('saveAttendance extracurricular:', err);
            res.status(500).json({ success: false, message: 'Gagal menyimpan absensi ekskul.' });
        }
    },

    // Daftar jurnal kegiatan
        // Simpan absensi banyak siswa sekaligus
    async saveAttendanceBulk(req, res) {
        try {
            const { extracurricular_id, attendance_date, records } = req.body;
            const allowed = ['Hadir', 'Izin', 'Sakit', 'Alpa'];

            if (
                !extracurricular_id ||
                !attendance_date ||
                !Array.isArray(records) ||
                records.length === 0
            ) {
                return res.status(400).json({
                    success: false,
                    message: 'Ekskul, tanggal, dan daftar absensi wajib diisi.'
                });
            }

            if (records.some(record =>
                !Number.isInteger(Number(record.member_id)) ||
                Number(record.member_id) <= 0 ||
                !allowed.includes(record.status)
            )) {
                return res.status(400).json({
                    success: false,
                    message: 'Data peserta atau status absensi tidak valid.'
                });
            }

            const memberIds = [
                ...new Set(records.map(record => Number(record.member_id)))
            ];

            const registered = await pool.query(`
                SELECT em.member_id
                FROM extracurricular_members em
                JOIN members m ON m.id = em.member_id
                WHERE em.extracurricular_id = $1
                  AND LOWER(m.role) = 'siswa'
            `, [extracurricular_id]);

            const registeredIds = new Set(
                registered.rows.map(row => Number(row.member_id))
            );

            if (memberIds.some(id => !registeredIds.has(id))) {
                return res.status(400).json({
                    success: false,
                    message: 'Ada peserta yang belum terdaftar pada ekskul ini.'
                });
            }

            for (const record of records) {
                await pool.query(`
                    INSERT INTO extracurricular_attendance
                        (extracurricular_id, member_id, attendance_date, status, notes)
                    VALUES ($1, $2, $3, $4, $5)
                    ON CONFLICT (extracurricular_id, member_id, attendance_date)
                    DO UPDATE SET
                        status = EXCLUDED.status,
                        notes = EXCLUDED.notes
                `, [
                    extracurricular_id,
                    Number(record.member_id),
                    attendance_date,
                    record.status,
                    record.notes || null
                ]);
            }

            res.json({
                success: true,
                message: `Absensi ${records.length} peserta berhasil disimpan.`
            });
        } catch (err) {
            console.error('saveAttendanceBulk extracurricular:', err);
            res.status(500).json({
                success: false,
                message: 'Gagal menyimpan absensi massal.'
            });
        }
    },
    async getJournals(req, res) {
        try {
            const { extracurricular_id, start_date, end_date } = req.query;
            let sql = `
                SELECT j.*, e.name AS extracurricular_name
                FROM extracurricular_journals j
                JOIN extracurriculars e ON e.id = j.extracurricular_id
                WHERE 1=1
            `;
            const params = [];

            if (extracurricular_id) {
                params.push(extracurricular_id);
                sql += ` AND j.extracurricular_id = $${params.length}`;
            }
            if (start_date) {
                params.push(start_date);
                sql += ` AND j.activity_date >= $${params.length}`;
            }
            if (end_date) {
                params.push(end_date);
                sql += ` AND j.activity_date <= $${params.length}`;
            }

            sql += ' ORDER BY j.activity_date DESC, j.id DESC';
            const result = await pool.query(sql, params);
            res.json({ success: true, data: result.rows });
        } catch (err) {
            console.error('getJournals extracurricular:', err);
            res.status(500).json({ success: false, message: 'Gagal mengambil jurnal kegiatan.' });
        }
    },

    
    // Daftar siswa dan status keanggotaan ekskul
    async getExtracurricularMembers(req, res) {
        try {
            const { extracurricular_id } = req.query;

            if (!extracurricular_id) {
                return res.status(400).json({
                    success: false,
                    message: 'ID ekskul wajib diisi.'
                });
            }

            const result = await pool.query(`
                SELECT m.id, m.full_name, m.identity_number, m.division_id,
                    d.name AS division_name,
                    CASE WHEN em.member_id IS NOT NULL THEN 1 ELSE 0 END AS is_registered
                FROM members m
                LEFT JOIN divisions d ON d.id = m.division_id
                LEFT JOIN extracurricular_members em
                    ON em.member_id = m.id
                    AND em.extracurricular_id = $1
                WHERE LOWER(m.role) = 'siswa'
                ORDER BY m.full_name
            `, [extracurricular_id]);

            res.json({ success: true, data: result.rows });
        } catch (err) {
            console.error('getExtracurricularMembers:', err);
            res.status(500).json({
                success: false,
                message: 'Gagal mengambil daftar anggota ekskul.'
            });
        }
    },

    // Daftarkan beberapa siswa ke ekskul sekaligus
    async saveExtracurricularMembers(req, res) {
        try {
            const { extracurricular_id, member_ids } = req.body;

            if (!extracurricular_id || !Array.isArray(member_ids)) {
                return res.status(400).json({
                    success: false,
                    message: 'Ekskul dan daftar siswa wajib diisi.'
                });
            }

            const ekskul = await pool.query(
                'SELECT id FROM extracurriculars WHERE id = $1',
                [extracurricular_id]
            );

            if (!ekskul.rows.length) {
                return res.status(404).json({
                    success: false,
                    message: 'Ekskul tidak ditemukan.'
                });
            }

            const ids = [...new Set(member_ids.map(Number))]
                .filter(id => Number.isInteger(id) && id > 0);

            for (const id of ids) {
                await pool.query(`
                    INSERT INTO extracurricular_members
                        (extracurricular_id, member_id)
                    SELECT $1, id
                    FROM members
                    WHERE id = $2 AND LOWER(role) = 'siswa'
                    ON CONFLICT (extracurricular_id, member_id) DO NOTHING
                `, [extracurricular_id, id]);
            }

            res.json({
                success: true,
                message: 'Pendaftaran anggota selesai.'
            });
        } catch (err) {
            console.error('saveExtracurricularMembers:', err);
            res.status(500).json({
                success: false,
                message: 'Gagal menyimpan anggota ekskul.'
            });
        }
    },


    // Tambah jurnal kegiatan
    async createJournal(req, res) {
        try {
            const {
                extracurricular_id, activity_date, start_time, end_time,
                topic, activity_description, attendance_count, notes
            } = req.body;

            if (!extracurricular_id || !topic || !topic.trim()) {
                return res.status(400).json({ success: false, message: 'Ekskul dan topik kegiatan wajib diisi.' });
            }

            const result = await pool.query(`
                INSERT INTO extracurricular_journals
                    (extracurricular_id, activity_date, start_time, end_time,
                     topic, activity_description, attendance_count, notes)
                VALUES ($1, COALESCE($2, CURRENT_DATE), $3, $4, $5, $6, $7, $8)
                RETURNING *
            `, [
                extracurricular_id, activity_date || null, start_time || null,
                end_time || null, topic.trim(), activity_description || null,
                Number.isInteger(Number(attendance_count)) && attendance_count !== ''
                    ? Number(attendance_count) : 0,
                notes || null
            ]);

            res.status(201).json({ success: true, data: result.rows[0] });
        } catch (err) {
            console.error('createJournal extracurricular:', err);
            res.status(500).json({ success: false, message: 'Gagal menyimpan jurnal kegiatan.' });
        }
    }
};

module.exports = extracurricularController;
