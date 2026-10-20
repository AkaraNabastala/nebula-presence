import React, { Suspense, useState } from 'react';

const JadwalPembelajaran = React.lazy(() => import('./JadwalPembelajaran.jsx'));
const Subjects = React.lazy(() => import('./Subjects.jsx'));

export default function Akademik() {
  const [activeTab, setActiveTab] = useState('jadwal');

  const tabs = [
    { id: 'jadwal', label: 'Jadwal Mengajar' },
    { id: 'mapel', label: 'Mata Pelajaran' },
  ];

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Akademik
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Kelola mata pelajaran dan jadwal belajar berdasarkan kelas.
        </p>
      </div>

      <div
        role="tablist"
        aria-label="Menu Akademik"
        className="flex flex-wrap gap-2 border-b dark:border-gray-700"
      >
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <Suspense
        fallback={
          <div className="p-6 text-sm text-gray-500">
            Memuat halaman Akademik...
          </div>
        }
      >
        {activeTab === 'jadwal' ? <JadwalPembelajaran /> : <Subjects />}
      </Suspense>
    </div>
  );
}
