const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const patientRoutes = require('./routes/patient');
const staffRoutes = require('./routes/staff');
const { errorHandler } = require('./middleware/validation');

const app = express();

app.use(cors());
app.use(express.json());

// Serve static files from the frontend directory
// This ensures /css/style.css maps to frontend/css/style.css
app.use(express.static(path.join(__dirname, 'frontend')));

app.use('/api/patients', patientRoutes);
app.use('/api/staff', staffRoutes);

// Catch-all to serve index.html for any frontend route
app.get(/.*/, (req, res, next) => {
    // Don't intercept API calls
    if (req.path.startsWith('/api')) {
        return next();
    }
    res.sendFile(path.join(__dirname, 'frontend', 'html', 'index.html'));
});

// Error handling middleware
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));