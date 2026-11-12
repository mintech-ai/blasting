/**
 * INTEGRATED BLASTING PLAN & DASHBOARD PLATFORM
 * Module: FORMS & BULK EXCEL IMPORT
 * Menangani form input rencana peledakan kontraktor, form kesiapan operasional supplier, dan import bulk Excel.
 */

// ==================== KONTRAKTOR PLAN FORM LOGIC ====================

function renderPlanNeedMmuChips() {
  const container = document.getElementById('plan-need-mmu-chips');
  if (!container) return;

  const dateInput = document.getElementById('input_tanggal');
  const targetDate = (dateInput && dateInput.value) ? dateInput.value : getWitaDateString();
  const usedMap = getUsedMmuMapForDate(targetDate);
  const presets = getAllPresetMmus();

  let html = '';
  presets.forEach(p => {
    const cleanKey = cleanMmuKey(p.code);
    const isUsed = !!usedMap[cleanKey];
    const isSelected = selectedPlanNeedMmus.some(x => cleanMmuKey(x) === cleanKey);

    // Revisi 2: Tidak mengunci chip MMU meskipun sudah terpakai
    if (isSelected) {
      html += `
        <button type="button" onclick="togglePlanNeedMmuChip('${p.code}')"
          class="px-2.5 py-1 text-xs rounded-xl font-extrabold bg-red-600 text-white border border-red-700 shadow-sm flex items-center gap-1">
          <i class="ph-bold ph-check text-white"></i>
          <span>${p.code}</span>
          <span class="text-[9px] opacity-80 font-mono">(${p.cap}T)</span>
          ${isUsed ? `<span class="text-[8px] bg-red-800 px-1 rounded">Terpakai</span>` : ''}
        </button>
      `;
    } else {
      html += `
        <button type="button" onclick="togglePlanNeedMmuChip('${p.code}')"
          class="px-2.5 py-1 text-xs rounded-xl font-semibold ${isUsed ? 'bg-amber-50 text-amber-900 border-amber-300' : 'bg-white text-slate-700 border-slate-300'} hover:bg-red-50 hover:text-red-700 hover:border-red-300 transition flex items-center gap-1 shadow-2xs">
          <i class="ph-bold ph-truck text-slate-400"></i>
          <span>${p.code}</span>
          <span class="text-[9px] text-slate-400 font-mono">(${p.cap}T)</span>
          ${isUsed ? `<span class="text-[8px] font-bold text-amber-700 bg-amber-100 px-1 rounded border border-amber-200">Terpakai</span>` : ''}
        </button>
      `;
    }
  });

  container.innerHTML = html;
  updatePlanNeedMmuDisplay();
}

function togglePlanNeedMmuChip(code) {
  const clean = code.trim();
  const idx = selectedPlanNeedMmus.findIndex(x => cleanMmuKey(x) === cleanMmuKey(clean));
  if (idx >= 0) {
    selectedPlanNeedMmus.splice(idx, 1);
  } else {
    selectedPlanNeedMmus.push(clean);
  }
  renderPlanNeedMmuChips();
}

function updatePlanNeedMmuDisplay() {
  const input = document.getElementById('input_need_mmu');
  const dthDisp = document.getElementById('display-plan-need-mmu-dth');
  const dthHidden = document.getElementById('input_dth_supplier');

  const valStr = selectedPlanNeedMmus.join(', ');
  if (input) input.value = valStr;

  const totalDth = calculateMmuTotalDth(valStr);
  if (dthDisp) dthDisp.innerText = `Total DTH: ${totalDth.toFixed(2)} Ton`;
  if (dthHidden) dthHidden.value = totalDth;
}

function handleManualNeedMmuChange(rawVal) {
  const units = String(rawVal || '').split(/[,;/]+/).map(s => s.trim()).filter(Boolean);
  selectedPlanNeedMmus = units;
  renderPlanNeedMmuChips();
}

function clearPlanNeedMmuSelection() {
  selectedPlanNeedMmus = [];
  renderPlanNeedMmuChips();
}

function handleEditNeedMmuInput(val) {
  const dth = calculateMmuTotalDth(val);
  const disp = document.getElementById('edit-display-need-mmu-dth');
  const hidden = document.getElementById('edit_dth_supplier');
  if (disp) disp.innerText = `Total DTH: ${dth.toFixed(2)} Ton`;
  if (hidden) hidden.value = dth;
}

async function handleKontraktorFormSubmit(event) {
  event.preventDefault();

  const holes = Number(document.getElementById('input_holes').value) || 0;
  const isian = Number(document.getElementById('input_isian_kg').value) || 0;
  
  // Revisi 4: Ambil manual Volume (Ton DTH) yang diinput sendiri oleh user
  const volTon = parseFloat(document.getElementById('input_volume')?.value) || 0;

  let planKontraktor = 'PT SIS';
  if (isUserOwner()) {
    const kSel = document.getElementById('input_kontraktor_select');
    if (kSel && kSel.value) {
      planKontraktor = kSel.value;
    }
  } else if (currentUser && currentUser.company) {
    const comp = currentUser.company.toUpperCase();
    if (comp.includes('BUMA')) {
      planKontraktor = 'PT BUMA';
    } else if (comp.includes('SIS')) {
      planKontraktor = 'PT SIS';
    } else {
      planKontraktor = currentUser.company;
    }
  }

  const needMmuInput = document.getElementById('input_need_mmu') ? document.getElementById('input_need_mmu').value.trim() : '';
  const targetDate = document.getElementById('input_tanggal').value;
  const dthSupCalculated = Number(document.getElementById('input_dth_supplier') ? document.getElementById('input_dth_supplier').value : 0) || calculateMmuTotalDth(needMmuInput);

  // Ambil lokasi dan geometri boundary (Fleksibel: bisa dari DXF atau ketik manual)
  let lokasiVal = (document.getElementById('input_lokasi')?.value || document.getElementById('input_lokasi_manual')?.value || document.getElementById('input_lokasi_select')?.value || '').trim();
  if (!lokasiVal) {
    Swal.fire({ icon: 'warning', title: 'Pilih / Isi Lokasi', text: 'Nama lokasi blasting wajib diisi (bisa pilih dari DXF atau ketik manual)!' });
    return;
  }

  let geomVal = document.getElementById('input_geometry') ? document.getElementById('input_geometry').value : '';
  let latVal = document.getElementById('input_latitude') ? document.getElementById('input_latitude').value : '';
  let lngVal = document.getElementById('input_longitude') ? document.getElementById('input_longitude').value : '';

  if (!geomVal && typeof findBoundaryByName === 'function') {
    const bound = findBoundaryByName(lokasiVal);
    if (bound) {
      geomVal = bound.wkt;
      if (!latVal) latVal = bound.centroid.lat;
      if (!lngVal) lngVal = bound.centroid.lng;
    }
  }

  // Jika memilih boundary DXF, validasi 1:1 Alokasi Boundary pada tanggal yang sama
  if (geomVal && typeof getAllocatedBoundaryNames === 'function') {
    const allocated = getAllocatedBoundaryNames(targetDate, (typeof currentEditingItem !== 'undefined' && currentEditingItem) ? currentEditingItem.uuid : null);
    if (allocated.has(lokasiVal.toLowerCase())) {
      Swal.fire({
        icon: 'warning',
        title: 'Boundary Sudah Terpakai!',
        text: `Boundary "${lokasiVal}" sudah dialokasikan ke plan peledakan lain pada tanggal ${targetDate}. Setiap boundary hanya dapat dialokasikan ke 1 plan!`
      });
      return;
    }
  }

  // Validasi PIN Keamanan 8080
  const pinOk = await requestSecurityPin('menyimpan data plan peledakan baru');
  if (!pinOk) return;

  const formData = {
    tanggal: document.getElementById('input_tanggal').value,
    kontraktor: planKontraktor,
    lokasi: lokasiVal,
    prioritas: document.getElementById('input_prioritas').value,
    'today/sleep': document.getElementById('input_today_sleep').value,
    today_sleep: document.getElementById('input_today_sleep').value,
    inisiasi: document.getElementById('input_inisiasi').value,
    jam_masuk: document.getElementById('input_jam_masuk').value,
    remark: document.getElementById('input_remark').value,
    pengawas_kontraktor: document.getElementById('input_pengawas_kontraktor').value,
    jumlah_holes: holes,
    isian_kg: isian,
    volume_ton: volTon,
    akses: document.getElementById('input_akses').value,
    desa: document.getElementById('input_desa').value,
    matrix: document.getElementById('input_matrix').value,
    geometri: document.getElementById('input_geometri').value,
    unit_mmu: needMmuInput,
    need_mmu: needMmuInput,
    dth_supplier: dthSupCalculated,
    latitude: latVal,
    longitude: lngVal,
    geometry: geomVal
  };

  const btn = document.getElementById('btn-submit-plan');
  btn.disabled = true;
  btn.innerHTML = `<i class="ph-bold ph-spinner animate-spin"></i> Menyimpan...`;
  showGlobalLoading();

  try {
    const res = await apiCall('savePlan', {
      data: formData,
      role: isUserOwner() ? 'ADMIN' : currentUser.role,
      company: planKontraktor
    });

    btn.disabled = false;
    btn.innerHTML = `<i class="ph-bold ph-paper-plane-tilt text-base"></i> <span>Simpan Data Plan</span>`;

    if (res && res.success) {
      const newLocalItem = {
        ...formData,
        uuid: res.uuid || ('PB-' + Date.now()),
        id: res.uuid || ('PB-' + Date.now())
      };
      rawGlobalPlanData.unshift(newLocalItem);
      filterAndRenderDashboard(targetDate);

      Swal.fire({
        icon: 'success',
        title: 'Berhasil!',
        text: 'Plan Blasting berhasil disimpan.',
        timer: 1500,
        showConfirmButton: false
      });
      resetKontraktorForm();
      refreshData(false, false);
      switchView('dashboard');
    } else {
      Swal.fire({ icon: 'error', title: 'Gagal Menyimpan', text: (res && res.message) || 'Gagal terhubung ke server, coba lagi' });
    }
  } catch (err) {
    btn.disabled = false;
    btn.innerHTML = `<i class="ph-bold ph-paper-plane-tilt text-base"></i> <span>Simpan Data Plan</span>`;
    Swal.fire({ icon: 'error', title: 'Gagal Menyimpan', text: 'Terjadi kesalahan saat menyimpan data.' });
  } finally {
    hideGlobalLoading();
  }
}

function resetKontraktorForm() {
  const form = document.getElementById('form-alokasi-main');
  if (form) form.reset();
  const dateEl = document.getElementById('input_tanggal');
  if (dateEl) dateEl.value = getWitaDateString();
  const volEl = document.getElementById('input_volume');
  if (volEl) volEl.value = '';
  if (document.getElementById('input_latitude')) document.getElementById('input_latitude').value = '';
  if (document.getElementById('input_longitude')) document.getElementById('input_longitude').value = '';
  if (document.getElementById('input_lokasi')) document.getElementById('input_lokasi').value = '';
  if (document.getElementById('input_geometry')) document.getElementById('input_geometry').value = '';
  const badgeInfo = document.getElementById('selected-boundary-info-badge');
  if (badgeInfo) badgeInfo.classList.add('hidden');
  selectedPlanNeedMmus = [];
  renderPlanNeedMmuChips();
  if (typeof updateBoundaryUIState === 'function') updateBoundaryUIState();
}


// ==================== SUPPLIER READINESS FORM LOGIC ====================

function renderMmuChips() {
  const supEl = document.getElementById('sup_readiness_supplier');
  const supName = supEl ? supEl.value : 'DAHANA';
  const container = document.getElementById('mmu-chip-container');
  if (!container) return;
  const presets = SUPPLIER_MMU_PRESETS[supName] || SUPPLIER_MMU_PRESETS['DAHANA'];

  const fieldHebs = document.getElementById('field-dahana-hebs');
  const fieldEstar = document.getElementById('field-dahana-estar');
  const fieldAxiss = document.getElementById('field-mnk-axiss');

  if (supName === 'MNK-KMB') {
    if (fieldHebs) fieldHebs.classList.add('hidden');
    if (fieldEstar) fieldEstar.classList.add('hidden');
    if (fieldAxiss) fieldAxiss.classList.remove('hidden');
  } else {
    if (fieldHebs) fieldHebs.classList.remove('hidden');
    if (fieldEstar) fieldEstar.classList.remove('hidden');
    if (fieldAxiss) fieldAxiss.classList.add('hidden');
  }

  selectedMmuChips = [];
  let html = `
    <div class="w-full space-y-2.5">
      <div>
        <span class="block text-[10.5px] uppercase font-bold text-slate-500 mb-1">Unit Utama:</span>
        <div class="flex flex-wrap gap-2">
  `;

  presets.forEach(p => {
    html += `
      <button type="button" onclick="toggleMmuChip('${p.code}', ${p.cap})" id="chip-${p.code.replace(/[^a-zA-Z0-9]/g, '-')}" class="px-2.5 py-1 rounded-lg text-xs font-mono font-bold border transition bg-white text-slate-700 border-slate-300 hover:border-amber-500 shadow-2xs">
        ${p.code} (${p.cap}T)
      </button>
    `;
  });

  html += `
        </div>
      </div>

      <div>
        <span class="block text-[10.5px] uppercase font-extrabold text-amber-700 mb-1 flex items-center gap-1">
          <i class="ph-bold ph-arrows-clockwise text-xs"></i> Opsi Reload MMU (Maksimal 2 Unit per MMU):
        </span>
        <div class="flex flex-wrap gap-2">
  `;

  presets.forEach(p => {
    const reloadCode = `${p.code} Reload`;
    html += `
      <button type="button" onclick="toggleMmuChip('${reloadCode}', ${p.cap})" id="chip-${reloadCode.replace(/[^a-zA-Z0-9]/g, '-')}" class="px-2.5 py-1 rounded-lg text-xs font-mono font-bold border transition bg-amber-50/70 text-amber-900 border-amber-300 hover:border-amber-600 flex items-center gap-1 shadow-2xs">
        <i class="ph-bold ph-arrow-counter-clockwise text-[10px] text-amber-600"></i>
        <span>${p.code} Reload</span>
        <span class="text-[9.5px] opacity-75">(${p.cap}T)</span>
      </button>
    `;
  });

  html += `
        </div>
      </div>
    </div>
  `;

  container.innerHTML = html;
  updateMmuDisplay();
}

function toggleMmuChip(code, cap) {
  const idx = selectedMmuChips.findIndex(c => c.code.toUpperCase() === code.toUpperCase());
  if (idx > -1) {
    selectedMmuChips.splice(idx, 1);
  } else {
    selectedMmuChips.push({ code, cap });
  }

  const btnId = `chip-${code.replace(/[^a-zA-Z0-9]/g, '-')}`;
  const btn = document.getElementById(btnId);
  if (btn) {
    const isReload = code.toLowerCase().includes('reload');
    if (selectedMmuChips.some(c => c.code.toUpperCase() === code.toUpperCase())) {
      btn.className = "px-2.5 py-1 rounded-lg text-xs font-mono font-extrabold border transition bg-amber-600 text-white border-amber-600 shadow-sm flex items-center gap-1";
    } else {
      btn.className = isReload
        ? "px-2.5 py-1 rounded-lg text-xs font-mono font-bold border transition bg-amber-50/70 text-amber-900 border-amber-300 hover:border-amber-600 flex items-center gap-1 shadow-2xs"
        : "px-2.5 py-1 rounded-lg text-xs font-mono font-bold border transition bg-white text-slate-700 border-slate-300 hover:border-amber-500 shadow-2xs";
    }
  }

  updateMmuDisplay();
}

function updateMmuDisplay() {
  const codes = selectedMmuChips.map(c => c.code).join(', ');
  const totalCap = selectedMmuChips.reduce((sum, c) => sum + c.cap, 0);

  const listEl = document.getElementById('sup_readiness_mmu_list');
  if (listEl) listEl.value = codes ? `Terpilih: ${codes}` : '';

  const unitEl = document.getElementById('display_unit_count');
  if (unitEl) unitEl.innerText = `${selectedMmuChips.length} Unit`;

  const dthEl = document.getElementById('display_dth_calculated');
  if (dthEl) dthEl.innerText = `${totalCap.toFixed(2)} Ton`;

  const mmuHidden = document.getElementById('sup_readiness_mmu');
  if (mmuHidden) mmuHidden.value = codes;

  const dthHidden = document.getElementById('sup_readiness_dth');
  if (dthHidden) dthHidden.value = totalCap;
}

function getSelectedSupplierKey() {
  const el = document.getElementById('sup_readiness_supplier');
  const val = el ? el.value : 'DAHANA';
  return (val.toUpperCase().includes('MNK') || val.toUpperCase().includes('KMB')) ? 'MNK-KMB' : 'DAHANA';
}

function handleSupplierCompanyRosterChange() {
  const supKey = getSelectedSupplierKey();
  const titleEl = document.getElementById('roster-header-supplier-title');
  if (titleEl) {
    titleEl.innerText = (SUPPLIER_PERSONNEL_ROSTER[supKey] && SUPPLIER_PERSONNEL_ROSTER[supKey].title)
      ? SUPPLIER_PERSONNEL_ROSTER[supKey].title
      : `Pengawas dan Blaster ${supKey}`;
  }
  initSupplierManpowerRoster(supKey);
}

function initSupplierManpowerRoster(supKey = 'DAHANA', existingSpvStr = '', existingBlasterStr = '') {
  const normKey = (supKey.toUpperCase().includes('MNK') || supKey.toUpperCase().includes('KMB')) ? 'MNK-KMB' : 'DAHANA';
  const roster = SUPPLIER_PERSONNEL_ROSTER[normKey] || SUPPLIER_PERSONNEL_ROSTER['DAHANA'];

  supplierManpowerAttendance.pengawas.clear();
  supplierManpowerAttendance.blaster.clear();

  if (existingSpvStr) {
    const parts = existingSpvStr.split(/[,;/]+/).map(s => s.trim().toLowerCase()).filter(Boolean);
    roster.pengawas.forEach(name => {
      if (parts.some(p => p === name.toLowerCase())) {
        supplierManpowerAttendance.pengawas.add(name);
      }
    });
  }

  if (existingBlasterStr) {
    const parts = existingBlasterStr.split(/[,;/]+/).map(s => s.trim().toLowerCase()).filter(Boolean);
    roster.blaster.forEach(name => {
      if (parts.some(p => p === name.toLowerCase())) {
        supplierManpowerAttendance.blaster.add(name);
      }
    });
  }

  renderSupplierManpowerUI(normKey);
}

function renderSupplierManpowerUI(supKey) {
  const normKey = (supKey.toUpperCase().includes('MNK') || supKey.toUpperCase().includes('KMB')) ? 'MNK-KMB' : 'DAHANA';
  const roster = SUPPLIER_PERSONNEL_ROSTER[normKey] || SUPPLIER_PERSONNEL_ROSTER['DAHANA'];

  const spvContainer = document.getElementById('supplier-pengawas-roster-list');
  const blsContainer = document.getElementById('supplier-blaster-roster-list');

  if (spvContainer) {
    let htmlSpv = '';
    roster.pengawas.forEach((name, idx) => {
      const isHadir = supplierManpowerAttendance.pengawas.has(name);
      htmlSpv += `
        <div class="px-3 py-2 flex items-center justify-between hover:bg-slate-50 transition text-xs">
          <span class="font-bold text-slate-800 flex items-center gap-2">
            <span class="text-slate-400 font-mono text-[10px] w-4">${idx + 1}.</span>
            <span>${name}</span>
          </span>
          <div class="inline-flex rounded-lg p-0.5 bg-slate-100 border border-slate-200">
            <button type="button" onclick="setPersonStatus('pengawas', '${name.replace(/'/g, "\\'")}', true)"
              class="${isHadir ? 'bg-emerald-600 text-white font-black shadow-xs' : 'text-slate-600 font-bold hover:text-slate-900'} px-2.5 py-1 rounded-md text-[10.5px] transition flex items-center gap-1">
              ${isHadir ? '<i class="ph-bold ph-check"></i>' : ''} Hadir
            </button>
            <button type="button" onclick="setPersonStatus('pengawas', '${name.replace(/'/g, "\\'")}', false)"
              class="${!isHadir ? 'bg-rose-100 text-rose-800 font-bold border border-rose-200' : 'text-slate-400 font-medium hover:text-slate-700'} px-2.5 py-1 rounded-md text-[10.5px] transition">
              Tidak Hadir
            </button>
          </div>
        </div>
      `;
    });
    spvContainer.innerHTML = htmlSpv;
  }

  if (blsContainer) {
    let htmlBls = '';
    roster.blaster.forEach((name, idx) => {
      const isHadir = supplierManpowerAttendance.blaster.has(name);
      htmlBls += `
        <div class="px-3 py-2 flex items-center justify-between hover:bg-slate-50 transition text-xs">
          <span class="font-bold text-slate-800 flex items-center gap-2">
            <span class="text-slate-400 font-mono text-[10px] w-4">${idx + 1}.</span>
            <span>${name}</span>
          </span>
          <div class="inline-flex rounded-lg p-0.5 bg-slate-100 border border-slate-200">
            <button type="button" onclick="setPersonStatus('blaster', '${name.replace(/'/g, "\\'")}', true)"
              class="${isHadir ? 'bg-emerald-600 text-white font-black shadow-xs' : 'text-slate-600 font-bold hover:text-slate-900'} px-2.5 py-1 rounded-md text-[10.5px] transition flex items-center gap-1">
              ${isHadir ? '<i class="ph-bold ph-check"></i>' : ''} Hadir
            </button>
            <button type="button" onclick="setPersonStatus('blaster', '${name.replace(/'/g, "\\'")}', false)"
              class="${!isHadir ? 'bg-rose-100 text-rose-800 font-bold border border-rose-200' : 'text-slate-400 font-medium hover:text-slate-700'} px-2.5 py-1 rounded-md text-[10.5px] transition">
              Tidak Hadir
            </button>
          </div>
        </div>
      `;
    });
    blsContainer.innerHTML = htmlBls;
  }

  updateSupplierAttendanceFormValues();
}

function setPersonStatus(type, name, isHadir) {
  if (isHadir) {
    supplierManpowerAttendance[type].add(name);
  } else {
    supplierManpowerAttendance[type].delete(name);
  }
  renderSupplierManpowerUI(getSelectedSupplierKey());
}

function setAllSupplierManpowerStatus(status) {
  const supKey = getSelectedSupplierKey();
  const roster = SUPPLIER_PERSONNEL_ROSTER[supKey] || SUPPLIER_PERSONNEL_ROSTER['DAHANA'];

  if (status === 'HADIR') {
    roster.pengawas.forEach(n => supplierManpowerAttendance.pengawas.add(n));
    roster.blaster.forEach(n => supplierManpowerAttendance.blaster.add(n));
  } else {
    supplierManpowerAttendance.pengawas.clear();
    supplierManpowerAttendance.blaster.clear();
    const extraSpv = document.getElementById('sup_readiness_spv_extra');
    if (extraSpv) extraSpv.value = '';
    const extraBls = document.getElementById('sup_readiness_blaster_extra');
    if (extraBls) extraBls.value = '';
  }
  renderSupplierManpowerUI(supKey);
}

function handleExtraManpowerInput() {
  updateSupplierAttendanceFormValues();
}

function updateSupplierAttendanceFormValues() {
  const spvList = Array.from(supplierManpowerAttendance.pengawas);
  const extraSpvInput = document.getElementById('sup_readiness_spv_extra');
  const extraSpvs = (extraSpvInput && extraSpvInput.value)
    ? extraSpvInput.value.split(/[,;/]+/).map(s => s.trim()).filter(Boolean)
    : [];
  const totalSpvNames = [...spvList, ...extraSpvs];

  const dispSpvCount = document.getElementById('display-pengawas-hadir-count');
  if (dispSpvCount) dispSpvCount.innerText = `${totalSpvNames.length} Orang`;

  const hiddenSpvNames = document.getElementById('sup_readiness_nama_spv');
  if (hiddenSpvNames) hiddenSpvNames.value = totalSpvNames.join(', ');

  const hiddenSpvCount = document.getElementById('sup_readiness_pengawas');
  if (hiddenSpvCount) hiddenSpvCount.value = totalSpvNames.length;

  const blsList = Array.from(supplierManpowerAttendance.blaster);
  const extraBlsInput = document.getElementById('sup_readiness_blaster_extra');
  const extraBls = (extraBlsInput && extraBlsInput.value)
    ? extraBlsInput.value.split(/[,;/]+/).map(s => s.trim()).filter(Boolean)
    : [];
  const totalBlsNames = [...blsList, ...extraBls];

  const dispBlsCount = document.getElementById('display-blaster-hadir-count');
  if (dispBlsCount) dispBlsCount.innerText = `${totalBlsNames.length} Orang`;

  const hiddenBlsNames = document.getElementById('sup_readiness_nama_blaster');
  if (hiddenBlsNames) hiddenBlsNames.value = totalBlsNames.join(', ');

  const hiddenBlsCount = document.getElementById('sup_readiness_blaster');
  if (hiddenBlsCount) hiddenBlsCount.value = totalBlsNames.length;
}

function calculateManpowerFromNames() {
  updateSupplierAttendanceFormValues();
}

function resetSupplierReadinessForm() {
  const form = document.getElementById('form-kesiapan-supplier');
  if (form) form.reset();
  selectedMmuChips = [];
  renderMmuChips();
  const tInput = document.getElementById('sup_readiness_tanggal');
  if (tInput) tInput.value = getWitaDateString();
  const mmuList = document.getElementById('sup_readiness_mmu_list');
  if (mmuList) mmuList.value = '';
  const unitCount = document.getElementById('display_unit_count');
  if (unitCount) unitCount.innerText = '0 Unit';
  const dthDisp = document.getElementById('display_dth_calculated');
  if (dthDisp) dthDisp.innerText = '0.00 Ton';
  const mmuHidden = document.getElementById('sup_readiness_mmu');
  if (mmuHidden) mmuHidden.value = '0';
  const dthHidden = document.getElementById('sup_readiness_dth');
  if (dthHidden) dthHidden.value = '0';
  const noteEl = document.getElementById('sup_readiness_note');
  if (noteEl) noteEl.value = '';

  supplierManpowerAttendance.pengawas.clear();
  supplierManpowerAttendance.blaster.clear();
  const extraSpv = document.getElementById('sup_readiness_spv_extra');
  if (extraSpv) extraSpv.value = '';
  const extraBls = document.getElementById('sup_readiness_blaster_extra');
  if (extraBls) extraBls.value = '';
  handleSupplierCompanyRosterChange();
}

async function handleSupplierReadinessSubmit(event) {
  event.preventDefault();

  const supName = document.getElementById('sup_readiness_supplier').value;
  const readinessData = {
    tanggal: document.getElementById('sup_readiness_tanggal').value,
    supplier: supName,
    unit_mmu: document.getElementById('sup_readiness_mmu').value,
    dth_ready: Number(document.getElementById('sup_readiness_dth').value) || 0,
    unit_box: document.getElementById('sup_readiness_lv_box_list').value,
    hebs: document.getElementById('sup_readiness_hebs').value,
    estar: document.getElementById('sup_readiness_estar').value,
    axiss: document.getElementById('sup_readiness_axiss').value,
    nonel: document.getElementById('sup_readiness_nonel').value,
    nama_spv: document.getElementById('sup_readiness_nama_spv').value,
    supervisor: Number(document.getElementById('sup_readiness_pengawas').value) || 0,
    nama_blaster: document.getElementById('sup_readiness_nama_blaster').value,
    blaster: Number(document.getElementById('sup_readiness_blaster').value) || 0,
    note: document.getElementById('sup_readiness_note') ? document.getElementById('sup_readiness_note').value.trim() : ''
  };

  const pinOk = await requestSecurityPin('menyimpan kesiapan supplier');
  if (!pinOk) return;

  const btn = document.getElementById('btn-submit-kesiapan') || document.getElementById('btn-submit-supplier-readiness');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="ph-bold ph-spinner animate-spin"></i> Menyimpan Kesiapan...`;
  }
  showGlobalLoading();

  try {
    const res = await apiCall('saveKesiapan', {
      data: readinessData,
      role: isUserOwner() ? 'ADMIN' : currentUser.role,
      company: supName
    });

    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="ph-bold ph-floppy-disk text-base"></i> <span>Simpan Kesiapan Supplier</span>`;
    }

    if (res && res.success) {
      Swal.fire({
        icon: 'success',
        title: 'Kesiapan Tersimpan!',
        text: 'Data kesiapan supplier berhasil diperbarui.',
        timer: 1500,
        showConfirmButton: false
      });
      resetSupplierReadinessForm();
      refreshData(false);
      switchView('dashboard');
    } else {
      Swal.fire({ icon: 'error', title: 'Gagal Menyimpan', text: (res && res.message) || 'Gagal menyimpan kesiapan supplier' });
    }
  } catch (err) {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="ph-bold ph-floppy-disk text-base"></i> <span>Simpan Kesiapan Supplier</span>`;
    }
    Swal.fire({ icon: 'error', title: 'Gagal Menyimpan', text: 'Terjadi kesalahan sistem saat menyimpan kesiapan.' });
  } finally {
    hideGlobalLoading();
  }
}


// ==================== BULK EXCEL IMPORT & PREVIEW LOGIC ====================

function triggerExcelImport() {
  const fileInput = document.getElementById('excel-file-input');
  if (fileInput) fileInput.click();
}

function handleExcelFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array', cellDates: false });
      const firstSheet = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheet];

      const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: true, defval: '' });

      if (!jsonData || jsonData.length === 0) {
        Swal.fire({ icon: 'warning', title: 'Excel Kosong', text: 'Tidak ada baris data ditemukan di file excel!' });
        return;
      }

      bulkPreviewRows = [];

      jsonData.forEach(row => {
        const rawTanggal = getValFlexible(row, 'TANGGAL', 'tanggal', 'tgl', 'date');
        const parsedDate = parseExcelDate(rawTanggal);

        const kontraktorVal = getValFlexible(row, 'CONTRACTOR', 'kontraktor', 'contractor') || (currentUser ? currentUser.company : 'SIS');
        const lokasiVal = getValFlexible(row, 'BLASTING AREA', 'blastingarea', 'lokasi', 'area', 'location');

        const holesVal = Number(getValFlexible(row, 'TOTAL HOLE', 'totalhole', 'jumlah_holes', 'holes', 'hole') || 0);
        const isianKgVal = Number(getValFlexible(row, 'ISIAN/ HOLE (KG)', 'isianholekg', 'isian_kg', 'isian/hole', 'isian') || 0);

        let volumeTonVal = Number(getValFlexible(row, 'ISIAN DTH (TON)', 'isiandthton', 'volume_ton', 'volume') || 0);
        if (!volumeTonVal && holesVal && isianKgVal) {
          volumeTonVal = (holesVal * isianKgVal) / 1000;
        }

        const matrixVal = getValFlexible(row, 'MATRIX ISIAN', 'matrixisian', 'matrix');
        const remarkVal = getValFlexible(row, 'REMARK / STATUS LAPANGAN', 'remarkstatuslapangan', 'remark', 'statuslapangan');

        const rawJam = getValFlexible(row, 'JAM PERSIAPAN AWAL / MASUK BARANG', 'jampersiapanawalmasukbarang', 'jam_masuk', 'jammasuk', 'jam');
        const jamMasukVal = formatExcelTime(rawJam);

        const aksesVal = getValFlexible(row, 'AKSES LOKASI', 'akseslokasi', 'akses');
        const inisiasiRaw = getValFlexible(row, 'REKOMENDASI INSISIASI', 'rekomendasiinsisiasi', 'rekomendasiinisiasi', 'inisiasi');
        const inisiasiVal = (inisiasiRaw && String(inisiasiRaw).toUpperCase().includes('LIL')) ? 'LIL' : 'RF';

        const statusBlastingRaw = getValFlexible(row, 'STATUS BLASTING', 'statusblasting', 'todaysleep', 'status');
        const statusBlastingVal = normalizeBlastingStatus(statusBlastingRaw);

        const desaVal = getValFlexible(row, 'DESA TERDEKAT / SEKTOR TERDAMPAK', 'desaterdekatsektorterdampak', 'desa_terdampak', 'desa');
        const geometriVal = getValFlexible(row, 'GEOMETRI (B x S)', 'geometribxs', 'geometri');
        const pengawasKontraktorVal = getValFlexible(row, 'NAMA PENGAWAS KONTRAKTOR', 'namapengawaskontraktor', 'pengawas_kontraktor', 'pengawaskontraktor', 'pengawas');

        const prioritasVal = getValFlexible(row, 'PRIORITAS', 'prioritas') || 'Prioritas 1';

        const needMmuVal = getValFlexible(row, 'NEED MMU/MMT', 'need_mmu_mmt', 'need_mmu', 'needmmu', 'needmmt', 'mmu') || '';
        const dthSupVal = calculateMmuTotalDth(needMmuVal);

        let latVal = getValFlexible(row, 'LATITUDE', 'latitude', 'lat');
        let longVal = getValFlexible(row, 'LONGITUDE', 'longitude', 'long', 'lng');
        let geomVal = '';

        // Otomatis tautkan dengan boundary DXF jika nama lokasi cocok
        if (typeof findBoundaryByName === 'function') {
          const matchedBound = findBoundaryByName(lokasiVal);
          if (matchedBound) {
            geomVal = matchedBound.wkt;
            latVal = matchedBound.centroid.lat;
            longVal = matchedBound.centroid.lng;
          }
        }

        bulkPreviewRows.push({
          tanggal: parsedDate,
          kontraktor: kontraktorVal,
          lokasi: lokasiVal,
          prioritas: prioritasVal,
          'today/sleep': statusBlastingVal,
          today_sleep: statusBlastingVal,
          inisiasi: inisiasiVal,
          jam_masuk: jamMasukVal,
          jumlah_holes: holesVal,
          isian_kg: isianKgVal,
          volume_ton: volumeTonVal,
          akses: aksesVal,
          desa: desaVal,
          matrix: matrixVal,
          geometri: geometriVal,
          pengawas_kontraktor: pengawasKontraktorVal,
          remark: remarkVal,
          unit_mmu: needMmuVal,
          need_mmu: needMmuVal,
          dth_supplier: dthSupVal,
          latitude: latVal,
          longitude: longVal,
          geometry: geomVal
        });
      });

      renderBulkPreviewTable();
      openBulkPreviewModal();

    } catch (err) {
      console.error('Error parsing excel:', err);
      Swal.fire({ icon: 'error', title: 'Gagal Membaca Excel', text: 'Format file tidak valid atau rusak!' });
    }
  };

  reader.readAsArrayBuffer(file);
}

function openBulkPreviewModal() {
  const modal = document.getElementById('modal-bulk-preview');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
}

function closeBulkPreviewModal() {
  const modal = document.getElementById('modal-bulk-preview');
  if (modal) {
    modal.classList.remove('flex');
    modal.classList.add('hidden');
  }
  bulkPreviewRows = [];
}

function renderBulkPreviewTable() {
  const tbody = document.getElementById('tbody-bulk-preview');
  const countTag = document.getElementById('bulk-row-count-tag');
  if (countTag) countTag.innerText = `${bulkPreviewRows.length} Baris Data`;

  if (!tbody) return;

  if (!bulkPreviewRows || bulkPreviewRows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="20" class="p-4 text-center text-slate-400 italic">Tidak ada data preview.</td></tr>`;
    return;
  }

  const validBoundaries = (typeof getValidLocalBoundaries === 'function') ? getValidLocalBoundaries() : [];

  let html = '';
  bulkPreviewRows.forEach((row, idx) => {
    // Bangun opsi select boundary DXF
    let boundaryOptions = `<option value="" disabled ${!row.lokasi ? 'selected' : ''}>-- Pilih Boundary DXF --</option>`;
    validBoundaries.forEach(b => {
      const isSelected = row.lokasi && (String(row.lokasi).trim().toLowerCase() === String(b.name).trim().toLowerCase());
      boundaryOptions += `<option value="${escapeXmlAttr(b.name)}" ${isSelected ? 'selected' : ''}>${escapeXmlAttr(b.name)} (#${b.index})</option>`;
    });

    html += `
      <tr class="hover:bg-slate-50 border-b border-slate-200">
        <td class="p-1.5"><input type="date" value="${row.tanggal}" onchange="updateBulkRow(${idx}, 'tanggal', this.value)" class="w-28 bg-slate-50 border border-slate-300 rounded px-1.5 py-1 text-xs font-mono font-bold"></td>
        <td class="p-1.5"><input type="text" value="${row.kontraktor}" onchange="updateBulkRow(${idx}, 'kontraktor', this.value)" class="w-24 bg-slate-50 border border-slate-300 rounded px-1.5 py-1 text-xs font-bold"></td>
        <td class="p-1.5">
          <select onchange="updateBulkRowBoundary(${idx}, this.value)"
            class="w-40 bg-white border ${row.geometry ? 'border-emerald-400 bg-emerald-50/30' : 'border-red-400 bg-red-50/30'} rounded px-1.5 py-1 text-xs font-bold text-slate-900 cursor-pointer">
            ${boundaryOptions}
          </select>
        </td>
        <td class="p-1.5">
          <select onchange="updateBulkRow(${idx}, 'prioritas', this.value)" class="w-24 bg-slate-50 border border-slate-300 rounded px-1 py-1 text-xs font-bold">
            <option value="Prioritas 1" ${row.prioritas === 'Prioritas 1' ? 'selected' : ''}>Prioritas 1</option>
            <option value="Prioritas 2" ${row.prioritas === 'Prioritas 2' ? 'selected' : ''}>Prioritas 2</option>
          </select>
        </td>
        <td class="p-1.5">
          <select onchange="updateBulkRow(${idx}, 'today_sleep', this.value)" class="w-28 bg-slate-50 border border-slate-300 rounded px-1 py-1 text-xs font-bold">
            <option value="TODAY" ${row.today_sleep === 'TODAY' ? 'selected' : ''}>TODAY</option>
            <option value="SLEEP" ${row.today_sleep === 'SLEEP' ? 'selected' : ''}>SLEEP</option>
            <option value="TIE UP" ${row.today_sleep === 'TIE UP' ? 'selected' : ''}>TIE UP</option>
            <option value="TIE UP + TODAY" ${row.today_sleep === 'TIE UP + TODAY' ? 'selected' : ''}>TIE UP + TODAY</option>
            <option value="TODAY/SLEEP" ${row.today_sleep === 'TODAY/SLEEP' ? 'selected' : ''}>TODAY/SLEEP</option>
            <option value="CANCEL/HOLD" ${row.today_sleep === 'CANCEL/HOLD' || String(row.today_sleep).includes('CALCEL') || String(row.today_sleep).includes('HOLD') ? 'selected' : ''}>CANCEL/HOLD</option>
          </select>
        </td>
        <td class="p-1.5">
          <select onchange="updateBulkRow(${idx}, 'inisiasi', this.value)" class="w-16 bg-slate-50 border border-slate-300 rounded px-1 py-1 text-xs font-bold">
            <option value="RF" ${row.inisiasi === 'RF' ? 'selected' : ''}>RF</option>
            <option value="LIL" ${row.inisiasi === 'LIL' ? 'selected' : ''}>LIL</option>
          </select>
        </td>
        <td class="p-1.5"><input type="time" value="${row.jam_masuk}" onchange="updateBulkRow(${idx}, 'jam_masuk', this.value)" class="w-24 bg-slate-50 border border-slate-300 rounded px-1.5 py-1 text-xs font-mono"></td>
        <td class="p-1.5"><input type="number" value="${row.jumlah_holes}" onchange="updateBulkRowNumber(${idx}, 'jumlah_holes', this.value)" class="w-16 text-center bg-slate-50 border border-slate-300 rounded px-1 py-1 text-xs font-mono font-bold"></td>
        <td class="p-1.5"><input type="number" step="0.1" value="${row.isian_kg}" onchange="updateBulkRowNumber(${idx}, 'isian_kg', this.value)" class="w-20 text-center bg-slate-50 border border-slate-300 rounded px-1 py-1 text-xs font-mono text-red-700 font-bold"></td>
        <td class="p-1.5 text-center font-mono font-black text-emerald-700 text-xs px-2" id="bulk-vol-${idx}">${Number(row.volume_ton || 0).toFixed(2)}</td>
        <td class="p-1.5"><input type="text" value="${row.akses}" onchange="updateBulkRow(${idx}, 'akses', this.value)" class="w-28 bg-slate-50 border border-slate-300 rounded px-1.5 py-1 text-xs"></td>
        <td class="p-1.5"><input type="text" value="${row.desa}" onchange="updateBulkRow(${idx}, 'desa', this.value)" class="w-28 bg-slate-50 border border-slate-300 rounded px-1.5 py-1 text-xs"></td>
        <td class="p-1.5"><input type="text" value="${row.matrix}" onchange="updateBulkRow(${idx}, 'matrix', this.value)" class="w-28 bg-slate-50 border border-slate-300 rounded px-1.5 py-1 text-xs"></td>
        <td class="p-1.5"><input type="text" value="${row.geometri}" onchange="updateBulkRow(${idx}, 'geometri', this.value)" class="w-20 bg-slate-50 border border-slate-300 rounded px-1.5 py-1 text-xs font-mono"></td>
        <td class="p-1.5 bg-red-50/50"><input type="text" value="${row.pengawas_kontraktor || ''}" onchange="updateBulkRow(${idx}, 'pengawas_kontraktor', this.value)" class="w-32 bg-white border border-red-300 rounded px-1.5 py-1 text-xs font-semibold text-slate-900" placeholder="Pengawas..."></td>
        <td class="p-1.5"><input type="text" value="${row.remark || ''}" onchange="updateBulkRow(${idx}, 'remark', this.value)" class="w-32 bg-slate-50 border border-slate-300 rounded px-1.5 py-1 text-xs" placeholder="Remark..."></td>
        <td class="p-1.5 bg-amber-50/40"><input type="text" value="${row.need_mmu || ''}" onchange="updateBulkRowMmu(${idx}, this.value)" placeholder="MMU 23, MMU 19" class="w-28 bg-white border border-amber-300 rounded px-1.5 py-1 text-xs font-mono font-bold text-amber-950"></td>
        <td class="p-1.5 bg-cyan-50/30"><input type="number" step="any" value="${row.latitude || ''}" onchange="updateBulkRow(${idx}, 'latitude', this.value)" class="w-24 bg-white border border-cyan-300 rounded px-1.5 py-1 text-xs font-mono font-bold text-slate-800" placeholder="-2.12345"></td>
        <td class="p-1.5 bg-cyan-50/30"><input type="number" step="any" value="${row.longitude || ''}" onchange="updateBulkRow(${idx}, 'longitude', this.value)" class="w-24 bg-white border border-cyan-300 rounded px-1.5 py-1 text-xs font-mono font-bold text-slate-800" placeholder="115.54321"></td>
        <td class="p-1.5 text-center">
          <button onclick="removeBulkRow(${idx})" class="p-1 text-red-600 hover:bg-red-50 rounded" title="Hapus Baris"><i class="ph-bold ph-trash text-base"></i></button>
        </td>
      </tr>
    `;
  });
  tbody.innerHTML = html;
}

function updateBulkRowBoundary(index, boundaryName) {
  if (bulkPreviewRows[index] && typeof findBoundaryByName === 'function') {
    const bound = findBoundaryByName(boundaryName);
    if (bound) {
      bulkPreviewRows[index].lokasi = bound.name;
      bulkPreviewRows[index].geometry = bound.wkt;
      bulkPreviewRows[index].latitude = bound.centroid.lat;
      bulkPreviewRows[index].longitude = bound.centroid.lng;
    } else {
      bulkPreviewRows[index].lokasi = boundaryName;
      bulkPreviewRows[index].geometry = '';
    }
    renderBulkPreviewTable();
  }
}

function updateBulkRow(index, field, value) {
  if (bulkPreviewRows[index]) {
    bulkPreviewRows[index][field] = value;
  }
}

function updateBulkRowMmu(index, value) {
  if (bulkPreviewRows[index]) {
    bulkPreviewRows[index].need_mmu = value.trim();
    bulkPreviewRows[index].dth_supplier = calculateMmuTotalDth(value);
  }
}

function updateBulkRowNumber(index, field, value) {
  if (bulkPreviewRows[index]) {
    bulkPreviewRows[index][field] = Number(value) || 0;
    const h = Number(bulkPreviewRows[index].jumlah_holes) || 0;
    const i = Number(bulkPreviewRows[index].isian_kg) || 0;
    const vol = (h * i) / 1000;
    bulkPreviewRows[index].volume_ton = vol;

    const volEl = document.getElementById(`bulk-vol-${index}`);
    if (volEl) volEl.innerText = vol.toFixed(2);
  }
}

function addBulkPreviewRow() {
  const validBoundaries = (typeof getValidLocalBoundaries === 'function') ? getValidLocalBoundaries() : [];
  const defaultBound = validBoundaries[0] || null;

  bulkPreviewRows.push({
    tanggal: getWitaDateString(),
    kontraktor: currentUser ? currentUser.company : 'SIS',
    lokasi: defaultBound ? defaultBound.name : '',
    prioritas: 'Prioritas 1',
    today_sleep: 'TODAY',
    inisiasi: 'RF',
    jam_masuk: '08:30',
    jumlah_holes: 0,
    isian_kg: 0,
    volume_ton: 0,
    akses: '',
    desa: 'Desa Bata',
    matrix: 'ANFO',
    geometri: '8x8',
    pengawas_kontraktor: '',
    remark: '',
    need_mmu: '',
    dth_supplier: 0,
    latitude: defaultBound ? defaultBound.centroid.lat : '',
    longitude: defaultBound ? defaultBound.centroid.lng : '',
    geometry: defaultBound ? defaultBound.wkt : ''
  });
  renderBulkPreviewTable();
}

function removeBulkRow(index) {
  bulkPreviewRows.splice(index, 1);
  renderBulkPreviewTable();
}

async function submitBulkPreviewData() {
  if (!bulkPreviewRows || bulkPreviewRows.length === 0) {
    Swal.fire({ icon: 'warning', title: 'Perhatian', text: 'Tidak ada data untuk disimpan!' });
    return;
  }

  // Validasi 1: Setiap baris wajib memiliki nama lokasi
  const emptyLokasiIdx = bulkPreviewRows.findIndex(r => !String(r.lokasi || '').trim());
  if (emptyLokasiIdx !== -1) {
    Swal.fire({
      icon: 'warning',
      title: 'Lokasi Belum Terisi',
      text: `Baris #${emptyLokasiIdx + 1} belum memiliki nama lokasi peledakan. Kolom Lokasi wajib terisi untuk setiap baris!`
    });
    return;
  }

  // Validasi 2: 1:1 Alokasi Boundary di antara baris-baris yang memilih geometry DXF
  const bulkSeen = new Map();
  for (let i = 0; i < bulkPreviewRows.length; i++) {
    if (bulkPreviewRows[i].geometry) {
      const name = String(bulkPreviewRows[i].lokasi || '').trim().toLowerCase();
      if (bulkSeen.has(name)) {
        const prevIdx = bulkSeen.get(name);
        Swal.fire({
          icon: 'warning',
          title: 'Duplikasi Alokasi Boundary',
          text: `Boundary "${bulkPreviewRows[i].lokasi}" dipilih pada Baris #${prevIdx + 1} dan Baris #${i + 1}. Setiap boundary spasial hanya dapat dialokasikan ke 1 plan peledakan!`
        });
        return;
      }
      bulkSeen.set(name, i);
    }
  }

  // Validasi 3: 1:1 Alokasi Boundary terhadap plan yang sudah tersimpan di database untuk tanggal tersebut
  if (typeof getAllocatedBoundaryNames === 'function') {
    for (let i = 0; i < bulkPreviewRows.length; i++) {
      if (bulkPreviewRows[i].geometry) {
        const r = bulkPreviewRows[i];
        const rDate = (typeof normalizeDateToYYYYMMDD === 'function') ? normalizeDateToYYYYMMDD(r.tanggal) : String(r.tanggal || '').slice(0, 10);
        const allocated = getAllocatedBoundaryNames(rDate);
        const name = String(r.lokasi || '').trim().toLowerCase();
        if (allocated.has(name)) {
          Swal.fire({
            icon: 'warning',
            title: 'Boundary Sudah Terpakai di Database',
            text: `Boundary "${r.lokasi}" pada Baris #${i + 1} sudah dialokasikan ke plan lain pada tanggal ${rDate} di database. Harap alokasikan boundary yang belum terpakai!`
          });
          return;
        }
      }
    }
  }

  // Validasi PIN Keamanan 8080
  const pinOk = await requestSecurityPin('menyimpan data bulk plan peledakan');
  if (!pinOk) return;

  const btn = document.getElementById('btn-confirm-bulk-upload');
  btn.disabled = true;
  btn.innerHTML = `<i class="ph-bold ph-spinner animate-spin text-base"></i> Menyimpan (${bulkPreviewRows.length})...`;

  const res = await apiCall('bulkSavePlan', {
    data: bulkPreviewRows,
    role: currentUser.role,
    company: currentUser.company
  });

  btn.disabled = false;
  btn.innerHTML = `<i class="ph-bold ph-cloud-arrow-up text-base"></i> Simpan Ke Server`;

  if (res.success) {
    Swal.fire({
      icon: 'success',
      title: 'Import Berhasil!',
      text: `${bulkPreviewRows.length} baris data berhasil ditambahkan dengan boundary spasial.`,
      timer: 2000,
      showConfirmButton: false
    });
    closeBulkPreviewModal();
    refreshData(false);
    switchView('dashboard');
  } else {
    Swal.fire({ icon: 'error', title: 'Gagal Bulk Import', text: res.message || 'Gagal terhubung ke server.' });
  }
}

