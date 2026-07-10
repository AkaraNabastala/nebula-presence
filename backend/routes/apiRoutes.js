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

// --- MASTER DATA (SISWA) ---
router.get('/members', masterController.getAllStudents);
router.post('/members', masterController.createStudent);
router.put('/members/:id', masterController.updateStudent);
router.delete('/members/:id', masterController.deleteStudent);
router.post('/members/upload-photo', systemController.uploadPhotoBase64); 
// Note: uploadPhotoBase64 lebih aman & mudah untuk LAN daripada Multipart form

// --- MASTER DATA (KELAS) ---
router.get('/divisions', masterController.getAllClasses);
router.post('/divisions', masterController.createClass);
router.put('/divisions/:id', masterController.updateClass);
router.delete('/divisions/:id', masterController.deleteClass);

// --- SYSTEM & SETTINGS ---
router.post('/settings', masterController.updateSettings);
router.get('/backup', masterController.downloadBackup);
router.post('/restore', upload.single('backup_file'), systemController.restoreDatabase);

module.exports = router;