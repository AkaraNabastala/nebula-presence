
import React, { useEffect, useState } from 'react';
import {
    CalendarDays,
    ClipboardList,
    Users,
    Plus,
    BookOpen,
    RefreshCw,
    Download,
    Filter
} from 'lucide-react';
import api from '../api/axios';
import { toast } from 'react-toastify';

const inputClass = "w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:bg-slate-900 dark:border-slate-700 dark:text-white dark:focus:ring-blue-950";
const cardClass = "bg-white rounded-2xl border border-blue-100/80 shadow-sm p-5 sm:p-6 dark:bg-slate-900 dark:border-slate-800";
const currentMonth = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const monthRange = (month) => {
    const [year, monthNumber] = month.split('-').map(Number);
    const lastDay = new Date(year, monthNumber, 0).getDate();
    return {
        start_date: `${month}-01`,
        end_date: `${month}-${String(lastDay).padStart(2, '0')}`
    };
};
const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function Extracurricular() {
    const [tab, setTab] = useState('ekskul');
    const [items, setItems] = useState([]);
    const [members, setMembers] = useState([]);
    const [attendance, setAttendance] = useState([]);
    const [journals, setJournals] = useState([]);
    const [selected, setSelected] = useState('');
    const [date, setDate] = useState(today());
    const [month, setMonth] = useState(currentMonth());
    const [loading, setLoading] = useState(false);

    const [name, setName] = useState('');
    const [supervisorId, setSupervisorId] = useState('');
    const [scheduleDays, setScheduleDays] = useState([]);
    const [scheduleStart, setScheduleStart] = useState('15:00');
    const [scheduleEnd, setScheduleEnd] = useState('16:30');

    const [memberId, setMemberId] = useState('');
    const [registeredStudents, setRegisteredStudents] = useState([]);
    const [selectedStudentIds, setSelectedStudentIds] = useState([]);
    const [savingMembers, setSavingMembers] = useState(false);
    const [status, setStatus] = useState('Hadir');
    const [attendanceNotes, setAttendanceNotes] = useState('');
    const [attendanceDrafts, setAttendanceDrafts] = useState({});
    const [savingAttendance, setSavingAttendance] = useState(false);

    const [topic, setTopic] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [activityDescription, setActivityDescription] = useState('');
    const [attendanceCount, setAttendanceCount] = useState('0');
    const [journalNotes, setJournalNotes] = useState('');
    const [journalMonth, setJournalMonth] = useState(currentMonth());
    const [journalExtracurricular, setJournalExtracurricular] = useState('');

    const filteredJournals = journals.filter((journal) => {
    const activityDate = String(journal.activity_date || '').slice(0, 10);
    const matchesMonth = !journalMonth || activityDate.startsWith(journalMonth);
    const matchesExtracurricular =
        !journalExtracurricular ||
        String(journal.extracurricular_id) === String(journalExtracurricular);

        return matchesMonth && matchesExtracurricular;
    });

    const downloadMonthlyJournal = async () => {
        if (!filteredJournals.length) {
            return toast.info('Tidak ada jurnal pada filter bulan dan ekskul yang dipilih.');
        }

        const XLSX = await import("xlsx-js-style");

        const headers = [
            'Tanggal',
            'Ekstrakurikuler',
            'Topik Kegiatan',
            'Waktu Mulai',
            'Waktu Selesai',
            'Jumlah Peserta',
            'Deskripsi Kegiatan',
            'Catatan'
        ];

        const rows = filteredJournals.map((journal) => [
            String(journal.activity_date || '').slice(0, 10),
            journal.extracurricular_name || '',
            journal.topic || '',
            journal.start_time || '',
            journal.end_time || '',
            journal.attendance_count ?? 0,
            journal.activity_description || '',
            journal.notes || ''
        ]);

        const wsData = [headers, ...rows];
        const ws = XLSX.utils.aoa_to_sheet(wsData);

        // Styling header
        const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const cellAddress = XLSX.utils.encode_cell({ r: 0, c: C });
            if (!ws[cellAddress]) continue;
            ws[cellAddress].s = {
                font: { bold: true, color: { rgb: "FFFFFF" } },
                fill: { fgColor: { rgb: "059669" } },
                alignment: { horizontal: "center", vertical: "center" }
            };
        }

        ws['!cols'] = headers.map(() => ({ wch: 22 }));

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Jurnal Ekskul');

        const selectedName =
            items.find(item => String(item.id) === String(journalExtracurricular))?.name
            || 'Semua-Ekskul';

        XLSX.writeFile(wb, `Jurnal-${selectedName.replace(/[^a-z0-9-_]/gi, '-')}-${journalMonth || 'Semua-Bulan'}.xlsx`);
        toast.success('File jurnal ekstrakurikuler berhasil disiapkan.');
    };
    const loadExtracurriculars = async () => {
        try {
            const res = await api.get('/extracurriculars');
            const data = res.data?.data || [];
            setItems(data);
            if (!selected && data.length) setSelected(String(data[0].id));
        } catch (err) {
            toast.error(err.response?.data?.message || 'Gagal memuat data ekskul.');
        }
    };

    
    const loadMembers = async () => {
        try {
            const res = await api.get('/members');
            const data = res.data?.data || res.data;
            setMembers(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Gagal memuat peserta', err);
        }
    };
    
    const loadExtracurricularMembers = async () => {
        if (!selected) {
            setRegisteredStudents([]);
            setSelectedStudentIds([]);
            return;
        }

        try {
            const res = await api.get('/extracurriculars/members', {
                params: { extracurricular_id: selected }
            });
            const data = res.data?.data || [];

            setRegisteredStudents(data);
            setSelectedStudentIds(
                data.filter(student => Number(student.is_registered) === 1)
                    .map(student => String(student.id))
            );
        } catch (err) {
            toast.error(err.response?.data?.message || 'Gagal memuat anggota ekskul.');
        }
    };

    const saveExtracurricularMembers = async () => {
        if (!selected) {
            return toast.warning('Pilih ekskul terlebih dahulu.');
        }

        setSavingMembers(true);
        try {
            await api.post('/extracurriculars/members', {
                extracurricular_id: Number(selected),
                member_ids: selectedStudentIds.map(Number)
            });

            toast.success('Pendaftaran siswa berhasil disimpan.');
            await loadExtracurricularMembers();
            await loadExtracurriculars();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Gagal menyimpan anggota ekskul.');
        } finally {
            setSavingMembers(false);
        }
    };

    const supervisors = members.filter(member =>
        String(member.role || '').toLowerCase() === 'guru'
    );

    const students = members.filter(member =>
        String(member.role || '').toLowerCase() === 'siswa'
    );

    const loadAttendance = async () => {
        if (!selected) {
            setAttendance([]);
            setAttendanceDrafts({});
            return;
        }

        try {
            const range = monthRange(month);
            const res = await api.get('/extracurriculars/attendance', {
                params: { extracurricular_id: selected, ...range }
            });

            const records = res.data?.data || [];
            setAttendance(records);

            const drafts = {};
            const registered = registeredStudents.filter(
                student => Number(student.is_registered) === 1
            );

            registered.forEach(student => {
                const saved = records.find(
                    record => String(record.member_id) === String(student.id)
                );

                drafts[String(student.id)] = {
                    status: saved?.status || 'Hadir',
                    notes: saved?.notes || ''
                };
            });

            setAttendanceDrafts(drafts);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Gagal memuat absensi.');
        }
    };

    const loadJournals = async () => {
        try {
            const params = {
                extracurricular_id: journalExtracurricular || undefined,
            };

            if (journalMonth) {
                const [year, monthNumber] = journalMonth
                    .split('-')
                    .map(Number);

                const lastDay = new Date(
                    year,
                    monthNumber,
                    0
                ).getDate();

                params.start_date = `${journalMonth}-01`;
                params.end_date =
                    `${journalMonth}-${String(lastDay).padStart(2, '0')}`;
            }

            const res = await api.get('/extracurriculars/journals', {
                params,
            });

            setJournals(res.data?.data || []);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Gagal memuat jurnal.');
        }
    };

    const refresh = async () => {
        setLoading(true);
        await Promise.all([loadExtracurriculars(), loadMembers()]);
        setLoading(false);
    };

    useEffect(() => {
        refresh();
    }, []);

    useEffect(() => {
        if (selected) {
            loadAttendance();
        } else {
            setAttendance([]);
            setAttendanceDrafts({});
        }
    }, [selected, month]);

    useEffect(() => {
        loadJournals();
    }, [journalMonth, journalExtracurricular]);
    
    useEffect(() => {
        loadExtracurricularMembers();
    }, [selected]);

    
    const addExtracurricular = async (e) => {
        e.preventDefault();

        if (!name.trim()) {
            return toast.warning('Nama ekskul wajib diisi.');
        }

        if (!supervisorId) {
            return toast.warning('Pilih guru Pembina.');
        }

        try {
            await api.post('/extracurriculars', {
                name: name.trim(),
                supervisor_id: Number(supervisorId)
            });

            toast.success('Ekskul berhasil ditambahkan.');
            setName('');
            setSupervisorId('');
            await loadExtracurriculars();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Gagal menambahkan ekskul.');
        }
    };

    
    const saveAttendance = async (e) => {
        e.preventDefault();

        if (!selected || !memberId) {
            return toast.warning('Pilih ekskul dan peserta terlebih dahulu.');
        }

        try {
            await api.post('/extracurriculars/attendance', {
                extracurricular_id: Number(selected),
                member_id: Number(memberId),
                attendance_date: date,
                status,
                notes: attendanceNotes
            });

            toast.success('Absensi berhasil disimpan.');
            setAttendanceNotes('');
            await loadAttendance();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Gagal menyimpan absensi.');
        }
    };

    const saveAttendanceBulk = async () => {
        if (!selected) {
            return toast.warning('Pilih ekskul terlebih dahulu.');
        }

        const studentsToSave = registeredStudents.filter(
            student => Number(student.is_registered) === 1
        );

        if (studentsToSave.length === 0) {
            return toast.warning('Belum ada siswa yang terdaftar pada ekskul ini.');
        }

        const records = studentsToSave.map(student => {
            const draft = attendanceDrafts[String(student.id)] || {};

            return {
                member_id: Number(student.id),
                status: draft.status || 'Hadir',
                notes: draft.notes || ''
            };
        });

        setSavingAttendance(true);

        try {
            const res = await api.post('/extracurriculars/attendance/bulk', {
                extracurricular_id: Number(selected),
                attendance_date: date,
                records
            });

            await loadAttendance();

            await toast.success(res.data?.message || 'Semua absensi berhasil disimpan.');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Gagal menyimpan absensi massal.');
        } finally {
            setSavingAttendance(false);
        }
    };


    const saveJournal = async (e) => {
        e.preventDefault();
        if (!selected || !topic.trim()) {
            return toast.warning('Pilih ekskul dan isi topik kegiatan.');
        }
        try {
            await api.post('/extracurriculars/journals', {
                extracurricular_id: Number(selected),
                activity_date: date,
                start_time: startTime || null,
                end_time: endTime || null,
                topic,
                activity_description: activityDescription,
                attendance_count: Number(attendanceCount) || 0,
                notes: journalNotes
            });
            toast.success('Jurnal kegiatan berhasil disimpan.');
            setTopic('');
            setStartTime('');
            setEndTime('');
            setActivityDescription('');
            setAttendanceCount('0');
            setJournalNotes('');
            await loadJournals();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Gagal menyimpan jurnal.');
        }
    };

    const tabs = [
        { id: 'ekskul', label: 'Data Ekskul', icon: Users },
        { id: 'absensi', label: 'Absensi', icon: ClipboardList },
        { id: 'jurnal', label: 'Jurnal Kegiatan', icon: BookOpen }
    ];

    return (
        <div className="mx-auto max-w-7xl space-y-6 pb-8">
            <div className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-[#0b1730] via-[#123b82] to-[#2563eb] p-6 text-white shadow-xl shadow-blue-950/10 sm:p-8"><div className="pointer-events-none absolute -right-10 -top-16 h-52 w-52 rounded-full bg-sky-300/20 blur-3xl" /><div className="relative flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
                        Monitoring Ekstrakurikuler
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Pantau data ekskul, rekap absensi peserta, dan riwayat jurnal tanpa mengubah data.
                    </p>
                </div>
                <button onClick={refresh} disabled={loading}
                    className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-xs font-bold text-white backdrop-blur transition hover:bg-white/20 disabled:opacity-50">
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    Muat Ulang
                </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className={cardClass}>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Total Ekskul</p>
                    <p className="text-3xl font-bold mt-2 text-blue-600">{items.length}</p>
                </div>
                <div className={cardClass}>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Catatan Absensi Bulan {month}</p>
                    <p className="text-3xl font-bold mt-2 text-emerald-600">{attendance.length}</p>
                </div>
                <div className={cardClass}>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Jurnal Kegiatan</p>
                    <p className="text-3xl font-bold mt-2 text-amber-600">{journals.length}</p>
                </div>
            </div>

            <div className="flex gap-2 overflow-x-auto">
                {tabs.map(({ id, label, icon: Icon }) => (
                    <button key={id} onClick={() => setTab(id)}
                        className={`flex items-center gap-2 rounded-xl px-4 py-3 text-xs font-bold whitespace-nowrap transition ${
                            tab === id
                                ? 'bg-gradient-to-r from-blue-950 to-blue-600 text-white shadow-md shadow-blue-900/15'
                                : 'bg-white text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                        }`}>
                        <Icon size={18} /> {label}
                    </button>
                ))}
            </div>

            {tab === 'ekskul' && (
                <div className={cardClass + ' mb-5'}>
                    <h2 className="font-bold text-slate-800 dark:text-white mb-4">
                        Tambah Ekskul
                    </h2>
                    <form onSubmit={addExtracurricular} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <label className="block text-sm text-slate-600 dark:text-slate-300">
                            Nama ekstrakurikuler
                            <input
                                type="text"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                maxLength={100}
                                required
                                placeholder="Contoh: Pramuka"
                                className={inputClass + ' mt-1'}
                            />
                        </label>
                        <label className="block text-sm text-slate-600 dark:text-slate-300">
                            Guru Pembina
                            <select
                                value={supervisorId}
                                onChange={e => setSupervisorId(e.target.value)}
                                required
                                className={inputClass + ' mt-1'}
                            >
                                <option value="">Pilih guru Pembina</option>
                                {supervisors.map(teacher => (
                                    <option key={teacher.id} value={teacher.id}>
                                        {teacher.full_name}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <div className="md:col-span-2 flex flex-wrap items-center gap-3">
                            <button
                                type="submit"
                                disabled={!supervisors.length}
                                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <Plus size={16} /> Tambah Ekskul
                            </button>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Jadwal latihan dan anggota dikelola Pembina melalui portal online.
                            </p>
                        </div>
                        {!supervisors.length && (
                            <p className="md:col-span-2 text-sm text-amber-600 dark:text-amber-400">
                                Belum ada data guru untuk dipilih sebagai Pembina.
                            </p>
                        )}
                    </form>
                </div>
            )}

            {tab === 'ekskul' && (
                <div className={cardClass}>
                    <h2 className="font-bold text-slate-800 dark:text-white mb-4">
                        Daftar Ekskul
                    </h2>
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[640px] text-sm text-left">
                            <thead className="bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300">
                                <tr>
                                    <th className="p-3">Nama</th>
                                    <th className="p-3">Pembina</th>
                                    <th className="p-3">Jadwal</th>
                                    <th className="p-3">Peserta Tercatat</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {items.map(item => (
                                    <tr key={item.id} className="transition hover:bg-blue-50/60 dark:hover:bg-slate-800/60">
                                        <td className="p-3 font-medium text-slate-800 dark:text-white">{item.name}</td>
                                        <td className="p-3 text-slate-600 dark:text-slate-300">{item.assigned_supervisor_name || item.supervisor_name || '-'}</td>
                                        <td className="p-3 text-slate-600 dark:text-slate-300">{item.schedule || '-'}</td>
                                        <td className="p-3 text-slate-600 dark:text-slate-300">{item.total_peserta ?? 0}</td>
                                    </tr>
                                ))}
                                {!items.length && (
                                    <tr><td colSpan="4" className="p-6 text-center text-slate-400">Belum ada data ekskul.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {tab === 'ekskul' && (
                <div className={cardClass}>
                    <h2 className="font-bold text-slate-800 dark:text-white mb-2">Anggota Ekskul</h2>
                    <label className="block text-sm text-slate-600 dark:text-slate-300 mb-4">
                        Pilih ekskul
                        <select value={selected} onChange={e => setSelected(e.target.value)} className={`${inputClass} mt-1`}>
                            <option value="">Pilih ekskul</option>
                            {items.map(item => (
                                <option key={item.id} value={item.id}>{item.name}</option>
                            ))}
                        </select>
                    </label>
                    <div className="divide-y divide-slate-100 dark:divide-slate-700">
                        {registeredStudents.map(student => (
                            <div key={student.id} className="flex items-center justify-between gap-3 p-3">
                                <span className="text-sm text-slate-800 dark:text-slate-200">
                                    {student.full_name}
                                    {student.identity_number ? ` (${student.identity_number})` : ''}
                                </span>
                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                    {Number(student.is_registered) === 1 ? 'Terdaftar' : 'Belum terdaftar'}
                                </span>
                            </div>
                        ))}
                        {!selected && <p className="p-4 text-sm text-slate-500">Pilih ekskul untuk melihat anggotanya.</p>}
                        {selected && !registeredStudents.length && <p className="p-4 text-sm text-slate-500">Belum ada data anggota.</p>}
                    </div>
                </div>
            )}

            {tab === 'absensi' && (
                <div className={`${cardClass} space-y-4`}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <label className="block text-sm text-slate-600 dark:text-slate-300">
                            Ekskul
                            <select value={selected} onChange={e => setSelected(e.target.value)} className={`${inputClass} mt-1`}>
                                <option value="">Pilih ekskul</option>
                                {items.map(item => (
                                    <option key={item.id} value={item.id}>{item.name}</option>
                                ))}
                            </select>
                        </label>
                        <label className="block text-sm text-slate-600 dark:text-slate-300">
                            Bulan Absensi
                            <input type="month" value={month}
                                onChange={e => setMonth(e.target.value)}
                                className={`${inputClass} mt-1`} />
                        </label>
                    </div>
                    <div>
                        <h2 className="font-bold text-slate-800 dark:text-white mb-4">Rekap Absensi</h2>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300">
                                    <tr>
                                        <th className="p-3">Peserta</th>
                                        <th className="p-3">Nomor Identitas</th>
                                        <th className="p-3">Status</th>
                                        <th className="p-3">Catatan</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                    {attendance.map(a => (
                                        <tr key={a.id}>
                                            <td className="p-3 text-slate-800 dark:text-white">{a.full_name}</td>
                                            <td className="p-3 text-slate-600 dark:text-slate-300">{a.identity_number || '-'}</td>
                                            <td className="p-3">{a.status}</td>
                                            <td className="p-3 text-slate-600 dark:text-slate-300">{a.notes || '-'}</td>
                                        </tr>
                                    ))}
                                    {!attendance.length && (
                                        <tr><td colSpan="4" className="p-6 text-center text-slate-400">Belum ada catatan absensi pada bulan ini.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {tab === 'jurnal' && (
                <div className="grid grid-cols-1 gap-6">

                    <div className={`${cardClass} space-y-5`}>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <h2 className="font-bold text-slate-800 dark:text-white">
                                    Riwayat Jurnal
                                </h2>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                    Filter jurnal berdasarkan bulan dan ekstrakurikuler.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={downloadMonthlyJournal}
                                className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
                            >
                                <Download size={16} />
                                Download Excel (.xlsx)
                            </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <label className="block text-sm text-slate-600 dark:text-slate-300">
                                Bulan Jurnal
                                <input
                                    type="month"
                                    value={journalMonth}
                                    onChange={e => setJournalMonth(e.target.value)}
                                    className={`${inputClass} mt-1`}
                                />
                            </label>

                            <label className="block text-sm text-slate-600 dark:text-slate-300">
                                Ekstrakurikuler
                                <select
                                    value={journalExtracurricular}
                                    onChange={e => setJournalExtracurricular(e.target.value)}
                                    className={`${inputClass} mt-1`}
                                >
                                    <option value="">Semua Ekstrakurikuler</option>
                                    {items.map(item => (
                                        <option key={item.id} value={item.id}>
                                            {item.name}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>

                        <div className="text-sm text-slate-500 dark:text-slate-400">
                            Ditemukan <strong>{filteredJournals.length}</strong> jurnal.
                        </div>

                        <div className="space-y-3">
                            {filteredJournals.map(j => (
                                <article
                                    key={j.id}
                                    className="border border-slate-100 rounded-xl p-4 dark:border-slate-700"
                                >
                                    <div className="flex flex-wrap justify-between gap-2">
                                        <h3 className="font-bold text-slate-800 dark:text-white">
                                            {j.topic}
                                        </h3>
                                        <span className="text-sm text-blue-600 dark:text-blue-400">
                                            {j.activity_date
                                                ? String(j.activity_date).slice(0, 10)
                                                : '-'}
                                        </span>
                                    </div>

                                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                        {j.extracurricular_name || '-'}
                                    </p>

                                    <p className="text-sm text-slate-700 dark:text-slate-300 mt-2 whitespace-pre-wrap">
                                        {j.activity_description || 'Tidak ada deskripsi.'}
                                    </p>

                                    <div className="flex flex-wrap gap-4 text-xs text-slate-500 dark:text-slate-400 mt-3">
                                        <span>
                                            <CalendarDays size={14} className="inline mr-1" />
                                            {j.start_time || '--:--'} – {j.end_time || '--:--'}
                                        </span>
                                        <span>
                                            <Users size={14} className="inline mr-1" />
                                            {j.attendance_count ?? 0} peserta
                                        </span>
                                    </div>

                                    {j.notes && (
                                        <p className="text-sm mt-2 text-slate-600 dark:text-slate-300">
                                            Catatan: {j.notes}
                                        </p>
                                    )}
                                </article>
                            ))}

                            {!filteredJournals.length && (
                                <p className="text-center text-slate-400 py-8">
                                    Tidak ada jurnal yang sesuai dengan filter.
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
