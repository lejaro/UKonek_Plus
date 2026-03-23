const express = require('express');
const staffController = require('../controllers/staffController');
const { validateStaff } = require('../middleware/validation');
const { requireAuth, requireRole } = require('../middleware/sessionAuth');
const router = express.Router();
const requireAdmin = requireRole('admin');

// GET /api/staff - Get all staff accounts
router.get('/', requireAuth, requireAdmin, staffController.getAllStaff);

// DELETE /api/staff/:id - Delete active staff account
router.delete('/:id', requireAuth, requireAdmin, staffController.deleteStaff);

// POST /api/staff/register - Register to pending_staff table
router.post('/register', staffController.registerStaff);

// POST /api/staff/complete-registration - Create username/password using registration OTP
router.post('/complete-registration', staffController.completeStaffRegistration);

// POST /api/staff/register-direct - Register directly to staff table (Active)
router.post('/register-direct', requireAuth, requireAdmin, validateStaff, staffController.registerStaffDirect);

// GET /api/staff/pending - Get all pending staff
router.get('/pending', requireAuth, requireAdmin, staffController.getPendingStaff);

// POST /api/staff/approve/:id - Approve a pending staff
router.post('/approve/:id', requireAuth, requireAdmin, staffController.approveStaff);

// POST /api/staff/reject/:id - Reject a pending staff
router.post('/reject/:id', requireAuth, requireAdmin, staffController.rejectStaff);

// POST /api/staff/login - Staff login
router.post('/login', staffController.loginStaff);

// POST /api/staff/logout - End current login session
router.post('/logout', staffController.logoutStaff);

// GET /api/staff/session - Validate current login session
router.get('/session', requireAuth, staffController.getSession);

// POST /api/staff/forgot-password - Request password reset OTP
router.post('/forgot-password', staffController.forgotPassword);

// POST /api/staff/reset-password - Reset password using OTP
router.post('/reset-password', staffController.resetPassword);

module.exports = router;
