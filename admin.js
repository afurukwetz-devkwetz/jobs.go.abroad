document.addEventListener('DOMContentLoaded', () => {
  let allApplicants = [];
  let currentApplicant = null;

  const tableBody = document.getElementById('applicantsBody');
  const filterStatus = document.getElementById('filterStatus');
  const modal = document.getElementById('applicantModal');
  const closeBtn = document.querySelector('.close-btn');

  const loginSection = document.getElementById('login-section');
  const adminSection = document.getElementById('admin-section');
  const loginForm = document.getElementById('adminLoginForm');
  const loginError = document.getElementById('loginError');
  const logoutBtn = document.getElementById('logoutBtn');

  // Check auth on load
  const token = localStorage.getItem('adminToken');
  if (token) {
    showDashboard();
  } else {
    showLogin();
  }

  // --- Auth Logic ---
  function showLogin() {
    loginSection.style.display = 'flex';
    adminSection.style.display = 'none';
  }

  function showDashboard() {
    loginSection.style.display = 'none';
    adminSection.style.display = 'block';
    fetchApplicants();
  }

  function logout() {
    localStorage.removeItem('adminToken');
    showLogin();
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.textContent = '';
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
      const res = await fetch(API_BASE_URL + '/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('adminToken', data.token);
        showDashboard();
      } else {
        loginError.textContent = data.error || 'Login failed';
      }
    } catch (err) {
      loginError.textContent = 'Server error during login';
    }
  });

  logoutBtn.addEventListener('click', logout);

  // --- Dashboard Logic ---
  
  // Event Listeners
  document.getElementById('refreshBtn').addEventListener('click', fetchApplicants);
  filterStatus.addEventListener('change', renderTable);
  
  closeBtn.addEventListener('click', () => modal.style.display = 'none');
  window.addEventListener('click', (e) => {
    if (e.target === modal) modal.style.display = 'none';
  });

  document.getElementById('btnApprove').addEventListener('click', () => updateStatus('Approved', 4));
  document.getElementById('btnReject').addEventListener('click', () => updateStatus('Rejected', 4));
  document.getElementById('btnPending').addEventListener('click', () => updateStatus('Pending', 0));

  function getAuthHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
    };
  }

  async function fetchApplicants() {
    try {
      const res = await fetch(API_BASE_URL + '/api/track/applicants', {
        headers: getAuthHeaders()
      });
      
      if (res.status === 401 || res.status === 403) {
        alert('Session expired. Please log in again.');
        return logout();
      }

      const data = await res.json();
      allApplicants = data;
      updateStats();
      renderTable();
    } catch (err) {
      console.error('Failed to fetch applicants', err);
      alert('Error fetching data. Check server console.');
    }
  }

  function updateStats() {
    document.getElementById('statTotal').textContent = allApplicants.length;
    document.getElementById('statPending').textContent = allApplicants.filter(a => a.status === 'Pending').length;
    document.getElementById('statApproved').textContent = allApplicants.filter(a => a.status === 'Approved').length;
    document.getElementById('statRejected').textContent = allApplicants.filter(a => a.status === 'Rejected').length;
  }

  function renderTable() {
    const filter = filterStatus.value;
    const filtered = filter === 'all' 
      ? allApplicants 
      : allApplicants.filter(a => a.status === filter);

    tableBody.innerHTML = '';
    
    if(filtered.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;">No applicants found</td></tr>`;
      return;
    }

    filtered.forEach(app => {
      const tr = document.createElement('tr');
      const date = new Date(app.createdAt).toLocaleDateString();
      const statusClass = app.status ? `status-${app.status.toLowerCase()}` : 'status-pending';
      const statusText = app.status || 'Pending';

      tr.innerHTML = `
        <td><strong>${app.refNumber || 'N/A'}</strong></td>
        <td>${app.firstName} ${app.lastName}</td>
        <td>${app.profession}</td>
        <td>${date}</td>
        <td><span class="status-badge ${statusClass}">${statusText}</span></td>
        <td><button class="btn btn-secondary btn-sm" onclick="viewApplicant('${app.refNumber}')">Review</button></td>
      `;
      tableBody.appendChild(tr);
    });
  }

  // Expose to window for inline onclick
  window.viewApplicant = (refNumber) => {
    currentApplicant = allApplicants.find(a => a.refNumber === refNumber);
    if (!currentApplicant) return;

    document.getElementById('modalName').textContent = `${currentApplicant.firstName} ${currentApplicant.lastName}`;
    document.getElementById('modalRef').textContent = `REF: ${currentApplicant.refNumber}`;
    document.getElementById('modalEmail').textContent = currentApplicant.email;
    document.getElementById('modalPhone').textContent = currentApplicant.phone || 'N/A';
    document.getElementById('modalCountry').textContent = currentApplicant.country || 'N/A';
    document.getElementById('modalProfession').textContent = currentApplicant.profession;
    document.getElementById('modalExperience').textContent = currentApplicant.experience || '0';
    document.getElementById('modalQualification').textContent = currentApplicant.qualification || 'N/A';
    document.getElementById('modalBio').textContent = currentApplicant.bio || 'No bio provided.';
    
    const cvLink = document.getElementById('modalCV');
    if (currentApplicant.cvFile) {
      cvLink.href = `${API_BASE_URL}/${currentApplicant.cvFile.replace(/\\/g, '/')}`; // full Render URL for CV files
      cvLink.style.display = 'inline-block';
    } else {
      cvLink.style.display = 'none';
    }

    modal.style.display = 'flex';
  };

  async function updateStatus(newStatus, step) {
    if (!currentApplicant) return;

    try {
      const res = await fetch(API_BASE_URL + '/api/track/update', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          refNumber: currentApplicant.refNumber,
          status: newStatus,
          step: step,
          note: `Application ${newStatus.toLowerCase()}`
        })
      });

      if (res.status === 401 || res.status === 403) {
        alert('Session expired. Please log in again.');
        return logout();
      }

      const data = await res.json();
      if (data.success) {
        alert(`Successfully marked as ${newStatus}`);
        modal.style.display = 'none';
        fetchApplicants(); // Refresh data
      } else {
        alert(data.error || 'Failed to update status');
      }
    } catch (err) {
      console.error(err);
      alert('Error updating status');
    }
  }

});
