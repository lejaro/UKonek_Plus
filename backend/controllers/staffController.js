const db = require('../config/db');
const crypto = require('crypto');
const { hashPassword, comparePassword } = require('../utils/auth');
const { handleDbError } = require('../utils/dbHelpers');
const { sendStaffRegistrationOtpEmail, sendStaffApprovalEmail, sendStaffPasswordResetEmail } = require('../utils/email');
const {
    createSessionForUser,
    destroySession,
    setSessionCookie,
    clearSessionCookie,
    parseCookies,
    SESSION_COOKIE_NAME
} = require('../middleware/sessionAuth');

let staffEmailVerificationTableReady = false;
let staffPasswordResetSchemaReady = false;
let staffProfileSchemaReady = false;

const nameRegex = /^[A-Za-z]+(?:[ '-][A-Za-z]+)*$/;
const numericRegex = /^\d+$/;
const STAFF_REG_OTP_EXPIRY_MINUTES = Number.parseInt(process.env.STAFF_REG_OTP_EXPIRY_MINUTES || '10', 10);
const STAFF_REG_OTP_MAX_ATTEMPTS = Number.parseInt(process.env.STAFF_REG_OTP_MAX_ATTEMPTS || '5', 10);
const STAFF_RESET_OTP_EXPIRY_MINUTES = Number.parseInt(process.env.STAFF_RESET_OTP_EXPIRY_MINUTES || '10', 10);
const STAFF_RESET_OTP_MAX_ATTEMPTS = Number.parseInt(process.env.STAFF_RESET_OTP_MAX_ATTEMPTS || '5', 10);

function hashOtp(otp) {
    return crypto.createHash('sha256').update(String(otp)).digest('hex');
}

function generateOtpCode() {
    const min = 100000;
    const max = 999999;
    return String(Math.floor(Math.random() * (max - min + 1)) + min);
}

async function ensureStaffEmailVerificationTable() {
    if (staffEmailVerificationTableReady) {
        return;
    }

    await db.query(`
        CREATE TABLE IF NOT EXISTS staff_email_verifications (
            id INT AUTO_INCREMENT PRIMARY KEY,
            first_name VARCHAR(100) NOT NULL,
            middle_name VARCHAR(100) NOT NULL,
            last_name VARCHAR(100) NOT NULL,
            birthday DATE NOT NULL,
            gender VARCHAR(20) NOT NULL,
            username VARCHAR(100) UNIQUE DEFAULT NULL,
            password_hash VARCHAR(255) DEFAULT NULL,
            employee_id VARCHAR(100) UNIQUE NOT NULL,
            email VARCHAR(100) UNIQUE NOT NULL,
            role VARCHAR(100) NOT NULL,
            consent_given TINYINT(1) NOT NULL DEFAULT 0,
            verification_token_hash VARCHAR(64) NOT NULL,
            verification_token_expires DATETIME NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    staffEmailVerificationTableReady = true;
}

async function ensureStaffPasswordResetSchema() {
    if (staffPasswordResetSchemaReady) {
        return;
    }

    const [columns] = await db.query(
        `
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = ?
              AND TABLE_NAME = 'staff'
        `,
        [process.env.DB_NAME]
    );

    const existing = new Set(columns.map((column) => column.COLUMN_NAME));
    const alterStatements = [];

    if (!existing.has('password_reset_otp_hash')) {
        alterStatements.push('ADD COLUMN password_reset_otp_hash VARCHAR(64) NULL');
    }
    if (!existing.has('password_reset_otp_expires')) {
        alterStatements.push('ADD COLUMN password_reset_otp_expires DATETIME NULL');
    }
    if (!existing.has('password_reset_otp_attempts_left')) {
        alterStatements.push(`ADD COLUMN password_reset_otp_attempts_left INT NOT NULL DEFAULT ${STAFF_RESET_OTP_MAX_ATTEMPTS}`);
    }

    if (alterStatements.length > 0) {
        await db.query(`ALTER TABLE staff ${alterStatements.join(', ')}`);
    }

    staffPasswordResetSchemaReady = true;
}

async function ensureStaffProfileSchema() {
    if (staffProfileSchemaReady) {
        return;
    }

    const tableColumnDefs = {
        staff: {
            first_name: 'ADD COLUMN first_name VARCHAR(100) NULL',
            middle_name: 'ADD COLUMN middle_name VARCHAR(100) NULL',
            last_name: 'ADD COLUMN last_name VARCHAR(100) NULL',
            birthday: 'ADD COLUMN birthday DATE NULL',
            gender: 'ADD COLUMN gender VARCHAR(20) NULL',
            consent_given: 'ADD COLUMN consent_given TINYINT(1) NOT NULL DEFAULT 0'
        },
        pending_staff: {
            first_name: "ADD COLUMN first_name VARCHAR(100) NOT NULL DEFAULT ''",
            middle_name: "ADD COLUMN middle_name VARCHAR(100) NOT NULL DEFAULT ''",
            last_name: "ADD COLUMN last_name VARCHAR(100) NOT NULL DEFAULT ''",
            birthday: "ADD COLUMN birthday DATE NOT NULL DEFAULT '1970-01-01'",
            gender: "ADD COLUMN gender VARCHAR(20) NOT NULL DEFAULT 'Unspecified'",
            consent_given: 'ADD COLUMN consent_given TINYINT(1) NOT NULL DEFAULT 0'
        },
        staff_email_verifications: {
            first_name: "ADD COLUMN first_name VARCHAR(100) NOT NULL DEFAULT ''",
            middle_name: "ADD COLUMN middle_name VARCHAR(100) NOT NULL DEFAULT ''",
            last_name: "ADD COLUMN last_name VARCHAR(100) NOT NULL DEFAULT ''",
            birthday: "ADD COLUMN birthday DATE NOT NULL DEFAULT '1970-01-01'",
            gender: "ADD COLUMN gender VARCHAR(20) NOT NULL DEFAULT 'Unspecified'",
            username: 'ADD COLUMN username VARCHAR(100) NULL',
            password_hash: 'ADD COLUMN password_hash VARCHAR(255) NULL',
            consent_given: 'ADD COLUMN consent_given TINYINT(1) NOT NULL DEFAULT 0',
            attempts_left: `ADD COLUMN attempts_left INT NOT NULL DEFAULT ${STAFF_REG_OTP_MAX_ATTEMPTS}`,
            consumed: 'ADD COLUMN consumed TINYINT(1) NOT NULL DEFAULT 0'
        }
    };

    for (const [tableName, definitions] of Object.entries(tableColumnDefs)) {
        const [columns] = await db.query(
            `
                SELECT COLUMN_NAME
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = ?
                  AND TABLE_NAME = ?
            `,
            [process.env.DB_NAME, tableName]
        );

        const existing = new Set(columns.map((column) => column.COLUMN_NAME));
        const addStatements = [];

        for (const [columnName, addSql] of Object.entries(definitions)) {
            if (!existing.has(columnName)) {
                addStatements.push(addSql);
            }
        }

        if (addStatements.length > 0) {
            await db.query(`ALTER TABLE ${tableName} ${addStatements.join(', ')}`);
        }
    }

    // Legacy compatibility: older schema had staged username/password as NOT NULL.
    const [verificationColumns] = await db.query(
        `
            SELECT COLUMN_NAME, IS_NULLABLE
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = ?
              AND TABLE_NAME = 'staff_email_verifications'
              AND COLUMN_NAME IN ('username', 'password_hash')
        `,
        [process.env.DB_NAME]
    );

    const nullabilityByColumn = new Map(
        verificationColumns.map((column) => [column.COLUMN_NAME, column.IS_NULLABLE])
    );

    const modifyStatements = [];
    if (nullabilityByColumn.get('username') === 'NO') {
        modifyStatements.push('MODIFY COLUMN username VARCHAR(100) NULL');
    }
    if (nullabilityByColumn.get('password_hash') === 'NO') {
        modifyStatements.push('MODIFY COLUMN password_hash VARCHAR(255) NULL');
    }

    if (modifyStatements.length > 0) {
        await db.query(`ALTER TABLE staff_email_verifications ${modifyStatements.join(', ')}`);
    }

    staffProfileSchemaReady = true;
}

function createVerificationTokenPayload() {
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    return {
        token,
        tokenHash,
        expiresAt
    };
}

function wantsJson(req) {
    const acceptHeader = req.get('accept') || '';
    return acceptHeader.includes('application/json') || req.query.format === 'json';
}

function sendVerificationResult(req, res, { statusCode, success, title, message }) {
    if (wantsJson(req)) {
        return res.status(statusCode).json({ message, success });
    }

    const themeColor = success ? '#16a34a' : '#dc2626';
    const symbol = success ? '✓' : '!' ;
    const backendBaseUrl = process.env.BACKEND_BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
    const homeLink = process.env.FRONTEND_LOGIN_URL || `${backendBaseUrl}/html/index.html`;

    return res.status(statusCode).send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Email Verification</title>
    <style>
        :root {
            --surface: #ffffff;
            --text: #0f172a;
            --muted: #475569;
            --accent: ${themeColor};
            --bg-start: #f8fbff;
            --bg-end: #eef2ff;
        }
        * { box-sizing: border-box; }
        body {
            margin: 0;
            min-height: 100vh;
            display: grid;
            place-items: center;
            font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
            color: var(--text);
            background: radial-gradient(circle at top right, var(--bg-end), var(--bg-start));
            padding: 20px;
        }
        .card {
            width: 100%;
            max-width: 520px;
            background: var(--surface);
            border-radius: 16px;
            padding: 28px 24px;
            box-shadow: 0 20px 45px rgba(15, 23, 42, 0.12);
            text-align: center;
        }
        .badge {
            width: 64px;
            height: 64px;
            margin: 0 auto 14px;
            border-radius: 999px;
            background: var(--accent);
            color: #fff;
            display: grid;
            place-items: center;
            font-size: 30px;
            font-weight: 700;
        }
        h1 {
            margin: 0 0 12px;
            font-size: 26px;
            line-height: 1.25;
        }
        p {
            margin: 0;
            font-size: 15px;
            line-height: 1.6;
            color: var(--muted);
        }
        .actions {
            margin-top: 22px;
        }
        .btn {
            display: inline-block;
            text-decoration: none;
            background: #00277f;
            color: #ffffff;
            padding: 11px 18px;
            border-radius: 10px;
            font-weight: 600;
        }
        .btn:hover {
            filter: brightness(1.06);
        }
    </style>
</head>
<body>
    <main class="card">
        <div class="badge">${symbol}</div>
        <h1>${title}</h1>
        <p>${message}</p>
        <div class="actions">
            <a class="btn" href="${homeLink}">Go to Login</a>
        </div>
    </main>
</body>
</html>
    `);
}

function renderAccountSetupPage({ token, firstName = '', lastName = '', role = '' }) {
    const safeToken = String(token || '').replace(/"/g, '&quot;');
    const safeFirstName = String(firstName || '').replace(/</g, '&lt;');
    const safeLastName = String(lastName || '').replace(/</g, '&lt;');
    const safeRole = String(role || '').replace(/</g, '&lt;');

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Create Account Credentials</title>
    <style>
        body { font-family: Arial, sans-serif; background: #f2f6ff; margin: 0; padding: 24px; color: #1f2937; }
        .card { max-width: 520px; margin: 0 auto; background: #fff; border-radius: 14px; padding: 24px; box-shadow: 0 18px 40px rgba(15,23,42,0.12); }
        h1 { margin: 0 0 10px; font-size: 24px; }
        .muted { margin: 0 0 18px; color: #64748b; font-size: 14px; line-height: 1.6; }
        .field { margin-bottom: 12px; }
        label { display: block; margin-bottom: 6px; font-size: 13px; color: #334155; font-weight: 600; }
        input[type="text"], input[type="password"] { width: 100%; box-sizing: border-box; padding: 10px 12px; border: 1px solid #d9e1f3; border-radius: 8px; font-size: 14px; }
        .consent { display: flex; gap: 8px; align-items: flex-start; font-size: 13px; color: #334155; }
        .btn { margin-top: 12px; width: 100%; border: 0; border-radius: 10px; background: #1d4ed8; color: #fff; font-weight: 700; padding: 11px 14px; cursor: pointer; }
        .btn:disabled { opacity: 0.7; cursor: not-allowed; }
        .error { display: none; margin-top: 10px; font-size: 13px; color: #dc2626; }
        .success { display: none; margin-top: 10px; font-size: 13px; color: #15803d; }
        .modal { position: fixed; inset: 0; background: rgba(15,23,42,0.45); display: none; align-items: center; justify-content: center; padding: 20px; }
        .modal-card { width: 100%; max-width: 420px; background: #fff; border-radius: 12px; padding: 22px; text-align: center; box-shadow: 0 20px 48px rgba(15,23,42,0.2); }
        .modal-title { margin: 0 0 8px; font-size: 20px; color: #0f172a; }
        .modal-copy { margin: 0; color: #64748b; line-height: 1.6; font-size: 14px; }
        .modal-btn { margin-top: 16px; border: 0; border-radius: 8px; padding: 10px 14px; background: #1d4ed8; color: #fff; font-weight: 700; cursor: pointer; }
    </style>
</head>
<body>
    <main class="card">
        <h1>Complete Your Account Setup</h1>
        <p class="muted">Welcome ${safeFirstName} ${safeLastName}. Your email is verified for role <strong>${safeRole}</strong>. Create your account credentials to continue.</p>
        <form id="setup-form">
            <input type="hidden" id="token" value="${safeToken}" />
            <div class="field">
                <label for="username">Preferred Username</label>
                <input id="username" type="text" required minlength="3" maxlength="100" />
            </div>
            <div class="field">
                <label for="password">Password</label>
                <input id="password" type="password" required minlength="6" />
            </div>
            <div class="field">
                <label for="confirmPassword">Confirm Password</label>
                <input id="confirmPassword" type="password" required minlength="6" />
            </div>
            <div class="field consent">
                <input id="consent" type="checkbox" required />
                <label for="consent">I confirm that all submitted details are accurate and I agree to wait for admin account approval.</label>
            </div>
            <button id="submit-btn" type="submit" class="btn" disabled>Create Account</button>
            <p id="error" class="error"></p>
        </form>
    </main>

    <div id="approval-modal" class="modal" role="dialog" aria-modal="true" aria-labelledby="approval-modal-title">
        <div class="modal-card">
            <h2 id="approval-modal-title" class="modal-title">Account Submitted</h2>
            <p class="modal-copy">Your account is now pending admin approval. You will receive an email once approved.</p>
            <button id="approval-modal-btn" class="modal-btn" type="button">Go to Login</button>
        </div>
    </div>

    <script>
        const form = document.getElementById('setup-form');
        const errorEl = document.getElementById('error');
        const submitBtn = document.getElementById('submit-btn');
        const consentCheckbox = document.getElementById('consent');
        const approvalModal = document.getElementById('approval-modal');
        const approvalModalBtn = document.getElementById('approval-modal-btn');

        function syncSubmitEnabledState() {
            if (!submitBtn) return;
            submitBtn.disabled = !consentCheckbox.checked;
        }

        consentCheckbox.addEventListener('change', syncSubmitEnabledState);
        syncSubmitEnabledState();

        approvalModalBtn.addEventListener('click', () => {
            window.location.href = '/html/index.html';
        });

        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            errorEl.style.display = 'none';

            const token = document.getElementById('token').value;
            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            const consentGiven = document.getElementById('consent').checked;

            if (!username || !password || !confirmPassword) {
                errorEl.textContent = 'All fields are required.';
                errorEl.style.display = 'block';
                return;
            }
            if (password !== confirmPassword) {
                errorEl.textContent = 'Passwords do not match.';
                errorEl.style.display = 'block';
                return;
            }
            if (password.length < 6) {
                errorEl.textContent = 'Password must be at least 6 characters.';
                errorEl.style.display = 'block';
                return;
            }
            if (!consentGiven) {
                errorEl.textContent = 'Consent is required to continue.';
                errorEl.style.display = 'block';
                return;
            }

            submitBtn.disabled = true;
            submitBtn.textContent = 'Creating account...';

            try {
                const response = await fetch('/api/staff/complete-registration', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token, username, password, confirmPassword, consentGiven })
                });

                const data = await response.json();
                if (!response.ok) {
                    errorEl.textContent = data.message || 'Unable to complete account setup.';
                    errorEl.style.display = 'block';
                    submitBtn.textContent = 'Create Account';
                    syncSubmitEnabledState();
                    return;
                }

                    approvalModal.style.display = 'flex';
                form.reset();
                submitBtn.textContent = 'Done';
                    submitBtn.disabled = true;
            } catch (error) {
                errorEl.textContent = 'Server error. Please try again.';
                errorEl.style.display = 'block';
                submitBtn.textContent = 'Create Account';
                syncSubmitEnabledState();
            }
        });
    </script>
</body>
</html>
    `;
}

// Register staff profile first, then send OTP for email verification.
exports.registerStaff = async (req, res) => {
    const connection = await db.getConnection();
    let transactionStarted = false;
    try {
        await ensureStaffEmailVerificationTable();
        await ensureStaffProfileSchema();

        const {
            first_name,
            middle_name,
            last_name,
            birthday,
            gender,
            employee_id,
            email,
            role
        } = req.body;

        if (!first_name || !last_name || !birthday || !gender || !employee_id || !email || !role) {
            return res.status(400).json({
                message: 'First name, last name, birthday, gender, employee ID, email, and role are required'
            });
        }

        const normalizedEmail = String(email).trim().toLowerCase();
        const normalizedGender = String(gender).trim();
        const normalizedFirstName = String(first_name).trim();
        const normalizedMiddleName = String(middle_name || '').trim();
        const normalizedLastName = String(last_name).trim();
        const normalizedEmployeeId = String(employee_id).trim();

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
            return res.status(400).json({ message: 'Invalid email format' });
        }

        if (!nameRegex.test(normalizedFirstName) || !nameRegex.test(normalizedLastName)) {
            return res.status(400).json({ message: 'First and last name must contain letters only' });
        }

        if (normalizedMiddleName && !nameRegex.test(normalizedMiddleName)) {
            return res.status(400).json({ message: 'Middle name must contain letters only if provided' });
        }

        if (!numericRegex.test(normalizedEmployeeId)) {
            return res.status(400).json({ message: 'Employee ID must contain numbers only' });
        }

        // Check if employee_id or email already exists in active or pending accounts.
        const [existingStaff] = await connection.query(
            "SELECT id FROM staff WHERE employee_id = ? OR email = ?",
            [normalizedEmployeeId, normalizedEmail]
        );

        const [existingPending] = await connection.query(
            "SELECT id FROM pending_staff WHERE employee_id = ? OR email = ?",
            [normalizedEmployeeId, normalizedEmail]
        );

        // Check staged registrations waiting for OTP verification.
        const [existingStaged] = await connection.query(
            "SELECT id, employee_id, email FROM staff_email_verifications WHERE employee_id = ? OR email = ?",
            [normalizedEmployeeId, normalizedEmail]
        );

        if (existingStaff.length > 0) {
            return res.status(400).json({ message: "Employee ID or Email already registered" });
        }
        if (existingPending.length > 0) {
            return res.status(400).json({ message: "Employee ID or Email already pending approval" });
        }
        const otp = generateOtpCode();
        const otpHash = hashOtp(otp);
        const expiresAt = new Date(Date.now() + STAFF_REG_OTP_EXPIRY_MINUTES * 60 * 1000);

        await connection.beginTransaction();
        transactionStarted = true;

        if (existingStaged.length > 0) {
            const duplicateByOtherEmailOrEmployee = existingStaged.some((row) =>
                (row.email === normalizedEmail && row.employee_id !== normalizedEmployeeId) ||
                (row.employee_id === normalizedEmployeeId && row.email !== normalizedEmail)
            );

            if (duplicateByOtherEmailOrEmployee) {
                return res.status(400).json({ message: 'Employee ID or Email already has a pending verification request' });
            }

            await connection.query(
                `
                    UPDATE staff_email_verifications
                    SET first_name = ?,
                        middle_name = ?,
                        last_name = ?,
                        birthday = ?,
                        gender = ?,
                        employee_id = ?,
                        email = ?,
                        role = ?,
                        verification_token_hash = ?,
                        verification_token_expires = ?,
                        attempts_left = ?,
                        consumed = 0,
                        username = NULL,
                        password_hash = NULL,
                        consent_given = 0
                    WHERE email = ?
                `,
                [
                    normalizedFirstName,
                    normalizedMiddleName,
                    normalizedLastName,
                    birthday,
                    normalizedGender,
                    normalizedEmployeeId,
                    normalizedEmail,
                    role,
                    otpHash,
                    expiresAt,
                    STAFF_REG_OTP_MAX_ATTEMPTS,
                    normalizedEmail
                ]
            );
        } else {
            const sql = `
                INSERT INTO staff_email_verifications (
                    first_name,
                    middle_name,
                    last_name,
                    birthday,
                    gender,
                    employee_id,
                    email,
                    role,
                    verification_token_hash,
                    verification_token_expires,
                    attempts_left,
                    consumed
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
            `;

            const params = [
                normalizedFirstName,
                normalizedMiddleName,
                normalizedLastName,
                birthday,
                normalizedGender,
                normalizedEmployeeId,
                normalizedEmail,
                role,
                otpHash,
                expiresAt,
                STAFF_REG_OTP_MAX_ATTEMPTS
            ];

            await connection.query(sql, params);
        }

        await sendStaffRegistrationOtpEmail({
            to: normalizedEmail,
            firstName: normalizedFirstName,
            otp,
            expiresMinutes: STAFF_REG_OTP_EXPIRY_MINUTES
        });

        await connection.commit();
        transactionStarted = false;
        res.status(200).json({
            message: 'OTP sent to your email. Enter the OTP to complete account setup and request admin approval.'
        });

    } catch (error) {
        if (transactionStarted) {
            await connection.rollback();
        }
        console.error('Registration error:', error);

        if (!error.code) {
            return res.status(500).json({ message: error.message || 'Server error during registration' });
        }

        const { message, status } = handleDbError(error);
        return res.status(status).json({ message });
    } finally {
        connection.release();
    }
};

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
            "SELECT id, first_name, middle_name, last_name, birthday, gender, username, email, employee_id, role, status, consent_given, created_at FROM staff ORDER BY id DESC"
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
            "SELECT id, first_name, middle_name, last_name, birthday, gender, username, email, employee_id, role, status, consent_given, created_at FROM pending_staff ORDER BY id DESC"
        );
        res.status(200).json(pending);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// Delete active staff account
exports.deleteStaff = async (req, res) => {
    try {
        const id = Number.parseInt(req.params.id, 10);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ message: 'Invalid staff id' });
        }

        // Prevent deleting the currently logged in account.
        if (req.sessionUser && Number(req.sessionUser.id) === id) {
            return res.status(400).json({ message: 'You cannot delete your own account while logged in.' });
        }

        const [result] = await db.query('DELETE FROM staff WHERE id = ?', [id]);
        if (!result || result.affectedRows === 0) {
            return res.status(404).json({ message: 'Account not found' });
        }

        return res.status(200).json({ message: 'Account deleted successfully' });
    } catch (error) {
        console.error('Delete staff error:', error);
        return res.status(500).json({ message: 'Server error during deletion' });
    }
};

// Approve staff account
exports.approveStaff = async (req, res) => {
    const { id } = req.params;
    const connection = await db.getConnection();
    let transactionStarted = false;
    try {
        await connection.beginTransaction();
        transactionStarted = true;

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
            INSERT INTO staff (
                first_name,
                middle_name,
                last_name,
                birthday,
                gender,
                username,
                password_hash,
                employee_id,
                email,
                role,
                consent_given,
                status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const params = [
            user.first_name,
            user.middle_name,
            user.last_name,
            user.birthday,
            user.gender,
            user.username,
            user.password_hash,
            user.employee_id,
            user.email,
            user.role,
            user.consent_given || 0,
            'Active'
        ];
        await connection.query(insertSql, params);

        // 3. Delete from pending
        await connection.query("DELETE FROM pending_staff WHERE id = ?", [id]);

        await connection.commit();
        transactionStarted = false;

        // Send notification after commit so account approval is not blocked by email delivery failures.
        let notificationEmailSent = true;
        let notificationError = null;
        try {
            await sendStaffApprovalEmail({
                to: user.email,
                username: user.username,
                role: user.role
            });
        } catch (emailError) {
            notificationEmailSent = false;
            notificationError = emailError.message;
            console.error('Approval notification email error:', emailError.message);
        }

        res.status(200).json({
            message: notificationEmailSent
                ? "Account approved and moved to staff table. Approval email sent."
                : "Account approved and moved to staff table, but approval email failed to send.",
            notificationEmailSent,
            notificationEmailRecipient: user.email,
            notificationError
        });

    } catch (error) {
        if (transactionStarted) {
            await connection.rollback();
        }
        console.error('Approval error:', error);
        res.status(500).json({ message: "Server error during approval" });
    } finally {
        connection.release();
    }
};

// Verify email token and present credential setup form.
exports.verifyStaffEmail = async (req, res) => {
    const connection = await db.getConnection();
    try {
        await ensureStaffEmailVerificationTable();
        await ensureStaffProfileSchema();

        const token = req.query.token;

        if (!token) {
            return sendVerificationResult(req, res, {
                statusCode: 400,
                success: false,
                title: 'Verification Link Invalid',
                message: 'Verification token is required.'
            });
        }

        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

        const [stagedMatches] = await connection.query(
            `
                SELECT *
                FROM staff_email_verifications
                WHERE verification_token_hash = ?
                LIMIT 1
            `,
            [tokenHash]
        );

        if (stagedMatches.length === 0) {
            return sendVerificationResult(req, res, {
                statusCode: 400,
                success: false,
                title: 'Link Not Valid',
                message: 'This verification link is invalid or has already been used.'
            });
        }

        const staged = stagedMatches[0];

        if (new Date(staged.verification_token_expires) <= new Date()) {
            return sendVerificationResult(req, res, {
                statusCode: 400,
                success: false,
                title: 'Verification Link Expired',
                message: 'This verification link has expired. Please register again or request a new link.'
            });
        }

        const [alreadyInStaff] = await connection.query(
            "SELECT id FROM staff WHERE employee_id = ? OR email = ?",
            [staged.employee_id, staged.email]
        );

        if (alreadyInStaff.length > 0) {
            return sendVerificationResult(req, res, {
                statusCode: 409,
                success: false,
                title: 'Account Already Exists',
                message: 'This account already exists in the active staff list.'
            });
        }

        const [alreadyInPending] = await connection.query(
            "SELECT id FROM pending_staff WHERE employee_id = ? OR email = ?",
            [staged.employee_id, staged.email]
        );

        if (alreadyInPending.length > 0) {
            return sendVerificationResult(req, res, {
                statusCode: 200,
                success: true,
                title: 'Already Submitted',
                message: 'Your account setup is complete and currently pending admin approval.'
            });
        }

        return res.status(200).send(
            renderAccountSetupPage({
                token,
                firstName: staged.first_name,
                lastName: staged.last_name,
                role: staged.role
            })
        );
    } catch (error) {
        console.error('Email verification error:', error);
        return sendVerificationResult(req, res, {
            statusCode: 500,
            success: false,
            title: 'Verification Failed',
            message: 'A server error occurred while verifying your email. Please try again later.'
        });
    } finally {
        connection.release();
    }
};

exports.completeStaffRegistration = async (req, res) => {
    const connection = await db.getConnection();
    let transactionStarted = false;
    try {
        await ensureStaffEmailVerificationTable();
        await ensureStaffProfileSchema();

        const { email, otp, username, password, confirmPassword, consentGiven } = req.body;

        if (!email || !otp || !username || !password || !confirmPassword) {
            return res.status(400).json({ message: 'Email, OTP, username, password, and confirm password are required' });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({ message: 'Passwords do not match' });
        }

        if (String(password).length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters' });
        }

        if (!consentGiven) {
            return res.status(400).json({ message: 'Consent is required before account creation' });
        }

        const normalizedUsername = String(username).trim();
        const normalizedEmail = String(email).trim().toLowerCase();
        const otpHash = hashOtp(String(otp).trim());

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
            return res.status(400).json({ message: 'Invalid email format' });
        }

        if (!/^\d{6}$/.test(String(otp).trim())) {
            return res.status(400).json({ message: 'A valid 6-digit OTP is required' });
        }

        const [stagedRows] = await connection.query(
            `
                SELECT *
                FROM staff_email_verifications
                WHERE email = ?
                  AND consumed = 0
                LIMIT 1
            `,
            [normalizedEmail]
        );

        if (stagedRows.length === 0) {
            return res.status(400).json({ message: 'No active OTP found. Please request a new OTP.' });
        }

        const staged = stagedRows[0];

        const expiresAt = new Date(staged.verification_token_expires);
        if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
            await connection.query('UPDATE staff_email_verifications SET consumed = 1 WHERE id = ?', [staged.id]);
            return res.status(400).json({ message: 'OTP is expired. Please request a new OTP.' });
        }

        if (Number(staged.attempts_left || 0) <= 0) {
            await connection.query('UPDATE staff_email_verifications SET consumed = 1 WHERE id = ?', [staged.id]);
            return res.status(400).json({ message: 'OTP attempts exceeded. Please request a new OTP.' });
        }

        if (String(staged.verification_token_hash || '') !== otpHash) {
            await connection.query(
                'UPDATE staff_email_verifications SET attempts_left = attempts_left - 1 WHERE id = ? AND attempts_left > 0',
                [staged.id]
            );
            return res.status(400).json({ message: 'Invalid OTP code' });
        }

        const [usernameTakenInStaff] = await connection.query(
            'SELECT id FROM staff WHERE username = ? LIMIT 1',
            [normalizedUsername]
        );
        const [usernameTakenInPending] = await connection.query(
            'SELECT id FROM pending_staff WHERE username = ? LIMIT 1',
            [normalizedUsername]
        );

        if (usernameTakenInStaff.length > 0 || usernameTakenInPending.length > 0) {
            return res.status(409).json({ message: 'Username is already taken' });
        }

        const [alreadyInPending] = await connection.query(
            'SELECT id FROM pending_staff WHERE employee_id = ? OR email = ? LIMIT 1',
            [staged.employee_id, staged.email]
        );
        if (alreadyInPending.length > 0) {
            return res.status(409).json({ message: 'Account is already pending admin approval' });
        }

        const [alreadyInStaff] = await connection.query(
            'SELECT id FROM staff WHERE employee_id = ? OR email = ? LIMIT 1',
            [staged.employee_id, staged.email]
        );
        if (alreadyInStaff.length > 0) {
            return res.status(409).json({ message: 'Account already exists in active staff list' });
        }

        const passwordHash = await hashPassword(password);

        await connection.beginTransaction();
        transactionStarted = true;

        await connection.query(
            `
                INSERT INTO pending_staff (
                    first_name,
                    middle_name,
                    last_name,
                    birthday,
                    gender,
                    username,
                    password_hash,
                    employee_id,
                    email,
                    role,
                    consent_given,
                    status
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
                staged.first_name,
                staged.middle_name,
                staged.last_name,
                staged.birthday,
                staged.gender,
                normalizedUsername,
                passwordHash,
                staged.employee_id,
                staged.email,
                staged.role,
                1,
                'Pending'
            ]
        );

        await connection.query('DELETE FROM staff_email_verifications WHERE id = ?', [staged.id]);

        await connection.commit();
        transactionStarted = false;

        return res.status(200).json({
            message: 'Account credentials saved. Please wait for the admin to approve your account.'
        });
    } catch (error) {
        if (transactionStarted) {
            await connection.rollback();
        }
        console.error('Complete registration error:', error);
        return res.status(500).json({ message: 'Server error while completing account setup' });
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
        const { username, password, role } = req.body;

        if (!username || !password || !role) {
            return res.status(400).json({ message: "Role, username, and password are required" });
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

        const selectedRole = String(role).trim().toLowerCase();
        const accountRole = String(user.role || '').trim().toLowerCase();
        if (selectedRole !== accountRole) {
            return res.status(401).json({ message: "Selected role does not match this account" });
        }

        // Return user info (excluding password)
        const { password_hash, ...userInfo } = user;
        const sessionId = createSessionForUser({
            id: userInfo.id,
            first_name: userInfo.first_name,
            middle_name: userInfo.middle_name,
            last_name: userInfo.last_name,
            username: userInfo.username,
            role: userInfo.role,
            email: userInfo.email
        });
        setSessionCookie(req, res, sessionId);
        res.status(200).json({ message: "Login successful", user: userInfo });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: "Server error" });
    }
};

exports.logoutStaff = async (req, res) => {
    const cookies = parseCookies(req.headers.cookie || '');
    const sessionId = cookies[SESSION_COOKIE_NAME];

    if (sessionId) {
        destroySession(sessionId);
    }
    clearSessionCookie(req, res);

    return res.status(200).json({ message: 'Logged out successfully' });
};

exports.getSession = async (req, res) => {
    return res.status(200).json({
        authenticated: true,
        user: req.sessionUser
    });
};

// Request password reset OTP
exports.forgotPassword = async (req, res) => {
    try {
        await ensureStaffPasswordResetSchema();

        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }

        // Always return generic message to prevent account enumeration.
        const genericResponse = {
            message: 'If an account exists for that email, a password reset OTP has been sent.'
        };

        const [users] = await db.query(
            'SELECT id, username, email FROM staff WHERE email = ? LIMIT 1',
            [String(email).trim().toLowerCase()]
        );

        if (users.length === 0) {
            return res.status(200).json(genericResponse);
        }

        const user = users[0];
        const resetOtp = generateOtpCode();
        const resetOtpHash = hashOtp(resetOtp);
        const expiresAt = new Date(Date.now() + STAFF_RESET_OTP_EXPIRY_MINUTES * 60 * 1000);

        await db.query(
            `
                UPDATE staff
                SET
                    password_reset_otp_hash = ?,
                    password_reset_otp_expires = ?,
                    password_reset_otp_attempts_left = ?
                WHERE id = ?
            `,
            [resetOtpHash, expiresAt, STAFF_RESET_OTP_MAX_ATTEMPTS, user.id]
        );

        await sendStaffPasswordResetEmail({
            to: user.email,
            username: user.username,
            otp: resetOtp,
            expiresMinutes: STAFF_RESET_OTP_EXPIRY_MINUTES
        });

        return res.status(200).json(genericResponse);
    } catch (error) {
        console.error('Forgot password error:', error);
        return res.status(500).json({ message: 'Server error while requesting password reset' });
    }
};

// Reset password using OTP
exports.resetPassword = async (req, res) => {
    try {
        await ensureStaffPasswordResetSchema();

        const { email, otp, password, confirmPassword } = req.body;

        if (!email || !otp || !password || !confirmPassword) {
            return res.status(400).json({ message: 'Email, OTP, password, and confirm password are required' });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({ message: 'Passwords do not match' });
        }

        if (password.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters' });
        }

        const normalizedEmail = String(email).trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
            return res.status(400).json({ message: 'A valid email is required' });
        }

        if (!/^\d{6}$/.test(String(otp).trim())) {
            return res.status(400).json({ message: 'A valid 6-digit OTP is required' });
        }

        const otpHash = hashOtp(String(otp).trim());

        const [users] = await db.query(
            `
                SELECT id, password_reset_otp_hash, password_reset_otp_expires, password_reset_otp_attempts_left
                FROM staff
                WHERE email = ?
                LIMIT 1
            `,
            [normalizedEmail]
        );

        if (users.length === 0) {
            return res.status(400).json({ message: 'Invalid OTP or email' });
        }

        const user = users[0];

        if (!user.password_reset_otp_hash || !user.password_reset_otp_expires) {
            return res.status(400).json({ message: 'No active OTP found. Please request a new OTP.' });
        }

        const expiresAt = new Date(user.password_reset_otp_expires);
        if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
            await db.query(
                `
                    UPDATE staff
                    SET password_reset_otp_hash = NULL,
                        password_reset_otp_expires = NULL,
                        password_reset_otp_attempts_left = ?
                    WHERE id = ?
                `,
                [STAFF_RESET_OTP_MAX_ATTEMPTS, user.id]
            );
            return res.status(400).json({ message: 'OTP is expired. Please request a new OTP.' });
        }

        if (Number(user.password_reset_otp_attempts_left || 0) <= 0) {
            await db.query(
                `
                    UPDATE staff
                    SET password_reset_otp_hash = NULL,
                        password_reset_otp_expires = NULL,
                        password_reset_otp_attempts_left = ?
                    WHERE id = ?
                `,
                [STAFF_RESET_OTP_MAX_ATTEMPTS, user.id]
            );
            return res.status(400).json({ message: 'OTP attempts exceeded. Please request a new OTP.' });
        }

        if (user.password_reset_otp_hash !== otpHash) {
            await db.query(
                'UPDATE staff SET password_reset_otp_attempts_left = password_reset_otp_attempts_left - 1 WHERE id = ? AND password_reset_otp_attempts_left > 0',
                [user.id]
            );
            return res.status(400).json({ message: 'Invalid OTP code' });
        }

        const passwordHash = await hashPassword(password);

        await db.query(
            `
                UPDATE staff
                SET
                    password_hash = ?,
                    password_reset_otp_hash = NULL,
                    password_reset_otp_expires = NULL,
                    password_reset_otp_attempts_left = ?
                WHERE id = ?
            `,
            [passwordHash, STAFF_RESET_OTP_MAX_ATTEMPTS, user.id]
        );

        return res.status(200).json({ message: 'Password reset successful. You can now log in.' });
    } catch (error) {
        console.error('Reset password error:', error);
        return res.status(500).json({ message: 'Server error while resetting password' });
    }
};
