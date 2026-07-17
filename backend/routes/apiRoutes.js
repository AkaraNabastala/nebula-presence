const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

// Controller (Gunakan path absolut atau pastikan nama file benar)
const authController = require('../controllers/authController');
const attendanceController = require('../controllers/attendanceController');
const masterController = require('../controllers/masterController');
const licenseController = require('../controllers/licenseController');
const systemController = require('../controllers/systemController');
const deviceController = require('../controllers/deviceController');
const holidaysController = require('../controllers/holidaysController');

// Middleware
const upload = require('../middleware/upload');
const authGuard = require('../middleware/authGuard');
const roleGuard = require('../middleware/roleGuard');

// Rate Limiter
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { message: "Terlalu banyak percobaan login." }
});

// 1. PUBLIC ROUTES
router.get('/license-status', (req, res) => licenseController.checkStatus(req, res));
router.post('/activation', (req, res) => licenseController.activate(req, res));
router.post('/login', loginLimiter, (req, res) => authController.login(req, res));
router.post('/logout', (req, res) => authController.logout(req, res));
router.get('/settings', (req, res) => masterController.getSettings(req, res));
router.post('/scan', (req, res) => attendanceController.scanRFID(req, res));
router.post('/reset-password', (req, res) => authController.resetPassword(req, res));

// 2. PROTECTED ROUTES
router.use(authGuard);

router.put('/profile', (req, res) => authController.updateProfile(req, res));

// ATTENDANCE
router.get('/dashboard', (req, res) => attendanceController.getDashboardStats(req, res));
router.get('/attendance/report', (req, res) => attendanceController.getReport(req, res));
router.get('/attendance/daily', (req, res) => attendanceController.getDailyAttendance(req, res));
router.post('/attendance/manual', (req, res) => attendanceController.manualAttendance(req, res));

// MASTER DATA MEMBERS
router.get('/members', (req, res) => masterController.getAllMembers(req, res));
router.post('/members', (req, res) => masterController.createMember(req, res));
router.post('/members/import', upload.single('excel_file'), (req, res) => masterController.importMembers(req, res));
router.put('/members/:id', (req, res) => masterController.updateMember(req, res));
router.delete('/members/:id', (req, res) => masterController.deleteMember(req, res));
router.post('/members/upload-photo', (req, res) => systemController.uploadPhotoBase64(req, res));

// MASTER DATA DIVISIONS
router.get('/divisions', (req, res) => masterController.getAllDivisions(req, res));
router.post('/divisions', (req, res) => masterController.createDivision(req, res));
router.put('/divisions/:id', (req, res) => masterController.updateDivision(req, res));
router.delete('/divisions/:id', (req, res) => masterController.deleteDivision(req, res));

// HOLIDAYS (Kalender Libur)
router.get('/holidays', (req, res) => holidaysController.getHolidays(req, res));
router.post('/holidays', roleGuard(['SuperAdmin']), (req, res) => holidaysController.addHoliday(req, res));
router.delete('/holidays/:id', roleGuard(['SuperAdmin']), (req, res) => holidaysController.deleteHoliday(req, res));

// SYSTEM (Hanya SuperAdmin)
router.post('/settings', roleGuard(['SuperAdmin']), (req, res) => masterController.updateSettings(req, res));
router.get('/backup', roleGuard(['SuperAdmin']), (req, res) => systemController.backupDatabase(req, res));
router.post('/restore', roleGuard(['SuperAdmin']), upload.single('backup_file'), (req, res) => systemController.restoreDatabase(req, res));
router.get('/audit-logs', roleGuard(['SuperAdmin']), (req, res) => systemController.getAuditLogs(req, res));

// DEVICES (Hanya SuperAdmin)
router.get('/devices', roleGuard(['SuperAdmin']), (req, res) => deviceController.getAllDevices(req, res));
router.post('/devices', roleGuard(['SuperAdmin']), (req, res) => deviceController.addDevice(req, res));
router.delete('/devices/:id', roleGuard(['SuperAdmin']), (req, res) => deviceController.deleteDevice(req, res));
router.post('/devices/test', roleGuard(['SuperAdmin']), (req, res) => deviceController.testConnection(req, res));
router.post('/devices/sync', roleGuard(['SuperAdmin']), (req, res) => deviceController.syncDeviceLogs(req, res));

module.exports = router;