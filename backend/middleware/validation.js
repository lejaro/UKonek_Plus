const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Shared validation for internal consistency
function validateCommonFields(body, res) {
    const { password, confirmPassword } = body;

    if (password !== confirmPassword) {
        res.status(400).json({ message: "Passwords do not match" });
        return false;
    }

    if (password.length < 6) {
        res.status(400).json({ message: "Password must be at least 6 characters" });
        return false;
    }

    return true;
}

// Validate patient registration (Original flow)
exports.validatePatient = (req, res, next) => {
    const { firstname, surname, email, password } = req.body;

    if (!firstname || !surname || !email || !password) {
        return res.status(400).json({ message: "All fields are required for patients" });
    }

    if (!emailRegex.test(email)) {
        return res.status(400).json({ message: "Invalid email format" });
    }

    if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    next();
};

// Validate staff/medical personnel registration (New flow)
exports.validateStaff = (req, res, next) => {
    const { username, password, confirmPassword, employee_id, email, role, specialization, schedule } = req.body;

    if (!username || !password || !confirmPassword || !employee_id || !email || !role) {
        return res.status(400).json({ message: "Username, Employee ID, Email, Role, and Passwords are required" });
    }

    if (!emailRegex.test(email)) {
        return res.status(400).json({ message: "Invalid email format" });
    }

    if (!validateCommonFields(req.body, res)) return;

    if (role === 'doctor' && (!specialization || !schedule)) {
        return res.status(400).json({ message: "Specialization and Schedule are required for Doctors" });
    }

    if (role === 'doctor' && schedule) {
        // Validate schedule format
        if (typeof schedule !== 'object' || !Array.isArray(schedule.days) || schedule.days.length === 0) {
            return res.status(400).json({ message: "Schedule must have at least one working day" });
        }
        if (typeof schedule.startHour !== 'number' || typeof schedule.endHour !== 'number') {
            return res.status(400).json({ message: "Start hour and end hour must be numbers" });
        }
        if (schedule.startHour < 0 || schedule.startHour > 23 || schedule.endHour < 0 || schedule.endHour > 23) {
            return res.status(400).json({ message: "Hours must be between 0 and 23" });
        }
        if (schedule.startHour >= schedule.endHour) {
            return res.status(400).json({ message: "End hour must be after start hour" });
        }
    }

    next();
};

// Global error handler
exports.errorHandler = (err, req, res, next) => {
    res.status(err.status || 500).json({ message: err.message || "Server error" });
};
