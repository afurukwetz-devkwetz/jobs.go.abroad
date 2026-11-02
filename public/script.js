/* =========================================================
   script.js — Global Jobs Board frontend logic
   Clean rewrite: no module-level DOM queries
   ========================================================= */

'use strict';

// ── Globals ─────────────────────────────────────────────────
let iti;            // intl-tel-input instance
let selectedProf = 'nurse';
let currentStep = 1;
const totalSteps = 4;

function showToast(msg, type = 'error') {
  const c = document.getElementById('toast-container');
  if (!c) return;
  const el = document.createElement('div');
  el.className = `toast-msg ${type}`;
  el.innerHTML = `<i class="fas fa-${type === 'error' ? 'exclamation-circle' : 'check-circle'}"></i> ${msg}`;
  c.appendChild(el);
  setTimeout(() => { el.classList.add('fadeOut'); setTimeout(() => el.remove(), 300); }, 5000);
}

function nextStep(step) {
  if (!validateStep(step)) return;
  
  document.getElementById('step' + step).style.display = 'none';
  document.getElementById('stepIndicator' + step).classList.add('completed');
  document.getElementById('stepIndicator' + step).classList.remove('active');
  document.getElementById('stepLabel' + step).classList.remove('active');
  
  if (step < totalSteps) {
    document.getElementById('stepLine' + step).classList.add('active');
  }

  currentStep = step + 1;
  document.getElementById('step' + currentStep).style.display = 'block';
  document.getElementById('stepIndicator' + currentStep).classList.add('active');
  document.getElementById('stepLabel' + currentStep).classList.add('active');
}

function prevStep(step) {
  document.getElementById('step' + step).style.display = 'none';
  document.getElementById('stepIndicator' + step).classList.remove('active');
  document.getElementById('stepLabel' + step).classList.remove('active');
  
  currentStep = step - 1;
  document.getElementById('stepIndicator' + currentStep).classList.remove('completed');
  document.getElementById('stepIndicator' + currentStep).classList.add('active');
  document.getElementById('stepLabel' + currentStep).classList.add('active');
  if (currentStep < totalSteps) {
    document.getElementById('stepLine' + currentStep).classList.remove('active');
  }
  document.getElementById('step' + currentStep).style.display = 'block';
}

function toggleFaq(btn) {
  const content = btn.nextElementSibling;
  const icon = btn.querySelector('i');
  
  if (content.style.maxHeight) {
    content.style.maxHeight = null;
    content.style.paddingTop = "0";
    content.style.paddingBottom = "0";
    icon.style.transform = 'rotate(0deg)';
  } else {
    // Close others
    document.querySelectorAll('.faq-content').forEach(c => {
      c.style.maxHeight = null;
      c.style.paddingTop = "0";
      c.style.paddingBottom = "0";
    });
    document.querySelectorAll('.faq-toggle i').forEach(i => i.style.transform = 'rotate(0deg)');
    
    // Open this
    content.style.maxHeight = content.scrollHeight + 30 + "px"; // padding offset
    content.style.paddingTop = "15px";
    content.style.paddingBottom = "15px";
    icon.style.transform = 'rotate(180deg)';
  }
}

function validateStep(step) {
  const stepDiv = document.getElementById('step' + step);
  const inputs = Array.from(stepDiv.querySelectorAll('input[required], select[required]'));
  
  for (const input of inputs) {
    if (!input.value.trim() && input.type !== 'checkbox' && input.type !== 'radio') {
      showToast('Please fill out all required fields before proceeding.');
      input.scrollIntoView({ behavior: 'smooth', block: 'center' });
      input.style.borderColor = '#ef5350';
      input.focus();
      setTimeout(() => { input.style.borderColor = ''; }, 2000);
      return false;
    }
  }
  
  // Step 3 (Details): user must complete & tick all declaration checkboxes
  if (step === 3) {
    const qualPanel = document.getElementById('qualPanel');
    const isOpen = qualPanel && qualPanel.style.display !== 'none';
    if (isOpen) {
      const declBoxes = Array.from(document.querySelectorAll('input[name="decl"]'));
      const allChecked = declBoxes.length > 0 && declBoxes.every(cb => cb.checked);
      if (!allChecked) {
        showToast('Please tick all three declaration checkboxes before proceeding.');
        const qualSection = document.getElementById('nurseQualSection');
        if (qualSection) {
          qualSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
          qualSection.style.outline = '2px solid #f43f5e';
          setTimeout(() => { qualSection.style.outline = ''; }, 2000);
        }
        return false;
      }
    } else {
      // Panel is collapsed — require them to open and complete it
      showToast('Please expand and complete the Professional Qualification Assessment.');
      const qualToggleBtn = document.getElementById('qualToggleBtn');
      if (qualToggleBtn) { toggleQualPanel(); }
      const qualSection = document.getElementById('nurseQualSection');
      if (qualSection) qualSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return false;
    }
  }

  if (step === 4) {
    const pw = document.getElementById('password').value;
    const cpw = document.getElementById('confirmPw').value;
    if (pw !== cpw) {
      showToast('Passwords do not match.');
      return false;
    }
    const terms = document.getElementById('terms');
    if (terms && !terms.checked) {
      showToast('You must agree to the Terms & Conditions.');
      return false;
    }
  }
  return true;
}

const STAGES = [
  { label: 'Application Received',   desc: 'Your application was submitted successfully.',       icon: 'fa-inbox' },
  { label: 'Document Verification',  desc: 'Our team is verifying your uploaded documents.',     icon: 'fa-file-circle-check' },
  { label: 'Background Check',       desc: 'A standard background screening is in progress.',    icon: 'fa-shield-halved' },
  { label: 'Interview / Assessment', desc: 'You will be contacted to schedule an interview.',    icon: 'fa-comments' },
  { label: 'Final Decision',         desc: 'A placement decision will be communicated to you.',  icon: 'fa-trophy' },
];

// ── Tab switching ─────────────────────────────────────────────
function showPanel(name) {
  const panelReg    = document.getElementById('panelReg');
  const panelTrack  = document.getElementById('panelTrack');
  const panelResume = document.getElementById('panelResume');
  const tabReg      = document.getElementById('tabReg');
  const tabTrack    = document.getElementById('tabTrack');
  const tabResume   = document.getElementById('tabResume');
  const servicesSec = document.getElementById('servicesSection');
  const pageWrap    = document.querySelector('.page-wrap');

  if (name === 'track') {
    if (panelReg) panelReg.hidden = true;
    if (panelResume) panelResume.hidden = true;
    if (panelTrack) panelTrack.hidden = false;
    tabReg?.classList.remove('tab--active');
    tabResume?.classList.remove('tab--active');
    tabTrack?.classList.add('tab--active');
    tabReg?.setAttribute('aria-selected', 'false');
    tabResume?.setAttribute('aria-selected', 'false');
    tabTrack?.setAttribute('aria-selected', 'true');
    if (servicesSec) servicesSec.style.display = 'none';
    if (pageWrap) pageWrap.classList.remove('resume-expanded');
  } else if (name === 'resume') {
    if (panelReg) panelReg.hidden = true;
    if (panelTrack) panelTrack.hidden = true;
    if (panelResume) panelResume.hidden = false;
    tabReg?.classList.remove('tab--active');
    tabTrack?.classList.remove('tab--active');
    tabResume?.classList.add('tab--active');
    tabReg?.setAttribute('aria-selected', 'false');
    tabTrack?.setAttribute('aria-selected', 'false');
    tabResume?.setAttribute('aria-selected', 'true');
    if (servicesSec) servicesSec.style.display = 'none';
    if (pageWrap) pageWrap.classList.add('resume-expanded');
    
    // Initialize & sync
    if (typeof initResumeAssistantOnce === 'function') initResumeAssistantOnce();
    if (typeof syncApplicantDataToResume === 'function') syncApplicantDataToResume();
    if (typeof updateResumePreview === 'function') updateResumePreview();
    
    const card = document.querySelector('.card');
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  } else {
    if (panelTrack) panelTrack.hidden = true;
    if (panelResume) panelResume.hidden = true;
    if (panelReg) panelReg.hidden = false;
    tabTrack?.classList.remove('tab--active');
    tabResume?.classList.remove('tab--active');
    tabReg?.classList.add('tab--active');
    tabTrack?.setAttribute('aria-selected', 'false');
    tabResume?.setAttribute('aria-selected', 'false');
    tabReg?.setAttribute('aria-selected', 'true');
    if (servicesSec) servicesSec.style.display = 'block';
    if (pageWrap) pageWrap.classList.remove('resume-expanded');
    // Reset tracker when going back to reg
    resetTracker();
  }
}

function resetTracker() {
  const ref    = document.getElementById('trackRef');
  const email  = document.getElementById('trackEmail');
  const msg    = document.getElementById('trackMsg');
  const result = document.getElementById('trackResult');
  if (ref)    ref.value = '';
  if (email)  email.value = '';
  if (msg)    msg.style.display = 'none';
  if (result) result.style.display = 'none';
}

// ── Password visibility toggle ───────────────────────────────
function togglePw(inputId, iconId) {
  const inp = document.getElementById(inputId);
  const ico = document.getElementById(iconId);
  if (!inp || !ico) return;
  inp.type = inp.type === 'password' ? 'text' : 'password';
  ico.className = inp.type === 'text' ? 'fas fa-eye-slash' : 'fas fa-eye';
}

// ── CV file handler ──────────────────────────────────────────
function handleCvFile(input) {
  if (input.files && input.files[0]) showCvFile(input.files[0]);
}
function showCvFile(file) {
  const ok = ['application/pdf','application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  if (!ok.includes(file.type)) { alert('Please upload PDF, DOC or DOCX.'); return; }
  if (file.size > 5 * 1024 * 1024) { alert('File must be under 5 MB.'); return; }
  const nameEl = document.getElementById('cvFileName');
  const rowEl  = document.getElementById('cvName');
  if (nameEl) nameEl.textContent = file.name;
  if (rowEl)  rowEl.style.display = 'block';
}

// ── Success overlay ───────────────────────────────────────────
function closeSuccess() {
  const ov = document.getElementById('successOverlay');
  if (ov) ov.style.display = 'none';
}

// ── Nurse Qualification Panel toggle ─────────────────────────
function toggleQualPanel() {
  const panel   = document.getElementById('qualPanel');
  const chevron = document.getElementById('qualChevron');
  const btn     = document.getElementById('qualToggleBtn');
  if (!panel) return;
  const isOpen = panel.style.display !== 'none';
  panel.style.display  = isOpen ? 'none' : 'block';
  if (chevron) chevron.style.transform = isOpen ? '' : 'rotate(180deg)';
  if (btn) btn.classList.toggle('qual-toggle--open', !isOpen);
}

// ── Shake helper ─────────────────────────────────────────────
function shake(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.borderColor = '#ef5350';
  el.focus && el.focus();
  setTimeout(() => { el.style.borderColor = ''; }, 1500);
}

// ── Application Tracker ──────────────────────────────────────
async function trackApplication() {
  const ref    = (document.getElementById('trackRef')?.value   || '').trim();
  const email  = (document.getElementById('trackEmail')?.value || '').trim();
  const msgEl  = document.getElementById('trackMsg');
  const resEl  = document.getElementById('trackResult');
  const btn    = document.getElementById('btnTrack');

  if (!ref && !email) {
    showTrackMsg('error', '<i class="fas fa-triangle-exclamation"></i> Please enter a reference number or email.');
    if (resEl) resEl.style.display = 'none';
    return;
  }

  showTrackMsg('loading', '<i class="fas fa-circle-notch fa-spin"></i>&nbsp; Fetching your application status…');
  if (resEl) resEl.style.display = 'none';
  if (btn)  { btn.disabled = true; btn.style.opacity = '.65'; }

  const base = (typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : '');

  try {
    const res  = await fetch(base + '/api/track', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ ref, email }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      showTrackMsg('error', '<i class="fas fa-circle-exclamation"></i> ' + (err.error || 'Server error. Please try again.'));
      return;
    }

    const data = await res.json();
    if (msgEl) msgEl.style.display = 'none';

    if (!data.found) {
      showTrackMsg('error', '<i class="fas fa-triangle-exclamation"></i> No application found with those details.');
      return;
    }

    renderProgress(data);

  } catch (err) {
    console.error('Tracker error:', err);
    showTrackMsg('error', '<i class="fas fa-wifi"></i> Cannot reach the server. Please try again in a moment.');
  } finally {
    if (btn) { btn.disabled = false; btn.style.opacity = ''; }
  }
}

function showTrackMsg(type, html) {
  const el = document.getElementById('trackMsg');
  if (!el) return;
  el.className = type === 'loading' ? 'msg-loading' : 'msg-error';
  el.innerHTML = html;
  el.style.display = 'block';
}

function renderProgress(data) {
  // Avatar
  const names    = (data.name || '').split(' ');
  const initials = ((names[0]||'')[0]||'') + ((names[1]||'')[0]||'');
  const avatarEl = document.getElementById('resultAvatar');
  if (avatarEl) avatarEl.textContent = initials.toUpperCase();

  // Name & pills
  const nameEl  = document.getElementById('resultName');
  const refEl   = document.getElementById('resultRef');
  const batchEl = document.getElementById('resultBatch');
  if (nameEl)  nameEl.textContent  = data.name  || '';
  if (refEl)   refEl.textContent   = data.ref   || '';
  if (batchEl) batchEl.textContent = data.batchCode || 'N/A';

  // Status badge
  const sb = document.getElementById('resultStatus');
  if (sb) {
    const map = {
      Approved: { cls:'sb-approved', icon:'fa-circle-check',  label:'Approved' },
      Rejected: { cls:'sb-rejected', icon:'fa-circle-xmark',  label:'Rejected' },
      Pending:  { cls:'sb-pending',  icon:'fa-clock',         label:'In Review' },
    };
    const st = map[data.status] || map.Pending;
    sb.className = 'status-badge ' + st.cls;
    sb.innerHTML = `<i class="fas ${st.icon}"></i>${st.label}`;
  }

  // Timeline
  const tl = document.getElementById('timeline');
  if (tl) {
    tl.innerHTML = '';
    const isFinal = data.status === 'Approved' || data.status === 'Rejected';

    STAGES.forEach((stage, i) => {
      const done    = i < data.currentStep || (i === STAGES.length - 1 && isFinal);
      const current = i === data.currentStep && !isFinal;

      const dotCls   = done ? 'dot-done'    : current ? 'dot-current'    : 'dot-wait';
      const stepCls  = done ? 'done'        : current ? 'current'        : '';
      const lblCls   = done ? 'label-done'  : current ? 'label-current'  : 'label-wait';
      const dscCls   = done ? 'desc-done'   : current ? 'desc-current'   : 'desc-wait';
      const badgeCls = done ? 'badge-done'  : current ? 'badge-current'  : 'badge-wait';
      const badgeTxt = done ? 'Completed'   : current ? 'In Progress'    : 'Pending';
      const badgeIco = done ? 'fa-check'    : current ? 'fa-circle-dot'  : 'fa-circle';
      const dotIco   = done ? 'fa-check'    : stage.icon;

      tl.innerHTML += `
        <div class="tl-step ${stepCls}">
          <div class="tl-left">
            <div class="tl-dot ${dotCls}"><i class="fas ${dotIco}"></i></div>
          </div>
          <div class="tl-body">
            <div class="tl-label ${lblCls}">${stage.label}</div>
            <div class="tl-desc  ${dscCls}">${stage.desc}</div>
            <span class="tl-badge ${badgeCls}"><i class="fas ${badgeIco}"></i>${badgeTxt}</span>
          </div>
        </div>`;
    });
  }

  // Note
  const noteEl = document.getElementById('resultNote');
  if (noteEl) {
    if (data.note) {
      noteEl.innerHTML = `<i class="fas fa-circle-info"></i>${data.note}`;
      noteEl.style.display = 'block';
    } else {
      noteEl.style.display = 'none';
    }
  }

  // Show result card
  const resEl = document.getElementById('trackResult');
  if (resEl) resEl.style.display = 'block';
}

// ── DOMContentLoaded init ─────────────────────────────────────
// Toast Notification System
function showToast(message, type = 'error') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const msg = document.createElement('div');
  msg.className = `toast-msg ${type}`;
  msg.innerHTML = type === 'error' 
    ? `<i class="fas fa-exclamation-circle"></i> ${message}`
    : `<i class="fas fa-check-circle"></i> ${message}`;
  
  container.appendChild(msg);
  setTimeout(() => {
    msg.classList.add('fadeOut');
    setTimeout(() => msg.remove(), 300);
  }, 5000);
}

document.addEventListener('DOMContentLoaded', function () {
  // Check URL tab parameter on page load
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('tab') === 'resume') {
    showPanel('resume');
  } else if (urlParams.get('tab') === 'track') {
    showPanel('track');
  }


  // 1. Phone input
  const phoneEl = document.getElementById('phone');
  if (phoneEl) {
    iti = window.intlTelInput(phoneEl, {
      initialCountry: 'auto',
      dropdownContainer: document.body,
      geoIpLookup: cb => {
        fetch('https://api.country.is')
          .then(r => r.json())
          .then(d => cb(d.country.toLowerCase()))
          .catch(() => cb('us'));
      },
      utilsScript: 'https://cdn.jsdelivr.net/npm/intl-tel-input@23.0.10/build/js/utils.js',
    });
  }

  // 2. Flatpickr date picker
  const dobEl = document.getElementById('dob');
  if (dobEl) {
    flatpickr(dobEl, {
      altInput: true, altFormat: 'F j, Y',
      dateFormat: 'Y-m-d', maxDate: 'today',
      theme: 'dark', disableMobile: true,
    });
  }

  // 3. Password strength meter
  const pwEl   = document.getElementById('password');
  const meterEl = document.getElementById('pwMeter');
  const textEl  = document.getElementById('pwText');
  if (pwEl && meterEl && textEl) {
    pwEl.addEventListener('input', () => {
      const v = pwEl.value;
      let s = 0;
      if (v.length >= 8) s++;
      if (v.match(/[a-z]/) && v.match(/[A-Z]/)) s++;
      if (v.match(/\d/)) s++;
      if (v.match(/[^a-zA-Z\d]/)) s++;
      const colors = ['#ef5350','#ff9800','#ffeb3b','#8bc34a','#4caf50'];
      const labels = ['Too weak','Weak','Fair','Good','Strong'];
      if (!v.length) { meterEl.style.width = '0'; textEl.textContent = ''; return; }
      meterEl.style.width   = (s + 1) * 20 + '%';
      meterEl.style.background = colors[s];
      textEl.textContent = 'Strength: ' + labels[s];
      // Hide hint once strength is Good (3) or Strong (4)
      const pwHint = document.getElementById('pwHint');
      if (pwHint) pwHint.style.display = s >= 3 ? 'none' : 'block';
    });
  }

  // 4. Password match indicator
  const cpwEl = document.getElementById('confirmPw');
  if (cpwEl && pwEl) {
    cpwEl.addEventListener('input', () => {
      if (!cpwEl.value) { cpwEl.style.borderColor = ''; return; }
      cpwEl.style.borderColor = cpwEl.value === pwEl.value ? '#4caf50' : '#ef5350';
    });
  }

  // 4b. Inline email validation on blur / input
  const emailEl = document.getElementById('email');
  const emailErrEl = document.getElementById('emailError');
  if (emailEl && emailErrEl) {
    const isValidEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
    emailEl.addEventListener('blur', () => {
      if (emailEl.value && !isValidEmail(emailEl.value)) {
        emailErrEl.style.display = 'block';
        emailEl.style.borderColor = '#ef5350';
      }
    });
    emailEl.addEventListener('input', () => {
      if (isValidEmail(emailEl.value)) {
        emailErrEl.style.display = 'none';
        emailEl.style.borderColor = '#4caf50';
      } else {
        emailErrEl.style.display = 'none'; // only show on blur
        emailEl.style.borderColor = '';
      }
    });
  }

  // 5. Profession buttons + nurse qual section toggle
  const profBtns = document.querySelectorAll('.prof-btn');
  const nurseQualSection = document.getElementById('nurseQualSection');
  profBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      profBtns.forEach(b => b.classList.remove('prof-btn--active'));
      btn.classList.add('prof-btn--active');
      selectedProf = btn.dataset.prof || 'nurse';
      // Show qualification section for all professions
      if (nurseQualSection) {
        nurseQualSection.style.display = 'block';
      }
      
      // Auto-advance to Step 2
      setTimeout(() => {
        nextStep(1);
      }, 250);
    });
  });
  // Show by default since nurse is pre-selected
  if (nurseQualSection) nurseQualSection.style.display = 'block';

  // 6. CV drop zone
  const cvDrop = document.getElementById('cvDrop');
  if (cvDrop) {
    cvDrop.addEventListener('dragover', e => { e.preventDefault(); cvDrop.classList.add('drag-over'); });
    cvDrop.addEventListener('dragleave', () => cvDrop.classList.remove('drag-over'));
    cvDrop.addEventListener('drop', e => {
      e.preventDefault();
      cvDrop.classList.remove('drag-over');
      const f = e.dataTransfer.files[0];
      if (f) showCvFile(f);
    });
  }

  // 7. Registration form submit
  const regForm = document.getElementById('regForm');
  if (regForm) {
    regForm.addEventListener('submit', async function (e) {
      e.preventDefault();

      const first = document.getElementById('firstName')?.value.trim() || '';
      const last  = document.getElementById('lastName')?.value.trim()  || '';
      const email = document.getElementById('email')?.value.trim()     || '';
      const pw    = document.getElementById('password')?.value         || '';
      const cpw   = document.getElementById('confirmPw')?.value        || '';
      const terms = document.getElementById('terms')?.checked;
      const cvFileEl = document.getElementById('cvFile');

      if (!validateStep(4)) { return; }
      if (!cvFileEl || !cvFileEl.files || !cvFileEl.files[0]) {
        showToast('Please upload your CV / Resume.', 'error');
        shake('cvDrop');
        return;
      }
      if (!first || !last) { showToast('Please enter your first and last name.', 'error'); shake('firstName'); return; }
      if (!email.includes('@')) { showToast('Please enter a valid email.', 'error'); shake('email'); return; }

      if (iti) {
        if (!iti.isValidNumber()) { showToast('Please enter a valid phone number.', 'error'); shake('phone'); return; }
      }

      let pwStr = 0;
      if (pw.length >= 8) pwStr++;
      if (pw.match(/[a-z]/) && pw.match(/[A-Z]/)) pwStr++;
      if (pw.match(/\d/)) pwStr++;
      if (pw.match(/[^a-zA-Z\d]/)) pwStr++;
      if (pwStr < 3) { showToast('Please use a stronger password (uppercase, lowercase, number, symbol).', 'error'); shake('password'); return; }
      if (pw !== cpw) { showToast('Passwords do not match.', 'error'); shake('confirmPw'); return; }
      if (!terms) { showToast('Please agree to the Terms & Conditions.', 'error'); return; }

      // Qualification assessment is required
      {
        const qualPanel = document.getElementById('qualPanel');
        const declBoxes = document.querySelectorAll('input[name="decl"]');
        const allDeclChecked = Array.from(declBoxes).every(cb => cb.checked);
        if (!allDeclChecked) {
          // Open the panel so user can see what needs to be done
          if (qualPanel && qualPanel.style.display === 'none') toggleQualPanel();
          const qualSection = document.getElementById('nurseQualSection');
          if (qualSection) {
            qualSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
            qualSection.style.outline = '2px solid #f43f5e';
            setTimeout(() => { qualSection.style.outline = ''; }, 2000);
          }
          showToast('Please complete the Professional Qualification Assessment and tick all declaration checkboxes.', 'error');
          return;
        }
      }

      // ── OTP + Fee Alert Flow ──────────────────────────────────────────────
      // Store validated form data, show Fee modal first
      let pendingFormData = null;
      let otpTimerInterval = null;

      function buildFormData() {
        const fd = new FormData();
        fd.append('firstName',     first.replace(/[<>]/g, '').slice(0, 60));
        fd.append('lastName',      last.replace(/[<>]/g, '').slice(0, 60));
        fd.append('email',         email.toLowerCase().trim());
        fd.append('phone',         iti ? iti.getNumber() : document.getElementById('phone')?.value || '');
        fd.append('dob',           document.getElementById('dob')?.value || '');
        fd.append('gender',        document.querySelector('[name=gender]:checked')?.value || '');
        fd.append('profession',    selectedProf);
        fd.append('experience',    document.getElementById('experience')?.value || '');
        fd.append('country',       iti ? iti.getSelectedCountryData().name : '');
        fd.append('qualification', document.getElementById('qualification')?.value || '');
        fd.append('bio',           (document.getElementById('bio')?.value || '').replace(/[<>]/g, '').slice(0, 1000));
        fd.append('password',      pw);
        const cvFile = document.getElementById('cvFile');
        if (cvFile?.files[0]) fd.append('cvFile', cvFile.files[0]);
        const getChecked = name => Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map(cb => cb.value);
        getChecked('dest').forEach(v    => fd.append('destinations',     v));
        getChecked('english').forEach(v => fd.append('englishQuals',     v));
        getChecked('reg').forEach(v     => fd.append('professionalRegs', v));
        getChecked('german').forEach(v  => fd.append('germanLevel',      v));
        getChecked('docs').forEach(v    => fd.append('docsAvailable',    v));
        getChecked('decl').forEach(v    => fd.append('qualDeclarations', v));
        const destOther = (document.getElementById('destOtherText')?.value || '').trim().slice(0, 100);
        if (destOther) fd.append('destOther', destOther);
        return fd;
      }

      function startOtpTimer() {
        let seconds = 60;
        const timerEl = document.getElementById('otpTimer');
        const resendBtn = document.getElementById('btnResendOtp');
        if (resendBtn) resendBtn.disabled = true;
        clearInterval(otpTimerInterval);
        otpTimerInterval = setInterval(() => {
          seconds--;
          if (timerEl) timerEl.textContent = seconds;
          if (seconds <= 0) {
            clearInterval(otpTimerInterval);
            if (resendBtn) { resendBtn.disabled = false; resendBtn.innerHTML = 'Resend Code'; }
          }
        }, 1000);
      }

      async function sendOtp() {
        const base = (typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : '');
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 seconds
        
        try {
          const otpRes = await fetch(base + '/api/verify/send-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email.toLowerCase().trim() }),
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          const otpData = await otpRes.json();
          if (!otpRes.ok) { showToast(otpData.error || 'Failed to send OTP.', 'error'); return false; }
          return true;
        } catch (err) {
          clearTimeout(timeoutId);
          showToast(err.name === 'AbortError' ? 'Request timed out. Please check your internet connection.' : 'Failed to send OTP. Please try again.', 'error');
          return false;
        }
      }

      // Step 1: Show Fee Modal
      pendingFormData = buildFormData();
      document.getElementById('feeModal').style.display = 'flex';

      document.getElementById('btnCancelFee').onclick = () => {
        document.getElementById('feeModal').style.display = 'none';
      };
      document.getElementById('closeFeeModal').onclick = () => {
        document.getElementById('feeModal').style.display = 'none';
      };

      // Step 2: On Accept → send OTP and show OTP modal
      document.getElementById('btnAcceptFee').onclick = async () => {
        document.getElementById('feeModal').style.display = 'none';
        const btn = document.getElementById('submitBtn');
        if (btn) { btn.disabled = true; btn.querySelector('span').innerHTML = '<i class="fas fa-circle-notch fa-spin"></i>&nbsp;&nbsp;Sending Code…'; }

        const sent = await sendOtp();
        if (!sent) {
          if (btn) { btn.disabled = false; btn.querySelector('span').innerHTML = '<i class="fas fa-paper-plane"></i>&nbsp;&nbsp;Submit Application'; }
          return;
        }

        if (btn) { btn.disabled = false; btn.querySelector('span').innerHTML = '<i class="fas fa-paper-plane"></i>&nbsp;&nbsp;Submit Application'; }

        // Show OTP modal
        const otpEmailDisplay = document.getElementById('otpEmailDisplay');
        if (otpEmailDisplay) otpEmailDisplay.textContent = email.toLowerCase().trim();
        document.getElementById('otpInput').value = '';
        document.getElementById('otpModal').style.display = 'flex';
        startOtpTimer();
      };

      document.getElementById('closeOtpModal').onclick = () => {
        document.getElementById('otpModal').style.display = 'none';
        clearInterval(otpTimerInterval);
      };

      document.getElementById('btnResendOtp').onclick = async () => {
        document.getElementById('btnResendOtp').disabled = true;
        const sent = await sendOtp();
        if (sent) { showToast('A new code has been sent!', 'success'); startOtpTimer(); }
      };

      // Step 3: Verify OTP and submit application
      document.getElementById('btnVerifyOtp').onclick = async () => {
        const enteredOtp = (document.getElementById('otpInput')?.value || '').trim();
        if (enteredOtp.length !== 6) { showToast('Please enter the 6-digit code from your email.', 'error'); return; }

        const verifyBtn = document.getElementById('btnVerifyOtp');
        if (verifyBtn) { verifyBtn.disabled = true; verifyBtn.textContent = 'Verifying…'; }

        try {
          pendingFormData.append('otp', enteredOtp);
          const base = (typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : '');
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 seconds
          
          const res  = await fetch(base + '/api/register', { 
            method: 'POST', 
            body: pendingFormData,
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          const data = await res.json();

          if (!res.ok) {
            showToast(data.error || 'Registration failed.', 'error');
            pendingFormData.delete('otp'); // Allow retry with different OTP
            return;
          }

          // Show success
          document.getElementById('otpModal').style.display = 'none';
          clearInterval(otpTimerInterval);
          document.getElementById('successName').textContent  = first;
          document.getElementById('successRef').textContent   = data.refNumber;
          document.getElementById('successBatch').textContent = data.batchCode;
          document.getElementById('successOverlay').style.display = 'flex';
          
          if (typeof confetti === 'function') {
            confetti({
              particleCount: 150,
              spread: 80,
              origin: { y: 0.6 },
              colors: ['#42a5f5', '#4ade80', '#fbbf24']
            });
          }

        } catch (err) {
          showToast(err.name === 'AbortError' ? 'The server took too long to respond. Please check your connection.' : (err.message || 'An error occurred. Please try again.'), 'error');
        } finally {
          if (verifyBtn) { verifyBtn.disabled = false; verifyBtn.textContent = 'Verify & Submit'; }
        }
      };
    }); // end form submit
  } // end if(regForm)

  // 8. Enter key on tracker inputs
  ['trackRef','trackEmail'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') trackApplication(); });
  });

  // 9. Draft Save / Restore Progress
  function initDraftSave() {
    const form = document.getElementById('regForm');
    if (!form) return;
    const inputs = form.querySelectorAll('input, select, textarea');
    const DRAFT_KEY = 'cosnurses_draft';
    
    // Restore
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        inputs.forEach(input => {
          if (['password', 'file'].includes(input.type) || input.id === 'confirmPw' || input.id === 'terms') return;
          if (input.type === 'checkbox' || input.type === 'radio') {
            if (data[input.name] && Array.isArray(data[input.name])) {
              input.checked = data[input.name].includes(input.value);
            } else if (data[input.name] === input.value) {
              input.checked = true;
            }
          } else {
            if (data[input.id || input.name]) input.value = data[input.id || input.name];
          }
        });
      } catch (e) { console.error('Failed to parse draft', e); }
    }

    // Save on change
    form.addEventListener('change', () => {
      const data = {};
      inputs.forEach(input => {
        if (['password', 'file'].includes(input.type) || input.id === 'confirmPw' || input.id === 'terms') return;
        if (input.type === 'checkbox' || input.type === 'radio') {
          if (input.checked) {
            if (!data[input.name]) data[input.name] = [];
            data[input.name].push(input.value);
          }
        } else {
          data[input.id || input.name] = input.value;
        }
      });
      localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
    });
  }
  initDraftSave();

  // ── Drag and Drop CV ──
  const cvDropZone = document.getElementById('cvDrop');
  const cvFile = document.getElementById('cvFile');
  if (cvDropZone && cvFile) {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      cvDropZone.addEventListener(eventName, preventDefaults, false);
    });
    function preventDefaults(e) { e.preventDefault(); e.stopPropagation(); }
    
    ['dragenter', 'dragover'].forEach(eventName => {
      cvDropZone.addEventListener(eventName, () => cvDropZone.style.borderColor = '#60a5fa', false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
      cvDropZone.addEventListener(eventName, () => cvDropZone.style.borderColor = 'rgba(255,255,255,0.2)', false);
    });
    
    cvDropZone.addEventListener('drop', e => {
      let dt = e.dataTransfer;
      let files = dt.files;
      if (files && files.length > 0) {
        cvFile.files = files; // Assign files to the input
        handleCvFile(cvFile);
      }
    }, false);
  }

  // ── Load & Display Profession Spots from Settings ──────────────────────
  async function loadProfessionSpots() {
    try {
      const base = (typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : '');
      const res = await fetch(base + '/api/settings');
      if (!res.ok) return;
      const cfg = await res.json();
      const spots = cfg.professionSpots || {};
      document.querySelectorAll('.prof-btn').forEach(btn => {
        const prof = btn.dataset.prof;
        if (!prof || !(prof in spots)) return;
        const count = parseInt(spots[prof], 10);
        // Remove existing badge if any
        const existing = btn.querySelector('.prof-spots-badge');
        if (existing) existing.remove();
        const badge = document.createElement('span');
        badge.className = 'prof-spots-badge' + (count > 5 ? ' spots-open' : count > 0 ? ' spots-low' : '');
        badge.textContent = count > 0 ? `${count} spot${count !== 1 ? 's' : ''}` : 'Full';
        btn.appendChild(badge);
        if (count === 0) btn.style.opacity = '0.55';
      });
    } catch { /* silent — spots are optional */ }
  }
  loadProfessionSpots();

}); // end DOMContentLoaded


/* =========================================================
   RESUME BUILD ASSISTANT LOGIC
   ========================================================= */

let resumeInitialized = false;
let resumeActiveSkills = new Set();
let resumeJobCounter = 0;
let resumeCurrentTheme = 'sapphire';

const RA_SKILL_PRESETS = {
  nurse: [
    'Patient Assessment', 'Medication Administration', 'IV Cannulation', 
    'Infection Control', 'Wound Care & Dressing', 'Emergency BLS/CPR', 
    'Vital Signs Monitoring', 'Electronic Health Records (EHR)', 'Patient Advocacy',
    'Post-Operative Care', 'Triage Protocol', 'Clinical Documentation'
  ],
  caregiver: [
    'Elderly Care', 'ADLs Assistance', 'Dementia & Alzheimer Support', 
    'Patient Mobility & Transfer', 'Medication Prompting', 'Meal Preparation', 
    'Vital Signs Observation', 'Fall Prevention', 'First Aid / CPR',
    'Companionship', 'Hygiene & Bed Bathing', 'Palliative Care Support'
  ],
  trade: [
    'MIG / TIG / Arc Welding', 'Pipe Fitting & Alignment', 'Blueprint Reading', 
    'OSHA Safety Compliance', 'Metal Fabrication', 'Structural Assembly', 
    'Quality & Weld Inspection', 'Power Tools Handling', 'Equipment Maintenance', 
    'Hydraulics & Pneumatics', 'Electrical Wiring', 'Site Safety Auditing'
  ],
  driver: [
    'Heavy Vehicle Operation (Class A/CE)', 'Defensive Driving', 'Route Planning & GPS', 
    'Cargo Securing & Lashing', 'Pre-Trip Vehicle Inspections', 'Logbook Maintenance', 
    'Hazardous Materials (ADR)', 'Customer Service', 'Emergency Roadside Repairs'
  ]
};

function initResumeAssistantOnce() {
  if (resumeInitialized) return;
  resumeInitialized = true;

  // Render default skills chips
  renderSkillSuggestions('nurse');

  // Check if draft exists in localStorage
  const saved = localStorage.getItem('gjc_resume_draft');
  if (saved) {
    try {
      const data = JSON.parse(saved);
      loadResumeDataIntoForm(data);
      return;
    } catch (e) {
      console.warn('Failed to parse saved resume draft:', e);
    }
  }

  // Otherwise, load default registered nurse sample
  loadResumeSample('nurse');
}

// ── Skills Management ──
function renderSkillSuggestions(category = 'nurse') {
  const container = document.getElementById('raSkillSuggestions');
  if (!container) return;
  const list = RA_SKILL_PRESETS[category] || RA_SKILL_PRESETS.nurse;
  container.innerHTML = list.map(skill => `
    <button type="button" class="ra-chip" onclick="addResumeSkill('${skill.replace(/'/g, "\\'")}')">
      <i class="fas fa-plus" style="font-size:0.65rem;color:#42a5f5;"></i> ${skill}
    </button>
  `).join('');
}

function addResumeSkill(skill) {
  if (!skill || !skill.trim()) return;
  const trimmed = skill.trim();
  resumeActiveSkills.add(trimmed);
  renderActiveSkills();
  updateResumePreview();
}

function removeResumeSkill(skill) {
  resumeActiveSkills.delete(skill);
  renderActiveSkills();
  updateResumePreview();
}

function renderActiveSkills() {
  const container = document.getElementById('raActiveSkillsList');
  if (!container) return;
  if (resumeActiveSkills.size === 0) {
    container.innerHTML = '<span style="font-size:0.75rem;color:rgba(255,255,255,0.4);">No skills added yet. Click suggestions above or type your own.</span>';
    return;
  }
  container.innerHTML = Array.from(resumeActiveSkills).map(s => `
    <span class="ra-active-tag">
      ${s}
      <button type="button" onclick="removeResumeSkill('${s.replace(/'/g, "\\'")}')" title="Remove skill">&times;</button>
    </span>
  `).join('');
}

function addCustomSkill() {
  const input = document.getElementById('raCustomSkillInput');
  if (!input || !input.value.trim()) return;
  addResumeSkill(input.value.trim());
  input.value = '';
}

// ── Work Experience Repeater ──
function addExperienceItem(data = null) {
  resumeJobCounter++;
  const container = document.getElementById('raExperienceContainer');
  if (!container) return;

  const card = document.createElement('div');
  card.className = 'ra-job-card';
  card.id = 'raJob_' + resumeJobCounter;

  const title   = data?.title || '';
  const company = data?.company || '';
  const city    = data?.city || '';
  const dates   = data?.dates || '';
  const bullets = data?.bullets || '';

  card.innerHTML = `
    <div class="ra-job-header">
      <span class="ra-job-tag"><i class="fas fa-briefcase"></i> Position #${resumeJobCounter}</span>
      <button type="button" class="ra-btn-remove" onclick="removeExperienceItem('raJob_${resumeJobCounter}')">
        <i class="fas fa-trash"></i> Remove
      </button>
    </div>
    
    <div class="ra-form-row">
      <div class="field">
        <label>Job Title / Role</label>
        <div class="input-wrap">
          <i class="fas fa-user-tag"></i>
          <input type="text" class="ra-job-title" placeholder="e.g. Staff Nurse / Ward Caregiver" value="${title.replace(/"/g, '&quot;')}" oninput="updateResumePreview()">
        </div>
      </div>
      <div class="field">
        <label>Employer / Hospital / Facility</label>
        <div class="input-wrap">
          <i class="fas fa-hospital"></i>
          <input type="text" class="ra-job-company" placeholder="e.g. Metropolitan General Hospital" value="${company.replace(/"/g, '&quot;')}" oninput="updateResumePreview()">
        </div>
      </div>
    </div>

    <div class="ra-form-row">
      <div class="field">
        <label>City &amp; Country</label>
        <div class="input-wrap">
          <i class="fas fa-map-pin"></i>
          <input type="text" class="ra-job-city" placeholder="e.g. Nairobi, Kenya" value="${city.replace(/"/g, '&quot;')}" oninput="updateResumePreview()">
        </div>
      </div>
      <div class="field">
        <label>Employment Dates</label>
        <div class="input-wrap">
          <i class="fas fa-calendar-days"></i>
          <input type="text" class="ra-job-dates" placeholder="e.g. 2021 – Present" value="${dates.replace(/"/g, '&quot;')}" oninput="updateResumePreview()">
        </div>
      </div>
    </div>

    <div class="field" style="margin-bottom:0;">
      <label>Key Responsibilities &amp; Achievements (Bullet Points)</label>
      <textarea class="ra-textarea ra-job-bullets" rows="3" placeholder="• Administered medications and maintained patient charts...&#10;• Collaborated with physicians on personalized care plans..." oninput="updateResumePreview()">${bullets}</textarea>
      
      <div class="ra-bullet-helpers">
        <span style="font-size:0.7rem;color:rgba(255,255,255,0.5);">Quick bullet templates:</span>
        <button type="button" class="ra-bullet-pill" onclick="insertJobBullet(this, 'Administered prescribed medications, IV infusions, and recorded patient vitals following clinical safety standards.')">+ Clinical Care</button>
        <button type="button" class="ra-bullet-pill" onclick="insertJobBullet(this, 'Assisted residents with mobility, personal hygiene, and daily living activities with empathy and dignity.')">+ Eldercare</button>
        <button type="button" class="ra-bullet-pill" onclick="insertJobBullet(this, 'Ensured 100% compliance with infection prevention protocols and hospital safety standards.')">+ Safety / Infection</button>
      </div>
    </div>
  `;

  container.appendChild(card);
  updateResumePreview();
}

function removeExperienceItem(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
  updateResumePreview();
}

function insertJobBullet(btn, text) {
  const card = btn.closest('.ra-job-card');
  if (!card) return;
  const textarea = card.querySelector('.ra-job-bullets');
  if (!textarea) return;
  if (textarea.value.trim().length > 0) {
    textarea.value = textarea.value.trim() + '\n• ' + text;
  } else {
    textarea.value = '• ' + text;
  }
  updateResumePreview();
}

// ── AI Professional Summary Helpers ──
const AI_SUMMARIES = {
  nurse: "Dedicated and compassionate Registered Nurse with 5+ years of clinical and acute ward experience. Proven expertise in emergency triage, patient vital monitoring, IV therapy, and compassionate bedside care. Highly adaptable to international healthcare environments, with in-depth knowledge of NHS / international clinical governance protocols. Fully registered with valid credentials, seeking international placement in the UK, USA, or Canada.",
  caregiver: "Compassionate and certified Senior Healthcare Assistant / Caregiver with over 4 years of hands-on experience delivering high-quality eldercare, assisted living support, and dementia management. Skilled in assisting with activities of daily living (ADLs), medication prompting, patient mobility, and nutritional meal planning. Possesses strong emotional intelligence, patience, and full readiness for overseas relocation.",
  trade: "Experienced and safety-conscious Skilled Trades Professional with 6+ years of field expertise on commercial construction, industrial fabrication, and maintenance operations. Skilled in blueprint interpretation, precision equipment operation, and stringent OSHA/ISO safety compliance. Holds certified technical credentials, proven teamwork abilities, and active passport for international employer sponsorship.",
  driver: "Reliable and safety-certified Heavy Commercial Driver with 7+ years of international logistics, long-haul freight, and distribution experience. Demonstrated flawless safety record, expert route optimization, and rigorous pre-trip inspection standards. Ready for international skilled relocation with clean driving history and immediate passport availability."
};

function applyAiSummary(type) {
  const summaryEl = document.getElementById('raSummary');
  if (!summaryEl) return;
  const text = AI_SUMMARIES[type] || AI_SUMMARIES.nurse;
  summaryEl.value = text;
  renderSkillSuggestions(type === 'trade' ? 'trade' : type === 'caregiver' ? 'caregiver' : type === 'driver' ? 'driver' : 'nurse');
  updateResumePreview();
  showToast(`Generated professional ${type} summary!`, 'success');
}

// ── Theme Switcher ──
function setResumeTheme(theme) {
  resumeCurrentTheme = theme;
  const doc = document.getElementById('resumeDocument');
  if (doc) {
    doc.className = `resume-sheet theme-${theme}`;
  }
  document.querySelectorAll('.ra-theme-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === theme);
  });
}

// ── Mobile Tabs ──
function switchResumeMobileTab(tab) {
  const editorCol = document.getElementById('raEditorCol');
  const previewCol = document.getElementById('raPreviewCol');
  const btnEdit = document.getElementById('raBtnEditView');
  const btnPreview = document.getElementById('raBtnPreviewView');

  if (tab === 'preview') {
    editorCol?.classList.add('mob-hidden');
    previewCol?.classList.remove('mob-hidden');
    btnEdit?.classList.remove('active');
    btnPreview?.classList.add('active');
  } else {
    previewCol?.classList.add('mob-hidden');
    editorCol?.classList.remove('mob-hidden');
    btnPreview?.classList.remove('active');
    btnEdit?.classList.add('active');
  }
}

// ── Sync with main registration form ──
function syncApplicantDataToResume() {
  const firstName = document.getElementById('firstName')?.value.trim();
  const lastName  = document.getElementById('lastName')?.value.trim();
  const email     = document.getElementById('email')?.value.trim();
  const phoneVal  = (typeof iti !== 'undefined' && iti && iti.getNumber) ? iti.getNumber() : document.getElementById('phone')?.value.trim();
  const qual      = document.getElementById('qualification')?.value.trim();
  const bio       = document.getElementById('bio')?.value.trim();

  const raName = document.getElementById('raName');
  if (raName && !raName.value.trim() && (firstName || lastName)) {
    raName.value = `${firstName || ''} ${lastName || ''}`.trim();
  }
  const raEmail = document.getElementById('raEmail');
  if (raEmail && !raEmail.value.trim() && email) {
    raEmail.value = email;
  }
  const raPhone = document.getElementById('raPhone');
  if (raPhone && !raPhone.value.trim() && phoneVal) {
    raPhone.value = phoneVal;
  }
  const raDegree = document.getElementById('raDegree');
  if (raDegree && !raDegree.value.trim() && qual) {
    raDegree.value = qual;
  }
  const raSummary = document.getElementById('raSummary');
  if (raSummary && !raSummary.value.trim() && bio) {
    raSummary.value = bio;
  }

  // Smart profession alignment if title is empty
  const raTitle = document.getElementById('raTitle');
  if (raTitle && !raTitle.value.trim() && typeof selectedProf !== 'undefined') {
    const profTitles = {
      nurse: 'Registered General Nurse (BSN, RN) — Ward & Acute Care',
      caregiver: 'Senior Healthcare Assistant & Certified Eldercare Specialist',
      construction: 'Experienced Construction Supervisor & Skilled Tradesperson',
      welder: 'Certified Industrial Welder & Metal Fabricator (SMAW / GMAW / GTAW)',
      electrician: 'Licensed Industrial & Commercial Electrician',
      plumber: 'Certified Plumbing & Pipefitting Specialist',
      truck: 'Heavy Commercial Vehicle & Long-Haul Transport Driver',
      storekeeper: 'Warehouse Inventory & Logistics Storekeeper',
      massage_therapist: 'Licensed Remedial & Therapeutic Massage Practitioner',
      occupational_therapist: 'Registered Clinical Occupational Therapist',
      social_worker: 'Certified Community & Healthcare Social Worker',
      pharmacist: 'Licensed Clinical Pharmacist (B.Pharm)',
      physiotherapist: 'Registered Physical Therapist & Rehabilitation Specialist',
      carpenter: 'Master Carpenter & Structural Joiner',
      gardener: 'Professional Landscape & Grounds Maintenance Specialist',
      factory_worker: 'Industrial Production & Assembly Operations Specialist'
    };
    if (profTitles[selectedProf]) {
      raTitle.value = profTitles[selectedProf];
      renderSkillSuggestions(selectedProf === 'caregiver' ? 'caregiver' : (selectedProf === 'welder' || selectedProf === 'electrician' || selectedProf === 'plumber') ? 'trade' : (selectedProf === 'truck' || selectedProf === 'storekeeper') ? 'driver' : 'nurse');
    }
  }
}

function syncResumeDataToApplicant() {
  const raName  = document.getElementById('raName')?.value.trim() || '';
  const raEmail = document.getElementById('raEmail')?.value.trim() || '';
  const raPhone = document.getElementById('raPhone')?.value.trim() || '';

  if (raName) {
    const parts = raName.split(' ');
    const firstInp = document.getElementById('firstName');
    const lastInp  = document.getElementById('lastName');
    if (firstInp && !firstInp.value.trim()) firstInp.value = parts[0];
    if (lastInp && !lastInp.value.trim())  lastInp.value = parts.slice(1).join(' ') || parts[0];
  }
  const emailInp = document.getElementById('email');
  if (emailInp && !emailInp.value.trim() && raEmail) {
    emailInp.value = raEmail;
  }
  const phoneInp = document.getElementById('phone');
  if (phoneInp && !phoneInp.value.trim() && raPhone) {
    phoneInp.value = raPhone;
  }
}

// ── Sample Profiles Loader ──
function loadResumeSample(type) {
  if (type === 'caregiver') {
    document.getElementById('raName').value = 'Grace Wanjiku';
    document.getElementById('raTitle').value = 'Senior Healthcare Assistant & Eldercare Specialist';
    document.getElementById('raEmail').value = 'grace.wanjiku@example.com';
    document.getElementById('raPhone').value = '+44 7700 900123';
    document.getElementById('raLocation').value = 'Nairobi, Kenya';
    document.getElementById('raSummary').value = AI_SUMMARIES.caregiver;
    document.getElementById('raDegree').value = 'Diploma in Community Health & Eldercare';
    document.getElementById('raSchool').value = 'Kenya Institute of Social Work';
    document.getElementById('raGradYear').value = '2020';
    document.getElementById('raLicense').value = 'HCA-KE-77210 (Active)';
    document.getElementById('raCerts').value = 'Care Certificate (UK Standards), First Aid & CPR, Dementia Level 2';
    document.getElementById('raLanguages').value = 'English (Fluent / C1), Swahili (Native)';
    
    resumeActiveSkills = new Set(['Elderly Care', 'ADLs Assistance', 'Dementia Care', 'Patient Mobility', 'Medication Prompting', 'Meal Preparation', 'First Aid']);
    renderActiveSkills();
    renderSkillSuggestions('caregiver');

    const container = document.getElementById('raExperienceContainer');
    if (container) container.innerHTML = '';
    resumeJobCounter = 0;
    addExperienceItem({
      title: 'Senior Healthcare Assistant',
      company: 'Green Pastures Eldercare Centre',
      city: 'Nairobi, Kenya',
      dates: '2021 – Present',
      bullets: '• Provided dignified, personalized daily living support (ADLs) for 14 elderly and high-dependency residents.\n• Monitored daily vital signs, mobility assistance with hoists, and medication adherence with 100% precision.\n• Facilitated social engagement and memory stimulation activities for residents with dementia.'
    });
    addExperienceItem({
      title: 'Home Care Aide',
      company: 'Compassionate Care Home Services',
      city: 'Mombasa, Kenya',
      dates: '2020 – 2021',
      bullets: '• Assisted recuperating post-stroke patients in their private residences with nutrition, hygiene, and physical therapy exercises.\n• Documented daily care logs and updated family members and attending clinical supervisors.'
    });

  } else if (type === 'welder') {
    document.getElementById('raName').value = 'Samuel Kiprono';
    document.getElementById('raTitle').value = 'Certified Industrial Welder & Metal Fabricator (SMAW / GMAW / GTAW)';
    document.getElementById('raEmail').value = 'samuel.kiprono.weld@example.com';
    document.getElementById('raPhone').value = '+254 712 345678';
    document.getElementById('raLocation').value = 'Nakuru, Kenya';
    document.getElementById('raSummary').value = AI_SUMMARIES.trade;
    document.getElementById('raDegree').value = 'Diploma in Mechanical Engineering (Welding & Fabrication)';
    document.getElementById('raSchool').value = 'Rift Valley Technical Training Institute';
    document.getElementById('raGradYear').value = '2018';
    document.getElementById('raLicense').value = 'AWS D1.1 Certified Welder / NITA Grade 1';
    document.getElementById('raCerts').value = 'OSHA 30 Construction Safety, AWS D1.1 Structural Welding, NDT Visual Level 2';
    document.getElementById('raLanguages').value = 'English (Professional), Swahili (Native)';

    resumeActiveSkills = new Set(['MIG / TIG / Arc Welding', 'Pipe Fitting & Alignment', 'Blueprint Reading', 'OSHA Safety Compliance', 'Metal Fabrication', 'Quality & Weld Inspection']);
    renderActiveSkills();
    renderSkillSuggestions('trade');

    const container = document.getElementById('raExperienceContainer');
    if (container) container.innerHTML = '';
    resumeJobCounter = 0;
    addExperienceItem({
      title: 'Lead Industrial Welder',
      company: 'Apex Structural Steel & Infrastructure',
      city: 'Nairobi, Kenya',
      dates: '2021 – Present',
      bullets: '• Executed structural SMAW and GMAW welding on high-rise beams and heavy industrial frameworks with zero defect test results.\n• Interpreted engineering blueprints, verified tolerances, and performed precision beveling and fit-up.\n• Mentored a crew of 6 junior welders and maintained zero-accident OSHA safety protocol across all sites.'
    });
  } else {
    // Default Nurse
    document.getElementById('raName').value = 'Sarah Jenkins, RN';
    document.getElementById('raTitle').value = 'Registered General Nurse (BSN, RN) — Acute Ward & Critical Care';
    document.getElementById('raEmail').value = 'sarah.jenkins.rn@example.com';
    document.getElementById('raPhone').value = '+44 7911 123456';
    document.getElementById('raLocation').value = 'Nairobi, Kenya';
    document.getElementById('raSummary').value = AI_SUMMARIES.nurse;
    document.getElementById('raDegree').value = 'Bachelor of Science in Nursing (BSN)';
    document.getElementById('raSchool').value = 'Nairobi Medical Training College';
    document.getElementById('raGradYear').value = '2019';
    document.getElementById('raLicense').value = 'NCK-RN-98421 (Active Nursing Council Registration)';
    document.getElementById('raCerts').value = 'BLS (Basic Life Support), ACLS, IELTS Academic Band 7.5, Infection Control';
    document.getElementById('raLanguages').value = 'English (Fluent / C1), Swahili (Native)';

    resumeActiveSkills = new Set(['Patient Assessment', 'Medication Administration', 'IV Cannulation', 'Infection Control', 'Wound Care & Dressing', 'Emergency BLS/CPR', 'Vital Signs Monitoring', 'Electronic Health Records (EHR)']);
    renderActiveSkills();
    renderSkillSuggestions('nurse');

    const container = document.getElementById('raExperienceContainer');
    if (container) container.innerHTML = '';
    resumeJobCounter = 0;
    addExperienceItem({
      title: 'Staff Nurse (Medical-Surgical & Stepdown ICU)',
      company: 'Metropolitan Referral Hospital',
      city: 'Nairobi, Kenya',
      dates: '2021 – Present',
      bullets: '• Delivered acute nursing care for up to 8 medical-surgical and post-operative patients per shift, continuously monitoring vitals and administering IV medications.\n• Partnered with multi-disciplinary clinical teams to implement individualized patient care plans and rapid response interventions.\n• Maintained strict adherence to hospital infection control standards, ensuring zero central-line and catheter-associated infections in assigned wards.'
    });
    addExperienceItem({
      title: 'Junior Clinical Nurse',
      company: 'St. Jude Community Hospital',
      city: 'Eldoret, Kenya',
      dates: '2019 – 2021',
      bullets: '• Conducted comprehensive patient admissions, clinical health histories, diagnostic wound dressings, and routine phlebotomy.\n• Managed computerized EHR documentation with 100% compliance during internal quality audits.'
    });
  }

  updateResumePreview();
}

function clearResumeForm() {
  if (!confirm('Clear all resume fields? You can load a sample anytime.')) return;
  document.getElementById('raName').value = '';
  document.getElementById('raTitle').value = '';
  document.getElementById('raEmail').value = '';
  document.getElementById('raPhone').value = '';
  document.getElementById('raLocation').value = '';
  document.getElementById('raSummary').value = '';
  document.getElementById('raDegree').value = '';
  document.getElementById('raSchool').value = '';
  document.getElementById('raGradYear').value = '';
  document.getElementById('raLicense').value = '';
  document.getElementById('raCerts').value = '';
  document.getElementById('raLanguages').value = '';

  resumeActiveSkills.clear();
  renderActiveSkills();

  const container = document.getElementById('raExperienceContainer');
  if (container) container.innerHTML = '';
  resumeJobCounter = 0;

  updateResumePreview();
  localStorage.removeItem('gjc_resume_draft');
  showToast('Resume cleared', 'info');
}

// ── Update Live Preview Canvas & Calculate ATS Score ──
function updateResumePreview() {
  const doc = document.getElementById('resumeDocument');
  if (!doc) return;

  const name        = document.getElementById('raName')?.value.trim()        || 'Your Full Name';
  const title       = document.getElementById('raTitle')?.value.trim()       || 'Target Professional Title';
  const email       = document.getElementById('raEmail')?.value.trim()       || 'your.email@example.com';
  const phone       = document.getElementById('raPhone')?.value.trim()       || '+00 000 000000';
  const location    = document.getElementById('raLocation')?.value.trim()    || 'City, Country';
  const relStatus   = document.getElementById('raRelocationStatus')?.value   || 'Ready for Relocation';
  const summary     = document.getElementById('raSummary')?.value.trim()     || 'Your professional summary will appear here. Highlight your years of experience, primary clinical/technical competencies, and international readiness.';
  const degree      = document.getElementById('raDegree')?.value.trim()      || '';
  const school      = document.getElementById('raSchool')?.value.trim()      || '';
  const gradYear    = document.getElementById('raGradYear')?.value.trim()    || '';
  const license     = document.getElementById('raLicense')?.value.trim()     || '';
  const certs       = document.getElementById('raCerts')?.value.trim()       || '';
  const languages   = document.getElementById('raLanguages')?.value.trim()   || '';

  // Get selected destination countries
  const destBoxes = document.querySelectorAll('#raDestPills input[type="checkbox"]:checked');
  const destinations = Array.from(destBoxes).map(cb => cb.value).join(', ');

  // Get experience entries
  const jobCards = document.querySelectorAll('.ra-job-card');
  const experiences = [];
  jobCards.forEach(card => {
    const jTitle   = card.querySelector('.ra-job-title')?.value.trim() || '';
    const jCompany = card.querySelector('.ra-job-company')?.value.trim() || '';
    const jCity    = card.querySelector('.ra-job-city')?.value.trim() || '';
    const jDates   = card.querySelector('.ra-job-dates')?.value.trim() || '';
    const jBullets = card.querySelector('.ra-job-bullets')?.value.trim() || '';
    if (jTitle || jCompany) {
      experiences.push({ title: jTitle, company: jCompany, city: jCity, dates: jDates, bullets: jBullets });
    }
  });

  // Render Document HTML
  let html = `
    <div class="res-doc-header">
      <h1 class="res-doc-name">${escapeHtml(name)}</h1>
      <div class="res-doc-title">${escapeHtml(title)}</div>
      <div class="res-doc-meta">
        <span><i class="fas fa-envelope"></i> ${escapeHtml(email)}</span>
        <span><i class="fas fa-phone"></i> ${escapeHtml(phone)}</span>
        <span><i class="fas fa-location-dot"></i> ${escapeHtml(location)}</span>
        <span><i class="fas fa-passport"></i> ${escapeHtml(relStatus)}</span>
        ${destinations ? `<span><i class="fas fa-plane-departure"></i> Target: ${escapeHtml(destinations)}</span>` : ''}
      </div>
    </div>

    <!-- Professional Summary -->
    <div class="res-doc-section">
      <div class="res-doc-sec-title"><i class="fas fa-user"></i> Professional Summary</div>
      <p class="res-doc-summary">${escapeHtml(summary)}</p>
    </div>
  `;

  // Skills Section
  if (resumeActiveSkills.size > 0) {
    html += `
      <div class="res-doc-section">
        <div class="res-doc-sec-title"><i class="fas fa-star"></i> Core Competencies &amp; Clinical Skills</div>
        <div class="res-doc-skills">
          ${Array.from(resumeActiveSkills).map(s => `<span class="res-doc-skill-badge">${escapeHtml(s)}</span>`).join('')}
        </div>
      </div>
    `;
  }

  // Experience Section
  if (experiences.length > 0) {
    html += `
      <div class="res-doc-section">
        <div class="res-doc-sec-title"><i class="fas fa-briefcase"></i> Professional Work Experience</div>
        ${experiences.map(exp => {
          const bulletList = exp.bullets
            ? exp.bullets.split('\n').filter(b => b.trim()).map(b => `<li>${escapeHtml(b.replace(/^[\u2022*\-\s]+/, ''))}</li>`).join('')
            : '';
          return `
            <div class="res-doc-job">
              <div class="res-doc-job-head">
                <span class="res-doc-job-title">${escapeHtml(exp.title || 'Professional Role')}</span>
                <span class="res-doc-job-dates">${escapeHtml(exp.dates || 'Dates')}</span>
              </div>
              <div class="res-doc-job-sub">${escapeHtml(exp.company || 'Facility')}${exp.city ? ` — ${escapeHtml(exp.city)}` : ''}</div>
              ${bulletList ? `<ul class="res-doc-job-bullets">${bulletList}</ul>` : ''}
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  // Education & Licensure
  if (degree || school || license) {
    html += `
      <div class="res-doc-section">
        <div class="res-doc-sec-title"><i class="fas fa-graduation-cap"></i> Education &amp; Professional Licensure</div>
        <div class="res-doc-edu-grid">
          ${degree || school ? `
            <div class="res-doc-edu-card">
              <div class="res-doc-edu-degree">${escapeHtml(degree || 'Academic Degree')}</div>
              <div class="res-doc-edu-school">${escapeHtml(school || 'Institution')}${gradYear ? ` &bull; Graduated ${escapeHtml(gradYear)}` : ''}</div>
            </div>
          ` : ''}
          ${license ? `
            <div class="res-doc-license-box">
              <div class="res-doc-license-title"><i class="fas fa-certificate"></i> Official Licensure / Board Registration</div>
              <div class="res-doc-license-num">${escapeHtml(license)}</div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  // Certifications & Languages
  if (certs || languages) {
    html += `
      <div class="res-doc-section">
        <div class="res-doc-sec-title"><i class="fas fa-award"></i> Certifications &amp; Languages</div>
        <div style="font-size:11.5px;color:#334155;line-height:1.6;">
          ${certs ? `<div><strong>Certifications:</strong> ${escapeHtml(certs)}</div>` : ''}
          ${languages ? `<div><strong>Languages:</strong> ${escapeHtml(languages)}</div>` : ''}
        </div>
      </div>
    `;
  }

  doc.innerHTML = html;

  // Calculate ATS Score & Update Meter
  calculateAtsScore({ name, title, email, phone, summary, experiences, degree, license, skillsCount: resumeActiveSkills.size });

  // Save draft
  saveResumeToLocal();
}

function calculateAtsScore(data) {
  let score = 0;
  const tips = [];

  if (data.name && data.name !== 'Your Full Name') { score += 10; tips.push({ ok: true, text: 'Full Name' }); }
  else { tips.push({ ok: false, text: 'Add Name' }); }

  if (data.title && data.title !== 'Target Professional Title') { score += 10; tips.push({ ok: true, text: 'Target Title' }); }
  else { tips.push({ ok: false, text: 'Add Title' }); }

  if (data.email && data.email.includes('@')) { score += 10; tips.push({ ok: true, text: 'Contact Email' }); }
  else { tips.push({ ok: false, text: 'Add Email' }); }

  if (data.phone && data.phone !== '+00 000 000000') { score += 10; tips.push({ ok: true, text: 'Phone' }); }
  else { tips.push({ ok: false, text: 'Add Phone' }); }

  if (data.summary && data.summary.length > 50) { score += 15; tips.push({ ok: true, text: 'Profile Summary' }); }
  else { tips.push({ ok: false, text: 'Expand Summary' }); }

  if (data.experiences && data.experiences.length > 0) { score += 20; tips.push({ ok: true, text: `${data.experiences.length} Experience(s)` }); }
  else { tips.push({ ok: false, text: 'Add Work Experience' }); }

  if (data.degree) { score += 10; tips.push({ ok: true, text: 'Education' }); }
  else { tips.push({ ok: false, text: 'Add Education' }); }

  if (data.license) { score += 10; tips.push({ ok: true, text: 'Professional License' }); }
  else { tips.push({ ok: false, text: 'Add License' }); }

  if (data.skillsCount >= 3) { score += 5; tips.push({ ok: true, text: `${data.skillsCount} Skills` }); }
  else { tips.push({ ok: false, text: 'Add 3+ Skills' }); }

  // Cap at 100
  score = Math.min(100, score);

  const fill = document.getElementById('raScoreFill');
  const text = document.getElementById('raScoreText');
  const badge = document.getElementById('raScoreBadge');
  const tipsRow = document.getElementById('raTipsRow');

  if (fill) fill.style.width = score + '%';
  if (text) {
    let label = 'Developing Profile';
    if (score >= 85) label = 'Embassy & ATS Compliant';
    else if (score >= 65) label = 'Strong International Profile';
    else if (score >= 40) label = 'Intermediate Profile';
    text.textContent = `${score}% — ${label}`;
  }
  if (badge) {
    if (score >= 85) {
      badge.innerHTML = '<i class="fas fa-circle-check"></i> Embassy Ready';
      badge.style.color = '#6ee7b7';
      badge.style.background = 'rgba(16, 185, 129, 0.2)';
    } else {
      badge.innerHTML = '<i class="fas fa-circle-info"></i> In Progress';
      badge.style.color = '#fcd34d';
      badge.style.background = 'rgba(245, 158, 11, 0.2)';
    }
  }
  if (tipsRow) {
    tipsRow.innerHTML = tips.map(t => `
      <span class="ra-tip-chip ${t.ok ? '' : 'incomplete'}">
        <i class="fas fa-${t.ok ? 'check-circle' : 'circle-exclamation'}"></i> ${t.text}
      </span>
    `).join('');
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ── Local Storage Save / Restore ──
function saveResumeToLocal() {
  try {
    const jobCards = document.querySelectorAll('.ra-job-card');
    const experiences = [];
    jobCards.forEach(card => {
      experiences.push({
        title: card.querySelector('.ra-job-title')?.value || '',
        company: card.querySelector('.ra-job-company')?.value || '',
        city: card.querySelector('.ra-job-city')?.value || '',
        dates: card.querySelector('.ra-job-dates')?.value || '',
        bullets: card.querySelector('.ra-job-bullets')?.value || ''
      });
    });

    const data = {
      name: document.getElementById('raName')?.value || '',
      title: document.getElementById('raTitle')?.value || '',
      email: document.getElementById('raEmail')?.value || '',
      phone: document.getElementById('raPhone')?.value || '',
      location: document.getElementById('raLocation')?.value || '',
      relocationStatus: document.getElementById('raRelocationStatus')?.value || '',
      summary: document.getElementById('raSummary')?.value || '',
      degree: document.getElementById('raDegree')?.value || '',
      school: document.getElementById('raSchool')?.value || '',
      gradYear: document.getElementById('raGradYear')?.value || '',
      license: document.getElementById('raLicense')?.value || '',
      certs: document.getElementById('raCerts')?.value || '',
      languages: document.getElementById('raLanguages')?.value || '',
      skills: Array.from(resumeActiveSkills),
      experiences: experiences
    };
    localStorage.setItem('gjc_resume_draft', JSON.stringify(data));
  } catch (e) {
    // ignore
  }
}

function loadResumeDataIntoForm(data) {
  if (!data) return;
  if (data.name) document.getElementById('raName').value = data.name;
  if (data.title) document.getElementById('raTitle').value = data.title;
  if (data.email) document.getElementById('raEmail').value = data.email;
  if (data.phone) document.getElementById('raPhone').value = data.phone;
  if (data.location) document.getElementById('raLocation').value = data.location;
  if (data.relocationStatus) document.getElementById('raRelocationStatus').value = data.relocationStatus;
  if (data.summary) document.getElementById('raSummary').value = data.summary;
  if (data.degree) document.getElementById('raDegree').value = data.degree;
  if (data.school) document.getElementById('raSchool').value = data.school;
  if (data.gradYear) document.getElementById('raGradYear').value = data.gradYear;
  if (data.license) document.getElementById('raLicense').value = data.license;
  if (data.certs) document.getElementById('raCerts').value = data.certs;
  if (data.languages) document.getElementById('raLanguages').value = data.languages;
  
  if (Array.isArray(data.skills) && data.skills.length > 0) {
    resumeActiveSkills = new Set(data.skills);
    renderActiveSkills();
  }

  // Restore experiences
  const container = document.getElementById('raExperienceContainer');
  if (container) container.innerHTML = '';
  resumeJobCounter = 0;
  
  if (Array.isArray(data.experiences) && data.experiences.length > 0) {
    data.experiences.forEach(exp => addExperienceItem(exp));
  } else {
    // Ensure default jobs are loaded if old draft had none
    addExperienceItem({
      title: 'Staff Nurse (Medical-Surgical & Stepdown ICU)',
      company: 'Metropolitan Referral Hospital',
      city: 'Nairobi, Kenya',
      dates: '2021 – Present',
      bullets: '• Delivered acute nursing care for up to 8 medical-surgical and post-operative patients per shift, continuously monitoring vitals and administering IV medications.\n• Partnered with multi-disciplinary clinical teams to implement individualized patient care plans and rapid response interventions.\n• Maintained strict adherence to hospital infection control standards, ensuring zero central-line and catheter-associated infections in assigned wards.'
    });
    addExperienceItem({
      title: 'Junior Clinical Nurse',
      company: 'St. Jude Community Hospital',
      city: 'Eldoret, Kenya',
      dates: '2019 – 2021',
      bullets: '• Conducted comprehensive patient admissions, clinical health histories, diagnostic wound dressings, and routine phlebotomy.\n• Managed computerized EHR documentation with 100% compliance during internal quality audits.'
    });
  }

  updateResumePreview();
}

// ── Export & Attach Actions (With Unconstrained Clone to Prevent Clipping) ──

function getCleanResumeExportClone() {
  const doc = document.getElementById('resumeDocument');
  if (!doc) return null;
  
  const clone = doc.cloneNode(true);
  clone.id = 'resumeDocExportClone';
  
  // Apply unconstrained A4 layout dimensions
  clone.style.width = '794px';        // 210mm A4 width at 96 DPI
  clone.style.maxWidth = '794px';
  clone.style.minHeight = '1123px';   // 297mm A4 height at 96 DPI
  clone.style.height = 'auto';
  clone.style.maxHeight = 'none';
  clone.style.overflow = 'visible';
  clone.style.position = 'fixed';
  clone.style.top = '0';
  clone.style.left = '-10000px';      // Hidden offscreen
  clone.style.margin = '0';
  clone.style.boxShadow = 'none';
  clone.style.borderRadius = '0';
  clone.style.padding = '28px 32px';
  clone.style.background = '#ffffff';
  clone.style.color = '#1f2937';
  clone.style.zIndex = '-99999';

  document.body.appendChild(clone);
  return clone;
}

async function attachResumeToApplication() {
  const nameInput = document.getElementById('raName');
  const nameVal = nameInput?.value.trim() || '';
  if (!nameVal || nameVal === 'Your Full Name') {
    showToast('Please enter your full name in the resume editor before attaching.', 'error');
    if (nameInput) {
      nameInput.focus();
      nameInput.style.borderColor = '#ef5350';
      setTimeout(() => { nameInput.style.borderColor = ''; }, 2000);
    }
    if (typeof switchResumeMobileTab === 'function') switchResumeMobileTab('edit');
    return;
  }
  const name = nameVal;
  const cleanName = name.replace(/[^a-zA-Z0-9]/g, '_');
  const fileName = `${cleanName}_International_Resume.pdf`;

  const btn = document.getElementById('btnAttachCv');
  if (btn) {
    btn.disabled = true;
    btn.style.opacity = '0.7';
    btn.querySelector('.btn-attach-title').textContent = 'Generating Full PDF & Attaching...';
  }

  const clone = getCleanResumeExportClone();

  try {
    let pdfFile = null;

    if (window.html2pdf && clone) {
      const opt = {
        margin: [6, 6, 6, 6],
        filename: fileName,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2, 
          useCORS: true, 
          logging: false,
          scrollY: 0,
          scrollX: 0,
          windowWidth: 800
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      };
      const blob = await html2pdf().set(opt).from(clone).outputPdf('blob');
      pdfFile = new File([blob], fileName, { type: 'application/pdf' });
    } else {
      // Fallback HTML/DOC blob
      const doc = document.getElementById('resumeDocument');
      const content = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${name} Resume</title><style>${document.querySelector('style')?.innerHTML || ''}</style></head><body>${doc ? doc.outerHTML : ''}</body></html>`;
      const blob = new Blob([content], { type: 'application/msword' });
      pdfFile = new File([blob], `${cleanName}_International_Resume.doc`, { type: 'application/msword' });
    }

    // Attach to cvFile input using DataTransfer
    const cvInput = document.getElementById('cvFile');
    if (cvInput && pdfFile) {
      const dt = new DataTransfer();
      dt.items.add(pdfFile);
      cvInput.files = dt.files;
      showCvFile(pdfFile);
    }

    // Also sync contact details into registration form if blank
    syncResumeDataToApplicant();

    // Switch to registration panel
    showPanel('reg');

    // Move to step 4 (Account & CV step)
    if (typeof nextStep === 'function') {
      for (let s = currentStep; s < 4; s++) {
        const stepDiv = document.getElementById('step' + s);
        if (stepDiv) stepDiv.style.display = 'none';
        const ind = document.getElementById('stepIndicator' + s);
        if (ind) { ind.classList.add('completed'); ind.classList.remove('active'); }
        const line = document.getElementById('stepLine' + s);
        if (line) line.classList.add('active');
      }
      currentStep = 4;
      document.getElementById('step4').style.display = 'block';
      document.getElementById('stepIndicator4').classList.add('active');
      document.getElementById('stepLabel4').classList.add('active');
    }

    // Scroll to CV upload area
    const cvDrop = document.getElementById('cvDrop');
    if (cvDrop) {
      cvDrop.scrollIntoView({ behavior: 'smooth', block: 'center' });
      cvDrop.style.borderColor = '#10b981';
      setTimeout(() => { cvDrop.style.borderColor = ''; }, 3000);
    }

    // Confetti celebration!
    if (typeof confetti === 'function') {
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
    }

    showToast('🎉 Full resume generated and attached to your application! Complete the final step below.', 'success');

  } catch (err) {
    console.error('Error attaching resume:', err);
    showToast('Could not auto-generate PDF: ' + err.message + '. Please use Download PDF instead.', 'error');
  } finally {
    if (clone) clone.remove();
    if (btn) {
      btn.disabled = false;
      btn.style.opacity = '';
      btn.querySelector('.btn-attach-title').textContent = 'Attach Directly to Application Form';
    }
  }
}

async function downloadResumePdf() {
  const name = document.getElementById('raName')?.value.trim() || 'Applicant';
  const cleanName = name.replace(/[^a-zA-Z0-9]/g, '_');
  const fileName = `${cleanName}_International_Resume.pdf`;

  const btn = document.querySelector('.ra-toolbar-actions button[title*="Download PDF"]');
  const origHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> PDF...';
  }

  const clone = getCleanResumeExportClone();

  if (window.html2pdf && clone) {
    showToast('Generating your complete PDF with all details...', 'info');
    const opt = {
      margin: [6, 6, 6, 6],
      filename: fileName,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { 
        scale: 2, 
        useCORS: true, 
        logging: false,
        scrollY: 0,
        scrollX: 0,
        windowWidth: 800
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };
    try {
      await html2pdf().set(opt).from(clone).save();
      showToast('Full PDF downloaded successfully!', 'success');
    } catch (err) {
      console.error('html2pdf download error:', err);
      printResume();
    } finally {
      clone.remove();
      if (btn) { btn.disabled = false; btn.innerHTML = origHtml; }
    }
  } else {
    if (clone) clone.remove();
    printResume();
  }
}

function printResume() {
  const doc = document.getElementById('resumeDocument');
  if (!doc) return;
  
  const printWindow = window.open('', '_blank', 'width=850,height=1000');
  if (!printWindow) {
    window.print();
    return;
  }
  
  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; background: #fff; color: #1f2937; padding: 18mm 16mm; font-size: 11.5px; line-height: 1.45; }
    .res-doc-header { border-bottom: 2px solid #1565c0; padding-bottom: 10px; margin-bottom: 12px; }
    .res-doc-name { font-size: 20px; font-weight: 800; color: #0f172a; margin-bottom: 3px; }
    .res-doc-title { font-size: 12px; font-weight: 700; color: #1565c0; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 6px; }
    .res-doc-meta { display: flex; flex-wrap: wrap; gap: 8px 14px; font-size: 10.5px; color: #475569; }
    .res-doc-section { margin-bottom: 12px; page-break-inside: avoid; break-inside: avoid; }
    .res-doc-sec-title { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; color: #1565c0; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px; margin-bottom: 6px; }
    .res-doc-summary { font-size: 11px; color: #334155; line-height: 1.55; text-align: justify; }
    .res-doc-skills { display: flex; flex-wrap: wrap; gap: 4px; }
    .res-doc-skill-badge { background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; font-size: 10px; font-weight: 600; padding: 2px 7px; border-radius: 4px; }
    .res-doc-job { margin-bottom: 9px; page-break-inside: avoid; break-inside: avoid; }
    .res-doc-job-head { display: flex; justify-content: space-between; align-items: baseline; }
    .res-doc-job-title { font-size: 11.5px; font-weight: 700; color: #0f172a; }
    .res-doc-job-dates { font-size: 10px; font-weight: 600; color: #64748b; }
    .res-doc-job-sub { font-size: 10.5px; font-weight: 600; color: #1565c0; margin-bottom: 3px; }
    .res-doc-job-bullets { padding-left: 15px; font-size: 10.5px; color: #334155; line-height: 1.45; }
    .res-doc-edu-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; page-break-inside: avoid; break-inside: avoid; }
    .res-doc-edu-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 5px 8px; }
    .res-doc-edu-degree { font-size: 11px; font-weight: 700; color: #0f172a; }
    .res-doc-edu-school { font-size: 10px; color: #475569; }
    .res-doc-license-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 4px; padding: 5px 8px; }
    .res-doc-license-title { font-size: 11px; font-weight: 700; color: #166534; }
    .res-doc-license-num { font-size: 10px; font-weight: 600; color: #15803d; }
    @page { size: A4 portrait; margin: 10mm; }
  `;
  
  printWindow.document.write(`<!DOCTYPE html><html><head><title>${document.getElementById('raName')?.value || 'Resume'} - Full Print</title><style>${css}</style></head><body>${doc.innerHTML}</body></html>`);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 400);
}

function copyResumeText() {
  const doc = document.getElementById('resumeDocument');
  if (!doc) return;
  const text = doc.innerText || doc.textContent;
  navigator.clipboard.writeText(text).then(() => {
    showToast('Resume plain text copied to clipboard!', 'success');
  }).catch(() => {
    showToast('Could not copy to clipboard', 'error');
  });
}
