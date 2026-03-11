const db = require('../config/db');
const { hashPassword, comparePassword } = require('../utils/auth');
const { handleDbError } = require('../utils/dbHelpers');

// Register a new staff account (Medical Personnel) - Goes to PENDING
exports.registerStaff = async (req, res) => {
    try {
        const { username, password, employee_id, role, specialization, schedule } = req.body;

        // Check if username or employee_id already exists in EITHER staff or pending_staff
        const [existingStaff] = await db.query(
            "SELECT id FROM staff WHERE username = ? OR employee_id = ?",
            [username, employee_id]
        );

        const [existingPending] = await db.query(
            "SELECT id FROM pending_staff WHERE username = ? OR employee_id = ?",
            [username, employee_id]
        );

        if (existingStaff.length > 0 || existingPending.length > 0) {
            return res.status(400).json({ message: "Username or Employee ID already registered or pending" });
        }

        // Hash the password
        const password_hash = await hashPassword(password);

        // Insert into pending_staff
        const sql = `
            INSERT INTO pending_staff (username, password_hash, employee_id, role, specialization, schedule, status)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        const params = [
            username,
            password_hash,
            employee_id,
            role,
            role === 'doctor' ? specialization : null,
            role === 'doctor' ? schedule : null,
            'Pending'
        ];

        await db.query(sql, params);

        res.status(201).json({ message: "Registration submitted. Pending admin approval." });

    } catch (error) {
        console.error('Registration error:', error);
        const { message, status } = handleDbError(error);
        res.status(status).json({ message });
    }
};

// Register a new staff account DIRECTLY (Admin action) - Goes to ACTIVE
exports.registerStaffDirect = async (req, res) => {
    try {
        const { username, password, employee_id, role, specialization, schedule } = req.body;

        // Check if username or employee_id already exists in EITHER staff or pending_staff
        const [existingStaff] = await db.query(
            "SELECT id FROM staff WHERE username = ? OR employee_id = ?",
            [username, employee_id]
        );

        const [existingPending] = await db.query(
            "SELECT id FROM pending_staff WHERE username = ? OR employee_id = ?",
            [username, employee_id]
        );

        if (existingStaff.length > 0 || existingPending.length > 0) {
            return res.status(400).json({ message: "Username or Employee ID already registered or pending" });
        }

        // Hash the password
        const password_hash = await hashPassword(password);

        // Insert into staff
        const sql = `
            INSERT INTO staff (username, password_hash, employee_id, role, specialization, schedule, status)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        const params = [
            username,
            password_hash,
            employee_id,
            role,
            role === 'doctor' ? specialization : null,
            role === 'doctor' ? schedule : null,
            'Active'
        ];

        await db.query(sql, params);

        res.status(201).json({ message: "Account registered successfully and is now active." });

    } catch (error) {
        console.error('Direct Registration error:', error);
        const { message, status } = handleDbError(error);
        res.status(status).json({ message });
    }
};

// Get all staff accounts (Active)
exports.getAllStaff = async (req, res) => {
    try {
        const [staff] = await db.query(
            "SELECT id, username, employee_id, role, status, specialization, schedule, created_at FROM staff ORDER BY id DESC"
        );
        res.status(200).json(staff);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// Get pending staff accounts
exports.getPendingStaff = async (req, res) => {
    try {
        const [pending] = await db.query(
            "SELECT id, username, employee_id, role, status, specialization, schedule, created_at FROM pending_staff ORDER BY id DESC"
        );
        res.status(200).json(pending);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// Approve staff account
exports.approveStaff = async (req, res) => {
    const { id } = req.params;
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Get the pending user
        const [pendingUsers] = await connection.query("SELECT * FROM pending_staff WHERE id = ?", [id]);
        if (pendingUsers.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: "Pending account not found" });
        }

        const user = pendingUsers[0];

        // 2. Check if username or employee_id already exist in staff (Race condition check)
        const [alreadyExists] = await connection.query(
            "SELECT id FROM staff WHERE username = ? OR employee_id = ?",
            [user.username, user.employee_id]
        );

        if (alreadyExists.length > 0) {
            await connection.rollback();
            return res.status(409).json({ message: "Account already exists in staff table" });
        }

        // 3. Insert into final staff table
        const insertSql = `
            INSERT INTO staff (username, password_hash, employee_id, role, specialization, schedule, status)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        const params = [
            user.username,
            user.password_hash,
            user.employee_id,
            user.role,
            user.specialization,
            user.schedule,
            'Active'
        ];
        await connection.query(insertSql, params);

        // 3. Delete from pending
        await connection.query("DELETE FROM pending_staff WHERE id = ?", [id]);

        await connection.commit();
        res.status(200).json({ message: "Account approved and moved to staff table" });

    } catch (error) {
        await connection.rollback();
        console.error('Approval error:', error);
        res.status(500).json({ message: "Server error during approval" });
    } finally {
        connection.release();
    }
};

// Reject staff account
exports.rejectStaff = async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await db.query("DELETE FROM pending_staff WHERE id = ?", [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Pending account not found" });
        }
        res.status(200).json({ message: "Account registration rejected" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error during rejection" });
    }
};

// Login staff (Medical Personnel)
exports.loginStaff = async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ message: "Username and password are required" });
        }

        // Find user by username
        const [users] = await db.query("SELECT * FROM staff WHERE username = ?", [username]);

        if (users.length === 0) {
            return res.status(401).json({ message: "Invalid credentials or account not yet active" });
        }

        const user = users[0];

        // Compare passwords
        const isMatch = await comparePassword(password, user.password_hash);

        if (!isMatch) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        // Return user info (excluding password)
        const { password_hash, ...userInfo } = user;
        res.status(200).json({ message: "Login successful", user: userInfo });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: "Server error" });
    }
};
