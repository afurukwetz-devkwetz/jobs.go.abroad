/* =========================================================
   script.js — Global Jobs Board frontend logic
   Clean rewrite: no module-level DOM queries
   ========================================================= */

'use strict';

// ── Globals ─────────────────────────────────────────────────
let iti;            // intl-tel-input instance
let selectedProf = 'nurse';

const STAGES = [
  { label: 'Application Received',   desc: 'Your application was submitted successfully.',       icon: 'fa-inbox' },
  { label: 'Document Verification',  desc: 'Our team is verifying your uploaded documents.',     icon: 'fa-file-circle-check' },
  { label: 'Background Check',       desc: 'A standard background screening is in progress.',    icon: 'fa-shield-halved' },
  { label: 'Interview / Assessment', desc: 'You will be contacted to schedule an interview.',    icon: 'fa-comments' },
  { label: 'Final Decision',         desc: 'A placement decision will be communicated to you.',  icon: 'fa-trophy' },
];

// ── Tab switching ─────────────────────────────────────────────
function showPanel(name) {
  const panelReg   = document.getElementById('panelReg');
  const panelTrack = document.getElementById('panelTrack');
  const tabReg     = document.getElementById('tabReg');
  const tabTrack   = document.getElementById('tabTrack');

  if (name === 'track') {
    panelReg.hidden   = true;
    panelTrack.hidden = false;
    tabReg.classList.remove('tab--active');
    tabTrack.classList.add('tab--active');
    tabReg.setAttribute('aria-selected', 'false');
    tabTrack.setAttribute('aria-selected', 'true');
  } else {
    panelTrack.hidden = true;
    panelReg.hidden   = false;
    tabTrack.classList.remove('tab--active');
    tabReg.classList.add('tab--active');
    tabTrack.setAttribute('aria-selected', 'false');
    tabReg.setAttribute('aria-selected', 'true');
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
document.addEventListener('DOMContentLoaded', function () {

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

  // 5. Profession buttons + nurse qual section toggle
  const profBtns = document.querySelectorAll('.prof-btn');
  const nurseQualSection = document.getElementById('nurseQualSection');
  profBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      profBtns.forEach(b => b.classList.remove('prof-btn--active'));
      btn.classList.add('prof-btn--active');
      selectedProf = btn.dataset.prof || 'nurse';
      // Show nurse qualification section only for nurses
      if (nurseQualSection) {
        if (selectedProf === 'nurse') {
          nurseQualSection.style.display = 'block';
        } else {
          nurseQualSection.style.display = 'none';
          // Collapse the panel if switching away from nurse
          const panel = document.getElementById('qualPanel');
          const chevron = document.getElementById('qualChevron');
          if (panel) panel.style.display = 'none';
          if (chevron) chevron.style.transform = '';
        }
      }
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

      if (!first || !last) { alert('Please enter your first and last name.'); shake('firstName'); return; }
      if (!email.includes('@')) { alert('Please enter a valid email.'); shake('email'); return; }

      if (iti) {
        if (!iti.isValidNumber()) { alert('Please enter a valid phone number.'); shake('phone'); return; }
      }

      let pwStr = 0;
      if (pw.length >= 8) pwStr++;
      if (pw.match(/[a-z]/) && pw.match(/[A-Z]/)) pwStr++;
      if (pw.match(/\d/)) pwStr++;
      if (pw.match(/[^a-zA-Z\d]/)) pwStr++;
      if (pwStr < 3) { alert('Please use a stronger password (uppercase, lowercase, number, symbol).'); shake('password'); return; }
      if (pw !== cpw) { alert('Passwords do not match.'); shake('confirmPw'); return; }
      if (!terms) { alert('Please agree to the Terms & Conditions.'); return; }

      const btn = document.getElementById('submitBtn');
      if (btn) { btn.disabled = true; btn.querySelector('span').innerHTML = '<i class="fas fa-circle-notch fa-spin"></i>&nbsp;&nbsp;Submitting…'; }

      try {
        const fd = new FormData();
        fd.append('firstName',     first);
        fd.append('lastName',      last);
        fd.append('email',         email);
        fd.append('phone',         iti ? iti.getNumber() : document.getElementById('phone')?.value || '');
        fd.append('dob',           document.getElementById('dob')?.value || '');
        fd.append('gender',        document.querySelector('[name=gender]:checked')?.value || '');
        fd.append('profession',    selectedProf);
        fd.append('experience',    document.getElementById('experience')?.value || '');
        fd.append('country',       iti ? iti.getSelectedCountryData().name : '');
        fd.append('qualification', document.getElementById('qualification')?.value || '');
        fd.append('bio',           document.getElementById('bio')?.value || '');
        fd.append('password',      pw);
        const cvFile = document.getElementById('cvFile');
        if (cvFile?.files[0]) fd.append('cvFile', cvFile.files[0]);

        const base = (typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : '');
        const res  = await fetch(base + '/api/register', { method: 'POST', body: fd });
        const data = await res.json();
        if (!res.ok) { alert(data.error || 'Registration failed.'); return; }

        // Show success
        document.getElementById('successName').textContent  = first;
        document.getElementById('successRef').textContent   = data.refNumber;
        document.getElementById('successBatch').textContent = data.batchCode;
        document.getElementById('successOverlay').style.display = 'flex';

        // Reset form
        regForm.reset();
        document.querySelectorAll('.prof-btn').forEach(b => b.classList.remove('prof-btn--active'));
        document.getElementById('btn-nurse')?.classList.add('prof-btn--active');
        selectedProf = 'nurse';
        const cvNameEl = document.getElementById('cvName');
        if (cvNameEl) cvNameEl.style.display = 'none';

      } catch (err) {
        alert('Could not reach the server. Please try again.');
      } finally {
        if (btn) { btn.disabled = false; btn.querySelector('span').innerHTML = '<i class="fas fa-paper-plane"></i>&nbsp;&nbsp;Submit Application'; }
      }
    });
  }

  // 8. Enter key on tracker inputs
  ['trackRef','trackEmail'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') trackApplication(); });
  });
});
