// ── Initialize Libraries ──
let iti;
document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize Phone Input
  const phoneInput = document.querySelector("#phone");
  iti = window.intlTelInput(phoneInput, {
    initialCountry: "auto",
    dropdownContainer: document.body,
    geoIpLookup: callback => {
      fetch("https://ipapi.co/json")
        .then(res => res.json())
        .then(data => callback(data.country_code))
        .catch(() => callback("us"));
    },
    utilsScript: "https://cdn.jsdelivr.net/npm/intl-tel-input@23.0.10/build/js/utils.js",
  });

  // 2. Initialize Calendar (Flatpickr)
  flatpickr("#dob", {
    altInput: true,
    altFormat: "F j, Y",
    dateFormat: "Y-m-d",
    maxDate: "today",
    theme: "dark",
    disableMobile: "true"
  });

  // 3. Password Strength Logic
  const password = document.getElementById('password');
  const pwMeter = document.getElementById('pwMeter');
  const pwText = document.getElementById('pwText');

  password.addEventListener('input', () => {
    const val = password.value;
    let strength = 0;
    if (val.length >= 8) strength++;
    if (val.match(/[a-z]/) && val.match(/[A-Z]/)) strength++;
    if (val.match(/\d/)) strength++;
    if (val.match(/[^a-zA-Z\d]/)) strength++;

    const colors = ['#ef5350', '#ff9800', '#ffeb3b', '#8bc34a', '#4caf50'];
    const labels = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'];
    
    if (val.length === 0) {
        pwMeter.style.width = '0';
        pwText.textContent = 'Strength: Too short';
    } else {
        pwMeter.style.width = (strength + 1) * 20 + '%';
        pwMeter.style.background = colors[strength];
        pwText.textContent = 'Strength: ' + labels[strength];
    }
  });

  // 4. Real-time Password Matching
  const confirmPw = document.getElementById('confirmPw');
  confirmPw.addEventListener('input', () => {
    if (confirmPw.value === password.value && confirmPw.value.length > 0) {
      confirmPw.style.borderColor = '#4caf50';
      confirmPw.style.boxShadow = '0 0 0 3px rgba(76,175,80,0.2)';
    } else if (confirmPw.value.length > 0) {
      confirmPw.style.borderColor = '#ef5350';
      confirmPw.style.boxShadow = '0 0 0 3px rgba(239,83,80,0.2)';
    } else {
      confirmPw.style.borderColor = '';
      confirmPw.style.boxShadow = '';
    }
  });
});

// ── Tab switching ──
function switchTab(tab) {
  const isReg = tab === 'reg';

  // Show/hide panels via direct inline style — no CSS class dependency
  document.getElementById('regPanel').style.display   = isReg ? 'block' : 'none';
  document.getElementById('trackPanel').style.display = isReg ? 'none'  : 'block';

  // Update tab button active states
  document.getElementById('tabReg').classList.toggle('active', isReg);
  document.getElementById('tabTrack').classList.toggle('active', !isReg);

  // Reset tracker state when switching away from track (to reg)
  if (isReg) {
    document.getElementById('progressCard').classList.remove('show');
    document.getElementById('trackMsg').style.display = 'none';
    document.getElementById('trackRef').value = '';
    document.getElementById('trackEmail').value = '';
  }
}

// ── Profession buttons ──
const profBtns = document.querySelectorAll('.prof-btn');
let selectedProf = 'nurse';
profBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    profBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedProf = btn.dataset.prof;
  });
});

// ── Password toggle ──
function togglePw(inputId, iconId) {
  const inp = document.getElementById(inputId);
  const ico = document.getElementById(iconId);
  inp.type = inp.type === 'password' ? 'text' : 'password';
  ico.className = inp.type === 'text' ? 'fas fa-eye-slash' : 'fas fa-eye';
}

// ── CV Upload ──
const cvDrop = document.getElementById('cvDrop');
cvDrop.addEventListener('dragover', e => { e.preventDefault(); cvDrop.classList.add('drag-over'); });
cvDrop.addEventListener('dragleave', () => cvDrop.classList.remove('drag-over'));
cvDrop.addEventListener('drop', e => {
  e.preventDefault(); cvDrop.classList.remove('drag-over');
  if (e.dataTransfer.files[0]) showCvFile(e.dataTransfer.files[0]);
});
function handleCvFile(input) { if (input.files[0]) showCvFile(input.files[0]); }
function showCvFile(file) {
  const ok = ['application/pdf','application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  if (!ok.includes(file.type)) { alert('Please upload PDF, DOC or DOCX.'); return; }
  if (file.size > 5 * 1024 * 1024) { alert('File must be under 5MB.'); return; }
  document.getElementById('cvFileName').textContent = file.name;
  document.getElementById('cvName').style.display = 'block';
}

// ── Form Submit ──
document.getElementById('regForm').addEventListener('submit', async function(e) {
  e.preventDefault();

  const first    = document.getElementById('firstName').value.trim();
  const last     = document.getElementById('lastName').value.trim();
  const email    = document.getElementById('email').value.trim();
  const pw       = document.getElementById('password').value;
  const cpw      = document.getElementById('confirmPw').value;
  const terms    = document.getElementById('terms').checked;
  
  // Get validated phone and country from intl-tel-input
  const phoneRaw = document.getElementById('phone').value.trim();
  const isValidPhone = iti.isValidNumber();
  const countryData = iti.getSelectedCountryData();
  const countryName = countryData.name;
  const fullPhone = iti.getNumber();

  if (!first || !last) { alert('Please fill in your first and last name.'); shake('firstName'); shake('lastName'); return; }
  if (!email || !email.includes('@')) { alert('Please enter a valid email address.'); return shake('email'); }
  if (!phoneRaw || !isValidPhone) { alert('Please enter a valid phone number for the selected country.'); return shake('phone'); }
  
  // Password Strength Check (Minimum "Good" required - 3 points)
  let pwStrength = 0;
  if (pw.length >= 8) pwStrength++;
  if (pw.match(/[a-z]/) && pw.match(/[A-Z]/)) pwStrength++;
  if (pw.match(/\d/)) pwStrength++;
  if (pw.match(/[^a-zA-Z\d]/)) pwStrength++;

  if (pwStrength < 3) { alert('Please use a stronger password. Include uppercase, lowercase, numbers, and symbols.'); return shake('password'); }
  if (pw !== cpw) { alert('Passwords do not match.'); return shake('confirmPw'); }
  if (!terms) { alert('Please agree to the Terms & Conditions.'); return; }

  const submitBtn = document.getElementById('submitBtn');
  submitBtn.disabled = true;
  submitBtn.querySelector('span').innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> &nbsp;Submitting...';

  try {
    const formData = new FormData();
    formData.append('firstName',     first);
    formData.append('lastName',      last);
    formData.append('email',         email);
    formData.append('phone',         fullPhone);
    formData.append('dob',           document.getElementById('dob').value);
    formData.append('gender',        document.querySelector('[name=gender]:checked')?.value || '');
    formData.append('profession',    selectedProf);
    formData.append('experience',    document.getElementById('experience').value);
    formData.append('country',       countryName);
    formData.append('qualification', document.getElementById('qualification').value);
    formData.append('bio',           document.getElementById('bio').value);
    formData.append('password',      pw);
    const cvInput = document.getElementById('cvFile');
    if (cvInput.files[0]) formData.append('cvFile', cvInput.files[0]);

    const res  = await fetch(API_BASE_URL + '/api/register', { method: 'POST', body: formData });
    const data = await res.json();

    if (!res.ok) { alert(data.error || 'Registration failed.'); return; }

    // Show success with batch code
    document.getElementById('successRef').textContent   = data.refNumber;
    document.getElementById('successBatch').textContent = data.batchCode;
    document.getElementById('successName').textContent  = first;
    document.getElementById('successOverlay').classList.add('show');

    this.reset();
    profBtns.forEach(b => b.classList.remove('active'));
    document.getElementById('btn-nurse').classList.add('active');
    selectedProf = 'nurse';
    document.getElementById('cvName').style.display = 'none';

  } catch (err) {
    alert('Could not connect to the server. Make sure the backend is running.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.querySelector('span').innerHTML = '<i class="fas fa-paper-plane"></i> &nbsp;Submit Registration';
  }
});

function shake(id) {
  const el = document.getElementById(id);
  el.style.borderColor = '#ef5350';
  el.focus();
  setTimeout(() => { el.style.borderColor = ''; }, 1500);
}

// ── Application Tracker ──
const STAGES = [
  { label: 'Application Received',   desc: 'Your application was submitted successfully.',    icon: 'fa-inbox' },
  { label: 'Document Verification',  desc: 'Our team is verifying your uploaded documents.',  icon: 'fa-file-circle-check' },
  { label: 'Background Check',       desc: 'A standard background screening is in progress.', icon: 'fa-shield-halved' },
  { label: 'Interview / Assessment', desc: 'You will be contacted to schedule an interview.',  icon: 'fa-comments' },
  { label: 'Final Decision',         desc: 'A placement decision will be communicated.',        icon: 'fa-trophy' }
];

async function trackApplication(e) {
  if (e) e.preventDefault();
  
  const ref    = (document.getElementById('trackRef').value   || '').trim();
  const email  = (document.getElementById('trackEmail').value || '').trim();
  const msgEl  = document.getElementById('trackMsg');
  const cardEl = document.getElementById('progressCard');
  const btn    = document.getElementById('btnTrack');

  if (!ref && !email) {
    showTrackMsg('error', '<i class="fas fa-triangle-exclamation"></i> Please enter your reference number or email.');
    cardEl.classList.remove('show');
    return;
  }

  // Show loading state
  showTrackMsg('loading', '<i class="fas fa-circle-notch fa-spin"></i> &nbsp;Fetching your application status...');
  cardEl.classList.remove('show');
  if (btn) { btn.disabled = true; btn.style.opacity = '0.7'; }

  const baseUrl = (typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : '');

  try {
    const res  = await fetch(baseUrl + '/api/track', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ ref, email })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      showTrackMsg('error', '<i class="fas fa-circle-exclamation"></i> Server error: ' + (errData.error || res.statusText));
      return;
    }

    const data = await res.json();
    msgEl.style.display = 'none';

    if (!data.found) {
      showTrackMsg('error', '<i class="fas fa-triangle-exclamation"></i> No application found. Check your reference number or email and try again.');
      return;
    }

    renderProgress(data);

  } catch (err) {
    console.error('Tracker Error:', err);
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      showTrackMsg('error', '<i class="fas fa-wifi"></i> Cannot reach the server. Please check your connection and try again.');
    } else {
      showTrackMsg('error', '<i class="fas fa-wifi"></i> Could not connect to the server. Please try again in a moment.');
    }
  } finally {
    if (btn) { btn.disabled = false; btn.style.opacity = ''; }
  }
}

function showTrackMsg(type, html) {
  const el = document.getElementById('trackMsg');
  el.className = type === 'loading' ? 'track-msg track-loading' : 'track-msg track-error';
  el.innerHTML = html;
  el.style.display = 'block';
}

function renderProgress(data) {
  // Avatar initials
  const names    = (data.name || '').split(' ');
  const initials = ((names[0] || '')[0] || '') + ((names[1] || '')[0] || '');
  document.getElementById('trackAvatar').textContent = initials.toUpperCase();

  document.getElementById('progName').textContent  = data.name;
  document.getElementById('progRef').textContent   = data.ref;
  document.getElementById('progBatch').textContent = data.batchCode;

  // Status badge
  const sb = document.getElementById('trackStatusBadge');
  const statusMap = {
    Approved: { cls: 'tsb-approved', icon: 'fa-circle-check',  label: 'Approved' },
    Rejected: { cls: 'tsb-rejected', icon: 'fa-circle-xmark',  label: 'Rejected' },
    Pending:  { cls: 'tsb-pending',  icon: 'fa-clock',         label: 'In Review' }
  };
  const st = statusMap[data.status] || statusMap.Pending;
  sb.className = 'track-status-badge ' + st.cls;
  sb.innerHTML = `<i class="fas ${st.icon}"></i>${st.label}`;

  // Timeline steps
  const c = document.getElementById('stepsContainer');
  c.innerHTML = '';
  STAGES.forEach((stage, i) => {
    const isFinalDecision = (data.status === 'Approved' || data.status === 'Rejected');
    const done    = i < data.currentStep || (i === STAGES.length - 1 && isFinalDecision);
    const current = i === data.currentStep && !isFinalDecision;

    const dotCls   = done ? 'tl-dot-done'  : current ? 'tl-dot-current'  : 'tl-dot-wait';
    const stepCls  = done ? 'tl-done'       : current ? 'tl-current'       : '';
    const lblCls   = done ? 'tl-step-label-done'  : current ? 'tl-step-label-current'  : 'tl-step-label-wait';
    const dscCls   = done ? 'tl-step-desc-done'   : current ? 'tl-step-desc-current'   : 'tl-step-desc-wait';
    const badgeCls = done ? 'tl-b-done'     : current ? 'tl-b-current'     : 'tl-b-wait';
    const badgeIcon= done ? 'fa-check'      : current ? 'fa-circle-dot'    : 'fa-circle';
    const badgeTxt = done ? 'Completed'     : current ? 'In Progress'      : 'Pending';
    const dotIcon  = done ? 'fa-check'      : stage.icon;

    c.innerHTML += `
      <div class="tl-step ${stepCls}">
        <div class="tl-left">
          <div class="tl-dot ${dotCls}"><i class="fas ${dotIcon}"></i></div>
        </div>
        <div class="tl-content">
          <div class="tl-step-label ${lblCls}">${stage.label}</div>
          <div class="tl-step-desc ${dscCls}">${stage.desc}</div>
          <span class="tl-badge ${badgeCls}"><i class="fas ${badgeIcon}"></i>${badgeTxt}</span>
        </div>
      </div>`;
  });

  // Admin note
  const noteEl = document.getElementById('trackNote');
  if (data.note) {
    noteEl.innerHTML = `<i class="fas fa-circle-info"></i>${data.note}`;
    noteEl.style.display = 'block';
  } else {
    noteEl.style.display = 'none';
  }

  document.getElementById('progressCard').classList.add('show');
}
