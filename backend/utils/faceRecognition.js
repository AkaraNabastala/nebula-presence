// backend/utils/faceRecognition.js

let isModelsLoaded = false;
let isLoadingModels = false;
let loadPromise = null;

// CDN Resmi Face-API & Model Weights (Cepat & Ringan)
const SCRIPT_URL = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js';
const MODEL_URL = 'https://cdn.jsdelivr.net/gh/cgarciagl/face-api.js@master/weights';

/**
 * Inisialisasi library Face-API dan load model neural network.
 */
export const initFaceApi = async () => {
    if (isModelsLoaded && window.faceapi) return window.faceapi;
    if (isLoadingModels) return loadPromise;

    isLoadingModels = true;
    loadPromise = (async () => {
        // 1. Muat library face-api.js jika belum tersedia di window
        if (!window.faceapi) {
            await new Promise((resolve, reject) => {
                const existingScript = document.querySelector(`script[src="${SCRIPT_URL}"]`);
                if (existingScript) {
                    if (window.faceapi) return resolve();
                    existingScript.addEventListener('load', resolve);
                    existingScript.addEventListener('error', reject);
                    return;
                }
                const script = document.createElement('script');
                script.src = SCRIPT_URL;
                script.async = true;
                script.onload = () => resolve();
                script.onerror = () => reject(new Error("Gagal memuat script Face-API"));
                document.head.appendChild(script);
            });
        }

        const faceapi = window.faceapi;

        // 2. Muat model deteksi wajah, landmark wajah, dan pengenalan wajah (128-d descriptor)
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);

        isModelsLoaded = true;
        isLoadingModels = false;
        return faceapi;
    })();

    return loadPromise;
};

/**
 * Normalisasi elemen gambar/foto ke offscreen Canvas berukuran wajar (maks 800px)
 * agar deteksi wajah bekerja konsisten pada foto HP beresolusi tinggi.
 */
const normalizeInputElement = (input) => {
    if (typeof document === 'undefined') return input;
    if (input instanceof HTMLCanvasElement || input instanceof HTMLVideoElement) {
        return input;
    }

    if (input instanceof HTMLImageElement || (typeof Image !== 'undefined' && input instanceof Image)) {
        const canvas = document.createElement('canvas');
        const maxDim = 800;
        let width = input.naturalWidth || input.width || 640;
        let height = input.naturalHeight || input.height || 480;

        if (width > maxDim || height > maxDim) {
            if (width > height) {
                height = Math.round((height * maxDim) / width);
                width = maxDim;
            } else {
                width = Math.round((width * maxDim) / height);
                height = maxDim;
            }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(input, 0, 0, width, height);
        return canvas;
    }

    return input;
};

/**
 * Ekstrak 128 vektor biometrik wajah dari Image, Canvas, atau Video.
 * Mengembalikan Array 128 angka float, atau null jika tidak ada wajah.
 */
export const extractFaceDescriptor = async (inputElement) => {
    try {
        const faceapi = await initFaceApi();
        if (!faceapi) return null;

        const processEl = normalizeInputElement(inputElement);

        // Tahap 1: Deteksi dengan inputSize 320 & threshold 0.3
        let options = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.3 });
        let detection = await faceapi
            .detectSingleFace(processEl, options)
            .withFaceLandmarks()
            .withFaceDescriptor();

        // Tahap 2: Fallback jika belum kena (misal foto agak jauh/pencahayaan redup)
        if (!detection) {
            options = new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.22 });
            detection = await faceapi
                .detectSingleFace(processEl, options)
                .withFaceLandmarks()
                .withFaceDescriptor();
        }

        if (!detection || !detection.descriptor) {
            return null;
        }

        return Array.from(detection.descriptor);
    } catch (err) {
        console.warn("Gagal mengekstrak wajah:", err);
        return null;
    }
};

/**
 * Mencocokkan wajah yang sedang dipindai dengan daftar pengguna terdaftar.
 * Menggunakan perhitungan jarak Euclidean (threshold 0.58 untuk pencocokan optimal).
 */
export const findBestMatch = (queryDescriptor, members, threshold = 0.58) => {
    if (!window.faceapi || !queryDescriptor || !Array.isArray(members)) return null;
    const faceapi = window.faceapi;

    const queryVec = new Float32Array(queryDescriptor);
    let bestMatch = null;
    let minDistance = threshold;

    for (const member of members) {
        if (!member.face_descriptor) continue;
        try {
            const raw = typeof member.face_descriptor === 'string'
                ? JSON.parse(member.face_descriptor)
                : member.face_descriptor;

            if (!Array.isArray(raw) || raw.length !== 128) continue;

            const memberVec = new Float32Array(raw);
            const distance = faceapi.euclideanDistance(queryVec, memberVec);

            if (distance < minDistance) {
                minDistance = distance;
                bestMatch = { member, distance };
            }
        } catch {
            // Lewati jika data descriptor korup
        }
    }

    return bestMatch;
};
