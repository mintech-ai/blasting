/**
 * INTEGRATED BLASTING PLAN & DASHBOARD PLATFORM
 * Module: API SERVICE
 * Komunikasi data asinkron via Fetch API ke Google Apps Script backend.
 */

async function apiCall(action, payload = {}) {
  const url = SCRIPT_URL;
  const requestBody = { action, ...payload };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(requestBody)
    });
    const json = await response.json();
    return json;
  } catch (err) {
    console.error('API Call Error:', err);
    return { success: false, message: 'Gagal menghubungi server, periksa koneksi internet Anda.' };
  }
}

async function fetchDashboardData() {
  return await apiCall('getDashboardData', {
    role: 'DASHBOARD',
    company: '',
    tanggal: ''
  });
}

async function refreshData(showToast = true, useCacheFirst = true) {
  const dateInput = document.getElementById('global-date-filter');
  const filterDate = (dateInput && dateInput.value) ? dateInput.value : getWitaDateString();

  // Stale-While-Revalidate: Tampilkan data dari cache secara instan jika ada
  if (useCacheFirst && (!rawGlobalPlanData || rawGlobalPlanData.length === 0)) {
    try {
      const cached = sessionStorage.getItem('blasting_dashboard_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && Array.isArray(parsed.planData) && parsed.planData.length > 0) {
          rawGlobalPlanData = parsed.planData;
          rawGlobalSupplierData = parsed.supplierData || [];
          filterAndRenderDashboard(filterDate);
        }
      }
    } catch (e) {
      console.warn('Cache read error:', e);
    }
  }

  showGlobalLoading();
  const icon = document.getElementById('refresh-icon');
  if (icon) icon.classList.add('animate-spin');

  try {
    const res = await fetchDashboardData();

    if (icon) icon.classList.remove('animate-spin');

    if (res && res.success) {
      rawGlobalPlanData = res.planData || [];
      rawGlobalSupplierData = res.supplierData || [];

      // Simpan ke cache untuk percepatan load berikutnya
      try {
        sessionStorage.setItem('blasting_dashboard_cache', JSON.stringify({
          planData: rawGlobalPlanData,
          supplierData: rawGlobalSupplierData,
          time: Date.now()
        }));
      } catch (e) { }

      filterAndRenderDashboard(filterDate);

      if (showToast) {
        const Toast = Swal.mixin({
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 2000
        });
        Toast.fire({ icon: 'success', title: 'Data berhasil diperbarui' });
      }
    } else {
      Swal.fire({
        icon: 'error',
        title: 'Gagal Memuat Data',
        text: (res && res.message) || 'Gagal terhubung ke server, coba lagi'
      });
    }
  } catch (err) {
    if (icon) icon.classList.remove('animate-spin');
    console.error('refreshData error:', err);
  } finally {
    hideGlobalLoading();
  }
}

