const db = require('../config/db');
const { hashPassword, comparePassword } = require('../utils/auth');
const { handleDbError } = require('../utils/dbHelpers');
const { generateVerificationToken, sendVerificationEmail } = require('../utils/email');

// Register a new staff account (Medical Personnel) - Goes to PENDING
exports.registerStaff = async (req, res) => {
    try {
        const { username, password, employee_id, email, role, specialization, schedule } = req.body;

        // Check if username, employee_id, or email already exists in EITHER staff or pending_staff
        const [existingStaff] = await db.query(
            "SELECT id FROM staff WHERE username = ? OR employee_id = ? OR email = ?",
            [username, employee_id, email]
        );

        const [existingPending] = await db.query(
            "SELECT id FROM pending_staff WHERE username = ? OR employee_id = ? OR email = ?",
            [username, employee_id, email]
        );

        if (existingStaff.length > 0) {
            return res.status(400).json({ message: "Username, Employee ID, or Email already registered" });
        }
        if (existingPending.length > 0) {
            return res.status(400).json({ message: "Username, Employee ID, or Email already pending approval" });
        }

        // Hash the password
        const password_hash = await hashPassword(password);

        // Generate email verification token
        const verificationToken = generateVerificationToken();
        const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        // Insert into pending_staff
        const sql = `
            INSERT INTO pending_staff (username, password_hash, employee_id, email, role, specialization, schedule, email_verified, verification_token, token_expires_at, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const params = [
            username,
            password_hash,
            employee_id,
            email,
            role,
            role === 'doctor' ? specialization : null,
            role === 'doctor' ? JSON.stringify(schedule) : null,
            0,
            verificationToken,
            tokenExpiresAt,
            'Pending'
        ];

        await db.query(sql, params);

        // Send verification email
        try {
            await sendVerificationEmail(email, verificationToken);
        } catch (emailErr) {
            console.error('Failed to send verification email:', emailErr.message);
            // Registration still succeeds; admin can resend later
        }

        res.status(201).json({ message: "Registration submitted. Please check your email to verify your account." });

    } catch (error) {
        console.error('Registration error:', error);
        const { message, status } = handleDbError(error);
        res.status(status).json({ message });
    }
};

// Verify email address via token
exports.verifyEmail = async (req, res) => {
    try {
        const { token } = req.query;

        if (!token) {
            return res.status(400).send(verificationPage('Invalid Link', 'No verification token provided.', false));
        }

        // Find pending staff with this token
        const [rows] = await db.query(
            "SELECT id, email, token_expires_at FROM pending_staff WHERE verification_token = ?",
            [token]
        );

        if (rows.length === 0) {
            return res.status(404).send(verificationPage('Invalid Link', 'This verification link is invalid or has already been used.', false));
        }

        const record = rows[0];

        // Check if token has expired
        if (new Date() > new Date(record.token_expires_at)) {
            return res.status(410).send(verificationPage('Link Expired', 'This verification link has expired. Please register again.', false));
        }

        // Mark email as verified and clear the token
        await db.query(
            "UPDATE pending_staff SET email_verified = 1, verification_token = NULL, token_expires_at = NULL WHERE id = ?",
            [record.id]
        );

        res.send(verificationPage('Email Verified!', 'Your email has been verified successfully. Your account is now pending admin approval.', true));

    } catch (error) {
        console.error('Email verification error:', error);
        res.status(500).send(verificationPage('Error', 'An error occurred during verification. Please try again later.', false));
    }
};

// Helper: returns an HTML page for email verification result
function verificationPage(title, message, success) {
    const color = success ? '#10b981' : '#dc2626';
    const icon = success ? '✓' : '✗';
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>U-Konek+ — Email Verification</title>
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap" rel="stylesheet">
        <style>
            body { margin:0; font-family:'Poppins',sans-serif; background:linear-gradient(180deg,#eef4ff 0%,#f8fafc 100%); display:flex; align-items:center; justify-content:center; min-height:100vh; }
            .card { background:#fff; border-radius:12px; box-shadow:0 8px 30px rgba(28,50,86,.08); padding:40px; max-width:420px; width:90%; text-align:center; }
            .icon { width:60px; height:60px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:32px; color:#fff; margin:0 auto 20px; background:${color}; }
            h1 { color:#1e293b; font-size:22px; margin:0 0 12px; }
            p { color:#64748b; font-size:14px; line-height:1.6; margin:0 0 24px; }
            a { display:inline-block; background:#00277F; color:#fff; text-decoration:none; padding:12px 32px; border-radius:8px; font-weight:700; font-size:14px; }
            a:hover { filter:brightness(1.1); }
        </style>
    </head>
    <body>
        <div class="card">
            <div class="icon">${icon}</div>
            <h1>${title}</h1>
            <p>${message}</p>
            <a href="/html/index.html">Go to Login</a>
        </div>
    </body>
    </html>`;
}

// Register a new staff account DIRECTLY (Admin action) - Goes to ACTIVE
exports.registerStaffDirect = async (req, res) => {
    try {
        const { username, password, employee_id, email, role, specialization, schedule } = req.body;

        // Check if username, employee_id, or email already exists in EITHER staff or pending_staff
        const [existingStaff] = await db.query(
            "SELECT id FROM staff WHERE username = ? OR employee_id = ? OR email = ?",
            [username, employee_id, email]
        );

        const [existingPending] = await db.query(
            "SELECT id FROM pending_staff WHERE username = ? OR employee_id = ? OR email = ?",
            [username, employee_id, email]
        );

        if (existingStaff.length > 0) {
            return res.status(400).json({ message: "Username, Employee ID, or Email already registered" });
        }
        if (existingPending.length > 0) {
            return res.status(400).json({ message: "Username, Employee ID, or Email already pending approval" });
        }

        // Hash the password
        const password_hash = await hashPassword(password);

        // Insert into staff
        const sql = `
            INSERT INTO staff (username, password_hash, employee_id, email, role, specialization, schedule, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const params = [
            username,
            password_hash,
            employee_id,
            email,
            role,
            role === 'doctor' ? specialization : null,
            role === 'doctor' ? JSON.stringify(schedule) : null,
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
            "SELECT id, username, email, employee_id, role, status, specialization, schedule, created_at FROM staff ORDER BY id DESC"
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
            "SELECT id, username, email, employee_id, role, status, specialization, schedule, created_at FROM pending_staff ORDER BY id DESC"
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

        // 2. Check if username, employee_id, or email already exist in staff (Race condition check)
        const [alreadyExists] = await connection.query(
            "SELECT id FROM staff WHERE username = ? OR employee_id = ? OR email = ?",
            [user.username, user.employee_id, user.email]
        );

        if (alreadyExists.length > 0) {
            await connection.rollback();
            return res.status(409).json({ message: "Account already exists in staff table" });
        }

        // 3. Insert into final staff table
        const insertSql = `
            INSERT INTO staff (username, password_hash, employee_id, email, role, specialization, schedule, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const params = [
            user.username,
            user.password_hash,
            user.employee_id,
            user.email,
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
