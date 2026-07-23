import React, { useState, useEffect } from 'react';
import {
    FileText, Calendar, Filter, FileDown, RefreshCcw, Info, CheckCircle, AlertCircle, X, Search, Briefcase
} from 'lucide-react';
import api from '../../api/axios';
import * as XLSX from 'xlsx-js-style';
import logoNabastala from '../../assets/logo-nabastala.png';

const LaporanBulanan = () => {
    // --- STATE ---
    const [divisionsList, setDivisionsList] = useState([]);
    const [loading, setLoading] = useState(false);

    // Filter State
    const [selectedDivision, setSelectedDivision] = useState(null);
    const [filterBulan, setFilterBulan] = useState(new Date().getMonth() + 1);
    const [filterTahun, setFilterTahun] = useState(new Date().getFullYear());
    const [selectedShift, setSelectedShift] = useState("Semua Shift");

    // Report Data
    const [loadingReport, setLoadingReport] = useState(false);
    const [reportData, setReportData] = useState([]);
    const [sortConfig, setSortConfig] = useState({ key: 'nama_lengkap', direction: 'asc' });

    const [notification, setNotification] = useState({ show: false, type: '', message: '' });

    // Config
    const [appConfig, setAppConfig] = useState({
        nama_instansi: 'INSTANSI',
        labels: { label_pengguna: 'Pengguna', label_kelompok: 'Kelompok' },
        logo: logoNabastala
    });

    // --- INIT ---
    useEffect(() => {
        fetchConfig();
        fetchDivisions();
    }, []);

    const showToast = (type, message) => {
        setNotification({ show: true, type, message });
        setTimeout(() => setNotification({ show: false, type: '', message: '' }), 3000);
    };

    const fetchConfig = async () => {
        try {
            const res = await api.get('/settings');
            if (res.data) setAppConfig({
                nama_instansi: res.data.nama_sekolah || res.data.nama_instansi || 'INSTANSI',
                app_mode: res.data.app_mode || 'korporat',
                company_shifts: res.data.company_shifts || '[]',
                labels: res.data.labels || { label_pengguna: 'Pengguna', label_kelompok: 'Kelompok' },
                logo: res.data.logo_sekolah || res.data.logo_instansi || logoNabastala
            });
        } catch { /* ignore */ }
    };

    const fetchDivisions = async () => {
        try {
            const response = await api.get('/divisions');
            setDivisionsList(response.data);
            if (response.data.length > 0) {
                setSelectedDivision(response.data[0]); // Auto select first division
            }
        } catch {
            // ignore
        }
    };

    const fetchDivisionReport = async () => {
        if (!selectedDivision) return;
        setLoadingReport(true);
        try {
            const lastDay = new Date(filterTahun, filterBulan, 0).getDate();
            const startDate = `${filterTahun}-${String(filterBulan).padStart(2, '0')}-01`;
            const endDate = `${filterTahun}-${String(filterBulan).padStart(2, '0')}-${lastDay}`;

            const [resReport, resMembers] = await Promise.all([
                api.get('/attendance/report', {
                    params: { kelas: selectedDivision.nama_kelas, start_date: startDate, end_date: endDate, shift: selectedShift }
                }),
                api.get('/members')
            ]);

            const rawLogs = Array.isArray(resReport.data) ? resReport.data : [];
            const allMembers = Array.isArray(resMembers.data) ? resMembers.data.filter(s => s.kelas === selectedDivision.nama_kelas) : [];

            const processedData = allMembers.map(member => {
                const attendanceMap = {};
                const stats = { H: 0, T: 0, S: 0, I: 0, A: 0 };

                const memberLogs = rawLogs.filter(log => log.id_anggota === member.nipd || log.id_anggota === member.nisn || log.nama_lengkap === member.nama_lengkap);

                let mostCommonShift = '-';
                if (memberLogs.length > 0) {
                    const shiftCounts = {};
                    memberLogs.forEach(l => {
                        if (l.shift_name) shiftCounts[l.shift_name] = (shiftCounts[l.shift_name] || 0) + 1;
                    });
                    const sortedShifts = Object.entries(shiftCounts).sort((a, b) => b[1] - a[1]);
                    if (sortedShifts.length > 0) mostCommonShift = sortedShifts[0][0];
                }

                memberLogs.forEach(log => {
                    if (!log.tanggal) return;
                    const day = parseInt(log.tanggal.split('-')[2], 10);
                    const isLupaMasuk = !log.scan_in;
                    attendanceMap[day] = { status: log.status, isLupaMasuk };

                    if (log.status === 'HADIR' || log.status === 'LEMBUR' || log.status === 'PULANG' || log.status === 'PULANG AWAL') stats.H++;
                    else if (log.status === 'TERLAMBAT') stats.T++;
                    else if (log.status === 'SAKIT') stats.S++;
                    else if (log.status === 'IZIN') stats.I++;
                    else if (log.status === 'ALFA') stats.A++;
                });

                return {
                    ...member,
                    attendance: attendanceMap,
                    stats: stats,
                    mostCommonShift
                };
            });

            setReportData(processedData);
        } catch (error) {
            showToast('error', "Gagal memuat data laporan.");
        } finally {
            setLoadingReport(false);
        }
    };

    useEffect(() => {
        if (selectedDivision) {
            fetchDivisionReport();
        }
    }, [selectedDivision, filterBulan, filterTahun, selectedShift]);

    // --- SORTING ---
    const sortedReportData = [...reportData].sort((a, b) => {
        let valA = a[sortConfig.key] || "";
        let valB = b[sortConfig.key] || "";
        if (sortConfig.key === 'id') {
            valA = a.nisn || a.nipd || "";
            valB = b.nisn || b.nipd || "";
        }
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
        setSortConfig({ key, direction });
    };

    // --- EXPORT ---
    const handleDownloadReport = () => {
        if (!selectedDivision || reportData.length === 0) {
            showToast('error', "Tidak ada data untuk diexport.");
            return;
        }
        const daysInMonth = new Date(filterTahun, filterBulan, 0).getDate();
        const namaBulan = new Date(filterTahun, filterBulan - 1).toLocaleString('id-ID', { month: 'long' });

        const dateHeaders = [];
        for (let i = 1; i <= daysInMonth; i++) dateHeaders.push(i);

        const parsedShifts = JSON.parse(appConfig.company_shifts || "[]");
        const showShiftFilter = appConfig.app_mode === 'korporat' && parsedShifts.length > 1;
        const isSpecificShift = selectedShift !== 'Semua Shift';

        const dataRows = sortedReportData.map((m, index) => {
            const row = [index + 1, m.nipd || m.nisn || "-"];
            if (showShiftFilter && !isSpecificShift) row.push(m.mostCommonShift || "-");
            row.push(m.nama_lengkap || m.full_name);

            for (let i = 1; i <= daysInMonth; i++) {
                const sObj = m.attendance[i] || "";
                const status = typeof sObj === 'object' ? sObj?.status : sObj;
                let code = "";
                if (status === 'HADIR' || status === 'LEMBUR' || status === 'PULANG' || status === 'PULANG AWAL') code = "H";
                else if (status === 'TERLAMBAT') code = "T";
                else if (status === 'SAKIT') code = "S";
                else if (status === 'IZIN') code = "I";
                else if (status === 'ALFA') code = "A";
                row.push(code);
            }
            row.push(m.stats?.H || 0, m.stats?.T || 0, m.stats?.S || 0, m.stats?.I || 0, m.stats?.A || 0);
            return row;
        });

        const headerRow = ["NO", "ID"];
        if (showShiftFilter && !isSpecificShift) headerRow.push("SHIFT");
        headerRow.push("NAMA LENGKAP", ...dateHeaders, "H", "T", "S", "I", "A");

        const excelData = [
            [appConfig.nama_instansi.toUpperCase()],
            [`LAPORAN ABSENSI BULAN ${namaBulan.toUpperCase()} ${filterTahun}`],
            [`${(appConfig.labels?.label_kelompok || 'KELOMPOK').toUpperCase()}: ${appConfig.app_mode === 'korporat' ? 'Karyawan' : selectedDivision.nama_kelas}${isSpecificShift ? ` (${selectedShift})` : ''}`],
            [],
            headerRow,
            ...dataRows
        ];

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(excelData);

        const wscols = [{ wch: 5 }, { wch: 15 }];
        if (showShiftFilter && !isSpecificShift) wscols.push({ wch: 12 });
        wscols.push({ wch: 30 });
        for (let i = 0; i < daysInMonth; i++) wscols.push({ wch: 3 });
        for (let i = 0; i < 5; i++) wscols.push({ wch: 4 });
        ws['!cols'] = wscols;

        const totalColsToMerge = wscols.length - 1;
        ws['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: totalColsToMerge } },
            { s: { r: 1, c: 0 }, e: { r: 1, c: totalColsToMerge } },
            { s: { r: 2, c: 0 }, e: { r: 2, c: totalColsToMerge } },
        ];

        const totalCols = wscols.length;
        const totalRows = excelData.length;
        for (let r = 0; r < totalRows; r++) {
            for (let c = 0; c < totalCols; c++) {
                const cellRef = XLSX.utils.encode_cell({ c: c, r: r });
                if (!ws[cellRef]) continue;
                const cell = ws[cellRef];
                if (!cell.s) cell.s = {};

                if (r >= 4) {
                    cell.s.border = {
                        top: { style: "thin", color: { auto: 1 } }, bottom: { style: "thin", color: { auto: 1 } },
                        left: { style: "thin", color: { auto: 1 } }, right: { style: "thin", color: { auto: 1 } }
                    };
                    if (c === (showShiftFilter && !isSpecificShift ? 3 : 2)) cell.s.alignment = { horizontal: "left", vertical: "center" };
                    else cell.s.alignment = { horizontal: "center", vertical: "center" };
                } else {
                    cell.s.alignment = { horizontal: "center", vertical: "center" };
                }

                if (r === 4) {
                    cell.s.font = { bold: true, color: { rgb: "FFFFFF" } };
                    cell.s.fill = { fgColor: { rgb: "1E293B" } };
                }

                if (r >= 0 && r <= 2) cell.s.font = { bold: true, sz: (r === 0 ? 14 : 12) };

                const statusStartCol = showShiftFilter && !isSpecificShift ? 4 : 3;
                if (r > 4 && c >= statusStartCol && c < statusStartCol + daysInMonth) {
                    if (cell.v === 'H') { cell.s.font = { bold: true, color: { rgb: "FFFFFF" } }; cell.s.fill = { fgColor: { rgb: "10B981" } }; }
                    else if (cell.v === 'T') { cell.s.font = { bold: true, color: { rgb: "FFFFFF" } }; cell.s.fill = { fgColor: { rgb: "F59E0B" } }; }
                    else if (cell.v === 'S') { cell.s.font = { bold: true, color: { rgb: "FFFFFF" } }; cell.s.fill = { fgColor: { rgb: "3B82F6" } }; }
                    else if (cell.v === 'I') { cell.s.font = { bold: true, color: { rgb: "FFFFFF" } }; cell.s.fill = { fgColor: { rgb: "6366F1" } }; }
                    else if (cell.v === 'A') { cell.s.font = { bold: true, color: { rgb: "FFFFFF" } }; cell.s.fill = { fgColor: { rgb: "EF4444" } }; }
                }
            }
        }
        const shiftSuffix = isSpecificShift ? `_${selectedShift.replace(/\s+/g, '_')}` : '';
        XLSX.utils.book_append_sheet(wb, ws, "Laporan Absensi");
        XLSX.writeFile(wb, `Laporan_Bulanan_${selectedDivision.nama_kelas}_${namaBulan}_${filterTahun}${shiftSuffix}.xlsx`);
        showToast('success', "Laporan berhasil didownload!");
    };

    return (
        <div className="space-y-6 pb-20 md:pb-0 relative h-full font-sans flex flex-col">
            {notification.show && (
                <div className={`fixed top-4 right-4 z-[99] flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl animate-in slide-in-from-right fade-in duration-300 border bg-white dark:bg-slate-800 ${notification.type === 'success' ? 'border-green-200 dark:border-green-800 text-green-700 dark:text-green-400' : 'border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'}`}>
                    {notification.type === 'success' ? <CheckCircle size={22} className="text-green-500" /> : <AlertCircle size={22} className="text-red-500" />}
                    <div><h4 className="font-bold text-sm">{notification.type === 'success' ? 'Berhasil' : 'Gagal'}</h4><p className="text-xs text-gray-500 dark:text-gray-400">{notification.message}</p></div>
                    <button onClick={() => setNotification({ show: false })}><X size={18} className="text-gray-400" /></button>
                </div>
            )}

            {/* HEADER TOOLBAR */}
            <div className="relative bg-white dark:bg-slate-800 p-6 rounded-[2rem] shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden shrink-0">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50/50 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>

                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h2 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
                            <FileText className="text-emerald-500" size={32} /> Laporan Bulanan
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Rekapitulasi absensi per bulan berdasarkan {appConfig.labels?.label_kelompok || 'kelompok'}.</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 shadow-sm w-full md:w-auto">
                            <Briefcase size={16} className="text-gray-400 shrink-0" />
                            <select
                                id="report-division-select"
                                name="report_division"
                                value={selectedDivision?.id || ''}
                                onChange={(e) => {
                                    const div = divisionsList.find(d => d.id === parseInt(e.target.value));
                                    setSelectedDivision(div);
                                }}
                                className="bg-transparent border-none outline-none text-sm font-bold text-gray-700 dark:text-slate-200 cursor-pointer w-full"
                            >
                                {divisionsList.map(div => (
                                    <option key={div.id} value={div.id}>{div.nama_kelas}</option>
                                ))}
                                {divisionsList.length === 0 && <option value="">Tidak ada {appConfig.labels?.label_kelompok || 'kelompok'}</option>}
                            </select>
                        </div>

                        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 shadow-sm">
                            <Calendar size={16} className="text-gray-400 shrink-0" />
                            <select
                                id="report-month-select"
                                name="report_month"
                                value={filterBulan}
                                onChange={(e) => setFilterBulan(parseInt(e.target.value))}
                                className="bg-transparent border-none outline-none text-sm font-bold text-gray-700 dark:text-slate-200 cursor-pointer"
                            >
                                {Array.from({ length: 12 }, (_, i) => (
                                    <option key={i + 1} value={i + 1}>{new Date(0, i).toLocaleString('id-ID', { month: 'long' })}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 shadow-sm">
                            <select
                                id="report-year-select"
                                name="report_year"
                                value={filterTahun}
                                onChange={(e) => setFilterTahun(parseInt(e.target.value))}
                                className="bg-transparent border-none outline-none text-sm font-bold text-gray-700 dark:text-slate-200 cursor-pointer"
                            >
                                {[...Array(5)].map((_, i) => {
                                    const year = new Date().getFullYear() - 2 + i;
                                    return <option key={year} value={year}>{year}</option>;
                                })}
                            </select>
                        </div>

                        {appConfig.app_mode === 'korporat' && (() => {
                            try { return JSON.parse(appConfig.company_shifts || "[]").length > 1; } catch { return false; }
                        })() && (
                                <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 shadow-sm">
                                    <Filter size={16} className="text-gray-400" />
                                    <select
                                        value={selectedShift}
                                        onChange={(e) => setSelectedShift(e.target.value)}
                                        className="bg-transparent border-none outline-none text-sm font-bold text-gray-700 dark:text-slate-200 cursor-pointer"
                                    >
                                        <option value="Semua Shift">Semua Shift</option>
                                        {JSON.parse(appConfig.company_shifts || "[]").map((s, i) => (
                                            <option key={i} value={s.name}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                        <button onClick={handleDownloadReport} disabled={!selectedDivision || reportData.length === 0} className="flex items-center justify-center gap-2 bg-emerald-600 text-white px-5 py-2 rounded-xl hover:bg-emerald-700 transition shadow-lg shadow-emerald-200 font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                            <FileDown size={18} /> <span className="hidden sm:inline">Export Excel</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* TABEL DATA LENGKAP */}
            <div className="flex-1 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-[2rem] shadow-sm flex flex-col overflow-hidden relative">
                {/* Legenda */}
                <div className="flex flex-wrap gap-4 p-4 border-b border-gray-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/50 text-[10px] sm:text-xs shrink-0">
                    <div className="flex items-center gap-2"><Info size={14} className="text-blue-500" /> <span className="font-bold text-gray-600 dark:text-slate-300">Ket:</span></div>
                    <div className="flex items-center gap-1.5"><span className="font-bold text-emerald-500">H</span> <span className="text-gray-500">Hadir</span></div>
                    <div className="flex items-center gap-1.5"><span className="font-bold text-amber-500">T</span> <span className="text-gray-500">Terlambat</span></div>
                    <div className="flex items-center gap-1.5"><span className="font-bold text-blue-500">S</span> <span className="text-gray-500">Sakit</span></div>
                    <div className="flex items-center gap-1.5"><span className="font-bold text-indigo-500">I</span> <span className="text-gray-500">Izin</span></div>
                    <div className="flex items-center gap-1.5"><span className="font-bold text-purple-500">L</span> <span className="text-gray-500">Lembur</span></div>
                    <div className="flex items-center gap-1.5"><span className="font-bold text-red-500">A</span> <span className="text-gray-500">Alfa</span></div>
                </div>

                {loadingReport ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 animate-pulse py-20"><RefreshCcw size={32} className="animate-spin mb-4" /><p className="text-sm">Memuat data absen...</p></div>
                ) : !selectedDivision ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 py-20"><Briefcase size={32} className="mb-4 opacity-20" /><p className="text-sm">Pilih {appConfig.labels?.label_kelompok || 'kelompok'} untuk melihat laporan.</p></div>
                ) : (
                    <div className="flex-1 overflow-auto bg-white min-w-full">
                        <table className="w-full text-left text-sm border-collapse min-w-[900px]">
                            <thead className="bg-slate-50/80 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 font-extrabold text-[11px] uppercase tracking-widest border-b border-gray-200 dark:border-slate-700 sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="p-3 border-r border-gray-200 dark:border-slate-700 sticky left-0 bg-slate-100 dark:bg-slate-800 z-20 w-10 text-center text-[11px] uppercase tracking-wider">No</th>
                                    <th className="p-3 border-r border-gray-200 dark:border-slate-700 sticky left-10 bg-slate-100 dark:bg-slate-800 z-20 w-48 shadow-[4px_0_12px_rgba(0,0,0,0.03)] text-[11px] uppercase tracking-wider cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700" onClick={() => handleSort('nama_lengkap')}>
                                        Nama {appConfig.labels?.label_pengguna || 'Pengguna'} {sortConfig.key === 'nama_lengkap' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                                    </th>
                                    {Array.from({ length: new Date(filterTahun, filterBulan, 0).getDate() }, (_, i) => (<th key={i} className="p-1 border-r border-gray-200 dark:border-slate-700 text-center text-[9px] w-7 text-gray-500 dark:text-slate-400">{i + 1}</th>))}
                                    <th className="p-2 border-r border-gray-200 dark:border-slate-700 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 text-center w-8 text-[11px]">H</th>
                                    <th className="p-2 border-r border-gray-200 dark:border-slate-700 bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400 text-center w-8 text-[11px]">T</th>
                                    <th className="p-2 border-r border-gray-200 dark:border-slate-700 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400 text-center w-8 text-[11px]">S</th>
                                    <th className="p-2 border-r border-gray-200 dark:border-slate-700 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-400 text-center w-8 text-[11px]">I</th>
                                    <th className="p-2 bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-400 text-center w-8 text-[11px]">A</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                {sortedReportData.length === 0 ? (
                                    <tr><td colSpan={38} className="text-center py-20 text-gray-400 text-sm">Tidak ada pengguna di {appConfig.labels?.label_kelompok || 'kelompok'} ini.</td></tr>
                                ) : sortedReportData.map((m, idx) => (
                                    <tr key={m.id || idx} className="hover:bg-blue-50/40 dark:hover:bg-slate-700/50 transition group">
                                        <td className="p-2.5 border-r border-gray-100 dark:border-slate-700 sticky left-0 bg-white dark:bg-slate-800 group-hover:bg-blue-50/40 dark:group-hover:bg-slate-700/50 text-center font-mono text-[11px] text-gray-500 dark:text-slate-400">{idx + 1}</td>
                                        <td className="p-2.5 border-r border-gray-100 dark:border-slate-700 sticky left-10 bg-white dark:bg-slate-800 group-hover:bg-blue-50/40 dark:group-hover:bg-slate-700/50 font-bold text-slate-800 dark:text-slate-200 shadow-[4px_0_12px_rgba(0,0,0,0.02)] text-xs truncate max-w-[160px]">{m.nama_lengkap}</td>

                                        {Array.from({ length: new Date(filterTahun, filterBulan, 0).getDate() }, (_, i) => {
                                            const day = i + 1;
                                            const sObj = (m.attendance || {})[day];
                                            const s = typeof sObj === 'object' ? sObj?.status : sObj;
                                            const isLupa = typeof sObj === 'object' ? sObj?.isLupaMasuk : false;

                                            return (
                                                <td key={i} className="p-0 border-r border-gray-100 dark:border-slate-700 text-center border-b dark:border-slate-700 text-[10px] text-gray-500 dark:text-slate-400">
                                                    <div className="w-full h-full min-h-[30px] flex items-center justify-center">
                                                        {s === 'HADIR' ? (
                                                            isLupa ? (
                                                                <span className="font-black text-[10px] text-rose-600 bg-rose-100 dark:bg-rose-900/40 dark:text-rose-400 px-1 py-0.5 rounded" title="Hadir (Lupa Absen Masuk)">H</span>
                                                            ) : (
                                                                <span className="font-black text-[10px] text-emerald-500" title="Hadir">H</span>
                                                            )
                                                        ) : s === 'TERLAMBAT' ? (
                                                            <span className="font-black text-[10px] text-amber-500" title="Terlambat">T</span>
                                                        ) : s ? (
                                                            <span className={`font-black text-[10px] ${s === 'SAKIT' ? 'text-blue-500' :
                                                                s === 'IZIN' ? 'text-indigo-500' :
                                                                    'text-rose-500'
                                                                }`}>
                                                                {s.charAt(0)}
                                                            </span>
                                                        ) : ''}
                                                    </div>
                                                </td>
                                            );
                                        })}

                                        <td className="p-1 border-r border-gray-100 dark:border-slate-700 text-center font-bold bg-emerald-50/50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs">{m.stats?.H || 0}</td>
                                        <td className="p-1 border-r border-gray-100 dark:border-slate-700 text-center font-bold bg-amber-50/50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs">{m.stats?.T || 0}</td>
                                        <td className="p-1 border-r border-gray-100 dark:border-slate-700 text-center font-bold bg-blue-50/50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs">{m.stats?.S || 0}</td>
                                        <td className="p-1 border-r border-gray-100 dark:border-slate-700 text-center font-bold bg-indigo-50/50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 text-xs">{m.stats?.I || 0}</td>
                                        <td className="p-1 text-center font-bold bg-rose-50/50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 text-xs">{m.stats?.A || 0}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LaporanBulanan;
