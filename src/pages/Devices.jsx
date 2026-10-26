import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity, AlertTriangle, CheckCircle2, CircleHelp, DownloadCloud,
  Fingerprint, LoaderCircle, Plus, RefreshCw, Server, Trash2, Wifi, X
} from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../api/axios';

const EMPTY_FORM = { name: '', ip_address: '', port: 4370 };

function readDevices(response) {
  const payload = response?.data;
  if (Array.isArray(payload?.devices)) return payload.devices;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload)) return payload;
  return [];
}

function errorText(error, fallback) {
  return error?.response?.data?.message || error?.message || fallback;
}

function DeviceModal({ title, subtitle, children, onClose, closeDisabled = false, width = 'max-w-lg' }) {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm" role="presentation" onMouseDown={event => {
      if (event.target === event.currentTarget && !closeDisabled) onClose();
    }}>
      <section className={`w-full ${width} overflow-hidden rounded-3xl border border-sky-100 bg-white shadow-2xl shadow-slate-950/20 dark:border-slate-700 dark:bg-slate-900`} role="dialog" aria-modal="true" aria-labelledby="device-modal-title">
        <div className="h-1 bg-gradient-to-r from-blue-900 via-sky-500 to-orange-300" />
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 dark:border-slate-800 sm:px-6">
          <div>
            <h2 id="device-modal-title" className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">{title}</h2>
            {subtitle && <p className="mt-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{subtitle}</p>}
          </div>
          <button type="button" disabled={closeDisabled} onClick={onClose} className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-white" aria-label="Tutup dialog">
            <X size={17} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

export default function Devices() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [actionModal, setActionModal] = useState(null);

  const fetchDevices = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const response = await api.get('/devices');
      setDevices(readDevices(response));
    } catch (error) {
      toast.error(errorText(error, 'Gagal memuat daftar perangkat.'));
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  const openAdd = () => {
    setFormData(EMPTY_FORM);
    setShowForm(true);
  };

  const handleAdd = async event => {
    event.preventDefault();
    const port = Number(formData.port);
    if (!formData.name.trim() || !formData.ip_address.trim() || !Number.isInteger(port) || port < 1 || port > 65535) {
      toast.warning('Lengkapi nama, alamat IP, dan port yang valid.');
      return;
    }

    setSaving(true);
    try {
      await api.post('/devices', {
        name: formData.name.trim(),
        ip_address: formData.ip_address.trim(),
        port
      });
      setShowForm(false);
      setFormData(EMPTY_FORM);
      toast.success('Perangkat berhasil ditambahkan.');
      await fetchDevices(true);
    } catch (error) {
      toast.error(errorText(error, 'Gagal menambahkan perangkat.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/devices/${deleteTarget.id}`);
      toast.success(`Perangkat “${deleteTarget.name}” berhasil dihapus.`);
      setDeleteTarget(null);
      await fetchDevices(true);
    } catch (error) {
      toast.error(errorText(error, 'Gagal menghapus perangkat.'));
    } finally {
      setDeleteLoading(false);
    }
  };

  const runDeviceAction = async (device, action) => {
    const isTest = action === 'test';
    setActionModal({
      type: action,
      device,
      status: 'processing',
      title: isTest ? 'Menguji koneksi perangkat' : 'Mengambil log presensi',
      message: isTest
        ? `Menguji koneksi ke ${device.ip_address}:${device.port}.`
        : `Mengambil riwayat presensi hari ini dari ${device.name}.`
    });

    try {
      const response = isTest
        ? await api.post('/devices/test', { ip_address: device.ip_address, port: device.port })
        : await api.post('/devices/sync', { ip_address: device.ip_address, port: device.port });
      const data = response?.data || {};
      const succeeded = isTest ? data.success !== false : data.success === true;
      const status = succeeded ? 'success' : 'warning';
      const message = data.message || (isTest ? 'Koneksi perangkat berhasil diuji.' : 'Proses pengambilan data selesai.');
      setActionModal({
        type: action,
        device,
        status,
        title: isTest ? (succeeded ? 'Koneksi berhasil' : 'Koneksi perlu diperiksa') : (succeeded ? 'Pengambilan data selesai' : 'Data belum berhasil diambil'),
        message
      });
      if (succeeded) toast.success(message);
      else toast.warning(message);
      if (!isTest && succeeded) await fetchDevices(true);
    } catch (error) {
      const message = errorText(error, isTest ? 'Gagal terhubung ke perangkat.' : 'Gagal mengambil data dari perangkat.');
      setActionModal({
        type: action,
        device,
        status: 'error',
        title: isTest ? 'Koneksi gagal' : 'Pengambilan data gagal',
        message
      });
      toast.error(message);
    }
  };

  const isEmpty = !loading && devices.length === 0;

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-8">
      <section className="relative isolate overflow-hidden rounded-3xl border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-orange-50 p-5 shadow-[0_18px_55px_rgba(28,100,160,0.08)] dark:border-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-blue-950/50 sm:p-7">
        <div className="pointer-events-none absolute -right-12 -top-14 h-48 w-48 rounded-full bg-sky-300/20 blur-3xl dark:bg-blue-500/10" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-950 via-blue-800 to-sky-500 text-white shadow-md shadow-blue-950/10">
              <Fingerprint size={23} />
            </div>
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-blue-800 dark:text-sky-300">KONEKTIVITAS PERANGKAT</p>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-950 dark:text-white sm:text-3xl">Perangkat Kehadiran</h1>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">Kelola mesin presensi, uji koneksi, dan tarik log dengan dialog yang konsisten dengan tema Nebula.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <button type="button" onClick={() => fetchDevices()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-sky-200 hover:bg-sky-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Muat ulang
            </button>
            <button type="button" onClick={openAdd} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-900 to-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm shadow-blue-900/15 transition hover:brightness-105">
              <Plus size={16} /> Tambah perangkat
            </button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-blue-700 dark:bg-sky-950/40 dark:text-sky-300"><Server size={18} /></span>
          <div><p className="text-xs font-medium text-slate-500 dark:text-slate-400">Terdaftar</p><p className="text-xl font-extrabold text-slate-900 dark:text-white">{devices.length}</p></div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"><Wifi size={18} /></span>
          <div><p className="text-xs font-medium text-slate-500 dark:text-slate-400">Koneksi</p><p className="text-sm font-bold text-slate-900 dark:text-white">Uji sesuai kebutuhan</p></div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300"><Activity size={18} /></span>
          <div><p className="text-xs font-medium text-slate-500 dark:text-slate-400">Aksi perangkat</p><p className="text-sm font-bold text-slate-900 dark:text-white">Test & tarik log</p></div>
        </div>
      </section>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map(item => <div key={item} className="h-48 animate-pulse rounded-3xl border border-slate-100 bg-white/80 dark:border-slate-800 dark:bg-slate-900" />)}
        </div>
      ) : isEmpty ? (
        <div className="rounded-3xl border border-dashed border-sky-200 bg-white/80 px-6 py-14 text-center dark:border-slate-700 dark:bg-slate-900/80">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-50 text-blue-700 dark:bg-sky-950/40 dark:text-sky-300"><Fingerprint size={26} /></div>
          <h2 className="mt-4 text-lg font-extrabold text-slate-900 dark:text-white">Belum ada perangkat</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-500 dark:text-slate-400">Tambahkan mesin presensi dengan alamat IP dan port yang benar. Setelah tersimpan, Anda dapat menguji koneksi atau mengambil log.</p>
          <button type="button" onClick={openAdd} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-900 to-blue-600 px-4 py-2.5 text-sm font-bold text-white"><Plus size={16} /> Tambah perangkat pertama</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {devices.map(device => (
            <article key={device.id} className="group flex min-w-0 flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-lg hover:shadow-sky-950/5 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700">
              <div>
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-50 to-blue-100 text-blue-800 dark:from-slate-800 dark:to-blue-950 dark:text-sky-300"><Fingerprint size={19} /></span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"><span className="h-1.5 w-1.5 rounded-full bg-slate-400" />Terdaftar</span>
                </div>
                <h2 className="mt-4 break-words text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">{device.name || 'Mesin tanpa nama'}</h2>
                <p className="mt-1 break-all font-mono text-sm text-slate-500 dark:text-slate-400">{device.ip_address || 'Alamat IP belum diatur'}</p>
                <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300"><Server size={14} /> Port {device.port || 4370}</div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                <button type="button" onClick={() => runDeviceAction(device, 'test')} className="inline-flex items-center justify-center gap-2 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2.5 text-xs font-bold text-blue-800 transition hover:border-sky-200 hover:bg-sky-100 dark:border-slate-700 dark:bg-slate-800 dark:text-sky-300 dark:hover:bg-slate-700"><RefreshCw size={14} /> Uji koneksi</button>
                <button type="button" onClick={() => runDeviceAction(device, 'sync')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-800 px-3 py-2.5 text-xs font-bold text-white transition hover:bg-blue-700"><DownloadCloud size={14} /> Tarik log</button>
                <button type="button" onClick={() => setDeleteTarget(device)} className="col-span-2 inline-flex items-center justify-center gap-2 rounded-xl border border-rose-100 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 dark:border-rose-900/40 dark:text-rose-300 dark:hover:bg-rose-950/30"><Trash2 size={14} /> Hapus perangkat</button>
              </div>
            </article>
          ))}
        </div>
      )}

      {showForm && (
        <DeviceModal title="Tambah perangkat" subtitle="Masukkan informasi koneksi mesin presensi." onClose={() => !saving && setShowForm(false)} closeDisabled={saving}>
          <form onSubmit={handleAdd} className="space-y-4 p-5 sm:p-6">
            <label className="block space-y-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <span>Nama perangkat</span>
              <input autoFocus required maxLength={100} value={formData.name} onChange={event => setFormData({ ...formData, name: event.target.value })} placeholder="Contoh: Mesin Pintu Utama" className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-normal text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-sky-950/50" />
            </label>
            <label className="block space-y-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <span>Alamat IP</span>
              <input required maxLength={255} value={formData.ip_address} onChange={event => setFormData({ ...formData, ip_address: event.target.value })} placeholder="192.168.1.201" className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 font-mono text-sm font-normal text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-sky-950/50" />
            </label>
            <label className="block space-y-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <span>Port TCP</span>
              <input required type="number" min="1" max="65535" step="1" value={formData.port} onChange={event => setFormData({ ...formData, port: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-normal text-slate-800 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-sky-950/50" />
            </label>
            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
              <button type="button" disabled={saving} onClick={() => setShowForm(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">Batal</button>
              <button type="submit" disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-900 to-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm disabled:opacity-60">
                {saving ? <LoaderCircle size={16} className="animate-spin" /> : <Plus size={16} />} {saving ? 'Menyimpan...' : 'Simpan perangkat'}
              </button>
            </div>
          </form>
        </DeviceModal>
      )}

      {deleteTarget && (
        <DeviceModal title="Hapus perangkat?" subtitle="Tindakan ini akan menghapus perangkat dari daftar aplikasi." onClose={() => !deleteLoading && setDeleteTarget(null)} closeDisabled={deleteLoading} width="max-w-md">
          <div className="p-5 sm:p-6">
            <div className="flex items-start gap-3 rounded-2xl border border-rose-100 bg-rose-50/80 p-4 dark:border-rose-900/40 dark:bg-rose-950/20">
              <AlertTriangle size={19} className="mt-0.5 shrink-0 text-rose-600 dark:text-rose-300" />
              <div className="min-w-0"><p className="break-words text-sm font-bold text-slate-800 dark:text-white">{deleteTarget.name}</p><p className="mt-1 break-all text-xs text-slate-500 dark:text-slate-400">{deleteTarget.ip_address}:{deleteTarget.port}</p></div>
            </div>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" disabled={deleteLoading} onClick={() => setDeleteTarget(null)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">Batal</button>
              <button type="button" disabled={deleteLoading} onClick={handleDelete} className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-rose-700 disabled:opacity-60">
                {deleteLoading ? <LoaderCircle size={16} className="animate-spin" /> : <Trash2 size={15} />} {deleteLoading ? 'Menghapus...' : 'Ya, hapus perangkat'}
              </button>
            </div>
          </div>
        </DeviceModal>
      )}

      {actionModal && (
        <DeviceModal title={actionModal.title} subtitle={`${actionModal.device.name} · ${actionModal.device.ip_address}:${actionModal.device.port}`} onClose={() => setActionModal(null)} closeDisabled={actionModal.status === 'processing'} width="max-w-md">
          <div className="p-6">
            <div className={`relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl ${actionModal.status === 'success' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-300' : actionModal.status === 'error' || actionModal.status === 'warning' ? 'bg-orange-50 text-orange-600 dark:bg-orange-950/30 dark:text-orange-300' : 'bg-sky-50 text-blue-700 dark:bg-sky-950/40 dark:text-sky-300'}`}>
              {actionModal.status === 'processing' ? <LoaderCircle size={28} className="animate-spin" /> : actionModal.status === 'success' ? <CheckCircle2 size={28} /> : actionModal.status === 'error' ? <AlertTriangle size={28} /> : <CircleHelp size={28} />}
              {actionModal.status === 'processing' && <span className="absolute inset-0 rounded-2xl border border-sky-300/70 animate-ping" />}
            </div>
            {actionModal.status === 'processing' && <div className="mx-auto mt-5 h-1.5 max-w-xs overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="nebula-transfer-glow h-full w-2/3 rounded-full bg-gradient-to-r from-blue-800 via-sky-400 to-orange-300" /></div>}
            <p className="mt-5 text-center text-sm leading-relaxed text-slate-600 dark:text-slate-300">{actionModal.message}</p>
            {actionModal.status !== 'processing' && <button type="button" onClick={() => setActionModal(null)} className="mt-6 w-full rounded-xl bg-gradient-to-r from-blue-900 to-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:brightness-105">Selesai</button>}
          </div>
        </DeviceModal>
      )}
    </div>
  );
}
