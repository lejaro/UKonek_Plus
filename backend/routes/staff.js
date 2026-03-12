const express = require('express');
const staffController = require('../controllers/staffController');
const { validateStaff } = require('../middleware/validation');
const router = express.Router();

// GET /api/staff - Get all staff accounts
router.get('/', staffController.getAllStaff);

// POST /api/staff/register - Register to pending_staff table
router.post('/register', validateStaff, staffController.registerStaff);

// GET /api/staff/verify-email - Verify email address
router.get('/verify-email', staffController.verifyEmail);

// POST /api/staff/register-direct - Register directly to staff table (Active)
router.post('/register-direct', validateStaff, staffController.registerStaffDirect);

// GET /api/staff/pending - Get all pending staff
router.get('/pending', staffController.getPendingStaff);

// POST /api/staff/approve/:id - Approve a pending staff
router.post('/approve/:id', staffController.approveStaff);

// POST /api/staff/reject/:id - Reject a pending staff
router.post('/reject/:id', staffController.rejectStaff);

// POST /api/staff/login - Staff login
router.post('/login', staffController.loginStaff);

module.exports = router;
