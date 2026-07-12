import React, { useState, useEffect } from 'react';
import { 
    Plus, Search, Trash2, Edit, Users, Save, X, Eye, FileDown, Printer,
    ArrowLeft, CheckCircle, AlertCircle, CheckSquare, Square, 
    UserMinus, AlertTriangle, RefreshCcw, Info, Briefcase, Building2 
} from 'lucide-react';
import api from '../../api/axios';
import * as XLSX from 'xlsx-js-style'; 
import logoNabastala from '../../assets/logo-nabastala.png';

const Classes = () => {
  // --- STATE ---
  const [divisionsList, setDivisionsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [btnLoading, setBtnLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState(""); 
  
  // State Selection
  const [selectedIds, setSelectedIds] = useState([]);

  // Modal States
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ show: false, type: '', id: null, count: 0, name: '' });
  
  // Edit & Form Data
  const [isEditMode, setIsEditMode] = useState(false);
  const [editId, setEditId] = useState(null);
  const [formData, setFormData] = useState({ nama_kelas: '', wali_kelas: '' });
  
  // Detail & Report Data
  const [selectedDivision, setSelectedDivision] = useState(null);
  const [activeTab, setActiveTab] = useState('REPORT'); 
  const [reportData, setReportData] = useState([]);
  const [divisionMembers, setDivisionMembers] = useState([]); 
  const [loadingReport, setLoadingReport] = useState(false);
  
  // Filter Report
  const [filterBulan, setFilterBulan] = useState(new Date().getMonth() + 1);
  const [filterTahun, setFilterTahun] = useState(new Date().getFullYear());

  const [notification, setNotification] = useState({ show: false, type: '', message: '' });

  // Config untuk Kop Surat Excel & Print
  const [appConfig, setAppConfig] = useState({ 
    nama_instansi: 'INSTANSI',
    labels: { label_anggota: 'Anggota', label_unit: 'Divisi' },
    logo: logoNabastala
  });

  // --- INIT ---
  useEffect(() => {
    fetchDivisions();
    fetchConfig();
  }, []);

  const showToast = (type, message) => {
    setNotification({ show: true, type, message });
    setTimeout(() => setNotification({ show: false, type: '', message: '' }), 3000);
  };

  // --- API CALLS ---
  const fetchConfig = async () => {
      try {
          const res = await api.get('/settings');
          if(res.data) setAppConfig({ 
              nama_instansi: res.data.nama_sekolah || res.data.nama_instansi || 'INSTANSI',
              labels: res.data.labels || { label_anggota: 'Anggota', label_unit: 'Divisi' },
              logo: res.data.logo_sekolah || res.data.logo_instansi || logoNabastala
          });
      } catch(e) {}
  };

  const fetchDivisions = async () => {
    try {
      const response = await api.get('/divisions'); 
      setDivisionsList(response.data);
      setLoading(false);
    } catch (error) { 
      setLoading(false); 
    }
  };

  const fetchDivisionReport = async (divName) => {
    setLoadingReport(true);
    try {
        // 1. Tentukan Range Tanggal (Format YYYY-MM-DD)
        const lastDay = new Date(filterTahun, filterBulan, 0).getDate();
        const startDate = `${filterTahun}-${String(filterBulan).padStart(2, '0')}-01`;
        const endDate = `${filterTahun}-${String(filterBulan).padStart(2, '0')}-${lastDay}`;

        // 2. Request Paralel: Ambil Data Laporan & Data Anggota
        const [resReport, resMembers] = await Promise.all([
            api.get('/attendance/report', {
                params: { kelas: divName, start_date: startDate, end_date: endDate }
            }),
            api.get('/members')
        ]);

        const rawLogs = resReport.data || [];
        const allMembers = resMembers.data.filter(s => s.kelas === divName);

        // 3. TRANSFORMASI DATA (Mapping Log ke Tanggal)
        const processedData = allMembers.map(member => {
            const attendanceMap = {};
            const stats = { H: 0, T: 0, S: 0, I: 0, A: 0 };

            // Cari log milik member ini
            const memberLogs = rawLogs.filter(log => log.id_anggota === member.nipd || log.id_anggota === member.nisn || log.nama_lengkap === member.nama_lengkap);

            memberLogs.forEach(log => {
                // Ambil tanggal (hari) dari string "2026-02-15" -> 15
                const day = parseInt(log.tanggal.split('-')[2], 10);
                attendanceMap[day] = log.status;

                // Hitung Statistik
                if (log.status === 'HADIR') stats.H++;
                else if (log.status === 'TERLAMBAT') stats.T++;
                else if (log.status === 'SAKIT') stats.S++;
                else if (log.status === 'IZIN') stats.I++;
                else if (log.status === 'ALFA') stats.A++;
            });

            return {
                ...member,
                attendance: attendanceMap, 
                stats: stats
            };
        });

        setReportData(processedData);
        setDivisionMembers(allMembers);

    } catch (error) {
        showToast('error', "Gagal memuat data laporan.");
        console.error("Report Error:", error);
    } finally {
        setLoadingReport(false);
    }
  };

  // Trigger fetch ulang saat filter bulan/tahun berubah
  useEffect(() => {
    if (showDetailModal && selectedDivision) {
        fetchDivisionReport(selectedDivision.nama_kelas);
    }
  }, [filterBulan, filterTahun]); 

  // --- FILTER & SELECTION ---
  const filteredDivisions = divisionsList.filter(c => c.nama_kelas.toLowerCase().includes(searchTerm.toLowerCase()));

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredDivisions.length) {
        setSelectedIds([]);
    } else {
        setSelectedIds(filteredDivisions.map(c => c.id));
    }
  };

  const toggleSelectOne = (id) => {
    if (selectedIds.includes(id)) {
        setSelectedIds(selectedIds.filter(sid => sid !== id));
    } else {
        setSelectedIds([...selectedIds, id]);
    }
  };

  // --- HANDLERS (CRUD) ---
  const handleOpenAdd = () => {
      setIsEditMode(false);
      setFormData({ nama_kelas: '', wali_kelas: '' });
      setShowFormModal(true);
  };

  const handleOpenEdit = (div) => {
      setIsEditMode(true);
      setEditId(div.id);
      setFormData({ nama_kelas: div.nama_kelas, wali_kelas: div.wali_kelas || '' });
      setShowFormModal(true);
  };

  const handleDetailClick = (div) => {
    setSelectedDivision(div);
    setActiveTab('REPORT'); 
    setShowDetailModal(true);
    fetchDivisionReport(div.nama_kelas);
  };

  const handleSubmitDivision = async (e) => {
    e.preventDefault();
    setBtnLoading(true);
    try {
      if (isEditMode) {
        api.put(`/divisions/${editId}`, formData);
        showToast('success', "Data berhasil diperbarui!");
      } else {
        await api.post('/divisions', formData);
        showToast('success', "Divisi baru ditambahkan!");
      }
      setShowFormModal(false);
      fetchDivisions();
    } catch (error) { 
        showToast('error', "Gagal menyimpan data."); 
    } finally {
        setBtnLoading(false);
    }
  };

  const validateDelete = (div) => {
      if (parseInt(div.jumlah_siswa) > 0) {
          showToast('error', `Gagal! "${div.nama_kelas}" masih memiliki ${div.jumlah_siswa} anggota.`);
          return false;
      }
      return true;
  };

  const confirmDeleteSingle = (div) => {
      if (!validateDelete(div)) return;
      setConfirmModal({ show: true, type: 'SINGLE', id: div.id, name: div.nama_kelas, count: 1 });
  };

  const confirmDeleteBulk = () => {
      const idsToDelete = [];
      let rejectedCount = 0;

      selectedIds.forEach(id => {
          const div = divisionsList.find(c => c.id === id);
          if (div && parseInt(div.jumlah_siswa) === 0) {
              idsToDelete.push(id);
          } else {
              rejectedCount++;
          }
      });

      if (rejectedCount > 0) {
          showToast('error', `${rejectedCount} data dilewati karena masih ada anggotanya.`);
      }

      if (idsToDelete.length === 0) return;

      setConfirmModal({ show: true, type: 'BULK', id: idsToDelete, count: idsToDelete.length });
  };

  const executeDelete = async () => {
    setBtnLoading(true);
    try {
        if (confirmModal.type === 'SINGLE') {
            await api.delete(`/divisions/${confirmModal.id}`);
        } else {
            await Promise.all(confirmModal.id.map(id => api.delete(`/divisions/${id}`)));
            setSelectedIds([]);
        }
        fetchDivisions();
        showToast('success', "Data berhasil dihapus.");
    } catch (error) {
        showToast('error', "Gagal menghapus data.");
    } finally {
        setBtnLoading(false);
        setConfirmModal({ show: false, type: '', id: null });
    }
  };

  const handleKickMember = async (member) => {
      if(!window.confirm(`Keluarkan ${member.nama_lengkap} dari ${appConfig.labels?.label_unit || 'divisi'} ini?`)) return;
      try {
          await api.put(`/members/${member.id}`, { ...member, kelas: '' });
          showToast('success', "Anggota berhasil dikeluarkan.");
          fetchDivisionReport(selectedDivision.nama_kelas); 
          fetchDivisions(); 
      } catch (error) { showToast('error', "Gagal mengeluarkan anggota."); }
  };

  // --- FUNGSI EXPORT EXCEL (DIPERBAIKI) ---
  const handleDownloadReport = () => {
    if (!selectedDivision || reportData.length === 0) {
        showToast('error', "Tidak ada data untuk diexport.");
        return;
    }

    const daysInMonth = new Date(filterTahun, filterBulan, 0).getDate();
    const namaBulan = new Date(filterTahun, filterBulan - 1).toLocaleString('id-ID', { month: 'long' });
    
    // 1. Header Tanggal
    const dateHeaders = [];
    for (let i = 1; i <= daysInMonth; i++) {
        dateHeaders.push(String(i));
    }

    // 2. Data Rows
    const dataRows = reportData.map((m, idx) => {
        const row = [
            idx + 1,
            m.nisn || m.nipd || '-',
            m.nama_lengkap
        ];

        // Loop Tanggal
        for (let i = 1; i <= daysInMonth; i++) {
            const status = (m.attendance || {})[i];
            let code = "";
            
            // Simbol Excel sesuai permintaan
            if (status === 'HADIR') code = "v";      
            else if (status === 'TERLAMBAT') code = "T"; 
            else if (status === 'SAKIT') code = "S"; 
            else if (status === 'IZIN') code = "I";
            else if (status === 'ALFA') code = "A";
            
            row.push(code);
        }

        // Statistik
        row.push(
            m.stats?.H || 0,
            m.stats?.T || 0,
            m.stats?.S || 0,
            m.stats?.I || 0,
            m.stats?.A || 0
        );

        return row;
    });

    // 3. Struktur Excel dengan Header/Kop
    const excelData = [
        [appConfig.nama_instansi.toUpperCase()], // Baris 1: Nama Instansi
        [`LAPORAN ABSENSI BULAN ${namaBulan.toUpperCase()} ${filterTahun}`], // Baris 2: Judul
        [`${(appConfig.labels?.label_unit || 'DIVISI').toUpperCase()}: ${selectedDivision.nama_kelas}`], // Baris 3: Divisi
        [], // Baris 4: Kosong
        ["NO", "ID ANGGOTA", "NAMA LENGKAP", ...dateHeaders, "H", "T", "S", "I", "A"], // Baris 5: Header Table
        ...dataRows // Data
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(excelData);

    // Styling Kolom (Lebar)
    const wscols = [
        { wch: 5 },  // No
        { wch: 15 }, // ID
        { wch: 30 }, // Nama
    ];
    // Kolom tanggal kecil
    for(let i=0; i<daysInMonth; i++) wscols.push({ wch: 3 });
    // Kolom statistik
    for(let i=0; i<5; i++) wscols.push({ wch: 4 });

    ws['!cols'] = wscols;

    // Merge Header (Center Title)
    // s = start, e = end, r = row, c = col
    ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 3 + daysInMonth + 5 } }, // Merge Nama Instansi
        { s: { r: 1, c: 0 }, e: { r: 1, c: 3 + daysInMonth + 5 } }, // Merge Judul Laporan
        { s: { r: 2, c: 0 }, e: { r: 2, c: 3 + daysInMonth + 5 } }, // Merge Nama Divisi
    ];

    // STYLING DENGAN xlsx-js-style
    const totalCols = 3 + daysInMonth + 5;
    const totalRows = excelData.length;

    for (let r = 0; r < totalRows; r++) {
        for (let c = 0; c < totalCols; c++) {
            const cellRef = XLSX.utils.encode_cell({ c: c, r: r });
            if (!ws[cellRef]) continue;
            
            const cell = ws[cellRef];
            if (!cell.s) cell.s = {};
            
            // Default Borders (Dari baris Header Tabel ke bawah)
            if (r >= 4) {
                cell.s.border = {
                    top: { style: "thin", color: { auto: 1 } },
                    bottom: { style: "thin", color: { auto: 1 } },
                    left: { style: "thin", color: { auto: 1 } },
                    right: { style: "thin", color: { auto: 1 } }
                };
            }
            
            // Alignment (Tengah semua, kecuali kolom Nama)
            if (r >= 4) {
                if (c === 2) { 
                    cell.s.alignment = { horizontal: "left", vertical: "center" };
                } else {
                    cell.s.alignment = { horizontal: "center", vertical: "center" };
                }
            } else {
                 cell.s.alignment = { horizontal: "center", vertical: "center" };
            }
            
            // Header Row Styling (Baris 5 / index 4)
            if (r === 4) {
                cell.s.font = { bold: true, color: { rgb: "FFFFFF" } };
                cell.s.fill = { fgColor: { rgb: "1E293B" } }; // Slate 800
            }
            
            // Title Styling (Baris 1-3)
            if (r >= 0 && r <= 2) {
                cell.s.font = { bold: true, sz: (r === 0 ? 14 : 12) };
            }
            
            // Legend Colors & Bold
            if (r > 4 && c >= 3 && c < 3 + daysInMonth) {
                if (cell.v === 'v') cell.s.font = { bold: true, color: { rgb: "10B981" } };
                else if (cell.v === 'T') cell.s.font = { bold: true, color: { rgb: "F59E0B" } };
                else if (cell.v === 'S') cell.s.font = { bold: true, color: { rgb: "3B82F6" } };
                else if (cell.v === 'I') cell.s.font = { bold: true, color: { rgb: "6366F1" } };
                else if (cell.v === 'A') cell.s.font = { bold: true, color: { rgb: "EF4444" } };
            }
        }
    }

    XLSX.utils.book_append_sheet(wb, ws, "Laporan Absensi");
    XLSX.writeFile(wb, `Laporan_Absensi_${selectedDivision.nama_kelas}_${namaBulan}_${filterTahun}.xlsx`);
    showToast('success', "Laporan berhasil didownload!");
  };

  return (
    <div className="space-y-6 pb-20 md:pb-0 relative h-full font-sans">
      
      {notification.show && (
        <div className={`fixed top-4 right-4 z-[99] flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl animate-in slide-in-from-right fade-in duration-300 border bg-white ${notification.type === 'success' ? 'border-green-200 text-green-700' : 'border-red-200 text-red-700'}`}>
            {notification.type === 'success' ? <CheckCircle size={22} className="text-green-500"/> : <AlertCircle size={22} className="text-red-500"/>}
            <div><h4 className="font-bold text-sm">{notification.type === 'success' ? 'Berhasil' : 'Gagal'}</h4><p className="text-xs text-gray-500">{notification.message}</p></div>
            <button onClick={() => setNotification({ show: false })}><X size={18} className="text-gray-400"/></button>
        </div>
      )}

      {/* HEADER CARD */}
      <div className="relative bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50/50 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-50/50 rounded-full blur-2xl -ml-10 -mb-10 pointer-events-none"></div>

        <div className="relative z-10">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <Building2 className="text-blue-600" /> Data {appConfig.labels?.label_unit || 'Divisi'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">Kelola daftar unit kerja, kelas, atau kelompok.</p>
        </div>

        <div className="relative z-10 flex flex-col sm:flex-row w-full md:w-auto gap-3">
            {selectedIds.length > 0 && (
                <button onClick={confirmDeleteBulk} className="flex items-center justify-center gap-2 bg-red-100 text-red-600 px-5 py-2.5 rounded-xl hover:bg-red-200 transition text-sm font-bold animate-in fade-in" title="Hapus Terpilih">
                    <Trash2 size={18} /> <span>Hapus ({selectedIds.length})</span>
                </button>
            )}
            <div className="relative flex-1 md:w-64 group">
                <Search className="absolute left-3 top-3 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={18}/>
                <input type="text" placeholder={`Cari ${appConfig.labels?.label_unit || 'Divisi'}...`} className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 text-sm transition-all" onChange={(e) => setSearchTerm(e.target.value)}/>
            </div>
            <button onClick={handleOpenAdd} className="flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-xl hover:bg-blue-700 transition shadow-lg shadow-blue-200 text-sm font-bold active:scale-95">
                <Plus size={18} /> <span>Tambah</span>
            </button>
        </div>
      </div>

      {/* TABEL DATA UTAMA */}
      <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-left whitespace-nowrap">
                <thead className="bg-slate-50 text-slate-500 font-bold text-xs uppercase tracking-widest">
                    <tr>
                        <th className="p-6 w-10 text-center">
                            <button onClick={toggleSelectAll} className="hover:text-blue-600 transition-colors" title="Pilih Semua">
                                {selectedIds.length === filteredDivisions.length && filteredDivisions.length > 0 ? <CheckSquare size={20} className="text-blue-600"/> : <Square size={20}/>}
                            </button>
                        </th>
                        <th className="p-6">Nama {appConfig.labels?.label_unit || 'Unit / Divisi'}</th>
                        <th className="p-6 hidden md:table-cell">Penanggung Jawab</th>
                        <th className="p-6 text-center">Total {appConfig.labels?.label_anggota || 'Anggota'}</th>
                        <th className="p-6 text-center">Aksi</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                    {loading ? ( <tr><td colSpan="5" className="p-20 text-center text-gray-400 animate-pulse font-medium">Memuat data...</td></tr> ) 
                    : filteredDivisions.length === 0 ? ( <tr><td colSpan="5" className="p-20 text-center text-gray-400"><Search size={48} className="mx-auto opacity-10 mb-2"/><p>Tidak ada data ditemukan.</p></td></tr> ) 
                    : ( filteredDivisions.map((div) => (
                        <tr key={div.id} className={`hover:bg-blue-50/30 transition-colors group ${selectedIds.includes(div.id) ? 'bg-blue-50/60' : ''}`}>
                            <td className="p-6 text-center">
                                <button onClick={() => toggleSelectOne(div.id)} className="text-gray-400 hover:text-blue-600 transition-colors">
                                    {selectedIds.includes(div.id) ? <CheckSquare size={20} className="text-blue-600"/> : <Square size={20}/>}
                                </button>
                            </td>
                            <td className="p-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-sm">
                                        <Briefcase size={20} />
                                    </div>
                                    <div>
                                        <span className="font-bold text-gray-800 block text-base">{div.nama_kelas}</span>
                                        <span className="md:hidden text-xs text-gray-400 font-medium">{div.wali_kelas || 'Kosong'}</span>
                                    </div>
                                </div>
                            </td>
                            <td className="p-6 text-gray-600 hidden md:table-cell font-medium">{div.wali_kelas || <span className="text-gray-300 italic font-normal">Belum diatur</span>}</td>
                            <td className="p-6 text-center">
                                <span className={`px-4 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-2 ${div.jumlah_siswa > 0 ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-50 text-slate-400 border border-slate-100'}`}>
                                    <Users size={14}/> {div.jumlah_siswa || 0} Orang
                                </span>
                            </td>
                            <td className="p-6">
                                <div className="flex justify-center gap-2">
                                    <button onClick={() => handleDetailClick(div)} className="p-2 bg-white border border-slate-100 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 hover:border-indigo-100 rounded-lg transition-all shadow-sm" title="Lihat Detail"><Eye size={18}/></button>
                                    <button onClick={() => handleOpenEdit(div)} className="p-2 bg-white border border-slate-100 text-slate-400 hover:text-blue-600 hover:bg-blue-50 hover:border-blue-100 rounded-lg transition-all shadow-sm" title="Edit"><Edit size={18}/></button>
                                    <button onClick={() => confirmDeleteSingle(div)} className={`p-2 bg-white border border-slate-100 rounded-lg transition-all shadow-sm ${div.jumlah_siswa > 0 ? 'text-gray-300 cursor-not-allowed' : 'text-slate-400 hover:text-red-600 hover:bg-red-50 hover:border-red-100'}`} title="Hapus"><Trash2 size={18}/></button>
                                </div>
                            </td>
                        </tr>
                    )))}
                </tbody>
            </table>
        </div>
      </div>

      {/* MODAL FORM ADD/EDIT */}
      {showFormModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-[1.5rem] w-full max-w-md shadow-2xl relative overflow-hidden">
                <div className="px-6 py-4 border-b bg-gray-50 flex justify-between items-center">
                    <h3 className="font-bold text-lg text-gray-800">{isEditMode ? `Edit ${appConfig.labels?.label_unit || 'Divisi'}` : 'Tambah Baru'}</h3>
                    <button onClick={() => setShowFormModal(false)} className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-full"><X size={20}/></button>
                </div>
                <form onSubmit={handleSubmitDivision} className="p-6 space-y-4">
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Nama {appConfig.labels?.label_unit || 'Divisi'}</label>
                        <input className="w-full border border-slate-200 p-2.5 rounded-xl focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 outline-none bg-white transition-all font-medium text-sm" placeholder="Contoh: Staff IT / Finance" value={formData.nama_kelas} onChange={e => setFormData({...formData, nama_kelas: e.target.value})} required />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Penanggung Jawab</label>
                        <input className="w-full border border-slate-200 p-2.5 rounded-xl focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 outline-none bg-white transition-all font-medium text-sm" placeholder="Nama..." value={formData.wali_kelas} onChange={e => setFormData({...formData, wali_kelas: e.target.value})} />
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={() => setShowFormModal(false)} className="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition text-sm">Batal</button>
                        <button type="submit" disabled={btnLoading} className="flex-[2] py-2.5 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition active:scale-95 flex justify-center gap-2 items-center text-sm">
                            {btnLoading ? <RefreshCcw size={16} className="animate-spin" /> : <Save size={16}/>} 
                            {isEditMode ? 'Simpan' : 'Tambah'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* MODAL KONFIRMASI HAPUS */}
      {confirmModal.show && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white rounded-[2rem] p-8 max-w-sm w-full shadow-2xl text-center">
                  <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <AlertTriangle size={32} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800">Hapus Data?</h3>
                  <p className="text-sm text-slate-500 mt-2 mb-6 leading-relaxed">
                      {confirmModal.type === 'SINGLE' 
                        ? <>Anda akan menghapus <b>{confirmModal.name}</b>.</> 
                        : <>Anda akan menghapus <b>{confirmModal.count} item</b> yang dipilih.</>
                      }
                  </p>
                  <div className="flex gap-3">
                      <button onClick={() => setConfirmModal({ show: false, id: null })} className="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition text-sm">Batal</button>
                      <button onClick={executeDelete} disabled={btnLoading} className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 shadow-lg shadow-red-200 transition flex justify-center items-center text-sm">
                         {btnLoading ? <RefreshCcw size={16} className="animate-spin" /> : 'Hapus'}
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* MODAL DETAIL & LAPORAN (DIDALAM MAIN LAYOUT) */}
      {showDetailModal && selectedDivision && (
        <div className="fixed top-[85px] left-0 md:left-[280px] right-0 bottom-0 z-[50] bg-gray-50 flex flex-col animate-in fade-in slide-in-from-bottom-8 duration-300 overflow-hidden shadow-inner">
            {/* Header Modal Detail */}
            <div className="bg-slate-50/80 backdrop-blur-md border-b border-gray-200 px-6 py-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm z-20 shrink-0 no-print">
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <button onClick={() => setShowDetailModal(false)} className="p-2 bg-white border border-gray-200 hover:bg-gray-100 rounded-xl transition-all text-gray-600 shadow-sm active:scale-95"><ArrowLeft size={20} /></button>
                    <div>
                        <h2 className="text-xl font-black text-gray-800 flex items-center gap-2 tracking-tight"><Briefcase className="text-blue-600" size={24}/> {selectedDivision.nama_kelas}</h2>
                        <p className="text-[11px] text-gray-500 font-bold uppercase tracking-widest mt-1">Penanggung Jawab: <span className="text-blue-600">{selectedDivision.wali_kelas || '-'}</span></p>
                    </div>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto items-end sm:items-center">
                    {/* TABS SWITCHER */}
                    <div className="flex bg-gray-200/60 p-1 rounded-xl w-full sm:w-auto">
                        <button onClick={() => setActiveTab('REPORT')} className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'REPORT' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Laporan</button>
                        <button onClick={() => setActiveTab('MEMBERS')} className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'MEMBERS' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Anggota ({divisionMembers.length})</button>
                    </div>

                    {activeTab === 'REPORT' && (
                        <div className="flex items-center gap-2">
                            <div className="flex items-center bg-white p-1 rounded-xl border border-gray-200 shadow-sm">
                                <select value={filterBulan} onChange={(e) => setFilterBulan(e.target.value)} className="bg-transparent text-xs font-bold px-2 py-1 outline-none cursor-pointer text-gray-700 border-r border-gray-100">
                                    {Array.from({length: 12}, (_, i) => (<option key={i+1} value={i+1}>{new Date(0, i).toLocaleString('id-ID', {month: 'short'})}</option>))}
                                </select>
                                <select value={filterTahun} onChange={(e) => setFilterTahun(e.target.value)} className="bg-transparent text-xs font-bold px-2 py-1 outline-none cursor-pointer text-gray-700">
                                    <option value="2026">2026</option><option value="2025">2025</option>
                                </select>
                            </div>
                            <button onClick={handleDownloadReport} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-xl hover:bg-emerald-700 transition shadow-lg shadow-emerald-200 font-bold text-xs active:scale-95"><FileDown size={16} /> Export</button>
                            <button onClick={() => window.print()} className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2.5 rounded-xl hover:bg-slate-900 transition shadow-lg shadow-slate-200 font-bold text-xs active:scale-95"><Printer size={16} /> Cetak</button>
                        </div>
                    )}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-auto p-4 md:p-8 relative">
                {loadingReport ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 animate-pulse"><RefreshCcw size={32} className="animate-spin mb-4"/><p className="text-sm">Memuat data...</p></div>
                ) : activeTab === 'REPORT' ? (
                    // --- TAB 1: LAPORAN ABSENSI (VISUAL SCREEN) ---
                    <div className="flex flex-col h-full print-area">
                        <div className="flex flex-wrap gap-4 mb-4 p-3 bg-white border border-gray-100 rounded-2xl shadow-sm text-[10px] sm:text-xs no-print">
                            <div className="flex items-center gap-2"><Info size={14} className="text-blue-500"/> <span className="font-bold text-gray-600">Ket:</span></div>
                            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-slate-900 border border-slate-700"></div> <span className="text-gray-500">Hadir</span></div>
                            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-yellow-400 border border-yellow-600"></div> <span className="text-gray-500">Terlambat</span></div>
                            <div className="flex items-center gap-1.5"><span className="font-bold text-blue-500">S</span> <span className="text-gray-500">Sakit</span></div>
                            <div className="flex items-center gap-1.5"><span className="font-bold text-indigo-500">I</span> <span className="text-gray-500">Izin</span></div>
                            <div className="flex items-center gap-1.5"><span className="font-bold text-red-500">A</span> <span className="text-gray-500">Alfa</span></div>
                        </div>

                        {/* PRINT ONLY HEADER (KOP SURAT) */}
                        <div className="hidden print:flex flex-col mb-6 border-b-4 border-double border-slate-800 pb-4">
                            <div className="flex items-center gap-6 w-full">
                                <div className="w-24 h-24 flex items-center justify-center shrink-0">
                                    <img src={appConfig.logo} alt="Logo" className="max-w-full max-h-full object-contain grayscale" />
                                </div>
                                <div className="text-center flex-1 pr-24">
                                    <h1 className="text-2xl font-black uppercase tracking-widest">{appConfig.nama_instansi || 'NAMA INSTANSI'}</h1>
                                    <p className="text-sm font-medium mt-1">Alamat Lengkap Instansi / Perusahaan</p>
                                    <p className="text-xs">Telp: (000) 000-0000 | Email: info@instansi.com</p>
                                </div>
                            </div>
                            <div className="text-center mt-6">
                                <h2 className="text-xl font-bold underline underline-offset-4 mb-1">LAPORAN KEHADIRAN</h2>
                                <p className="text-sm font-bold uppercase">{appConfig.labels?.label_unit || 'DIVISI'}: {selectedDivision.nama_kelas}</p>
                                <p className="text-xs">Periode: {new Date(0, filterBulan - 1).toLocaleString('id-ID', {month: 'long'})} {filterTahun}</p>
                            </div>
                        </div>

                        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden min-w-[900px] flex-1">
                            <table className="w-full text-left text-sm border-collapse">
                                <thead className="bg-slate-100/80 text-slate-700 font-extrabold border-b border-gray-200 sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        <th className="p-3 border-r border-gray-200 sticky left-0 bg-slate-100 z-20 w-10 text-center text-[11px] uppercase tracking-wider">No</th>
                                        <th className="p-3 border-r border-gray-200 sticky left-10 bg-slate-100 z-20 w-48 shadow-[4px_0_12px_rgba(0,0,0,0.03)] text-[11px] uppercase tracking-wider">Nama Anggota</th>
                                        {Array.from({length: 31}, (_, i) => (<th key={i} className="p-1 border-r border-gray-200 text-center text-[9px] w-7 text-gray-500">{i+1}</th>))}
                                        <th className="p-2 border-r border-gray-200 bg-emerald-100 text-emerald-700 text-center w-8 text-[11px]">H</th>
                                        <th className="p-2 border-r border-gray-200 bg-amber-100 text-amber-700 text-center w-8 text-[11px]">T</th>
                                        <th className="p-2 border-r border-gray-200 bg-blue-100 text-blue-700 text-center w-8 text-[11px]">S</th>
                                        <th className="p-2 border-r border-gray-200 bg-indigo-100 text-indigo-700 text-center w-8 text-[11px]">I</th>
                                        <th className="p-2 bg-rose-100 text-rose-700 text-center w-8 text-[11px]">A</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {reportData.map((m, idx) => (
                                        <tr key={m.id || idx} className="hover:bg-blue-50/40 transition group">
                                            <td className="p-2.5 border-r border-gray-100 sticky left-0 bg-white group-hover:bg-blue-50/40 text-center font-mono text-[11px] text-gray-500">{idx + 1}</td>
                                            <td className="p-2.5 border-r border-gray-100 sticky left-10 bg-white group-hover:bg-blue-50/40 font-bold text-slate-800 shadow-[4px_0_12px_rgba(0,0,0,0.02)] text-xs truncate max-w-[160px]">{m.nama_lengkap}</td>
                                            
                                            {/* LOOP TANGGAL */}
                                            {Array.from({length: 31}, (_, i) => {
                                                const day = i + 1;
                                                const s = (m.attendance || {})[day]; 
                                                
                                                return (
                                                    <td key={i} className="p-0 border-r border-gray-100 text-center border-b text-[10px] text-gray-500">
                                                        <div className="w-full h-full min-h-[30px] flex items-center justify-center">
                                                            {s === 'HADIR' ? (
                                                                <div className="w-2.5 h-2.5 rounded-sm bg-emerald-400" title="Hadir"></div> 
                                                            ) : s === 'TERLAMBAT' ? (
                                                                <div className="w-2.5 h-2.5 rounded-sm bg-amber-400" title="Terlambat"></div>
                                                            ) : s ? (
                                                                <span className={`font-black text-[10px] ${
                                                                    s === 'SAKIT' ? 'text-blue-500' : 
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

                                            <td className="p-1 border-r border-gray-100 text-center font-bold bg-emerald-50/50 text-emerald-700 text-xs">{m.stats?.H || 0}</td>
                                            <td className="p-1 border-r border-gray-100 text-center font-bold bg-amber-50/50 text-amber-700 text-xs">{m.stats?.T || 0}</td>
                                            <td className="p-1 border-r border-gray-100 text-center font-bold bg-blue-50/50 text-blue-700 text-xs">{m.stats?.S || 0}</td>
                                            <td className="p-1 border-r border-gray-100 text-center font-bold bg-indigo-50/50 text-indigo-700 text-xs">{m.stats?.I || 0}</td>
                                            <td className="p-1 text-center font-bold bg-rose-50/50 text-rose-700 text-xs">{m.stats?.A || 0}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* PRINT ONLY FOOTER (TANDA TANGAN) */}
                        <div className="hidden print:flex justify-between mt-10 px-12 break-inside-avoid">
                            <div className="text-center">
                                <p className="text-sm mb-20">Mengetahui,<br/><b>Pimpinan / Kepala</b></p>
                                <p className="text-sm font-bold underline w-48 mx-auto">_________________________</p>
                            </div>
                            <div className="text-center">
                                <p className="text-sm mb-20">Dibuat Oleh,<br/><b>Penanggung Jawab</b></p>
                                <p className="text-sm font-bold underline w-48 mx-auto">{selectedDivision.wali_kelas || '_________________________'}</p>
                            </div>
                        </div>
                    </div>
                ) : (
                    // --- TAB 2: MANAJEMEN ANGGOTA ---
                    <div className="bg-white border rounded-[1.5rem] shadow-sm p-6 max-w-4xl mx-auto">
                        <div className="mb-4 bg-blue-50 p-4 rounded-xl border border-blue-100 flex gap-3 items-center">
                            <AlertCircle className="text-blue-600 shrink-0" size={20} />
                            <p className="text-xs text-blue-700">Gunakan tombol "Keluarkan" untuk menghapus anggota dari divisi ini tanpa menghapus data master mereka.</p>
                        </div>
                        {divisionMembers.length === 0 ? (
                            <div className="text-center py-10 text-gray-400">
                                <Users size={40} className="mx-auto mb-2 opacity-20"/>
                                <p>{appConfig.labels?.label_unit || 'Divisi'} ini kosong.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {divisionMembers.map((m) => (
                                    <div key={m.id} className="flex items-center justify-between p-3 border rounded-xl hover:border-blue-300 transition bg-gray-50/50">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center border font-bold text-xs text-gray-500">
                                                    {m.nama_lengkap.charAt(0)}
                                                </div>
                                                <div className="overflow-hidden">
                                                    <p className="font-bold text-sm text-gray-800 truncate w-32" title={m.nama_lengkap}>{m.nama_lengkap}</p>
                                                    <p className="text-[10px] text-gray-500 font-mono">{m.nisn}</p>
                                                </div>
                                            </div>
                                            <button onClick={() => handleKickMember(m)} className="p-2 bg-white border border-red-200 text-red-500 rounded-lg hover:bg-red-50 transition shadow-sm" title="Keluarkan">
                                                <UserMinus size={16} />
                                            </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
      )}
    </div>
  );
};

export default Classes;