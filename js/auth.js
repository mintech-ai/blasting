/**
 * INTEGRATED BLASTING PLAN & DASHBOARD PLATFORM
 * Module: AUTHENTICATION & NAVIGATION
 * Menangani login, logout, sesi pengguna, hak akses berbasis role, dan perpindahan navigasi tab.
 */

async function handleLoginSubmit(event) {
  event.preventDefault();
  const uInput = document.getElementById('login-username').value.trim();
  const pInput = document.getElementById('login-password').value.trim();

  const btn = document.getElementById('btn-login-submit');
  btn.disabled = true;
  btn.innerHTML = `<i class="ph-bold ph-spinner animate-spin text-lg"></i> Memeriksa Akun...`;

  const res = await apiCall('login', { username: uInput, password: pInput });

  btn.disabled = false;
  btn.innerHTML = `<i class="ph-bold ph-sign-in text-lg"></i> MASUK PORTAL`;

  if (res.success && res.user) {
    currentUser = res.user;
    sessionStorage.setItem('blasting_user', JSON.stringify(currentUser));
    if (res.token) {
      sessionStorage.setItem('blasting_token', res.token);
    }
    Swal.fire({
      icon: 'success',
      title: 'Login Berhasil',
      text: `Selamat datang ${currentUser.username} (${cleanCompanyName(currentUser.company)})`,
      timer: 1500,
      showConfirmButton: false
    });
    initAuthenticatedUI();
  } else {
    Swal.fire({
      icon: 'error',
      title: 'Gagal Login',
      text: (res && res.message) || 'Username atau password salah, periksa kembali akun Anda.'
    });
  }
}

function confirmLogout() {
  Swal.fire({
    title: 'Konfirmasi Keluar',
    text: 'Apakah Anda yakin ingin keluar dari portal?',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Iya',
    cancelButtonText: 'Tidak',
    confirmButtonColor: '#dc2626',
    cancelButtonColor: '#64748b'
  }).then((result) => {
    if (result.isConfirmed) {
      sessionStorage.removeItem('blasting_user');
      sessionStorage.removeItem('blasting_token');
      currentUser = null;
      showLoginScreen();
    }
  });
}

function showLoginScreen() {
  const loginModal = document.getElementById('screen-login');
  if (loginModal) {
    loginModal.classList.remove('screen-hidden');
    loginModal.classList.add('screen-visible');
  }
}

function initAuthenticatedUI() {
  const loginModal = document.getElementById('screen-login');
  if (loginModal) {
    loginModal.classList.remove('screen-visible');
    loginModal.classList.add('screen-hidden');
  }

  const formattedCompany = cleanCompanyName(currentUser.company);
  const roleBadge = document.getElementById('active-role-badge');
  if (roleBadge) roleBadge.innerText = currentUser.username || 'USER';

  const brandEl = document.getElementById('app-company-brand');
  if (brandEl) brandEl.innerText = 'PT ADARO INDONESIA';

  const formComp = document.getElementById('form-badge-company');
  if (formComp) formComp.innerText = formattedCompany.toUpperCase();

  configureRoleViews();
  if (typeof updateBoundaryUIState === 'function') updateBoundaryUIState();
  refreshData(false);
}

function configureRoleViews() {
  if (!currentUser) return;
  const role = (currentUser.role || '').toUpperCase();
  const company = (currentUser.company || '').toUpperCase();

  const kForm = document.getElementById('container-kontraktor-form');
  const kForecast = document.getElementById('container-kontraktor-forecast-form');
  const subTabSelector = document.getElementById('kontraktor-sub-tab-selector');
  const sForm = document.getElementById('container-supplier-form');
  const navFormBtn = document.getElementById('nav-btn-form');
  const btnTambahPlan = document.getElementById('btn-tambah-plan-container');
  const supBtnContainer = document.getElementById('supplier-readiness-add-btn-container');
  const ownerSelector = document.getElementById('owner-form-selector');
  const kontraktorSelectField = document.getElementById('container-kontraktor-select-field');

  if (isUserOwner()) {
    // OWNER / ADMIN: Akses penuh ke form plan kontraktor dan kesiapan supplier
    if (navFormBtn) navFormBtn.classList.remove('hidden');
    if (btnTambahPlan) btnTambahPlan.classList.remove('hidden');
    if (supBtnContainer) {
      supBtnContainer.classList.remove('hidden');
      supBtnContainer.innerHTML = `
        <button onclick="switchView('form'); switchOwnerForm('supplier');" class="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm glow-amber">
          <i class="ph-bold ph-plus"></i> Input Kesiapan Supplier
        </button>
      `;
    }
    if (ownerSelector) ownerSelector.classList.remove('hidden');
    if (kontraktorSelectField) kontraktorSelectField.classList.remove('hidden');

    const supSel = document.getElementById('sup_readiness_supplier');
    if (supSel) supSel.disabled = false;

    const fcCompany = document.getElementById('forecast_perusahaan');
    if (fcCompany) {
      fcCompany.disabled = false;
      fcCompany.classList.remove('bg-slate-100', 'cursor-not-allowed');
    }

    switchOwnerForm('plan');
  } else if (role === 'KONTRAKTOR') {
    if (navFormBtn) navFormBtn.classList.remove('hidden');
    if (ownerSelector) ownerSelector.classList.add('hidden');
    if (kontraktorSelectField) kontraktorSelectField.classList.add('hidden');

    if (subTabSelector) subTabSelector.classList.remove('hidden');
    switchKontraktorSubTab('plan');
    if (sForm) sForm.classList.add('hidden');
    if (btnTambahPlan) btnTambahPlan.classList.remove('hidden');
    if (supBtnContainer) supBtnContainer.classList.add('hidden');

    // Auto set company di form forecast dan kunci sesuai akun login kontraktor
    const fcCompany = document.getElementById('forecast_perusahaan');
    if (fcCompany) {
      if (company && company.toUpperCase().includes('BUMA')) {
        fcCompany.value = 'PT BUMA';
      } else {
        fcCompany.value = 'PT SIS';
      }
      fcCompany.disabled = true;
      fcCompany.classList.add('bg-slate-100', 'cursor-not-allowed');
    }
  } else if (role === 'SUPPLIER') {
    if (navFormBtn) navFormBtn.classList.remove('hidden');
    if (ownerSelector) ownerSelector.classList.add('hidden');
    if (kontraktorSelectField) kontraktorSelectField.classList.add('hidden');

    // Supplier TIDAK MEMILIKI akses ke tab atau form forecast
    if (subTabSelector) subTabSelector.classList.add('hidden');
    if (kForm) kForm.classList.add('hidden');
    if (kForecast) kForecast.classList.add('hidden');
    if (sForm) sForm.classList.remove('hidden');
    if (btnTambahPlan) btnTambahPlan.classList.add('hidden');

    if (supBtnContainer) {
      supBtnContainer.classList.remove('hidden');
      supBtnContainer.innerHTML = `
        <button onclick="switchView('form')" class="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm glow-amber">
          <i class="ph-bold ph-plus"></i> Input Kesiapan Supplier
        </button>
      `;
    }

    const supSel = document.getElementById('sup_readiness_supplier');
    if (supSel) {
      if (company.includes('DAHANA')) {
        supSel.value = 'DAHANA';
        supSel.disabled = true;
      } else if (company.includes('MNK') || company.includes('KMB')) {
        supSel.value = 'MNK-KMB';
        supSel.disabled = true;
      } else {
        supSel.disabled = false;
      }
    }

    if (typeof renderMmuChips === 'function') renderMmuChips();
  } else {
    // Read-only dashboard view
    if (navFormBtn) navFormBtn.classList.add('hidden');
    if (btnTambahPlan) btnTambahPlan.classList.add('hidden');
    if (supBtnContainer) supBtnContainer.classList.add('hidden');
    if (ownerSelector) ownerSelector.classList.add('hidden');
    if (kontraktorSelectField) kontraktorSelectField.classList.add('hidden');

    if (kForm) kForm.classList.add('hidden');
    if (sForm) sForm.classList.add('hidden');
    switchView('dashboard');
  }
}

function switchKontraktorSubTab(type) {
  // Supplier tidak memiliki akses ke tab ataupun form kontraktor / forecast
  if (currentUser && currentUser.role === 'SUPPLIER') return;

  const kPlan = document.getElementById('container-kontraktor-form');
  const kForecast = document.getElementById('container-kontraktor-forecast-form');
  const btnPlan = document.getElementById('btn-subtab-kontraktor-plan');
  const btnForecast = document.getElementById('btn-subtab-kontraktor-forecast');

  if (type === 'plan') {
    if (kPlan) kPlan.classList.remove('hidden');
    if (kForecast) kForecast.classList.add('hidden');
    if (btnPlan) {
      btnPlan.className = "flex-1 py-2.5 rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-2 bg-red-600 text-white shadow-2xs cursor-pointer";
    }
    if (btnForecast) {
      btnForecast.className = "flex-1 py-2.5 rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-2 text-slate-600 hover:text-slate-900 cursor-pointer";
    }
  } else {
    if (kPlan) kPlan.classList.add('hidden');
    if (kForecast) kForecast.classList.remove('hidden');
    if (btnForecast) {
      btnForecast.className = "flex-1 py-2.5 rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-2 bg-blue-600 text-white shadow-2xs glow-blue cursor-pointer";
    }
    if (btnPlan) {
      btnPlan.className = "flex-1 py-2.5 rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-2 text-slate-600 hover:text-slate-900 cursor-pointer";
    }

    // Pastikan status lock/unlock perusahaan forecast selalu sinkron
    const fcCompany = document.getElementById('forecast_perusahaan');
    if (fcCompany) {
      if (isUserOwner()) {
        fcCompany.disabled = false;
        fcCompany.classList.remove('bg-slate-100', 'cursor-not-allowed');
      } else if (currentUser && currentUser.role === 'KONTRAKTOR') {
        const comp = currentUser.company || '';
        fcCompany.value = comp.toUpperCase().includes('BUMA') ? 'PT BUMA' : 'PT SIS';
        fcCompany.disabled = true;
        fcCompany.classList.add('bg-slate-100', 'cursor-not-allowed');
      }
    }

    if (typeof updateForecastCalculationPreview === 'function') {
      try {
        updateForecastCalculationPreview();
      } catch (e) {
        console.warn('Forecast preview warning:', e);
      }
    }
  }
}
window.switchKontraktorSubTab = switchKontraktorSubTab;

function switchOwnerForm(type) {
  const kForm = document.getElementById('container-kontraktor-form');
  const kForecast = document.getElementById('container-kontraktor-forecast-form');
  const subTabSelector = document.getElementById('kontraktor-sub-tab-selector');
  const sForm = document.getElementById('container-supplier-form');
  const btnPlan = document.getElementById('btn-owner-select-plan');
  const btnSup = document.getElementById('btn-owner-select-supplier');

  if (type === 'plan') {
    if (subTabSelector) subTabSelector.classList.remove('hidden');
    switchKontraktorSubTab('plan');
    if (sForm) sForm.classList.add('hidden');
    if (btnPlan) {
      btnPlan.className = "flex-1 py-2 rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-2 bg-red-600 text-white shadow-sm";
    }
    if (btnSup) {
      btnSup.className = "flex-1 py-2 rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-2 text-slate-600 hover:text-slate-900";
    }
  } else {
    if (subTabSelector) subTabSelector.classList.add('hidden');
    if (kForm) kForm.classList.add('hidden');
    if (kForecast) kForecast.classList.add('hidden');
    if (sForm) sForm.classList.remove('hidden');
    if (btnSup) {
      btnSup.className = "flex-1 py-2 rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-2 bg-amber-600 text-white shadow-sm glow-amber";
    }
    if (btnPlan) {
      btnPlan.className = "flex-1 py-2 rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-2 text-slate-600 hover:text-slate-900";
    }
    const supSel = document.getElementById('sup_readiness_supplier');
    if (supSel && isUserOwner()) {
      supSel.disabled = false;
    }
    if (typeof renderMmuChips === 'function') renderMmuChips();
  }
}

function switchView(viewName) {
  const vDash = document.getElementById('view-dashboard');
  const vMap = document.getElementById('view-map');
  const vForm = document.getElementById('view-form-entry');

  const btnDash = document.getElementById('nav-btn-dashboard');
  const btnMap = document.getElementById('nav-btn-map');
  const btnForm = document.getElementById('nav-btn-form');

  const inactiveBtn = "px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 text-slate-600 hover:text-slate-900";
  const activeBtn = "px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 bg-white text-red-600 shadow-sm";

  if (vDash) vDash.classList.add('hidden');
  if (vMap) vMap.classList.add('hidden');
  if (vForm) vForm.classList.add('hidden');

  if (btnDash) btnDash.className = inactiveBtn;
  if (btnMap) btnMap.className = inactiveBtn;
  if (btnForm) btnForm.className = inactiveBtn;

  const btnToggleTables = document.getElementById('btn-toggle-dashboard-tables');

  if (viewName === 'dashboard') {
    if (vDash) vDash.classList.remove('hidden');
    if (btnDash) btnDash.className = activeBtn;
    if (btnToggleTables) btnToggleTables.classList.remove('hidden');
  } else {
    if (btnToggleTables) btnToggleTables.classList.add('hidden');
    if (viewName === 'map') {
      if (vMap) {
        vMap.classList.remove('hidden');
        if (btnMap) btnMap.className = activeBtn;
        setTimeout(() => {
          if (typeof initBlastingMap === 'function') initBlastingMap();
          if (typeof renderBlastingMapMarkers === 'function') renderBlastingMapMarkers();
          if (blastingMap) blastingMap.invalidateSize();
        }, 60);
        setTimeout(() => {
          if (blastingMap) blastingMap.invalidateSize();
        }, 250);
      }
    } else {
      if (vForm) vForm.classList.remove('hidden');
      if (btnForm) btnForm.className = activeBtn;
    }
  }
}

