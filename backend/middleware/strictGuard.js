const { checkLicenseInternal } = require('../utils/licenseManager');

const strictGuard = (req, res, next) => {
    // --- 1. DAFTAR PUTIH (WHITELIST) ---
    // Rute-rute ini HARUS bisa diakses meskipun file lisensi belum ada
    const allowedPaths = [
        '/login',
        '/activation',
        '/license-status',
        '/settings',
        '/backup',
        '/restore'
    ];

    // Cek apakah rute saat ini ada di whitelist
    // req.path di sini adalah rute setelah '/api' (misal: /activation)
    const isAllowed = allowedPaths.some(path => req.path === path || req.path.startsWith(path));

    if (isAllowed) {
        // Jika masuk daftar putih, langsung lanjut tanpa cek file lisensi
        return next(); 
    }

    // --- 2. CEK LISENSI (Hanya untuk rute di luar whitelist) ---
    const status = checkLicenseInternal();

    if (!status.valid) {
        console.warn(`[BLOCKED] ${req.method} ${req.path} - Alasan: ${status.message}`);
        return res.status(403).json({
            success: false,
            isLocked: true,
            message: status.message
        });
    }

    next();
};

module.exports = strictGuard;