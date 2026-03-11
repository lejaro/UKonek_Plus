const tabLogin = document.getElementById('tab-login');
const tabRegister = document.getElementById('tab-register');
const tabReset = document.getElementById('tab-reset');

// Handle port mismatch during development (Live Server on 5500, Backend on 5000)
const API_BASE = window.location.port === '5500' ? 'http://localhost:5000' : '';

const loginPanel = document.getElementById('login-panel');
const registerPanel = document.getElementById('register-panel');
const resetPanel = document.getElementById('reset-panel');

const panelTitle = document.getElementById('panel-title');
const panelDesc = document.getElementById('panel-desc');

function hideAllPanels() {
    loginPanel.style.display = 'none';
    registerPanel.style.display = 'none';
    resetPanel.style.display = 'none';

    tabLogin.classList.remove('active');
    tabRegister.classList.remove('active');
    tabReset.classList.remove('active');

    tabLogin.setAttribute('aria-selected', 'false');
    tabRegister.setAttribute('aria-selected', 'false');
    tabReset.setAttribute('aria-selected', 'false');
}

tabLogin.addEventListener('click', () => {
    hideAllPanels();
    tabLogin.classList.add('active');
    tabLogin.setAttribute('aria-selected', 'true');
    loginPanel.style.display = 'block';
    panelTitle.textContent = 'Welcome Back';
    panelDesc.textContent = 'Enter your credentials to access the portal';
});

tabRegister.addEventListener('click', () => {
    hideAllPanels();
    tabRegister.classList.add('active');
    tabRegister.setAttribute('aria-selected', 'true');
    registerPanel.style.display = 'block';
    panelTitle.textContent = 'Join U-Konek+';
    panelDesc.textContent = 'Register as medical personnel to get started';
});

tabReset.addEventListener('click', () => {
    hideAllPanels();
    tabReset.classList.add('active');
    tabReset.setAttribute('aria-selected', 'true');
    resetPanel.style.display = 'block';
    panelTitle.textContent = 'Reset Password';
    panelDesc.textContent = 'Restore access to your account';
});

// Dynamic Doctor Fields
const regRoleSelect = document.getElementById('reg-role');
const doctorFields = document.getElementById('doctor-fields');
regRoleSelect.addEventListener('change', () => {
    if (regRoleSelect.value === 'doctor') {
        doctorFields.style.display = 'block';
    } else {
        doctorFields.style.display = 'none';
    }
});

// Registration Form Handler
document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('reg-username').value.trim();
    const employee_id = document.getElementById('reg-employee-id').value.trim();
    const role = document.getElementById('reg-role').value;
    const password = document.getElementById('reg-password').value;
    const confirmPassword = document.getElementById('reg-confirm-password').value;
    const specialization = document.getElementById('reg-specialization').value.trim();
    const schedule = document.getElementById('reg-schedule').value.trim();

    const err = document.getElementById('register-error');
    const success = document.getElementById('register-success');
    err.style.display = 'none';
    success.style.display = 'none';

    // Basic Client-side matches Middleware logic
    if (password !== confirmPassword) {
        err.textContent = 'Passwords do not match.';
        err.style.display = 'block';
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/staff/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username,
                employee_id,
                role,
                password,
                confirmPassword,
                specialization,
                schedule
            })
        });

        const data = await response.json();

        if (response.ok) {
            success.textContent = data.message;
            success.style.display = 'block';
            document.getElementById('register-form').reset();
            doctorFields.style.display = 'none';
        } else {
            err.textContent = data.message || 'Registration failed.';
            err.style.display = 'block';
        }
    } catch (error) {
        console.error('Error:', error);
        err.textContent = 'Server connection failed.';
        err.style.display = 'block';
    }
});

// Login Form Handler
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const err = document.getElementById('login-error');

    err.style.display = 'none';

    if (!username || !password) {
        err.textContent = 'Please enter both username and password.';
        err.style.display = 'block';
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/staff/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            // Success: Redirect to dashboard or store user info
            console.log('Login successful:', data.user);
            window.location.href = '/html/dashboard.html';
        } else {
            err.textContent = data.message || 'Login failed.';
            err.style.display = 'block';
        }
    } catch (error) {
        console.error('Error:', error);
        err.textContent = 'Server connection failed.';
        err.style.display = 'block';
    }
});

// Reset Form Handler
document.getElementById('reset-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const msg = document.getElementById('reset-msg');
    msg.style.display = 'block';
    msg.style.color = 'green';
    msg.textContent = 'If the email exists, a reset link will be sent.';
});
