const sidebar = document.getElementById('sidebar');
const burger = document.getElementById('burger');
const back = document.getElementById('back');

// Handle port mismatch during development (Live Server on 5500, Backend on 5000)
const API_BASE = window.location.port === '5500' ? 'http://localhost:5000' : '';

function state() {
  if (!sidebar) return;
  const collapsed = sidebar.classList.contains('collapsed');
  const slid = sidebar.classList.contains('slid');
  burger.textContent = (slid || !collapsed) ? '←' : '☰';
  if (back) back.style.display = (collapsed && !slid) ? 'none' : 'inline-block';
}

if (burger) {
  burger.addEventListener('click', () => {
    if (window.innerWidth <= 900) {
      sidebar.classList.toggle('slid');
      sidebar.classList.remove('collapsed');
    } else {
      sidebar.classList.toggle('collapsed');
    }
    state();
  });
  window.addEventListener('resize', state);
}

if (back) {
  back.addEventListener('click', () => {
    sidebar.classList.add('collapsed');
    sidebar.classList.remove('slid');
    state();
  });
}

document.addEventListener('click', (e) => {
  if (window.innerWidth <= 900 && sidebar && sidebar.classList.contains('slid')) {
    const inside = sidebar.contains(e.target) || (burger && burger.contains(e.target)) || (back && back.contains(e.target));
    if (!inside) {
      sidebar.classList.remove('slid');
      state();
    }
  }
});

state();

const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    window.location.href = '/';
  });
}

// Search input handler
const searchInput = document.getElementById('search-input');
if (searchInput) {
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const q = searchInput.value.trim();
      if (q) console.log('Search:', q);
    }
  });
}

// Dropdown toggle for Users menu
const navBtn = document.querySelector('.nav-btn');
const dropdownMenu = document.querySelector('.dropdown-menu');
if (navBtn && dropdownMenu) {
  navBtn.addEventListener('click', (e) => {
    e.preventDefault();
    // toggle the hidden class so !important rules are respected
    dropdownMenu.classList.toggle('hidden');
  });
}

// Section navigation
const navLinks = document.querySelectorAll('.nav-item[data-section]');
const dropdownItems = document.querySelectorAll('.dropdown-item');
const dashboardSection = document.getElementById('dashboard-section');
const usersSection = document.getElementById('users-section');

function hideAllSections() {
  // add the hidden class everywhere instead of fiddling with style.display;
  // .hidden has !important so inline styles would lose to it
  if (dashboardSection) dashboardSection.classList.add('hidden');
  if (usersSection) usersSection.classList.add('hidden');
  // Hide all subsections
  const accountMgmt = document.getElementById('account-management');
  const accountReg = document.getElementById('account-registration');
  if (accountMgmt) accountMgmt.classList.add('hidden');
  if (accountReg) accountReg.classList.add('hidden');
}

navLinks.forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const section = link.getAttribute('data-section');
    hideAllSections();
    if (section === 'dashboard' && dashboardSection) {
      dashboardSection.classList.remove('hidden');
    }
    if (dropdownMenu) dropdownMenu.classList.add('hidden');
  });
});

dropdownItems.forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    const section = item.getAttribute('data-section');
    hideAllSections();
    if (usersSection) usersSection.classList.remove('hidden');
    const subsection = document.getElementById(section);
    if (subsection) subsection.classList.remove('hidden');
  });
});

// Stored accounts (identifier -> account data)
const storedAccounts = new Map();

async function loadStaffData() {
  try {
    const response = await fetch(`${API_BASE}/api/staff`);
    if (!response.ok) throw new Error('Failed to fetch staff');
    const staffList = await response.json();

    const accountsTbody = document.getElementById('accounts-tbody');
    if (accountsTbody) {
      accountsTbody.innerHTML = ''; // Clear hardcoded rows
      staffList.forEach(user => {
        const identifier = user.username || user.employee_id;
        storedAccounts.set(identifier, user);

        const row = document.createElement('tr');
        row.className = 'account-row';
        row.setAttribute('data-role', user.role.toLowerCase());
        row.setAttribute('data-id', identifier); // Store identifier for lookup
        row.innerHTML = `
                    <td class="table-cell">${user.username || '—'}</td>
                    <td class="table-cell">${user.employee_id || '—'}</td>
                    <td class="table-cell">${user.role.charAt(0).toUpperCase() + user.role.slice(1)}</td>
                    <td class="table-cell"><span class="badge-${user.status.toLowerCase()}">${user.status}</span></td>
                `;
        accountsTbody.appendChild(row);
        attachAccountRowListener(row);
      });
    }
  } catch (error) {
    console.error('Error loading staff:', error);
  }
}

async function loadPendingStaffData() {
  try {
    const response = await fetch(`${API_BASE}/api/staff/pending`);
    if (!response.ok) throw new Error('Failed to fetch pending staff');
    const pendingList = await response.json();

    const pendingTbody = document.getElementById('pending-tbody');
    if (pendingTbody) {
      pendingTbody.innerHTML = '';
      pendingList.forEach(user => {
        const identifier = user.username || user.employee_id;
        storedAccounts.set(identifier, user);

        const row = document.createElement('tr');
        row.className = 'pending-row';
        row.setAttribute('data-role', user.role.toLowerCase());
        row.setAttribute('data-id', identifier);
        row.innerHTML = `
                    <td class="table-cell">${user.username || '—'}</td>
                    <td class="table-cell">${user.employee_id || '—'}</td>
                    <td class="table-cell">${user.role.charAt(0).toUpperCase() + user.role.slice(1)}</td>
                    <td class="table-cell">${new Date(user.created_at).toLocaleString()}</td>
                `;
        pendingTbody.appendChild(row);
        attachPendingRowListener(row);
      });
    }
  } catch (error) {
    console.error('Error loading pending staff:', error);
  }
}

// Initial load
loadStaffData();
loadPendingStaffData();

// Utility validation functions
function validatePassword(pw) {
  // at least 8 chars, uppercase, lowercase, number, special
  return /(?=.{8,})(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])/.test(pw);
}
function validateEmail(email) {
  return /.+@.+\..+/.test(email);
}
function validateContactNumber(num) {
  const digits = num.replace(/\D/g, '');
  return digits.length === 11;
}
function calculateAge(birthIso) {
  if (!birthIso) return 0;
  const b = new Date(birthIso);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
}

// Role-specific fields for dashboard registration
const regRoleDash = document.getElementById('reg-role-dash');
const doctorFieldsDash = document.getElementById('doctor-fields-dash');
if (regRoleDash && doctorFieldsDash) {
  regRoleDash.addEventListener('change', () => {
    doctorFieldsDash.style.display = regRoleDash.value === 'doctor' ? 'block' : 'none';
  });
}

// Registration form handler (internal registration)
const registrationForm = document.getElementById('registration-form');
if (registrationForm) {
  registrationForm.addEventListener('submit', async e => {
    e.preventDefault();
    const username = document.getElementById('reg-username-dash').value.trim();
    const employee_id = document.getElementById('reg-employee-id-dash').value.trim();
    const role = document.getElementById('reg-role-dash').value;
    const password = document.getElementById('reg-password-dash').value;
    const confirmPassword = document.getElementById('reg-confirm-password-dash').value;
    const specialization = document.getElementById('reg-specialization-dash').value.trim();
    const schedule = document.getElementById('reg-schedule-dash').value.trim();
    const msg = document.getElementById('registration-msg');

    msg.style.display = 'none';
    msg.style.color = 'red';

    if (password !== confirmPassword) {
      msg.textContent = 'Passwords do not match.';
      msg.style.display = 'block';
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/staff/register-direct`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username, employee_id, role, password, confirmPassword, specialization, schedule
        })
      });

      const data = await response.json();
      if (response.ok) {
        msg.style.color = 'green';
        msg.textContent = data.message;
        msg.style.display = 'block';
        registrationForm.reset();
        if (doctorFieldsDash) doctorFieldsDash.style.display = 'none';
        loadStaffData(); // Refresh active list
        loadPendingStaffData(); // Refresh pending list just in case
      } else {
        msg.textContent = data.message || 'Registration failed.';
        msg.style.display = 'block';
      }
    } catch (error) {
      console.error('Error:', error);
      msg.textContent = 'Server connection failed.';
      msg.style.display = 'block';
    }
  });
}

// Role filter functionality
const roleFilter = document.getElementById('role-filter');
if (roleFilter) {
  roleFilter.addEventListener('change', (e) => {
    const filterValue = e.target.value.toLowerCase();
    const accountRows = document.querySelectorAll('.account-row');

    accountRows.forEach(row => {
      const role = row.getAttribute('data-role');
      if (filterValue === '' || role === filterValue) {
        row.style.display = '';
      } else {
        row.style.display = 'none';
      }
    });
  });
}

// Modal state
let currentAccountData = null;
let currentAction = null; // 'edit' or 'delete'

// Account row click handler
function attachAccountRowListener(row) {
  row.addEventListener('click', () => {
    const identifier = row.getAttribute('data-id');
    const user = storedAccounts.get(identifier);
    if (!user) return;

    currentAccountData = { ...user };

    // Populate modal
    document.getElementById('modal-name').textContent = user.username;
    document.getElementById('modal-email').textContent = user.employee_id || '—'; // Using employee_id as email placeholder or identifier
    document.getElementById('modal-role').textContent = user.role.charAt(0).toUpperCase() + user.role.slice(1);
    document.getElementById('modal-password').textContent = '••••••••';
    document.getElementById('modal-status').textContent = user.status;

    // Hide/clear extra fields that don't exist in our schema
    const extraFields = ['mi', 'contact', 'address', 'bday'];
    extraFields.forEach(field => {
      const el = document.getElementById(`modal-${field}`);
      if (el) el.textContent = user[field] || '—';
    });

    // Reset confirmation section
    document.getElementById('modal-confirm-section').style.display = 'none';
    document.getElementById('modal-actions').style.display = 'flex';

    // Show modal
    const modal = document.getElementById('account-modal');
    modal.style.display = 'flex';
  });
}

// Attach listeners to existing account rows
document.querySelectorAll('.account-row').forEach(attachAccountRowListener);

// attach listeners to any existing pending rows (none initially)
document.querySelectorAll('.pending-row').forEach(attachPendingRowListener);

// Tab switching
const tabRegistered = document.getElementById('tab-registered');
const tabPending = document.getElementById('tab-pending');
const registeredPane = document.getElementById('registered-pane');
const pendingPane = document.getElementById('pending-pane');
if (tabRegistered && tabPending && registeredPane && pendingPane) {
  tabRegistered.addEventListener('click', () => {
    tabRegistered.classList.add('active');
    tabPending.classList.remove('active');
    registeredPane.classList.remove('hidden');
    pendingPane.classList.add('hidden');
  });
  tabPending.addEventListener('click', () => {
    tabPending.classList.add('active');
    tabRegistered.classList.remove('active');
    pendingPane.classList.remove('hidden');
    registeredPane.classList.add('hidden');
  });
}

// Pending modal logic
function attachPendingRowListener(row) {
  row.addEventListener('click', () => {
    const identifier = row.getAttribute('data-id');
    const stored = storedAccounts.get(identifier);
    if (!stored) {
      console.error('Pending account data not found for:', identifier);
      return;
    }

    // Populate pending modal fields (create modal elements if absent)
    let pendingModal = document.getElementById('pending-modal');
    if (!pendingModal) {
      // create modal markup dynamically and append to body
      pendingModal = document.createElement('div');
      pendingModal.id = 'pending-modal';
      pendingModal.className = 'modal-overlay';
      pendingModal.innerHTML = `
        <div class="modal-content">
          <h2 class="modal-title">Pending Registration</h2>
          <div class="modal-group"><label class="modal-label">Name</label><p id="pending-name" class="modal-text"></p></div>
          <div class="modal-group"><label class="modal-label">M.I.</label><p id="pending-mi" class="modal-text"></p></div>
          <div class="modal-group"><label class="modal-label">Email</label><p id="pending-email" class="modal-text"></p></div>
          <div class="modal-group"><label class="modal-label">Role</label><p id="pending-role" class="modal-text"></p></div>
          <div class="modal-group"><label class="modal-label">Contact</label><p id="pending-contact" class="modal-text"></p></div>
          <div class="modal-group"><label class="modal-label">Address</label><p id="pending-address" class="modal-text"></p></div>
          <div class="modal-group"><label class="modal-label">Birthday</label><p id="pending-bday" class="modal-text"></p></div>
          <div class="modal-actions">
            <button id="pending-accept" class="btn btn-confirm">ACCEPT</button>
            <button id="pending-reject" class="btn btn-delete">REJECT</button>
            <button id="pending-close" class="btn-close">Close</button>
          </div>
          <div id="pending-confirm" class="modal-confirm-section" style="display:none">
            <p id="pending-confirm-text" class="modal-confirm-text"></p>
            <div class="flex gap-12">
              <button id="pending-confirm-yes" class="btn btn-confirm">Confirm</button>
              <button id="pending-confirm-no" class="btn-cancel">Cancel</button>
            </div>
          </div>
        </div>`;
      document.body.appendChild(pendingModal);

      // wire close
      document.getElementById('pending-close').addEventListener('click', () => {
        pendingModal.style.display = 'none';
      });
    }

    // set values
    document.getElementById('pending-name').textContent = stored.username || '';
    document.getElementById('pending-mi').textContent = '—';
    document.getElementById('pending-email').textContent = stored.employee_id || '';
    document.getElementById('pending-role').textContent = stored.role ? (stored.role.charAt(0).toUpperCase() + stored.role.slice(1)) : '';
    document.getElementById('pending-contact').textContent = '—';
    document.getElementById('pending-address').textContent = '—';
    document.getElementById('pending-bday').textContent = '—';

    // show modal
    pendingModal.style.display = 'flex';

    // accept/reject handlers use global pending-action-confirm-modal
    const showConfirm = (text, onConfirmAction) => {
      const global = document.getElementById('pending-action-confirm-modal');
      if (!global) {
        // fallback to inline confirm
        document.getElementById('pending-confirm-text').textContent = text;
        document.getElementById('pending-confirm').style.display = 'block';
        const yes = document.getElementById('pending-confirm-yes');
        const no = document.getElementById('pending-confirm-no');
        const cleanup = () => { document.getElementById('pending-confirm').style.display = 'none'; yes.onclick = null; no.onclick = null; };
        yes.onclick = () => { cleanup(); onConfirmAction(); pendingModal.style.display = 'none'; };
        no.onclick = () => { cleanup(); };
        return;
      }

      // close the pending modal immediately so the confirmation modal isn't displayed behind it
      if (pendingModal) pendingModal.style.display = 'none';

      document.getElementById('pending-action-text').textContent = text;
      global.style.display = 'flex';
      const yes = document.getElementById('pending-action-yes');
      const no = document.getElementById('pending-action-no');
      const cleanup = () => { global.style.display = 'none'; yes.onclick = null; no.onclick = null; };
      yes.onclick = () => { cleanup(); onConfirmAction(); };
      no.onclick = () => { cleanup(); };
    };

    document.getElementById('pending-accept').onclick = () => {
      showConfirm('Accept this registration and activate the account?', async () => {
        try {
          const res = await fetch(`${API_BASE}/api/staff/approve/${stored.id}`, { method: 'POST' });
          if (res.ok) {
            alert('Account approved successfully');
            loadStaffData();
            loadPendingStaffData();
          } else {
            const data = await res.json();
            alert(data.message || 'Approval failed');
          }
        } catch (err) {
          console.error(err);
          alert('Server error');
        }
      });
    };

    document.getElementById('pending-reject').onclick = () => {
      showConfirm('Reject this registration? This will permanently delete the submission.', async () => {
        try {
          const res = await fetch(`${API_BASE}/api/staff/reject/${stored.id}`, { method: 'POST' });
          if (res.ok) {
            alert('Account rejected');
            loadPendingStaffData();
          } else {
            const data = await res.json();
            alert(data.message || 'Rejection failed');
          }
        } catch (err) {
          console.error(err);
          alert('Server error');
        }
      });
    };
  });
}

// Modal close button
const closeModalBtn = document.getElementById('modal-close-btn');
if (closeModalBtn) {
  closeModalBtn.addEventListener('click', () => {
    document.getElementById('account-modal').style.display = 'none';
    currentAccountData = null;
    currentAction = null;
  });
}

// Edit button
const editBtn = document.getElementById('modal-edit-btn');
if (editBtn) {
  editBtn.addEventListener('click', () => {
    currentAction = 'edit';
    document.getElementById('modal-confirm-text').textContent = 'Are you sure you want to edit this account?';
    document.getElementById('modal-actions').style.display = 'none';
    document.getElementById('modal-confirm-section').style.display = 'block';
  });
}

// Delete button
const deleteBtn = document.getElementById('modal-delete-btn');
if (deleteBtn) {
  deleteBtn.addEventListener('click', () => {
    currentAction = 'delete';
    document.getElementById('modal-confirm-text').textContent = 'Are you sure you want to delete this account? This action cannot be undone.';
    document.getElementById('modal-actions').style.display = 'none';
    document.getElementById('modal-confirm-section').style.display = 'block';
  });
}

// Confirm button
const confirmBtn = document.getElementById('modal-confirm-btn');
if (confirmBtn) {
  confirmBtn.addEventListener('click', () => {
    if (currentAction === 'edit') {
      console.log('Editing account:', currentAccountData);
      alert('Account updated successfully');
      document.getElementById('account-modal').style.display = 'none';
      currentAccountData = null;
      currentAction = null;
    } else if (currentAction === 'delete') {
      console.log('Deleting account:', currentAccountData);
      // Find and remove the row from the table
      const accountRows = document.querySelectorAll('.account-row');
      accountRows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells[0].textContent === currentAccountData.name && cells[1].textContent === currentAccountData.email) {
          row.remove();
        }
      });
      // remove from stored accounts
      if (currentAccountData && currentAccountData.email) storedAccounts.delete(currentAccountData.email);
      alert('Account deleted successfully');
      document.getElementById('account-modal').style.display = 'none';
      currentAccountData = null;
      currentAction = null;
    }
  });
}

// Cancel button
const cancelBtn = document.getElementById('modal-cancel-btn');
if (cancelBtn) {
  cancelBtn.addEventListener('click', () => {
    document.getElementById('modal-confirm-section').style.display = 'none';
    document.getElementById('modal-actions').style.display = 'flex';
    currentAction = null;
  });
}
