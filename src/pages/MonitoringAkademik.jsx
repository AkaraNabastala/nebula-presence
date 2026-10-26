import React, { useEffect, useState } from 'react';
import { Download, RefreshCw, ClipboardCheck, BookOpen, Users } from 'lucide-react';
import api from '../api/axios';
import { toast } from 'react-toastify';

const inputClass =
    'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-800 dark:bg-slate-700 dark:border-slate-600 dark:text-white';

const cardClass =
    'rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:bg-slate-800 dark:border-slate-700';

const currentMonth = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const csvEscape = value =>
    `"${String(value ?? '').replace(/"/g, '""')}"`;

export default function MonitoringAkademik() {
    const [tab, setTab] = useState('jurnal');
    const [month, setMonth] = useState(currentMonth());
    const [classId, setClassId] = useState('');
    const [subjectId, setSubjectId] = useState('');
    const [teacherId, setTeacherId] = useState('');
    const [classes, setClasses] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [journals, setJournals] = useState([]);
    const [attendance, setAttendance] = useState([]);
    const [loading, setLoading] = useState(false);

    const loadOptions = async () => {
        try {
            const [classRes, subjectRes, memberRes] = await Promise.all([
                api.get('/divisions'),
                api.get('/subjects'),
                api.get('/members')
            ]);

            const classData = classRes.data?.data || classRes.data || [];
            const subjectData = subjectRes.data?.data || subjectRes.data || [];
            const memberData = memberRes.data?.data || memberRes.data || [];

            setClasses(Array.isArray(classData) ? classData : []);
            setSubjects(Array.isArray(subjectData) ? subjectData : []);
            setTeachers(
                (Array.isArray(memberData) ? memberData : []).filter(
                    member => String(member.role || '').toLowerCase() === 'guru'
                )
            );
        } catch (err) {
            toast.error(err.response?.data?.message || 'Filter kelas, mapel, dan anggota gagal dimuat.');
        }
    };

    const loadReport = async () => {
        setLoading(true);
        try {
            const params = {
                month,
                class_id: classId || undefined,
                subject_id: subjectId || undefined,
                teacher_id: teacherId || undefined
            };

            const res = await api.get('/monitoring/academic', { params });
            const data = res.data?.data || {};

            setJournals(Array.isArray(data.journals) ? data.journals : []);
            setAttendance(Array.isArray(data.attendance) ? data.attendance : []);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Laporan akademik gagal dimuat.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadOptions();
    }, []);

    useEffect(() => {
        loadReport();
    }, [month, classId, subjectId, teacherId]);

    const exportCsv = async () => {
        const isJournal = tab === 'jurnal';
        const data = isJournal ? journals : attendance;

        if (!data.length) {
            return toast.info('Tidak ada data yang sesuai untuk diunduh.');
        }

        const XLSX = await import("xlsx-js-style");

        const headers = isJournal
            ? ['Tanggal', 'Kelas', 'Mata Pelajaran', 'Guru', 'Jurnal', 'Catatan']
            : ['Tanggal', 'Kelas', 'Mata Pelajaran', 'Guru', 'Siswa', 'Status', 'Catatan'];

        const rows = data.map(row => isJournal
            ? [
                row.activity_date || '',
                row.class_name || '',
                row.subject_name || '',
                row.teacher_name || '',
                row.journal || '',
                row.notes || ''
            ]
            : [
                row.attendance_date || '',
                row.class_name || '',
                row.subject_name || '',
                row.teacher_name || '',
                row.student_name || '',
                row.status || '',
                row.notes || ''
            ]
        );

        const wsData = [headers, ...rows];
        const ws = XLSX.utils.aoa_to_sheet(wsData);

        // Styling header
        const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const cellAddress = XLSX.utils.encode_cell({ r: 0, c: C });
            if (!ws[cellAddress]) continue;
            ws[cellAddress].s = {
                font: { bold: true, color: { rgb: "FFFFFF" } },
                fill: { fgColor: { rgb: "4F46E5" } },
                alignment: { horizontal: "center", vertical: "center" }
            };
        }

        ws['!cols'] = headers.map(() => ({ wch: 22 }));

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, isJournal ? 'Jurnal Guru' : 'Kehadiran Siswa');
        XLSX.writeFile(wb, `Monitoring-${isJournal ? 'Jurnal' : 'Kehadiran'}-${month}.xlsx`);
    };

    const data = tab === 'jurnal' ? journals : attendance;

    return (
        <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
            <div className={`${cardClass} flex flex-wrap items-center justify-between gap-4`}>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
                        Monitoring Akademik
                    </h1>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Rekap jurnal guru dan kehadiran siswa per kelas dan mata pelajaran.
                    </p>
                </div>
                <button
                    onClick={loadReport}
                    disabled={loading}
                    className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-white disabled:opacity-50"
                >
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    Muat Ulang
                </button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className={cardClass}>
                    <BookOpen className="mb-3 text-indigo-600" />
                    <p className="text-sm text-slate-500">Jurnal Guru</p>
                    <p className="mt-1 text-3xl font-bold">{journals.length}</p>
                </div>
                <div className={cardClass}>
                    <Users className="mb-3 text-emerald-600" />
                    <p className="text-sm text-slate-500">Catatan Kehadiran</p>
                    <p className="mt-1 text-3xl font-bold">{attendance.length}</p>
                </div>
                <div className={cardClass}>
                    <ClipboardCheck className="mb-3 text-amber-600" />
                    <p className="text-sm text-slate-500">Periode</p>
                    <p className="mt-1 text-xl font-bold">{month}</p>
                </div>
            </div>

            <div className={`${cardClass} grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4`}>
                <label className="text-sm text-slate-600 dark:text-slate-300">
                    Bulan
                    <input
                        type="month"
                        value={month}
                        onChange={e => setMonth(e.target.value)}
                        className={`${inputClass} mt-1`}
                    />
                </label>

                <label className="text-sm text-slate-600 dark:text-slate-300">
                    Kelas
                    <select value={classId} onChange={e => setClassId(e.target.value)} className={`${inputClass} mt-1`}>
                        <option value="">Semua kelas</option>
                        {classes.map(item => (
                            <option key={item.id} value={item.id}>
                                {item.name || item.class_name || item.division_name}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="text-sm text-slate-600 dark:text-slate-300">
                    Mata Pelajaran
                    <select value={subjectId} onChange={e => setSubjectId(e.target.value)} className={`${inputClass} mt-1`}>
                        <option value="">Semua mata pelajaran</option>
                        {subjects.map(item => (
                            <option key={item.id} value={item.id}>
                                {item.name || item.subject_name}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="text-sm text-slate-600 dark:text-slate-300">
                    Guru
                    <select value={teacherId} onChange={e => setTeacherId(e.target.value)} className={`${inputClass} mt-1`}>
                        <option value="">Semua guru</option>
                        {teachers.map(item => (
                            <option key={item.id} value={item.id}>
                                {item.full_name}
                            </option>
                        ))}
                    </select>
                </label>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex gap-2">
                    <button
                        onClick={() => setTab('jurnal')}
                        className={`rounded-xl px-4 py-2 font-semibold ${tab === 'jurnal' ? 'bg-indigo-600 text-white' : 'bg-white border dark:bg-slate-800 dark:border-slate-700'}`}
                    >
                        Jurnal Guru
                    </button>
                    <button
                        onClick={() => setTab('kehadiran')}
                        className={`rounded-xl px-4 py-2 font-semibold ${tab === 'kehadiran' ? 'bg-indigo-600 text-white' : 'bg-white border dark:bg-slate-800 dark:border-slate-700'}`}
                    >
                        Kehadiran Siswa
                    </button>
                </div>
                <button
                    onClick={exportCsv}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-white"
                >
                    <Download size={16} /> Download Excel (.xlsx)
                </button>
            </div>

            <div className={`${cardClass} overflow-x-auto`}>
                <p className="mb-4 text-sm text-slate-500">
                    {loading ? 'Memuat laporan...' : `${data.length} baris laporan`}
                </p>
                <table className="w-full min-w-[750px] text-left text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-900">
                        {tab === 'jurnal' ? (
                            <tr>
                                <th className="p-3">Tanggal</th>
                                <th className="p-3">Kelas</th>
                                <th className="p-3">Mapel</th>
                                <th className="p-3">Guru</th>
                                <th className="p-3">Jurnal</th>
                                <th className="p-3">Catatan</th>
                            </tr>
                        ) : (
                            <tr>
                                <th className="p-3">Tanggal</th>
                                <th className="p-3">Kelas</th>
                                <th className="p-3">Mapel</th>
                                <th className="p-3">Guru</th>
                                <th className="p-3">Siswa</th>
                                <th className="p-3">Status</th>
                                <th className="p-3">Catatan</th>
                            </tr>
                        )}
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {data.map((row, index) => (
                            <tr key={row.id ?? index}>
                                {tab === 'jurnal' ? (
                                    <>
                                        <td className="p-3">{row.activity_date || '-'}</td>
                                        <td className="p-3">{row.class_name || '-'}</td>
                                        <td className="p-3">{row.subject_name || '-'}</td>
                                        <td className="p-3">{row.teacher_name || '-'}</td>
                                        <td className="p-3">{row.journal || '-'}</td>
                                        <td className="p-3">{row.notes || '-'}</td>
                                    </>
                                ) : (
                                    <>
                                        <td className="p-3">{row.attendance_date || '-'}</td>
                                        <td className="p-3">{row.class_name || '-'}</td>
                                        <td className="p-3">{row.subject_name || '-'}</td>
                                        <td className="p-3">{row.teacher_name || '-'}</td>
                                        <td className="p-3">{row.student_name || '-'}</td>
                                        <td className="p-3">{row.status || '-'}</td>
                                        <td className="p-3">{row.notes || '-'}</td>
                                    </>
                                )}
                            </tr>
                        ))}
                        {!data.length && (
                            <tr>
                                <td colSpan={tab === 'jurnal' ? 6 : 7} className="p-8 text-center text-slate-400">
                                    Tidak ada data untuk filter ini.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
