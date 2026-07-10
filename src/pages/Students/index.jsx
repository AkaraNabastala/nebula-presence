import React, { useState, useEffect, useRef } from 'react';
// FIX: Import Icon Lengkap agar tidak Blank Putih saat klik tombol
import { 
    Plus, Upload, Search, Trash2, Edit, X, Save, 
    Printer, Users, QrCode, CheckCircle, AlertCircle, 
    CheckSquare, Square, FolderArchive, RotateCcw, IdCard, 
    AlertTriangle, Fingerprint, ScanLine, FileSpreadsheet, Building2
} from 'lucide-react';

import api from '../../api/axios';
import * as XLSX from 'xlsx'; 
import JSZip from 'jszip'; 
import Barcode from 'react-barcode';

// Import Default Assets
import logoDefault from '../../assets/logo-nabastala.png';

const Students = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterKelas, setFilterKelas] = useState(""); 
  const [classesOption, setClassesOption] = useState([]);
  
  // State Selection
  const [selectedIds, setSelectedIds] = useState([]);

  // State Config
  const [appConfig, setAppConfig] = useState({ 
      metode_absensi: 'RFID',
      nama_instansi: 'Instansi',
      alamat_instansi: 'Alamat Instansi',
      logo_instansi: ''
  });

  // Modal States
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showBulkCardModal, setShowBulkCardModal] = useState(false);
  
  // Notifikasi & Konfirmasi
  const [notification, setNotification] = useState({ show: false, type: '', message: '' });
  const [confirmModal, setConfirmModal] = useState({ show: false, type: '', id: null, count: 0, name: '' });

  // Cetak Kartu
  const [showCardModal, setShowCardModal] = useState(false);
  const [selectedStudentCard, setSelectedStudentCard] = useState(null);

  const [isEditMode, setIsEditMode] = useState(false); 
  const [editId, setEditId] = useState(null); 
  const [isManualClass, setIsManualClass] = useState(false);
  const [importProgress, setImportProgress] = useState({ show: false, current: 0, total: 0, success: 0, fail: 0 });
  const [btnLoading, setBtnLoading] = useState(false); // Loading tombol

  const [formData, setFormData] = useState({
    nipd: '', nisn: '', nama_lengkap: '', kelas: '', kode_rfid: '', foto: ''
  });

  const fileInputExcelRef = useRef(null);
  const fileInputZipRef = useRef(null);

  useEffect(() => {
    fetchStudents();
    fetchClasses();
    fetchSettings();
  }, []);

  const showToast = (type, message) => {
    setNotification({ show: true, type, message });
    setTimeout(() => setNotification({ show: false, type: '', message: '' }), 3000);
  };

  const fetchStudents = async () => {
    try {
      const response = await api.get('/members');
      setStudents(response.data);
      setLoading(false);
    } catch (error) { setLoading(false); }
  };

  const fetchClasses = async () => {
    try { const res = await api.get('/divisions'); setClassesOption(res.data); } catch (e) {}
  };

  const fetchSettings = async () => {
    try { 
        const res = await api.get('/settings'); 
        if (res.data) {
            setAppConfig({
                ...res.data,
                nama_instansi: res.data.nama_sekolah || res.data.nama_instansi || 'Instansi',
                alamat_instansi: res.data.alamat_sekolah || res.data.alamat_instansi || 'Alamat Belum Diatur',
                logo_instansi: res.data.logo_sekolah || res.data.logo_instansi || ''
            });
        } 
    } catch (e) {}
  };

  const filteredStudents = students.filter(s => {
    const matchSearch = s.nama_lengkap.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        (s.nisn && s.nisn.toString().includes(searchTerm)) || 
                        (s.nipd && s.nipd.toString().includes(searchTerm));
    const matchKelas = filterKelas ? s.kelas === filterKelas : true;
    return matchSearch && matchKelas;
  });

  // --- SELECTION HANDLERS ---
  const toggleSelectAll = () => {
    if (selectedIds.length === filteredStudents.length) {
        setSelectedIds([]);
    } else {
        setSelectedIds(filteredStudents.map(s => s.id));
    }
  };

  const toggleSelectOne = (id) => {
    if (selectedIds.includes(id)) {
        setSelectedIds(selectedIds.filter(sid => sid !== id));
    } else {
        setSelectedIds([...selectedIds, id]);
    }
  };

  // --- PRINT & GENERATE HANDLERS ---
  const handlePrintCard = (student) => {
    setSelectedStudentCard(student);
    setShowCardModal(true);
  };

  const printWindow = () => {
    window.print();
  };

  const handleGenerateID = () => {
    const randomID = Math.floor(1000000000 + Math.random() * 9000000000).toString();
    setFormData({ ...formData, kode_rfid: randomID });
  };

  // Template Excel Universal
  const handleDownloadTemplate = () => {
    const templateData = [{ 
        "ID Pengguna (Wajib)": "'2024001", 
        "NIK / ID Lain": "'330123456", 
        "Nama Lengkap": "Nama Anggota", 
        "Divisi/Jabatan": "Staff IT", 
        "Kode Kartu (Opsional)": "" 
    }];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "Template_Import_Anggota.xlsx");
  };

  // --- IMPORT LOGIC ---
  const handleExcelUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.readAsArrayBuffer(file);
    reader.onload = async (e) => {
        const bufferArray = e.target.result;
        const wb = XLSX.read(bufferArray, { type: "buffer", cellText:false, cellDates:true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { raw: false, defval: "" });
        
        setImportProgress({ show: true, current: 0, total: data.length, success: 0, fail: 0 });
        let s = 0, f = 0;
        
        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            const getVal = (keys) => { 
                const k = Object.keys(row).find(key => keys.some(kw => key.toLowerCase().includes(kw))); 
                if (!k) return '';
                let val = String(row[k]).trim();
                return val.replace(/^'/, ''); 
            };

            const studentData = {
                // Mapping Flexible
                nipd: getVal(['id', 'induk', 'nip', 'nipd', 'nomor']), 
                nisn: getVal(['nik', 'tambahan', 'lain', 'nisn']), 
                nama_lengkap: getVal(['nama', 'lengkap', 'anggota', 'pegawai']),
                kelas: getVal(['divisi', 'kelas', 'jabatan', 'bagian']), 
                kode_rfid: getVal(['rfid', 'kartu', 'barcode']), 
                foto: '' 
            };

            if (!studentData.nama_lengkap || !studentData.kelas) { f++; continue; }
            try { 
                // Backend otomatis create divisi jika belum ada
                await api.post('/members', studentData); 
                s++; 
            } catch (err) { f++; }
            setImportProgress(prev => ({ ...prev, current: i + 1, success: s, fail: f }));
        }
        setTimeout(() => { 
            showToast('success', `Import Selesai! Sukses: ${s}, Gagal: ${f}`); 
            setImportProgress({ show: false }); 
            setShowImportModal(false); 
            fetchStudents(); 
            fetchClasses(); // Refresh data divisi juga
        }, 500);
    };
  };

  const handleZipUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
        const zip = new JSZip();
        const content = await zip.loadAsync(file);
        const imageFiles = Object.keys(content.files).filter(filename => !content.files[filename].dir && /\.(jpg|jpeg|png)$/i.test(filename));
        if (imageFiles.length === 0) { showToast('error', "File ZIP Kosong!"); return; }
        setImportProgress({ show: true, current: 0, total: imageFiles.length, success: 0, fail: 0 });
        let s = 0, f = 0;
        for (let i = 0; i < imageFiles.length; i++) {
            const filename = imageFiles[i];
            const nipd = filename.split('.').slice(0, -1).join('.'); // Ambil nama file sbg NIPD
            const fileData = await content.files[filename].async('base64');
            const mime = filename.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
            try { 
                await api.post('/members/upload-photo', { nipd, foto: `data:${mime};base64,${fileData}` }); 
                s++; 
            } catch (err) { f++; }
            setImportProgress(prev => ({ ...prev, current: i + 1, success: s, fail: f }));
        }
        setTimeout(() => { 
            showToast('success', `Upload Foto Selesai! Sukses: ${s}`); 
            setImportProgress({ show: false }); 
            setShowImportModal(false); 
            fetchStudents(); 
        }, 500);
    } catch (error) { showToast('error', "Gagal membaca file ZIP."); }
  };

  const handleInputChange = (e) => {
      const { name, value } = e.target;
      setFormData({ ...formData, [name]: value });
  };

  const handleFileChange = (e) => { const file = e.target.files[0]; if (file) { const reader = new FileReader(); reader.onloadend = () => setFormData(prev => ({ ...prev, foto: reader.result })); reader.readAsDataURL(file); } };

  // --- PERBAIKAN: FUNGSI HAPUS FOTO ---
  const handleRemovePhoto = (e) => {
      e.stopPropagation(); // Mencegah klik tombol memicu input file
      setFormData({ ...formData, foto: '' });
  };

  const openModal = (student = null) => {
    if (student) {
        setFormData({ 
            nipd: student.nipd, nisn: student.nisn || '', nama_lengkap: student.nama_lengkap, 
            kelas: student.kelas, kode_rfid: student.kode_rfid || '', foto: student.foto || '' 
        }); 
        setEditId(student.id); setIsEditMode(true);
        const exists = classesOption.some(c => c.nama_kelas === student.kelas); setIsManualClass(!exists);
    } else {
        setFormData({ nipd: '', nisn: '', nama_lengkap: '', kelas: '', kode_rfid: '', foto: '' }); 
        setIsEditMode(false); setIsManualClass(false);
    }
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBtnLoading(true);
    try {
      if (isEditMode) { 
          await api.put(`/members/${editId}`, formData); 
          showToast('success', "Data diperbarui!"); 
      } else { 
          await api.post('/members', formData); 
          showToast('success', "Anggota ditambahkan!"); 
      }
      setShowModal(false); fetchStudents(); fetchClasses();
    } catch (error) { showToast('error', "Gagal menyimpan."); }
    finally { setBtnLoading(false); }
  };

  const confirmDeleteSingle = (student) => {
      setConfirmModal({ show: true, type: 'SINGLE', id: student.id, count: 1, name: student.nama_lengkap });
  };

  const confirmDeleteBulk = () => {
      if (selectedIds.length === 0) return;
      setConfirmModal({ show: true, type: 'BULK', id: null, count: selectedIds.length });
  };

  // --- HAPUS DATA (FIXED) ---
  const executeDelete = async () => {
      setBtnLoading(true);
      try { 
          if (confirmModal.type === 'SINGLE') {
              // Gunakan endpoint /members/ID
              await api.delete(`/members/${confirmModal.id}`);
          } else {
              // Loop untuk hapus masal
              await Promise.all(selectedIds.map(id => api.delete(`/members/${id}`)));
              setSelectedIds([]);
          }
          fetchStudents(); 
          fetchClasses(); // Update data divisi juga (jumlah siswa berkurang)
          showToast('success', "Data berhasil dihapus.");
      } catch(e) { 
          console.error("Delete Error:", e);
          showToast('error', "Gagal menghapus data."); 
      } 
      finally { 
          setBtnLoading(false);
          setConfirmModal({ show: false, type: '', id: null, count: 0 }); 
      }
  };

  const renderClassInput = () => {
    if (isManualClass) return (
        <div className="flex gap-2">
            <input name="kelas" value={formData.kelas} onChange={(e) => setFormData({...formData, kelas: e.target.value})} className="w-full border p-2 rounded-lg outline-none focus:border-blue-500 transition-all bg-gray-50 focus:bg-white text-sm" placeholder="Nama Divisi / Jabatan Baru..." required />
            <button type="button" onClick={() => { setIsManualClass(false); setFormData({...formData, kelas: ''}); }} className="p-2 bg-red-100 text-red-500 rounded-lg hover:bg-red-200 transition"><RotateCcw size={16}/></button>
        </div>
    );
    return (
        <select name="kelas" value={formData.kelas} onChange={(e) => { if (e.target.value === 'NEW') { setIsManualClass(true); setFormData({...formData, kelas: ''}); } else { setFormData({...formData, kelas: e.target.value}); } }} className={`w-full border p-2 rounded-lg outline-none focus:border-blue-500 transition-all appearance-none cursor-pointer text-sm ${!formData.kelas ? 'text-gray-400 bg-gray-50' : 'text-gray-800 bg-white'}`} required>
            <option value="" disabled>-- Pilih Divisi / Jabatan --</option>
            {classesOption.map(c => (<option key={c.id} value={c.nama_kelas} className="text-gray-800">{c.nama_kelas}</option>))}
            <option value="NEW" className="font-bold text-blue-600 bg-blue-50">+ Tambah Baru...</option>
        </select>
    );
  };

  const renderMethodInput = () => {
      const metode = appConfig.metode_absensi;
      if (metode === 'MANUAL') return null;

      let label = "Kode Barcode / Kartu";
      let placeholder = "Scan kartu atau ketik ID...";
      
      if (metode === 'FINGERPRINT') label = "ID Fingerprint (ID Mesin)";
      else if (metode === 'RFID') label = "UID Kartu RFID";

      return (
        <div className="space-y-2">
            <div>
                <label className="text-[10px] font-bold text-gray-500 mb-1.5 block uppercase flex items-center gap-2">
                    {metode === 'FINGERPRINT' ? <Fingerprint size={14}/> : <ScanLine size={14}/>} 
                    {label}
                </label>
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <input 
                            name="kode_rfid" 
                            value={formData.kode_rfid} 
                            onChange={handleInputChange} 
                            className="w-full pl-3 pr-3 py-2.5 border border-blue-200 rounded-xl font-mono bg-blue-50/50 outline-none focus:border-blue-500 focus:bg-white text-sm transition-all" 
                            placeholder={placeholder}
                            autoFocus={!isEditMode} 
                        />
                    </div>
                    <button type="button" onClick={handleGenerateID} className="bg-gray-100 px-3 rounded-xl border hover:bg-gray-200 transition-colors text-gray-500" title="Buat Kode Acak"><RotateCcw size={18}/></button>
                </div>
            </div>
        </div>
      );
  };

  // --- COMPONENT KARTU IDENTITAS ---
  const StudentCard = ({ data, config }) => (
    <div className="card-item w-[350px] h-[220px] bg-white rounded-xl shadow-sm border border-gray-400 relative overflow-hidden flex flex-col p-4 break-inside-avoid page-break-avoid mb-4 mx-auto">
        <div className="flex justify-between items-center pb-2 border-b-2 border-gray-800 mb-3">
            <div className="flex items-center justify-center w-12 h-12">
                <img 
                    src={config.logo_instansi || logoDefault} 
                    alt="Logo" 
                    className="w-full h-full object-contain"
                />
            </div>
            <div className="flex-1 text-right pl-2">
                <h3 className="text-xs font-black text-gray-900 uppercase tracking-wide leading-tight">
                    {config.nama_instansi || 'NAMA INSTANSI'}
                </h3>
                <p className="text-[8px] text-gray-500 font-medium leading-tight mt-0.5 max-w-[200px] ml-auto">
                    {config.alamat_instansi || 'Alamat Lengkap Instansi'}
                </p>
            </div>
        </div>
        <div className="flex flex-row items-center gap-4 flex-1">
            <div className="flex-shrink-0">
                <div className="w-[80px] h-[105px] rounded-md bg-gray-100 border border-gray-300 overflow-hidden p-0.5">
                    <img 
                        src={data.foto || `https://ui-avatars.com/api/?name=${data.nama_lengkap}&background=e2e8f0&color=475569`} 
                        className="w-full h-full object-cover rounded-sm" 
                        alt="Foto" 
                    />
                </div>
            </div>
            <div className="flex-1 min-w-0 text-left flex flex-col justify-center">
                <h2 className="text-sm font-bold text-gray-900 leading-tight uppercase mb-1 line-clamp-2">
                    {data.nama_lengkap}
                </h2>
                <p className="text-xs text-gray-700 font-semibold mb-2">
                    {data.kelas} <span className="text-gray-400 mx-1">|</span> {data.nipd}
                </p>
                <div className="mt-auto">
                    {data.kode_rfid ? (
                        <div className="inline-block">
                            <Barcode 
                                value={data.kode_rfid} 
                                width={1.2} 
                                height={30} 
                                fontSize={10} 
                                displayValue={true} 
                                margin={0} 
                                background="transparent"
                            />
                        </div>
                    ) : (
                        <p className="text-[9px] text-red-500 italic border border-red-200 px-2 py-1 rounded bg-red-50">
                            Belum ada Barcode
                        </p>
                    )}
                </div>
            </div>
        </div>
        <div className="absolute bottom-1 right-2">
            <p className="text-[7px] text-gray-300 italic">Kartu Identitas Resmi</p>
        </div>
    </div>
  );

  return (
    <div className="space-y-6 pb-20 md:pb-0 relative h-full font-sans">
      
      {/* TOAST */}
      {notification.show && (
        <div className={`fixed top-4 right-4 z-[99] flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl animate-in slide-in-from-right fade-in duration-300 border bg-white ${notification.type === 'success' ? 'border-green-200 text-green-700' : 'border-red-200 text-red-700'}`}>
            {notification.type === 'success' ? <CheckCircle size={20} className="text-green-500"/> : <AlertCircle size={20} className="text-red-500"/>}
            <div><h4 className="font-bold text-sm">{notification.type === 'success' ? 'Berhasil' : 'Gagal'}</h4><p className="text-xs text-gray-500">{notification.message}</p></div>
            <button onClick={() => setNotification({ ...notification, show: false })}><X size={16} className="text-gray-400"/></button>
        </div>
      )}

      {/* HEADER SECTION */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><Users className="text-blue-600" size={28}/> Data Anggota</h2>
            <p className="text-gray-500 text-sm mt-1 flex items-center gap-2"><IdCard size={14}/> Total: <span className="font-bold text-gray-800">{students.length} Orang</span></p>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
            {selectedIds.length > 0 && (
                <button onClick={confirmDeleteBulk} className="flex items-center justify-center gap-2 bg-red-100 text-red-600 px-4 py-2.5 rounded-xl hover:bg-red-200 text-sm font-bold transition-all flex-1 md:flex-none">
                    <Trash2 size={18}/> <span>Hapus ({selectedIds.length})</span>
                </button>
            )}
            
            {appConfig.metode_absensi === 'BARCODE' && (
                <button onClick={() => setShowBulkCardModal(true)} className="flex items-center justify-center gap-2 bg-purple-600 text-white px-4 py-2.5 rounded-xl hover:bg-purple-700 text-sm font-bold shadow-lg shadow-purple-200 transition-all active:scale-95 flex-1 md:flex-none">
                    <Printer size={18}/> <span>Cetak</span>
                </button>
            )}

            <button onClick={() => setShowImportModal(true)} className="flex items-center justify-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-xl hover:bg-emerald-700 text-sm font-bold shadow-lg shadow-emerald-200 transition-all active:scale-95 flex-1 md:flex-none">
                <Upload size={18}/> <span>Import</span>
            </button>
            <button onClick={() => openModal()} className="flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl hover:bg-blue-700 text-sm font-bold shadow-lg shadow-blue-200 transition-all active:scale-95 flex-1 md:flex-none">
                <Plus size={18}/> <span>Tambah</span>
            </button>
        </div>
      </div>

      {/* FILTER SECTION */}
      <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="relative flex-1 group">
            <Search className="absolute left-3 top-3 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={20}/>
            <input type="text" placeholder="Cari Nama, NIP/ID, atau Barcode..." className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all text-sm" onChange={e => setSearchTerm(e.target.value)} value={searchTerm}/>
        </div>
        <div className="relative md:w-64">
            <FolderArchive className="absolute left-3 top-3 text-gray-500 pointer-events-none" size={18}/>
            <select className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 bg-white appearance-none cursor-pointer transition-all text-sm" value={filterKelas} onChange={(e) => setFilterKelas(e.target.value)}>
                <option value="">Semua Divisi / Kelas</option>
                {classesOption.map(c => (<option key={c.id} value={c.nama_kelas}>{c.nama_kelas}</option>))}
            </select>
            <div className="absolute right-3 top-3 text-gray-400 pointer-events-none text-xs">▼</div>
        </div>
      </div>

      {/* --- CONTENT AREA (RESPONSIVE) --- */}
      
      {/* 1. TABLE VIEW (Desktop Only) */}
      <div className="hidden md:block bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm min-h-[400px]">
        <div className="overflow-x-auto">
            <table className="w-full text-left whitespace-nowrap">
                <thead className="bg-gray-50 text-gray-600 font-bold text-xs uppercase tracking-wider">
                    <tr>
                        <th className="p-5 w-10 text-center">
                            <button onClick={toggleSelectAll} className="hover:text-blue-600 transition-colors">
                                {selectedIds.length === filteredStudents.length && filteredStudents.length > 0 ? <CheckSquare size={20} className="text-blue-600"/> : <Square size={20}/>}
                            </button>
                        </th>
                        <th className="p-5">Foto</th>
                        <th className="p-5">Identitas</th>
                        <th className="p-5">ID Pengguna</th>
                        <th className="p-5 text-center">Aksi</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                    {loading ? ( 
                        Array.from({length: 5}).map((_, i) => (
                            <tr key={i} className="animate-pulse">
                                <td className="p-5 text-center"><div className="h-5 w-5 bg-gray-200 rounded mx-auto"></div></td>
                                <td className="p-5"><div className="w-10 h-10 bg-gray-200 rounded-lg"></div></td>
                                <td className="p-5 space-y-2"><div className="h-4 w-40 bg-gray-200 rounded"></div><div className="h-3 w-16 bg-gray-200 rounded"></div></td>
                                <td className="p-5 space-y-2"><div className="h-4 w-24 bg-gray-200 rounded"></div></td>
                                <td className="p-5 flex justify-center gap-2"><div className="h-8 w-8 bg-gray-200 rounded"></div></td>
                            </tr>
                        ))
                    ) : filteredStudents.length === 0 ? ( 
                        <tr>
                            <td colSpan="5" className="p-10 text-center">
                                <div className="text-gray-400 mb-2">Tidak ada data ditemukan</div>
                            </td>
                        </tr>
                    ) : ( 
                        filteredStudents.map((s) => (
                        <tr key={s.id} className={`hover:bg-blue-50/40 transition-colors group ${selectedIds.includes(s.id) ? 'bg-blue-50/60' : ''}`}>
                            <td className="p-5 text-center">
                                <button onClick={() => toggleSelectOne(s.id)} className="text-gray-300 hover:text-blue-600 transition-colors">
                                    {selectedIds.includes(s.id) ? <CheckSquare size={20} className="text-blue-600"/> : <Square size={20}/>}
                                </button>
                            </td>
                            <td className="p-5">
                                {/* FOTO KOTAK (ROUNDED-LG) */}
                                <div className="w-10 h-10 rounded-lg bg-gray-200 border border-gray-200 shadow-sm overflow-hidden object-cover">
                                    {s.foto ? <img src={s.foto} className="w-full h-full object-cover" alt="Foto"/> : <div className="flex items-center justify-center h-full font-bold text-gray-400 text-xs">{s.nama_lengkap.charAt(0)}</div>}
                                </div>
                            </td>
                            <td className="p-5">
                                <div className="font-bold text-gray-800 text-base group-hover:text-blue-700 transition-colors">{s.nama_lengkap}</div>
                                <div className="mt-1 inline-block px-2.5 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded-md font-bold uppercase tracking-wide group-hover:bg-blue-100 group-hover:text-blue-700 transition-colors">{s.kelas}</div>
                            </td>
                            <td className="p-5">
                                <div className="font-mono text-gray-700 font-medium">{s.nipd}</div>
                                {s.nisn && <div className="text-xs text-gray-400 mt-0.5">ID: {s.nipd}</div>}
                            </td>
                            <td className="p-5">
                                <div className="flex justify-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                                    {appConfig.metode_absensi === 'BARCODE' && (
                                        <button onClick={() => handlePrintCard(s)} className="p-2 bg-white border border-purple-200 text-purple-600 hover:bg-purple-600 hover:text-white rounded-lg transition-all shadow-sm active:scale-90"><QrCode size={18}/></button>
                                    )}
                                    <button onClick={() => openModal(s)} className="p-2 bg-white border border-blue-200 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg transition-all shadow-sm active:scale-90"><Edit size={18}/></button>
                                    <button onClick={() => confirmDeleteSingle(s)} className="p-2 bg-white border border-red-200 text-red-600 hover:bg-red-600 hover:text-white rounded-lg transition-all shadow-sm active:scale-90"><Trash2 size={18}/></button>
                                </div>
                            </td>
                        </tr>
                    )))}
                </tbody>
            </table>
        </div>
      </div>

      {/* 2. MOBILE CARD VIEW */}
      <div className="md:hidden space-y-4">
        {loading ? (
            <div className="text-center py-10 text-gray-400">Memuat data...</div>
        ) : filteredStudents.length === 0 ? (
            <div className="text-center py-10 text-gray-400 bg-white rounded-xl border border-gray-100">Data tidak ditemukan</div>
        ) : (
            filteredStudents.map((s) => (
                <div key={s.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
                    {/* Checkbox Mobile */}
                    <button onClick={() => toggleSelectOne(s.id)} className="text-gray-300">
                        {selectedIds.includes(s.id) ? <CheckSquare size={24} className="text-blue-600"/> : <Square size={24}/>}
                    </button>
                    
                    {/* FOTO KOTAK DI MOBILE */}
                    <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0 border border-gray-200">
                        {s.foto ? <img src={s.foto} className="w-full h-full object-cover" alt="Foto"/> : <div className="flex items-center justify-center h-full font-bold text-gray-400">{s.nama_lengkap.charAt(0)}</div>}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-gray-800 text-sm truncate">{s.nama_lengkap}</h4>
                        <p className="text-xs text-blue-600 font-bold mb-0.5">{s.kelas}</p>
                        <p className="text-xs text-gray-400 font-mono">{s.nipd}</p>
                    </div>

                    {/* Action Menu Mobile */}
                    <div className="flex flex-col gap-2">
                        <button onClick={() => openModal(s)} className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Edit size={16}/></button>
                        <button onClick={() => confirmDeleteSingle(s)} className="p-2 bg-red-50 text-red-600 rounded-lg"><Trash2 size={16}/></button>
                    </div>
                </div>
            ))
        )}
      </div>

      {/* --- MODAL FORM --- */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-[1.5rem] w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl relative flex flex-col">
                <div className="px-6 py-3 border-b bg-gray-50 flex justify-between items-center shrink-0">
                    <div>
                        <h3 className="font-bold text-lg text-gray-800">{isEditMode ? 'Edit Data' : 'Tambah Anggota'}</h3>
                        <p className="text-[10px] text-gray-500">Pastikan data yang dimasukkan valid.</p>
                    </div>
                    <button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-gray-200 rounded-full transition-colors text-gray-500"><X size={20}/></button>
                </div>
                
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="md:col-span-1 flex flex-col gap-2">
                            <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Foto Profil (3:4)</label>
                            
                            {/* PERBAIKAN: PENAMBAHAN TOMBOL HAPUS FOTO PADA PREVIEW */}
                            <div className="relative aspect-[3/4] w-full max-w-[150px] md:max-w-[180px] mx-auto rounded-lg bg-gray-100 border-2 border-dashed border-gray-300 flex flex-col items-center justify-center overflow-hidden hover:bg-blue-50 hover:border-blue-400 transition-all cursor-pointer group">
                                {formData.foto ? (
                                    <div className="relative w-full h-full">
                                        <img src={formData.foto} className="w-full h-full object-cover" alt="Preview"/>
                                        
                                        {/* TOMBOL HAPUS (Muncul Saat Hover) */}
                                        <button 
                                            type="button" 
                                            onClick={handleRemovePhoto}
                                            className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-md shadow-lg z-10 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
                                            title="Hapus Foto"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="text-center text-gray-400 group-hover:text-blue-500 transition-colors">
                                        <Upload size={24} className="mx-auto mb-1"/>
                                        <span className="text-[10px] font-medium">Upload</span>
                                    </div>
                                )}
                                <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFileChange}/>
                            </div>
                        </div>

                        <div className="md:col-span-2 space-y-3">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-bold text-gray-500 mb-1 block uppercase">ID Pengguna / No. Induk <span className="text-red-500">*</span></label>
                                    <input name="nipd" value={formData.nipd} onChange={handleInputChange} className="w-full border p-2 rounded-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all bg-gray-50 focus:bg-white text-sm" required placeholder="Contoh: 2024001"/>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-gray-500 mb-1 block uppercase">ID Tambahan (Opsional)</label>
                                    <input name="nisn" value={formData.nisn} onChange={handleInputChange} className="w-full border p-2 rounded-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all bg-gray-50 focus:bg-white text-sm" placeholder="Contoh: 3301xxxxxxxx"/>
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-gray-500 mb-1 block uppercase">Nama Lengkap <span className="text-red-500">*</span></label>
                                <input name="nama_lengkap" value={formData.nama_lengkap} onChange={handleInputChange} className="w-full border p-2 rounded-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all bg-gray-50 focus:bg-white text-sm" required placeholder="Nama lengkap..."/>
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-gray-500 mb-1 block uppercase">Divisi / Jabatan / Kelas <span className="text-red-500">*</span></label>
                                {renderClassInput()}
                            </div>

                            {renderMethodInput()}

                        </div>
                    </div>
                </form>
                
                <div className="px-6 py-4 border-t bg-gray-50 shrink-0 flex justify-end gap-3">
                    <button onClick={() => setShowModal(false)} className="px-5 py-2 rounded-lg font-bold text-gray-500 hover:bg-gray-200 transition-colors text-xs">Batal</button>
                    <button onClick={handleSubmit} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-md shadow-blue-200 transition-all active:scale-95 flex items-center gap-2 text-xs">
                        <Save size={16}/> Simpan
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* MODAL KONFIRMASI HAPUS */}
      {confirmModal.show && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white rounded-[2rem] p-8 max-w-sm w-full shadow-2xl text-center">
                  <div className="w-20 h-20 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6 animate-in zoom-in">
                      <AlertTriangle size={40} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-800">Konfirmasi Hapus</h3>
                  <p className="text-sm text-gray-500 mt-2 mb-8 leading-relaxed">
                      Hapus data <b>"{confirmModal.name || confirmModal.count + ' Item'}"</b>?
                      <br/>Tindakan ini permanen.
                  </p>
                  <div className="flex gap-3">
                      <button onClick={() => setConfirmModal({ show: false, type: '', id: null, count: 0 })} className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition">Batal</button>
                      <button onClick={executeDelete} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 shadow-lg shadow-red-200 transition">Hapus</button>
                  </div>
              </div>
          </div>
      )}

      {/* MODAL IMPORT */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-[2rem] w-full max-w-2xl overflow-hidden shadow-2xl relative">
                <button onClick={() => setShowImportModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 bg-gray-100 rounded-full p-2"><X size={20}/></button>
                <div className="px-8 py-6 border-b bg-gray-50 flex items-center gap-3">
                    <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg"><Upload size={24}/></div>
                    <h3 className="font-bold text-xl text-gray-800">Import Data Masal</h3>
                </div>
                <div className="p-8">
                    <input type="file" ref={fileInputExcelRef} className="hidden" accept=".xlsx,.xls" onChange={handleExcelUpload}/>
                    <input type="file" ref={fileInputZipRef} className="hidden" accept=".zip" onChange={handleZipUpload}/>
                    
                    {importProgress.show ? (
                        <div className="text-center py-10 space-y-4">
                            <div className="text-5xl font-black text-blue-600 animate-pulse">{Math.round((importProgress.current/importProgress.total)*100)}%</div>
                            <p className="text-gray-500 font-medium">Memproses... ({importProgress.current}/{importProgress.total})</p>
                            <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                                <div className="bg-blue-600 h-full rounded-full transition-all duration-300" style={{width: `${(importProgress.current/importProgress.total)*100}%`}}></div>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="group border-2 border-dashed border-gray-300 p-8 flex flex-col items-center justify-center rounded-2xl cursor-pointer hover:bg-emerald-50 hover:border-emerald-400 transition-all" onClick={() => fileInputExcelRef.current.click()}>
                                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><FileSpreadsheet size={32}/></div>
                                <h4 className="font-bold text-gray-800 text-lg">Upload Data (Excel)</h4>
                                <p className="text-xs text-gray-400 text-center mt-2">Format .xlsx</p>
                                <button onClick={(e)=>{e.stopPropagation();handleDownloadTemplate()}} className="mt-6 text-xs font-bold text-emerald-600 bg-white border border-emerald-200 px-4 py-2 rounded-lg hover:bg-emerald-600 hover:text-white transition-colors">Download Template</button>
                            </div>
                            <div className="group border-2 border-dashed border-gray-300 p-8 flex flex-col items-center justify-center rounded-2xl cursor-pointer hover:bg-blue-50 hover:border-blue-400 transition-all" onClick={() => fileInputZipRef.current.click()}>
                                <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><FolderArchive size={32}/></div>
                                <h4 className="font-bold text-gray-800 text-lg">Upload Foto (ZIP)</h4>
                                <p className="text-xs text-gray-400 text-center mt-2">Nama file = ID Pengguna</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
      )}

      {/* MODAL PRINT CARD */}
      {(showCardModal || showBulkCardModal) && (
        <div className="fixed inset-0 z-50 bg-gray-100 overflow-y-auto animate-in fade-in">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center shadow-md z-20 print:hidden">
                <div className="flex items-center gap-3">
                    <button onClick={() => {setShowCardModal(false); setShowBulkCardModal(false);}} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><X size={24}/></button>
                    <h2 className="text-xl font-bold text-gray-800">Preview Kartu Identitas</h2>
                </div>
                <button onClick={printWindow} className="px-6 py-2.5 bg-purple-600 text-white rounded-xl flex items-center gap-2 font-bold hover:bg-purple-700 shadow-lg transition-transform active:scale-95"><Printer size={18}/> Print Sekarang</button>
            </div>
            <div id="print-area" className="p-8 min-h-screen bg-gray-100">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6 justify-items-center">
                    {showCardModal && selectedStudentCard && <StudentCard data={selectedStudentCard} config={appConfig}/>}
                    {showBulkCardModal && filteredStudents.map((s) => <StudentCard key={s.id} data={s} config={appConfig}/>)}
                </div>
            </div>
            <style>{`
                @media print {
                    body * { visibility: hidden; }
                    #print-area, #print-area * { visibility: visible; }
                    #print-area { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 0; background-color: white; }
                    .print\\:hidden { display: none !important; }
                    .card-item { page-break-inside: avoid; margin: 10px; border: 1px solid #ccc; }
                    .grid { display: block; }
                    .card-item { display: inline-flex; margin-right: 10px; margin-bottom: 10px; }
                }
            `}</style>
        </div>
      )}

    </div>
  );
};

export default Students;