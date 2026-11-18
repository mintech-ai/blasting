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
  // Revisi 5: isian kg bulat tidak menerima angka koma
  const isian = Math.round(Number(document.getElementById('input_isian_kg').value) || 0);
  
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

  const supplierVal = (document.getElementById('input_supplier') ? document.getElementById('input_supplier').value : '') || 'PT DAHANA';
  const needMmuInput = document.getElementById('input_need_mmu') ? document.getElementById('input_need_mmu').value.trim() : '';
  const targetDate = document.getElementById('input_tanggal').value;

  // Ambil lokasi (manual) dan alokasi boundary DXF (opsional dari Field 16)
  let lokasiVal = (document.getElementById('input_lokasi')?.value || '').trim();
  if (!lokasiVal) {
    Swal.fire({ icon: 'warning', title: 'Pilih / Isi Lokasi', text: 'Nama lokasi blasting wajib diisi!' });
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
    const chosenBoundaryName = document.getElementById('input_boundary_select')?.value || lokasiVal;
    if (allocated.has(chosenBoundaryName.toLowerCase())) {
      Swal.fire({
        icon: 'warning',
        title: 'Boundary Sudah Terpakai!',
        text: `Boundary "${chosenBoundaryName}" sudah dialokasikan ke plan peledakan lain pada tanggal ${targetDate}. Setiap boundary hanya dapat dialokasikan ke 1 plan!`
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
    supplier: supplierVal,
    unit_mmu: needMmuInput,
    need_mmu: needMmuInput,
    dth_supplier: 0,
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
  if (typeof clearField16PreviewMap === 'function') clearField16PreviewMap();
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
  renderBoxChips();
}

function renderBoxChips() {
  const supKey = getSelectedSupplierKey();
  const container = document.getElementById('box-chip-container');
  if (!container) return;

  const boxPresets = (typeof SUPPLIER_BOX_PRESETS !== 'undefined' && SUPPLIER_BOX_PRESETS[supKey])
    ? SUPPLIER_BOX_PRESETS[supKey]
    : (supKey === 'MNK-KMB' ? ['Box 17', 'Box 18', 'Box 19'] : ['Box 10', 'Box 16', 'Box 20', 'Box 40']);

  const inputEl = document.getElementById('sup_readiness_lv_box_list');
  const currentVal = inputEl ? inputEl.value : '';
  const currentBoxes = currentVal.split(/[\r\n,;]+/).map(s => s.trim().toUpperCase()).filter(Boolean);

  let html = '';
  boxPresets.forEach(box => {
    const isSelected = currentBoxes.includes(box.toUpperCase());
    const btnClass = isSelected
      ? "px-3 py-1.5 rounded-xl text-xs font-mono font-extrabold border transition bg-amber-600 text-white border-amber-600 shadow-sm flex items-center gap-1.5 cursor-pointer"
      : "px-3 py-1.5 rounded-xl text-xs font-mono font-bold border transition bg-white text-slate-700 border-slate-300 hover:border-amber-500 shadow-2xs cursor-pointer";

    html += `
      <button type="button" onclick="toggleBoxChip('${box}')" id="box-chip-${box.replace(/[^a-zA-Z0-9]/g, '-')}" class="${btnClass}">
        ${isSelected ? '<i class="ph-bold ph-check text-xs"></i>' : '<i class="ph-bold ph-package text-xs text-amber-600"></i>'}
        <span>${box}</span>
      </button>
    `;
  });

  container.innerHTML = html;
}

function toggleBoxChip(boxName) {
  const inputEl = document.getElementById('sup_readiness_lv_box_list');
  if (!inputEl) return;
  const currentParts = inputEl.value.split(/[\r\n,;]+/).map(s => s.trim()).filter(Boolean);
  const idx = currentParts.findIndex(p => p.toUpperCase() === boxName.toUpperCase());
  if (idx > -1) {
    currentParts.splice(idx, 1);
  } else {
    currentParts.push(boxName);
  }
  inputEl.value = currentParts.join(', ');
  renderBoxChips();
}
window.renderBoxChips = renderBoxChips;
window.toggleBoxChip = toggleBoxChip;

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
  renderBoxChips();
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
  const mmuListVal = (selectedMmuChips && selectedMmuChips.length > 0)
    ? selectedMmuChips.map(c => c.code).join(', ')
    : (document.getElementById('sup_readiness_mmu_list')?.value.replace(/^Terpilih:\s*/i, '').trim() || document.getElementById('sup_readiness_mmu')?.value || '');

  const calcDthReady = Number(document.getElementById('sup_readiness_dth')?.value)
    || (selectedMmuChips && selectedMmuChips.reduce((sum, c) => sum + (c.cap || 0), 0))
    || 0;

  const readinessData = {
    tanggal: document.getElementById('sup_readiness_tanggal').value,
    supplier: supName,
    unit_mmu: mmuListVal,
    dth_ready: calcDthReady,
    unit_box: document.getElementById('sup_readiness_lv_box_list').value,
    hebs: document.getElementById('sup_readiness_hebs')?.value || '',
    estar: document.getElementById('sup_readiness_estar')?.value || '',
    axiss: document.getElementById('sup_readiness_axiss')?.value || '',
    nonel: document.getElementById('sup_readiness_nonel')?.value || '',
    nama_spv: document.getElementById('sup_readiness_nama_spv')?.value || '',
    supervisor: Number(document.getElementById('sup_readiness_pengawas')?.value) || 0,
    nama_blaster: document.getElementById('sup_readiness_nama_blaster')?.value || '',
    blaster: Number(document.getElementById('sup_readiness_blaster')?.value) || 0,
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
    const userRole = isUserOwner() ? 'ADMIN' : (currentUser ? currentUser.role : 'SUPPLIER');
    const res = await apiCall('saveKesiapan', {
      data: readinessData,
      role: userRole,
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
        // Revisi 5: isian kg bulat tidak menerima angka koma
        const isianKgVal = Math.round(Number(getValFlexible(row, 'ISIAN/ HOLE (KG)', 'isianholekg', 'isian_kg', 'isian/hole', 'isian') || 0));

        // Volume Ton: manual dari Excel jika ada, tidak ada auto calculation
        const volumeTonVal = Number(getValFlexible(row, 'ISIAN DTH (TON)', 'isiandthton', 'volume_ton', 'volume') || 0);

        const matrixVal = getValFlexible(row, 'MATRIX ISIAN', 'matrixisian', 'matrix');
        const remarkVal = getValFlexible(row, 'REMARK / STATUS LAPANGAN', 'remarkstatuslapangan', 'remark', 'statuslapangan');

        const rawJam = getValFlexible(row, 'JAM PERSIAPAN AWAL / MASUK BARANG', 'jampersiapanawalmasukbarang', 'jam_masuk', 'jammasuk', 'jam');
        const jamMasukVal = formatExcelTime(rawJam);

        const aksesVal = getValFlexible(row, 'AKSES LOKASI', 'akseslokasi', 'akses');
        // Revisi 3 & Revisi 5: Pilihan inisiasi (-), LIL, RF AXXIS, RF E*TAR, RF HEBS. Jika invalid DITOLAK jadi kosong
        const inisiasiRaw = String(getValFlexible(row, 'REKOMENDASI INSISIASI', 'rekomendasiinsisiasi', 'rekomendasiinisiasi', 'inisiasi') || '').trim().toUpperCase();
        let inisiasiVal = '';
        if (inisiasiRaw === '(-)' || inisiasiRaw === '-') inisiasiVal = '(-)';
        else if (inisiasiRaw.includes('LIL')) inisiasiVal = 'LIL';
        else if (inisiasiRaw.includes('AXXIS')) inisiasiVal = 'RF AXXIS';
        else if (inisiasiRaw.includes('E*TAR') || inisiasiRaw.includes('ESTAR')) inisiasiVal = 'RF E*TAR';
        else if (inisiasiRaw.includes('HEBS')) inisiasiVal = 'RF HEBS';
        else if (inisiasiRaw === 'RF') inisiasiVal = 'RF HEBS';
        else inisiasiVal = ''; // DITOLAK jika tidak sesuai pilihan form

        // Status: jika invalid (seperti 'loadshot') DITOLAK jadi kosong
        const statusBlastingRaw = getValFlexible(row, 'STATUS BLASTING', 'statusblasting', 'todaysleep', 'status');
        const statusBlastingVal = normalizeBlastingStatus(statusBlastingRaw);

        const desaVal = getValFlexible(row, 'DESA TERDEKAT / SEKTOR TERDAMPAK', 'desaterdekatsektorterdampak', 'desa_terdampak', 'desa');
        const geometriVal = getValFlexible(row, 'GEOMETRI (B x S)', 'geometribxs', 'geometri');
        
        // Revisi 2: Pengawas Kontraktor diparsing dari berbagai variasi header Excel
        const pengawasKontraktorVal = getValFlexible(row,
          'NAMA PENGAWAS KONTRAKTOR', 'PENGAWAS KONTRAKTOR', 'PENGAWAS KONT.', 'PENGAWAS KONT',
          'PENGAWAS MITRA', 'PENGAWAS', 'NAMA PENGAWAS', 'SPV KONTRAKTOR', 'GL KONTRAKTOR',
          'pengawas_kontraktor', 'pengawaskontraktor', 'pengawas_kont', 'pengawaskont',
          'namapengawaskontraktor', 'spv'
        ) || '';

        let supplierVal = getValFlexible(row, 'SUPPLIER', 'supplier', 'mitra_supplier', 'nama_supplier');
        if (!supplierVal) {
          const rawNeedMmu = getValFlexible(row, 'NEED MMU/MMT', 'need_mmu_mmt', 'need_mmu', 'mmu');
          if (rawNeedMmu && (String(rawNeedMmu).toUpperCase().includes('MNK') || String(rawNeedMmu).toUpperCase().includes('KMB'))) {
            supplierVal = 'PT MNK-KMB';
          } else {
            supplierVal = 'PT DAHANA';
          }
        } else {
          supplierVal = (String(supplierVal).toUpperCase().includes('MNK') || String(supplierVal).toUpperCase().includes('KMB')) ? 'PT MNK-KMB' : 'PT DAHANA';
        }

        // Revisi 5: Prioritas P1 & P2. Jika invalid DITOLAK jadi kosong
        const rawPrio = String(getValFlexible(row, 'PRIORITAS', 'prioritas', 'prio') || '').toUpperCase().trim();
        let prioritasVal = '';
        if (rawPrio === 'P1' || rawPrio === '1' || rawPrio === 'PRIORITAS 1') prioritasVal = 'P1';
        else if (rawPrio === 'P2' || rawPrio === '2' || rawPrio === 'PRIORITAS 2') prioritasVal = 'P2';
        else prioritasVal = ''; // DITOLAK jika tidak sesuai

        let latVal = getValFlexible(row, 'LATITUDE', 'latitude', 'lat');
        let longVal = getValFlexible(row, 'LONGITUDE', 'longitude', 'long', 'lng');
        let geomVal = '';
        let boundNameVal = '';

        // Otomatis tautkan dengan boundary DXF jika nama lokasi cocok
        if (typeof findBoundaryByName === 'function') {
          const matchedBound = findBoundaryByName(lokasiVal);
          if (matchedBound) {
            boundNameVal = matchedBound.name;
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
          supplier: supplierVal,
          unit_mmu: '',
          need_mmu: '',
          dth_supplier: 0,
          selectedBoundaryName: boundNameVal,
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
    // Bangun opsi select boundary DXF (Opsional)
    const activeBound = row.selectedBoundaryName || '';
    let boundaryOptions = `<option value="" ${!activeBound ? 'selected' : ''}>-- Tanpa Boundary (Opsional) --</option>`;
    validBoundaries.forEach(b => {
      const isSelected = activeBound && (String(activeBound).trim().toLowerCase() === String(b.name).trim().toLowerCase());
      const vCount = b.vertexCount || (b.coords ? b.coords.length : 0);
      boundaryOptions += `<option value="${escapeXmlAttr(b.name)}" ${isSelected ? 'selected' : ''}>${escapeXmlAttr(b.name)} (#${b.index}${vCount ? ` - ${vCount} titik` : ''})</option>`;
    });

    html += `
      <tr class="hover:bg-slate-50 border-b border-slate-200">
        <td class="p-1.5"><input type="date" value="${row.tanggal}" onchange="updateBulkRow(${idx}, 'tanggal', this.value)" class="w-28 bg-slate-50 border border-slate-300 rounded px-1.5 py-1 text-xs font-mono font-bold"></td>
        <td class="p-1.5"><input type="text" value="${row.kontraktor}" onchange="updateBulkRow(${idx}, 'kontraktor', this.value)" class="w-24 bg-slate-50 border border-slate-300 rounded px-1.5 py-1 text-xs font-bold"></td>
        <td class="p-1.5">
          <input type="text" value="${escapeXmlAttr(row.lokasi || '')}" onchange="updateBulkRowLokasi(${idx}, this.value)"
            class="w-36 bg-white border border-slate-300 rounded px-1.5 py-1 text-xs font-bold text-slate-900" placeholder="Lokasi...">
        </td>
        <td class="p-1.5">
          <select onchange="updateBulkRow(${idx}, 'prioritas', this.value)" class="w-20 ${!row.prioritas ? 'bg-red-50 border-red-500 text-red-700 font-extrabold' : 'bg-slate-50 border-slate-300 font-bold'} border rounded px-1 py-1 text-xs">
            <option value="" ${!row.prioritas ? 'selected' : ''}>-- Prio --</option>
            <option value="P1" ${row.prioritas === 'P1' || row.prioritas === 'Prioritas 1' ? 'selected' : ''}>P1</option>
            <option value="P2" ${row.prioritas === 'P2' || row.prioritas === 'Prioritas 2' ? 'selected' : ''}>P2</option>
          </select>
        </td>
        <td class="p-1.5">
          <select onchange="updateBulkRow(${idx}, 'today_sleep', this.value)" class="w-32 ${!row.today_sleep ? 'bg-red-50 border-red-500 text-red-700 font-extrabold' : 'bg-slate-50 border-slate-300 font-bold'} border rounded px-1 py-1 text-xs">
            <option value="" ${!row.today_sleep ? 'selected' : ''}>-- Pilih Status --</option>
            <option value="TODAY" ${row.today_sleep === 'TODAY' ? 'selected' : ''}>TODAY</option>
            <option value="SLEEP" ${row.today_sleep === 'SLEEP' ? 'selected' : ''}>SLEEP</option>
            <option value="TIE UP" ${row.today_sleep === 'TIE UP' ? 'selected' : ''}>TIE UP</option>
            <option value="TIE UP + TODAY" ${row.today_sleep === 'TIE UP + TODAY' ? 'selected' : ''}>TIE UP + TODAY</option>
            <option value="TODAY/SLEEP" ${row.today_sleep === 'TODAY/SLEEP' ? 'selected' : ''}>TODAY/SLEEP</option>
            <option value="CANCEL/HOLD" ${row.today_sleep === 'CANCEL/HOLD' || String(row.today_sleep).includes('CALCEL') || String(row.today_sleep).includes('HOLD') ? 'selected' : ''}>CANCEL/HOLD</option>
          </select>
        </td>
        <td class="p-1.5">
          <select onchange="updateBulkRow(${idx}, 'inisiasi', this.value)" class="w-28 ${!row.inisiasi ? 'bg-red-50 border-red-500 text-red-700 font-extrabold' : 'bg-slate-50 border-slate-300 font-bold'} border rounded px-1 py-1 text-xs">
            <option value="" ${!row.inisiasi ? 'selected' : ''}>-- Pilih Inisiasi --</option>
            <option value="(-)" ${row.inisiasi === '(-)' ? 'selected' : ''}>(-)</option>
            <option value="LIL" ${row.inisiasi === 'LIL' ? 'selected' : ''}>LIL</option>
            <option value="RF AXXIS" ${row.inisiasi === 'RF AXXIS' ? 'selected' : ''}>RF AXXIS</option>
            <option value="RF E*TAR" ${row.inisiasi === 'RF E*TAR' ? 'selected' : ''}>RF E*TAR</option>
            <option value="RF HEBS" ${row.inisiasi === 'RF HEBS' ? 'selected' : ''}>RF HEBS</option>
          </select>
        </td>
        <td class="p-1.5"><input type="time" value="${row.jam_masuk}" onchange="updateBulkRow(${idx}, 'jam_masuk', this.value)" class="w-24 bg-slate-50 border border-slate-300 rounded px-1.5 py-1 text-xs font-mono"></td>
        <td class="p-1.5"><input type="number" value="${row.jumlah_holes}" onchange="updateBulkRowNumber(${idx}, 'jumlah_holes', this.value)" class="w-16 text-center bg-slate-50 border border-slate-300 rounded px-1 py-1 text-xs font-mono font-bold"></td>
        <td class="p-1.5"><input type="number" step="1" min="0" value="${Math.round(row.isian_kg || 0)}" onchange="updateBulkRowNumber(${idx}, 'isian_kg', Math.round(Number(this.value)||0))" class="w-20 text-center bg-slate-50 border border-slate-300 rounded px-1 py-1 text-xs font-mono text-red-700 font-bold"></td>
        <td class="p-1.5 text-center">
          <input type="number" step="0.01" min="0" value="${row.volume_ton !== undefined && row.volume_ton !== null && row.volume_ton !== '' && Number(row.volume_ton) > 0 ? Number(row.volume_ton).toFixed(2) : ''}" onchange="updateBulkRow(${idx}, 'volume_ton', parseFloat(this.value)||0)" class="w-20 text-center bg-white border border-emerald-300 rounded px-1 py-1 text-xs font-mono font-bold text-emerald-700 focus:outline-none focus:border-emerald-600" placeholder="0.00">
        </td>
        <td class="p-1.5"><input type="text" value="${row.akses}" onchange="updateBulkRow(${idx}, 'akses', this.value)" class="w-28 bg-slate-50 border border-slate-300 rounded px-1.5 py-1 text-xs"></td>
        <td class="p-1.5"><input type="text" value="${row.desa}" onchange="updateBulkRow(${idx}, 'desa', this.value)" class="w-28 bg-slate-50 border border-slate-300 rounded px-1.5 py-1 text-xs"></td>
        <td class="p-1.5"><input type="text" value="${row.matrix}" onchange="updateBulkRow(${idx}, 'matrix', this.value)" class="w-28 bg-slate-50 border border-slate-300 rounded px-1.5 py-1 text-xs"></td>
        <td class="p-1.5"><input type="text" value="${row.geometri}" onchange="updateBulkRow(${idx}, 'geometri', this.value)" class="w-20 bg-slate-50 border border-slate-300 rounded px-1.5 py-1 text-xs font-mono"></td>
        <td class="p-1.5 bg-red-50/50"><input type="text" value="${row.pengawas_kontraktor || ''}" onchange="updateBulkRow(${idx}, 'pengawas_kontraktor', this.value)" class="w-32 bg-white border border-red-300 rounded px-1.5 py-1 text-xs font-semibold text-slate-900" placeholder="Pengawas..."></td>
        <td class="p-1.5"><input type="text" value="${row.remark || ''}" onchange="updateBulkRow(${idx}, 'remark', this.value)" class="w-32 bg-slate-50 border border-slate-300 rounded px-1.5 py-1 text-xs" placeholder="Remark..."></td>
        <td class="p-1.5 bg-amber-50/40">
          <select onchange="updateBulkRow(${idx}, 'supplier', this.value)" class="w-28 bg-white border border-amber-300 rounded px-1.5 py-1 text-xs font-bold text-amber-950">
            <option value="PT DAHANA" ${String(row.supplier || '').toUpperCase().includes('DAHANA') ? 'selected' : ''}>PT DAHANA</option>
            <option value="PT MNK-KMB" ${String(row.supplier || '').toUpperCase().includes('MNK') || String(row.supplier || '').toUpperCase().includes('KMB') ? 'selected' : ''}>PT MNK-KMB</option>
          </select>
        </td>
        <td class="p-1.5 bg-emerald-50/40">
          <select onchange="updateBulkRowBoundarySelect(${idx}, this.value)"
            class="w-full min-w-[190px] bg-white border border-emerald-300 rounded px-2 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-600">
            ${boundaryOptions}
          </select>
        </td>
        <td class="p-1.5 text-center">
          <button onclick="removeBulkRow(${idx})" class="p-1 text-red-600 hover:bg-red-50 rounded" title="Hapus Baris"><i class="ph-bold ph-trash text-base"></i></button>
        </td>
      </tr>
    `;
  });
  tbody.innerHTML = html;
}

function updateBulkRowLokasi(index, val) {
  if (bulkPreviewRows[index]) {
    const trimmed = String(val || '').trim();
    bulkPreviewRows[index].lokasi = trimmed;
    if (typeof findBoundaryByName === 'function') {
      const bound = findBoundaryByName(trimmed);
      if (bound) {
        bulkPreviewRows[index].selectedBoundaryName = bound.name;
        bulkPreviewRows[index].geometry = bound.wkt;
        bulkPreviewRows[index].latitude = bound.centroid.lat;
        bulkPreviewRows[index].longitude = bound.centroid.lng;
        renderBulkPreviewTable();
      }
    }
  }
}
window.updateBulkRowLokasi = updateBulkRowLokasi;

function updateBulkRowBoundarySelect(index, boundaryName) {
  if (bulkPreviewRows[index]) {
    const trimmed = String(boundaryName || '').trim();
    if (trimmed && typeof findBoundaryByName === 'function') {
      const bound = findBoundaryByName(trimmed);
      if (bound) {
        bulkPreviewRows[index].selectedBoundaryName = bound.name;
        bulkPreviewRows[index].geometry = bound.wkt;
        bulkPreviewRows[index].latitude = bound.centroid.lat;
        bulkPreviewRows[index].longitude = bound.centroid.lng;
        if (!bulkPreviewRows[index].lokasi) {
          bulkPreviewRows[index].lokasi = bound.name;
        }
      } else {
        bulkPreviewRows[index].selectedBoundaryName = '';
        bulkPreviewRows[index].geometry = '';
        bulkPreviewRows[index].latitude = '';
        bulkPreviewRows[index].longitude = '';
      }
    } else {
      bulkPreviewRows[index].selectedBoundaryName = '';
      bulkPreviewRows[index].geometry = '';
      bulkPreviewRows[index].latitude = '';
      bulkPreviewRows[index].longitude = '';
    }
    renderBulkPreviewTable();
  }
}
window.updateBulkRowBoundarySelect = updateBulkRowBoundarySelect;

function updateBulkRowBoundary(index, boundaryName) {
  updateBulkRowBoundarySelect(index, boundaryName);
}
window.updateBulkRowBoundary = updateBulkRowBoundary;

function updateBulkRow(index, field, value) {
  if (bulkPreviewRows[index]) {
    bulkPreviewRows[index][field] = value;
    // Pastikan sinkronisasi dua arah untuk today_sleep dan 'today/sleep'
    if (field === 'today_sleep') {
      bulkPreviewRows[index]['today/sleep'] = value;
    } else if (field === 'today/sleep') {
      bulkPreviewRows[index].today_sleep = value;
    }
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
  }
}

function addBulkPreviewRow() {
  const currentUser = getCurrentUser();
  bulkPreviewRows.push({
    tanggal: getWitaDateString(),
    kontraktor: currentUser ? currentUser.company : 'SIS',
    lokasi: '',
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
    supplier: 'PT DAHANA',
    unit_mmu: '',
    need_mmu: '',
    dth_supplier: 0,
    selectedBoundaryName: '',
    latitude: '',
    longitude: '',
    geometry: ''
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

  // Pastikan supplier terisi default jika kosong dan status tersinkronisasi
  bulkPreviewRows.forEach(r => {
    if (!r.supplier) r.supplier = 'PT DAHANA';
    const cleanStatus = (typeof normalizeBlastingStatus === 'function')
      ? (normalizeBlastingStatus(r.today_sleep || r['today/sleep']) || 'TODAY')
      : (r.today_sleep || r['today/sleep'] || 'TODAY');
    r.today_sleep = cleanStatus;
    r['today/sleep'] = cleanStatus;
  });

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

  // Validasi Revisi 5: Status peledakan wajib dipilih
  const emptyStatusIdx = bulkPreviewRows.findIndex(r => !String(r.today_sleep || r['today/sleep'] || '').trim());
  if (emptyStatusIdx !== -1) {
    Swal.fire({
      icon: 'warning',
      title: 'Status Belum Dipilih',
      text: `Baris #${emptyStatusIdx + 1} belum memiliki Status peledakan (TODAY, SLEEP, TIE UP, dll). Harap pilih status di tabel preview!`
    });
    return;
  }

  // Validasi Revisi 5: Prioritas wajib dipilih
  const emptyPrioIdx = bulkPreviewRows.findIndex(r => !String(r.prioritas || '').trim());
  if (emptyPrioIdx !== -1) {
    Swal.fire({
      icon: 'warning',
      title: 'Prioritas Belum Dipilih',
      text: `Baris #${emptyPrioIdx + 1} belum memiliki Prioritas (P1 atau P2). Harap tentukan prioritas!`
    });
    return;
  }

  // Validasi Revisi 5: Inisiasi wajib dipilih
  const emptyInisiasiIdx = bulkPreviewRows.findIndex(r => !String(r.inisiasi || '').trim());
  if (emptyInisiasiIdx !== -1) {
    Swal.fire({
      icon: 'warning',
      title: 'Inisiasi Belum Dipilih',
      text: `Baris #${emptyInisiasiIdx + 1} belum memiliki Rekomendasi Inisiasi. Harap pilih inisiasi!`
    });
    return;
  }

  // Validasi 2: 1:1 Alokasi Boundary di antara baris-baris yang memilih geometry DXF
  const bulkSeen = new Map();
  for (let i = 0; i < bulkPreviewRows.length; i++) {
    if (bulkPreviewRows[i].geometry) {
      const boundKey = bulkPreviewRows[i].selectedBoundaryName || bulkPreviewRows[i].lokasi;
      const name = String(boundKey || '').trim().toLowerCase();
      if (bulkSeen.has(name)) {
        const prevIdx = bulkSeen.get(name);
        Swal.fire({
          icon: 'warning',
          title: 'Duplikasi Alokasi Boundary',
          text: `Boundary "${boundKey}" dipilih pada Baris #${prevIdx + 1} dan Baris #${i + 1}. Setiap boundary spasial hanya dapat dialokasikan ke 1 plan peledakan!`
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
        const boundKey = r.selectedBoundaryName || r.lokasi;
        const name = String(boundKey || '').trim().toLowerCase();
        if (allocated.has(name)) {
          Swal.fire({
            icon: 'warning',
            title: 'Boundary Sudah Terpakai di Database',
            text: `Boundary "${boundKey}" pada Baris #${i + 1} sudah dialokasikan ke plan lain pada tanggal ${rDate} di database. Harap alokasikan boundary yang belum terpakai!`
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

// ==================== AUTO COMMA SEPARATOR LOGIC ====================
function handleAutoCommaKeydown(event, inputEl) {
  if (event.key === 'Enter') {
    event.preventDefault();
    const val = inputEl.value.trim();
    if (val && !val.endsWith(',')) {
      inputEl.value = val + ', ';
    }
  }
}

function handleAutoCommaBlur(inputEl) {
  if (!inputEl || !inputEl.value) return;
  const parts = inputEl.value.split(/[\r\n,;]+/).map(s => s.trim()).filter(Boolean);
  if (parts.length > 0) {
    inputEl.value = parts.join(', ');
  }
}
window.handleAutoCommaKeydown = handleAutoCommaKeydown;
window.handleAutoCommaBlur = handleAutoCommaBlur;

// ==================== MONTHLY FORECAST SUBMIT & LIVE CALCULATION ====================
function updateForecastCalculationPreview() {
  const bulanEl = document.getElementById('forecast_bulan');
  const compEl = document.getElementById('forecast_perusahaan');
  const tonaseEl = document.getElementById('forecast_tonase');
  if (!bulanEl || !compEl || !tonaseEl) return;

  const targetMonth = (typeof normalizeMonthString === 'function')
    ? normalizeMonthString(bulanEl.value)
    : (bulanEl.value || '').slice(0, 7);
  const selectedComp = compEl.value || 'PT SIS';
  const inputTonase = parseFloat(tonaseEl.value) || 0;

  let sisTonase = 0;
  let bumaTonase = 0;

  if (Array.isArray(globalForecastData)) {
    globalForecastData.forEach(f => {
      const fMonth = (typeof normalizeMonthString === 'function')
        ? normalizeMonthString(f.bulan)
        : String(f.bulan || '').slice(0, 7);
      if (fMonth === targetMonth || (!fMonth && targetMonth)) {
        const c = String(f.perusahaan || '').toUpperCase();
        const val = parseFloat(f.forecast) || 0;
        if (c.includes('SIS')) sisTonase = val;
        else if (c.includes('BUMA')) bumaTonase = val;
      }
    });
  }

  // Override tonase untuk perusahaan yang sedang aktif diisi
  if (selectedComp.toUpperCase().includes('SIS')) {
    sisTonase = inputTonase;
  } else if (selectedComp.toUpperCase().includes('BUMA')) {
    bumaTonase = inputTonase;
  }

  const totalForecastTon = sisTonase + bumaTonase;
  const currentCompTon = selectedComp.toUpperCase().includes('SIS') ? sisTonase : bumaTonase;
  const ratio = totalForecastTon > 0 ? (currentCompTon / totalForecastTon) : 0;

  // Hitung total DTH Ready hari ini dari semua supplier
  const activeDate = (document.getElementById('global-date-filter') ? document.getElementById('global-date-filter').value : '') || getWitaDateString();
  let totalReadyDthToday = 0;
  const supplierList = (typeof globalSupplierData !== 'undefined' && Array.isArray(globalSupplierData))
    ? globalSupplierData
    : ((typeof rawGlobalSupplierData !== 'undefined' && Array.isArray(rawGlobalSupplierData)) ? rawGlobalSupplierData : []);

  supplierList.forEach(sup => {
    const supDate = (typeof normalizeDateToYYYYMMDD === 'function')
      ? normalizeDateToYYYYMMDD(sup.tanggal)
      : String(sup.tanggal || '').slice(0, 10);
    if (supDate === activeDate) {
      totalReadyDthToday += (parseFloat(sup.dth_ready) || 0);
    }
  });

  const resultDth = ratio * totalReadyDthToday;

  const monthLabel = document.getElementById('forecast-preview-month-label');
  if (monthLabel) monthLabel.innerText = targetMonth;

  const elSis = document.getElementById('preview-val-forecast-sis');
  if (elSis) elSis.innerText = `${sisTonase.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} Ton`;

  const elBuma = document.getElementById('preview-val-forecast-buma');
  if (elBuma) elBuma.innerText = `${bumaTonase.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} Ton`;

  const elReady = document.getElementById('preview-val-ready-dth');
  if (elReady) elReady.innerText = `${totalReadyDthToday.toFixed(2)} Ton`;

  const elRatio = document.getElementById('preview-val-ratio');
  if (elRatio) elRatio.innerText = `${(ratio * 100).toFixed(1)}%`;

  const elResult = document.getElementById('preview-val-result-dth');
  if (elResult) elResult.innerText = `${resultDth.toFixed(2)} Ton`;
}

function openForecastModal() {
  if (currentUser && currentUser.role === 'SUPPLIER') return;
  if (typeof switchOwnerForm === 'function') {
    switchOwnerForm('kontraktor');
  }
  if (typeof switchKontraktorSubTab === 'function') {
    switchKontraktorSubTab('forecast');
  }
  try {
    updateForecastCalculationPreview();
  } catch (e) {
    console.warn('Forecast preview warning:', e);
  }
}

function closeForecastModal() {
  if (typeof switchKontraktorSubTab === 'function') {
    switchKontraktorSubTab('plan');
  }
}

async function handleMonthlyForecastSubmit(event) {
  if (event && event.preventDefault) event.preventDefault();
  const bulanEl = document.getElementById('forecast_bulan');
  const compEl = document.getElementById('forecast_perusahaan');
  const tonaseEl = document.getElementById('forecast_tonase');

  const bulan = bulanEl ? bulanEl.value : '';
  let perusahaan = compEl ? compEl.value : '';

  // Kunci perusahaan kontraktor jika login sebagai kontraktor
  if (currentUser && currentUser.role === 'KONTRAKTOR') {
    if (currentUser.company && currentUser.company.toUpperCase().includes('BUMA')) {
      perusahaan = 'PT BUMA';
    } else {
      perusahaan = 'PT SIS';
    }
    if (compEl) compEl.value = perusahaan;
  }

  const tonase = tonaseEl ? (parseFloat(tonaseEl.value) || 0) : 0;

  if (!bulan || !perusahaan || tonase <= 0) {
    Swal.fire({
      icon: 'warning',
      title: 'Data Belum Lengkap',
      text: 'Semua field forecast wajib diisi dengan nilai valid (> 0 Ton)!'
    });
    return;
  }

  const pinOk = await requestSecurityPin(`menyimpan forecast bulanan ${perusahaan} untuk periode ${bulan}`);
  if (!pinOk) return;

  const btn = document.getElementById('btn-submit-forecast');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="ph-bold ph-spinner animate-spin"></i> Menyimpan...`;
  }
  showGlobalLoading();

  try {
    const userRole = isUserOwner() ? 'ADMIN' : (currentUser ? currentUser.role : 'KONTRAKTOR');
    const res = await apiCall('saveForecast', {
      data: {
        bulan: bulan,
        perusahaan: perusahaan,
        forecast: tonase
      },
      role: userRole,
      company: perusahaan
    });

    if (res && res.success) {
      // Perbarui globalForecastData di memori secara lokal
      const normMonth = (typeof normalizeMonthString === 'function') ? normalizeMonthString(bulan) : bulan.slice(0, 7);
      let found = false;
      if (!Array.isArray(globalForecastData)) globalForecastData = [];
      for (let i = 0; i < globalForecastData.length; i++) {
        const itemMonth = (typeof normalizeMonthString === 'function')
          ? normalizeMonthString(globalForecastData[i].bulan)
          : String(globalForecastData[i].bulan || '').slice(0, 7);
        const itemComp = String(globalForecastData[i].perusahaan || '').toUpperCase();
        if (itemMonth === normMonth && itemComp === perusahaan.toUpperCase()) {
          globalForecastData[i].forecast = tonase;
          found = true;
          break;
        }
      }
      if (!found) {
        globalForecastData.push({
          bulan: bulan,
          perusahaan: perusahaan,
          forecast: tonase
        });
      }

      Swal.fire({
        icon: 'success',
        title: 'Forecast Tersimpan!',
        text: `Forecast bulanan ${perusahaan} (${tonase.toLocaleString('id-ID')} Ton) berhasil disimpan ke sheet forecast.`,
        timer: 2000,
        showConfirmButton: false
      });

      // Update UI preview secara aman (tanpa melempar error ke catch block)
      try {
        if (typeof updateForecastCalculationPreview === 'function') {
          updateForecastCalculationPreview();
        }
      } catch (ePreview) {
        console.warn('Forecast preview warning:', ePreview);
      }

      try {
        if (typeof filterAndRenderDashboard === 'function') {
          const activeDate = (document.getElementById('global-date-filter') ? document.getElementById('global-date-filter').value : '') || getWitaDateString();
          filterAndRenderDashboard(activeDate);
        }
      } catch (eDash) {
        console.warn('Dashboard render warning:', eDash);
      }
    } else {
      Swal.fire({
        icon: 'error',
        title: 'Gagal Menyimpan',
        text: (res && res.message) || 'Gagal menyimpan data forecast'
      });
    }
  } catch (err) {
    console.error('Error save forecast:', err);
    Swal.fire({ icon: 'error', title: 'Error', text: 'Gagal menghubungi server backend.' });
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="ph-bold ph-floppy-disk text-base"></i> Simpan Forecast Bulanan`;
    }
    hideGlobalLoading();
  }
}

window.openForecastModal = openForecastModal;
window.closeForecastModal = closeForecastModal;
window.updateForecastCalculationPreview = updateForecastCalculationPreview;
window.handleMonthlyForecastSubmit = handleMonthlyForecastSubmit;


