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
    // Initialize the view system — show dashboard by default
    setTimeout(() => switchMainView('dashboard'), 0);
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
      // Safely read body as text first to handle non-JSON error pages
      const raw = await res.text();
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        // Server returned HTML (Express v5 error page) — log it
        console.error('Non-JSON server response:', raw.substring(0, 300));
        loginError.textContent = `Server error (${res.status}): Please try again or contact support.`;
        return;
      }
      if (data.success) {
        localStorage.setItem('adminToken', data.token);
        showDashboard(data.token);
      } else {
        loginError.textContent = data.error || 'Login failed';
      }
    } catch (err) {
      if (!navigator.onLine) {
        loginError.textContent = 'No internet connection. Please check your network.';
      } else {
        loginError.textContent = 'Cannot reach server. Please wait 30 seconds and try again.';
      }
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
      
      // Populate Batch Filter
      const batchSet = new Set(allApplicants.map(a => a.batchCode).filter(Boolean));
      const batchSelect = document.getElementById('filterBatch');
      if (batchSelect) {
        const currentBatch = batchSelect.value;
        batchSelect.innerHTML = '<option value="all">All Batches</option>';
        Array.from(batchSet).sort().forEach(b => {
          const opt = document.createElement('option');
          opt.value = b;
          opt.textContent = b;
          batchSelect.appendChild(opt);
        });
        batchSelect.value = currentBatch || 'all';
      }

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
    const batchFilter  = document.getElementById('filterBatch')?.value || 'all';
    const docsFilter   = document.getElementById('filterDocs')?.value || 'all';
    const query        = (document.getElementById('searchInput').value || '').toLowerCase().trim();

    let filtered = allApplicants.filter(a => {
      const matchStatus = statusFilter === 'all' || a.status === statusFilter;
      const matchProf   = profFilter   === 'all' || (a.profession || '').toLowerCase() === profFilter;
      const matchBatch  = batchFilter  === 'all' || a.batchCode === batchFilter;
      let matchDocs = true;
      if (docsFilter === 'missing') {
        matchDocs = a.requestedDocuments && a.requestedDocuments.some(d => !d.uploadedUrl || d.status === 'Pending' || d.status === 'Rejected');
      }
      
      const matchSearch = !query ||
        (`${a.firstName} ${a.lastName}`).toLowerCase().includes(query) ||
        (a.email || '').toLowerCase().includes(query) ||
        (a.refNumber || '').toLowerCase().includes(query);
      return matchStatus && matchProf && matchBatch && matchDocs && matchSearch;
    });

    window.currentFilteredApplicants = filtered;

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
        <td><input type="checkbox" class="applicant-cb" value="${app.refNumber}" onchange="updateBulkActions()"></td>
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

  // ─── Export CSV ───────────────────────────────────────────────────────────────
  window.exportCsv = function() {
    const list = window.currentFilteredApplicants || allApplicants || [];
    if (list.length === 0) return alert('No applicants to export.');

    const headers = ['Ref Number', 'First Name', 'Last Name', 'Email', 'Phone', 'Profession', 'Country', 'Status', 'Batch Code', 'Applied On'];
    const rows = list.map(a => [
      a.refNumber || '',
      a.firstName || '',
      a.lastName || '',
      a.email || '',
      a.phone || '',
      a.profession || '',
      a.country || '',
      a.status || 'Pending',
      a.batchCode || '',
      new Date(a.createdAt).toLocaleDateString()
    ]);

    let csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(f => `"${String(f).replace(/"/g, '""')}"`).join(','))
    ].join('\\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'global_job_connect_applicants.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ─── Bulk Email Logic ────────────────────────────────────────────────────────
  window.toggleSelectAll = function() {
    const master = document.getElementById('selectAllCheckbox');
    const checkboxes = document.querySelectorAll('.applicant-cb');
    checkboxes.forEach(cb => cb.checked = master.checked);
    updateBulkActions();
  };

  window.updateBulkActions = function() {
    const selected = document.querySelectorAll('.applicant-cb:checked').length;
    const bar = document.getElementById('bulkActionsBar');
    document.getElementById('bulkCount').textContent = selected;
    if (selected > 0) bar.style.display = 'flex';
    else bar.style.display = 'none';
  };

  window.openBulkEmailModal = function() {
    const selected = document.querySelectorAll('.applicant-cb:checked');
    if (selected.length > 50) return alert('You can only select up to 50 applicants at once for bulk emails.');
    document.getElementById('bulkModalCount').textContent = selected.length;
    
    const sel = document.getElementById('bulkTemplateSelect');
    sel.innerHTML = '<option value="">-- Custom Email --</option>';
    if (window.emailTemplates) {
      window.emailTemplates.forEach(t => {
        sel.innerHTML += `<option value="${t._id}">${t.name}</option>`;
      });
    }
    
    document.getElementById('bulkSubject').value = '';
    document.getElementById('bulkBody').value = '';
    document.getElementById('bulkEmailModal').style.display = 'flex';
  };

  window.closeBulkEmailModal = function() {
    document.getElementById('bulkEmailModal').style.display = 'none';
  };

  window.applyBulkTemplate = function() {
    const tid = document.getElementById('bulkTemplateSelect').value;
    if (!tid) return;
    const t = window.emailTemplates.find(x => x._id === tid);
    if (t) {
      document.getElementById('bulkSubject').value = t.subject;
      document.getElementById('bulkBody').value = t.body;
    }
  };

  window.sendBulkEmail = async function() {
    const selected = Array.from(document.querySelectorAll('.applicant-cb:checked')).map(cb => cb.value);
    const subject = document.getElementById('bulkSubject').value.trim();
    const body = document.getElementById('bulkBody').value.trim();
    const templateId = document.getElementById('bulkTemplateSelect').value;

    if (selected.length === 0) return alert('No applicants selected');
    if (!subject || !body) return alert('Subject and body are required');

    const btn = document.getElementById('btnSendBulk');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';

    try {
      const res = await fetch(API_BASE_URL + '/api/track/send-bulk-email', {
        method: 'POST', headers: getAuthHeaders(),
        body: JSON.stringify({ refNumbers: selected, subject, body, templateId: templateId || null })
      });
      const data = await res.json();
      if (res.ok) {
        alert(`Successfully sent email to ${data.sentCount} applicants.`);
        closeBulkEmailModal();
        document.getElementById('selectAllCheckbox').checked = false;
        toggleSelectAll();
      } else {
        alert(data.error || 'Failed to send bulk email');
      }
    } catch (e) {
      alert('Error sending bulk email');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-paper-plane"></i> Send to All';
    }
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
    document.getElementById('modalAppliedOn').textContent = a.createdAt ? new Date(a.createdAt).toLocaleString() : 'N/A';
    document.getElementById('modalLastLogin').textContent = a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleString() : 'N/A';
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

    // Stages tab
    renderStagesUI(a);

    // Pending docs badge
    const pending = (a.requestedDocuments || []).filter(d => d.uploadedUrl && d.status === 'Pending').length;
    const badge = document.getElementById('docPendingBadge');
    if (badge) {
      if (pending > 0) { badge.textContent = pending; badge.style.display = 'inline'; }
      else { badge.style.display = 'none'; }
    }

    // Reset to first tab
    switchTab('info');

    document.getElementById('applicantModal').style.display = 'flex';
  };

  // Copy REF to clipboard
  window.copyRef = function() {
    const refText = document.getElementById('modalRef')?.textContent?.replace('REF: ', '').trim();
    if (!refText || refText === '---') return;
    navigator.clipboard.writeText(refText).then(() => {
      const hint = document.getElementById('refCopiedHint');
      if (hint) { hint.style.display = 'inline'; setTimeout(() => hint.style.display = 'none', 2000); }
    });
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
    // If switching to docRequest, render submitted docs
    if (tab === 'docRequest' && currentApplicant) {
      renderDocStatusList(currentApplicant);
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

  // ─── Stage Verification UI ────────────────────────────────────────────────────
  const STAGE_DEFS = [
    { label: 'Application Received',   icon: 'fa-inbox' },
    { label: 'Document Verification',  icon: 'fa-file-circle-check' },
    { label: 'Background Check',       icon: 'fa-shield-halved' },
    { label: 'Interview / Assessment', icon: 'fa-comments' },
    { label: 'Final Decision',         icon: 'fa-trophy' },
  ];

  function renderStagesUI(applicant) {
    const container = document.getElementById('stagesList');
    if (!container) return;
    const statuses = applicant.stageStatuses || ['Pending','Pending','Pending','Pending','Pending'];
    container.innerHTML = '';

    STAGE_DEFS.forEach((stage, i) => {
      let status = statuses[i] || 'Pending';
      // Normalize legacy values
      if (status === 'Verified') status = 'Approved';
      if (status === 'Failed') status = 'Rejected';
      if (status === 'In Process') status = 'Under Review';

      const rowClass  = status === 'Approved'     ? 'stage-approved'
        : status === 'Rejected'     ? 'stage-rejected'
        : status === 'Under Review' ? 'stage-review'
        : status === 'Pending'      ? 'stage-pending'
        : '';
      const pillClass = status === 'Approved'     ? 'pill-approved'
        : status === 'Rejected'     ? 'pill-rejected'
        : status === 'Under Review' ? 'pill-review'
        : status === 'Pending'      ? 'pill-pending'
        : 'pill-default';
      const pillIcon  = status === 'Approved'     ? 'fa-check-circle'
        : status === 'Rejected'     ? 'fa-times-circle'
        : status === 'Under Review' ? 'fa-search'
        : 'fa-clock';

      const row = document.createElement('div');
      row.className = `stage-row ${rowClass}`;
      row.innerHTML = `
        <div class="stage-icon-wrap"><i class="fas ${stage.icon}"></i></div>
        <div class="stage-info">
          <div class="stage-name">${stage.label}</div>
          <span class="stage-status-pill ${pillClass}"><i class="fas ${pillIcon}"></i> ${status}</span>
        </div>
        <div class="stage-btns">
          <button class="stage-btn stage-btn-approved ${status === 'Approved'     ? 'active' : ''}" data-idx="${i}" data-status="Approved"     title="Approve"><i class="fas fa-check"></i> Approve</button>
          <button class="stage-btn stage-btn-rejected ${status === 'Rejected'     ? 'active' : ''}" data-idx="${i}" data-status="Rejected"     title="Reject"><i class="fas fa-times"></i> Reject</button>
          <button class="stage-btn stage-btn-pending  ${status === 'Pending'      ? 'active' : ''}" data-idx="${i}" data-status="Pending"      title="Set Pending"><i class="fas fa-hourglass"></i> Pending</button>
          <button class="stage-btn stage-btn-review   ${status === 'Under Review' ? 'active' : ''}" data-idx="${i}" data-status="Under Review" title="Under Review"><i class="fas fa-search"></i> Review</button>
        </div>`;
      container.appendChild(row);
    });

    // Attach click handlers
    container.querySelectorAll('.stage-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const idx       = parseInt(btn.dataset.idx);
        const newStatus = btn.dataset.status;
        await updateStageStatus(idx, newStatus);
      });
    });
  }

  async function updateStageStatus(stageIndex, newStatus) {
    if (!currentApplicant) return;
    try {
      const res = await fetch(API_BASE_URL + '/api/track/update-stage', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          refNumber: currentApplicant.refNumber,
          stageIndex,
          newStatus,
        }),
      });
      if (res.status === 401 || res.status === 403) { alert('Session expired.'); return logout(); }
      const data = await res.json();
      if (data.success) {
        // Update local state and re-render stages
        if (!currentApplicant.stageStatuses) currentApplicant.stageStatuses = ['Pending','Pending','Pending','Pending','Pending'];
        currentApplicant.stageStatuses[stageIndex] = newStatus;
        // Also sync in allApplicants
        const idx = allApplicants.findIndex(a => a.refNumber === currentApplicant.refNumber);
        if (idx !== -1) allApplicants[idx].stageStatuses = [...currentApplicant.stageStatuses];
        renderStagesUI(currentApplicant);
      } else {
        alert(data.error || 'Failed to update stage.');
      }
    } catch {
      alert('Network error updating stage.');
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
        const sentDate = new Date(log.createdAt).toLocaleString();
        const openedBadge = log.openedAt
          ? `<span style="background:#065f46;color:#34d399;font-size:0.72rem;font-weight:700;padding:2px 8px;border-radius:20px;margin-left:8px;"><i class="fas fa-eye" style="margin-right:3px;"></i>Opened ${new Date(log.openedAt).toLocaleString()}</span>`
          : `<span style="background:rgba(251,191,36,.12);color:#fbbf24;font-size:0.72rem;font-weight:700;padding:2px 8px;border-radius:20px;margin-left:8px;"><i class="fas fa-envelope" style="margin-right:3px;"></i>Unread</span>`;
        const div  = document.createElement('div');
        div.className = 'email-log-item';
        div.innerHTML = `
          <div class="email-log-header">
            <span class="email-log-template"><i class="fas fa-envelope"></i> ${log.templateName}${openedBadge}</span>
            <span class="email-log-date">${sentDate}</span>
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

  // ─── Document Status List ─────────────────────────────────────────────────────
  function renderDocStatusList(applicant) {
    const container = document.getElementById('adminDocStatusList');
    if (!container) return;
    const docs = applicant.requestedDocuments || [];
    if (!docs.length) {
      container.innerHTML = '<p style="color:rgba(255,255,255,.3);font-style:italic;font-size:0.88rem;">No document requests yet.</p>';
      return;
    }
    container.innerHTML = '';
    docs.forEach(doc => {
      const statusColor = doc.status === 'Verified' ? '#34d399' : doc.status === 'Rejected' ? '#fb7185' : '#fbbf24';
      const statusIcon  = doc.status === 'Verified' ? 'fa-check-circle' : doc.status === 'Rejected' ? 'fa-times-circle' : 'fa-hourglass-half';
      const hasFile = !!doc.uploadedUrl;
      const row = document.createElement('div');
      row.style.cssText = 'padding:12px 14px;border:1px solid rgba(255,255,255,.1);border-radius:10px;margin-bottom:10px;background:rgba(255,255,255,.03);';
      row.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
          <div>
            <strong style="color:#fff;font-size:0.9rem;">${doc.label}</strong><br>
            <span style="font-size:0.75rem;color:rgba(255,255,255,.35);">Requested: ${new Date(doc.requestedAt).toLocaleDateString()}</span>
            ${doc.adminNote ? `<br><span style="font-size:0.78rem;color:#fcd34d;"><i class="fas fa-comment-alt"></i> ${doc.adminNote}</span>` : ''}
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="color:${statusColor};font-size:0.8rem;font-weight:700;"><i class="fas ${statusIcon}"></i> ${doc.status}</span>
            ${hasFile ? `<a href="${doc.uploadedUrl}" target="_blank" class="btn btn-secondary" style="font-size:0.75rem;padding:4px 10px;"><i class="fas fa-eye"></i> View</a>` : '<span style="color:rgba(255,255,255,.3);font-size:0.78rem;">Not uploaded</span>'}
          </div>
        </div>
        ${hasFile && doc.status !== 'Verified' ? `
          <div style="display:flex;gap:8px;margin-top:10px;">
            <button class="btn btn-success" style="font-size:0.78rem;padding:5px 12px;" onclick="updateDocStatus('${applicant._id}','${doc._id}','Verified')">
              <i class="fas fa-check"></i> Verify
            </button>
            <button class="btn btn-danger" style="font-size:0.78rem;padding:5px 12px;" onclick="promptRejectDoc('${applicant._id}','${doc._id}')">
              <i class="fas fa-times"></i> Reject
            </button>
          </div>` : ''}
      `;
      container.appendChild(row);
    });
  }

  window.updateDocStatus = async function(applicantId, docId, status, adminNote) {
    try {
      const res = await fetch(API_BASE_URL + '/api/track/document-status', {
        method: 'PUT', headers: getAuthHeaders(),
        body: JSON.stringify({ applicantId, docId, status, adminNote: adminNote || '' })
      });
      const data = await res.json();
      if (data.success) {
        // Update local data and re-render
        const doc = currentApplicant.requestedDocuments.find(d => d._id === docId);
        if (doc) { doc.status = status; if (adminNote) doc.adminNote = adminNote; }
        renderDocStatusList(currentApplicant);
      } else alert(data.error || 'Failed to update document status.');
    } catch { alert('Network error updating document status.'); }
  };

  window.promptRejectDoc = function(applicantId, docId) {
    const note = prompt('Rejection reason (optional, shown to applicant):');
    if (note === null) return; // cancelled
    updateDocStatus(applicantId, docId, 'Rejected', note);
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
  // ─── Support System ────────────────────────────────────────────────────────
  let supportPollingInterval = null;
  let threadPollingInterval  = null;
  let currentTicketId = null;

  window.switchMainView = function (viewId) {
    // Hide all known views by their actual IDs
    ['dashboard-view', 'templates-section', 'support-view'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
    document.querySelectorAll('.admin-nav-tab').forEach(el => el.classList.remove('active'));

    // Map logical name to actual element ID
    const idMap = { dashboard: 'dashboard-view', templates: 'templates-section', support: 'support-view' };
    const targetEl = document.getElementById(idMap[viewId] || (viewId + '-view'));
    if (targetEl) targetEl.style.display = 'block';

    if (viewId === 'dashboard') {
      document.getElementById('navDashboard').classList.add('active');
      clearInterval(supportPollingInterval);
      clearInterval(threadPollingInterval);
    } else if (viewId === 'templates') {
      document.getElementById('navTemplates').classList.add('active');
      clearInterval(supportPollingInterval);
      clearInterval(threadPollingInterval);
    } else if (viewId === 'support') {
      document.getElementById('navSupport').classList.add('active');
      loadSupportTickets();
      supportPollingInterval = setInterval(loadSupportTickets, 5000);
      // Also poll the open thread every 4s to show incoming client messages
      threadPollingInterval = setInterval(() => {
        if (currentTicketId) refreshThreadSilently(currentTicketId);
      }, 4000);
      if (currentTicketId) openSupportTicket(currentTicketId);
    }
  };

  async function updateSupportBadge() {
    const tok = localStorage.getItem('adminToken');
    if (!tok) return;
    try {
      const res = await fetch(API_BASE_URL + '/api/support/unread-count', { headers: { Authorization: `Bearer ${tok}` }});
      const data = await res.json();
      const badge = document.getElementById('supportBadge');
      if (data.count > 0) {
        badge.style.display = 'inline-block';
        badge.textContent = data.count;
        badge.classList.add('badge-pulse');
      } else {
        badge.style.display = 'none';
        badge.classList.remove('badge-pulse');
      }
    } catch (e) {}
  }

  // Poll badge everywhere, every 10 seconds
  setInterval(updateSupportBadge, 10000);

  window.loadSupportTickets = async function () {
    const tok = localStorage.getItem('adminToken');
    if (!tok) return;
    try {
      const res = await fetch(API_BASE_URL + `/api/support/tickets?t=${Date.now()}`, { 
        headers: { Authorization: `Bearer ${tok}` },
        cache: 'no-store'
      });
      const data = await res.json();
      const listEl = document.getElementById('supportList');
      if (!data.tickets || data.tickets.length === 0) {
        listEl.innerHTML = '<div style="text-align:center; padding:30px; color:rgba(255,255,255,.3);">No active support tickets</div>';
        return;
      }
      
      listEl.innerHTML = data.tickets.map(t => {
        const isActive = t._id === currentTicketId;
        const bg = isActive ? 'rgba(96,165,250,.15)' : 'rgba(255,255,255,.03)';
        const hoverBg = isActive ? 'rgba(96,165,250,.2)' : 'rgba(255,255,255,.08)';
        return `
        <div onclick="openSupportTicket('${t._id}')" onmouseover="this.style.background='${hoverBg}'" onmouseout="this.style.background='${bg}'" style="padding:12px; background:${bg}; border-radius:8px; margin-bottom:8px; cursor:pointer; border-left:4px solid ${t.unreadByAdmin > 0 ? '#60a5fa' : (isActive ? '#3b82f6' : 'transparent')}; transition:background 0.2s;">
          <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
            <strong style="color:${t.unreadByAdmin > 0 ? '#fff' : (isActive ? '#60a5fa' : 'rgba(255,255,255,.8)')};">${t.applicantName}</strong>
            <span style="font-size:0.75rem; color:rgba(255,255,255,.4);">${new Date(t.lastMessageAt).toLocaleDateString()}</span>
          </div>
          <div style="font-size:0.85rem; color:${isActive ? 'rgba(255,255,255,.7)' : 'rgba(255,255,255,.5)'}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${t.applicantEmail}</div>
        </div>
      `}).join('');
      updateSupportBadge(); // Update badge right after fetching tickets
    } catch (e) {
      console.warn('Failed to load tickets', e);
    }
  };

  window.openSupportTicket = async function (ticketId) {
    currentTicketId = ticketId;
    const tok = localStorage.getItem('adminToken');
    if (!tok) return;
    try {
      const res = await fetch(API_BASE_URL + `/api/support/tickets/${ticketId}?t=${Date.now()}`, { 
        headers: { Authorization: `Bearer ${tok}` },
        cache: 'no-store' 
      });
      const data = await res.json();
      const t = data.ticket;
      
      document.getElementById('supportThreadName').textContent = t.applicantName;
      document.getElementById('supportThreadEmail').textContent = t.applicantEmail;
      document.getElementById('closeTicketBtn').style.display = 'block';
      document.getElementById('supportReplyBox').style.display = 'block';

      const msgContainer = document.getElementById('supportMessages');
      
      const formatMsg = (text) => {
        if (!text) return '';
        let s = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
        return s.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" style="color:#93c5fd; text-decoration:underline;">$1</a>');
      };

      msgContainer.innerHTML = t.messages.map(m => `
        <div class="msg-animate" style="max-width:80%; align-self: ${m.sender === 'admin' ? 'flex-end' : 'flex-start'};">
          <div style="font-size:0.75rem; color:rgba(255,255,255,.4); margin-bottom:4px; text-align: ${m.sender === 'admin' ? 'right' : 'left'};">${m.sender === 'admin' ? 'You' : t.applicantName} • ${new Date(m.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',timeZoneName:'short'})}</div>
          <div style="padding:12px 16px; border-radius:12px; background:${m.sender === 'admin' ? '#1565c0' : 'rgba(255,255,255,.08)'}; color:#fff; line-height:1.5; white-space: pre-wrap; word-break: break-word;">${formatMsg(m.text)}</div>
        </div>
      `).join('');
      
      // Auto scroll to bottom
      msgContainer.scrollTop = msgContainer.scrollHeight;

      // Re-fetch list to clear unread indicator
      loadSupportTickets();

    } catch (e) {
      console.error('Error loading ticket thread', e);
    }
  }; // end openSupportTicket

  // Silently refresh just the messages in the currently open thread (for polling)
  async function refreshThreadSilently(ticketId) {
    const tok = localStorage.getItem('adminToken');
    if (!tok) return;
    try {
      const res = await fetch(API_BASE_URL + `/api/support/tickets/${ticketId}?t=${Date.now()}`, {
        headers: { Authorization: `Bearer ${tok}` },
        cache: 'no-store'
      });
      const data = await res.json();
      if (!data.ticket) return;
      const t = data.ticket;

      const formatMsg = (text) => {
        if (!text) return '';
        let s = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
        return s.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" style="color:#93c5fd; text-decoration:underline;">$1</a>');
      };

      const msgContainer = document.getElementById('supportMessages');
      const prevCount = msgContainer.querySelectorAll('.msg-animate').length;
      const newCount  = t.messages.length;

      if (newCount > prevCount) {
        // New messages arrived — re-render and scroll to bottom
        msgContainer.innerHTML = t.messages.map(m => `
          <div class="msg-animate" style="max-width:80%; align-self: ${m.sender === 'admin' ? 'flex-end' : 'flex-start'};">
            <div style="font-size:0.75rem; color:rgba(255,255,255,.4); margin-bottom:4px; text-align: ${m.sender === 'admin' ? 'right' : 'left'};">${m.sender === 'admin' ? 'You' : t.applicantName} • ${new Date(m.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',timeZoneName:'short'})}</div>
            <div style="padding:12px 16px; border-radius:12px; background:${m.sender === 'admin' ? '#1565c0' : 'rgba(255,255,255,.08)'}; color:#fff; line-height:1.5; white-space: pre-wrap; word-break: break-word;">${formatMsg(m.text)}</div>
          </div>
        `).join('');
        msgContainer.scrollTop = msgContainer.scrollHeight;
        // Also update unread state
        loadSupportTickets();
      }
    } catch (e) { /* silent */ }
  }

  window.sendSupportReply = async function () {
    if (!currentTicketId) return;
    const txtBox = document.getElementById('supportReplyText');
    const text = txtBox.value.trim();
    if (!text) return;
    
    const tok = localStorage.getItem('adminToken');
    try {
      const res = await fetch(API_BASE_URL + `/api/support/tickets/${currentTicketId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
        body: JSON.stringify({ text })
      });
      const data = await res.json();
      if (data.success) {
        txtBox.value = '';
        openSupportTicket(currentTicketId); // refresh thread
      } else {
        alert('Failed to send reply: ' + data.error);
      }
    } catch (e) {
      alert('Network error sending reply');
    }
  };

  window.closeSupportTicket = async function () {
    if (!currentTicketId) return;
    if (!confirm('Are you sure you want to resolve and close this ticket?')) return;
    
    const tok = localStorage.getItem('adminToken');
    try {
      const res = await fetch(API_BASE_URL + `/api/support/tickets/${currentTicketId}/close`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${tok}` }
      });
      const data = await res.json();
      if (data.success) {
        currentTicketId = null;
        document.getElementById('supportThreadName').textContent = 'Select a ticket';
        document.getElementById('supportThreadEmail').textContent = '';
        document.getElementById('closeTicketBtn').style.display = 'none';
        document.getElementById('supportReplyBox').style.display = 'none';
        document.getElementById('supportMessages').innerHTML = '<div style="margin:auto; color:rgba(255,255,255,.2); font-size:3rem;"><i class="fas fa-check-circle"></i></div>';
        loadSupportTickets();
      } else {
        alert('Failed to close ticket: ' + data.error);
      }
    } catch (e) {
      alert('Network error closing ticket');
    }
  };

});
