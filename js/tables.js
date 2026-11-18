/**
 * INTEGRATED BLASTING PLAN & DASHBOARD PLATFORM
 * Module: DATA TABLES & RECORD MANAGEMENT
 * Menangani render tabel rencana peledakan, tabel kesiapan supplier, pengecekan otorisasi edit/delete, dan penghapusan baris.
 */

function checkCanEditPlan(item) {
  if (!currentUser) return false;
  if (isUserOwner()) return true;

  const userComp = cleanCompanyName(currentUser.company).toUpperCase();
  const planKont = cleanCompanyName(item.kontraktor).toUpperCase();
  const planSup = cleanCompanyName(item.supplier).toUpperCase();

  if (isUserKontraktor()) {
    return planKont === userComp || planKont.includes(userComp) || userComp.includes(planKont);
  }

  if (isUserSupplier()) {
    return !item.supplier || planSup === userComp || planSup.includes(userComp) || userComp.includes(planSup);
  }

  return false;
}

// Aturan Otoritas Hapus Plan Blasting:
// 1. SIS hanya bs hapus pny SIS
// 2. BUMA hny bs hapus pny BUMA
// 5. ADARO bs hapus semua
function checkCanDeletePlan(item) {
  if (!currentUser || !item) return false;
  if (isUserOwner()) return true;
  if (isUserSupplier()) return false;

  if (isUserKontraktor()) {
    const userComp = (currentUser.company || '').toUpperCase().replace(/^PT\.?\s+/i, '').trim();
    const planKont = String(item.kontraktor || '').toUpperCase().replace(/^PT\.?\s+/i, '').trim();

    if (userComp.includes('SIS') && planKont.includes('SIS')) return true;
    if (userComp.includes('BUMA') && planKont.includes('BUMA')) return true;

    return userComp !== '' && userComp === planKont;
  }

  return false;
}

// Aturan Otoritas Hapus Kesiapan Supplier:
// 3. DAHANA hny bs hapus KESIAPAN SUPPLIER DAHANA
// 4. MNK KMB hny bs hapus KESIAPAN SUPPLIER MNK-KMB
// 5. ADARO bs hapus semua
function checkCanDeleteSupplier(item) {
  if (!currentUser || !item) return false;
  if (isUserOwner()) return true;
  if (isUserKontraktor()) return false;

  if (isUserSupplier()) {
    const userComp = (currentUser.company || '').toUpperCase().replace(/^PT\.?\s+/i, '').trim();
    const supName = String(item.supplier || '').toUpperCase().replace(/^PT\.?\s+/i, '').trim();

    if (userComp.includes('DAHANA') && supName.includes('DAHANA')) return true;
    if ((userComp.includes('MNK') || userComp.includes('KMB')) && (supName.includes('MNK') || supName.includes('KMB'))) return true;

    return userComp !== '' && userComp === supName;
  }

  return false;
}

async function handleDeletePlan(uuid) {
  if (!uuid) return;
  const item = globalPlanData.find(x => String(x.uuid || x.id).trim() === String(uuid).trim());
  if (!item) {
    Swal.fire({ icon: 'error', title: 'Data Tidak Ditemukan', text: 'UUID Plan Blasting tidak ditemukan' });
    return;
  }

  if (!checkCanDeletePlan(item)) {
    Swal.fire({
      icon: 'error',
      title: 'Akses Ditolak',
      text: 'Anda tidak memiliki hak akses untuk menghapus plan peledakan ini.'
    });
    return;
  }

  const result = await Swal.fire({
    title: 'Hapus Plan Blasting?',
    html: `Apakah Anda yakin ingin menghapus data plan peledakan di area <b>${item.lokasi || '-'}</b> (${cleanCompanyName(item.kontraktor)}) tanggal <b>${item.tanggal || '-'}</b>?<br><span class="text-xs text-rose-600 font-bold mt-1 block">Tindakan ini tidak dapat dibatalkan.</span>`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#dc2626',
    cancelButtonColor: '#64748b',
    confirmButtonText: '<i class="ph-bold ph-trash"></i> Ya, Hapus Plan',
    cancelButtonText: 'Batal'
  });

  if (!result.isConfirmed) return;

  const pinOk = await requestSecurityPin(`menghapus data plan peledakan #${uuid}`);
  if (!pinOk) return;

  Swal.fire({
    title: 'Menghapus Data...',
    text: 'Sedang memproses penghapusan plan...',
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  });

  try {
    const res = await apiCall('deletePlan', {
      uuid: uuid,
      data: { uuid: uuid },
      role: isUserOwner() ? 'ADMIN' : currentUser.role,
      company: currentUser ? currentUser.company : ''
    });

    if (res && res.success) {
      Swal.fire({
        icon: 'success',
        title: 'Berhasil Dihapus',
        text: res.message || 'Plan blasting berhasil dihapus.',
        timer: 1500,
        showConfirmButton: false
      });
      if (typeof closeEditModal === 'function') closeEditModal();
      refreshData(false);
    } else {
      if (res && res.message && res.message.includes('not supported')) {
        rawGlobalPlanData = rawGlobalPlanData.filter(x => String(x.uuid || x.id).trim() !== String(uuid).trim());
        globalPlanData = globalPlanData.filter(x => String(x.uuid || x.id).trim() !== String(uuid).trim());
        const filterDate = document.getElementById('global-date-filter').value || getWitaDateString();
        filterAndRenderDashboard(filterDate);
        if (typeof closeEditModal === 'function') closeEditModal();
        Swal.fire({
          icon: 'warning',
          title: 'Hapus Lokal Selesai',
          html: 'Data telah dihapus dari tampilan saat ini.<br><br><span class="text-xs text-slate-600">Catatan: Backend Google Apps Script Anda memerlukan penambahan handler <code>deletePlan</code> agar terhapus permanen dari Google Sheets.</span>'
        });
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Gagal Menghapus',
          text: (res && res.message) || 'Gagal menghapus plan, coba lagi nanti.'
        });
      }
    }
  } catch (err) {
    Swal.fire({
      icon: 'error',
      title: 'Kesalahan Jaringan',
      text: err.toString()
    });
  }
}

function handleDeletePlanFromModal() {
  const uuid = document.getElementById('edit_uuid').value;
  if (uuid) handleDeletePlan(uuid);
}

async function handleDeleteSupplier(uuid) {
  if (!uuid) return;
  const item = globalSupplierData.find(x => String(x.uuid || x.id).trim() === String(uuid).trim());
  if (!item) {
    Swal.fire({ icon: 'error', title: 'Data Tidak Ditemukan', text: 'UUID Kesiapan Supplier tidak ditemukan' });
    return;
  }

  if (!checkCanDeleteSupplier(item)) {
    Swal.fire({
      icon: 'error',
      title: 'Akses Ditolak',
      text: 'Anda tidak memiliki hak akses untuk menghapus data kesiapan supplier ini.'
    });
    return;
  }

  const result = await Swal.fire({
    title: 'Hapus Kesiapan Supplier?',
    html: `Apakah Anda yakin ingin menghapus data kesiapan supplier <b>${cleanCompanyName(item.supplier)}</b> tanggal <b>${item.tanggal || '-'}</b>?<br><span class="text-xs text-rose-600 font-bold mt-1 block">Tindakan ini tidak dapat dibatalkan.</span>`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#dc2626',
    cancelButtonColor: '#64748b',
    confirmButtonText: '<i class="ph-bold ph-trash"></i> Ya, Hapus Kesiapan',
    cancelButtonText: 'Batal'
  });

  if (!result.isConfirmed) return;

  const pinOk = await requestSecurityPin(`menghapus data kesiapan supplier #${uuid}`);
  if (!pinOk) return;

  Swal.fire({
    title: 'Menghapus Data...',
    text: 'Sedang memproses penghapusan data kesiapan...',
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  });

  try {
    const res = await apiCall('deleteKesiapan', {
      uuid: uuid,
      data: { uuid: uuid },
      role: isUserOwner() ? 'ADMIN' : currentUser.role,
      company: currentUser ? currentUser.company : ''
    });

    if (res && res.success) {
      Swal.fire({
        icon: 'success',
        title: 'Berhasil Dihapus',
        text: res.message || 'Data kesiapan supplier berhasil dihapus.',
        timer: 1500,
        showConfirmButton: false
      });
      if (typeof closeEditSupplierModal === 'function') closeEditSupplierModal();
      refreshData(false);
    } else {
      if (res && res.message && res.message.includes('not supported')) {
        rawGlobalSupplierData = rawGlobalSupplierData.filter(x => String(x.uuid || x.id).trim() !== String(uuid).trim());
        globalSupplierData = globalSupplierData.filter(x => String(x.uuid || x.id).trim() !== String(uuid).trim());
        const filterDate = document.getElementById('global-date-filter').value || getWitaDateString();
        filterAndRenderDashboard(filterDate);
        if (typeof closeEditSupplierModal === 'function') closeEditSupplierModal();
        Swal.fire({
          icon: 'warning',
          title: 'Hapus Lokal Selesai',
          html: 'Data telah dihapus dari tampilan saat ini.<br><br><span class="text-xs text-slate-600">Catatan: Backend Google Apps Script Anda memerlukan penambahan handler <code>deleteKesiapan</code> agar terhapus permanen dari Google Sheets.</span>'
        });
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Gagal Menghapus',
          text: (res && res.message) || 'Gagal menghapus data kesiapan supplier, coba lagi nanti.'
        });
      }
    }
  } catch (err) {
    Swal.fire({
      icon: 'error',
      title: 'Kesalahan Jaringan',
      text: err.toString()
    });
  }
}

function handleDeleteSupplierFromModal() {
  const uuid = document.getElementById('edit_sup_uuid').value;
  if (uuid) handleDeleteSupplier(uuid);
}

function renderPlanBlastingTable() {
  const tbody = document.getElementById('tbody-plan-blasting');
  if (!tbody) return;

  if (globalPlanData.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="20" class="px-4 py-8 text-center text-slate-400 italic">
          Tidak ada data plan blasting untuk tanggal ini.
        </td>
      </tr>
    `;
    return;
  }

  // Urutan kontraktor: SIS dulu, baru BUMA, lalu lainnya.
  // Urutan lokasi di dalam tiap kontraktor tetap mempertahankan urutan asli inputan Bulk Excel / spreadsheet.
  const getRank = (item) => {
    const k = String(item.kontraktor || '').toUpperCase();
    if (k.includes('SIS')) return 1;
    if (k.includes('BUMA')) return 2;
    return 99;
  };

  const rawIndexMap = new Map();
  if (Array.isArray(rawGlobalPlanData)) {
    rawGlobalPlanData.forEach((item, idx) => {
      const k = String(item.uuid || item.id || idx);
      if (!rawIndexMap.has(k)) rawIndexMap.set(k, idx);
    });
  }

  globalPlanData.sort((a, b) => {
    const rankA = getRank(a);
    const rankB = getRank(b);
    if (rankA !== rankB) return rankA - rankB;
    const keyA = String(a.uuid || a.id || '');
    const keyB = String(b.uuid || b.id || '');
    const idxA = rawIndexMap.has(keyA) ? rawIndexMap.get(keyA) : 0;
    const idxB = rawIndexMap.has(keyB) ? rawIndexMap.get(keyB) : 0;
    return idxA - idxB;
  });

  // Update banner Monthly Forecast MMU di header tabel
  if (typeof getMonthlyForecastStats === 'function') {
    const fStats = getMonthlyForecastStats();
    const sisEl = document.getElementById('header-forecast-sis');
    const bumaEl = document.getElementById('header-forecast-buma');
    if (sisEl) sisEl.innerText = `SIS: ${fStats.sisDth.toFixed(2)} T`;
    if (bumaEl) bumaEl.innerText = `BUMA: ${fStats.bumaDth.toFixed(2)} T`;
  }

  // Revisi 18: MMU multi-lokasi diberi penanda urutan pengerjaan (P1, P2, P3...)
  const mmuLocationCount = new Map();
  globalPlanData.forEach(p => {
    const rawMmu = p.unit_mmu || '';
    const parsed = parseAllocatedMmuInfo(rawMmu);
    if (parsed && parsed.items) {
      parsed.items.forEach(it => {
        const code = it.code.trim().toUpperCase();
        mmuLocationCount.set(code, (mmuLocationCount.get(code) || 0) + 1);
      });
    }
  });
  const mmuCurrentOrder = new Map();

  let html = '';
  globalPlanData.forEach((item, index) => {
    const rowNo = index + 1;
    const id = item.uuid || item.id || '-';
    const safeId = sanitizeId(id);
    const kontraktor = cleanCompanyName(item.kontraktor) || '-';
    const lokasi = item.lokasi || '-';
    const rawPrio = String(item.prioritas || 'P1').toUpperCase();
    const prioritas = rawPrio.includes('2') ? 'P2' : 'P1';
    const todaySleep = getPlanTodaySleepStatus(item);
    const inisiasi = item.inisiasi || '-';
    const jamMasuk = formatExcelTime(item.jam_masuk || item.jam);
    const holes = item.jumlah_holes || item.holes || 0;
    const isian = Math.round(Number(item.isian_kg || item.isian || 0));
    const vol = Number(item.volume_ton || item.volume || 0).toFixed(2);
    const akses = item.akses || '-';
    const remark = item.remark || item.kondisi_remark || '-';
    const pengawasKont = item.pengawas_kontraktor || '-';
    const sup = item.supplier ? cleanCompanyName(item.supplier) : '';
    const unitBox = item.unit_box || '-';

    // Format MMU dengan penanda urutan multi-lokasi (misal: 0.5 MMU 120 P1)
    let unitMmuDisplay = item.unit_mmu || '-';
    if (item.unit_mmu && item.unit_mmu !== '-') {
      const parsedMmu = parseAllocatedMmuInfo(item.unit_mmu);
      if (parsedMmu && parsedMmu.items && parsedMmu.items.length > 0) {
        const parts = parsedMmu.items.map(it => {
          const codeUpper = it.code.trim().toUpperCase();
          const isMulti = (mmuLocationCount.get(codeUpper) || 0) > 1;
          if (isMulti) {
            const nextOrder = (mmuCurrentOrder.get(codeUpper) || 0) + 1;
            mmuCurrentOrder.set(codeUpper, nextOrder);
            return `${it.qty} ${it.code} P${nextOrder}`;
          }
          return `${it.qty} ${it.code}`;
        });
        const totalTonStr = parsedMmu.totalDth > 0 ? ` (${parsedMmu.totalDth.toFixed(2)} Ton)` : '';
        unitMmuDisplay = `${parts.join(', ')}${totalTonStr}`;
      }
    }

    const rawSpv = item.pengawas_supplier || item.supervisor || '-';
    const cleanSpv = cleanManpowerString(rawSpv);

    const rawBlaster = item.blaster || item.jumlah_blaster || item.nama_blaster || '-';
    const cleanBlaster = cleanManpowerString(rawBlaster);

    const canEdit = checkCanEditPlan(item);
    const canDelete = checkCanDeletePlan(item);

    let supBadge = '';
    if (sup) {
      const isDahana = sup.toUpperCase().includes('DAHANA');
      supBadge = `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold ${isDahana ? 'bg-amber-100 text-amber-800' : 'bg-purple-100 text-purple-800'}">${escapeHtml(sup)}</span>`;
    } else {
      supBadge = `<span class="text-slate-400 italic text-[10px]">-</span>`;
    }

    const statusBadge = getStatusBadgeHtml(todaySleep);

    // Revisi 9: Edit dan Hapus dijadikan atas bawah penempatan tombolnya biar ringkes
    // Revisi 12: fallback passing index agar tombol edit selalu bisa dibuka
    const editBtn = canEdit
      ? `<button onclick="openEditPlanModal('${safeId}', ${index})" class="w-full px-1.5 py-0.5 bg-red-50 hover:bg-red-600 hover:text-white text-red-600 font-bold rounded transition text-[9.5px] flex items-center justify-center gap-0.5 shadow-2xs cursor-pointer" title="Edit Plan">
           <i class="ph-bold ph-pencil-simple text-[10px]"></i> Edit
         </button>`
      : '';

    const deleteBtn = canDelete
      ? `<button onclick="handleDeletePlan('${safeId}')" class="w-full px-1.5 py-0.5 bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-600 font-bold rounded transition text-[9.5px] flex items-center justify-center gap-0.5 shadow-2xs cursor-pointer" title="Hapus Plan">
           <i class="ph-bold ph-trash text-[10px]"></i> Hapus
         </button>`
      : '';

    let actionBtns = '';
    if (editBtn || deleteBtn) {
      actionBtns = `<div class="flex flex-col items-center justify-center gap-1 w-11 mx-auto">${editBtn}${deleteBtn}</div>`;
    } else {
      actionBtns = `<button disabled title="Anda tidak memiliki hak akses mengubah/menghapus baris ini" class="px-1.5 py-0.5 bg-slate-50 text-slate-300 font-medium rounded text-[9.5px] flex items-center justify-center gap-0.5 mx-auto cursor-not-allowed border border-slate-100">
           <i class="ph-bold ph-lock-key"></i> Kunci
         </button>`;
    }

    html += `
      <tr id="row-plan-${safeId}" class="hover:bg-slate-50 transition border-b border-slate-100 text-[10.5px]">
        <td class="px-1 py-1 text-center whitespace-nowrap">
          ${actionBtns}
        </td>
        <td class="px-1.5 py-1 text-center font-mono font-bold text-slate-800">${rowNo}</td>
        <td class="px-1.5 py-1 text-center font-bold text-slate-800 font-mono">${escapeHtml(prioritas)}</td>
        <td class="px-1.5 py-1 font-extrabold text-slate-900">${escapeHtml(kontraktor)}</td>
        <td class="px-1.5 py-1 font-bold text-slate-800">
          <div class="flex items-center gap-1.5 flex-wrap">
            <span>${escapeHtml(lokasi)}</span>
            ${item.geometry
              ? `<button type="button" onclick="openAllocateBoundaryModalForPlan('${safeId}')" class="text-[8px] bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-extrabold px-1.5 py-0.5 rounded border border-emerald-300 flex items-center gap-0.5 transition shadow-2xs cursor-pointer" title="Boundary Polygon aktif. Klik untuk ubah alokasi"><i class="ph-bold ph-polygon"></i> Geo</button>`
              : `<button type="button" onclick="openAllocateBoundaryModalForPlan('${safeId}')" class="text-[8px] bg-amber-100 hover:bg-amber-200 text-amber-900 font-extrabold px-1.5 py-0.5 rounded border border-amber-300 flex items-center gap-0.5 transition shadow-2xs cursor-pointer" title="Belum ada boundary DXF. Klik untuk alokasikan dari boundary tersimpan"><i class="ph-bold ph-plus-circle"></i> +DXF</button>`
            }
          </div>
        </td>
        <td class="px-1.5 py-1 text-center">${statusBadge}</td>
        <td class="px-1.5 py-1 text-slate-700 font-semibold">${escapeHtml(inisiasi)}</td>
        <td class="px-1.5 py-1 text-center font-mono text-slate-800">${escapeHtml(holes)}</td>
        <td class="px-1.5 py-1 text-center font-mono text-slate-800">${escapeHtml(isian)}</td>
        <td class="px-1.5 py-1 font-mono font-black text-emerald-700">${escapeHtml(vol)} T</td>
        <td class="px-1.5 py-1 font-semibold text-slate-800">${escapeHtml(pengawasKont)}</td>
        <td class="px-1.5 py-1 bg-amber-50/40 font-bold border-l border-amber-100">${supBadge}</td>
        <td class="px-1.5 py-1 bg-amber-50/40 text-[10px]">
          <div class="flex flex-col gap-0.5 min-w-[80px] max-w-[170px]">
            <div class="flex items-start gap-1 text-[9.5px]">
              <span class="px-1 py-0.2 bg-blue-100 text-blue-800 font-extrabold rounded text-[8px] flex-shrink-0 border border-blue-200 mt-0.5">Pengawas</span>
              <span class="clamp-2-lines leading-tight whitespace-normal font-semibold text-slate-800" title="${escapeHtml(cleanSpv)}">${escapeHtml(cleanSpv)}</span>
            </div>
            <div class="flex items-start gap-1 text-[9.5px]">
              <span class="px-1 py-0.2 bg-purple-100 text-purple-800 font-extrabold rounded text-[8px] flex-shrink-0 border border-purple-200 mt-0.5">BLS</span>
              <span class="clamp-2-lines leading-tight whitespace-normal font-semibold text-slate-800" title="${escapeHtml(cleanBlaster)}">${escapeHtml(cleanBlaster)}</span>
            </div>
          </div>
        </td>
        <td class="px-1.5 py-1 bg-amber-50/40 text-[10px]">
          <div class="flex flex-col gap-0.5 min-w-[90px] max-w-[190px]">
            <div class="flex items-start gap-1 text-[9.5px] text-amber-900 font-mono font-bold" title="${escapeHtml(unitMmuDisplay)}">
              <i class="ph-bold ph-truck text-amber-600 text-xs flex-shrink-0 mt-0.5"></i>
              <span class="clamp-2-lines leading-tight whitespace-normal">${escapeHtml(unitMmuDisplay)}</span>
            </div>
            <div class="flex items-start gap-1 text-[9px] text-slate-600 font-mono" title="${escapeHtml(unitBox)}">
              <i class="ph-bold ph-package text-slate-400 text-xs flex-shrink-0 mt-0.5"></i>
              <span class="clamp-2-lines leading-tight whitespace-normal">${escapeHtml(unitBox)}</span>
            </div>
          </div>
        </td>
        <td class="px-1.5 py-1 text-center font-mono font-bold text-slate-800">${escapeHtml(jamMasuk)}</td>
        <td class="px-1.5 py-1 text-[10px]">
          <span class="font-medium text-slate-700 truncate block max-w-[130px]" title="${escapeHtml(akses)}">${escapeHtml(akses)}</span>
        </td>
        <td class="px-1.5 py-1 text-[10px] text-slate-700 italic max-w-[160px]" title="${escapeHtml(remark)}">
          <span class="clamp-2-lines leading-tight whitespace-normal">${escapeHtml(remark)}</span>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

function checkCanEditSupplier(item) {
  if (!currentUser) return false;
  if (isUserOwner()) return true;

  const userComp = cleanCompanyName(currentUser.company).toUpperCase();
  const supName = cleanCompanyName(item.supplier).toUpperCase();

  if (isUserSupplier()) {
    return supName === userComp || supName.includes(userComp) || userComp.includes(supName);
  }

  return false;
}

function renderKesiapanSupplierTable() {
  const tbody = document.getElementById('tbody-kesiapan-supplier');
  if (!tbody) return;

  if (globalSupplierData.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="14" class="px-4 py-8 text-center text-slate-400 italic">
          Belum ada data kesiapan supplier untuk tanggal ini.
        </td>
      </tr>
    `;
    return;
  }

  let html = '';
  globalSupplierData.forEach((item, index) => {
    const rowNo = index + 1;
    const uuid = item.uuid || item.id || '-';
    const safeUuid = sanitizeId(uuid);
    const tgl = normalizeDateToYYYYMMDD(item.tanggal) || item.tanggal || '-';
    const sup = cleanCompanyName(item.supplier) || '-';
    const mmu = formatMmuReadyList(item.unit_mmu, item.supplier);
    const dth = Number(item.dth_ready || 0).toFixed(2);
    const box = formatBoxReadyList(item.unit_box);
    const formatAccessory = (val, suffix) => {
      if (!val || val === '-' || val === '0') return '';
      const s = String(val).trim();
      if (!s || s === '0' || s === '-') return '';
      const cleanSuffix = suffix.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const cleanVal = s.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      if (cleanVal.includes(cleanSuffix)) return s;
      return `${s} ${suffix}`;
    };

    const hebsStr = formatAccessory(item.hebs, 'HEBS');
    const estarStr = formatAccessory(item.estar, 'E*TAR');
    const axissStr = formatAccessory(item.axiss, 'AXXIS');
    const devices = [hebsStr, estarStr, axissStr].filter(Boolean).join(', ') || '-';
    const nonel = formatAccessory(item.nonel, 'Nonel') || '-';
    const namaSpv = item.nama_spv || '-';
    const numSpv = item.supervisor || 0;
    const namaBlaster = item.nama_blaster || '-';
    const numBlaster = item.blaster || 0;
    const note = item.note || '-';

    const canEdit = checkCanEditSupplier(item);
    const canDelete = checkCanDeleteSupplier(item);

    const editBtn = canEdit
      ? `<button onclick="openEditSupplierModal('${safeUuid}')" class="w-full px-1.5 py-0.5 bg-amber-50 hover:bg-amber-600 hover:text-white text-amber-800 font-bold rounded transition text-[10px] flex items-center justify-center gap-0.5 shadow-2xs" title="Edit Kesiapan">
           <i class="ph-bold ph-pencil-simple"></i> Edit
         </button>`
      : '';

    const deleteBtn = canDelete
      ? `<button onclick="handleDeleteSupplier('${safeUuid}')" class="w-full px-1.5 py-0.5 bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-600 font-bold rounded transition text-[10px] flex items-center justify-center gap-0.5 shadow-2xs" title="Hapus Kesiapan">
           <i class="ph-bold ph-trash"></i> Hapus
         </button>`
      : '';

    let actionBtns = '';
    if (editBtn || deleteBtn) {
      actionBtns = `<div class="flex flex-col items-center justify-center gap-1 min-w-[50px]">${editBtn}${deleteBtn}</div>`;
    } else {
      actionBtns = `<button disabled title="Anda tidak memiliki hak akses mengubah/menghapus baris ini" class="px-1.5 py-0.5 bg-slate-50 text-slate-300 font-medium rounded text-[10px] flex items-center gap-0.5 mx-auto cursor-not-allowed border border-slate-100">
           <i class="ph-bold ph-lock-key"></i> Kunci
         </button>`;
    }

    html += `
      <tr class="hover:bg-slate-50 transition border-b border-slate-100 text-[10.5px]">
        <td class="px-1.5 py-1 text-center font-mono font-bold text-slate-800">${rowNo}</td>
        <td class="px-1.5 py-1 font-mono text-slate-600 text-[10px]">${escapeHtml(tgl)}</td>
        <td class="px-1.5 py-1 font-extrabold text-amber-900">${escapeHtml(sup)}</td>
        <td class="px-1.5 py-1 font-mono font-bold text-slate-800 text-[10px] max-w-[190px]" title="${escapeHtml(mmu)}">
          <span class="clamp-2-lines leading-tight whitespace-normal">${escapeHtml(mmu)}</span>
        </td>
        <td class="px-1.5 py-1 font-mono font-black text-emerald-700">${escapeHtml(dth)} T</td>
        <td class="px-1.5 py-1 font-mono text-slate-800">${escapeHtml(box)}</td>
        <td class="px-1.5 py-1 text-[10px] text-slate-700">${escapeHtml(devices)}</td>
        <td class="px-1.5 py-1 text-[10px]">${escapeHtml(nonel)}</td>
        <td class="px-1.5 py-1 text-[10px] font-semibold text-blue-900">${escapeHtml(namaSpv)}</td>
        <td class="px-1.5 py-1 text-center font-mono font-black text-blue-800">${escapeHtml(numSpv)}</td>
        <td class="px-1.5 py-1 text-[10px] font-semibold text-purple-900">${escapeHtml(namaBlaster)}</td>
        <td class="px-1.5 py-1 text-center font-mono font-black text-purple-800">${escapeHtml(numBlaster)}</td>
        <td class="px-1.5 py-1 text-[10px] text-slate-700 italic truncate max-w-[140px]" title="${escapeHtml(note)}">${escapeHtml(note)}</td>
        <td class="px-1.5 py-1 text-center whitespace-nowrap">
          ${actionBtns}
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

