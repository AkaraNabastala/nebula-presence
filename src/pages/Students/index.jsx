import React, { useState, useEffect, useRef } from 'react';
import { 
    Plus, Upload, Search, Trash2, Edit, X, Save, 
    Printer, Users, CheckCircle, AlertCircle, 
    CheckSquare, Square, FolderArchive, RotateCcw, IdCard, 
    AlertTriangle, Fingerprint, ScanLine, FileSpreadsheet,
    ChevronDown
} from 'lucide-react';
import api from '../../api/axios';
import * as XLSX from "xlsx-js-style"; 
import JSZip from 'jszip'; 
import PrintCardModal from './PrintCardModal';

const Students = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterKelas, setFilterKelas] = useState(""); 
  const [classesOption, setClassesOption] = useState([]);
  
  const [selectedIds, setSelectedIds] = useState([]);
  const [appConfig, setAppConfig] = useState({ 
      metode_absensi: 'RFID', 
      nama_instansi: 'Instansi',
      labels: { label_anggota: 'Anggota', label_unit: 'Divisi' }
  });

  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [notification, setNotification] = useState({ show: false, type: '', message: '' });
  const [confirmModal, setConfirmModal] = useState({ show: false, type: '', id: null, count: 0, name: '' });
  const [printModalConfig, setPrintModalConfig] = useState({ show: false, isBulk: false, data: null });

  const [isEditMode, setIsEditMode] = useState(false); 
  const [editId, setEditId] = useState(null); 
  const [isManualClass, setIsManualClass] = useState(false);
  const [importProgress, setImportProgress] = useState({ show: false, current: 0, total: 0 });
  const [btnLoading, setBtnLoading] = useState(false);

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
        const res = await api.get('/members'); 
        setStudents(res.data?.data || res.data); 
        setLoading(false); 
    } catch (e) { setLoading(false); }
  };

  const fetchClasses = async () => {
    try { 
        const res = await api.get('/divisions'); 
        setClassesOption(res.data?.data || res.data); 
    } catch (e) {}
  };

  const fetchSettings = async () => {
    try { 
        const res = await api.get('/settings'); 
        if (res.data) setAppConfig({ 
            ...res.data, 
            nama_instansi: res.data.nama_sekolah || res.data.nama_instansi || 'Instansi',
            labels: res.data.labels || { label_anggota: 'Anggota', label_unit: 'Divisi' }
        });
    } catch (e) {}
  };

  const filteredStudents = students.filter(s => {
    const matchSearch = s.nama_lengkap?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        s.nisn?.toString().includes(searchTerm) || 
                        s.nipd?.toString().includes(searchTerm);
    const matchKelas = filterKelas ? s.kelas === filterKelas : true;
    return matchSearch && matchKelas;
  });

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredStudents.length && filteredStudents.length > 0) setSelectedIds([]);
    else setSelectedIds(filteredStudents.map(s => s.id));
  };

  const toggleSelectOne = (id) => {
    if (selectedIds.includes(id)) setSelectedIds(selectedIds.filter(sid => sid !== id));
    else setSelectedIds([...selectedIds, id]);
  };

  const handlePrintCard = (student) => setPrintModalConfig({ show: true, isBulk: false, data: student });
  const handlePrintBulk = () => setPrintModalConfig({ show: true, isBulk: true, data: filteredStudents.filter(s => selectedIds.includes(s.id)) });

  const handleGenerateID = () => setFormData({ ...formData, kode_rfid: Math.floor(1000000000 + Math.random() * 9000000000).toString() });
  const handleInputChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
  
  const handleFileChange = (e) => { 
      const file = e.target.files[0]; 
      if (file) { 
          const reader = new FileReader(); 
          reader.onloadend = () => setFormData(prev => ({ ...prev, foto: reader.result })); 
          reader.readAsDataURL(file); 
      } 
  };
  
  const handleRemovePhoto = (e) => { 
      e.stopPropagation(); 
      setFormData({ ...formData, foto: '' }); 
  };

  const openModal = (student = null) => {
    if (student) {
        setFormData({ 
            nipd: student.nipd, nisn: student.nisn || '', nama_lengkap: student.nama_lengkap, 
            kelas: student.kelas, kode_rfid: student.kode_rfid || '', foto: student.foto || '' 
        }); 
        setEditId(student.id); setIsEditMode(true);
        setIsManualClass(!classesOption.some(c => c.nama_kelas === student.kelas));
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
    } catch (e) { showToast('error', "Gagal menyimpan."); }
    finally { setBtnLoading(false); }
  };

  const confirmDeleteSingle = (s) => setConfirmModal({ show: true, type: 'SINGLE', id: s.id, count: 1, name: s.nama_lengkap });
  const confirmDeleteBulk = () => { if (selectedIds.length > 0) setConfirmModal({ show: true, type: 'BULK', id: null, count: selectedIds.length }); };

  const executeDelete = async () => {
      setBtnLoading(true);
      try { 
          if (confirmModal.type === 'SINGLE') await api.delete(`/members/${confirmModal.id}`);
          else { await Promise.all(selectedIds.map(id => api.delete(`/members/${id}`))); setSelectedIds([]); }
          fetchStudents(); fetchClasses(); showToast('success', "Data dihapus.");
      } catch(e) { showToast('error', "Gagal menghapus."); } 
      finally { setBtnLoading(false); setConfirmModal({ show: false }); }
  };

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([{ "ID Pengguna (Wajib)": "'2024001", "NIK / ID Lain": "'330123456", "Nama Lengkap": "Nama Anggota", "Divisi/Jabatan": "Staff IT", "Kode Kartu (Opsional)": "" }]);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Template"); XLSX.writeFile(wb, "Template_Import.xlsx");
  };

  const handleExcelUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    setImportProgress({ show: true, current: 0, total: 100, success: 0, fail: 0 }); // Fake progress
    
    const formData = new FormData();
    formData.append('excel_file', file);
    
    try {
        const res = await api.post('/members/import', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        showToast('success', res.data.message);
    } catch (err) {
        showToast('error', err.response?.data?.message || 'Gagal mengimport data.');
    } finally {
        setImportProgress({ show: false }); 
        setShowImportModal(false); 
        fetchStudents(); 
        fetchClasses(); 
    }
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
            const nipd = filename.split('.').slice(0, -1).join('.');
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
            setImportProgress({ show: false }); setShowImportModal(false); 
            fetchStudents(); 
        }, 500);
    } catch (error) { showToast('error', "Gagal membaca file ZIP."); }
  };

  const renderClassInput = () => {
    if (isManualClass) return (
        <div className="flex gap-2">
            <input name="kelas" value={formData.kelas} onChange={(e) => setFormData({...formData, kelas: e.target.value})} className="w-full border-2 border-slate-200 p-3 rounded-xl outline-none focus:border-indigo-500 transition-all bg-slate-50 focus:bg-white text-sm font-semibold" placeholder={`Nama ${appConfig.labels?.label_unit || 'Divisi'} Baru...`} required />
            <button type="button" onClick={() => { setIsManualClass(false); setFormData({...formData, kelas: ''}); }} className="px-4 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-100 transition"><RotateCcw size={18}/></button>
        </div>
    );
    return (
        <div className="relative">
            <select name="kelas" value={formData.kelas} onChange={(e) => { if (e.target.value === 'NEW') { setIsManualClass(true); setFormData({...formData, kelas: ''}); } else { setFormData({...formData, kelas: e.target.value}); } }} className={`w-full border-2 border-slate-200 p-3 pr-10 rounded-xl outline-none focus:border-indigo-500 transition-all appearance-none cursor-pointer text-sm font-semibold ${!formData.kelas ? 'text-slate-400 bg-slate-50' : 'text-slate-800 bg-white'}`} required>
                <option value="" disabled>-- Pilih {appConfig.labels?.label_unit || 'Divisi'} --</option>
                {classesOption.map(c => (<option key={c.id} value={c.nama_kelas} className="text-slate-800">{c.nama_kelas}</option>))}
                <option value="NEW" className="font-bold text-indigo-600 bg-indigo-50">+ Tambah Baru...</option>
            </select>
            <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
        </div>
    );
  };

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500 bg-transparent relative h-full font-sans">
      
      {/* TOAST NOTIFICATION */}
      {notification.show && (
        <div className={`fixed top-6 right-6 z-[100] flex items-center gap-4 px-5 py-4 rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.2)] animate-in slide-in-from-right-8 fade-in duration-300 border bg-white/90 backdrop-blur-md ${notification.type === 'success' ? 'border-emerald-100 text-emerald-800' : 'border-rose-100 text-rose-800'}`}>
            <div className={`p-2 rounded-full ${notification.type === 'success' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                {notification.type === 'success' ? <CheckCircle size={20}/> : <AlertCircle size={20}/>}
            </div>
            <div className="pr-4">
                <h4 className="font-extrabold text-[15px] leading-tight">{notification.type === 'success' ? 'Berhasil' : 'Peringatan'}</h4>
                <p className="text-[13px] opacity-80 font-medium">{notification.message}</p>
            </div>
            <button onClick={() => setNotification({ ...notification, show: false })} className="p-1 hover:bg-slate-100 rounded-full transition-colors absolute top-2 right-2 opacity-50 hover:opacity-100"><X size={16}/></button>
        </div>
      )}

      {/* HEADER SECTION */}
      <div className="bg-white rounded-[2rem] p-6 md:p-8 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)] border border-slate-100 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
        <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-[1.25rem] bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100/50 shadow-inner">
                <Users size={32} />
            </div>
            <div>
                <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">Direktori {appConfig.labels?.label_anggota || 'Anggota'}</h2>
                <p className="text-slate-500 font-medium mt-1 text-sm flex items-center gap-1.5"><IdCard size={16}/> Total: <span className="font-bold text-indigo-600">{students.length} Terdaftar</span></p>
            </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
            {selectedIds.length > 0 && (
                <button onClick={confirmDeleteBulk} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-rose-50 text-rose-600 px-5 py-3 rounded-[1.25rem] hover:bg-rose-500 hover:text-white text-sm font-bold transition-all border border-rose-100 hover:border-rose-500 shadow-sm">
                    <Trash2 size={18}/> <span>Hapus ({selectedIds.length})</span>
                </button>
            )}
            
            {appConfig.metode_absensi === 'BARCODE' && (
                <button onClick={handlePrintBulk} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white text-slate-700 border border-slate-200 px-5 py-3 rounded-[1.25rem] hover:bg-slate-50 hover:text-indigo-600 text-sm font-bold transition-all shadow-sm">
                    <Printer size={18}/> <span>Cetak Terpilih</span>
                </button>
            )}

            <button onClick={() => setShowImportModal(true)} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-emerald-50 text-emerald-600 px-5 py-3 rounded-[1.25rem] hover:bg-emerald-500 hover:text-white text-sm font-bold transition-all border border-emerald-100 hover:border-emerald-500 shadow-sm">
                <Upload size={18}/> <span>Import</span>
            </button>

            <button onClick={() => openModal()} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-[1.25rem] hover:shadow-lg hover:shadow-indigo-500/30 text-sm font-bold transition-all active:scale-95">
                <Plus size={18}/> <span>Tambah {appConfig.labels?.label_anggota || 'Anggota'}</span>
            </button>
        </div>
      </div>

      {/* FILTER SECTION */}
      <div className="bg-white p-2.5 rounded-[1.5rem] shadow-sm border border-slate-100 flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={20}/>
            <input type="text" placeholder="Cari Nama, NIP/ID, atau Kode..." className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-transparent rounded-[1rem] outline-none focus:border-indigo-200 focus:bg-white focus:ring-4 focus:ring-indigo-500/5 transition-all text-sm font-medium text-slate-700 placeholder:text-slate-400" onChange={e => setSearchTerm(e.target.value)} value={searchTerm}/>
        </div>
        <div className="relative sm:w-72">
            <FolderArchive className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18}/>
            <select className="w-full pl-12 pr-10 py-3.5 bg-slate-50 border border-transparent rounded-[1rem] outline-none focus:border-indigo-200 focus:bg-white focus:ring-4 focus:ring-indigo-500/5 cursor-pointer transition-all text-sm font-bold text-slate-700 appearance-none" value={filterKelas} onChange={(e) => setFilterKelas(e.target.value)}>
                <option value="">Semua {appConfig.labels?.label_unit || 'Divisi'}</option>
                {classesOption.map(c => (<option key={c.id} value={c.nama_kelas}>{c.nama_kelas}</option>))}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18}/>
        </div>
      </div>

      {/* --- TABLE VIEW (Desktop) --- */}
      <div className="hidden md:block bg-white rounded-[2rem] border border-slate-100 overflow-hidden shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)]">
        <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left whitespace-nowrap">
                <thead className="bg-slate-50/80 text-slate-500 font-extrabold text-[11px] uppercase tracking-widest border-b border-slate-100">
                    <tr>
                        <th className="py-5 px-6 w-12 text-center">
                            <button onClick={toggleSelectAll} className="hover:text-indigo-600 transition-colors">
                                {selectedIds.length === filteredStudents.length && filteredStudents.length > 0 ? <CheckSquare size={20} className="text-indigo-600"/> : <Square size={20}/>}
                            </button>
                        </th>
                        <th className="py-5 px-4 w-20">Foto</th>
                        <th className="py-5 px-4">Profil & {appConfig.labels?.label_unit || 'Divisi'}</th>
                        <th className="py-5 px-4">ID Registrasi</th>
                        <th className="py-5 px-6 text-right">Tindakan</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-sm">
                    {loading ? ( 
                        Array.from({length: 5}).map((_, i) => (
                            <tr key={i} className="animate-pulse">
                                <td className="p-6 text-center"><div className="h-5 w-5 bg-slate-200 rounded mx-auto"></div></td>
                                <td className="p-6"><div className="w-12 h-12 bg-slate-200 rounded-[14px]"></div></td>
                                <td className="p-6 space-y-2"><div className="h-4 w-40 bg-slate-200 rounded"></div><div className="h-3 w-16 bg-slate-200 rounded"></div></td>
                                <td className="p-6"><div className="h-4 w-24 bg-slate-200 rounded"></div></td>
                                <td className="p-6"><div className="h-8 w-16 bg-slate-200 rounded ml-auto"></div></td>
                            </tr>
                        ))
                    ) : filteredStudents.length === 0 ? ( 
                        <tr>
                            <td colSpan="5" className="py-16 text-center">
                                <Users size={40} className="text-slate-300 mx-auto mb-3" />
                                <div className="text-slate-500 font-bold text-base">Tidak ada data</div>
                                <p className="text-slate-400 text-xs mt-1">Coba sesuaikan pencarian Anda.</p>
                            </td>
                        </tr>
                    ) : ( 
                        filteredStudents.map((s) => (
                        <tr key={s.id} className={`hover:bg-indigo-50/40 transition-colors group ${selectedIds.includes(s.id) ? 'bg-indigo-50/60' : ''}`}>
                            <td className="py-4 px-6 text-center">
                                <button onClick={() => toggleSelectOne(s.id)} className="text-slate-300 hover:text-indigo-600 transition-colors">
                                    {selectedIds.includes(s.id) ? <CheckSquare size={20} className="text-indigo-600"/> : <Square size={20}/>}
                                </button>
                            </td>
                            <td className="py-4 px-4">
                                <div className="w-12 h-12 rounded-[14px] bg-slate-100 border border-slate-200 shadow-sm overflow-hidden flex items-center justify-center relative group-hover:border-indigo-200 transition-colors">
                                    {s.foto ? <img src={s.foto} className="w-full h-full object-cover" alt="Foto"/> : <span className="font-black text-slate-400 text-lg">{s.nama_lengkap.charAt(0).toUpperCase()}</span>}
                                </div>
                            </td>
                            <td className="py-4 px-4">
                                <div className="font-extrabold text-slate-800 text-[15px] group-hover:text-indigo-600 transition-colors">{s.nama_lengkap}</div>
                                <div className="mt-1.5 inline-flex items-center px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] rounded-md font-bold uppercase tracking-wider group-hover:bg-indigo-100 group-hover:text-indigo-700 transition-colors border border-slate-200/60">{s.kelas}</div>
                            </td>
                            <td className="py-4 px-4">
                                <div className="font-mono text-slate-700 font-bold bg-slate-50 inline-block px-2 py-1 rounded-lg border border-slate-100">{s.nipd}</div>
                                {s.nisn && <div className="text-[11px] font-semibold text-slate-400 mt-1">Ref: {s.nisn}</div>}
                            </td>
                            <td className="py-4 px-6 text-right">
                                <div className="flex justify-end gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                                    {appConfig.metode_absensi === 'BARCODE' && (
                                        <button onClick={() => handlePrintCard(s)} className="p-2 bg-white border border-slate-200 text-slate-600 hover:bg-violet-600 hover:text-white hover:border-violet-600 rounded-xl transition-all shadow-sm active:scale-95" title="Cetak Kartu"><QrCode size={18}/></button>
                                    )}
                                    <button onClick={() => openModal(s)} className="p-2 bg-white border border-slate-200 text-slate-600 hover:bg-blue-600 hover:text-white hover:border-blue-600 rounded-xl transition-all shadow-sm active:scale-95" title="Edit Data"><Edit size={18}/></button>
                                    <button onClick={() => confirmDeleteSingle(s)} className="p-2 bg-white border border-slate-200 text-slate-600 hover:bg-rose-600 hover:text-white hover:border-rose-600 rounded-xl transition-all shadow-sm active:scale-95" title="Hapus"><Trash2 size={18}/></button>
                                </div>
                            </td>
                        </tr>
                    )))}
                </tbody>
            </table>
        </div>
      </div>

      {/* --- FORM MODAL (Add/Edit) --- */}
      {showModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-[2rem] w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl relative flex flex-col transform animate-in zoom-in-95 duration-200">
                <div className="px-8 py-5 border-b border-slate-100 bg-white flex justify-between items-center shrink-0">
                    <div>
                        <h3 className="font-extrabold text-xl text-slate-800">{isEditMode ? `Edit Data ${appConfig.labels?.label_anggota || 'Anggota'}` : `Tambah ${appConfig.labels?.label_anggota || 'Anggota'} Baru`}</h3>
                        <p className="text-xs text-slate-500 mt-1 font-medium">Lengkapi form di bawah ini dengan benar.</p>
                    </div>
                    <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500"><X size={24}/></button>
                </div>
                
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 bg-slate-50/50 custom-scrollbar">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {/* Kolom Kiri: Foto */}
                        <div className="md:col-span-1 flex flex-col gap-3">
                            <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest">Foto Profil (Opsional)</label>
                            <div className="relative aspect-[3/4] w-full max-w-[180px] mx-auto rounded-[1.5rem] bg-white border-2 border-dashed border-slate-300 flex flex-col items-center justify-center overflow-hidden hover:bg-indigo-50 hover:border-indigo-400 transition-all cursor-pointer group shadow-sm">
                                {formData.foto ? (
                                    <div className="relative w-full h-full">
                                        <img src={formData.foto} className="w-full h-full object-cover" alt="Preview"/>
                                        <button type="button" onClick={handleRemovePhoto} className="absolute top-2 right-2 p-2 bg-rose-500 text-white rounded-xl shadow-lg z-10 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-600" title="Hapus Foto">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="text-center text-slate-400 group-hover:text-indigo-500 transition-colors p-4">
                                        <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:bg-indigo-100 transition-colors"><Upload size={24}/></div>
                                        <span className="text-xs font-bold">Upload Foto</span>
                                    </div>
                                )}
                                <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFileChange}/>
                            </div>
                        </div>

                        {/* Kolom Kanan: Input Form */}
                        <div className="md:col-span-2 space-y-5">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                <div>
                                    <label className="text-[11px] font-extrabold text-slate-500 mb-1.5 block uppercase tracking-widest">ID Pengguna <span className="text-rose-500">*</span></label>
                                    <input name="nipd" value={formData.nipd} onChange={handleInputChange} className="w-full border-2 border-slate-200 p-3 rounded-xl outline-none focus:border-indigo-500 transition-all bg-slate-50 focus:bg-white text-sm font-semibold text-slate-700" required placeholder="Contoh: 2024001"/>
                                </div>
                                <div>
                                    <label className="text-[11px] font-extrabold text-slate-500 mb-1.5 block uppercase tracking-widest">ID Referensi</label>
                                    <input name="nisn" value={formData.nisn} onChange={handleInputChange} className="w-full border-2 border-slate-200 p-3 rounded-xl outline-none focus:border-indigo-500 transition-all bg-slate-50 focus:bg-white text-sm font-semibold text-slate-700" placeholder="Opsional"/>
                                </div>
                            </div>

                            <div>
                                <label className="text-[11px] font-extrabold text-slate-500 mb-1.5 block uppercase tracking-widest">Nama Lengkap <span className="text-rose-500">*</span></label>
                                <input name="nama_lengkap" value={formData.nama_lengkap} onChange={handleInputChange} className="w-full border-2 border-slate-200 p-3 rounded-xl outline-none focus:border-indigo-500 transition-all bg-slate-50 focus:bg-white text-sm font-semibold text-slate-700" required placeholder="Nama lengkap anggota..."/>
                            </div>

                            <div>
                                <label className="text-[11px] font-extrabold text-slate-500 mb-1.5 block uppercase tracking-widest">{appConfig.labels?.label_unit || 'Divisi'} <span className="text-rose-500">*</span></label>
                                {renderClassInput()}
                            </div>

                            {appConfig.metode_absensi !== 'MANUAL' && (
                                <div>
                                    <label className="text-[11px] font-extrabold text-slate-500 mb-1.5 block uppercase tracking-widest flex items-center gap-1.5">
                                        {appConfig.metode_absensi === 'FINGERPRINT' ? <Fingerprint size={14}/> : <ScanLine size={14}/>} 
                                        {appConfig.metode_absensi === 'FINGERPRINT' ? "ID Mesin Fingerprint" : "UID Kartu / Barcode"}
                                    </label>
                                    <div className="flex gap-2">
                                        <input name="kode_rfid" value={formData.kode_rfid} onChange={handleInputChange} className="w-full border-2 border-indigo-100 p-3 rounded-xl font-mono bg-indigo-50/30 outline-none focus:border-indigo-500 focus:bg-white text-sm font-bold text-slate-700 transition-all" placeholder="Scan kartu atau ketik ID..." autoFocus={!isEditMode} />
                                        <button type="button" onClick={handleGenerateID} className="px-4 bg-slate-100 rounded-xl border border-slate-200 hover:bg-slate-200 transition-colors text-slate-600 font-bold" title="Buat Kode Acak"><RotateCcw size={20}/></button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </form>
                
                <div className="px-8 py-5 border-t border-slate-100 bg-white shrink-0 flex justify-end gap-3">
                    <button onClick={() => setShowModal(false)} className="px-6 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-colors text-sm">Batal</button>
                    <button onClick={handleSubmit} disabled={btnLoading} className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-md shadow-indigo-200 transition-all active:scale-95 flex items-center gap-2 text-sm disabled:opacity-70">
                        {btnLoading ? <Activity size={18} className="animate-spin" /> : <Save size={18}/>} 
                        {btnLoading ? 'Menyimpan...' : 'Simpan Data'}
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* --- MODAL KONFIRMASI HAPUS --- */}
      {confirmModal.show && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-white rounded-[2rem] p-8 max-w-sm w-full shadow-2xl text-center transform animate-in zoom-in-95 duration-200 border border-white">
                  <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-[1.5rem] flex items-center justify-center mx-auto mb-6 rotate-3">
                      <AlertTriangle size={36} />
                  </div>
                  <h3 className="text-xl font-black text-slate-800 tracking-tight">Hapus Data?</h3>
                  <p className="text-[14px] text-slate-500 mt-2 mb-8 leading-relaxed font-medium">
                      Anda akan menghapus <b>{confirmModal.name || `${confirmModal.count} ${appConfig.labels?.label_anggota || 'Anggota'}`}</b>. Data yang dihapus tidak dapat dikembalikan.
                  </p>
                  <div className="flex gap-3">
                      <button onClick={() => setConfirmModal({ show: false })} className="flex-1 py-3.5 bg-slate-100 text-slate-700 rounded-2xl font-bold hover:bg-slate-200 transition-colors">Batal</button>
                      <button onClick={executeDelete} disabled={btnLoading} className="flex-1 py-3.5 bg-rose-500 text-white rounded-2xl font-bold hover:bg-rose-600 shadow-lg shadow-rose-200 transition-all active:scale-95">
                          {btnLoading ? 'Memproses...' : 'Ya, Hapus'}
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* --- MODAL IMPORT --- */}
      {showImportModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-[2rem] w-full max-w-2xl overflow-hidden shadow-2xl relative transform animate-in zoom-in-95 duration-200">
                <button onClick={() => setShowImportModal(false)} className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 bg-slate-100 rounded-full p-2 transition-colors"><X size={20}/></button>
                <div className="px-8 py-6 border-b border-slate-100 bg-white flex items-center gap-4">
                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-[1rem]"><Upload size={24}/></div>
                    <div>
                        <h3 className="font-extrabold text-xl text-slate-800">Import Data Masal</h3>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">Unggah data Excel atau file ZIP foto secara instan.</p>
                    </div>
                </div>
                <div className="p-8 bg-slate-50/50">
                    <input type="file" ref={fileInputExcelRef} className="hidden" accept=".xlsx,.xls" onChange={handleExcelUpload}/>
                    <input type="file" ref={fileInputZipRef} className="hidden" accept=".zip" onChange={handleZipUpload}/>
                    
                    {importProgress.show ? (
                        <div className="text-center py-10 space-y-4 bg-white rounded-[2rem] border border-slate-100 shadow-sm">
                            <div className="text-6xl font-black text-indigo-600 animate-pulse">{Math.round((importProgress.current/importProgress.total)*100)}%</div>
                            <p className="text-slate-500 font-bold">Memproses Data ({importProgress.current}/{importProgress.total})</p>
                            <div className="w-2/3 mx-auto bg-slate-100 rounded-full h-3 overflow-hidden">
                                <div className="bg-indigo-600 h-full rounded-full transition-all duration-300" style={{width: `${(importProgress.current/importProgress.total)*100}%`}}></div>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="group bg-white border-2 border-dashed border-slate-200 p-8 flex flex-col items-center justify-center rounded-[2rem] cursor-pointer hover:bg-emerald-50/50 hover:border-emerald-400 hover:shadow-md transition-all duration-300" onClick={() => fileInputExcelRef.current.click()}>
                                <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-[1.25rem] flex items-center justify-center mb-5 group-hover:bg-emerald-100 group-hover:text-emerald-600 group-hover:-translate-y-2 transition-all duration-300"><FileSpreadsheet size={32}/></div>
                                <h4 className="font-extrabold text-slate-800 text-lg">Data {appConfig.labels?.label_anggota || 'Anggota'} (Excel)</h4>
                                <p className="text-xs text-slate-400 font-medium mt-1">Gunakan format .xlsx</p>
                                <button onClick={(e)=>{e.stopPropagation();handleDownloadTemplate()}} className="mt-6 text-xs font-bold text-emerald-600 bg-white border border-emerald-200 px-5 py-2.5 rounded-xl hover:bg-emerald-50 transition-colors w-full">Download Template</button>
                            </div>
                            
                            <div className="group bg-white border-2 border-dashed border-slate-200 p-8 flex flex-col items-center justify-center rounded-[2rem] cursor-pointer hover:bg-blue-50/50 hover:border-blue-400 hover:shadow-md transition-all duration-300" onClick={() => fileInputZipRef.current.click()}>
                                <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-[1.25rem] flex items-center justify-center mb-5 group-hover:bg-blue-100 group-hover:text-blue-600 group-hover:-translate-y-2 transition-all duration-300"><FolderArchive size={32}/></div>
                                <h4 className="font-extrabold text-slate-800 text-lg">Foto Profil (ZIP)</h4>
                                <p className="text-xs text-slate-400 font-medium mt-1 text-center">Beri nama file foto sesuai dengan ID Registrasi Pengguna.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
      )}

      {/* PANGGIL KOMPONEN PRINT MODAL */}
      <PrintCardModal 
          show={printModalConfig.show} 
          onClose={() => setPrintModalConfig({ show: false, isBulk: false, data: null })} 
          data={printModalConfig.data} 
          config={appConfig} 
          isBulk={printModalConfig.isBulk} 
      />

    </div>
  );
};

export default Students;