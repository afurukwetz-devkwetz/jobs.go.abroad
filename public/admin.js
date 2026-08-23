document.addEventListener('DOMContentLoaded', () => {
  let allApplicants = [];
  let currentApplicant = null;
  let sessionTimer = null;
  let sessionCountdownInterval = null;

  // ─── Auth ────────────────────────────────────────────────────────────────────
  const loginSection  = document.getElementById('login-section');
  const adminSection  = document.getElementById('admin-section');
  const loginForm     = document.getElementById('adminLoginForm');
  const loginError    = document.getElementById('loginError');

  const token = localStorage.getItem('adminToken');
  if (token) showDashboard(token);
  else       showLogin();

  function showLogin() {
    loginSection.style.display = 'flex';
    adminSection.style.display = 'none';
  }

  function showDashboard(tok) {
    loginSection.style.display = 'none';
    adminSection.style.display = 'block';
    fetchApplicants();
    loadSettings();
    fetchTemplates();
    setupSessionTimer(tok || localStorage.getItem('adminToken'));
  }

  function logout() {
    localStorage.removeItem('adminToken');
    clearTimeout(sessionTimer);
    clearInterval(sessionCountdownInterval);
    showLogin();
  }

  loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    loginError.textContent = '';
    const email    = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    try {
      const res  = await fetch(API_BASE_URL + '/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('adminToken', data.token);
        showDashboard(data.token);
      } else {
        loginError.textContent = data.error || 'Login failed';
      }
    } catch {
      loginError.textContent = 'Server error during login';
    }
  });

  document.getElementById('logoutBtn').addEventListener('click', logout);
  document.getElementById('refreshBtn').addEventListener('click', fetchApplicants);

  // ─── Session Timeout Warning ──────────────────────────────────────────────────
  function setupSessionTimer(tok) {
    if (!tok) return;
    try {
      const payload = JSON.parse(atob(tok.split('.')[1]));
      const expiresAt = payload.exp * 1000; // ms
      const warnAt    = expiresAt - 5 * 60 * 1000; // 5 minutes before
      const now       = Date.now();
      if (warnAt <= now) return; // already too close
      clearTimeout(sessionTimer);
      sessionTimer = setTimeout(() => startSessionCountdown(expiresAt), warnAt - now);
    } catch { /* ignore JWT parse errors */ }
  }

  function startSessionCountdown(expiresAt) {
    const warning  = document.getElementById('sessionWarning');
    const countEl  = document.getElementById('sessionCountdown');
    if (!warning) return;
    warning.style.display = 'flex';
    clearInterval(sessionCountdownInterval);
    sessionCountdownInterval = setInterval(() => {
      const remaining = Math.max(0, expiresAt - Date.now());
      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      countEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
      if (remaining <= 0) {
        clearInterval(sessionCountdownInterval);
        alert('Your session has expired. Please log in again.');
        logout();
      }
    }, 1000);
  }

  window.renewSession = async function () {
    const email    = document.getElementById('loginEmail')?.value;
    const password = document.getElementById('loginPassword')?.value;
    if (!email || !password) {
      alert('To renew your session, please log out and log back in.');
      return;
    }
    try {
      const res  = await fetch(API_BASE_URL + '/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('adminToken', data.token);
        clearInterval(sessionCountdownInterval);
        document.getElementById('sessionWarning').style.display = 'none';
        setupSessionTimer(data.token);
      }
    } catch { /* silent */ }
  };

  // ─── Auth Headers ─────────────────────────────────────────────────────────────
  function getAuthHeaders() {
    return {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
    };
  }

  // ─── Fetch Applicants ─────────────────────────────────────────────────────────
  async function fetchApplicants() {
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) { refreshBtn.disabled = true; refreshBtn.innerHTML = '<i class="fas fa-sync fa-spin"></i> Loading…'; }
    try {
      const res = await fetch(API_BASE_URL + '/api/track/applicants', { headers: getAuthHeaders() });
      if (res.status === 401 || res.status === 403) { alert('Session expired. Please log in again.'); return logout(); }
      allApplicants = await res.json();
      updateStats();
      renderTable();
      fetchAnalytics();
      loadBatches();
    } catch (err) {
      console.error('Failed to fetch applicants', err);
    } finally {
      if (refreshBtn) { refreshBtn.disabled = false; refreshBtn.innerHTML = '<i class="fas fa-sync"></i> Refresh'; }
    }
  }

  // ─── Batches ──────────────────────────────────────────────────────────────────
  window.loadBatches = async function() {
    try {
      const res = await fetch(API_BASE_URL + '/api/track/batches', { headers: getAuthHeaders() });
      const batches = await res.json();
      const tbody = document.getElementById('batchBody');
      if (!tbody) return;
      tbody.innerHTML = '';
      if (!batches.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:rgba(255,255,255,.4)">No batches found.</td></tr>';
        return;
      }
      batches.forEach(b => {
        const tr = document.createElement('tr');
        const status = b.isClosed ? '<span style="color:#f87171">Closed</span>' : b.isFull ? '<span style="color:#fbbf24">Full</span>' : '<span style="color:#34d399">Open</span>';
        const date = new Date(b.createdAt).toLocaleDateString();
        tr.innerHTML = `
          <td><strong>${b.batchCode}</strong></td>
          <td style="text-transform:capitalize">${b.profession}</td>
          <td>${b.count} / ${b.maxSize}</td>
          <td>${status}</td>
          <td>${date}</td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="exportBatch('${b.batchCode}')" style="margin-right:5px"><i class="fas fa-file-csv"></i> Export</button>
            ${!b.isClosed ? `<button class="btn btn-warning btn-sm" onclick="closeBatch('${b.batchCode}')"><i class="fas fa-lock"></i> Close</button>` : ''}
          </td>
        `;
        tbody.appendChild(tr);
      });
    } catch (err) {
      console.error('Failed to load batches', err);
    }
  };

  window.closeBatch = async function(batchCode) {
    if (!confirm(`Are you sure you want to manually close batch ${batchCode}? No new applicants will be able to join it.`)) return;
    try {
      const res = await fetch(API_BASE_URL + '/api/track/batch/close', {
        method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ batchCode })
      });
      const data = await res.json();
      if (data.success) { alert(data.message); loadBatches(); }
      else alert(data.error || 'Failed to close batch');
    } catch (err) { alert('Error closing batch'); }
  };

  window.exportBatch = function(batchCode) {
    window.open(`${API_BASE_URL}/api/track/batch/export/${batchCode}?token=${localStorage.getItem('adminToken')}`, '_blank');
  };

  // ─── Stats ────────────────────────────────────────────────────────────────────
  function updateStats() {
    document.getElementById('statTotal').textContent    = allApplicants.length;
    document.getElementById('statPending').textContent  = allApplicants.filter(a => a.status === 'Pending').length;
    document.getElementById('statApproved').textContent = allApplicants.filter(a => a.status === 'Approved').length;
    document.getElementById('statRejected').textContent = allApplicants.filter(a => a.status === 'Rejected').length;
  }

  // ─── Search + Filter + Render Table ──────────────────────────────────────────
  window.renderTable = function () {
    const statusFilter = document.getElementById('filterStatus').value;
    const profFilter   = document.getElementById('filterProfession').value;
    const query        = (document.getElementById('searchInput').value || '').toLowerCase().trim();

    let filtered = allApplicants.filter(a => {
      const matchStatus = statusFilter === 'all' || a.status === statusFilter;
      const matchProf   = profFilter   === 'all' || (a.profession || '').toLowerCase() === profFilter;
      const matchSearch = !query ||
        (`${a.firstName} ${a.lastName}`).toLowerCase().includes(query) ||
        (a.email || '').toLowerCase().includes(query) ||
        (a.refNumber || '').toLowerCase().includes(query);
      return matchStatus && matchProf && matchSearch;
    });

    const tbody = document.getElementById('applicantsBody');
    const count = document.getElementById('tableCount');
    tbody.innerHTML = '';

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:rgba(255,255,255,.4)">No applicants match your filters.</td></tr>';
      if (count) count.textContent = '';
      return;
    }
    if (count) count.textContent = `Showing ${filtered.length} of ${allApplicants.length} applicants`;

    filtered.forEach(app => {
      const tr   = document.createElement('tr');
      const date = new Date(app.createdAt).toLocaleDateString();
      const statusClass = `status-${(app.status || 'pending').toLowerCase()}`;
      const verifiedIcon = app.isVerified
        ? '<i class="fas fa-check-circle" style="color:#34d399" title="Verified"></i>'
        : '<i class="fas fa-times-circle" style="color:#fb7185" title="Unverified"></i>';
      tr.innerHTML = `
        <td><strong>${app.refNumber || 'N/A'}</strong></td>
        <td>${app.firstName} ${app.lastName}</td>
        <td><a href="mailto:${app.email}" style="color:#60a5fa;text-decoration:none;">${app.email}</a></td>
        <td>${app.phone || 'N/A'}</td>
        <td>${app.profession}</td>
        <td>${app.country || '—'}</td>
        <td style="text-align:center">${verifiedIcon}</td>
        <td>${date}</td>
        <td><span class="status-badge ${statusClass}">${app.status || 'Pending'}</span></td>
        <td><button class="btn btn-secondary btn-sm" onclick="viewApplicant('${app.refNumber}')"><i class="fas fa-eye"></i> Review</button></td>
      `;
      tbody.appendChild(tr);
    });
  };

  // ─── Charts ───────────────────────────────────────────────────────────────────
  let chartTimeline = null;
  let chartProfession = null;

  async function fetchAnalytics() {
    try {
      const res = await fetch(API_BASE_URL + '/api/track/analytics', { headers: getAuthHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      renderCharts(data);
    } catch (err) {
      console.error('Failed to fetch analytics', err);
    }
  }

  function renderCharts(data) {
    const tlCtx = document.getElementById('chartTimeline')?.getContext('2d');
    if (tlCtx) {
      if (chartTimeline) chartTimeline.destroy();
      chartTimeline = new Chart(tlCtx, {
        type: 'line',
        data: {
          labels: data.daily.labels,
          datasets: [{ label: 'Applications', data: data.daily.data, borderColor: '#60a5fa', backgroundColor: 'rgba(96,165,250,.12)', tension: 0.4, fill: true, pointRadius: 3, pointBackgroundColor: '#60a5fa' }],
        },
        options: {
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: 'rgba(255,255,255,.4)', maxTicksLimit: 8, font: { size: 11 } }, grid: { color: 'rgba(255,255,255,.05)' } },
            y: { ticks: { color: 'rgba(255,255,255,.4)', stepSize: 1, font: { size: 11 } }, grid: { color: 'rgba(255,255,255,.05)' } },
          },
        },
      });
    }

    const pfCtx = document.getElementById('chartProfession')?.getContext('2d');
    if (pfCtx) {
      if (chartProfession) chartProfession.destroy();
      const profColors = ['#60a5fa','#34d399','#fbbf24','#fb7185','#a78bfa','#f97316'];
      chartProfession = new Chart(pfCtx, {
        type: 'doughnut',
        data: {
          labels: data.professions.map(p => p.profession),
          datasets: [{ data: data.professions.map(p => p.count), backgroundColor: profColors, borderWidth: 2, borderColor: '#0d1a2d' }],
        },
        options: {
          plugins: { legend: { labels: { color: 'rgba(255,255,255,.65)', font: { size: 12 }, boxWidth: 14 } } },
          cutout: '65%',
        },
      });
    }
  }

  // ─── Modal ────────────────────────────────────────────────────────────────────
  window.viewApplicant = function (refNumber) {
    currentApplicant = allApplicants.find(a => a.refNumber === refNumber);
    if (!currentApplicant) return;
    const a = currentApplicant;

    // Avatar initials
    const av = document.getElementById('modalAvatar');
    if (av) av.textContent = `${a.firstName[0]}${a.lastName[0]}`.toUpperCase();

    document.getElementById('modalName').textContent  = `${a.firstName} ${a.lastName}`;
    document.getElementById('modalRef').textContent   = `REF: ${a.refNumber}`;
    document.getElementById('modalEmail').textContent = a.email;
    document.getElementById('modalPhone').textContent = a.phone || 'N/A';
    document.getElementById('modalCountry').textContent     = a.country || 'N/A';
    document.getElementById('modalDob').textContent         = a.dob ? new Date(a.dob).toLocaleDateString() : 'N/A';
    document.getElementById('modalGender').textContent      = a.gender || 'N/A';
    document.getElementById('modalProfession').textContent  = a.profession;
    document.getElementById('modalExperience').textContent  = a.experience || '0';
    document.getElementById('modalQualification').textContent = a.qualification || 'N/A';
    document.getElementById('modalBatch').textContent       = a.batchCode || 'N/A';
    document.getElementById('modalBio').textContent         = a.bio || 'No bio provided.';

    const verifEl = document.getElementById('modalVerified');
    if (verifEl) {
      verifEl.textContent  = a.isVerified ? '✓ VERIFIED' : '✗ UNVERIFIED';
      verifEl.className    = `verify-badge ${a.isVerified ? 'verify-yes' : 'verify-no'}`;
    }

    const cvLink = document.getElementById('modalCV');
    if (a.cvFile) {
      cvLink.href = a.cvFile.startsWith('http') ? a.cvFile : `${API_BASE_URL}/uploads/${a.cvFile.replace(/\\/g, '/').split('/').pop()}`;
      cvLink.style.display = 'inline-flex';
    } else {
      cvLink.style.display = 'none';
    }

    // Admin note
    const noteEl = document.getElementById('adminNoteInput');
    if (noteEl) noteEl.value = a.adminNote || '';

    // Qualifications tab
    renderQualsTab(a);

    // Reset to first tab
    switchTab('info');

    document.getElementById('applicantModal').style.display = 'flex';
  };

  function renderQualsTab(a) {
    const el = document.getElementById('qualsContent');
    if (!el) return;
    if (a.profession !== 'nurse' || (!a.destinations?.length && !a.englishQuals?.length && !a.docsAvailable?.length)) {
      el.innerHTML = '<p style="color:rgba(255,255,255,.4);font-style:italic;">No qualification assessment data submitted.</p>';
      return;
    }
    const row = (label, arr) => arr?.length ? `<div class="qual-row"><strong>${label}</strong><div class="qual-chips">${arr.map(v=>`<span class="qual-chip">${v}</span>`).join('')}</div></div>` : '';
    el.innerHTML = `
      ${row('Preferred Destinations', a.destinations)}
      ${a.destOther ? `<div class="qual-row"><strong>Other Destination</strong><span class="qual-chip">${a.destOther}</span></div>` : ''}
      ${row('English Qualifications', a.englishQuals)}
      ${row('Professional Registrations', a.professionalRegs)}
      ${row('German Language Level', a.germanLevel)}
      ${row('Documents Available', a.docsAvailable)}
      ${row('Declarations Agreed', a.qualDeclarations)}
    `;
  }

  window.switchTab = function (tab) {
    ['info','quals','decision','email','docRequest'].forEach(t => {
      const id = 'tab' + t.charAt(0).toUpperCase() + t.slice(1);
      const el = document.getElementById(id);
      if (el) el.style.display = (t === tab) ? 'block' : 'none';
    });
    document.querySelectorAll('.modal-tab').forEach(btn => {
      btn.classList.remove('modal-tab--active');
    });
    const tabIndex = ['info','quals','decision','email','docRequest'].indexOf(tab);
    const tabBtns = document.querySelectorAll('.modal-tab');
    if (tabBtns[tabIndex]) tabBtns[tabIndex].classList.add('modal-tab--active');
    // If switching to email, load history
    if (tab === 'email' && currentApplicant) {
      loadEmailHistory(currentApplicant._id);
      updateEmailPreview();
    }
  };

  window.closeModal = function () {
    document.getElementById('applicantModal').style.display = 'none';
  };
  window.addEventListener('click', e => {
    if (e.target === document.getElementById('applicantModal')) closeModal();
  });

  // ─── Status Actions ───────────────────────────────────────────────────────────
  document.getElementById('btnApprove')?.addEventListener('click', () => updateStatus('Approved', 4));
  document.getElementById('btnReject')?.addEventListener('click',  () => updateStatus('Rejected', 4));
  document.getElementById('btnPending')?.addEventListener('click', () => updateStatus('Pending', 0));
  document.getElementById('btnReview')?.addEventListener('click',  () => updateStatus('Review', 1));

  async function updateStatus(newStatus, step) {
    if (!currentApplicant) return;
    const adminNote = document.getElementById('adminNoteInput')?.value.trim() || '';
    const confirmed = confirm(`Mark ${currentApplicant.firstName} ${currentApplicant.lastName} as "${newStatus}"?\n\nAn email notification will be sent to the applicant.${adminNote ? '\n\nNote: "' + adminNote + '"' : ''}`);
    if (!confirmed) return;

    try {
      const res = await fetch(API_BASE_URL + '/api/track/update', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          refNumber: currentApplicant.refNumber,
          status: newStatus,
          step,
          note: `Application ${newStatus.toLowerCase()}`,
          adminNote,
        }),
      });
      if (res.status === 401 || res.status === 403) { alert('Session expired.'); return logout(); }
      const data = await res.json();
      if (data.success) {
        closeModal();
        fetchApplicants();
      } else {
        alert(data.error || 'Failed to update status');
      }
    } catch {
      alert('Error updating status');
    }
  }

  // ─── Main View Navigation ─────────────────────────────────────────────────────
  window.switchMainView = function(view) {
    document.getElementById('dashboard-view').style.display  = (view === 'dashboard') ? 'block' : 'none';
    document.getElementById('templates-section').style.display = (view === 'templates') ? 'block' : 'none';
    document.getElementById('navDashboard').classList.toggle('active', view === 'dashboard');
    document.getElementById('navTemplates').classList.toggle('active', view === 'templates');
    if (view === 'templates') renderTemplates();
  };

  // ─── Placeholder Replacement ─────────────────────────────────────────────────
  function applyPlaceholders(text) {
    if (!currentApplicant || !text) return text;
    const a = currentApplicant;
    const fullName = `${a.firstName || ''} ${a.lastName || ''}`.trim();
    return text
      .replace(/\[Applicant Name\]/g, fullName || '[Applicant Name]')
      .replace(/\[Application ID\]/g, a.refNumber || '[Application ID]')
      .replace(/\[Position\]/g, a.profession || '[Position]')
      .replace(/\[Country\]/g, a.country || '[Country]')
      .replace(/\[Company Name\]/g, 'Global Job Connect')
      .replace(/\[HR Officer\]/g, 'HR Team')
      .replace(/\[Contact Information\]/g, 'hr@globaljobconnect.com');
  }

  // ─── Email Preview ────────────────────────────────────────────────────────────
  function updateEmailPreview() {
    const subject = document.getElementById('emailSubjectInput')?.value || '';
    const body    = document.getElementById('emailBodyInput')?.value || '';
    const to      = currentApplicant ? `${currentApplicant.firstName} ${currentApplicant.lastName} <${currentApplicant.email}>` : '—';
    document.getElementById('previewSubject').textContent = applyPlaceholders(subject) || '—';
    document.getElementById('previewTo').textContent      = 'To: ' + to;
    document.getElementById('previewBody').textContent    = applyPlaceholders(body) || 'No message body.';
  }

  window.switchEmailSubtab = function(panel, btn) {
    ['emailComposePanel','emailPreviewPanel','emailHistoryPanel'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('active');
    });
    document.querySelectorAll('.email-subtab').forEach(b => b.classList.remove('active'));
    const target = document.getElementById('email' + panel.charAt(0).toUpperCase() + panel.slice(1) + 'Panel');
    if (target) target.classList.add('active');
    if (btn) btn.classList.add('active');
    if (panel === 'preview') updateEmailPreview();
    if (panel === 'history' && currentApplicant) loadEmailHistory(currentApplicant._id);
  };

  // ─── Email History ────────────────────────────────────────────────────────────
  async function loadEmailHistory(applicantId) {
    const container = document.getElementById('emailHistoryList');
    if (!container) return;
    container.innerHTML = '<div class="email-log-empty"><i class="fas fa-circle-notch fa-spin"></i><p>Loading…</p></div>';
    try {
      const res  = await fetch(`${API_BASE_URL}/api/track/email-logs/${applicantId}`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (!data.success || !data.logs.length) {
        container.innerHTML = '<div class="email-log-empty"><i class="fas fa-inbox"></i><p>No emails have been sent to this applicant yet.</p></div>';
        return;
      }
      container.innerHTML = '';
      data.logs.forEach((log, idx) => {
        const date = new Date(log.createdAt).toLocaleString();
        const div  = document.createElement('div');
        div.className = 'email-log-item';
        div.innerHTML = `
          <div class="email-log-header">
            <span class="email-log-template"><i class="fas fa-envelope"></i> ${log.templateName}</span>
            <span class="email-log-date">${date}</span>
          </div>
          <div class="email-log-subject">Subject: ${log.subject}</div>
          <div class="email-log-by">Sent by: ${log.sentBy || 'Admin'}</div>
          <button class="email-log-expand" onclick="toggleLogBody(this)"><i class="fas fa-chevron-down"></i> View message</button>
          <div class="email-log-body-preview">${log.body}</div>
        `;
        container.appendChild(div);
      });
    } catch (err) {
      container.innerHTML = '<div class="email-log-empty"><i class="fas fa-exclamation-triangle"></i><p>Failed to load email history.</p></div>';
    }
  }

  window.toggleLogBody = function(btn) {
    const preview = btn.nextElementSibling;
    if (!preview) return;
    const isVisible = preview.style.display === 'block';
    preview.style.display = isVisible ? 'none' : 'block';
    btn.innerHTML = isVisible ? '<i class="fas fa-chevron-down"></i> View message' : '<i class="fas fa-chevron-up"></i> Hide message';
  };

  // ─── Database-driven Templates ────────────────────────────────────────────────
  let allTemplates = [];
  let currentTemplateCategory = 'all';

  async function fetchTemplates() {
    try {
      const res  = await fetch(API_BASE_URL + '/api/templates', { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      if (data.success) {
        allTemplates = data.templates || [];
        populateEmailDropdown();
        renderTemplates();
      } else {
        throw new Error(data.error || 'Failed to load templates');
      }
    } catch (err) {
      console.error('Failed to fetch templates', err);
      const grid = document.getElementById('templatesGrid');
      if (grid) {
        grid.innerHTML = `<div class="tpl-empty"><i class="fas fa-exclamation-triangle"></i><p>Error loading templates: ${err.message}</p></div>`;
      }
    }
  }

  function populateEmailDropdown() {
    const select = document.getElementById('emailTemplateSelect');
    if (!select) return;
    select.innerHTML = '<option value="">-- Custom Email (No Template) --</option>';
    const categories = [...new Set(allTemplates.map(t => t.category))];
    categories.forEach(cat => {
      const group = document.createElement('optgroup');
      group.label = cat;
      allTemplates.filter(t => t.category === cat).forEach(tpl => {
        const opt = document.createElement('option');
        opt.value = tpl._id;
        opt.textContent = tpl.name;
        group.appendChild(opt);
      });
      select.appendChild(group);
    });
  }

  const templateSelect = document.getElementById('emailTemplateSelect');
  if (templateSelect) {
    templateSelect.addEventListener('change', (e) => {
      const tpl = allTemplates.find(t => t._id === e.target.value);
      if (tpl) {
        document.getElementById('emailSubjectInput').value = applyPlaceholders(tpl.subject);
        document.getElementById('emailBodyInput').value    = applyPlaceholders(tpl.body);
      } else {
        document.getElementById('emailSubjectInput').value = '';
        document.getElementById('emailBodyInput').value    = '';
      }
      updateEmailPreview();
    });
  }

  // Auto-update preview when composing
  document.getElementById('emailSubjectInput')?.addEventListener('input', updateEmailPreview);
  document.getElementById('emailBodyInput')?.addEventListener('input', updateEmailPreview);

  document.getElementById('btnSendEmail')?.addEventListener('click', async () => {
    if (!currentApplicant) return;
    const subject = document.getElementById('emailSubjectInput').value.trim();
    const body    = document.getElementById('emailBodyInput').value.trim();
    if (!subject || !body) return alert('Please enter both subject and message body.');

    const selectedId  = templateSelect?.value;
    const selectedTpl = allTemplates.find(t => t._id === selectedId);
    const templateName = selectedTpl ? selectedTpl.name : 'Custom Email';

    const btn = document.getElementById('btnSendEmail');
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending…';
    const msgEl = document.getElementById('emailSendMsg');

    try {
      const res = await fetch(API_BASE_URL + '/api/track/send-email', {
        method: 'POST', headers: getAuthHeaders(),
        body: JSON.stringify({ refNumber: currentApplicant.refNumber, subject, body, templateName })
      });
      const data = await res.json();
      if (data.success) {
        if (msgEl) { msgEl.style.display = 'inline'; msgEl.style.color = '#34d399'; msgEl.textContent = '✅ Email sent!'; setTimeout(() => msgEl.style.display = 'none', 3000); }
        if (templateSelect) templateSelect.value = '';
        document.getElementById('emailSubjectInput').value = '';
        document.getElementById('emailBodyInput').value    = '';
        updateEmailPreview();
        loadEmailHistory(currentApplicant._id);
      } else {
        if (msgEl) { msgEl.style.display = 'inline'; msgEl.style.color = '#fb7185'; msgEl.textContent = '❌ ' + (data.error || 'Failed'); setTimeout(() => msgEl.style.display = 'none', 4000); }
      }
    } catch {
      if (msgEl) { msgEl.style.display = 'inline'; msgEl.style.color = '#fb7185'; msgEl.textContent = '❌ Network error'; setTimeout(() => msgEl.style.display = 'none', 4000); }
    } finally {
      btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Email';
    }
  });

  // ─── Templates Dashboard ──────────────────────────────────────────────────────
  const CATEGORY_ICON_MAP = {
    'Application': { icon: 'fa-file-alt',         cls: 'cat-color-application' },
    'Documents':   { icon: 'fa-folder-open',       cls: 'cat-color-documents' },
    'Payments':    { icon: 'fa-credit-card',        cls: 'cat-color-payments' },
    'Assessment':  { icon: 'fa-tasks',              cls: 'cat-color-assessment' },
    'Interview':   { icon: 'fa-comments',           cls: 'cat-color-interview' },
    'Selection':   { icon: 'fa-user-check',         cls: 'cat-color-selection' },
    'Offer & Acceptance': { icon: 'fa-handshake',   cls: 'cat-color-offer' },
    'Pre-Employment':     { icon: 'fa-clipboard-list', cls: 'cat-color-preemployment' },
    'Onboarding':  { icon: 'fa-door-open',          cls: 'cat-color-onboarding' },
    'Visa & Work Permit': { icon: 'fa-passport',    cls: 'cat-color-visa' },
    'Travel & Relocation':{ icon: 'fa-plane',        cls: 'cat-color-travel' },
    'Follow-Up':   { icon: 'fa-reply',              cls: 'cat-color-followup' },
    'Application Hold':   { icon: 'fa-pause-circle', cls: 'cat-color-hold' },
    'Application Closure':{ icon: 'fa-times-circle', cls: 'cat-color-closure' },
    'Final Placement':    { icon: 'fa-trophy',       cls: 'cat-color-placement' },
  };

  window.filterByCategory = function(cat, btn) {
    currentTemplateCategory = cat;
    document.querySelectorAll('.cat-tab').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    document.getElementById('tplCategoryFilter').value = cat;
    renderTemplates();
  };

  window.renderTemplates = function() {
    const search    = (document.getElementById('tplSearchInput')?.value || '').toLowerCase().trim();
    const catFilter = document.getElementById('tplCategoryFilter')?.value || 'all';
    const grid      = document.getElementById('templatesGrid');
    if (!grid) return;

    let filtered = allTemplates;
    if (catFilter !== 'all') filtered = filtered.filter(t => t.category === catFilter);
    if (search)             filtered = filtered.filter(t => t.name.toLowerCase().includes(search) || t.subject.toLowerCase().includes(search));

    if (!filtered.length) {
      grid.innerHTML = '<div class="tpl-empty"><i class="fas fa-search"></i><p>No templates match your search.</p></div>';
      return;
    }

    grid.innerHTML = '';
    filtered.forEach(tpl => {
      const meta = CATEGORY_ICON_MAP[tpl.category] || { icon: 'fa-envelope', cls: 'cat-color-application' };
      const card = document.createElement('div');
      card.className = 'tpl-card';
      card.innerHTML = `
        <div class="tpl-card-head">
          <div class="tpl-icon ${meta.cls}"><i class="fas ${meta.icon}"></i></div>
          <div class="tpl-card-meta">
            <div class="tpl-card-name" title="${tpl.name}">${tpl.name}</div>
            <div class="tpl-card-cat">${tpl.category}</div>
          </div>
        </div>
        <div class="tpl-subject" title="${tpl.subject}">Subject: ${tpl.subject}</div>
        <div class="tpl-actions">
          <button class="tpl-btn tpl-btn-edit" onclick="openTemplateEditor('${tpl._id}')"><i class="fas fa-pen"></i> Edit</button>
          <button class="tpl-btn tpl-btn-dupe" onclick="duplicateTemplate('${tpl._id}')"><i class="fas fa-copy"></i> Duplicate</button>
          <button class="tpl-btn tpl-btn-del"  onclick="deleteTemplate('${tpl._id}')"><i class="fas fa-trash"></i> Delete</button>
        </div>
      `;
      grid.appendChild(card);
    });
  };

  window.openTemplateEditor = function(id) {
    document.getElementById('tplEditId').value      = id || '';
    document.getElementById('tplEditorTitle').innerHTML = id
      ? '<i class="fas fa-pen"></i> Edit Template'
      : '<i class="fas fa-plus"></i> New Template';
    if (id) {
      const tpl = allTemplates.find(t => t._id === id);
      if (tpl) {
        document.getElementById('tplEditName').value     = tpl.name;
        document.getElementById('tplEditCategory').value = tpl.category;
        document.getElementById('tplEditSubject').value  = tpl.subject;
        document.getElementById('tplEditBody').value     = tpl.body;
      }
    } else {
      document.getElementById('tplEditName').value     = '';
      document.getElementById('tplEditCategory').value = 'Application';
      document.getElementById('tplEditSubject').value  = '';
      document.getElementById('tplEditBody').value     = '';
    }
    document.getElementById('tplEditorModal').classList.add('open');
  };

  window.closeTemplateEditor = function() {
    document.getElementById('tplEditorModal').classList.remove('open');
  };

  window.insertPlaceholder = function(ph) {
    const ta = document.getElementById('tplEditBody');
    if (!ta) return;
    const start = ta.selectionStart;
    const end   = ta.selectionEnd;
    ta.value = ta.value.substring(0, start) + ph + ta.value.substring(end);
    ta.selectionStart = ta.selectionEnd = start + ph.length;
    ta.focus();
  };

  window.saveTemplate = async function() {
    const id       = document.getElementById('tplEditId').value.trim();
    const name     = document.getElementById('tplEditName').value.trim();
    const category = document.getElementById('tplEditCategory').value;
    const subject  = document.getElementById('tplEditSubject').value.trim();
    const body     = document.getElementById('tplEditBody').value.trim();
    if (!name || !subject || !body) return alert('Please fill in all required fields.');

    const url    = id ? `${API_BASE_URL}/api/templates/${id}` : `${API_BASE_URL}/api/templates`;
    const method = id ? 'PUT' : 'POST';
    try {
      const res  = await fetch(url, { method, headers: getAuthHeaders(), body: JSON.stringify({ name, category, subject, body }) });
      const data = await res.json();
      if (data.success) {
        closeTemplateEditor();
        await fetchTemplates();
        renderTemplates();
      } else { alert(data.error || 'Failed to save template'); }
    } catch { alert('Network error saving template'); }
  };

  window.duplicateTemplate = async function(id) {
    const tpl = allTemplates.find(t => t._id === id);
    if (!tpl) return;
    const newName = tpl.name + ' (Copy)';
    try {
      const res  = await fetch(`${API_BASE_URL}/api/templates`, {
        method: 'POST', headers: getAuthHeaders(),
        body: JSON.stringify({ name: newName, category: tpl.category, subject: tpl.subject, body: tpl.body })
      });
      const data = await res.json();
      if (data.success) { await fetchTemplates(); renderTemplates(); }
      else alert(data.error || 'Could not duplicate');
    } catch { alert('Network error'); }
  };

  window.deleteTemplate = async function(id) {
    const tpl = allTemplates.find(t => t._id === id);
    if (!tpl || !confirm(`Archive template "${tpl.name}"? It will no longer appear in the list.`)) return;
    try {
      const res  = await fetch(`${API_BASE_URL}/api/templates/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
      const data = await res.json();
      if (data.success) { await fetchTemplates(); renderTemplates(); }
      else alert(data.error || 'Failed to delete');
    } catch { alert('Network error'); }
  };

  window.seedTemplates = async function() {
    const btn = document.getElementById('seedBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Seeding…'; }
    try {
      const res  = await fetch(`${API_BASE_URL}/api/templates/seed`, { method: 'POST', headers: getAuthHeaders() });
      const data = await res.json();
      alert(data.message || (data.success ? 'Seeded!' : 'Failed'));
      if (data.success) { await fetchTemplates(); renderTemplates(); }
    } catch { alert('Network error during seeding'); }
    finally { if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-database"></i> Seed Defaults'; } }
  };

  // Close editor on backdrop click
  document.getElementById('tplEditorModal')?.addEventListener('click', function(e) {
    if (e.target === this) closeTemplateEditor();
  });


  const docSelect = document.getElementById('docLabelSelect');
  const docCustom = document.getElementById('docLabelCustom');
  if (docSelect) docSelect.addEventListener('change', e => {
    docCustom.style.display = e.target.value === 'Other' ? 'block' : 'none';
  });

  document.getElementById('btnRequestDoc')?.addEventListener('click', async () => {
    if (!currentApplicant) return;
    let docLabel = document.getElementById('docLabelSelect').value;
    if (docLabel === 'Other') {
      docLabel = document.getElementById('docLabelCustom').value.trim();
      if (!docLabel) return alert('Please specify the custom document name.');
    }

    const btn = document.getElementById('btnRequestDoc');
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Requesting…';

    try {
      const res = await fetch(API_BASE_URL + '/api/track/request-document', {
        method: 'POST', headers: getAuthHeaders(),
        body: JSON.stringify({ refNumber: currentApplicant.refNumber, docLabel })
      });
      const data = await res.json();
      if (data.success) {
        alert(`Document request sent for: ${docLabel}`);
        if (docCustom) { docCustom.value = ''; docCustom.style.display = 'none'; }
        if (docSelect) docSelect.value = 'Passport Copy';
        switchTab('info');
      } else alert(data.error || 'Failed to request document');
    } catch { alert('Network error while requesting document.'); }
    finally { btn.disabled = false; btn.innerHTML = '<i class="fas fa-file-upload"></i> Request Document'; }
  });

  // ─── Settings ──────────────────────────────────────────────────────────────
  async function loadSettings() {
    const tok = localStorage.getItem('adminToken');
    if (!tok) return;
    try {
      const res = await fetch(API_BASE_URL + '/api/admin/settings', {
        headers: { Authorization: `Bearer ${tok}` }
      });
      if (!res.ok) {
        console.warn('[Settings] Could not load — status:', res.status);
        return;
      }
      const cfg = await res.json();
      const input = document.getElementById('settingWaNumber');
      if (input && cfg.whatsappNumber) input.value = cfg.whatsappNumber;
    } catch (e) { console.warn('Could not load settings', e); }
  }

  window.saveSettings = async function () {
    const tok = localStorage.getItem('adminToken');
    if (!tok) return alert('Not logged in. Please refresh and log in again.');
    const num = (document.getElementById('settingWaNumber')?.value || '').trim();
    if (!num) return alert('Please enter a WhatsApp number.');
    const btn = document.querySelector('#settingsSection button');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    try {
      const res = await fetch(API_BASE_URL + '/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
        body: JSON.stringify({ whatsappNumber: num })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const msg = document.getElementById('settingsSaveMsg');
        if (msg) { msg.style.display = 'inline'; setTimeout(() => { msg.style.display = 'none'; }, 3000); }
      } else {
        alert('Error: ' + (data.error || data.message || 'Failed to save settings. Status: ' + res.status));
      }
    } catch (err) {
      alert('Network error saving settings: ' + err.message);
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Save Settings'; }
    }
  };

});
