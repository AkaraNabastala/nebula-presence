import React, { useEffect, useState } from 'react';
import { Download, RefreshCw, ClipboardCheck, BookOpen, Users } from 'lucide-react';
import api from '../api/axios';
import { toast } from 'react-toastify';

const inputClass =
    'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-800 dark:bg-slate-700 dark:border-slate-600 dark:text-white';

const cardClass =
    'rounded-2xl border border-sky-100 bg-white p-5 shadow-sm dark:bg-slate-900 dark:border-slate-800';

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
        <div className="mx-auto max-w-7xl space-y-6 pb-8">
            <section className="relative isolate overflow-hidden rounded-[2rem] border border-sky-200/80 bg-gradient-to-br from-sky-50 via-white to-orange-50 p-5 shadow-[0_18px_55px_rgba(28,100,160,0.09)] dark:border-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-blue-950/50 sm:p-7">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-300 via-blue-600 to-orange-400" />
                <div className="pointer-events-none absolute -right-8 -top-10 h-44 w-44 rounded-full bg-sky-300/30 blur-3xl dark:bg-blue-500/15" />
                <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-4">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-950 via-blue-700 to-sky-400 text-white shadow-lg"><ClipboardCheck size={22} /></span>
                        <div>
                            <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-blue-800 dark:text-sky-300">RINGKASAN PEMBELAJARAN</span>
                            <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-950 dark:text-white sm:text-3xl">Monitoring Akademik</h1>
                            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">Telusuri jurnal guru dan kehadiran siswa menggunakan filter periode, kelas, mapel, dan pengajar.</p>
                        </div>
                    </div>
                    <button type="button" onClick={loadReport} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-sky-200 bg-white/90 px-4 py-3 text-xs font-bold text-blue-900 shadow-sm transition hover:bg-sky-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-sky-300 dark:hover:bg-slate-700">
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Perbarui Data
                    </button>
                </div>
            </section>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className={cardClass}>
                    <BookOpen className="mb-3 text-blue-600" />
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
                        className={`rounded-xl px-4 py-2 font-semibold ${tab === 'jurnal' ? 'bg-blue-600 text-white' : 'bg-white border dark:bg-slate-800 dark:border-slate-700'}`}
                    >
                        Jurnal Guru
                    </button>
                    <button
                        onClick={() => setTab('kehadiran')}
                        className={`rounded-xl px-4 py-2 font-semibold ${tab === 'kehadiran' ? 'bg-blue-600 text-white' : 'bg-white border dark:bg-slate-800 dark:border-slate-700'}`}
                    >
                        Kehadiran Siswa
                    </button>
                </div>
                <button
                    onClick={exportCsv}
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2 text-white"
                >
                    <Download size={16} /> Download Excel (.xlsx)
                </button>
            </div>

            <div className={`${cardClass} overflow-x-auto`}>
                <p className="mb-4 text-sm text-slate-500">
                    {loading ? 'Memuat laporan...' : `${data.length} baris laporan`}
                </p>
                <div className="hidden overflow-x-auto lg:block"><table className="w-full min-w-[750px] text-left text-sm">
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
                </table></div>
                <div className="grid gap-3 lg:hidden">
                    {data.map((row, index) => (
                        <article key={row.id ?? index} className="rounded-2xl border border-sky-100 bg-gradient-to-br from-white to-sky-50/60 p-4 dark:border-slate-800 dark:from-slate-900 dark:to-slate-950">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="break-words font-bold text-slate-900 dark:text-white">{tab === 'jurnal' ? (row.journal || 'Jurnal pembelajaran') : (row.student_name || 'Data kehadiran')}</p>
                                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{tab === 'jurnal' ? (row.activity_date || '-') : (row.attendance_date || '-')}</p>
                                </div>
                                {tab === 'kehadiran' && <span className="shrink-0 rounded-full bg-sky-100 px-2.5 py-1 text-[10px] font-bold text-blue-800 dark:bg-blue-950 dark:text-sky-300">{row.status || '—'}</span>}
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-3 border-t border-sky-100 pt-3 text-xs dark:border-slate-800">
                                <div><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Kelas</p><p className="mt-1 font-semibold text-slate-800 dark:text-slate-200">{row.class_name || '-'}</p></div>
                                <div><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Mata pelajaran</p><p className="mt-1 font-semibold text-slate-800 dark:text-slate-200">{row.subject_name || '-'}</p></div>
                                <div className="col-span-2"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Guru</p><p className="mt-1 font-semibold text-slate-800 dark:text-slate-200">{row.teacher_name || '-'}</p></div>
                                {tab === 'jurnal' && <div className="col-span-2"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Catatan</p><p className="mt-1 whitespace-pre-wrap text-slate-600 dark:text-slate-300">{row.notes || 'Tidak ada catatan.'}</p></div>}
                                {tab === 'kehadiran' && <div className="col-span-2"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Catatan</p><p className="mt-1 text-slate-600 dark:text-slate-300">{row.notes || 'Tidak ada catatan.'}</p></div>}
                            </div>
                        </article>
                    ))}
                    {!data.length && <div className="rounded-2xl border border-dashed border-sky-200 p-8 text-center text-sm text-slate-500 dark:border-slate-700">Tidak ada data untuk filter ini.</div>}
                </div>
            </div>
        </div>
    );
}
