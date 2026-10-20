import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { FileText, Calendar, Filter, ChevronDown, Printer, Search, Building2, Download, FileDown } from 'lucide-react';


// Import Logo Default
import logoDefault from '../assets/logo-nabastala.png';

const Laporan = () => {
    const [loading, setLoading] = useState(false);
    const [reportData, setReportData] = useState([]);
    const [classes, setClasses] = useState([]);
    const API_URL = "http://localhost:6990/api";

    // Filter Data
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedClass, setSelectedClass] = useState("");
    const [sortConfig, setSortConfig] = useState({ key: 'tanggal', direction: 'desc' });

    const [appConfig, setAppConfig] = useState({
        timezone: 'Asia/Jakarta',
        app_mode: 'edukasi',
        nama_instansi: 'Instansi',
        alamat_instansi: 'Alamat Belum Diatur',
        logo_instansi: '',
        labels: { label_pengguna: 'Siswa', label_kelompok: 'Kelas' },
    });

    const labelKelompok = (appConfig.labels?.label_kelompok && appConfig.labels?.label_kelompok !== 'Kelompok')
        ? appConfig.labels.label_kelompok
        : (appConfig.app_mode === 'korporat' ? 'Divisi' : 'Kelas');
    const labelPengguna = (appConfig.labels?.label_pengguna && appConfig.labels?.label_pengguna !== 'Pengguna')
        ? appConfig.labels.label_pengguna
        : (appConfig.app_mode === 'korporat' ? 'Karyawan' : 'Siswa');

    useEffect(() => {
        const init = async () => {
            try {
                // Load Settings
                const resSet = await api.get('/settings');
                const tz = resSet.data.timezone || 'Asia/Jakarta';
                const isEdu = (resSet.data.app_mode || 'edukasi') === 'edukasi';
                setAppConfig({
                    timezone: tz,
                    app_mode: resSet.data.app_mode || 'edukasi',
                    nama_instansi: resSet.data.nama_sekolah || resSet.data.nama_instansi || 'Instansi',
                    alamat_instansi: resSet.data.alamat_sekolah || resSet.data.alamat_instansi || 'Alamat Instansi',
                    logo_instansi: resSet.data.logo_sekolah || resSet.data.logo_instansi || '',
                    labels: resSet.data.labels || {
                        label_pengguna: isEdu ? 'Siswa' : 'Karyawan',
                        label_kelompok: isEdu ? 'Kelas' : 'Divisi'
                    },
                });

                // Set Default Date
                const today = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
                setStartDate(today);
                setEndDate(today);

                // Load Classes
                const resCls = await api.get('/divisions');
                setClasses(resCls.data?.data || (Array.isArray(resCls.data) ? resCls.data : []));

                // Fetch Laporan Default (Hari ini, Semua Kelas)
                setLoading(true);
                try {
                    const res = await api.get(`/attendance/report`, {
                        params: { start_date: today, end_date: today, kelas: "" }
                    });
                    setReportData(Array.isArray(res.data) ? res.data : []);
                } catch (err) {
                    console.error("Gagal tarik laporan default");
                    setReportData([]);
                } finally {
                    setLoading(false);
                }
            } catch (e) {
                console.error("Gagal inisialisasi laporan", e);
            }
        };
        init();
    }, []);

    const handleFilter = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/attendance/report`, {
                params: { start_date: startDate, end_date: endDate, kelas: selectedClass }
            });
            setReportData(Array.isArray(res.data) ? res.data : []);
        } catch {
            console.error("Gagal tarik laporan");
            setReportData([]);
        }
        finally { setLoading(false); }
    };

    // 2. Perbaiki fungsi format jam agar lebih rapi (Surgical Fix)
    const formatTime = (t) => {
        if (!t) return '-';
        // Jika formatnya ISO String (ada huruf T atau -), potong ke jam lokal
        if (t.includes('T') || t.includes('-')) {
            return new Date(t).toLocaleTimeString('id-ID', {
                hour: '2-digit', minute: '2-digit', hour12: false
            }).replace('.', ':');
        }
        return t.slice(0, 5); // Ambil 5 karakter awal saja (00:00)
    };

    // Helper untuk Tanggal Indonesia di Surat
    const getIndonesianDate = () => {
        const date = new Date();
        return date.toLocaleDateString('id-ID', {
            timeZone: appConfig.timezone,
            day: 'numeric', month: 'long', year: 'numeric'
        });
    };

    const handleExportExcel = async () => {
        if (reportData.length === 0) {
            showToast('error', "Tidak ada data untuk diexport!");
            return;
        }

        try {
            const res = await api.get(`/attendance/report`, {
                params: { start_date: startDate, end_date: endDate, kelas: selectedClass }
            });

            const fullMonthData = res.data || [];

            if (fullMonthData.length === 0) {
                showToast('error', "Tidak ada data pada periode ini!");
                return;
            }

            const XLSX = await import("xlsx-js-style");

            const formatTgl = (tgl) => {
                if (!tgl) return '-';
                return new Date(tgl).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
            };

            const excelData = [
                [appConfig.nama_instansi ? appConfig.nama_instansi.toUpperCase() : "INSTANSI"],
                ["LAPORAN REKAP ABSENSI BULANAN"],
                [`Periode: ${formatTgl(startDate)} - ${formatTgl(endDate)}`],
                [`${labelKelompok}: ${selectedClass || 'SEMUA'}`],
                [],
                ["NO", "ID", "NAMA LENGKAP", "MASUK", "PULANG", "STATUS"]
            ];

            const sortedData = [...fullMonthData].sort((a, b) => {
                const dateA = new Date(a.tanggal || 0);
                const dateB = new Date(b.tanggal || 0);
                if (dateA - dateB !== 0) return dateA - dateB;
                return (a.nama_lengkap || '').localeCompare(b.nama_lengkap || '');
            });

            sortedData.forEach((row, idx) => {
                excelData.push([
                    idx + 1,
                    row.id_anggota || row.identity_number || row.nipd || row.nisn || '-',
                    row.nama_lengkap || '-',
                    formatTime(row.scan_in),
                    formatTime(row.scan_out),
                    row.status || 'BELUM ABSEN'
                ]);
            });

            const ws = XLSX.utils.aoa_to_sheet(excelData);
            const wb = XLSX.utils.book_new();

            ws['!cols'] = [
                { wch: 5 }, { wch: 15 }, { wch: 35 }, { wch: 15 }, { wch: 15 }, { wch: 15 }
            ];

            ws['!merges'] = [
                { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
                { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } },
                { s: { r: 2, c: 0 }, e: { r: 2, c: 5 } },
                { s: { r: 3, c: 0 }, e: { r: 3, c: 5 } }
            ];

            for (let r = 0; r < excelData.length; r++) {
                for (let c = 0; c < 6; c++) {
                    const cellRef = XLSX.utils.encode_cell({ c, r });
                    if (!ws[cellRef]) continue;

                    if (!ws[cellRef].s) ws[cellRef].s = {};

                    if (r >= 5) {
                        ws[cellRef].s.border = {
                            top: { style: "thin" }, bottom: { style: "thin" },
                            left: { style: "thin" }, right: { style: "thin" }
                        };
                        if (r === 5) {
                            ws[cellRef].s.font = { bold: true, color: { rgb: "FFFFFF" } };
                            ws[cellRef].s.fill = { fgColor: { rgb: "1E293B" } };
                            ws[cellRef].s.alignment = { horizontal: "center", vertical: "center" };
                        }
                    } else if (r <= 3) {
                        ws[cellRef].s.font = { bold: true, sz: r === 0 ? 14 : 12 };
                        ws[cellRef].s.alignment = { horizontal: "center" };
                    }
                }
            }

            XLSX.utils.book_append_sheet(wb, ws, "Rekap_Kehadiran");
            XLSX.writeFile(wb, `Rekap_Absensi_${startDate}_to_${endDate}.xlsx`);
            showToast('success', "Data kehadiran berhasil diexport!");
        } catch (error) {
            console.error("Export error:", error);
            showToast('error', "Terjadi kesalahan saat export data");
        }
    };

    return (
        <div className="space-y-6 pb-24 md:pb-10 font-sans">

            {/* =================================================================================
          1. SCREEN VIEW (TAMPILAN LAYAR - MODERN & RESPONSIVE)
          Akan disembunyikan saat print menggunakan class 'print:hidden'
      ================================================================================= */}
            <div className="print:hidden space-y-6">

                {/* HEADER CARD */}
                <div className="relative bg-white dark:bg-slate-800 p-6 rounded-[2rem] shadow-sm border border-gray-100 dark:border-slate-700 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50/50 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-50/50 rounded-full blur-2xl -ml-10 -mb-10 pointer-events-none"></div>

                    <div className="relative z-10">
                        <h2 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
                            <FileText className="text-emerald-500" size={32} /> Laporan Harian
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Rekapitulasi data masuk & pulang pengguna.</p>
                    </div>

                    <div className="relative z-10 w-full md:w-auto flex gap-2">
                        <button onClick={handleExportExcel} className="w-full md:w-auto flex justify-center items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 active:scale-95">
                            <FileDown size={18} /> <span>Export Excel</span>
                        </button>
                    </div>
                </div>

                {/* FILTER SECTION */}
                <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 flex flex-col md:flex-row gap-4 items-end">
                    <div className="w-full md:flex-1 grid grid-cols-2 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="laporan-start-date" className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase ml-1 mb-1.5 block flex items-center gap-1">
                                <Calendar size={12} /> Dari Tanggal
                            </label>
                            <input id="laporan-start-date" name="laporan_start_date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 dark:border-slate-600 rounded-xl outline-none focus:border-blue-500 text-sm font-bold bg-gray-50 dark:bg-slate-700 focus:bg-white dark:focus:bg-slate-800 transition-all cursor-pointer text-slate-800 dark:text-slate-200" />
                        </div>
                        <div>
                            <label htmlFor="laporan-end-date" className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase ml-1 mb-1.5 block flex items-center gap-1">
                                <Calendar size={12} /> Sampai Tanggal
                            </label>
                            <input id="laporan-end-date" name="laporan_end_date" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 dark:border-slate-600 rounded-xl outline-none focus:border-blue-500 text-sm font-bold bg-gray-50 dark:bg-slate-700 focus:bg-white dark:focus:bg-slate-800 transition-all cursor-pointer text-slate-800 dark:text-slate-200" />
                        </div>
                    </div>
                    <div className="w-full md:w-64">
                        <label htmlFor="laporan-class-select" className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase ml-1 mb-1.5 block flex items-center gap-1">
                            <Building2 size={12} /> {labelKelompok}
                        </label>
                        <div className="relative">
                            <select id="laporan-class-select" name="laporan_class" value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 dark:border-slate-600 rounded-xl outline-none focus:border-blue-500 text-sm font-bold bg-white dark:bg-slate-700 appearance-none cursor-pointer hover:border-blue-300 dark:hover:border-blue-500 transition-all text-slate-800 dark:text-slate-200">
                                <option value="">Semua {labelKelompok}</option>
                                {classes.map(c => <option key={c.id} value={c.nama_kelas}>{c.nama_kelas}</option>)}
                            </select>
                            <ChevronDown className="absolute right-3 top-3 text-gray-400 pointer-events-none" size={16} />
                        </div>
                    </div>
                    <button onClick={handleFilter} className="w-full md:w-auto px-8 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 shadow-md shadow-blue-200 transition-all active:scale-95 flex justify-center items-center gap-2">
                        <Filter size={16} /> Tampilkan
                    </button>
                </div>

                {/* TABLE PREVIEW (SCREEN) */}
                <div className="bg-white dark:bg-slate-800 rounded-[2rem] shadow-sm border border-gray-100 dark:border-slate-700 overflow-auto min-h-[400px] h-[600px] max-h-[70vh]">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left whitespace-nowrap text-sm relative">
                            <thead className="bg-slate-50/80 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 font-extrabold text-[11px] uppercase tracking-widest border-b border-slate-100 dark:border-slate-700 sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="p-5 text-center w-16">No</th>
                                    <th className="p-5 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors" onClick={() => {
                                        setSortConfig({ key: 'tanggal', direction: sortConfig.key === 'tanggal' && sortConfig.direction === 'asc' ? 'desc' : 'asc' });
                                    }}>
                                        Tanggal {sortConfig.key === 'tanggal' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                                    </th>
                                    <th className="p-5 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors" onClick={() => {
                                        setSortConfig({ key: 'nama_lengkap', direction: sortConfig.key === 'nama_lengkap' && sortConfig.direction === 'asc' ? 'desc' : 'asc' });
                                    }}>
                                        Nama {labelPengguna} {sortConfig.key === 'nama_lengkap' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                                    </th>
                                    <th className="p-5">{labelKelompok}</th>
                                    <th className="p-5 text-center">Masuk</th>
                                    <th className="p-5 text-center">Pulang</th>
                                    <th className="p-5 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-slate-700/50">
                                {loading ? (
                                    <tr><td colSpan="7" className="p-10 text-center text-gray-400">Memuat data...</td></tr>
                                ) : reportData.length === 0 ? (
                                    <tr><td colSpan="7" className="p-16 text-center text-gray-400">Tidak ada data ditemukan</td></tr>
                                ) : (
                                    [...reportData].sort((a, b) => {
                                        if (sortConfig.key === 'nama_lengkap') {
                                            const valA = a.nama_lengkap || "";
                                            const valB = b.nama_lengkap || "";
                                            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
                                            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
                                            return 0;
                                        } else {
                                            const dateA = new Date(a.tanggal || 0);
                                            const dateB = new Date(b.tanggal || 0);
                                            return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
                                        }
                                    }).map((row, idx) => (
                                        <tr key={idx} className="hover:bg-blue-50/30 dark:hover:bg-slate-700/50 transition-colors">
                                            <td className="px-6 py-4 text-center text-gray-400 font-mono text-xs">{idx + 1}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-gray-600 dark:text-slate-300">
                                                {row.tanggal ? new Date(row.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}
                                            </td>
                                            <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200">{row.nama_lengkap}</td>
                                            <td className="px-6 py-4 text-gray-500 text-xs font-mono">{row.kelas || '-'}</td>
                                            <td className="px-6 py-4 text-center"><span className="px-3 py-1 bg-slate-100 dark:bg-slate-700 rounded-md font-mono text-xs font-bold text-slate-600 dark:text-slate-300">{formatTime(row.scan_in)}</span></td>
                                            <td className="px-6 py-4 text-center"><span className="px-3 py-1 bg-slate-100 dark:bg-slate-700 rounded-md font-mono text-xs font-bold text-slate-600 dark:text-slate-300">{formatTime(row.scan_out)}</span></td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`px-3 py-1 text-[10px] font-bold rounded-md border ${row.status === 'HADIR' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' :
                                                    row.status === 'TERLAMBAT' ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800' :
                                                        row.status === 'IZIN' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800' :
                                                            row.status === 'SAKIT' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800' :
                                                                row.status === 'ALFA' ? 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800' :
                                                                    'bg-gray-50 dark:bg-slate-700 text-gray-500 dark:text-slate-300 border-gray-200 dark:border-slate-600'
                                                    }`}>
                                                    {row.status || 'BELUM ABSEN'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>


        </div>
    );
};

export default Laporan;