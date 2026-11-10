/**
 * INTEGRATED BLASTING PLAN & DASHBOARD PLATFORM
 * Module: APPLICATION BOOTSTRAP & INITIALIZATION
 * Menginisialisasi event listeners, inisialisasi state tanggal hari ini (WITA), restore session, dan registrasi service worker.
 */

window.addEventListener('DOMContentLoaded', () => {
  const todayWita = getWitaDateString();
  const dateFilter = document.getElementById('global-date-filter');
  if (dateFilter) dateFilter.value = todayWita;
  const inputTgl = document.getElementById('input_tanggal');
  if (inputTgl) inputTgl.value = todayWita;
  const supTgl = document.getElementById('sup_readiness_tanggal');
  if (supTgl) supTgl.value = todayWita;

  const formDateTag = document.getElementById('form-date-today-tag');
  if (formDateTag) formDateTag.innerText = 'Tanggal: ' + todayWita;
  const supFormDate = document.getElementById('supplier-form-date');
  if (supFormDate) supFormDate.innerText = 'Tanggal: ' + todayWita;

  if (typeof initTableSplitResizer === 'function') initTableSplitResizer();
  if (typeof renderPlanNeedMmuChips === 'function') renderPlanNeedMmuChips();
  if (typeof renderMmuChips === 'function') renderMmuChips();
  if (typeof handleSupplierCompanyRosterChange === 'function') handleSupplierCompanyRosterChange();

  const savedUser = sessionStorage.getItem('blasting_user');
  if (savedUser) {
    try {
      currentUser = JSON.parse(savedUser);
      initAuthenticatedUI();
    } catch (e) {
      showLoginScreen();
    }
  } else {
    showLoginScreen();
  }
});

// Registrasi Service Worker PWA (Offline & Fast Caching)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then(reg => {
      console.log('Blasting PWA Service Worker aktif:', reg.scope);
    }).catch(err => {
      console.warn('Gagal registrasi Service Worker:', err);
    });
  });
}

