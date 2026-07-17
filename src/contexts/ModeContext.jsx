import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../api/axios';

const ModeContext = createContext();

export const ModeProvider = ({ children }) => {
  const [modeConfig, setModeConfig] = useState({
    app_mode: 'korporat',
    labels: {
      label_kelompok: 'Kelompok',
      label_pengguna: 'Pengguna',
      label_wali: 'Manajer/Supervisor',
      label_identitas: 'ID Pengguna'
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
            label_kelompok: 'Kelompok',
            label_pengguna: 'Pengguna',
            label_wali: 'Manajer/Supervisor',
            label_identitas: 'ID Pengguna'
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchSettings();
  }, []);

  return (
    <ModeContext.Provider value={{ ...modeConfig, refreshMode: fetchSettings }}>
      {children}
    </ModeContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useMode = () => useContext(ModeContext);
