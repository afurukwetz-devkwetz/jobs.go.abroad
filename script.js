// ── Tab switching ──
function switchTab(tab) {
  const isReg = tab === 'reg';
  document.getElementById('regPanel').classList.toggle('hidden', !isReg);
  document.getElementById('trackPanel').classList.toggle('active', !isReg);
  document.getElementById('tabReg').classList.toggle('active', isReg);
  document.getElementById('tabTrack').classList.toggle('active', !isReg);
  if (!isReg) {
    document.getElementById('progressCard').classList.remove('show');
    document.getElementById('trackMsg').style.display = 'none';
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
  const country  = document.getElementById('country').value;
  const terms    = document.getElementById('terms').checked;

  if (!first || !last) { alert('Please fill in your first and last name.'); shake('firstName'); shake('lastName'); return; }
  if (!email || !email.includes('@')) { alert('Please enter a valid email address.'); return shake('email'); }
  if (!country) { alert('Please select a country.'); return shake('country'); }
  if (pw.length < 8) { alert('Password must be at least 8 characters long.'); return shake('password'); }
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
    formData.append('phone',         document.getElementById('phone').value);
    formData.append('dob',           document.getElementById('dob').value);
    formData.append('gender',        document.querySelector('[name=gender]:checked')?.value || '');
    formData.append('profession',    selectedProf);
    formData.append('experience',    document.getElementById('experience').value);
    formData.append('country',       country);
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

async function trackApplication() {
  const ref    = document.getElementById('trackRef').value.trim();
  const email  = document.getElementById('trackEmail').value.trim();
  const msgEl  = document.getElementById('trackMsg');
  const cardEl = document.getElementById('progressCard');

  if (!ref && !email) {
    showTrackMsg('error', 'Please enter your reference number or email.');
    cardEl.classList.remove('show'); return;
  }

  showTrackMsg('loading', '<i class="fas fa-circle-notch"></i> Fetching your application status...');
  cardEl.classList.remove('show');

  try {
    const res  = await fetch(API_BASE_URL + '/api/track', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ ref, email })
    });
    const data = await res.json();

    msgEl.style.display = 'none';

    if (!data.found) {
      showTrackMsg('error', '<i class="fas fa-triangle-exclamation"></i> No application found. Check your reference number or email.');
      return;
    }
    renderProgress(data);

  } catch (err) {
    console.error("Tracker Error:", err);
    showTrackMsg('error', '<i class="fas fa-wifi"></i> Error: ' + err.message);
  }
}

function showTrackMsg(type, html) {
  const el = document.getElementById('trackMsg');
  el.className = type === 'loading' ? 'track-msg track-loading' : 'track-msg track-error';
  el.innerHTML = html;
  el.style.display = 'block';
}

function renderProgress(data) {
  document.getElementById('progName').textContent  = data.name;
  document.getElementById('progRef').textContent   = 'Ref: ' + data.ref;
  document.getElementById('progBatch').textContent = 'Batch: ' + data.batchCode;

  const c = document.getElementById('stepsContainer');
  c.innerHTML = '';
  STAGES.forEach((s, i) => {
    const done    = i < data.currentStep;
    const current = i === data.currentStep;
    const dot     = done ? 'done' : current ? 'current' : '';
    const badge   = done ? 'b-done' : current ? 'b-current' : 'b-wait';
    const label   = done ? 'Completed' : current ? 'In Progress' : 'Pending';
    const icon    = done ? 'fa-check' : s.icon;
    c.innerHTML += `<div class="step">
      <div class="step-dot ${dot}"><i class="fas ${icon}"></i></div>
      <div class="step-info">
        <h4>${s.label}</h4><p>${s.desc}</p>
        <span class="step-badge ${badge}">${label}</span>
      </div></div>`;
  });

  if (data.note) {
    c.innerHTML += `<div style="margin-top:14px;padding:10px 14px;border-radius:10px;background:rgba(66,165,245,.1);border:1px solid rgba(66,165,245,.2);font-size:.8rem;color:rgba(255,255,255,.7)">
      <i class="fas fa-circle-info" style="color:#64b5f6;margin-right:6px"></i>${data.note}</div>`;
  }

  document.getElementById('progressCard').classList.add('show');
}
