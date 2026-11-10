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

  // Urutan kontraktor: SIS dulu, baru BUMA, lalu lainnya
  globalPlanData.sort((a, b) => {
    const getRank = (item) => {
      const k = String(item.kontraktor || '').toUpperCase();
      if (k.includes('SIS')) return 1;
      if (k.includes('BUMA')) return 2;
      return 99;
    };
    const rankA = getRank(a);
    const rankB = getRank(b);
    if (rankA !== rankB) return rankA - rankB;
    return String(a.kontraktor || '').localeCompare(String(b.kontraktor || ''));
  });

  let html = '';
  globalPlanData.forEach((item, index) => {
    const rowNo = index + 1;
    const id = item.uuid || item.id || '-';
    const kontraktor = cleanCompanyName(item.kontraktor) || '-';
    const lokasi = item.lokasi || '-';
    const prioritas = item.prioritas || '-';
    const todaySleep = getPlanTodaySleepStatus(item);
    const inisiasi = item.inisiasi || '-';
    const jamMasuk = formatExcelTime(item.jam_masuk || item.jam);
    const tgl = normalizeDateToYYYYMMDD(item.tanggal) || item.tanggal || '-';
    const holes = item.jumlah_holes || item.holes || 0;
    const isian = item.isian_kg || item.isian || 0;
    const vol = Number(item.volume_ton || item.volume || 0).toFixed(2);
    const matrix = item.matrix || '-';
    const geometri = item.geometri || '-';
    const desa = item.desa || '-';
    const akses = item.akses || '-';
    const pengawasKont = item.pengawas_kontraktor || '-';
    const sup = item.supplier ? cleanCompanyName(item.supplier) : '';
    const unitMmu = item.unit_mmu || '-';
    const unitBox = item.unit_box || '-';

    const rawSpv = item.pengawas_supplier || item.supervisor || '-';
    const cleanSpv = cleanManpowerString(rawSpv);

    // Revisi 1: Sinkronisasi nama blaster
    const rawBlaster = item.blaster || item.jumlah_blaster || item.nama_blaster || '-';
    const cleanBlaster = cleanManpowerString(rawBlaster);

    const canEdit = checkCanEditPlan(item);
    const canDelete = checkCanDeletePlan(item);

    let supBadge = '';
    if (sup) {
      const isDahana = sup.toUpperCase().includes('DAHANA');
      supBadge = `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold ${isDahana ? 'bg-amber-100 text-amber-800' : 'bg-purple-100 text-purple-800'}">${sup}</span>`;
    } else {
      supBadge = `<span class="text-slate-400 italic text-[10px]">-</span>`;
    }

    const statusBadge = getStatusBadgeHtml(todaySleep);

    const editBtn = canEdit
      ? `<button onclick="openEditPlanModal('${id}')" class="px-1.5 py-0.5 bg-red-50 hover:bg-red-600 hover:text-white text-red-600 font-bold rounded transition text-[10px] flex items-center gap-0.5 shadow-2xs" title="Edit Plan">
           <i class="ph-bold ph-pencil-simple"></i> Edit
         </button>`
      : '';

    const deleteBtn = canDelete
      ? `<button onclick="handleDeletePlan('${id}')" class="px-1.5 py-0.5 bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-600 font-bold rounded transition text-[10px] flex items-center gap-0.5 shadow-2xs" title="Hapus Plan">
           <i class="ph-bold ph-trash"></i> Hapus
         </button>`
      : '';

    let actionBtns = '';
    if (editBtn || deleteBtn) {
      actionBtns = `<div class="flex items-center justify-center gap-1">${editBtn}${deleteBtn}</div>`;
    } else {
      actionBtns = `<button disabled title="Anda tidak memiliki hak akses mengubah/menghapus baris ini" class="px-1.5 py-0.5 bg-slate-50 text-slate-300 font-medium rounded text-[10px] flex items-center gap-0.5 mx-auto cursor-not-allowed border border-slate-100">
           <i class="ph-bold ph-lock-key"></i> Kunci
         </button>`;
    }

    html += `
      <tr class="hover:bg-slate-50 transition border-b border-slate-100 text-[10.5px]">
        <td class="px-1.5 py-1 text-center font-mono font-bold text-slate-800">${rowNo}</td>
        <td class="px-1.5 py-1 text-center font-mono text-slate-700 text-[10px]">${tgl}</td>
        <td class="px-1.5 py-1 text-center font-bold text-slate-800">${prioritas}</td>
        <td class="px-1.5 py-1 font-extrabold text-slate-900">${kontraktor}</td>
        <td class="px-1.5 py-1 font-bold text-slate-800">${lokasi}</td>
        <td class="px-1.5 py-1 text-center">${statusBadge}</td>
        <td class="px-1.5 py-1 text-slate-700">${inisiasi}</td>
        <td class="px-1.5 py-1 text-center font-mono font-bold text-slate-800">${jamMasuk}</td>
        <td class="px-1.5 py-1 text-center font-mono text-slate-800">${holes}</td>
        <td class="px-1.5 py-1 text-center font-mono text-slate-800">${isian}</td>
        <td class="px-1.5 py-1 font-mono font-black text-emerald-700">${vol} T</td>
        <td class="px-1.5 py-1 text-[10px]">
          <div class="flex flex-col leading-tight min-w-[70px]">
            <span class="font-bold text-slate-800 truncate" title="${matrix}">${matrix}</span>
            <span class="text-[9px] font-mono text-slate-500 truncate flex items-center gap-1 mt-0.5">
              <span class="text-[7.5px] bg-slate-100 text-slate-500 font-bold px-1 py-0.2 rounded border border-slate-200">GEO</span>
              <span class="truncate" title="${geometri}">${geometri}</span>
            </span>
          </div>
        </td>
        <td class="px-1.5 py-1 text-[10px]">
          <div class="flex flex-col gap-1 min-w-[95px] max-w-[150px]">
            <div class="flex items-center gap-1 leading-none" title="Desa Terdampak Ledakan: ${desa}">
              <span class="text-[7.5px] bg-red-100 text-red-800 font-extrabold px-1 py-0.5 rounded border border-red-200 flex items-center gap-0.5 flex-shrink-0">
                <i class="ph-bold ph-warning-circle text-[8px] text-red-600"></i> TERDAMPAK
              </span>
              <span class="font-bold text-slate-900 truncate" title="${desa}">${desa}</span>
            </div>
            <div class="flex items-center gap-1 leading-none" title="Akses Masuk ke Lokasi Peledakan: ${akses}">
              <span class="text-[7.5px] bg-emerald-100 text-emerald-800 font-extrabold px-1 py-0.5 rounded border border-emerald-200 flex items-center gap-0.5 flex-shrink-0">
                <i class="ph-bold ph-signpost text-[8px] text-emerald-600"></i> AKSES MASUK
              </span>
              <span class="font-medium text-slate-600 truncate" title="${akses}">${akses}</span>
            </div>
          </div>
        </td>
        <td class="px-1.5 py-1 font-semibold text-slate-800">${pengawasKont}</td>
        <td class="px-1.5 py-1 bg-amber-50/40 font-bold border-l border-amber-100">${supBadge}</td>
        <td class="px-1.5 py-1 bg-amber-50/40 text-[10px]">
          <div class="flex flex-col gap-0.5 min-w-[80px]">
            <div class="flex items-center gap-1 text-[9.5px] truncate">
              <span class="px-1 py-0.2 bg-blue-100 text-blue-800 font-extrabold rounded text-[8px] flex-shrink-0 border border-blue-200">Pengawas</span>
              <span class="truncate font-semibold text-slate-800" title="${cleanSpv}">${cleanSpv}</span>
            </div>
            <div class="flex items-center gap-1 text-[9.5px] truncate">
              <span class="px-1 py-0.2 bg-purple-100 text-purple-800 font-extrabold rounded text-[8px] flex-shrink-0 border border-purple-200">BLS</span>
              <span class="truncate font-semibold text-slate-800" title="${cleanBlaster}">${cleanBlaster}</span>
            </div>
          </div>
        </td>
        <td class="px-1.5 py-1 bg-amber-50/40 text-[10px]">
          <div class="flex flex-col gap-0.5 min-w-[90px]">
            <div class="flex items-center gap-1 text-[9.5px] text-amber-900 font-mono font-bold truncate" title="${unitMmu}">
              <i class="ph-bold ph-truck text-amber-600 text-xs flex-shrink-0"></i>
              <span class="truncate">${unitMmu}</span>
            </div>
            <div class="flex items-center gap-1 text-[9px] text-slate-600 font-mono truncate" title="${unitBox}">
              <i class="ph-bold ph-package text-slate-400 text-xs flex-shrink-0"></i>
              <span class="truncate">${unitBox}</span>
            </div>
          </div>
        </td>
        <td class="px-1.5 py-1 text-center whitespace-nowrap">
          ${actionBtns}
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
    const tgl = normalizeDateToYYYYMMDD(item.tanggal) || item.tanggal || '-';
    const sup = cleanCompanyName(item.supplier) || '-';
    const mmu = formatMmuReadyList(item.unit_mmu, item.supplier);
    const dth = Number(item.dth_ready || 0).toFixed(2);
    const box = formatBoxReadyList(item.unit_box);
    const devices = [item.hebs, item.estar, item.axiss].filter(x => x && x !== '' && x !== '0').join(', ') || '-';
    const nonel = item.nonel || '-';
    const namaSpv = item.nama_spv || '-';
    const numSpv = item.supervisor || 0;
    const namaBlaster = item.nama_blaster || '-';
    const numBlaster = item.blaster || 0;
    const note = item.note || '-';

    const canEdit = checkCanEditSupplier(item);
    const canDelete = checkCanDeleteSupplier(item);

    const editBtn = canEdit
      ? `<button onclick="openEditSupplierModal('${uuid}')" class="px-1.5 py-0.5 bg-amber-50 hover:bg-amber-600 hover:text-white text-amber-800 font-bold rounded transition text-[10px] flex items-center gap-0.5 shadow-2xs" title="Edit Kesiapan">
           <i class="ph-bold ph-pencil-simple"></i> Edit
         </button>`
      : '';

    const deleteBtn = canDelete
      ? `<button onclick="handleDeleteSupplier('${uuid}')" class="px-1.5 py-0.5 bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-600 font-bold rounded transition text-[10px] flex items-center gap-0.5 shadow-2xs" title="Hapus Kesiapan">
           <i class="ph-bold ph-trash"></i> Hapus
         </button>`
      : '';

    let actionBtns = '';
    if (editBtn || deleteBtn) {
      actionBtns = `<div class="flex items-center justify-center gap-1">${editBtn}${deleteBtn}</div>`;
    } else {
      actionBtns = `<button disabled title="Anda tidak memiliki hak akses mengubah/menghapus baris ini" class="px-1.5 py-0.5 bg-slate-50 text-slate-300 font-medium rounded text-[10px] flex items-center gap-0.5 mx-auto cursor-not-allowed border border-slate-100">
           <i class="ph-bold ph-lock-key"></i> Kunci
         </button>`;
    }

    html += `
      <tr class="hover:bg-slate-50 transition border-b border-slate-100 text-[10.5px]">
        <td class="px-1.5 py-1 text-center font-mono font-bold text-slate-800">${rowNo}</td>
        <td class="px-1.5 py-1 font-mono text-slate-600 text-[10px]">${tgl}</td>
        <td class="px-1.5 py-1 font-extrabold text-amber-900">${sup}</td>
        <td class="px-1.5 py-1 font-mono font-bold text-slate-800">${mmu}</td>
        <td class="px-1.5 py-1 font-mono font-black text-emerald-700">${dth} T</td>
        <td class="px-1.5 py-1 font-mono text-slate-800">${box}</td>
        <td class="px-1.5 py-1 text-[10px] text-slate-700">${devices}</td>
        <td class="px-1.5 py-1 text-[10px]">${nonel}</td>
        <td class="px-1.5 py-1 text-[10px] font-semibold text-blue-900">${namaSpv}</td>
        <td class="px-1.5 py-1 text-center font-mono font-black text-blue-800">${numSpv}</td>
        <td class="px-1.5 py-1 text-[10px] font-semibold text-purple-900">${namaBlaster}</td>
        <td class="px-1.5 py-1 text-center font-mono font-black text-purple-800">${numBlaster}</td>
        <td class="px-1.5 py-1 text-[10px] text-slate-700 italic truncate max-w-[140px]" title="${note}">${note}</td>
        <td class="px-1.5 py-1 text-center whitespace-nowrap">
          ${actionBtns}
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

