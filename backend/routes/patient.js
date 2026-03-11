const express = require('express');
const patientController = require('../controllers/patientController');
const { validatePatient } = require('../middleware/validation');
const router = express.Router();

// POST /api/patients/register - Register a new patient account
router.post('/register', validatePatient, patientController.registerPatient);

module.exports = router;