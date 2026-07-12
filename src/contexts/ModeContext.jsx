import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../api/axios';

const ModeContext = createContext();

export const ModeProvider = ({ children }) => {
  const [modeConfig, setModeConfig] = useState({
    app_mode: 'korporat',
    labels: {
      label_unit: 'Departemen/Divisi',
      label_anggota: 'Karyawan/Staff',
      label_wali: 'Manajer/Supervisor',
      label_identitas: 'ID Karyawan'
    },
    loading: true
  });

  const fetchSettings = async () => {
    try {
      const res = await api.get('/settings');
      if (res.data) {
        setModeConfig({
          app_mode: res.data.app_mode || 'korporat',
          labels: res.data.labels || {
            label_unit: 'Departemen/Divisi',
            label_anggota: 'Karyawan/Staff',
            label_wali: 'Manajer/Supervisor',
            label_identitas: 'ID Karyawan'
          },
          loading: false
        });
      }
    } catch (error) {
      console.error("Gagal memuat konfigurasi mode:", error);
      setModeConfig(prev => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return (
    <ModeContext.Provider value={{ ...modeConfig, refreshMode: fetchSettings }}>
      {children}
    </ModeContext.Provider>
  );
};

export const useMode = () => useContext(ModeContext);
