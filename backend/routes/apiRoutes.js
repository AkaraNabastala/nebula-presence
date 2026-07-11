// file: routes/apiRoutes.js

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController');
const attendanceController = require('../controllers/attendanceController');
const masterController = require('../controllers/masterController');
const licenseController = require('../controllers/licenseController');
const systemController = require('../controllers/systemController');
const upload = require('../middleware/upload'); // Pastikan file ini ada

// Rate Limiter untuk Login (Anti Brute Force)
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 menit
    max: 20, // Limit 20 request per IP
    message: { message: "Terlalu banyak percobaan login. Coba lagi nanti." }
});

// ==========================================
// 1. PUBLIC / ESSENTIAL ROUTES (WHITELISTED)
// ==========================================
// Route ini harus tetap bisa diakses walau lisensi mati (diurus strictGuard)
router.get('/license-status', licenseController.checkStatus);
router.post('/activation', licenseController.activate);
router.post('/login', loginLimiter, authController.login);
router.get('/settings', masterController.getSettings); // Biar logo sekolah tampil di Login/LockScreen

// ==========================================
// 2. PROTECTED FEATURES (DATA)
// ==========================================
router.put('/profile', authController.updateProfile);

// --- ATTENDANCE ---
router.post('/scan', attendanceController.scanRFID);
router.get('/dashboard', attendanceController.getDashboardStats);
router.get('/attendance/report', attendanceController.getReport);
router.get('/attendance/daily', attendanceController.getDailyAttendance);
router.post('/attendance/manual', attendanceController.manualAttendance);

// --- MASTER DATA (MEMBERS / ANGGOTA) ---
// Perbaikan: Mengubah panggilan fungsi ke nama fungsi baru (getAllMembers, createMember, dll)
router.get('/members', masterController.getAllMembers);
router.post('/members', masterController.createMember);
router.put('/members/:id', masterController.updateMember);
router.delete('/members/:id', masterController.deleteMember);
router.post('/members/upload-photo', systemController.uploadPhotoBase64); 

// --- MASTER DATA (DIVISIONS / KELAS / DEPARTEMEN) ---
// Perbaikan: Mengubah panggilan fungsi ke nama fungsi baru (getAllDivisions, dll)
router.get('/divisions', masterController.getAllDivisions);
router.post('/divisions', masterController.createDivision);
router.put('/divisions/:id', masterController.updateDivision);
router.delete('/divisions/:id', masterController.deleteDivision);

// --- SYSTEM & SETTINGS ---
router.post('/settings', masterController.updateSettings);
router.get('/backup', masterController.downloadBackup);
router.post('/restore', upload.single('backup_file'), systemController.restoreDatabase);

module.exports = router;