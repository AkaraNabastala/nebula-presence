import React, { useState, useEffect, useRef } from 'react';
import {
    Plus, Upload, Search, Trash2, Edit, X, Save,
    Printer, Users, CheckCircle, AlertCircle,
    CheckSquare, Square, FolderArchive, RotateCcw, IdCard,
    AlertTriangle, Fingerprint, ScanLine, FileSpreadsheet,
    ChevronDown, Activity, QrCode, Camera, CheckCircle2, Loader2,
    Phone, Send, Copy, MessageCircle, ExternalLink, GraduationCap
} from 'lucide-react';

import api from '../api/axios';

import { extractFaceDescriptor } from '../../backend/utils/faceRecognition';
const PrintCardModal = React.lazy(() => import('./PrintCardModal'));

const Students = () => {
    const [faceScanning, setFaceScanning] = useState(false);
    const [showCameraModal, setShowCameraModal] = useState(false);
    const cameraVideoRef = useRef(null);
    const cameraStreamRef = useRef(null);

    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterKelas, setFilterKelas] = useState("");
    const [sortConfig, setSortConfig] = useState({ key: 'nama_lengkap', direction: 'asc' });
    const [classesOption, setClassesOption] = useState([]);

    const [selectedIds, setSelectedIds] = useState([]);
    const [appConfig, setAppConfig] = useState({
        metode_absensi: 'RFID',
        nama_instansi: 'Instansi',
        app_mode: 'edukasi',
        labels: { label_pengguna: 'Siswa', label_kelompok: 'Kelas' }
    });

    const [showModal, setShowModal] = useState(false);
    const [bulkTelegramModal, setBulkTelegramModal] = useState({ show: false, filterClass: '', onlyUnlinked: true, botUsername: '' });
    const [telegramModal, setTelegramModal] = useState({ show: false, student: null, botUsername: '' });
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
        nipd: '', nisn: '', nama_lengkap: '', role: 'siswa', kelas: '', kode_rfid: '', foto: '', face_descriptor: '',
        nomor_telepon: '', telegram_chat_id: '', gender: '', birth_place: '', birth_date: '',
        religion: '', address: '', email: '', nationality: '', child_order: '', siblings_count: '',
        previous_school: '', admission_date: '', parent_name: '', parent_phone: '',
        guardian_name: '', guardian_relation: '', guardian_phone: '', nuptk: '', nik: '',
        education: '', employment_status: '', rank_grade: '', tmt: ''
    });

    const fileInputExcelRef = useRef(null);
    const fileInputZipRef = useRef(null);

    useEffect(() => {
        fetchStudents();
        fetchClasses();
        fetchSettings();
    }, []);

    const isEdu = (appConfig.app_mode || 'edukasi').toLowerCase() === 'edukasi';
    const labelKelompok = (appConfig.labels?.label_kelompok && appConfig.labels?.label_kelompok !== 'Kelompok')
        ? appConfig.labels.label_kelompok
        : (isEdu ? 'Kelas' : 'Divisi');
    const labelPengguna = (appConfig.labels?.label_pengguna && appConfig.labels?.label_pengguna !== 'Pengguna')
        ? appConfig.labels.label_pengguna
        : (isEdu ? 'Siswa' : 'Karyawan');
    const labelId = isEdu ? 'NIPD' : 'ID Karyawan / NIK';
    const labelIdRef = isEdu ? 'NISN' : 'No. Identitas / KTP';
    const labelIdCombined = isEdu ? 'NIPD / NISN' : 'ID Karyawan / NIK';

    const showToast = (type, message) => {
        setNotification({ show: true, type, message });
        setTimeout(() => setNotification({ show: false, type: '', message: '' }), 3000);
    };

    const fetchStudents = async () => {
        try {
            const res = await api.get('/members');
            setStudents(res.data?.data || (Array.isArray(res.data) ? res.data : []));
            setLoading(false);
        } catch { setLoading(false); }
    };

    const fetchClasses = async () => {
        try {
            const res = await api.get('/divisions');
            setClassesOption(res.data?.data || (Array.isArray(res.data) ? res.data : []));
        } catch { /* ignore */ }
    };

    const fetchSettings = async () => {
        try {
            const res = await api.get('/settings');
            if (res.data) setAppConfig({
                ...res.data,
                nama_instansi: res.data.nama_sekolah || res.data.nama_instansi || 'Instansi',
                logo_instansi: res.data.logo_sekolah || res.data.logo_instansi || '',
                alamat_instansi: res.data.alamat_sekolah || res.data.alamat_instansi || '',
                labels: res.data.labels || { label_pengguna: isEdu ? 'Siswa' : 'Karyawan', label_kelompok: isEdu ? 'Kelas' : 'Divisi' }
            });
        } catch { /* ignore */ }
    };

    const filteredStudents = students.filter(s => {
        const matchSearch = (s.nama_lengkap || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (s.nisn || '').toString().includes(searchTerm) ||
            (s.nipd || s.identity_number || '').toString().includes(searchTerm) ||
            (s.nomor_telepon || s.phone_number || '').toString().includes(searchTerm);
        const matchKelas = filterKelas ? (s.kelas || s.division_name) === filterKelas : true;
        return matchSearch && matchKelas;
    }).sort((a, b) => {
        const valA = a[sortConfig.key] || "";
        const valB = b[sortConfig.key] || "";

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

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
    const handleOpenTelegramModal = async (student) => {
        try {
            const res = await api.get('/notifications/bot-info');
            setTelegramModal({
                show: true,
                student,
                botUsername: res.data?.username || appConfig.notif_telegram_bot_username || ''
            });
        } catch {
            setTelegramModal({ show: true, student, botUsername: '' });
        }
    };
    const handleOpenBulkTelegramModal = async () => {
        try {
            const res = await api.get('/notifications/bot-info');
            setBulkTelegramModal({
                show: true,
                filterClass: filterKelas || '',
                onlyUnlinked: true,
                botUsername: res.data?.username || appConfig.notif_telegram_bot_username || ''
            });
        } catch {
            setBulkTelegramModal({ show: true, filterClass: filterKelas || '', onlyUnlinked: true, botUsername: '' });
        }
    };

    const getBulkStudentsList = () => {
        return students.filter(s => {
            const matchClass = bulkTelegramModal.filterClass ? (s.kelas || s.division_name) === bulkTelegramModal.filterClass : true;
            const matchUnlinked = bulkTelegramModal.onlyUnlinked ? !s.telegram_chat_id : true;
            return matchClass && matchUnlinked;
        });
    };

    const generateWhatsAppText = () => {
        const list = getBulkStudentsList();
        const className = bulkTelegramModal.filterClass || (isEdu ? 'Semua Kelas' : 'Semua Divisi');
        const botName = bulkTelegramModal.botUsername || 'Bot';

        if (isEdu) {
            let text = `📢 *PENGUMUMAN NOTIFIKASI PRESENSI KEHADIRAN*\n`;
            text += `🏫 *${appConfig.nama_instansi || 'Sekolah'}*\n`;
            text += `📚 *Kelas:* ${className}\n\n`;
            text += `Yth. Bapak/Ibu Wali Murid,\nBerikut tautan aktivasi notifikasi kehadiran resmi untuk putra/putri Anda. Silakan klik tautan tepat di bawah nama ananda lalu tekan tombol *START* di Telegram:\n\n`;

            list.forEach((s, idx) => {
                const link = `https://t.me/${botName}?start=${s.identity_number || s.nipd || s.id}`;
                const idInfo = s.nisn ? `(NIPD: ${s.nipd || s.identity_number} | NISN: ${s.nisn})` : `(NIPD: ${s.nipd || s.identity_number})`;
                text += `${idx + 1}. *${s.nama_lengkap}* ${idInfo} ${s.telegram_chat_id ? '✅' : ''}\n👉 ${link}\n\n`;
            });

            text += `💡 *Catatan:* Cukup tekan tombol *START* satu kali saja. Laporan kehadiran check-in & check-out ananda akan otomatis masuk ke Telegram Anda. Terima kasih.`;
            return text;
        } else {
            let text = `📢 *INFORMASI NOTIFIKASI KEHADIRAN KARYAWAN*\n`;
            text += `🏢 *${appConfig.nama_instansi || 'Perusahaan'}*\n`;
            text += `💼 *Divisi:* ${className}\n\n`;
            text += `Yth. Rekan Karyawan,\nBerikut tautan aktivasi notifikasi kehadiran untuk akun Telegram Anda. Silakan klik tautan di bawah nama Anda lalu tekan tombol *START* di Telegram:\n\n`;

            list.forEach((s, idx) => {
                const link = `https://t.me/${botName}?start=${s.identity_number || s.id}`;
                text += `${idx + 1}. *${s.nama_lengkap}* (ID: ${s.identity_number || s.nipd}) ${s.telegram_chat_id ? '✅' : ''}\n👉 ${link}\n\n`;
            });

            text += `💡 *Catatan:* Cukup tekan tombol *START* satu kali. Notifikasi presensi check-in & check-out Anda akan otomatis dikirimkan ke Telegram.`;
            return text;
        }
    };

    const handleCopyBulkWhatsApp = () => {
        const text = generateWhatsAppText();
        navigator.clipboard.writeText(text);
        showToast('success', "Format pesan WhatsApp berhasil disalin!");
    };

    const handleExportBulkTelegramExcel = async () => {
        const XLSX = await import("xlsx-js-style");
        const list = getBulkStudentsList();
        const botName = bulkTelegramModal.botUsername || 'Bot';

        const dataRows = list.map((s, idx) => ({
            "No": idx + 1,
            "Nama Lengkap": s.nama_lengkap,
            [`${labelKelompok}`]: s.kelas || s.division_name || '-',
            [`${labelIdCombined}`]: s.identity_number || s.nipd || '-',
            "No WhatsApp": s.nomor_telepon || s.phone_number || '-',
            "Status Telegram": s.telegram_chat_id ? "Terhubung" : "Belum Terhubung",
            "Chat ID": s.telegram_chat_id || '-',
            "Tautan Aktivasi Telegram": `https://t.me/${botName}?start=${s.identity_number || s.nipd || s.id}`
        }));

        const ws = XLSX.utils.json_to_sheet(dataRows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Tautan Telegram");
        XLSX.writeFile(wb, `Tautan_Telegram_${bulkTelegramModal.filterClass || 'Semua'}.xlsx`);
        showToast('success', "File Excel berhasil diunduh!");
    };

    const handleGenerateID = () => setFormData({ ...formData, kode_rfid: Math.floor(1000000000 + Math.random() * 9000000000).toString() });
    const handleInputChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64Photo = reader.result;
                setFormData(prev => ({ ...prev, foto: base64Photo }));

                setFaceScanning(true);
                const img = new Image();
                img.src = base64Photo;
                img.onload = async () => {
                    try {
                        const descriptor = await extractFaceDescriptor(img);
                        if (descriptor) {
                            setFormData(prev => ({ ...prev, face_descriptor: JSON.stringify(descriptor) }));
                            showToast('success', "Wajah terdeteksi & data biometrik disimpan!");
                        } else {
                            showToast('info', "Foto tersimpan, namun wajah tidak terdeteksi jelas.");
                        }
                    } catch {
                        showToast('error', "Gagal memproses deteksi wajah.");
                    } finally {
                        setFaceScanning(false);
                    }
                };
            };
            reader.readAsDataURL(file);
        }
    };

    const handleRemovePhoto = (e) => {
        e.stopPropagation();
        setFormData({ ...formData, foto: '', face_descriptor: '' });
    };

    const startFaceCapture = async () => {
        setShowCameraModal(true);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
            });
            cameraStreamRef.current = stream;
            if (cameraVideoRef.current) {
                cameraVideoRef.current.srcObject = stream;
            }
        } catch {
            showToast('error', "Gagal membuka kamera.");
            setShowCameraModal(false);
        }
    };

    const stopFaceCapture = () => {
        if (cameraStreamRef.current) {
            cameraStreamRef.current.getTracks().forEach(t => t.stop());
        }
        setShowCameraModal(false);
    };

    const capturePhotoFromCamera = async () => {
        if (!cameraVideoRef.current) return;
        const video = cameraVideoRef.current;
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

        setFaceScanning(true);
        stopFaceCapture();
        setFormData(prev => ({ ...prev, foto: dataUrl }));

        try {
            const descriptor = await extractFaceDescriptor(canvas);
            if (descriptor) {
                setFormData(prev => ({ ...prev, face_descriptor: JSON.stringify(descriptor) }));
                showToast('success', "Foto dan wajah berhasil didaftarkan!");
            } else {
                showToast('info', "Foto tersimpan, tapi posisikan wajah lebih tegak & jelas.");
            }
        } catch {
            showToast('error', "Gagal mengekstrak wajah.");
        } finally {
            setFaceScanning(false);
        }
    };

    const openModal = (student = null) => {
        if (student) {
            setFormData({
                nipd: student.nipd || student.identity_number || '',
                nisn: student.nisn || student.identity_reference || '',
                nama_lengkap: student.nama_lengkap || student.full_name || '',
                role: student.role || (isEdu ? 'siswa' : 'karyawan'),
                kelas: student.kelas || student.division_name || '',
                kode_rfid: student.kode_rfid || student.rfid_code || '',
                foto: student.foto || student.photo || '',
                face_descriptor: student.face_descriptor || '',
                nomor_telepon: student.nomor_telepon || student.phone_number || '',
                telegram_chat_id: student.telegram_chat_id || '',
                gender: student.gender || '', birth_place: student.birth_place || '', birth_date: student.birth_date ? String(student.birth_date).slice(0, 10) : '',
                religion: student.religion || '', address: student.address || '', email: student.email || '',
                nationality: student.nationality || '', child_order: student.child_order ?? '', siblings_count: student.siblings_count ?? '',
                previous_school: student.previous_school || '', admission_date: student.admission_date ? String(student.admission_date).slice(0, 10) : '',
                parent_name: student.parent_name || '', parent_phone: student.parent_phone || '',
                guardian_name: student.guardian_name || '', guardian_relation: student.guardian_relation || '',
                guardian_phone: student.guardian_phone || '', nuptk: student.nuptk || '', nik: student.nik || '',
                education: student.education || '', employment_status: student.employment_status || '',
                rank_grade: student.rank_grade || '', tmt: student.tmt ? String(student.tmt).slice(0, 10) : ''
            });
            setEditId(student.id);
            setIsEditMode(true);
            setIsManualClass(!classesOption.some(c => (c.nama_kelas || c.name) === (student.kelas || student.division_name)));
        } else {
            setFormData({
                nipd: '', nisn: '', nama_lengkap: '', role: isEdu ? 'siswa' : 'karyawan', kelas: '', kode_rfid: '', foto: '', face_descriptor: '',
                nomor_telepon: '', telegram_chat_id: '', gender: '', birth_place: '', birth_date: '',
                religion: '', address: '', email: '', nationality: '', child_order: '', siblings_count: '',
                previous_school: '', admission_date: '', parent_name: '', parent_phone: '',
                guardian_name: '', guardian_relation: '', guardian_phone: '', nuptk: '', nik: '',
                education: '', employment_status: '', rank_grade: '', tmt: ''
            });
            setIsEditMode(false);
            setIsManualClass(false);
        }
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setBtnLoading(true);
        try {
            const payload = { ...formData };
            ['birth_date', 'admission_date', 'tmt'].forEach((key) => {
                if (!payload[key]) payload[key] = null;
            });
            ['child_order', 'siblings_count'].forEach((key) => {
                if (payload[key] === '') payload[key] = null;
                else if (payload[key] != null) payload[key] = Number(payload[key]);
            });
            if (['QR_CODE', 'BARCODE', 'WAJAH', 'MANUAL'].includes(appConfig.metode_absensi)) {
                if (!payload.kode_rfid) {
                    payload.kode_rfid = formData.nisn ? `${formData.nipd}${formData.nisn}` : formData.nipd;
                }
            }

            if (isEditMode) {
                await api.put(`/members/${editId}`, payload);
                showToast('success', "Data diperbarui!");
            } else {
                await api.post('/members', payload);
                showToast('success', "Data berhasil ditambahkan!");
            }
            setShowModal(false); fetchStudents(); fetchClasses();
        } catch { showToast('error', "Gagal menyimpan."); }
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
        } catch { showToast('error', "Gagal menghapus."); }
        finally { setBtnLoading(false); setConfirmModal({ show: false }); }
    };

    const handleDownloadTemplate = async () => {
        const XLSX = await import("xlsx-js-style");
        const ws = XLSX.utils.json_to_sheet([{
            "ID Wajib": "'2024001",
            "ID Opsional": "'330123456",
            "Nama Lengkap": isEdu ? "Nama Siswa / Guru" : "Nama Karyawan",
            [`${labelKelompok}`]: isEdu ? "X MIPA 1" : "Staff IT",
            "Nomor Telepon": "081234567890",
            "Telegram Chat ID": "123456789",
            "Kode Kartu (Opsional)": ""
        }]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Template");
        XLSX.writeFile(wb, "Template_Import.xlsx");
    };

    const handleExcelUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        setImportProgress({ show: true, current: 0, total: 100, success: 0, fail: 0 });

        const uploadFormData = new FormData();
        uploadFormData.append('excel_file', file);

        try {
            const res = await api.post('/members/import', uploadFormData, {
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
            const JSZipModule = await import('jszip');
            const JSZip = JSZipModule.default || JSZipModule;
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
                } catch { f++; }
                setImportProgress(prev => ({ ...prev, current: i + 1, success: s, fail: f }));
            }
            setTimeout(() => {
                showToast('success', `Upload Foto Selesai! Sukses: ${s}`);
                setImportProgress({ show: false }); setShowImportModal(false);
                fetchStudents();
            }, 500);
        } catch { showToast('error', "Gagal membaca file ZIP."); }
    };

    const renderClassInput = () => {
        if (isManualClass) return (
            <div className="flex gap-2">
                <input id="student-kelas-manual" name="kelas" value={formData.kelas} onChange={(e) => setFormData({ ...formData, kelas: e.target.value })} className="w-full border-2 border-slate-200 dark:border-slate-700 p-3 rounded-xl outline-none focus:border-indigo-500 transition-all bg-slate-50 dark:bg-slate-700 focus:bg-white dark:focus:bg-slate-600 text-sm font-semibold dark:text-white" placeholder={`Nama ${labelKelompok} Baru...`} required={formData.role !== 'guru'} />
                <button type="button" onClick={() => { setIsManualClass(false); setFormData({ ...formData, kelas: '' }); }} className="px-4 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-100 transition"><RotateCcw size={18} /></button>
            </div>
        );
        return (
            <div className="relative">
                <select id="student-kelas-select" name="kelas" value={formData.kelas} onChange={(e) => { if (e.target.value === 'NEW') { setIsManualClass(true); setFormData({ ...formData, kelas: '' }); } else { setFormData({ ...formData, kelas: e.target.value }); } }} className={`w-full border-2 border-slate-200 dark:border-slate-700 p-3 pr-10 rounded-xl outline-none focus:border-indigo-500 transition-all appearance-none cursor-pointer text-sm font-semibold ${!formData.kelas ? 'text-slate-400 bg-slate-50 dark:bg-slate-700' : 'text-slate-800 dark:text-white bg-white dark:bg-slate-600'}`} required={formData.role !== 'guru'}>
                    <option value="" disabled>-- Pilih {labelKelompok} --</option>
                    {classesOption.map(c => (<option key={c.id} value={c.nama_kelas || c.name} className="text-slate-800">{c.nama_kelas || c.name}</option>))}
                    <option value="NEW" className="font-bold text-indigo-600 bg-indigo-50">+ Tambah {labelKelompok} Baru...</option>
                </select>
                <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
        );
    };

    return (
        <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500 bg-transparent relative h-full font-sans">

            {/* TOAST NOTIFICATION */}
            {notification.show && (
                <div className={`fixed top-6 right-6 z-[100] flex items-center gap-4 px-5 py-4 rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.2)] animate-in slide-in-from-right-8 fade-in duration-300 border bg-white/90 dark:bg-slate-800/90 backdrop-blur-md ${notification.type === 'success' ? 'border-emerald-100 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300' : 'border-rose-100 dark:border-rose-800 text-rose-800 dark:text-rose-300'}`}>
                    <div className={`p-2 rounded-full ${notification.type === 'success' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                        {notification.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                    </div>
                    <div className="pr-4">
                        <h4 className="font-extrabold text-[15px] leading-tight">{notification.type === 'success' ? 'Berhasil' : 'Peringatan'}</h4>
                        <p className="text-[13px] opacity-80 font-medium">{notification.message}</p>
                    </div>
                    <button onClick={() => setNotification({ ...notification, show: false })} className="p-1 hover:bg-slate-100 rounded-full transition-colors absolute top-2 right-2 opacity-50 hover:opacity-100"><X size={16} /></button>
                </div>
            )}

            {/* HEADER SECTION */}
            <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 md:p-8 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)] border border-slate-100 dark:border-slate-700 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
                <div className="flex items-center gap-5">
                    <div className="w-16 h-16 rounded-[1.25rem] bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100/50 shadow-inner">
                        <Users size={32} />
                    </div>
                    <div>
                        <h2 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-white tracking-tight">{isEdu ? 'Direktori Siswa & Guru' : 'Direktori Karyawan'}</h2>
                        <p className="text-slate-500 dark:text-slate-400 font-medium mt-1 text-sm flex items-center gap-1.5"><IdCard size={16} /> Total: <span className="font-bold text-indigo-600 dark:text-indigo-400">{students.length} Terdaftar</span></p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                    {selectedIds.length > 0 && (
                        <button onClick={confirmDeleteBulk} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-rose-50 text-rose-600 px-5 py-3 rounded-[1.25rem] hover:bg-rose-500 hover:text-white text-sm font-bold transition-all border border-rose-100 hover:border-rose-500 shadow-sm">
                            <Trash2 size={18} /> <span>Hapus ({selectedIds.length})</span>
                        </button>
                    )}

                    {(appConfig.metode_absensi === 'BARCODE' || appConfig.metode_absensi === 'QR_CODE') && (
                        <button onClick={handlePrintBulk} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 px-5 py-3 rounded-[1.25rem] hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-indigo-600 text-sm font-bold transition-all shadow-sm">
                            <Printer size={18} /> <span>Cetak Terpilih</span>
                        </button>
                    )}

                    <button onClick={() => setShowImportModal(true)} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-emerald-50 text-emerald-600 px-5 py-3 rounded-[1.25rem] hover:bg-emerald-500 hover:text-white text-sm font-bold transition-all border border-emerald-100 hover:border-emerald-500 shadow-sm">
                        <Upload size={18} /> <span>Import</span>
                    </button>
                    {(appConfig.notif_telegram_active === '1' || appConfig.notif_telegram_active === 1 || appConfig.notif_telegram_active === true) && (
                        <button
                            type="button"
                            onClick={handleOpenBulkTelegramModal}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 px-5 py-3 rounded-[1.25rem] hover:bg-blue-600 hover:text-white text-sm font-bold transition-all border border-blue-100 dark:border-blue-800 shadow-sm active:scale-95"
                            title="Bagikan Tautan Telegram Massal"
                        >
                            <Send size={18} /> <span>Bagikan Tautan Massal</span>
                        </button>
                    )}
                    <button onClick={() => openModal()} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-[1.25rem] hover:shadow-lg hover:shadow-indigo-500/30 text-sm font-bold transition-all active:scale-95">
                        <Plus size={18} /> <span>Tambah {labelPengguna}</span>
                    </button>
                </div>
            </div>

            {/* SEARCH & FILTER SECTION */}
            <div className="bg-white dark:bg-slate-800 p-2.5 rounded-[1.5rem] border border-slate-100 dark:border-slate-700 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)] flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                    <input
                        id="students-search-input"
                        name="students_search"
                        aria-label={`Cari nama, ${labelIdCombined}, atau ${labelKelompok}`}
                        type="text"
                        placeholder={`Cari nama, ${labelIdCombined}, atau ${labelKelompok}...`}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-3.5 bg-slate-50 dark:bg-slate-700/50 border border-transparent rounded-[1rem] outline-none focus:border-indigo-200 dark:focus:border-indigo-500/50 focus:bg-white dark:focus:bg-slate-700 focus:ring-4 focus:ring-indigo-500/5 transition-all text-sm font-bold text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
                    />
                </div>
                <div className="relative sm:w-72">
                    <FolderArchive className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                    <select
                        id="students-class-select"
                        name="students_class_filter"
                        aria-label={`Pilih ${labelKelompok}`}
                        className="w-full pl-12 pr-10 py-3.5 bg-slate-50 dark:bg-slate-700/50 border border-transparent rounded-[1rem] outline-none focus:border-indigo-200 dark:focus:border-indigo-500/50 focus:bg-white dark:focus:bg-slate-700 focus:ring-4 focus:ring-indigo-500/5 cursor-pointer transition-all text-sm font-bold text-slate-700 dark:text-slate-200 appearance-none"
                        value={filterKelas}
                        onChange={(e) => setFilterKelas(e.target.value)}
                    >
                        <option value="">Semua {labelKelompok}</option>
                        {classesOption.map(c => (
                            <option key={c.id} value={c.nama_kelas || c.name} className="dark:bg-slate-800 dark:text-slate-200">
                                {c.nama_kelas || c.name}
                            </option>
                        ))}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                </div>
            </div>

            {/* --- TABLE VIEW --- */}
            <div className="hidden md:block bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-100 dark:border-slate-700 overflow-hidden shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)]">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left whitespace-nowrap">
                        <thead className="bg-slate-50/80 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 font-extrabold text-[11px] uppercase tracking-widest border-b border-slate-100 dark:border-slate-700">
                            <tr>
                                <th className="py-5 px-6 w-12 text-center">
                                    <button onClick={toggleSelectAll} className="hover:text-indigo-600 transition-colors">
                                        {selectedIds.length === filteredStudents.length && filteredStudents.length > 0 ? <CheckSquare size={20} className="text-indigo-600" /> : <Square size={20} />}
                                    </button>
                                </th>
                                <th className="py-5 px-4 w-20">Foto</th>
                                <th className="py-5 px-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors" onClick={() => handleSort('nama_lengkap')}>
                                    Nama Lengkap {sortConfig.key === 'nama_lengkap' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                                </th>
                                <th className="py-5 px-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors" onClick={() => handleSort('nipd')}>
                                    {labelIdCombined} {sortConfig.key === 'nipd' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                                </th>
                                <th className="py-5 px-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors hidden sm:table-cell" onClick={() => handleSort('kelas')}>
                                    {labelKelompok} {sortConfig.key === 'kelas' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                                </th>
                                <th className="py-5 px-6 text-right">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50 text-sm">
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td className="p-6 text-center"><div className="h-5 w-5 bg-slate-200 rounded mx-auto"></div></td>
                                        <td className="p-6"><div className="w-12 h-12 bg-slate-200 rounded-[14px]"></div></td>
                                        <td className="p-6 space-y-2"><div className="h-4 w-40 bg-slate-200 rounded"></div></td>
                                        <td className="p-6"><div className="h-4 w-24 bg-slate-200 rounded"></div></td>
                                        <td className="p-6 hidden sm:table-cell"><div className="h-4 w-20 bg-slate-200 rounded"></div></td>
                                        <td className="p-6"><div className="h-8 w-16 bg-slate-200 rounded ml-auto"></div></td>
                                    </tr>
                                ))
                            ) : filteredStudents.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="py-16 text-center">
                                        <Users size={40} className="text-slate-300 mx-auto mb-3" />
                                        <div className="text-slate-500 font-bold text-base">Tidak ada data</div>
                                        <p className="text-slate-400 text-xs mt-1">Coba sesuaikan pencarian Anda.</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredStudents.map((s) => (
                                    <tr key={s.id} className={`hover:bg-indigo-50/40 dark:hover:bg-slate-700/50 transition-colors group ${selectedIds.includes(s.id) ? 'bg-indigo-50/60 dark:bg-slate-700/50' : ''}`}>
                                        <td className="py-4 px-6 text-center">
                                            <button onClick={() => toggleSelectOne(s.id)} className="text-slate-300 hover:text-indigo-600 transition-colors">
                                                {selectedIds.includes(s.id) ? <CheckSquare size={20} className="text-indigo-600" /> : <Square size={20} />}
                                            </button>
                                        </td>
                                        <td className="py-4 px-4">
                                            <div className="w-12 h-12 rounded-[14px] bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 shadow-sm overflow-hidden flex items-center justify-center relative group-hover:border-indigo-200 dark:group-hover:border-indigo-500/50 transition-colors">
                                                {s.foto ? <img src={s.foto} className="w-full h-full object-cover" alt="Foto" /> : <span className="font-black text-slate-400 text-lg">{(s.nama_lengkap || '?').charAt(0).toUpperCase()}</span>}
                                            </div>
                                        </td>
                                        <td className="py-4 px-4">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-slate-800 dark:text-slate-200 text-[14px] group-hover:text-indigo-600 transition-colors">{s.nama_lengkap}</span>
                                                {s.role && s.role !== 'member' && s.role !== 'siswa' && (
                                                    <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-md bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
                                                        {s.role === 'guru' ? 'Guru' : s.role}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2 mt-0.5">
                                                {(s.nomor_telepon || s.phone_number) && (
                                                    <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1"><Phone size={12} /> {s.nomor_telepon || s.phone_number}</span>
                                                )}
                                                {s.face_descriptor && (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                                        <CheckCircle2 size={11} /> Wajah Terdaftar
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="py-4 px-4">
                                            <div className="font-semibold text-slate-800 dark:text-slate-200 text-[14px]">{s.nipd || s.identity_number || '-'}</div>
                                            {s.nisn && <div className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400 mt-0.5">{isEdu ? 'NISN: ' : 'Ref: '}{s.nisn}</div>}
                                        </td>
                                        <td className="py-4 px-4 hidden sm:table-cell">
                                            <div className="font-medium text-slate-600 dark:text-slate-300 text-[14px]">{s.kelas || (s.role === 'guru' ? 'Dewan Guru' : '-')}</div>
                                        </td>
                                        <td className="py-4 px-6 text-right">
                                            <div className="flex justify-end gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                                                {(appConfig.metode_absensi === 'BARCODE' || appConfig.metode_absensi === 'QR_CODE') && (
                                                    <button onClick={() => handlePrintCard(s)} className="p-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-violet-600 hover:text-white hover:border-violet-600 rounded-xl transition-all shadow-sm active:scale-95" title="Cetak Kartu"><QrCode size={18} /></button>
                                                )}
                                                <button
                                                    onClick={() => handleOpenTelegramModal(s)}
                                                    className={`p-2 bg-white dark:bg-slate-700 border rounded-xl transition-all shadow-sm active:scale-95 ${s.telegram_chat_id ? 'text-blue-500 border-blue-200 hover:bg-blue-600 hover:text-white' : 'text-slate-400 border-slate-200 dark:border-slate-600 hover:bg-blue-500 hover:text-white'}`}
                                                    title={s.telegram_chat_id ? "Telegram Terhubung" : "Hubungkan Telegram"}
                                                >
                                                    <Send size={18} />
                                                </button>
                                                <button onClick={() => openModal(s)} className="p-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-blue-600 hover:text-white hover:border-blue-600 rounded-xl transition-all shadow-sm active:scale-95" title="Edit Data"><Edit size={18} /></button>
                                                <button onClick={() => confirmDeleteSingle(s)} className="p-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-rose-600 hover:text-white hover:border-rose-600 rounded-xl transition-all shadow-sm active:scale-95" title="Hapus"><Trash2 size={18} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* --- FORM MODAL (Add/Edit) --- */}
            {showModal && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-100 dark:border-slate-700 animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-8 py-5 border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 flex justify-between items-center shrink-0">
                            <div>
                                <h3 className="font-black text-2xl text-slate-800 dark:text-white tracking-tight">
                                    {isEditMode ? `Edit Data ${formData.role === 'guru' ? 'Guru' : labelPengguna}` : `Tambah ${formData.role === 'guru' ? 'Guru' : labelPengguna} Baru`}
                                </h3>
                                <p className="text-xs text-slate-500 mt-1 font-medium">Lengkapi formulir profil {isEdu ? (formData.role === 'guru' ? 'guru' : 'siswa') : 'anggota'} di bawah ini.</p>
                            </div>
                            <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-500"><X size={24} /></button>
                        </div>

                        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 bg-slate-50/50 dark:bg-slate-800/50 custom-scrollbar">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                {/* Kolom Kiri: Foto & Biometrik Wajah */}
                                <div className="md:col-span-1 flex flex-col gap-3">
                                    <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest">Foto Profil & Wajah</label>
                                    <div className="relative aspect-[3/4] w-full max-w-[180px] mx-auto rounded-[1.5rem] bg-white dark:bg-slate-700 border-2 border-dashed border-slate-300 dark:border-slate-600 flex flex-col items-center justify-center overflow-hidden hover:bg-indigo-50 dark:hover:bg-slate-600 transition-all cursor-pointer group shadow-sm">
                                        {formData.foto ? (
                                            <div className="relative w-full h-full">
                                                <img src={formData.foto} className="w-full h-full object-cover" alt="Preview" />
                                                <button type="button" onClick={handleRemovePhoto} className="absolute top-2 right-2 p-2 bg-rose-500 text-white rounded-xl shadow-lg z-10 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-600" title="Hapus Foto">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="text-center text-slate-400 group-hover:text-indigo-500 transition-colors p-4">
                                                <div className="w-12 h-12 bg-slate-100 dark:bg-slate-600 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:bg-indigo-100 transition-colors"><Upload size={24} /></div>
                                                <span className="text-xs font-bold">Upload Foto</span>
                                            </div>
                                        )}
                                        <input id="student-photo-input" name="student_photo" type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFileChange} />
                                    </div>

                                    {/* Status Biometrik */}
                                    {faceScanning ? (
                                        <div className="flex items-center justify-center gap-1.5 py-1.5 px-3 bg-blue-50 text-blue-600 rounded-xl text-[10px] font-bold">
                                            <Loader2 size={13} className="animate-spin" /> Memindai Wajah...
                                        </div>
                                    ) : formData.face_descriptor ? (
                                        <div className="flex items-center justify-center gap-1 py-1.5 px-3 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-xl text-[10px] font-bold">
                                            <CheckCircle2 size={13} /> Wajah Terdaftar
                                        </div>
                                    ) : formData.foto ? (
                                        <div className="text-[10px] text-amber-600 text-center font-medium bg-amber-50 py-1 px-2 rounded-xl">
                                            Wajah belum terdeteksi dari foto
                                        </div>
                                    ) : null}

                                    <button
                                        type="button"
                                        onClick={startFaceCapture}
                                        className="w-full max-w-[180px] mx-auto py-2.5 px-3 bg-slate-100 dark:bg-slate-700 hover:bg-indigo-50 text-slate-700 dark:text-slate-200 hover:text-indigo-600 border border-slate-200 dark:border-slate-600 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95"
                                    >
                                        <Camera size={15} /> Ambil dari Kamera
                                    </button>
                                </div>

                                {/* Kolom Kanan: Detail Formulir */}
                                <div className="md:col-span-2 space-y-5">
                                    {/* TIPE / PERAN PENGGUNA (SISWA vs GURU) */}
                                    <div>
                                        <label className="text-[11px] font-extrabold text-slate-500 mb-1.5 block uppercase tracking-widest">
                                            Status / Peran <span className="text-rose-500">*</span>
                                        </label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <button
                                                type="button"
                                                onClick={() => setFormData({ ...formData, role: isEdu ? 'siswa' : 'karyawan' })}
                                                className={`py-2.5 px-4 rounded-xl text-xs font-bold border-2 transition-all flex items-center justify-center gap-2 ${formData.role === 'siswa' || formData.role === 'karyawan' || formData.role === 'member'
                                                    ? 'bg-indigo-50 border-indigo-500 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300 shadow-sm'
                                                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50'
                                                    }`}
                                            >
                                                <Users size={16} />
                                                <span>{isEdu ? 'Siswa' : 'Karyawan'}</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setFormData({ ...formData, role: isEdu ? 'guru' : 'manager' })}
                                                className={`py-2.5 px-4 rounded-xl text-xs font-bold border-2 transition-all flex items-center justify-center gap-2 ${formData.role === 'guru' || formData.role === 'manager' || formData.role === 'staff'
                                                    ? 'bg-purple-50 border-purple-500 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300 shadow-sm'
                                                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50'
                                                    }`}
                                            >
                                                <GraduationCap size={16} />
                                                <span>{isEdu ? 'Guru / Tenaga Pendidik' : 'Manager / Spv'}</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* NOMOR IDENTITAS */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                        <div>
                                            <label htmlFor="student-nipd" className="text-[11px] font-extrabold text-slate-500 mb-1.5 block uppercase tracking-widest">
                                                {labelId} {formData.role === 'guru' ? '(NIP / NUPTK)' : ''} <span className="text-rose-500">*</span>
                                            </label>
                                            <input
                                                id="student-nipd"
                                                name="nipd"
                                                value={formData.nipd}
                                                onChange={handleInputChange}
                                                className="w-full border-2 border-slate-200 dark:border-slate-700 p-3 rounded-xl outline-none focus:border-indigo-500 transition-all bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200"
                                                required
                                                placeholder={formData.role === 'guru' ? 'Contoh: 198501012010011001' : 'Contoh: 2024001'}
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor="student-nisn" className="text-[11px] font-extrabold text-slate-500 mb-1.5 block uppercase tracking-widest">
                                                {labelIdRef} {formData.role === 'guru' ? '(No. Identitas/KTP)' : '(10 Digit Kemdikbud)'}
                                            </label>
                                            <input
                                                id="student-nisn"
                                                name="nisn"
                                                value={formData.nisn}
                                                onChange={handleInputChange}
                                                className="w-full border-2 border-slate-200 dark:border-slate-700 p-3 rounded-xl outline-none focus:border-indigo-500 transition-all bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200"
                                                placeholder={isEdu && formData.role !== 'guru' ? 'Contoh: 0081234567' : 'Opsional'}
                                            />
                                        </div>
                                    </div>

                                    {/* NAMA LENGKAP */}
                                    <div>
                                        <label htmlFor="student-nama-lengkap" className="text-[11px] font-extrabold text-slate-500 mb-1.5 block uppercase tracking-widest">
                                            Nama Lengkap {formData.role === 'guru' ? 'Beserta Gelar' : ''} <span className="text-rose-500">*</span>
                                        </label>
                                        <input
                                            id="student-nama-lengkap"
                                            name="nama_lengkap"
                                            value={formData.nama_lengkap}
                                            onChange={handleInputChange}
                                            className="w-full border-2 border-slate-200 dark:border-slate-700 p-3 rounded-xl outline-none focus:border-indigo-500 transition-all bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200"
                                            required
                                            placeholder={formData.role === 'guru' ? 'Contoh: Drs. H. Ahmad Fauzi, M.Pd' : 'Nama lengkap...'}
                                        />
                                    </div>

                                    {/* KONTAK: NOMOR HP & TELEGRAM */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                        <div>
                                            <label htmlFor="student-phone" className="text-[11px] font-extrabold text-slate-500 mb-1.5 block uppercase tracking-widest flex items-center gap-1">
                                                <Phone size={13} /> {formData.role === 'guru' ? 'No. WhatsApp Guru' : 'No. WhatsApp Wali Murid'}
                                            </label>
                                            <input id="student-phone" name="nomor_telepon" value={formData.nomor_telepon || ''} onChange={handleInputChange} className="w-full border-2 border-slate-200 dark:border-slate-700 p-3 rounded-xl outline-none focus:border-indigo-500 transition-all bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200" placeholder="Contoh: 08123456789" />
                                        </div>
                                        <div>
                                            <label htmlFor="student-telegram" className="text-[11px] font-extrabold text-slate-500 mb-1.5 block uppercase tracking-widest flex items-center gap-1">
                                                <Send size={13} /> Telegram Chat ID (Opsional)
                                            </label>
                                            <input id="student-telegram" name="telegram_chat_id" value={formData.telegram_chat_id || ''} onChange={handleInputChange} className="w-full border-2 border-slate-200 dark:border-slate-700 p-3 rounded-xl outline-none focus:border-indigo-500 transition-all bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200" placeholder="Contoh: 123456789" />
                                        </div>
                                    </div>

                                    {/* BIODATA PRIBADI DAN KELUARGA */}
                                    <div className="mt-2 border-t border-slate-200 dark:border-slate-700 pt-6 space-y-4">
                                        <div>
                                            <h4 className="text-sm font-black text-slate-800 dark:text-white">Biodata Lengkap</h4>
                                            <p className="text-xs text-slate-500 mt-1">Data tambahan bersifat opsional dan dapat dilengkapi bertahap.</p>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-[11px] font-extrabold text-slate-500 mb-1.5 block uppercase tracking-widest">Jenis Kelamin</label>
                                                <select name="gender" value={formData.gender || ''} onChange={handleInputChange} className="w-full border-2 border-slate-200 dark:border-slate-700 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-sm dark:text-white">
                                                    <option value="">Belum diisi</option><option value="L">Laki-laki</option><option value="P">Perempuan</option>
                                                </select>
                                            </div>
                                            <div><label className="text-[11px] font-extrabold text-slate-500 mb-1.5 block uppercase tracking-widest">Agama</label><select name="religion" value={formData.religion || ''} onChange={handleInputChange} className="w-full border-2 border-slate-200 dark:border-slate-700 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-sm dark:text-white"><option value="">Belum diisi</option>{['Islam','Kristen','Katolik','Hindu','Buddha','Konghucu','Lainnya'].map(v => <option key={v} value={v}>{v}</option>)}</select></div>
                                            <div><label className="text-[11px] font-extrabold text-slate-500 mb-1.5 block uppercase tracking-widest">Tempat Lahir</label><input name="birth_place" value={formData.birth_place || ''} onChange={handleInputChange} className="w-full border-2 border-slate-200 dark:border-slate-700 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-sm dark:text-white" placeholder="Kota/kabupaten kelahiran" /></div>
                                            <div><label className="text-[11px] font-extrabold text-slate-500 mb-1.5 block uppercase tracking-widest">Tanggal Lahir</label><input type="date" name="birth_date" value={formData.birth_date || ''} onChange={handleInputChange} className="w-full border-2 border-slate-200 dark:border-slate-700 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-sm dark:text-white" /></div>
                                            <div><label className="text-[11px] font-extrabold text-slate-500 mb-1.5 block uppercase tracking-widest">Email</label><input type="email" name="email" value={formData.email || ''} onChange={handleInputChange} className="w-full border-2 border-slate-200 dark:border-slate-700 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-sm dark:text-white" placeholder="nama@sekolah.id" /></div>
                                            <div><label className="text-[11px] font-extrabold text-slate-500 mb-1.5 block uppercase tracking-widest">Kewarganegaraan</label><input name="nationality" value={formData.nationality || ''} onChange={handleInputChange} className="w-full border-2 border-slate-200 dark:border-slate-700 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-sm dark:text-white" placeholder="Indonesia" /></div>
                                            <div className="sm:col-span-2"><label className="text-[11px] font-extrabold text-slate-500 mb-1.5 block uppercase tracking-widest">Alamat Lengkap</label><textarea name="address" value={formData.address || ''} onChange={handleInputChange} rows={2} className="w-full border-2 border-slate-200 dark:border-slate-700 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-sm dark:text-white" placeholder="Jalan, RT/RW, desa/kelurahan, kecamatan, kabupaten/kota" /></div>
                                        </div>
                                        {formData.role === 'guru' ? (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/20 p-4">
                                                <div><label className="text-[11px] font-extrabold text-slate-500 mb-1.5 block uppercase tracking-widest">NUPTK</label><input name="nuptk" value={formData.nuptk || ''} onChange={handleInputChange} className="w-full border-2 border-slate-200 dark:border-slate-700 p-3 rounded-xl bg-white dark:bg-slate-800 text-sm dark:text-white" /></div>
                                                <div><label className="text-[11px] font-extrabold text-slate-500 mb-1.5 block uppercase tracking-widest">NIK</label><input name="nik" value={formData.nik || ''} onChange={handleInputChange} className="w-full border-2 border-slate-200 dark:border-slate-700 p-3 rounded-xl bg-white dark:bg-slate-800 text-sm dark:text-white" /></div>
                                                <div><label className="text-[11px] font-extrabold text-slate-500 mb-1.5 block uppercase tracking-widest">Pendidikan Terakhir</label><input name="education" value={formData.education || ''} onChange={handleInputChange} className="w-full border-2 border-slate-200 dark:border-slate-700 p-3 rounded-xl bg-white dark:bg-slate-800 text-sm dark:text-white" placeholder="S1 Pendidikan ..." /></div>
                                                <div><label className="text-[11px] font-extrabold text-slate-500 mb-1.5 block uppercase tracking-widest">Status Kepegawaian</label><input name="employment_status" value={formData.employment_status || ''} onChange={handleInputChange} className="w-full border-2 border-slate-200 dark:border-slate-700 p-3 rounded-xl bg-white dark:bg-slate-800 text-sm dark:text-white" placeholder="PNS / PPPK / GTY / GTT" /></div>
                                                <div><label className="text-[11px] font-extrabold text-slate-500 mb-1.5 block uppercase tracking-widest">Pangkat / Golongan</label><input name="rank_grade" value={formData.rank_grade || ''} onChange={handleInputChange} className="w-full border-2 border-slate-200 dark:border-slate-700 p-3 rounded-xl bg-white dark:bg-slate-800 text-sm dark:text-white" /></div>
                                                <div><label className="text-[11px] font-extrabold text-slate-500 mb-1.5 block uppercase tracking-widest">TMT / Mulai Bertugas</label><input type="date" name="tmt" value={formData.tmt || ''} onChange={handleInputChange} className="w-full border-2 border-slate-200 dark:border-slate-700 p-3 rounded-xl bg-white dark:bg-slate-800 text-sm dark:text-white" /></div>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/20 p-4">
                                                <div><label className="text-[11px] font-extrabold text-slate-500 mb-1.5 block uppercase tracking-widest">Anak Ke-</label><input type="number" min="1" name="child_order" value={formData.child_order ?? ''} onChange={handleInputChange} className="w-full border-2 border-slate-200 dark:border-slate-700 p-3 rounded-xl bg-white dark:bg-slate-800 text-sm dark:text-white" /></div>
                                                <div><label className="text-[11px] font-extrabold text-slate-500 mb-1.5 block uppercase tracking-widest">Jumlah Saudara Kandung</label><input type="number" min="0" name="siblings_count" value={formData.siblings_count ?? ''} onChange={handleInputChange} className="w-full border-2 border-slate-200 dark:border-slate-700 p-3 rounded-xl bg-white dark:bg-slate-800 text-sm dark:text-white" /></div>
                                                <div><label className="text-[11px] font-extrabold text-slate-500 mb-1.5 block uppercase tracking-widest">Asal Sekolah</label><input name="previous_school" value={formData.previous_school || ''} onChange={handleInputChange} className="w-full border-2 border-slate-200 dark:border-slate-700 p-3 rounded-xl bg-white dark:bg-slate-800 text-sm dark:text-white" /></div>
                                                <div><label className="text-[11px] font-extrabold text-slate-500 mb-1.5 block uppercase tracking-widest">Tanggal Masuk</label><input type="date" name="admission_date" value={formData.admission_date || ''} onChange={handleInputChange} className="w-full border-2 border-slate-200 dark:border-slate-700 p-3 rounded-xl bg-white dark:bg-slate-800 text-sm dark:text-white" /></div>
                                                <div><label className="text-[11px] font-extrabold text-slate-500 mb-1.5 block uppercase tracking-widest">Nama Orang Tua</label><input name="parent_name" value={formData.parent_name || ''} onChange={handleInputChange} className="w-full border-2 border-slate-200 dark:border-slate-700 p-3 rounded-xl bg-white dark:bg-slate-800 text-sm dark:text-white" /></div>
                                                <div><label className="text-[11px] font-extrabold text-slate-500 mb-1.5 block uppercase tracking-widest">HP Orang Tua</label><input name="parent_phone" value={formData.parent_phone || ''} onChange={handleInputChange} className="w-full border-2 border-slate-200 dark:border-slate-700 p-3 rounded-xl bg-white dark:bg-slate-800 text-sm dark:text-white" /></div>
                                                <div><label className="text-[11px] font-extrabold text-slate-500 mb-1.5 block uppercase tracking-widest">Nama Wali Alternatif</label><input name="guardian_name" value={formData.guardian_name || ''} onChange={handleInputChange} className="w-full border-2 border-slate-200 dark:border-slate-700 p-3 rounded-xl bg-white dark:bg-slate-800 text-sm dark:text-white" /></div>
                                                <div><label className="text-[11px] font-extrabold text-slate-500 mb-1.5 block uppercase tracking-widest">Hubungan Wali</label><input name="guardian_relation" value={formData.guardian_relation || ''} onChange={handleInputChange} className="w-full border-2 border-slate-200 dark:border-slate-700 p-3 rounded-xl bg-white dark:bg-slate-800 text-sm dark:text-white" /></div>
                                                <div><label className="text-[11px] font-extrabold text-slate-500 mb-1.5 block uppercase tracking-widest">HP Wali Alternatif</label><input name="guardian_phone" value={formData.guardian_phone || ''} onChange={handleInputChange} className="w-full border-2 border-slate-200 dark:border-slate-700 p-3 rounded-xl bg-white dark:bg-slate-800 text-sm dark:text-white" /></div>
                                            </div>
                                        )}
                                    </div>

                                    {/* PILIHAN KELAS */}
                                    <div>
                                        <label htmlFor="student-kelas-select" className="text-[11px] font-extrabold text-slate-500 mb-1.5 block uppercase tracking-widest">
                                            {labelKelompok} {formData.role === 'guru' ? '(Opsional / Ruang Guru)' : <span className="text-rose-500">*</span>}
                                        </label>
                                        {renderClassInput()}
                                    </div>

                                    {['RFID', 'FINGERPRINT'].includes(appConfig.metode_absensi) && (
                                        <div>
                                            <label htmlFor="student-kode-rfid" className="text-[11px] font-extrabold text-slate-500 mb-1.5 block uppercase tracking-widest flex items-center gap-1.5">
                                                {appConfig.metode_absensi === 'FINGERPRINT' ? <Fingerprint size={14} /> : <ScanLine size={14} />}
                                                {appConfig.metode_absensi === 'FINGERPRINT' ? "ID Mesin Fingerprint" : "UID Kartu / RFID"}
                                            </label>
                                            <div className="flex gap-2">
                                                <input id="student-kode-rfid" name="kode_rfid" value={formData.kode_rfid} onChange={handleInputChange} className="w-full border-2 border-indigo-100 dark:border-indigo-500/30 p-3 rounded-xl font-mono bg-indigo-50/30 dark:bg-indigo-900/20 outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 text-sm font-bold text-slate-700 dark:text-slate-200 transition-all" placeholder="Scan kartu atau ketik ID..." autoFocus={!isEditMode} />
                                                <button type="button" onClick={handleGenerateID} className="px-4 bg-slate-100 dark:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors text-slate-600 dark:text-slate-300 font-bold" title="Buat Kode Acak"><RotateCcw size={20} /></button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </form>

                        <div className="px-8 py-5 border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 shrink-0 flex justify-end gap-3">
                            <button type="button" onClick={() => setShowModal(false)} className="px-6 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-sm">Batal</button>
                            <button type="button" onClick={handleSubmit} disabled={btnLoading} className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-md shadow-indigo-200 transition-all active:scale-95 flex items-center gap-2 text-sm disabled:opacity-70">
                                {btnLoading ? <Activity size={18} className="animate-spin" /> : <Save size={18} />}
                                {btnLoading ? 'Menyimpan...' : 'Simpan Data'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODAL KAMERA SNAPSHOT WAJAH --- */}
            {showCameraModal && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl flex flex-col items-center border border-white/20">
                        <h3 className="text-base font-bold text-slate-800 dark:text-white mb-1">Daftarkan Wajah Pengguna</h3>
                        <p className="text-xs text-slate-400 mb-4 text-center">Posisikan wajah di dalam frame kamera.</p>

                        <div className="relative w-full aspect-[3/4] rounded-2xl overflow-hidden bg-black mb-4 border border-slate-200">
                            <video ref={cameraVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                                <div className="w-[160px] h-[210px] rounded-[50%] border-2 border-dashed border-blue-400 animate-pulse" />
                            </div>
                        </div>

                        <div className="flex gap-2 w-full">
                            <button type="button" onClick={stopFaceCapture} className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-xl text-xs hover:bg-slate-200">Batal</button>
                            <button type="button" onClick={capturePhotoFromCamera} className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-indigo-300 active:scale-95">
                                <Camera size={16} /> Ambil Foto
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODAL KONFIRMASI HAPUS --- */}
            {confirmModal.show && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-8 max-w-sm w-full shadow-2xl text-center transform animate-in zoom-in-95 duration-200 border border-white dark:border-slate-700">
                        <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-[1.5rem] flex items-center justify-center mx-auto mb-6 rotate-3">
                            <AlertTriangle size={36} />
                        </div>
                        <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">Hapus Data?</h3>
                        <p className="text-[14px] text-slate-500 mt-2 mb-8 leading-relaxed font-medium">
                            Anda akan menghapus <b>{confirmModal.name || `${confirmModal.count} Data`}</b>. Data yang dihapus tidak dapat dikembalikan.
                        </p>
                        <div className="flex gap-3">
                            <button onClick={() => setConfirmModal({ show: false })} className="flex-1 py-3.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-2xl font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">Batal</button>
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
                    <div className="bg-white dark:bg-slate-800 rounded-[2rem] w-full max-w-2xl overflow-hidden shadow-2xl relative transform animate-in zoom-in-95 duration-200">
                        <button onClick={() => setShowImportModal(false)} className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 bg-slate-100 dark:bg-slate-700 rounded-full p-2 transition-colors"><X size={20} /></button>
                        <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center gap-4">
                            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-[1rem]"><Upload size={24} /></div>
                            <div>
                                <h3 className="font-extrabold text-xl text-slate-800 dark:text-white">Import Data Masal</h3>
                                <p className="text-xs text-slate-500 font-medium mt-0.5">Unggah data Excel atau file ZIP foto secara instan.</p>
                            </div>
                        </div>
                        <div className="p-8 bg-slate-50/50 dark:bg-slate-800/50">
                            <input type="file" ref={fileInputExcelRef} className="hidden" accept=".xlsx,.xls" onChange={handleExcelUpload} />
                            <input type="file" ref={fileInputZipRef} className="hidden" accept=".zip" onChange={handleZipUpload} />

                            {importProgress.show ? (
                                <div className="text-center py-10 space-y-4 bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm">
                                    <div className="text-6xl font-black text-indigo-600 animate-pulse">{Math.round((importProgress.current / importProgress.total) * 100)}%</div>
                                    <p className="text-slate-500 font-bold">Memproses Data ({importProgress.current}/{importProgress.total})</p>
                                    <div className="w-2/3 mx-auto bg-slate-100 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
                                        <div className="bg-indigo-600 h-full rounded-full transition-all duration-300" style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}></div>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="group bg-white dark:bg-slate-700 border-2 border-dashed border-slate-200 dark:border-slate-600 p-8 flex flex-col items-center justify-center rounded-[2rem] cursor-pointer hover:bg-emerald-50/50 dark:hover:bg-slate-600 hover:border-emerald-400 hover:shadow-md transition-all duration-300" onClick={() => fileInputExcelRef.current.click()}>
                                        <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 text-slate-400 rounded-[1.25rem] flex items-center justify-center mb-5 group-hover:bg-emerald-100 group-hover:text-emerald-600 group-hover:-translate-y-2 transition-all duration-300"><FileSpreadsheet size={32} /></div>
                                        <h4 className="font-extrabold text-slate-800 dark:text-white text-lg">Data Pengguna (Excel)</h4>
                                        <p className="text-xs text-slate-400 font-medium mt-1">Gunakan format .xlsx</p>
                                        <button onClick={(e) => { e.stopPropagation(); handleDownloadTemplate() }} className="mt-6 text-xs font-bold text-emerald-600 bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-500/40 px-5 py-2.5 rounded-xl hover:bg-emerald-50 transition-colors w-full">Download Template</button>
                                    </div>

                                    <div className="group bg-white dark:bg-slate-700 border-2 border-dashed border-slate-200 dark:border-slate-600 p-8 flex flex-col items-center justify-center rounded-[2rem] cursor-pointer hover:bg-blue-50/50 dark:hover:bg-slate-600 hover:border-blue-400 hover:shadow-md transition-all duration-300" onClick={() => fileInputZipRef.current.click()}>
                                        <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 text-slate-400 rounded-[1.25rem] flex items-center justify-center mb-5 group-hover:bg-blue-100 group-hover:text-blue-600 group-hover:-translate-y-2 transition-all duration-300"><FolderArchive size={32} /></div>
                                        <h4 className="font-extrabold text-slate-800 dark:text-white text-lg">Foto Profil (ZIP)</h4>
                                        <p className="text-xs text-slate-400 font-medium mt-1 text-center">Beri nama file foto sesuai dengan ID Registrasi Pengguna.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* PANGGIL KOMPONEN PRINT MODAL */}
            <React.Suspense fallback={null}>
                {printModalConfig.show && (
                    <PrintCardModal
                        show={printModalConfig.show}
                        onClose={() => setPrintModalConfig({ show: false, isBulk: false, data: null })}
                        data={printModalConfig.data}
                        config={appConfig}
                        isBulk={printModalConfig.isBulk}
                    />
                )}
            </React.Suspense>

            {/* MODAL TAUTAN TELEGRAM WALI MURID */}
            {telegramModal.show && telegramModal.student && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 dark:border-slate-700 space-y-4">
                        <div className="flex justify-between items-center pb-2 border-b border-gray-100 dark:border-slate-700">
                            <div className="flex items-center gap-2.5 text-blue-600 dark:text-blue-400">
                                <Send size={22} />
                                <h3 className="font-extrabold text-base text-gray-800 dark:text-white">Tautan Telegram {isEdu ? 'Wali Murid' : 'Pengguna'}</h3>
                            </div>
                            <button onClick={() => setTelegramModal({ show: false, student: null, botUsername: '' })} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-400">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-2 text-xs">
                            <p className="text-gray-500 dark:text-slate-400">
                                Hubungkan notifikasi kehadiran untuk {isEdu ? 'siswa' : 'karyawan'}:
                            </p>
                            <div className="p-3 bg-blue-50 dark:bg-slate-700/50 rounded-2xl border border-blue-100 dark:border-slate-600">
                                <p className="font-bold text-sm text-gray-800 dark:text-white">{telegramModal.student.nama_lengkap}</p>
                                <p className="text-gray-500 dark:text-slate-300">{labelKelompok}: {telegramModal.student.kelas || '-'} | ID: {telegramModal.student.identity_number || telegramModal.student.nipd}</p>
                                <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-bold">
                                    {telegramModal.student.telegram_chat_id ? (
                                        <span className="text-emerald-600 bg-emerald-100 dark:bg-emerald-900/40 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                            <CheckCircle2 size={13} /> Terhubung (ID: {telegramModal.student.telegram_chat_id})
                                        </span>
                                    ) : (
                                        <span className="text-amber-600 bg-amber-100 dark:bg-amber-900/40 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                            <AlertCircle size={13} /> Belum Terhubung
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {telegramModal.botUsername ? (
                            <div className="space-y-3">
                                <div>
                                    <label className="text-[11px] font-bold text-gray-400 block mb-1 uppercase tracking-wider">Tautan Khusus 1-Klik:</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            readOnly
                                            value={`https://t.me/${telegramModal.botUsername}?start=${telegramModal.student.identity_number || telegramModal.student.nipd || telegramModal.student.id}`}
                                            className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-xs font-mono text-gray-700 dark:text-slate-200 outline-none select-all"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const link = `https://t.me/${telegramModal.botUsername}?start=${telegramModal.student.identity_number || telegramModal.student.nipd || telegramModal.student.id}`;
                                                navigator.clipboard.writeText(link);
                                                showToast('success', "Tautan disalin ke clipboard!");
                                            }}
                                            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shrink-0 flex items-center gap-1.5 transition-all active:scale-95"
                                        >
                                            <Copy size={14} /> Salin
                                        </button>
                                    </div>
                                </div>

                                <div className="pt-2">
                                    <a
                                        href={`https://api.whatsapp.com/send?phone=${(telegramModal.student.nomor_telepon || '').replace(/[^0-9]/g, '').replace(/^0/, '62')}&text=${encodeURIComponent(`Yth. Bapak/Ibu Wali Murid dari ${telegramModal.student.nama_lengkap},\n\nSilakan klik tautan resmi berikut lalu tekan tombol START di Telegram untuk mengaktifkan notifikasi kehadiran putra/putri Anda secara otomatis:\n\nhttps://t.me/${telegramModal.botUsername}?start=${telegramModal.student.identity_number || telegramModal.student.nipd || telegramModal.student.id}\n\nTerima kasih.`)}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
                                    >
                                        <MessageCircle size={16} /> Kirim Tautan ke WhatsApp {isEdu ? 'Wali Murid' : 'Pengguna'}
                                    </a>
                                </div>
                            </div>
                        ) : (
                            <p className="text-xs text-rose-500 text-center py-2 flex items-center justify-center gap-1">
                                <AlertTriangle size={15} /> Bot Telegram belum aktif atau token belum diatur di menu Pengaturan.
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* MODAL BAGIKAN TAUTAN MASSAL */}
            {bulkTelegramModal.show && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 max-w-2xl w-full shadow-2xl border border-slate-100 dark:border-slate-700 space-y-4 max-h-[90vh] flex flex-col">
                        <div className="flex justify-between items-center pb-2 border-b border-gray-100 dark:border-slate-700 shrink-0">
                            <div className="flex items-center gap-2.5 text-blue-600 dark:text-blue-400">
                                <Send size={22} />
                                <div>
                                    <h3 className="font-extrabold text-base text-gray-800 dark:text-white">Bagikan Tautan Telegram Sekaligus</h3>
                                    <p className="text-xs text-gray-400">Kirim format pesan ke WhatsApp Group {labelKelompok} atau ekspor ke Excel</p>
                                </div>
                            </div>
                            <button onClick={() => setBulkTelegramModal({ ...bulkTelegramModal, show: false })} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-400">
                                <X size={20} />
                            </button>
                        </div>

                        {/* FILTER PILIHAN KELAS & STATUS */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 shrink-0 bg-slate-50 dark:bg-slate-700/30 p-3 rounded-2xl">
                            <div>
                                <label className="text-[11px] font-bold text-gray-400 block mb-1 uppercase tracking-wider">Filter {labelKelompok}:</label>
                                <select
                                    value={bulkTelegramModal.filterClass}
                                    onChange={e => setBulkTelegramModal(prev => ({ ...prev, filterClass: e.target.value }))}
                                    className="w-full bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-xs font-semibold text-gray-700 dark:text-slate-200 outline-none"
                                >
                                    <option value="">Semua {labelKelompok}</option>
                                    {classesOption.map(c => (
                                        <option key={c.id} value={c.nama_kelas || c.name}>{c.nama_kelas || c.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex items-center gap-2 pt-4">
                                <input
                                    type="checkbox"
                                    id="filter-unlinked-only"
                                    checked={bulkTelegramModal.onlyUnlinked}
                                    onChange={e => setBulkTelegramModal(prev => ({ ...prev, onlyUnlinked: e.target.checked }))}
                                    className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                                />
                                <label htmlFor="filter-unlinked-only" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                                    Hanya yang BELUM terhubung ({getBulkStudentsList().length} {isEdu ? 'siswa' : 'anggota'})
                                </label>
                            </div>
                        </div>

                        {/* PREVIEW FORMAT BROADCAST WHATSAPP */}
                        <div className="flex-1 overflow-hidden flex flex-col space-y-2">
                            <label className="text-[11px] font-bold text-gray-400 block uppercase tracking-wider">Pratinjau Pesan Grup WhatsApp:</label>
                            <textarea
                                readOnly
                                value={generateWhatsAppText()}
                                className="flex-1 w-full bg-slate-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl p-3 text-xs font-mono text-slate-700 dark:text-slate-300 outline-none resize-none custom-scrollbar select-all min-h-[180px]"
                            />
                        </div>

                        {/* TOMBOL AKSI CEPAT */}
                        <div className="flex flex-wrap gap-2.5 pt-2 border-t border-gray-100 dark:border-slate-700">
                            <button
                                type="button"
                                onClick={handleCopyBulkWhatsApp}
                                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
                            >
                                <Copy size={16} /> Salin Format Pesan WhatsApp
                            </button>
                            <button
                                type="button"
                                onClick={handleExportBulkTelegramExcel}
                                className="py-3 px-5 bg-blue-50 text-blue-600 dark:bg-slate-700 dark:text-blue-400 hover:bg-blue-100 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 border border-blue-200 dark:border-slate-600 active:scale-95 transition-all"
                            >
                                <FileSpreadsheet size={16} /> Unduh Excel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Students;