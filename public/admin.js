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
      renderCharts();
    } catch (err) {
      console.error('Failed to fetch applicants', err);
    } finally {
      if (refreshBtn) { refreshBtn.disabled = false; refreshBtn.innerHTML = '<i class="fas fa-sync"></i> Refresh'; }
    }
  }

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

  function renderCharts() {
    // Timeline: last 30 days
    const dayMap = {};
    const today  = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      dayMap[d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })] = 0;
    }
    allApplicants.forEach(a => {
      const label = new Date(a.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (dayMap[label] !== undefined) dayMap[label]++;
    });

    const tlCtx = document.getElementById('chartTimeline')?.getContext('2d');
    if (tlCtx) {
      if (chartTimeline) chartTimeline.destroy();
      chartTimeline = new Chart(tlCtx, {
        type: 'line',
        data: {
          labels: Object.keys(dayMap),
          datasets: [{ label: 'Applications', data: Object.values(dayMap), borderColor: '#60a5fa', backgroundColor: 'rgba(96,165,250,.12)', tension: 0.4, fill: true, pointRadius: 3, pointBackgroundColor: '#60a5fa' }],
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

    // Profession pie
    const profMap = {};
    allApplicants.forEach(a => { profMap[a.profession || 'Unknown'] = (profMap[a.profession || 'Unknown'] || 0) + 1; });
    const profColors = ['#60a5fa','#34d399','#fbbf24','#fb7185','#a78bfa','#f97316'];
    const pfCtx = document.getElementById('chartProfession')?.getContext('2d');
    if (pfCtx) {
      if (chartProfession) chartProfession.destroy();
      chartProfession = new Chart(pfCtx, {
        type: 'doughnut',
        data: {
          labels: Object.keys(profMap),
          datasets: [{ data: Object.values(profMap), backgroundColor: profColors, borderWidth: 2, borderColor: '#0d1a2d' }],
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
    ['info','quals','decision'].forEach(t => {
      document.getElementById(`tab${t.charAt(0).toUpperCase()+t.slice(1)}`).style.display = t === tab ? 'block' : 'none';
    });
    document.querySelectorAll('.modal-tab').forEach((btn, i) => {
      btn.classList.toggle('modal-tab--active', ['info','quals','decision'][i] === tab);
    });
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
});
