const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const numericRegex = /^\d+$/;
const nameRegex = /^[A-Za-z]+(?:[ '-][A-Za-z]+)*$/;

function isStrongPassword(password) {
    return (
        typeof password === 'string' &&
        password.length >= 8 &&
        /[A-Z]/.test(password) &&
        /[a-z]/.test(password) &&
        /\d/.test(password)
    );
}

function validateCommonFields(body, res) {
    const { password, confirmPassword } = body;

    if (password !== confirmPassword) {
        res.status(400).json({ message: 'Passwords do not match' });
        return false;
    }

    if (password.length < 6) {
        res.status(400).json({ message: 'Password must be at least 6 characters' });
        return false;
    }

    return true;
}

exports.validatePatient = (req, res, next) => {
    const {
        firstname,
        surname,
        middle_initial,
        age,
        contact_number,
        emergency_contact_contact_number,
        email,
        username,
        password,
        confirmPassword,
        otp
    } = req.body;

    if (!firstname || !surname || !email || !password || !confirmPassword || !username) {
        return res.status(400).json({ message: 'First name, surname, username, email, password, and confirm password are required' });
    }

    if (!nameRegex.test(String(firstname).trim()) || !nameRegex.test(String(surname).trim())) {
        return res.status(400).json({ message: 'First name and surname must contain letters only' });
    }

    if (middle_initial && !nameRegex.test(String(middle_initial).trim())) {
        return res.status(400).json({ message: 'Middle name must contain letters only' });
    }

    if (middle_initial && String(middle_initial).trim().length > 100) {
        return res.status(400).json({ message: 'Middle name must be at most 100 characters' });
    }

    if (age !== undefined && age !== null && String(age).trim() !== '') {
        const parsedAge = Number.parseInt(age, 10);
        if (!Number.isInteger(parsedAge) || parsedAge < 0 || parsedAge > 130) {
            return res.status(400).json({ message: 'Age must be a valid number between 0 and 130' });
        }
    }

    if (contact_number && !/^\+?\d{10,15}$/.test(String(contact_number).trim())) {
        return res.status(400).json({ message: 'Contact number must be 10 to 15 digits' });
    }

    if (emergency_contact_contact_number && !/^\+?\d{10,15}$/.test(String(emergency_contact_contact_number).trim())) {
        return res.status(400).json({ message: 'Emergency contact number must be 10 to 15 digits' });
    }

    if (!emailRegex.test(email)) {
        return res.status(400).json({ message: 'Invalid email format' });
    }

    if (!/^[a-zA-Z0-9_.-]{4,30}$/.test(String(username).trim())) {
        return res.status(400).json({ message: 'Username must be 4-30 chars and use letters, numbers, dot, underscore, or hyphen' });
    }

    if (password !== confirmPassword) {
        return res.status(400).json({ message: 'Passwords do not match' });
    }

    if (!isStrongPassword(password)) {
        return res.status(400).json({ message: 'Password must be at least 8 chars and include uppercase, lowercase, and number' });
    }

    if (!otp || !/^\d{6}$/.test(String(otp).trim())) {
        return res.status(400).json({ message: 'A valid 6-digit OTP is required' });
    }

    next();
};

exports.validateStaff = (req, res, next) => {
    const { username, password, confirmPassword, employee_id, email, role, specialization, schedule } = req.body;

    if (!username || !password || !confirmPassword || !employee_id || !email || !role) {
        return res.status(400).json({ message: 'Username, Employee ID, Email, Role, and Passwords are required' });
    }

    if (!emailRegex.test(email)) {
        return res.status(400).json({ message: 'Invalid email format' });
    }

    if (!numericRegex.test(String(employee_id).trim())) {
        return res.status(400).json({ message: 'Employee ID must contain numbers only' });
    }

    if (!validateCommonFields(req.body, res)) return;

    if (role === 'doctor' && (!specialization || !schedule)) {
        return res.status(400).json({ message: 'Specialization and Schedule are required for Doctors' });
    }

    if (role === 'doctor' && schedule) {
        if (typeof schedule !== 'object' || !Array.isArray(schedule.days) || schedule.days.length === 0) {
            return res.status(400).json({ message: 'Schedule must have at least one working day' });
        }
        if (typeof schedule.startHour !== 'number' || typeof schedule.endHour !== 'number') {
            return res.status(400).json({ message: 'Start hour and end hour must be numbers' });
        }
        if (schedule.startHour < 0 || schedule.startHour > 23 || schedule.endHour < 0 || schedule.endHour > 23) {
            return res.status(400).json({ message: 'Hours must be between 0 and 23' });
        }
        if (schedule.startHour >= schedule.endHour) {
            return res.status(400).json({ message: 'End hour must be after start hour' });
        }
    }

    next();
};

exports.validatePatientLogin = (req, res, next) => {
    const { identifier, username, email, password } = req.body;
    const identity = identifier || username || email;

    if (!identity || !password) {
        return res.status(400).json({ message: 'Identifier and password are required' });
    }

    if (typeof password !== 'string' || password.length < 8) {
        return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    next();
};

exports.validateForgotPassword = (req, res, next) => {
    const { email } = req.body;

    if (!email || !emailRegex.test(String(email).trim())) {
        return res.status(400).json({ message: 'A valid email is required' });
    }

    next();
};

exports.validatePatientOtpRequest = (req, res, next) => {
    const { email, purpose } = req.body;

    if (!email || !emailRegex.test(String(email).trim())) {
        return res.status(400).json({ message: 'A valid email is required' });
    }

    if (!purpose || !['registration', 'password_reset'].includes(String(purpose).trim())) {
        return res.status(400).json({ message: 'Purpose must be registration or password_reset' });
    }

    next();
};

exports.validatePatientResetPassword = (req, res, next) => {
    const { email, otp, password, confirmPassword } = req.body;

    if (!email || !emailRegex.test(String(email).trim())) {
        return res.status(400).json({ message: 'A valid email is required' });
    }

    if (!otp || !/^\d{6}$/.test(String(otp).trim())) {
        return res.status(400).json({ message: 'A valid 6-digit OTP is required' });
    }

    if (!password || !confirmPassword) {
        return res.status(400).json({ message: 'Password and confirm password are required' });
    }

    if (password !== confirmPassword) {
        return res.status(400).json({ message: 'Passwords do not match' });
    }

    if (!isStrongPassword(password)) {
        return res.status(400).json({ message: 'Password must be at least 8 chars and include uppercase, lowercase, and number' });
    }

    next();
};

exports.validateResetPassword = (req, res, next) => {
    const { email, otp, password, confirmPassword } = req.body;

    if (!email || !emailRegex.test(String(email).trim())) {
        return res.status(400).json({ message: 'A valid email is required' });
    }

    if (!otp || !/^\d{6}$/.test(String(otp).trim())) {
        return res.status(400).json({ message: 'A valid 6-digit OTP is required' });
    }

    if (!password || !confirmPassword) {
        return res.status(400).json({ message: 'Password and confirm password are required' });
    }

    if (password !== confirmPassword) {
        return res.status(400).json({ message: 'Passwords do not match' });
    }

    if (!isStrongPassword(password)) {
        return res.status(400).json({ message: 'Password must be at least 8 chars and include uppercase, lowercase, and number' });
    }

    next();
};

exports.errorHandler = (err, req, res, next) => {
    res.status(err.status || 500).json({ message: err.message || 'Server error' });
};
