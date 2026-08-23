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
      const el = document.getElementById(`tab${t.charAt(0).toUpperCase()+t.slice(1)}`);
      if (el) el.style.display = t === tab ? 'block' : 'none';
    });
    document.querySelectorAll('.modal-tab').forEach((btn, i) => {
      btn.classList.toggle('modal-tab--active', ['info','quals','decision','email','docRequest'].includes(tab) && btn.textContent.toLowerCase().includes(tab.slice(0, 3)));
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

  // ─── Custom Email & Document Request ──────────────────────────────────────────
  const emailTemplates = {
    // A. Application & Initial Communication
    app_received: {
      subject: "Application Received",
      body: "Thank you for applying for the position of [Position] with [Company Name].\n\nWe confirm that your application has been received and is currently under review.\n\nIf your application meets the requirements for the next stage, we will contact you with further instructions.\n\nKind regards,\n[HR/Recruitment Team]"
    },
    app_under_review: {
      subject: "Application Under Review",
      body: "We would like to inform you that your application for [Position] is currently under review.\n\nOur recruitment team is assessing your qualifications and supporting documents. We will contact you once the review has been completed.\n\nThank you for your patience.\n\nKind regards,\n[HR/Recruitment Team]"
    },
    app_shortlisted: {
      subject: "Application Shortlisted",
      body: "We are pleased to inform you that your application for [Position] has been shortlisted.\n\nYou have successfully met the initial requirements, and your application will now proceed to the next stage of the recruitment process.\n\nFurther instructions will be provided shortly.\n\nCongratulations, and we look forward to working with you.\n\nKind regards,\n[HR/Recruitment Team]"
    },
    app_not_successful: {
      subject: "Application Not Successful",
      body: "Thank you for your interest in [Position] and for taking the time to submit your application.\n\nAfter careful consideration, we regret to inform you that your application will not proceed to the next stage at this time.\n\nWe appreciate your interest in [Company Name] and wish you every success in your future career.\n\nKind regards,\n[HR/Recruitment Team]"
    },
    // B. Documents & Verification
    req_documents: {
      subject: "Request for Documents",
      body: "To proceed with your application, please provide the following documents:\n\n[Document 1]\n[Document 2]\n[Document 3]\n[Document 4]\n\nPlease submit clear and valid copies by [Date].\n\nKindly reply to this email with the required documents attached.\n\nKind regards,\n[HR/Recruitment Team]"
    },
    missing_documents: {
      subject: "Missing Documents",
      body: "Following our review of your application, we note that the following documents are still outstanding:\n\n[Document 1]\n[Document 2]\n\nPlease provide the outstanding documents by [Date] to avoid delays in processing your application.\n\nKind regards,\n[HR/Recruitment Team]"
    },
    doc_quality_issue: {
      subject: "Document Quality Issue",
      body: "We have received the documents submitted with your application. However, [document name] could not be properly verified because [reason – unclear/expired/incomplete/etc.].\n\nPlease provide a clear and valid copy of the document by [Date].\n\nThank you for your cooperation.\n\nKind regards,\n[HR/Recruitment Team]"
    },
    passport_id_req: {
      subject: "Passport/ID Request",
      body: "As part of the verification process, please provide a clear copy of your valid [Passport/National ID].\n\nPlease ensure that all relevant information is clearly visible and that the document is valid.\n\nKindly submit it by [Date].\n\nKind regards,\n[HR/Recruitment Team]"
    },
    cred_verification: {
      subject: "Credential Verification",
      body: "As part of our verification process, we are currently reviewing your academic and/or professional qualifications.\n\nPlease provide the following information/documents:\n\n[Certificate/Diploma/Degree]\n[Transcript]\n[Professional Registration/License]\n[Other]\n\nPlease ensure that the information provided is accurate and complete.\n\nKind regards,\n[HR/Recruitment Team]"
    },
    verification_completed: {
      subject: "Verification Completed",
      body: "We are pleased to confirm that the initial verification of your submitted documents has been completed successfully.\n\nYour application will now proceed to the next stage of the recruitment process.\n\nWe will contact you if any additional information is required.\n\nKind regards,\n[HR/Recruitment Team]"
    },
    // C. Fees & Payments
    fee_request: {
      subject: "Payment/Processing Fee Request",
      body: "Your application has progressed to the next stage.\n\nThe following fee is applicable:\n\nFee: [Description]\nAmount: [Amount]\nCurrency: [Currency]\nDue Date: [Date]\n\nPayment instructions are provided below:\n\n[Payment Instructions]\n\nAfter completing the payment, please send the official payment confirmation/receipt to our team.\n\nKind regards,\n[HR/Recruitment Team]"
    },
    fee_reminder: {
      subject: "Payment Reminder",
      body: "This is a reminder that the payment of [Amount] for [purpose] remains outstanding.\n\nPlease complete the payment by [Date] to prevent delays in the processing of your application.\n\nIf you have already made the payment, kindly forward the official receipt or payment confirmation.\n\nKind regards,\n[HR/Recruitment Team]"
    },
    fee_received: {
      subject: "Payment Received",
      body: "We confirm receipt of your payment of [Amount] for [purpose].\n\nYour payment has been recorded against application reference [Application ID].\n\nWe will now proceed with the relevant stage of your application.\n\nThank you.\n\nKind regards,\n[HR/Recruitment Team]"
    },
    fee_conf_req: {
      subject: "Payment Confirmation Required",
      body: "Our records indicate that a payment for [purpose] may have been initiated, but we have not yet received the payment confirmation.\n\nIf payment has been completed, please forward the official receipt or transaction confirmation for verification.\n\nKind regards,\n[HR/Recruitment Team]"
    },
    fee_issue: {
      subject: "Payment Issue",
      body: "We are currently unable to verify the payment submitted for [purpose].\n\nPlease provide the official payment receipt/confirmation showing:\n\nTransaction/reference number\nAmount paid\nDate of payment\nPayment method\n\nOnce received, our team will review and update your application.\n\nKind regards,\n[HR/Recruitment Team]"
    },
    // D. Assessment & Interview
    assessment_invite: {
      subject: "Assessment Invitation",
      body: "You have been invited to complete the [Assessment Name] as part of the recruitment process for [Position].\n\nDate: [Date]\nTime: [Time]\nDuration: [Duration]\nLocation/Platform: [Details]\n\nPlease complete the assessment within the specified timeframe.\n\nKind regards,\n[HR/Recruitment Team]"
    },
    interview_invite: {
      subject: "Interview Invitation",
      body: "We are pleased to invite you for an interview for the position of [Position].\n\nDate: [Date]\nTime: [Time]\nLocation/Platform: [Details]\nInterview Type: [Online/In-person]\n\nPlease confirm your availability by [Date].\n\nWe look forward to speaking with you.\n\nKind regards,\n[HR/Recruitment Team]"
    },
    interview_reminder: {
      subject: "Interview Reminder",
      body: "This is a reminder that your interview for [Position] is scheduled as follows:\n\nDate: [Date]\nTime: [Time]\nLocation/Platform: [Details]\n\nPlease ensure that you are available and ready at the scheduled time.\n\nKind regards,\n[HR/Recruitment Team]"
    },
    interview_reschedule: {
      subject: "Interview Rescheduling",
      body: "Please note that your interview for [Position] has been rescheduled.\n\nNew Date: [Date]\nNew Time: [Time]\nLocation/Platform: [Details]\n\nWe apologize for any inconvenience and appreciate your understanding.\n\nKind regards,\n[HR/Recruitment Team]"
    },
    interview_followup: {
      subject: "Interview Follow-Up",
      body: "Thank you for attending the interview for [Position].\n\nWe appreciate the time you took to discuss your qualifications and experience with our team.\n\nYour application remains under consideration, and we will contact you once a decision has been made.\n\nKind regards,\n[HR/Recruitment Team]"
    },
    // E. Offer & Selection
    selected_position: {
      subject: "Selected for Position",
      body: "We are pleased to inform you that you have been selected for the position of [Position] with [Employer/Company].\n\nCongratulations on successfully progressing through the recruitment process.\n\nFurther information regarding your offer, employment conditions, and next steps will be provided separately.\n\nKind regards,\n[HR/Recruitment Team]"
    },
    emp_offer: {
      subject: "Employment Offer",
      body: "We are pleased to offer you the position of [Position] with [Employer].\n\nThe key details of the offer are:\n\nPosition: [Position]\nEmployer: [Employer]\nLocation: [Location]\nSalary: [Salary]\nStart Date: [Date]\n\nPlease review the attached offer letter and return the signed copy by [Date].\n\nCongratulations.\n\nKind regards,\n[HR/Recruitment Team]"
    },
    offer_acceptance: {
      subject: "Offer Acceptance Confirmation",
      body: "Thank you for returning your signed offer letter.\n\nWe confirm that your acceptance has been received and recorded.\n\nWe will now proceed with the remaining pre-employment and onboarding requirements.\n\nFurther instructions will follow.\n\nKind regards,\n[HR/Recruitment Team]"
    },
    // F. Pre-Employment & Onboarding
    pre_emp_req: {
      subject: "Pre-Employment Requirements",
      body: "As you prepare to join [Employer/Company], please complete the following requirements:\n\n[Requirement 1]\n[Requirement 2]\n[Requirement 3]\n[Requirement 4]\n\nPlease complete these requirements by [Date].\n\nKind regards,\n[HR/Recruitment Team]"
    },
    med_background: {
      subject: "Medical/Background Check",
      body: "As part of the pre-employment process, you are required to complete [background verification/medical examination/other applicable requirement].\n\nPlease follow the instructions provided below:\n\n[Instructions]\n\nKindly complete this requirement by [Date].\n\nKind regards,\n[HR/Recruitment Team]"
    },
    onboarding_info: {
      subject: "Onboarding Information",
      body: "We are pleased to welcome you to [Company/Employer].\n\nYour onboarding details are as follows:\n\nPosition: [Position]\nStart Date: [Date]\nReporting Time: [Time]\nLocation: [Location]\nReporting To: [Name/Department]\n\nPlease bring [required documents/items] on your first day.\n\nWe look forward to welcoming you.\n\nKind regards,\n[HR/Recruitment Team]"
    },
    // G. International Recruitment / Visa / Relocation
    visa_docs: {
      subject: "Visa/Work Permit Documents",
      body: "Your application has progressed to the visa/work permit stage.\n\nTo begin the relevant process, please provide the following documents:\n\nValid passport\n[Employment/Offer Letter]\n[Qualification documents]\n[Professional registration]\n[Other required documents]\n\nPlease submit the documents by [Date].\n\nKind regards,\n[HR/Recruitment Team]"
    },
    visa_update: {
      subject: "Visa Process Update",
      body: "We would like to provide you with an update regarding your visa/work permit process.\n\nCurrent Status: [Status]\n\nThe next expected step is [Next Step].\n\nWe will provide further updates as they become available.\n\nKind regards,\n[HR/Recruitment Team]"
    },
    travel_info: {
      subject: "Travel/Relocation Information",
      body: "As you prepare for your relocation to [Country/Location], please review the following information:\n\nExpected Travel Date: [Date]\nDestination: [Location]\nReporting Date: [Date]\nAccommodation: [Details, if applicable]\nContact Person: [Name]\n\nPlease ensure that all required travel and employment documents are available before departure.\n\nKind regards,\n[HR/Recruitment Team]"
    },
    // H. Delays & Status Updates
    processing_delay: {
      subject: "Processing Delay",
      body: "We would like to inform you that there is currently a delay in processing your application due to [general reason, if appropriate].\n\nYour application remains active, and our team is continuing to work on the next stage.\n\nWe appreciate your patience and will provide an update as soon as possible.\n\nKind regards,\n[HR/Recruitment Team]"
    },
    no_response: {
      subject: "Applicant Has Not Responded",
      body: "We previously contacted you regarding [documents/payment/interview/requirement], but we have not yet received a response.\n\nPlease provide the requested information by [Date].\n\nIf we do not hear from you by the stated deadline, your application may be placed on hold.\n\nKind regards,\n[HR/Recruitment Team]"
    },
    app_on_hold: {
      subject: "Application Put on Hold",
      body: "Please be advised that your application for [Position] has been placed on hold pending [outstanding requirement/review/availability].\n\nYour application may resume once the outstanding matter has been resolved.\n\nWe will contact you when there is a further update.\n\nKind regards,\n[HR/Recruitment Team]"
    },
    // I. Final / Closure
    app_withdrawn: {
      subject: "Application Withdrawn",
      body: "We confirm receipt of your request to withdraw your application for [Position].\n\nYour application has now been closed in our recruitment system.\n\nWe appreciate your interest in [Company Name] and wish you all the best.\n\nKind regards,\n[HR/Recruitment Team]"
    },
    app_closed: {
      subject: "Application Closed",
      body: "We are writing to inform you that your application for [Position] has now been closed due to [reason, if appropriate].\n\nThank you for your interest in [Company Name] and for participating in our recruitment process.\n\nWe wish you success in your future career.\n\nKind regards,\n[HR/Recruitment Team]"
    },
    welcome_final: {
      subject: "Welcome / Final Confirmation",
      body: "Congratulations once again on successfully completing the recruitment process.\n\nWe are pleased to welcome you to [Company/Employer] as [Position].\n\nYour joining details and any remaining instructions will be communicated to you separately.\n\nWe look forward to having you join the team.\n\nKind regards,\n[HR/Recruitment Team]"
    }
  };

  const templateSelect = document.getElementById('emailTemplateSelect');
  if (templateSelect) {
    templateSelect.addEventListener('change', (e) => {
      const val = e.target.value;
      if (val && emailTemplates[val]) {
        document.getElementById('emailSubjectInput').value = emailTemplates[val].subject;
        document.getElementById('emailBodyInput').value = emailTemplates[val].body;
      } else {
        document.getElementById('emailSubjectInput').value = '';
        document.getElementById('emailBodyInput').value = '';
      }
    });
  }

  document.getElementById('btnSendEmail')?.addEventListener('click', async () => {
    if (!currentApplicant) return;
    const subject = document.getElementById('emailSubjectInput').value.trim();
    const body    = document.getElementById('emailBodyInput').value.trim();
    if (!subject || !body) return alert('Please enter both subject and message body.');

    const btn = document.getElementById('btnSendEmail');
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending…';

    try {
      const res = await fetch(API_BASE_URL + '/api/track/send-email', {
        method: 'POST', headers: getAuthHeaders(),
        body: JSON.stringify({ refNumber: currentApplicant.refNumber, subject, body })
      });
      const data = await res.json();
      if (data.success) {
        alert('Email sent successfully!');
        if (templateSelect) templateSelect.value = '';
        document.getElementById('emailSubjectInput').value = '';
        document.getElementById('emailBodyInput').value = '';
        switchTab('info');
      } else alert(data.error || 'Failed to send email');
    } catch { alert('Network error while sending email.'); }
    finally { btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Email'; }
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
