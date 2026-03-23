const sidebar = document.getElementById('sidebar');
const burger = document.getElementById('burger');
const back = document.getElementById('back');

// Handle port mismatch during development (Live Server on 5500, Backend on 5000)
const API_BASE = window.location.port === '5500'
  ? `${window.location.protocol}//${window.location.hostname}:5000`
  : '';

function showToast(message, type = 'info') {
  const containerId = 'toast-container';
  let container = document.getElementById(containerId);

  if (!container) {
    container = document.createElement('div');
    container.id = containerId;
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      toast.remove();
    }, 240);
  }, 4200);
}

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

async function performLogout() {
  try {
    await fetch(`${API_BASE}/api/staff/logout`, {
      method: 'POST',
      credentials: 'include'
    });
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    window.location.replace('/html/index.html');
  }
}

const logoutBtn = document.getElementById('logout-btn');
const logoutConfirmModal = document.getElementById('logout-confirm-modal');
const logoutConfirmYesBtn = document.getElementById('logout-confirm-yes');
const logoutConfirmNoBtn = document.getElementById('logout-confirm-no');

if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    if (logoutConfirmModal) {
      logoutConfirmModal.style.display = 'flex';
      return;
    }
    performLogout();
  });
}

if (logoutConfirmYesBtn) {
  logoutConfirmYesBtn.addEventListener('click', () => {
    if (logoutConfirmModal) {
      logoutConfirmModal.style.display = 'none';
    }
    performLogout();
  });
}

if (logoutConfirmNoBtn) {
  logoutConfirmNoBtn.addEventListener('click', () => {
    if (logoutConfirmModal) {
      logoutConfirmModal.style.display = 'none';
    }
  });
}

async function ensureAuthenticatedSession() {
  try {
    const response = await fetch(`${API_BASE}/api/staff/session`, {
      method: 'GET',
      credentials: 'include'
    });

    if (!response.ok) {
      window.location.replace('/html/index.html');
      return null;
    }

    const sessionData = await response.json().catch(() => null);
    return sessionData?.user || null;
  } catch (error) {
    console.error('Session check failed:', error);
    window.location.replace('/html/index.html');
    return null;
  }
}

function isAdminUser(user) {
  return String(user?.role || '').trim().toLowerCase() === 'admin';
}

function toTitleCase(value) {
  const lower = String(value || '').trim().toLowerCase();
  if (!lower) return 'Unknown';
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function getDisplayFirstName(user) {
  const preferred =
    user?.first_name ||
    user?.firstName ||
    user?.firstname;

  if (preferred && String(preferred).trim()) {
    return String(preferred).trim();
  }

  return String(user?.username || '').trim() || 'User';
}

function updateNonAdminWorkspace(user) {
  const role = String(user?.role || '').trim().toLowerCase();
  const roleTitle = toTitleCase(role);

  const titleNode = document.getElementById('non-admin-title');
  if (titleNode) titleNode.textContent = `${roleTitle} Workspace`;

  const subtitleNode = document.getElementById('non-admin-subtitle');
  if (subtitleNode) {
    subtitleNode.textContent = role === 'doctor'
      ? 'Track your daily clinical tasks and coordinate with the admin team for account-related requests.'
      : 'Track your daily operations and coordinate with the admin team for account-related requests.';
  }

  const permissionsNode = document.getElementById('non-admin-permissions');
  if (permissionsNode) {
    permissionsNode.textContent = 'Admin Command Center modules are restricted to admin accounts. Your role can continue using non-admin workspace functions.';
  }

  const usernameNode = document.getElementById('non-admin-username');
  if (usernameNode) usernameNode.textContent = user?.username || '—';

  const roleNode = document.getElementById('non-admin-role');
  if (roleNode) roleNode.textContent = roleTitle;

  const emailNode = document.getElementById('non-admin-email');
  if (emailNode) emailNode.textContent = user?.email || '—';
}

function applyRoleAccess(user) {
  const adminAccess = isAdminUser(user);
  if (!adminAccess) {
    document.querySelectorAll('.admin-only').forEach((element) => {
      element.classList.add('hidden');
    });
  }

  const userNameNode = document.querySelector('.user-name');
  if (userNameNode) {
    userNameNode.textContent = getDisplayFirstName(user);
  }

  const userRoleNode = document.querySelector('.user-pos');
  if (userRoleNode) {
    const roleText = String(user?.role || 'Staff');
    userRoleNode.textContent = roleText.charAt(0).toUpperCase() + roleText.slice(1);
  }

  const nonAdminSection = document.getElementById('non-admin-section');
  if (adminAccess) {
    if (nonAdminSection) nonAdminSection.classList.add('hidden');
    return;
  }

  hideAllSections();
  clearActiveNav();
  updateNonAdminWorkspace(user);
  if (nonAdminSection) nonAdminSection.classList.remove('hidden');
}

window.addEventListener('pageshow', async (event) => {
  const navEntries = performance.getEntriesByType('navigation');
  const navType = navEntries && navEntries.length > 0 ? navEntries[0].type : '';
  const restoredFromHistory = event.persisted || navType === 'back_forward';
  if (!restoredFromHistory) {
    return;
  }

  const sessionUser = await ensureAuthenticatedSession();
  if (sessionUser) {
    applyRoleAccess(sessionUser);
  }
});

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

const statTotalStaff = document.getElementById('stat-total-staff');
const statPendingStaff = document.getElementById('stat-pending-staff');
const statDoctors = document.getElementById('stat-doctors');
const statActiveStaff = document.getElementById('stat-active-staff');
const dashboardPendingPreview = document.getElementById('dashboard-pending-preview');
const dashboardActivePreview = document.getElementById('dashboard-active-preview');
const dashboardLastSync = document.getElementById('dashboard-last-sync');

const dashRefreshBtn = document.getElementById('dash-refresh-btn');
const dashOpenPendingBtn = document.getElementById('dash-open-pending-btn');
const refreshAccountsBtn = document.getElementById('refresh-accounts-btn');

function hideAllSections() {
  // add the hidden class everywhere instead of fiddling with style.display;
  // .hidden has !important so inline styles would lose to it
  if (dashboardSection) dashboardSection.classList.add('hidden');
  if (usersSection) usersSection.classList.add('hidden');
  const nonAdminSection = document.getElementById('non-admin-section');
  if (nonAdminSection) nonAdminSection.classList.add('hidden');
  // Hide all subsections
  const accountMgmt = document.getElementById('account-management');
  if (accountMgmt) accountMgmt.classList.add('hidden');
}

function clearActiveNav() {
  navLinks.forEach((link) => link.classList.remove('is-active'));
  if (navBtn) navBtn.classList.remove('is-active');
}

navLinks.forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const section = link.getAttribute('data-section');
    hideAllSections();
    clearActiveNav();
    link.classList.add('is-active');
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
    clearActiveNav();
    if (navBtn) navBtn.classList.add('is-active');
    if (usersSection) usersSection.classList.remove('hidden');
    const subsection = document.getElementById(section);
    if (subsection) subsection.classList.remove('hidden');
  });
});

const dashboardLink = document.querySelector('.nav-item[data-section="dashboard"]');
if (dashboardLink && !dashboardLink.classList.contains('hidden')) {
  dashboardLink.classList.add('is-active');
}

// Stored accounts (identifier -> account data)
const storedAccounts = new Map();
let latestStaffList = [];
let latestPendingList = [];

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

function renderDashboardInsights() {
  if (statTotalStaff) statTotalStaff.textContent = String(latestStaffList.length);
  if (statPendingStaff) statPendingStaff.textContent = String(latestPendingList.length);

  const doctorsCount = latestStaffList.filter((user) => String(user.role || '').toLowerCase() === 'doctor').length;
  if (statDoctors) statDoctors.textContent = String(doctorsCount);

  const activeCount = latestStaffList.filter((user) => String(user.status || '').toLowerCase() === 'active').length;
  if (statActiveStaff) statActiveStaff.textContent = String(activeCount);

  if (dashboardPendingPreview) {
    const rows = latestPendingList.slice(0, 5);
    dashboardPendingPreview.innerHTML = rows.length
      ? rows.map((user) => `
          <tr>
            <td class="table-cell">${user.username || '—'}</td>
            <td class="table-cell">${user.employee_id || '—'}</td>
            <td class="table-cell">${user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : '—'}</td>
            <td class="table-cell">${formatDateTime(user.created_at)}</td>
          </tr>
        `).join('')
      : '<tr><td class="table-cell" colspan="4">No pending registrations.</td></tr>';
  }

  if (dashboardActivePreview) {
    const rows = latestStaffList.slice(0, 5);
    dashboardActivePreview.innerHTML = rows.length
      ? rows.map((user) => `
          <tr>
            <td class="table-cell">${user.username || '—'}</td>
            <td class="table-cell">${user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : '—'}</td>
            <td class="table-cell"><span class="badge-${String(user.status || '').toLowerCase()}">${user.status || '—'}</span></td>
            <td class="table-cell">${formatDateTime(user.created_at)}</td>
          </tr>
        `).join('')
      : '<tr><td class="table-cell" colspan="4">No active accounts found.</td></tr>';
  }

  if (dashboardLastSync) {
    dashboardLastSync.textContent = `Last synced: ${new Date().toLocaleTimeString()}`;
  }
}

function openUsersSubsection(subsectionId) {
  hideAllSections();
  if (usersSection) usersSection.classList.remove('hidden');
  const subsection = document.getElementById(subsectionId);
  if (subsection) subsection.classList.remove('hidden');
}

async function loadStaffData() {
  try {
    const response = await fetch(`${API_BASE}/api/staff`, { credentials: 'include' });
    if (!response.ok) throw new Error('Failed to fetch staff');
    const staffList = await response.json();
    latestStaffList = staffList;

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

    renderDashboardInsights();
  } catch (error) {
    console.error('Error loading staff:', error);
  }
}

async function loadPendingStaffData() {
  try {
    const response = await fetch(`${API_BASE}/api/staff/pending`, { credentials: 'include' });
    if (!response.ok) throw new Error('Failed to fetch pending staff');
    const pendingList = await response.json();
    latestPendingList = pendingList;

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

    renderDashboardInsights();
  } catch (error) {
    console.error('Error loading pending staff:', error);
  }
}

// Initial load (after auth check)
async function initDashboardData() {
  const sessionUser = await ensureAuthenticatedSession();
  if (!sessionUser) return;

  applyRoleAccess(sessionUser);

  if (!isAdminUser(sessionUser)) {
    return;
  }

  if (dashboardSection) dashboardSection.classList.remove('hidden');
  if (dashboardLink) dashboardLink.classList.add('is-active');
  await Promise.all([loadStaffData(), loadPendingStaffData()]);
}

initDashboardData();

if (dashRefreshBtn) {
  dashRefreshBtn.addEventListener('click', async () => {
    await Promise.all([loadStaffData(), loadPendingStaffData()]);
    showToast('Dashboard data refreshed.', 'info');
  });
}

if (dashOpenPendingBtn) {
  dashOpenPendingBtn.addEventListener('click', () => {
    openUsersSubsection('account-management');
    if (tabPending) tabPending.click();
  });
}

if (refreshAccountsBtn) {
  refreshAccountsBtn.addEventListener('click', async () => {
    await Promise.all([loadStaffData(), loadPendingStaffData()]);
    showToast('Account tables refreshed.', 'info');
  });
}

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

    const firstName = String(user.first_name || '').trim();
    const lastName = String(user.last_name || '').trim();
    const fullName = `${firstName} ${lastName}`.replace(/\s+/g, ' ').trim();
    const birthdayValue = user.birthday ? new Date(user.birthday) : null;
    const birthdayText = birthdayValue && !Number.isNaN(birthdayValue.getTime())
      ? birthdayValue.toLocaleDateString()
      : '—';

    // Populate modal
    document.getElementById('modal-name').textContent = fullName || user.username || '—';
    document.getElementById('modal-email').textContent = user.email || '—';
    document.getElementById('modal-role').textContent = user.role.charAt(0).toUpperCase() + user.role.slice(1);
    document.getElementById('modal-status').textContent = user.status;
    document.getElementById('modal-contact').textContent = user.employee_id || '—';
    document.getElementById('modal-bday').textContent = birthdayText;

    // Hide/clear extra fields that don't exist in our schema
    const extraFields = ['address'];
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
          <div class="modal-group"><label class="modal-label">Username</label><p id="pending-username" class="modal-text"></p></div>
          <div class="modal-group"><label class="modal-label">Employee ID</label><p id="pending-employee-id" class="modal-text"></p></div>
          <div class="modal-group"><label class="modal-label">Email</label><p id="pending-email" class="modal-text"></p></div>
          <div class="modal-group"><label class="modal-label">Role</label><p id="pending-role" class="modal-text"></p></div>
          <div class="modal-group"><label class="modal-label">Specialization</label><p id="pending-specialization" class="modal-text"></p></div>
          <div class="modal-group"><label class="modal-label">Schedule</label><p id="pending-schedule" class="modal-text"></p></div>
          <div class="modal-group"><label class="modal-label">Submitted</label><p id="pending-submitted" class="modal-text"></p></div>
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

    let scheduleText = '—';
    if (stored.schedule) {
      try {
        const scheduleData = typeof stored.schedule === 'string' ? JSON.parse(stored.schedule) : stored.schedule;
        if (scheduleData && Array.isArray(scheduleData.days) && scheduleData.days.length > 0) {
          const startHour = Number.isFinite(scheduleData.startHour) ? `${scheduleData.startHour}:00` : '?';
          const endHour = Number.isFinite(scheduleData.endHour) ? `${scheduleData.endHour}:00` : '?';
          scheduleText = `${scheduleData.days.join(', ')} (${startHour} - ${endHour})`;
        }
      } catch (error) {
        scheduleText = String(stored.schedule);
      }
    }

    // set values
    document.getElementById('pending-username').textContent = stored.username || '—';
    document.getElementById('pending-employee-id').textContent = stored.employee_id || '—';
    document.getElementById('pending-email').textContent = stored.email || '—';
    document.getElementById('pending-role').textContent = stored.role ? (stored.role.charAt(0).toUpperCase() + stored.role.slice(1)) : '';
    document.getElementById('pending-specialization').textContent = stored.specialization || '—';
    document.getElementById('pending-schedule').textContent = scheduleText;
    document.getElementById('pending-submitted').textContent = formatDateTime(stored.created_at);

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
          const res = await fetch(`${API_BASE}/api/staff/approve/${stored.id}`, { method: 'POST', credentials: 'include' });
          const data = await res.json();

          if (res.ok) {
            if (data.notificationEmailSent === true) {
              const recipient = data.notificationEmailRecipient || 'the registrant';
              showToast(`Account approved. Notification email sent to ${recipient}.`, 'success');
            } else if (data.notificationEmailSent === false) {
              const reason = data.notificationError ? ` Reason: ${data.notificationError}` : '';
              showToast(`Account approved, but notification email failed.${reason}`, 'warning');
            } else {
              showToast(data.message || 'Account approved successfully.', 'success');
            }
            loadStaffData();
            loadPendingStaffData();
          } else {
            showToast(data.message || 'Approval failed', 'error');
          }
        } catch (err) {
          console.error(err);
          showToast('Server error', 'error');
        }
      });
    };

    document.getElementById('pending-reject').onclick = () => {
      showConfirm('Reject this registration? This will permanently delete the submission.', async () => {
        try {
          const res = await fetch(`${API_BASE}/api/staff/reject/${stored.id}`, { method: 'POST', credentials: 'include' });
          const data = await res.json();
          if (res.ok) {
            showToast(data.message || 'Account rejected', 'success');
            loadPendingStaffData();
          } else {
            showToast(data.message || 'Rejection failed', 'error');
          }
        } catch (err) {
          console.error(err);
          showToast('Server error', 'error');
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
  confirmBtn.addEventListener('click', async () => {
    if (currentAction === 'edit') {
      console.log('Editing account:', currentAccountData);
      alert('Account updated successfully');
      document.getElementById('account-modal').style.display = 'none';
      currentAccountData = null;
      currentAction = null;
    } else if (currentAction === 'delete') {
      try {
        if (!currentAccountData || !currentAccountData.id) {
          showToast('Unable to delete: missing account id.', 'error');
          return;
        }

        const response = await fetch(`${API_BASE}/api/staff/${currentAccountData.id}`, {
          method: 'DELETE',
          credentials: 'include'
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          showToast(data.message || 'Failed to delete account.', 'error');
          return;
        }

        document.getElementById('account-modal').style.display = 'none';
        document.getElementById('modal-confirm-section').style.display = 'none';
        document.getElementById('modal-actions').style.display = 'flex';
        currentAccountData = null;
        currentAction = null;

        await Promise.all([loadStaffData(), loadPendingStaffData()]);
        showToast(data.message || 'Account deleted successfully.', 'success');
      } catch (error) {
        console.error('Delete account error:', error);
        showToast('Server error during deletion.', 'error');
      }
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
