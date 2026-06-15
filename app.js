// ============================================================
//  COS Nurses – Payment Portal JS
// ============================================================

// ----- TAB SWITCHING -----
function switchTab(type) {
  // Update buttons
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.getElementById('tab-' + type).classList.add('active');

  // Update forms
  document.querySelectorAll('.form-card').forEach(card => card.classList.remove('active'));
  document.getElementById('form-' + type).classList.add('active');
}

// ----- PAYMENT METHOD REVEAL -----
function setupMethodListeners(prefix) {
  const radios = document.querySelectorAll(`input[name="${prefix}-method"]`);
  const allDetails = document.querySelectorAll(`#${prefix === 'a' ? 'form-agency' : 'form-insurance'} .method-details`);

  radios.forEach(radio => {
    radio.addEventListener('change', () => {
      // Hide all detail sections
      allDetails.forEach(el => { el.style.display = 'none'; });

      // Show relevant one
      const val = radio.value;
      const map = {
        mpesa: `${prefix}-mpesa-details`,
        bank:  `${prefix}-bank-details`,
        card:  `${prefix}-card-details`,
      };
      if (map[val]) {
        const el = document.getElementById(map[val]);
        if (el) {
          el.style.display = 'block';
          el.style.animation = 'fadeSlide 0.3s ease';
        }
      }

      // Highlight selected method card
      document.querySelectorAll(`#${prefix === 'a' ? 'form-agency' : 'form-insurance'} .method-card`).forEach(card => {
        card.style.borderColor = '';
      });
    });
  });
}

setupMethodListeners('a');  // agency
setupMethodListeners('i');  // insurance

// ----- CARD NUMBER FORMATTING -----
function setupCardFormat(inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.addEventListener('input', () => {
    let v = input.value.replace(/\D/g, '').substring(0, 16);
    input.value = v.replace(/(.{4})/g, '$1 ').trim();
  });
}
setupCardFormat('a-card-num');
setupCardFormat('i-card-num');

// Expiry format MM/YY
['a-card-exp', 'i-card-exp'].forEach(id => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('input', () => {
    let v = el.value.replace(/\D/g, '').substring(0, 4);
    if (v.length > 2) v = v.slice(0,2) + '/' + v.slice(2);
    el.value = v;
  });
});

// ----- GENERATE REFERENCE NUMBER -----
function generateRef(type) {
  const prefix = type === 'agency' ? 'AGN' : 'INS';
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  const time = Date.now().toString().slice(-5);
  return `${prefix}-${time}-${rand}`;
}

// ----- FORM SUBMIT -----
function handleSubmit(event, type) {
  event.preventDefault();
  const form = event.target;

  // Validate a payment method is selected
  const method = form.querySelector(`input[name="${type === 'agency' ? 'a' : 'i'}-method"]:checked`);
  if (!method) {
    showToast('⚠️ Please select a payment method');
    return;
  }

  // Show loading state
  const btn = form.querySelector('.btn-submit');
  const originalText = btn.querySelector('.btn-text').textContent;
  btn.disabled = true;
  btn.querySelector('.btn-text').textContent = 'Processing...';
  btn.querySelector('.btn-arrow').textContent = '⏳';

  // Simulate processing delay
  setTimeout(() => {
    btn.disabled = false;
    btn.querySelector('.btn-text').textContent = originalText;
    btn.querySelector('.btn-arrow').textContent = '→';

    const ref = generateRef(type);
    showSuccessModal(type, ref);
    form.reset();

    // Hide all method detail panels
    document.querySelectorAll('.method-details').forEach(el => el.style.display = 'none');
  }, 1800);
}

// ----- SUCCESS MODAL -----
function showSuccessModal(type, ref) {
  const isAgency = type === 'agency';
  document.getElementById('modal-title').textContent = isAgency
    ? '🏢 Agency Payment Submitted!'
    : '🛡️ Insurance Payment Submitted!';
  document.getElementById('modal-msg').textContent =
    'Your payment details have been received. A confirmation receipt will be sent to your email address shortly.';
  document.getElementById('ref-box').textContent = `Reference: ${ref}`;
  document.getElementById('successModal').classList.add('show');
}

function closeModal() {
  document.getElementById('successModal').classList.remove('show');
}

// Close modal on backdrop click
document.getElementById('successModal').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

// ----- TOAST NOTIFICATION -----
function showToast(msg) {
  const existing = document.getElementById('toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'toast';
  toast.textContent = msg;
  Object.assign(toast.style, {
    position: 'fixed',
    bottom: '28px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: '#1e293b',
    border: '1px solid rgba(255,255,255,0.1)',
    color: '#f1f5f9',
    padding: '12px 24px',
    borderRadius: '10px',
    fontSize: '0.9rem',
    fontWeight: '600',
    fontFamily: "'Inter', sans-serif",
    zIndex: '999',
    boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
    animation: 'fadeSlide 0.3s ease',
  });

  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ----- SMOOTH SCROLL on logo -----
document.querySelector('.logo').style.cursor = 'pointer';
document.querySelector('.logo').addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
