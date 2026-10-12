import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Moon } from 'lucide-react';
import { initFaceApi, findBestMatch } from '../../backend/utils/faceRecognition';

const CameraFaceScanner = ({ onScanSuccess, isLoading, members = [], notification = null }) => {
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const isScanningRef = useRef(true);
    const lastScannedIdRef = useRef("");
    const lastScannedTimeRef = useRef(0);
    const lastFaceSeenTimeRef = useRef(Date.now());

    const [isModelLoading, setIsModelLoading] = useState(true);
    const [cameraError, setCameraError] = useState(null);
    const [faceStatus, setFaceStatus] = useState("IDLE"); // 'IDLE', 'MATCHED', 'UNKNOWN'
    const [matchedUser, setMatchedUser] = useState(null);
    const [isSleep, setIsSleep] = useState(false);

    // Audio Feedback Beep
    const playBeep = (isSuccess = true) => {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);

            if (isSuccess) {
                osc.frequency.setValueAtTime(880, ctx.currentTime);
                gain.gain.setValueAtTime(0.15, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
                osc.start();
                osc.stop(ctx.currentTime + 0.15);
            } else {
                osc.frequency.setValueAtTime(220, ctx.currentTime);
                gain.gain.setValueAtTime(0.2, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
                osc.start();
                osc.stop(ctx.currentTime + 0.25);
            }
        } catch { }
    };

    // 1. Muat Model AI Wajah di latar belakang
    useEffect(() => {
        let isMounted = true;
        initFaceApi()
            .then(() => {
                if (isMounted) setIsModelLoading(false);
            })
            .catch((err) => {
                console.error("Gagal inisialisasi Face AI:", err);
                if (isMounted) {
                    setIsModelLoading(false);
                    setCameraError("Gagal memuat model pengenalan wajah.");
                }
            });
        return () => { isMounted = false; };
    }, []);

    // 2. Langsung Aktifkan Webcam PC Seketika (Tanpa menunggu AI selesai loading)
    useEffect(() => {
        let active = true;

        const startCamera = async () => {
            setCameraError(null);
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(t => t.stop());
            }

            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: { ideal: 640 }, height: { ideal: 480 } }
                });

                if (!active) {
                    stream.getTracks().forEach(t => t.stop());
                    return;
                }

                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
            } catch (err) {
                if (active) {
                    setCameraError(
                        err.name === 'NotAllowedError'
                            ? "Izin akses kamera ditolak. Silakan izinkan akses kamera di browser."
                            : "Webcam tidak ditemukan atau sedang digunakan aplikasi lain."
                    );
                }
            }
        };

        startCamera();

        return () => {
            active = false;
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(t => t.stop());
            }
        };
    }, []);

    // 3. Perulangan Deteksi Wajah, Mode Sleep & Auto-Wakeup
    useEffect(() => {
        let animationFrameId;
        let lastDetectTime = 0;
        const SLEEP_TIMEOUT = 2 * 60 * 1000; // 2 Menit tanpa wajah -> masuk mode sleep

        const detectLoop = async (timestamp) => {
            if (
                !isModelLoading &&
                window.faceapi &&
                videoRef.current &&
                videoRef.current.readyState >= 2 &&
                videoRef.current.videoWidth > 0 &&
                isScanningRef.current &&
                !isLoading &&
                !notification
            ) {
                const now = Date.now();
                const timeSinceLastFace = now - lastFaceSeenTimeRef.current;

                // Masuk mode sleep jika tidak ada wajah selama 2 menit
                if (!isSleep && timeSinceLastFace > SLEEP_TIMEOUT) {
                    setIsSleep(true);
                }

                // Saat sleep, jalankan deteksi hemat daya tiap 1.5 detik. Saat aktif, jalankan tiap 200ms
                const checkInterval = isSleep ? 1500 : 200;

                if (timestamp - lastDetectTime > checkInterval) {
                    lastDetectTime = timestamp;
                    try {
                        const faceapi = window.faceapi;
                        // Ukuran 224 jauh lebih cepat dan ringan di prosesor
                        const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.28 });
                        const detection = await faceapi
                            .detectSingleFace(videoRef.current, options)
                            .withFaceLandmarks()
                            .withFaceDescriptor();

                        if (detection && detection.descriptor) {
                            lastFaceSeenTimeRef.current = Date.now();

                            // Jika sedang sleep, deteksi wajah otomatis membangunkan sistem (Auto-Wakeup)
                            if (isSleep) {
                                setIsSleep(false);
                                return;
                            }

                            if (members.length === 0) {
                                setFaceStatus("UNKNOWN");
                                return;
                            }

                            const matchResult = findBestMatch(detection.descriptor, members, 0.60);

                            if (matchResult && matchResult.member) {
                                const matched = matchResult.member;
                                const memberId = matched.identity_number || matched.nipd || matched.rfid_code || matched.kode_rfid;

                                if (!memberId) return;

                                // Cooldown 4 detik untuk orang yang sama
                                if (lastScannedIdRef.current === memberId && (now - lastScannedTimeRef.current < 4000)) {
                                    return;
                                }

                                lastScannedIdRef.current = memberId;
                                lastScannedTimeRef.current = now;
                                isScanningRef.current = false; // Kunci sementara kamera
                                setFaceStatus("MATCHED");
                                setMatchedUser(matched.nama_lengkap || matched.full_name);
                                playBeep(true);

                                if (onScanSuccess) {
                                    onScanSuccess(memberId);
                                }

                                setTimeout(() => {
                                    setFaceStatus("IDLE");
                                    setMatchedUser(null);
                                    isScanningRef.current = true;
                                }, 3000);
                            } else {
                                setFaceStatus("UNKNOWN");
                            }
                        } else {
                            if (faceStatus !== "MATCHED") {
                                setFaceStatus("IDLE");
                            }
                        }
                    } catch (e) {
                        // Abaikan frame transisi
                    }
                }
            }
            animationFrameId = requestAnimationFrame(detectLoop);
        };

        animationFrameId = requestAnimationFrame(detectLoop);
        return () => cancelAnimationFrame(animationFrameId);
    }, [isModelLoading, isLoading, members, faceStatus, isSleep, notification, onScanSuccess]);

    return (
        <div className={`relative w-full h-full rounded-2xl overflow-hidden bg-black flex items-center justify-center transition-all duration-300 ${faceStatus === 'MATCHED' ? 'ring-4 ring-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.4)]' : ''
            }`}>
            {/* 1. NOTIFIKASI HASIL SCAN MENGAMBANG DI ATAS KAMERA */}
            {notification && (
                <div className="absolute top-3 left-3 right-3 z-30 animate-in slide-in-from-top-4 duration-300">
                    <div className={`p-3 rounded-2xl backdrop-blur-xl border shadow-2xl flex items-center justify-between gap-3 ${notification.type === 'ERROR'
                            ? 'bg-rose-950/90 border-rose-500/50 text-rose-200'
                            : notification.status === 'TERLAMBAT'
                                ? 'bg-amber-950/90 border-amber-500/50 text-amber-200'
                                : 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
                        }`}>
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${notification.type === 'ERROR'
                                    ? 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                                    : notification.status === 'TERLAMBAT'
                                        ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                                        : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                                }`}>
                                {notification.type === 'ERROR' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
                            </div>
                            <div className="min-w-0 text-left">
                                <div className="flex items-center gap-2">
                                    <h4 className="text-xs font-black text-white uppercase tracking-wide truncate max-w-[130px]">
                                        {notification.nama}
                                    </h4>
                                    <span className={`px-2 py-0.5 rounded-full text-[8px] font-extrabold uppercase tracking-wider ${notification.type === 'ERROR' ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white'
                                        }`}>
                                        {notification.status}
                                    </span>
                                </div>
                                <p className="text-[10px] font-bold opacity-80 truncate mt-0.5">
                                    {notification.pesan}
                                </p>
                            </div>
                        </div>
                        <div className="text-right shrink-0">
                            <span className="text-[10px] font-mono font-bold text-white/90">{notification.waktu}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* 2. MODE SLEEP / STANDBY (HEMAT DAYA) */}
            {isSleep && (
                <div
                    onClick={() => { setIsSleep(false); lastFaceSeenTimeRef.current = Date.now(); }}
                    className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/85 backdrop-blur-md p-6 text-center cursor-pointer transition-all duration-500 animate-in fade-in"
                >
                    <div className="w-16 h-16 rounded-3xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-4 animate-pulse">
                        <Moon size={28} />
                    </div>
                    <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-1">Mode Siaga (Standby)</h4>
                    <p className="text-[11px] text-white/50 max-w-[200px] leading-relaxed">
                        Berdiri di depan kamera untuk mengaktifkan absensi otomatis
                    </p>
                    <span className="mt-4 px-3 py-1 bg-white/5 hover:bg-white/10 rounded-full border border-white/10 text-white/40 text-[9px] uppercase tracking-widest">
                        Ketuk untuk bangunkan
                    </span>
                </div>
            )}

            {/* Indikator Memuat AI (Kecil di bawah, tidak menutup video) */}
            {isModelLoading && (
                <div className="absolute bottom-3 px-3 py-1.5 bg-black/70 backdrop-blur-md border border-white/10 rounded-full flex items-center gap-2 text-blue-400 text-[10px] font-bold z-20 animate-pulse">
                    <Loader2 size={13} className="animate-spin" />
                    <span>Menyiapkan Deteksi Wajah...</span>
                </div>
            )}

            {/* Error State */}
            {cameraError && (
                <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-900/95 text-white p-6 text-center">
                    <AlertCircle size={40} className="text-rose-500 mb-3 animate-bounce" />
                    <p className="text-xs font-bold uppercase tracking-wider text-rose-400 mb-1">Kamera Bermasalah</p>
                    <p className="text-[11px] text-white/60 leading-relaxed max-w-[240px] mb-4">{cameraError}</p>
                </div>
            )}

            {/* Video Element Bersih (Normal, Tanpa Flip, Tanpa Oval) */}
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
            />
        </div>
    );
};

export default CameraFaceScanner;
