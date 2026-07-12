import React, { useState } from 'react';
import { Database as DatabaseIcon, DownloadCloud, UploadCloud, CheckCircle, AlertCircle, X } from 'lucide-react';
import api from '../../api/axios';

const Database = () => {
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState({ show: false, type: '', message: '' });

  const showToast = (type, message) => {
    setNotification({ show: true, type, message });
    setTimeout(() => setNotification({ show: false, type: '', message: '' }), 3000);
  };

  const handleBackup = async () => {
      try {
          const response = await api.get('/backup', { responseType: 'blob' });
          const url = window.URL.createObjectURL(new Blob([response.data]));
          const link = document.createElement('a');
          link.href = url;
          link.setAttribute('download', `backup_database_${new Date().toISOString().slice(0,10)}.sql`);
          document.body.appendChild(link);
          link.click();
          link.parentNode.removeChild(link);
          showToast('success', "Backup berhasil diunduh!");
      } catch (error) {
          showToast('error', "Gagal mengunduh backup database.");
      }
  };

  const handleRestore = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const formData = new FormData();
      formData.append('backup_file', file);

      setLoading(true);
      try {
          await api.post('/restore', formData, {
              headers: { 'Content-Type': 'multipart/form-data' }
          });
          showToast('success', "Database berhasil direstore! Memuat ulang...");
          setTimeout(() => {
              window.location.reload();
          }, 1500);
      } catch (error) {
          showToast('error', "Gagal melakukan restore database.");
      }
      setLoading(false);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-24 md:pb-10 font-sans">
      {notification.show && (
        <div className={`fixed top-4 right-4 z-[99] flex items-center gap-3 px-5 py-4 rounded-xl shadow-2xl animate-in slide-in-from-right border bg-white ${notification.type === 'success' ? 'border-green-200 text-green-700' : 'border-red-200 text-red-700'}`}>
            {notification.type === 'success' ? <CheckCircle size={22} className="text-green-500"/> : <AlertCircle size={22} className="text-red-500"/>}
            <div><h4 className="font-bold text-sm">{notification.type === 'success' ? 'Berhasil' : 'Gagal'}</h4><p className="text-xs text-gray-500">{notification.message}</p></div>
            <button onClick={() => setNotification({ show: false })}><X size={18} className="text-gray-400"/></button>
        </div>
      )}
      
      {/* HEADER */}
      <div className="flex items-center gap-4 mb-8">
          <div className="p-3 bg-white border border-gray-100 rounded-2xl shadow-sm text-purple-600">
              <DatabaseIcon size={28}/>
          </div>
          <div>
              <h2 className="text-2xl font-bold text-gray-800">Manajemen Database</h2>
              <p className="text-sm text-gray-500">Amankan data presensi secara rutin. Cadangkan atau pulihkan data Anda.</p>
          </div>
      </div>

      <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 md:p-8 flex flex-col md:flex-row gap-8">
            <div className="w-full md:w-1/3">
                <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center mb-4 border border-purple-100">
                    <DatabaseIcon size={24} className="text-purple-500" />
                </div>
                <h2 className="text-xl font-bold text-gray-800 mb-2">Pusat Data</h2>
                <p className="text-sm text-gray-500 leading-relaxed">
                    Fitur ini memungkinkan Anda untuk mencadangkan (Backup) atau memulihkan (Restore) seluruh konfigurasi dan riwayat absen dalam satu file.
                </p>
            </div>
            <div className="w-full md:w-2/3 grid grid-cols-1 md:grid-cols-2 gap-4">
                
                <div className="border border-gray-200 p-6 rounded-2xl flex flex-col items-center justify-center text-center">
                    <DownloadCloud size={32} className="text-blue-500 mb-3" />
                    <h3 className="font-bold text-gray-800 mb-1">Backup Data</h3>
                    <p className="text-xs text-gray-500 mb-4">Unduh semua data ke format .sql</p>
                    <button onClick={handleBackup} className="px-6 py-2 bg-blue-50 text-blue-600 font-bold rounded-xl hover:bg-blue-100 transition-colors w-full">
                        Download Backup
                    </button>
                </div>

                <div className="border border-gray-200 p-6 rounded-2xl flex flex-col items-center justify-center text-center relative">
                    {loading && (
                        <div className="absolute inset-0 bg-white/80 rounded-2xl flex items-center justify-center z-10 backdrop-blur-sm">
                            <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    )}
                    <UploadCloud size={32} className="text-orange-500 mb-3" />
                    <h3 className="font-bold text-gray-800 mb-1">Restore Data</h3>
                    <p className="text-xs text-gray-500 mb-4">Pulihkan dari file .sql</p>
                    <label className="px-6 py-2 bg-orange-50 text-orange-600 font-bold rounded-xl hover:bg-orange-100 transition-colors w-full cursor-pointer relative z-0">
                        Upload & Restore
                        <input type="file" accept=".sql" onChange={handleRestore} disabled={loading} className="hidden" />
                    </label>
                </div>
                
            </div>
        </div>
      </div>
    </div>
  );
};

export default Database;
