import React, { useState, useEffect } from 'react';
import {
  Plus, Search, Trash2, Edit, Users, Save, X, Eye, ArrowLeft, CheckCircle, AlertCircle, CheckSquare, Square, UserMinus, AlertTriangle, RefreshCcw, Briefcase, Building2, FolderTree
} from 'lucide-react';
import api from '../../api/axios';
import logoNabastala from '../../assets/logo-nabastala.png';

const Classes = () => {
  // --- STATE ---
  const [divisionsList, setDivisionsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [btnLoading, setBtnLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [memberSearchTerm, setMemberSearchTerm] = useState("");

  // State Selection
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);

  // Modal States
  const [showFormModal, setShowFormModal] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ show: false, type: '', id: null, count: 0, name: '' });

  // Edit & Form Data
  const [isEditMode, setIsEditMode] = useState(false);
  const [editId, setEditId] = useState(null);
  const [formData, setFormData] = useState({ nama_kelas: '', wali_kelas: '' });

  // Detail Data
  const [selectedDivision, setSelectedDivision] = useState(null);
  const [divisionMembers, setDivisionMembers] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: 'nama_lengkap', direction: 'asc' });
  const [mainSortConfig, setMainSortConfig] = useState({ key: 'nama_kelas', direction: 'asc' });

  const [notification, setNotification] = useState({ show: false, type: '', message: '' });

  // States untuk fitur tambah anggota masal (Permasalahan 4)
  const [showAddMembersModal, setShowAddMembersModal] = useState(false);
  const [unassignedMembers, setUnassignedMembers] = useState([]);
  const [selectedAddMemberIds, setSelectedAddMemberIds] = useState([]);
  const [addMemberSearchTerm, setAddMemberSearchTerm] = useState("");

  // Config 
  const [appConfig, setAppConfig] = useState({
    nama_instansi: 'INSTANSI',
    labels: { label_pengguna: 'Pengguna', label_kelompok: 'Kelompok' },
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
      setLoading(false);
    } catch {
      setLoading(false);
    }
  };

  const fetchDivisionMembers = async (divName) => {
    try {
      const resMembers = await api.get('/members');
      const allMembers = Array.isArray(resMembers.data) ? resMembers.data.filter(s => s.kelas === divName) : [];
      setDivisionMembers(allMembers);
      setSelectedMemberIds([]); // reset selection
    } catch (error) {
      showToast('error', "Gagal memuat data pengguna.");
    }
  };

  // --- FILTER & SELECTION ---
  const filteredDivisions = divisionsList.filter(c => c.nama_kelas.toLowerCase().includes(searchTerm.toLowerCase())).sort((a, b) => {
    let valA = a[mainSortConfig.key] || "";
    let valB = b[mainSortConfig.key] || "";

    if (mainSortConfig.key === 'jumlah_siswa') {
      valA = parseInt(valA) || 0;
      valB = parseInt(valB) || 0;
    } else {
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
    }

    if (valA < valB) return mainSortConfig.direction === 'asc' ? -1 : 1;
    if (valA > valB) return mainSortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const handleMainSort = (key) => {
    let direction = 'asc';
    if (mainSortConfig.key === key && mainSortConfig.direction === 'asc') direction = 'desc';
    setMainSortConfig({ key, direction });
  };

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

  // Members selection
  const filteredMembers = divisionMembers.filter(m => m.nama_lengkap.toLowerCase().includes(memberSearchTerm.toLowerCase()));

  const toggleSelectAllMembers = () => {
    if (selectedMemberIds.length === filteredMembers.length) {
      setSelectedMemberIds([]);
    } else {
      setSelectedMemberIds(filteredMembers.map(m => m.id));
    }
  };

  const toggleSelectOneMember = (id) => {
    if (selectedMemberIds.includes(id)) {
      setSelectedMemberIds(selectedMemberIds.filter(sid => sid !== id));
    } else {
      setSelectedMemberIds([...selectedMemberIds, id]);
    }
  };

  // Fungsi-fungsi untuk fitur tambah anggota masal (Permasalahan 4)
  const fetchUnassignedMembers = async () => {
    try {
      const res = await api.get('/members');
      // filter members who do not have division_id or kelas
      const all = res.data?.data || res.data || [];
      const unassigned = all.filter(m => !m.kelas && !m.division_id);
      setUnassignedMembers(unassigned);
      setSelectedAddMemberIds([]);
    } catch (e) {
      showToast('error', "Gagal memuat daftar pengguna tanpa kelompok.");
    }
  };

  const openAddMembersModal = () => {
    fetchUnassignedMembers();
    setShowAddMembersModal(true);
  };

  const toggleSelectAllAddMembers = () => {
    const filtered = unassignedMembers.filter(m => m.nama_lengkap.toLowerCase().includes(addMemberSearchTerm.toLowerCase()));
    if (selectedAddMemberIds.length === filtered.length) {
      setSelectedAddMemberIds([]);
    } else {
      setSelectedAddMemberIds(filtered.map(m => m.id));
    }
  };

  const toggleSelectOneAddMember = (id) => {
    if (selectedAddMemberIds.includes(id)) {
      setSelectedAddMemberIds(selectedAddMemberIds.filter(sid => sid !== id));
    } else {
      setSelectedAddMemberIds([...selectedAddMemberIds, id]);
    }
  };

  const handleAddMembersSubmit = async () => {
    if (selectedAddMemberIds.length === 0) {
      showToast('error', "Pilih minimal 1 anggota!");
      return;
    }
    setBtnLoading(true);
    try {
      await Promise.all(selectedAddMemberIds.map(async (memberId) => {
        const memberObj = unassignedMembers.find(m => m.id === memberId);
        if (memberObj) {
          const payload = {
            ...memberObj,
            division_id: selectedDivision.id,
            kelas: selectedDivision.nama_kelas
          };
          await api.put(`/members/${memberId}`, payload);
        }
      }));
      showToast('success', "Anggota berhasil ditambahkan!");
      setShowAddMembersModal(false);
      fetchDivisionMembers(selectedDivision.nama_kelas);
      fetchDivisions();
    } catch (e) {
      showToast('error', "Gagal menambahkan anggota.");
    } finally {
      setBtnLoading(false);
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
    setMemberSearchTerm("");
    fetchDivisionMembers(div.nama_kelas);
  };

  const handleBackToDivisions = () => {
    setSelectedDivision(null);
    setSelectedMemberIds([]);
  };

  const handleSubmitDivision = async (e) => {
    e.preventDefault();
    setBtnLoading(true);
    try {
      if (isEditMode) {
        await api.put(`/divisions/${editId}`, formData);
        showToast('success', "Data berhasil diperbarui!");
      } else {
        await api.post('/divisions', formData);
        showToast('success', "Kelompok baru ditambahkan!");
      }
      setShowFormModal(false);
      fetchDivisions();
    } catch {
      showToast('error', "Gagal menyimpan data.");
    } finally {
      setBtnLoading(false);
    }
  };

  const validateDelete = (div) => {
    if (parseInt(div.jumlah_siswa) > 0) {
      showToast('error', `Gagal! "${div.nama_kelas}" masih memiliki ${div.jumlah_siswa} pengguna.`);
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
      showToast('error', `${rejectedCount} data dilewati karena masih ada penggunanya.`);
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
      showToast('success', "Data berhasil dihapus!");
      fetchDivisions();
    } catch {
      showToast('error', "Terjadi kesalahan saat menghapus data.");
    } finally {
      setBtnLoading(false);
      setConfirmModal({ show: false, type: '', id: null, name: '', count: 0 });
    }
  };

  // --- SORTING LOGIC FOR MEMBERS ---
  const sortData = (data) => {
    return [...data].sort((a, b) => {
      let valA = a[sortConfig.key] || "";
      let valB = b[sortConfig.key] || "";
      if (sortConfig.key === 'id') {
        valA = a.nipd || a.nisn || "";
        valB = b.nipd || b.nisn || "";
      }

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const sortedMembers = sortData(filteredMembers);

  const handleKickMemberSingle = async (member) => {
    if (!window.confirm(`Keluarkan ${member.nama_lengkap} dari kelompok ini?`)) return;
    try {
      await api.put(`/members/${member.id}`, { ...member, kelas: '', division_id: null, division_name: '' });
      showToast('success', "Pengguna berhasil dikeluarkan.");
      fetchDivisionMembers(selectedDivision.nama_kelas);
      fetchDivisions();
    } catch { showToast('error', "Gagal mengeluarkan pengguna."); }
  };

  const handleKickMemberBulk = async () => {
    if (!window.confirm(`Keluarkan ${selectedMemberIds.length} pengguna yang dipilih dari kelompok ini?`)) return;
    setBtnLoading(true);
    try {
      await Promise.all(selectedMemberIds.map(id => {
        const member = divisionMembers.find(m => m.id === id);
        return api.put(`/members/${id}`, { ...member, kelas: '', division_id: null, division_name: '' });
      }));
      showToast('success', `${selectedMemberIds.length} pengguna berhasil dikeluarkan.`);
      fetchDivisionMembers(selectedDivision.nama_kelas);
      fetchDivisions();
    } catch {
      showToast('error', "Gagal mengeluarkan pengguna.");
    } finally {
      setBtnLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-20 md:pb-0 relative h-full font-sans flex flex-col">

      {notification.show && (
        <div className={`fixed top-4 right-4 z-[99] flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl animate-in slide-in-from-right fade-in duration-300 border bg-white dark:bg-slate-800 ${notification.type === 'success' ? 'border-green-200 dark:border-green-800 text-green-700 dark:text-green-300' : 'border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'}`}>
          {notification.type === 'success' ? <CheckCircle size={22} className="text-green-500" /> : <AlertCircle size={22} className="text-red-500" />}
          <div><h4 className="font-bold text-sm">{notification.type === 'success' ? 'Berhasil' : 'Gagal'}</h4><p className="text-xs text-gray-500">{notification.message}</p></div>
          <button onClick={() => setNotification({ show: false })}><X size={18} className="text-gray-400" /></button>
        </div>
      )}

      {/* --- VIEWS --- */}
      {!selectedDivision ? (
        // ==============================================
        // DIVISIONS VIEW
        // ==============================================
        <>
          {/* HEADER CARD */}
          <div className="relative bg-white dark:bg-slate-800 p-6 rounded-[2rem] shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50/50 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-50/50 rounded-full blur-2xl -ml-10 -mb-10 pointer-events-none"></div>

            <div className="relative z-10">
              <h2 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
                <Building2 className="text-indigo-600" size={32} />
                Kelompok
              </h2>
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Kelola daftar kelompok.</p>
            </div>

            <div className="relative z-10 flex flex-col sm:flex-row w-full md:w-auto gap-3">
              {selectedIds.length > 0 && (
                <button onClick={confirmDeleteBulk} className="flex items-center justify-center gap-2 bg-red-100 text-red-600 px-5 py-2.5 rounded-xl hover:bg-red-200 transition text-sm font-bold animate-in fade-in" title="Hapus Terpilih">
                  <Trash2 size={18} /> <span>Hapus ({selectedIds.length})</span>
                </button>
              )}
              <div className="relative flex-1 md:w-64 group">
                <Search className="absolute left-3 top-3 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                <input type="text" placeholder={`Cari ${appConfig.labels?.label_kelompok || 'Kelompok'}...`} className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 text-sm transition-all text-slate-700 dark:text-slate-200" onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
              <button onClick={handleOpenAdd} className="flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-xl hover:bg-blue-700 transition shadow-lg shadow-blue-200 text-sm font-bold active:scale-95">
                <Plus size={18} /> <span>Tambah</span>
              </button>
            </div>
          </div>

          {/* TABEL DATA UTAMA */}
          <div className="bg-white dark:bg-slate-800 rounded-[2rem] shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden flex-1 flex flex-col min-h-0">
            <div className="overflow-auto flex-1 custom-scrollbar">
              <table className="w-full text-left whitespace-nowrap">
                <thead className="bg-slate-50/80 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 font-extrabold text-[11px] uppercase tracking-widest sticky top-0 z-10 border-b border-slate-100 dark:border-slate-700">
                  <tr>
                    <th className="p-6 w-10 text-center">
                      <button onClick={toggleSelectAll} className="hover:text-blue-600 transition-colors" title="Pilih Semua">
                        {selectedIds.length === filteredDivisions.length && filteredDivisions.length > 0 ? <CheckSquare size={20} className="text-blue-600" /> : <Square size={20} />}
                      </button>
                    </th>
                    <th className="p-6 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors" onClick={() => handleMainSort('nama_kelas')}>
                      Nama {appConfig.labels?.label_kelompok || 'Kelompok'} {mainSortConfig.key === 'nama_kelas' ? (mainSortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                    </th>
                    <th className="p-6 hidden md:table-cell cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors" onClick={() => handleMainSort('wali_kelas')}>
                      Penanggung Jawab {mainSortConfig.key === 'wali_kelas' ? (mainSortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                    </th>
                    <th className="p-6 text-center cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors" onClick={() => handleMainSort('jumlah_siswa')}>
                      Total {appConfig.labels?.label_pengguna || 'Pengguna'} {mainSortConfig.key === 'jumlah_siswa' ? (mainSortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                    </th>
                    <th className="p-6 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-700/50 text-sm">
                  {loading ? (<tr><td colSpan="5" className="p-20 text-center text-gray-400 animate-pulse font-medium">Memuat data...</td></tr>)
                    : filteredDivisions.length === 0 ? (<tr><td colSpan="5" className="p-20 text-center text-gray-400"><Search size={48} className="mx-auto opacity-10 mb-2" /><p>Tidak ada data ditemukan.</p></td></tr>)
                      : (filteredDivisions.map((div) => (
                        <tr key={div.id} className={`hover:bg-indigo-50/40 dark:hover:bg-slate-700/50 transition-colors group ${selectedIds.includes(div.id) ? 'bg-indigo-50/60 dark:bg-slate-700/50' : ''}`}>
                          <td className="p-6 text-center">
                            <button onClick={() => toggleSelectOne(div.id)} className="text-slate-300 hover:text-indigo-600 transition-colors">
                              {selectedIds.includes(div.id) ? <CheckSquare size={20} className="text-indigo-600" /> : <Square size={20} />}
                            </button>
                          </td>
                          <td className="p-6">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center shadow-sm text-slate-500 dark:text-slate-300">
                                <Briefcase size={20} />
                              </div>
                              <div>
                                <span className="font-bold text-slate-800 dark:text-slate-200 block text-[14px] group-hover:text-indigo-600 transition-colors">{div.nama_kelas}</span>
                                <span className="md:hidden text-xs text-slate-400 font-medium">{div.wali_kelas || 'Kosong'}</span>
                              </div>
                            </div>
                          </td>
                          <td className="p-6 text-slate-600 dark:text-slate-300 hidden md:table-cell font-medium text-[14px]">{div.wali_kelas || <span className="text-gray-300 dark:text-slate-500 italic font-normal">Belum diatur</span>}</td>
                          <td className="p-6 text-center">
                            <span className={`px-4 py-1.5 rounded-full text-xs font-medium inline-flex items-center gap-2 ${div.jumlah_siswa > 0 ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800' : 'bg-slate-50 dark:bg-slate-700 text-slate-400 border border-slate-100 dark:border-slate-600'}`}>
                              <Users size={14} /> {div.jumlah_siswa || 0} Orang
                            </span>
                          </td>
                          <td className="p-6">
                            <div className="flex justify-center gap-2">
                              <button onClick={() => handleDetailClick(div)} className="p-2 bg-white dark:bg-slate-700 border border-slate-100 dark:border-slate-600 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-600 rounded-lg transition-all shadow-sm" title="Lihat Pengguna"><Eye size={18} /></button>
                              <button onClick={() => handleOpenEdit(div)} className="p-2 bg-white dark:bg-slate-700 border border-slate-100 dark:border-slate-600 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-600 rounded-lg transition-all shadow-sm" title="Edit"><Edit size={18} /></button>
                              <button onClick={() => confirmDeleteSingle(div)} className={`p-2 bg-white dark:bg-slate-700 border border-slate-100 dark:border-slate-600 rounded-lg transition-all shadow-sm ${div.jumlah_siswa > 0 ? 'text-gray-300 cursor-not-allowed' : 'text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-slate-600'}`} title="Hapus"><Trash2 size={18} /></button>
                            </div>
                          </td>
                        </tr>
                      )))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        // ==============================================
        // MEMBERS VIEW (INLINE)
        // ==============================================
        <>
          {/* HEADER CARD MEMBERS */}
          <div className="relative bg-white dark:bg-slate-800 p-6 rounded-[2rem] shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0 animate-in fade-in slide-in-from-right-4">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/50 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>

            <div className="relative z-10 flex items-center gap-4">
              <button onClick={handleBackToDivisions} className="p-2.5 bg-gray-50 dark:bg-slate-700 hover:bg-gray-100 dark:hover:bg-slate-600 text-gray-500 dark:text-slate-300 rounded-xl transition-all shadow-sm active:scale-95" title="Kembali">
                <ArrowLeft size={20} />
              </button>
              <div>
                <h2 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
                  <Users size={28} className="text-indigo-600" /> Pengguna {selectedDivision.nama_kelas}
                </h2>
                <p className="text-xs text-gray-500 dark:text-slate-400 font-medium uppercase tracking-widest mt-1">Total: <span className="text-indigo-600 font-bold">{divisionMembers.length} {appConfig.labels?.label_pengguna || 'Pengguna'}</span></p>
              </div>
            </div>

            <div className="relative z-10 flex flex-col sm:flex-row w-full md:w-auto gap-3">
              {selectedMemberIds.length > 0 && (
                <button onClick={handleKickMemberBulk} disabled={btnLoading} className="flex items-center justify-center gap-2 bg-red-100 text-red-600 px-5 py-2.5 rounded-xl hover:bg-red-200 transition text-sm font-bold animate-in fade-in" title="Keluarkan Terpilih">
                  {btnLoading ? <RefreshCcw size={18} className="animate-spin" /> : <UserMinus size={18} />}
                  <span>Keluarkan ({selectedMemberIds.length})</span>
                </button>
              )}
              <div className="relative flex-1 md:w-64 group">
                <Search className="absolute left-3 top-3 text-gray-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                <input type="text" placeholder={`Cari Pengguna...`} className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 text-sm transition-all text-slate-700 dark:text-slate-200" value={memberSearchTerm} onChange={(e) => setMemberSearchTerm(e.target.value)} />
              </div>
              <button onClick={openAddMembersModal} className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl transition text-sm font-bold active:scale-95 shadow-lg shadow-indigo-200">
                <Plus size={18} /> <span>Tambah Anggota</span>
              </button>
            </div>
          </div>

          {/* TABEL DATA MEMBERS */}
          <div className="bg-white dark:bg-slate-800 rounded-[2rem] shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden flex-1 flex flex-col min-h-0 animate-in fade-in slide-in-from-right-4">
            <div className="overflow-auto flex-1 custom-scrollbar">
              <table className="w-full text-left whitespace-nowrap">
                <thead className="bg-slate-50/80 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 font-extrabold text-[11px] uppercase tracking-widest sticky top-0 z-10 border-b border-slate-100 dark:border-slate-700">
                  <tr>
                    <th className="py-5 px-4 w-10 text-center">
                      <button onClick={toggleSelectAllMembers} className="hover:text-indigo-600 transition-colors" title="Pilih Semua">
                        {selectedMemberIds.length === filteredMembers.length && filteredMembers.length > 0 ? <CheckSquare size={20} className="text-indigo-600" /> : <Square size={20} />}
                      </button>
                    </th>
                    <th className="py-5 px-4 w-20">Foto</th>
                    <th className="py-5 px-4 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors" onClick={() => handleSort('nama_lengkap')}>
                      Nama Lengkap {sortConfig.key === 'nama_lengkap' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                    </th>
                    <th className="py-5 px-4 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors hidden md:table-cell" onClick={() => handleSort('id')}>
                      ID Pengguna {sortConfig.key === 'id' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                    </th>
                    <th className="py-5 px-6 text-right">Tindakan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-700/50 text-sm">
                  {sortedMembers.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="p-20 text-center text-gray-400">
                        <Users size={48} className="mx-auto opacity-10 mb-2" />
                        <p>Tidak ada pengguna ditemukan.</p>
                      </td>
                    </tr>
                  ) : (
                    sortedMembers.map((m) => (
                      <tr key={m.id} className={`hover:bg-indigo-50/40 dark:hover:bg-slate-700/50 transition-colors group ${selectedMemberIds.includes(m.id) ? 'bg-indigo-50/60 dark:bg-slate-700/50' : ''}`}>
                        <td className="py-4 px-6 text-center">
                          <button onClick={() => toggleSelectOneMember(m.id)} className="text-slate-300 hover:text-indigo-600 transition-colors">
                            {selectedMemberIds.includes(m.id) ? <CheckSquare size={20} className="text-indigo-600" /> : <Square size={20} />}
                          </button>
                        </td>
                        <td className="py-4 px-4">
                          <div className="w-12 h-12 rounded-[14px] bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 shadow-sm overflow-hidden flex items-center justify-center relative group-hover:border-indigo-200 transition-colors">
                            {m.foto ? <img src={m.foto} className="w-full h-full object-cover" alt="Foto" /> : <span className="font-black text-slate-400 text-lg">{m.nama_lengkap.charAt(0).toUpperCase()}</span>}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="font-bold text-slate-800 dark:text-slate-200 text-[14px] group-hover:text-indigo-600 transition-colors">{m.nama_lengkap}</div>
                          <div className="text-xs text-gray-400 font-medium mt-1 md:hidden font-mono">{m.nipd} {m.nisn ? `(ID Opsional: ${m.nisn})` : ''}</div>
                        </td>
                        <td className="py-4 px-4 hidden md:table-cell">
                          <div className="font-medium text-slate-600 dark:text-slate-300 text-[14px]">{m.nipd || '-'}</div>
                          {m.nisn && <div className="text-[11px] font-medium text-slate-400 mt-1">ID Opsional: {m.nisn}</div>}
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className="flex justify-end gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleKickMemberSingle(m)} className="p-2 bg-white dark:bg-slate-700 border border-rose-200 dark:border-rose-900/50 text-rose-500 hover:bg-rose-600 hover:text-white hover:border-rose-600 rounded-xl transition-all shadow-sm active:scale-95" title="Keluarkan">
                              <UserMinus size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* MODAL FORM ADD/EDIT */}
      {showFormModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 dark:bg-slate-900/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-[1.5rem] w-full max-w-md shadow-2xl relative overflow-hidden">
            <div className="px-6 py-4 border-b dark:border-slate-700 bg-gray-50 dark:bg-slate-800 flex justify-between items-center">
              <h3 className="font-extrabold text-xl text-gray-800 dark:text-white">{isEditMode ? 'Edit Kelompok' : 'Tambah Kelompok Baru'}</h3>
              <button onClick={() => setShowFormModal(false)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-full"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmitDivision} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Nama {appConfig.labels?.label_kelompok || 'Kelompok'}</label>
                <input className="w-full border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 outline-none bg-white dark:bg-slate-800 focus:bg-slate-50 dark:focus:bg-slate-700 transition-all font-medium text-sm text-slate-800 dark:text-slate-200" placeholder="Contoh: Staff IT / Finance" value={formData.nama_kelas} onChange={e => setFormData({ ...formData, nama_kelas: e.target.value })} required />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Penanggung Jawab</label>
                <input className="w-full border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 outline-none bg-white dark:bg-slate-800 focus:bg-slate-50 dark:focus:bg-slate-700 transition-all font-medium text-sm text-slate-800 dark:text-slate-200" placeholder="Nama..." value={formData.wali_kelas} onChange={e => setFormData({ ...formData, wali_kelas: e.target.value })} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowFormModal(false)} className="flex-1 py-2.5 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-slate-600 transition text-sm">Batal</button>
                <button type="submit" disabled={btnLoading} className="flex-[2] py-2.5 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition active:scale-95 flex justify-center gap-2 items-center text-sm">
                  {btnLoading ? <RefreshCcw size={16} className="animate-spin" /> : <Save size={16} />}
                  {isEditMode ? 'Simpan' : 'Tambah'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI HAPUS (DIVISIONS) */}
      {confirmModal.show && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/40 dark:bg-slate-900/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-8 max-w-sm w-full shadow-2xl text-center">
            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-white">Hapus Data?</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 mb-6 leading-relaxed">
              {confirmModal.type === 'SINGLE'
                ? <>Anda akan menghapus <b>{confirmModal.name}</b>.</>
                : <>Anda akan menghapus <b>{confirmModal.count} item</b> yang dipilih.</>
              }
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmModal({ show: false, id: null })} className="flex-1 py-2.5 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-slate-600 transition text-sm">Batal</button>
              <button onClick={executeDelete} disabled={btnLoading} className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 shadow-lg shadow-red-200 transition flex justify-center items-center text-sm">
                {btnLoading ? <RefreshCcw size={16} className="animate-spin" /> : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TAMBAH ANGGOTA MASAL (Permasalahan 4) */}
      {showAddMembersModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 dark:bg-slate-900/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-[2rem] w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-2xl relative flex flex-col transform animate-in zoom-in-95 duration-200 border border-white dark:border-slate-700">
            <div className="px-8 py-5 border-b dark:border-slate-700 bg-gray-50 dark:bg-slate-800 flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-extrabold text-xl text-gray-800 dark:text-white">Tambah Anggota ke {selectedDivision?.nama_kelas}</h3>
                <p className="text-xs text-slate-500 mt-1">Pilih pengguna terdaftar yang belum memiliki kelompok.</p>
              </div>
              <button onClick={() => setShowAddMembersModal(false)} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-full"><X size={20} /></button>
            </div>

            <div className="p-4 bg-white dark:bg-slate-800 border-b dark:border-slate-700 shrink-0">
              <div className="relative group">
                <Search className="absolute left-3 top-3 text-gray-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                <input type="text" placeholder="Cari nama pengguna..." className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-transparent rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 text-sm transition-all text-slate-700 dark:text-slate-200" value={addMemberSearchTerm} onChange={(e) => setAddMemberSearchTerm(e.target.value)} />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-slate-50/50 dark:bg-slate-800/50">
              <table className="w-full text-left whitespace-nowrap">
                <thead className="bg-slate-100/80 dark:bg-slate-700/80 text-slate-500 dark:text-slate-400 font-extrabold text-[10px] uppercase tracking-widest sticky top-0 z-10 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="py-3 px-4 w-10 text-center">
                      <button onClick={toggleSelectAllAddMembers} className="hover:text-indigo-600 transition-colors">
                        {selectedAddMemberIds.length === unassignedMembers.filter(m => m.nama_lengkap.toLowerCase().includes(addMemberSearchTerm.toLowerCase())).length && unassignedMembers.filter(m => m.nama_lengkap.toLowerCase().includes(addMemberSearchTerm.toLowerCase())).length > 0 ? <CheckSquare size={18} className="text-indigo-600" /> : <Square size={18} />}
                      </button>
                    </th>
                    <th className="py-3 px-4">Nama Lengkap</th>
                    <th className="py-3 px-4">ID Registrasi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-700/50 text-sm">
                  {unassignedMembers.filter(m => m.nama_lengkap.toLowerCase().includes(addMemberSearchTerm.toLowerCase())).length === 0 ? (
                    <tr>
                      <td colSpan="3" className="p-10 text-center text-gray-400">
                        <Users size={36} className="mx-auto opacity-10 mb-2" />
                        <p className="text-xs">Tidak ada pengguna tanpa kelompok ditemukan.</p>
                      </td>
                    </tr>
                  ) : (
                    unassignedMembers.filter(m => m.nama_lengkap.toLowerCase().includes(addMemberSearchTerm.toLowerCase())).map((m) => (
                      <tr key={m.id} className={`hover:bg-indigo-50/40 dark:hover:bg-slate-700/40 transition-colors ${selectedAddMemberIds.includes(m.id) ? 'bg-indigo-50/60 dark:bg-slate-700/50' : ''}`}>
                        <td className="py-3 px-4 text-center">
                          <button onClick={() => toggleSelectOneAddMember(m.id)} className="text-slate-300 hover:text-indigo-600 transition-colors">
                            {selectedAddMemberIds.includes(m.id) ? <CheckSquare size={18} className="text-indigo-600" /> : <Square size={18} />}
                          </button>
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-200">{m.nama_lengkap}</td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400 font-mono text-xs">{m.nipd}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="px-8 py-5 border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 shrink-0 flex justify-end gap-3">
              <button onClick={() => setShowAddMembersModal(false)} className="px-6 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-colors text-sm">Batal</button>
              <button onClick={handleAddMembersSubmit} disabled={btnLoading} className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-md shadow-indigo-200 transition-all active:scale-95 flex items-center gap-2 text-sm disabled:opacity-70">
                {btnLoading ? <RefreshCcw size={16} className="animate-spin" /> : <Save size={16} />}
                Masukkan ke Kelompok ({selectedAddMemberIds.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Classes;