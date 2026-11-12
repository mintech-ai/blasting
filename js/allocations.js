/**
 * INTEGRATED BLASTING PLAN & DASHBOARD PLATFORM
 * Module: SUPPLIER ALLOCATION & EDIT MODALS
 * Menangani modal edit rencana peledakan, alokasi sumber daya supplier (MMU/MMT pecahan, blaster, pengawas, mobil box),
 * dan modal edit kesiapan operasional supplier.
 */

// ==================== EDIT PLAN MODAL LOGIC & ALLOCATION ====================

function openEditPlanModal(id) {
  const item = globalPlanData.find(x => String(x.uuid || x.id) === String(id));
  if (!item) {
    Swal.fire({ icon: 'error', title: 'Data Tidak Ditemukan', text: 'ID Plan tidak ditemukan dalam memori' });
    return;
  }

  currentEditingItem = item;
  document.getElementById('edit_uuid').value = item.uuid || item.id || '';

  const clearBtn = document.getElementById('btn-modal-clear-supplier');
  if (clearBtn) {
    clearBtn.classList.add('hidden');
    clearBtn.classList.remove('flex');
  }

  if (isUserSupplier()) {
    const userCompany = cleanCompanyName(currentUser.company).toUpperCase();
    const claimedSupplier = cleanCompanyName(item.supplier).toUpperCase();

    if (item.supplier && !claimedSupplier.includes(userCompany) && !userCompany.includes(claimedSupplier)) {
      Swal.fire({
        icon: 'warning',
        title: 'Slot Dikunci Supplier Lain',
        text: `Baris ini sudah diisi oleh supplier ${item.supplier}. Anda hanya bisa mengisi supplier masing-masing!`
      });
      return;
    }

    if ((claimedSupplier.includes(userCompany) || userCompany.includes(claimedSupplier)) && clearBtn) {
      clearBtn.classList.remove('hidden');
      clearBtn.classList.add('flex');
    }
  } else if (isUserOwner()) {
    if (item.supplier && clearBtn) {
      clearBtn.classList.remove('hidden');
      clearBtn.classList.add('flex');
    }
  }

  renderEditModalFields(item);

  const modal = document.getElementById('modal-edit-plan');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
}

function renderEditModalFields(item) {
  const container = document.getElementById('edit-fields-container');
  if (!container) return;

  const canEditKontraktor = isUserOwner() || isUserKontraktor();
  const canEditSupplier = isUserOwner() || isUserSupplier();

  const itemDateNorm = normalizeDateToYYYYMMDD(item.tanggal);
  const daySuppliers = rawGlobalSupplierData.filter(s => normalizeDateToYYYYMMDD(s.tanggal) === itemDateNorm);

  let html = '';

  if (canEditKontraktor) {
    html += `
      <div class="bg-slate-50 p-4 rounded-xl border border-slate-200">
        <h4 class="font-black text-slate-900 text-xs flex items-center gap-1.5 mb-3 uppercase tracking-wide">
          <i class="ph-bold ph-file-text text-red-600 text-sm"></i> 1. Isian Data Plan Blasting (Kontraktor)
        </h4>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          ${isUserOwner() ? `
          <div class="md:col-span-2">
            <label class="block font-bold text-slate-700 mb-1">Kontraktor Mitra Kerja</label>
            <select id="edit_kontraktor" required class="w-full bg-white border border-slate-300 rounded-xl p-2.5 font-bold text-slate-800">
              <option value="PT SIS" ${String(item.kontraktor || '').toUpperCase().includes('SIS') || !String(item.kontraktor || '').toUpperCase().includes('BUMA') ? 'selected' : ''}>PT SIS</option>
              <option value="PT BUMA" ${String(item.kontraktor || '').toUpperCase().includes('BUMA') ? 'selected' : ''}>PT BUMA</option>
            </select>
          </div>
          ` : ''}
          <div>
            <label class="block font-bold text-slate-700 mb-1">Lokasi Blasting</label>
            <input type="text" id="edit_lokasi" value="${item.lokasi || ''}" required class="w-full bg-white border border-slate-300 rounded-xl p-2.5 font-bold text-slate-800">
          </div>

          <div>
            <label class="block font-bold text-slate-700 mb-1">Prioritas</label>
            <select id="edit_prioritas" required class="w-full bg-white border border-slate-300 rounded-xl p-2.5 font-bold">
              <option value="Prioritas 1" ${item.prioritas === 'Prioritas 1' ? 'selected' : ''}>Prioritas 1</option>
              <option value="Prioritas 2" ${item.prioritas === 'Prioritas 2' ? 'selected' : ''}>Prioritas 2</option>
            </select>
          </div>

          <div>
            <label class="block font-bold text-slate-700 mb-1">Status Today/Sleep</label>
            <select id="edit_today_sleep" required class="w-full bg-white border border-slate-300 rounded-xl p-2.5 font-bold">
              <option value="TODAY" ${item.today_sleep === 'TODAY' ? 'selected' : ''}>TODAY</option>
              <option value="SLEEP" ${item.today_sleep === 'SLEEP' ? 'selected' : ''}>SLEEP</option>
              <option value="TIE UP" ${item.today_sleep === 'TIE UP' ? 'selected' : ''}>TIE UP</option>
              <option value="TIE UP + TODAY" ${item.today_sleep === 'TIE UP + TODAY' ? 'selected' : ''}>TIE UP + TODAY</option>
              <option value="TODAY/SLEEP" ${item.today_sleep === 'TODAY/SLEEP' ? 'selected' : ''}>TODAY/SLEEP</option>
              <option value="CANCEL/HOLD" ${item.today_sleep === 'CANCEL/HOLD' || String(item.today_sleep).includes('CALCEL') || String(item.today_sleep).includes('HOLD') ? 'selected' : ''}>CANCEL/HOLD</option>
            </select>
          </div>

          <div>
            <label class="block font-bold text-slate-700 mb-1">Inisiasi</label>
            <select id="edit_inisiasi" required class="w-full bg-white border border-slate-300 rounded-xl p-2.5 font-bold">
              <option value="RF" ${item.inisiasi === 'RF' ? 'selected' : ''}>RF</option>
              <option value="LIL" ${item.inisiasi === 'LIL' ? 'selected' : ''}>LIL</option>
            </select>
          </div>

          <div>
            <label class="block font-bold text-slate-700 mb-1">Jam Masuk</label>
            <input type="time" id="edit_jam_masuk" value="${formatExcelTime(item.jam_masuk || item.kondisi_jam_masuk)}" required class="w-full bg-white border border-slate-300 rounded-xl p-2.5 font-mono font-bold">
          </div>

          <div>
            <label class="block font-bold text-slate-700 mb-1">Pengawas Kontraktor</label>
            <input type="text" id="edit_pengawas_kontraktor" value="${item.pengawas_kontraktor || ''}" required class="w-full bg-white border border-slate-300 rounded-xl p-2.5 font-bold">
          </div>

          <div>
            <label class="block font-bold text-slate-700 mb-1">Jumlah Holes</label>
            <input type="number" id="edit_jumlah_holes" value="${item.jumlah_holes || 0}" required class="w-full bg-white border border-slate-300 rounded-xl p-2.5 font-mono font-bold">
          </div>

          <div>
            <label class="block font-bold text-slate-700 mb-1">Isian (Kg/Hole)</label>
            <input type="number" id="edit_isian_kg" step="0.1" value="${item.isian_kg || 0}" required class="w-full bg-white border border-slate-300 rounded-xl p-2.5 font-mono font-bold text-red-700">
          </div>

          <div>
            <label class="block font-bold text-slate-700 mb-1">Volume (Ton DTH)</label>
            <input type="number" id="edit_volume_ton" step="0.01" value="${Number(item.volume_ton || 0).toFixed(2)}" oninput="calculateAllocMmuSummary()" class="w-full bg-white border border-slate-300 rounded-xl p-2.5 font-mono font-bold text-slate-800 focus:outline-none focus:border-red-600">
          </div>

          <div>
            <label class="block font-bold text-slate-700 mb-1">Matrix Isian</label>
            <input type="text" id="edit_matrix" value="${item.matrix || ''}" required class="w-full bg-white border border-slate-300 rounded-xl p-2.5 font-medium">
          </div>

          <div>
            <label class="block font-bold text-slate-700 mb-1">Geometri</label>
            <input type="text" id="edit_geometri" value="${item.geometri || ''}" required class="w-full bg-white border border-slate-300 rounded-xl p-2.5 font-mono font-bold">
          </div>

          <div>
            <label class="block font-bold text-slate-700 mb-1 flex items-center gap-1">
              <i class="ph-bold ph-signpost text-emerald-600"></i> Akses Masuk Lokasi
            </label>
            <input type="text" id="edit_akses" value="${item.akses || ''}" placeholder="misal: Jl Hauling KM 12, Pintu 3..." required class="w-full bg-white border border-slate-300 rounded-xl p-2.5 font-medium">
          </div>

          <div>
            <label class="block font-bold text-slate-700 mb-1 flex items-center gap-1">
              <i class="ph-bold ph-warning-circle text-red-600"></i> Desa Terdampak Peledakan
            </label>
            <input type="text" id="edit_desa" value="${item.desa || ''}" placeholder="misal: Desa Bata, Desa Bilas..." required class="w-full bg-white border border-slate-300 rounded-xl p-2.5 font-bold">
          </div>

          <div>
            <label class="block font-bold text-slate-700 mb-1">Remark Lapangan</label>
            <input type="text" id="edit_remark" value="${item.remark || ''}" class="w-full bg-white border border-slate-300 rounded-xl p-2.5 font-medium">
          </div>

          <!-- Need MMU / MMT -->
          <div class="col-span-1 md:col-span-2 bg-amber-50/50 p-3 rounded-xl border border-amber-200">
            <div class="flex items-center justify-between mb-1.5">
              <label class="block font-bold text-amber-950 text-xs flex items-center gap-1">
                <i class="ph-bold ph-truck text-amber-700"></i> Need MMU / MMT (Alokasi Unit)
              </label>
              <span id="edit-display-need-mmu-dth" class="font-mono font-bold text-[11px] text-emerald-700 bg-white px-2 py-0.5 rounded border border-emerald-200">
                Total DTH: ${(item.dth_supplier ? Number(item.dth_supplier) : calculateMmuTotalDth(item.need_mmu)).toFixed(2)} Ton
              </span>
            </div>
            <input type="text" id="edit_need_mmu" value="${item.need_mmu || ''}"
              oninput="handleEditNeedMmuInput(this.value)"
              placeholder="Contoh: MMU 23, MMU 19 (Pisahkan koma jika > 1)" class="w-full bg-white border border-amber-300 rounded-xl p-2.5 font-mono font-bold text-slate-800 text-xs focus:outline-none focus:border-red-600">
            <input type="hidden" id="edit_dth_supplier" value="${item.dth_supplier || calculateMmuTotalDth(item.need_mmu)}">
          </div>

          <!-- Koordinat Blasting -->
          <div class="col-span-1 md:col-span-2 bg-white p-3 rounded-xl border border-slate-300">
            <div class="flex items-center justify-between mb-2">
              <label class="block font-bold text-slate-800 flex items-center gap-1.5">
                <i class="ph-bold ph-map-pin text-red-600"></i> Koordinat Lokasi Blasting (Latitude & Longitude)
              </label>
              <button type="button" onclick="openMapPickerModal('edit_latitude', 'edit_longitude')" class="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 font-bold rounded-lg border border-red-200 flex items-center gap-1 text-[11px] transition shadow-2xs">
                <i class="ph-bold ph-map-trifold"></i> Pilih di Peta (Map Picker)
              </button>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <span class="block text-[11px] font-bold text-slate-600 mb-1">Latitude</span>
                <input type="number" step="any" id="edit_latitude" value="${item.latitude !== undefined ? item.latitude : ''}" placeholder="Contoh: -2.12345" class="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 font-mono font-bold text-slate-800 text-xs focus:bg-white focus:outline-none focus:border-red-600">
              </div>
              <div>
                <span class="block text-[11px] font-bold text-slate-600 mb-1">Longitude</span>
                <input type="number" step="any" id="edit_longitude" value="${item.longitude !== undefined ? item.longitude : ''}" placeholder="Contoh: 115.54321" class="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 font-mono font-bold text-slate-800 text-xs focus:bg-white focus:outline-none focus:border-red-600">
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  if (canEditSupplier) {
    const isOwner = isUserOwner();
    const userComp = cleanCompanyName(currentUser.company).toUpperCase();

    let defaultSup = 'DAHANA';
    if (!isOwner) {
      if (userComp.includes('DAHANA')) defaultSup = 'DAHANA';
      else if (userComp.includes('MNK') || userComp.includes('KMB')) defaultSup = 'MNK-KMB';
    } else {
      defaultSup = item.supplier ? cleanCompanyName(item.supplier).toUpperCase() : 'DAHANA';
    }

    const currentSupVal = item.supplier ? cleanCompanyName(item.supplier).toUpperCase() : defaultSup;

    html += `
      <div class="bg-amber-50/40 p-4 rounded-xl border border-amber-300">
        <h4 class="font-black text-amber-950 text-xs flex items-center gap-1.5 mb-3 uppercase tracking-wide">
          <i class="ph-bold ph-truck text-amber-600 text-sm"></i> 2. Alokasi Sumber Daya Supplier (MMU, Blaster, Pengawas, Box)
        </h4>

        <div class="space-y-3.5">
          <div>
            <label class="block font-extrabold text-amber-950 mb-1">Pilih Supplier Mitra</label>
            <select id="edit_supplier_select" onchange="handleEditSupplierChange()" class="w-full bg-white border border-amber-300 rounded-xl p-2.5 font-bold text-amber-950 focus:outline-none focus:ring-2 focus:ring-amber-500" ${!isOwner ? 'disabled' : ''}>
              <option value="PT DAHANA" ${currentSupVal.includes('DAHANA') ? 'selected' : ''}>PT DAHANA</option>
              <option value="PT MNK-KMB" ${currentSupVal.includes('MNK') || currentSupVal.includes('KMB') ? 'selected' : ''}>PT MNK-KMB</option>
            </select>
          </div>

          <div id="supplier-allocation-fields-container" class="space-y-3">
          </div>
        </div>
      </div>
    `;
  }

  container.innerHTML = html;

  if (canEditSupplier) {
    handleEditSupplierChange();
  }
}

function handleEditSupplierChange() {
  const container = document.getElementById('supplier-allocation-fields-container');
  if (!container) return;

  const sel = document.getElementById('edit_supplier_select');
  const selectedSup = sel ? sel.value : (isUserSupplier() ? cleanCompanyName(currentUser.company) : 'PT DAHANA');
  const targetDateNorm = normalizeDateToYYYYMMDD(currentEditingItem ? currentEditingItem.tanggal : '');

  const supReadiness = rawGlobalSupplierData.find(s => {
    const sDate = normalizeDateToYYYYMMDD(s.tanggal);
    const sName = cleanCompanyName(s.supplier).toUpperCase();
    const targetSup = cleanCompanyName(selectedSup).toUpperCase();
    return sDate === targetDateNorm && (sName.includes(targetSup) || targetSup.includes(sName));
  });

  const otherPlansSameDate = rawGlobalPlanData.filter(p => {
    const pDate = normalizeDateToYYYYMMDD(p.tanggal);
    const isSameDate = (pDate === targetDateNorm);
    const isSelf = currentEditingItem && (String(p.uuid || p.id) === String(currentEditingItem.uuid || currentEditingItem.id));
    return isSameDate && !isSelf;
  });

  const allocatedOtherSpvs = new Set();
  const allocatedOtherBlasters = new Set();
  const allocatedOtherBoxes = new Set();
  const allocatedOtherMmus = new Map();

  otherPlansSameDate.forEach(p => {
    if (p.pengawas_supplier) {
      const names = String(p.pengawas_supplier).replace(/^\d+\s*\(/, '').replace(/\)$/, '').split(/[,;/]+/);
      names.forEach(n => {
        const trimmed = n.trim();
        if (trimmed && !trimmed.includes('#NUM') && trimmed !== 'NaN') allocatedOtherSpvs.add(trimmed.toUpperCase());
      });
    }

    if (p.jumlah_blaster || p.blaster) {
      const bStr = String(p.jumlah_blaster || p.blaster || '');
      const names = bStr.replace(/^\d+\s*\(/, '').replace(/\)$/, '').split(/[,;/]+/);
      names.forEach(n => {
        const trimmed = n.trim();
        if (trimmed && !trimmed.includes('#NUM') && trimmed !== 'NaN') allocatedOtherBlasters.add(trimmed.toUpperCase());
      });
    }

    if (p.unit_box) {
      const bNames = String(p.unit_box).replace(/^\d+\s*\(/, '').replace(/\)$/, '').split(/[,;/]+/);
      bNames.forEach(b => {
        const trimmed = b.trim();
        if (trimmed && !trimmed.includes('#NUM') && trimmed !== 'NaN') allocatedOtherBoxes.add(trimmed.toUpperCase());
      });
    }

    if (p.unit_mmu) {
      const parsed = parseAllocatedMmuInfo(p.unit_mmu);
      if (parsed && parsed.items) {
        parsed.items.forEach(it => {
          const cleanCode = it.code.toUpperCase().replace(/\s+/g, '');
          const prevQty = allocatedOtherMmus.get(cleanCode) || 0;
          allocatedOtherMmus.set(cleanCode, prevQty + it.qty);
        });
      }
    }
  });

  // 1. Available SPV Names
  const spvNamesRaw = supReadiness ? (supReadiness.nama_spv || '') : '';
  const availableSpvs = spvNamesRaw.split(/[,;/]+/).map(x => x.trim()).filter(Boolean);
  let existingSpvVal = currentEditingItem ? (currentEditingItem.pengawas_supplier || '') : '';
  if (String(existingSpvVal).includes('#NUM') || String(existingSpvVal) === 'NaN') existingSpvVal = '';

  // 2. Available Blaster Names (Revisi 1)
  const blasterNamesRaw = supReadiness ? (supReadiness.nama_blaster || '') : '';
  const availableBlasters = blasterNamesRaw.split(/[,;/]+/).map(x => x.trim()).filter(Boolean);
  let existingBlasterVal = currentEditingItem ? (currentEditingItem.jumlah_blaster || currentEditingItem.blaster || '') : '';
  if (String(existingBlasterVal).includes('#NUM') || String(existingBlasterVal) === 'NaN') existingBlasterVal = '';

  // 3. Available MMUs
  let availableMmus = [];
  if (supReadiness && supReadiness.unit_mmu) {
    availableMmus = supReadiness.unit_mmu.split(/[,;/]+/).map(x => x.trim()).filter(Boolean);
  }
  const existingMmuVal = currentEditingItem ? (currentEditingItem.unit_mmu || '') : '';
  const parsedExistingMmu = parseAllocatedMmuInfo(existingMmuVal);

  if (parsedExistingMmu && parsedExistingMmu.items) {
    parsedExistingMmu.items.forEach(it => {
      const itClean = it.code.toUpperCase().replace(/\s+/g, '');
      if (!availableMmus.some(u => u.toUpperCase().replace(/\s+/g, '') === itClean)) {
        availableMmus.push(it.code);
      }
    });
  }

  // 4. Available Box
  let availableBoxes = [];
  if (supReadiness && supReadiness.unit_box) {
    availableBoxes = supReadiness.unit_box.split(/[,;/]+/).map(x => x.trim()).filter(Boolean);
  }
  const existingBoxVal = currentEditingItem ? (currentEditingItem.unit_box || '') : '';

  let dynamicHtml = `
    <!-- PENGAWAS SELECTION -->
    <div class="bg-white p-3.5 rounded-xl border border-amber-200">
      <label class="block font-extrabold text-blue-900 mb-1 flex items-center justify-between">
        <span><i class="ph-bold ph-user-circle-gear text-blue-600"></i> Pengawas Supplier</span>
        <span class="text-[11px] font-bold text-slate-500" id="display-spv-alloc-count">0 Terpilih</span>
      </label>
      <div class="flex flex-wrap gap-2 my-2" id="container-spv-chips">
  `;

  if (availableSpvs.length > 0) {
    availableSpvs.forEach(name => {
      const isChecked = existingSpvVal.includes(name);
      const isAllocatedElsewhere = allocatedOtherSpvs.has(name.toUpperCase()) && !isChecked;

      // Revisi 2: Jangan di-lock! Tetap bisa diklik/dipilih
      dynamicHtml += `
        <label class="flex items-center gap-1.5 px-2.5 py-1 ${isChecked ? 'bg-blue-100 border-blue-400' : (isAllocatedElsewhere ? 'bg-amber-50/70 border-amber-200' : 'bg-blue-50 border-blue-200')} border rounded-lg text-xs font-bold text-blue-900 cursor-pointer hover:bg-blue-100">
          <input type="checkbox" name="alloc_spv_chk" value="${name}" ${isChecked ? 'checked' : ''} onchange="updateAllocSpvSummary()" class="rounded text-blue-600 focus:ring-0">
          <span>${name}</span>
          ${isAllocatedElsewhere ? `<span class="text-[9px] font-bold text-amber-700 bg-amber-100 px-1 rounded border border-amber-200">Terpakai</span>` : ''}
        </label>
      `;
    });
  } else {
    dynamicHtml += `<span class="text-[11px] text-slate-400 italic">Belum ada nama Pengawas di kesiapan supplier hari ini. Ketik manual di bawah:</span>`;
  }

  dynamicHtml += `
      </div>
      <input type="text" id="alloc_spv_custom" value="${existingSpvVal}" placeholder="Format: 2 (Nama A, Nama B) atau tulis nama..." oninput="updateAllocSpvSummary(true)" class="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 font-bold text-slate-800 text-xs mt-1">
    </div>

    <!-- BLASTER SELECTION (Revisi 1: Nama Blaster & Revisi 2: Bebas Alokasi) -->
    <div class="bg-white p-3.5 rounded-xl border border-amber-200">
      <label class="block font-extrabold text-purple-900 mb-1 flex items-center justify-between">
        <span><i class="ph-bold ph-user-check text-purple-600"></i> Blaster Supplier</span>
        <span class="text-[11px] font-bold text-slate-500" id="display-blaster-alloc-count">0 Terpilih</span>
      </label>
      <div class="flex flex-wrap gap-2 my-2" id="container-blaster-chips">
  `;

  if (availableBlasters.length > 0) {
    availableBlasters.forEach(name => {
      const isChecked = String(existingBlasterVal).includes(name);
      const isAllocatedElsewhere = allocatedOtherBlasters.has(name.toUpperCase()) && !isChecked;

      // Revisi 2: Jangan di-lock! Tetap bisa diklik/dipilih
      dynamicHtml += `
        <label class="flex items-center gap-1.5 px-2.5 py-1 ${isChecked ? 'bg-purple-100 border-purple-400' : (isAllocatedElsewhere ? 'bg-amber-50/70 border-amber-200' : 'bg-purple-50 border-purple-200')} border rounded-lg text-xs font-bold text-purple-900 cursor-pointer hover:bg-purple-100">
          <input type="checkbox" name="alloc_blaster_chk" value="${name}" ${isChecked ? 'checked' : ''} onchange="updateAllocBlasterSummary()" class="rounded text-purple-600 focus:ring-0">
          <span>${name}</span>
          ${isAllocatedElsewhere ? `<span class="text-[9px] font-bold text-amber-700 bg-amber-100 px-1 rounded border border-amber-200">Terpakai</span>` : ''}
        </label>
      `;
    });
  } else {
    dynamicHtml += `<span class="text-[11px] text-slate-400 italic">Belum ada nama Blaster di kesiapan supplier hari ini. Ketik manual di bawah:</span>`;
  }

  dynamicHtml += `
      </div>
      <input type="text" id="alloc_blaster_custom" value="${existingBlasterVal}" placeholder="Format: 3 (Nama A, Nama B) atau angka blaster..." oninput="updateAllocBlasterSummary(true)" class="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 font-bold text-slate-800 text-xs mt-1">
    </div>

    <!-- MMU ALLOCATION WITH FRACTIONS (Revisi 2: Ga dilock & Revisi 3: 2 Angka Belakang Koma) -->
    <div class="bg-white p-3.5 rounded-xl border border-amber-200 space-y-2">
      <div class="flex items-center justify-between">
        <label class="block font-extrabold text-amber-950">
          <i class="ph-bold ph-truck text-amber-700"></i> Alokasi Unit MMU / MMT (Bisa 1 atau Pecahan 0.x Unit):
        </label>
        <span class="text-xs font-black text-emerald-700 font-mono" id="display-alloc-mmu-total">0 Unit | 0.00 Ton</span>
      </div>

      <div class="space-y-2" id="container-alloc-mmu-rows">
  `;

  if (availableMmus.length === 0) {
    dynamicHtml += `
      <div class="p-3 bg-amber-50 rounded-xl border border-amber-200 text-center text-xs text-amber-800 italic">
        Tidak ada unit MMU/MMT yang dinyatakan Ready oleh supplier ${selectedSup} pada tanggal ini.
      </div>
    `;
  } else {
    availableMmus.forEach(unit => {
      const cap = getMmuCapacity(unit);
      const cleanUnitCode = unit.toUpperCase().replace(/\s+/g, '');
      const cleanId = unit.replace(/[^A-Z0-9]/gi, '');
      const isReload = unit.toUpperCase().includes('RELOAD');
      const existingItem = parsedExistingMmu.items.find(x => x.code.toUpperCase().replace(/\s+/g, '') === cleanUnitCode);
      const activeQty = existingItem ? existingItem.qty : 0;
      const isChecked = activeQty > 0;

      const qtyUsedElsewhere = allocatedOtherMmus.get(cleanUnitCode) || 0;
      const remainingCapacityRatio = Math.max(0, 1 - qtyUsedElsewhere);
      const initQtyVal = activeQty > 0 ? (activeQty % 1 === 0 ? activeQty : activeQty.toFixed(2)) : (isChecked ? 1 : '');
      const initTonVal = activeQty > 0 ? (activeQty * cap).toFixed(2) : (isChecked ? cap.toFixed(2) : '');

      // Revisi 2: Jangan di-lock meskipun terpakai!
      // Revisi 3: step="0.01" agar bisa 2 angka di belakang koma (misal 0.88, 0.05, 0.15)
      dynamicHtml += `
        <div class="flex items-center justify-between p-2.5 rounded-xl border ${isChecked ? 'bg-amber-50/70 border-amber-300 shadow-2xs' : 'bg-slate-50 border-slate-200'} transition" id="row-alloc-mmu-${cleanId}">
          <label class="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" name="alloc_mmu_chk" value="${unit}" data-cap="${cap}" ${isChecked ? 'checked' : ''} onchange="handleAllocMmuRowToggle('${unit}')" class="rounded text-amber-600 focus:ring-0">
            <span class="font-mono font-black text-slate-900 text-xs">${unit}</span>
            <span class="text-[10px] font-bold text-slate-500">(${cap} Ton)</span>
            ${isReload ? `<span class="text-[9px] font-extrabold text-amber-900 bg-amber-200 px-1.5 py-0.5 rounded border border-amber-300 shadow-2xs">Reload</span>` : ''}
            ${qtyUsedElsewhere > 0 ? `<span class="text-[9px] font-bold text-amber-700 bg-amber-100 px-1 rounded border border-amber-300">Terpakai ${parseFloat(qtyUsedElsewhere.toFixed(2))} Unit</span>` : ''}
          </label>

          <div class="flex items-center gap-2">
            <div class="flex items-center gap-1">
              <span class="text-[10px] font-bold text-slate-500">Jumlah Unit:</span>
              <input type="number" step="0.01" min="0"
                value="${initQtyVal}"
                placeholder="0"
                id="qty_alloc_${cleanId}"
                oninput="handleAllocUnitChange('${unit}', ${cap})"
                class="w-16 bg-white border border-amber-300 rounded-lg p-1 text-center font-mono font-black text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500">
            </div>
            <div class="flex items-center gap-1">
              <span class="text-[10px] font-bold text-slate-500">Tonase:</span>
              <input type="number" step="0.01" min="0"
                value="${initTonVal}"
                placeholder="0.00"
                id="ton_alloc_${cleanId}"
                oninput="handleAllocTonChange('${unit}', ${cap})"
                class="w-20 bg-white border border-emerald-400 rounded-lg p-1 text-center font-mono font-black text-xs text-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500">
            </div>
          </div>
        </div>
      `;
    });
  }

  dynamicHtml += `
      </div>
      <input type="text" id="edit_unit_mmu" value="${existingMmuVal}" readonly class="w-full bg-slate-50 border border-amber-300 rounded-xl p-2.5 font-mono font-bold text-slate-800 text-xs">
      <div id="alloc-mmu-comparison-badge"></div>
    </div>

    <!-- MOBIL BOX ALLOCATION (Revisi 2: Ga dilock) -->
    <div class="bg-white p-3.5 rounded-xl border border-amber-200">
      <label class="block font-extrabold text-slate-800 mb-1 flex items-center justify-between">
        <span><i class="ph-bold ph-package text-slate-700"></i> Unit Mobil Box</span>
        <span class="text-[11px] font-bold text-slate-500" id="display-box-alloc-count">0 Box</span>
      </label>
      <div class="flex flex-wrap gap-2 my-2" id="container-box-chips">
  `;

  if (availableBoxes.length > 0) {
    availableBoxes.forEach(box => {
      const isChecked = existingBoxVal.includes(box);
      const isAllocatedElsewhere = allocatedOtherBoxes.has(box.toUpperCase()) && !isChecked;

      dynamicHtml += `
        <label class="flex items-center gap-1.5 px-2.5 py-1 ${isChecked ? 'bg-slate-200 border-slate-400' : (isAllocatedElsewhere ? 'bg-amber-50/70 border-amber-200' : 'bg-slate-100 border-slate-300')} border rounded-lg text-xs font-bold text-slate-800 cursor-pointer hover:bg-slate-200">
          <input type="checkbox" name="alloc_box_chk" value="${box}" ${isChecked ? 'checked' : ''} onchange="updateAllocBoxSummary()" class="rounded text-slate-700 focus:ring-0">
          <span>${box}</span>
          ${isAllocatedElsewhere ? `<span class="text-[9px] font-bold text-amber-700 bg-amber-100 px-1 rounded border border-amber-200">Terpakai</span>` : ''}
        </label>
      `;
    });
  } else {
    dynamicHtml += `<span class="text-[11px] text-slate-400 italic">Belum ada unit Box di kesiapan hari ini. Ketik manual di bawah:</span>`;
  }

  dynamicHtml += `
      </div>
      <input type="text" id="edit_unit_box" value="${existingBoxVal}" placeholder="Format: 1 (Box 32) atau daftar box..." oninput="updateAllocBoxSummary(true)" class="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 font-mono font-bold text-slate-800 text-xs mt-1">
    </div>
  `;

  container.innerHTML = dynamicHtml;

  updateAllocSpvSummary();
  updateAllocBlasterSummary();
  calculateAllocMmuSummary();
  updateAllocBoxSummary();
}

function updateAllocSpvSummary(fromCustomInput = false) {
  const chks = document.querySelectorAll('input[name="alloc_spv_chk"]:checked');
  const names = Array.from(chks).map(c => c.value);
  const customInput = document.getElementById('alloc_spv_custom');
  const countEl = document.getElementById('display-spv-alloc-count');

  if (!fromCustomInput && customInput) {
    if (names.length > 0) {
      customInput.value = `${names.length} (${names.join(', ')})`;
    } else {
      customInput.value = '';
    }
  }

  if (countEl) {
    countEl.innerText = `${names.length} Terpilih`;
  }
}

// Revisi 1: Blaster Summary Update
function updateAllocBlasterSummary(fromCustomInput = false) {
  const chks = document.querySelectorAll('input[name="alloc_blaster_chk"]:checked');
  const names = Array.from(chks).map(c => c.value);
  const customInput = document.getElementById('alloc_blaster_custom');
  const countEl = document.getElementById('display-blaster-alloc-count');

  if (!fromCustomInput && customInput) {
    if (names.length > 0) {
      customInput.value = `${names.length} (${names.join(', ')})`;
    } else {
      customInput.value = '';
    }
  }

  if (countEl) {
    countEl.innerText = `${names.length} Terpilih`;
  }
}

function handleAllocMmuRowToggle(unit) {
  const cleanId = unit.replace(/[^A-Z0-9]/gi, '');
  const chk = document.querySelector(`input[name="alloc_mmu_chk"][value="${unit}"]`);
  const row = document.getElementById(`row-alloc-mmu-${cleanId}`);
  const qtyInput = document.getElementById(`qty_alloc_${cleanId}`);
  const tonInput = document.getElementById(`ton_alloc_${cleanId}`);
  const cap = Number(chk ? chk.dataset.cap : getMmuCapacity(unit)) || 15;

  if (chk && row) {
    if (chk.checked) {
      row.className = "flex items-center justify-between p-2.5 rounded-xl border bg-amber-50/70 border-amber-300 shadow-2xs transition";
      let currentQty = parseFloat(qtyInput ? qtyInput.value : 0);
      if (isNaN(currentQty) || currentQty <= 0) {
        currentQty = 1;
        if (qtyInput) qtyInput.value = 1;
        if (tonInput) tonInput.value = cap.toFixed(2);
      }
    } else {
      row.className = "flex items-center justify-between p-2.5 rounded-xl border bg-slate-50 border-slate-200 transition";
    }
  }
  calculateAllocMmuSummary();
}

function handleAllocUnitChange(unit, cap) {
  const cleanId = unit.replace(/[^A-Z0-9]/gi, '');
  const qtyInput = document.getElementById(`qty_alloc_${cleanId}`);
  const tonInput = document.getElementById(`ton_alloc_${cleanId}`);
  const chk = document.querySelector(`input[name="alloc_mmu_chk"][value="${unit}"]`);
  const row = document.getElementById(`row-alloc-mmu-${cleanId}`);

  let qty = parseFloat(qtyInput ? qtyInput.value : 0);
  if (isNaN(qty) || qty < 0) qty = 0;

  // Revisi 3: Preservasi hingga 2 desimal
  const ton = Math.round(qty * cap * 100) / 100;
  if (tonInput && document.activeElement !== tonInput) {
    tonInput.value = ton > 0 ? (ton % 1 === 0 ? ton.toString() : ton.toFixed(2)) : '';
  }

  if (chk) {
    if (qty > 0 && !chk.checked) {
      chk.checked = true;
      if (row) row.className = "flex items-center justify-between p-2.5 rounded-xl border bg-amber-50/70 border-amber-300 shadow-2xs transition";
    } else if (qty === 0 && chk.checked) {
      chk.checked = false;
      if (row) row.className = "flex items-center justify-between p-2.5 rounded-xl border bg-slate-50 border-slate-200 transition";
    }
  }

  calculateAllocMmuSummary();
}

function handleAllocTonChange(unit, cap) {
  const cleanId = unit.replace(/[^A-Z0-9]/gi, '');
  const qtyInput = document.getElementById(`qty_alloc_${cleanId}`);
  const tonInput = document.getElementById(`ton_alloc_${cleanId}`);
  const chk = document.querySelector(`input[name="alloc_mmu_chk"][value="${unit}"]`);
  const row = document.getElementById(`row-alloc-mmu-${cleanId}`);

  let ton = parseFloat(tonInput ? tonInput.value : 0);
  if (isNaN(ton) || ton < 0) ton = 0;

  // Revisi 3: Mendukung 2 angka di belakang koma untuk unit dan tonase
  let qty = cap > 0 ? (ton / cap) : 0;
  qty = Math.round(qty * 100) / 100;

  if (qtyInput && document.activeElement !== qtyInput) {
    qtyInput.value = qty > 0 ? (qty % 1 === 0 ? qty.toString() : qty.toFixed(2)) : '';
  }

  if (chk) {
    if (ton > 0 && !chk.checked) {
      chk.checked = true;
      if (row) row.className = "flex items-center justify-between p-2.5 rounded-xl border bg-amber-50/70 border-amber-300 shadow-2xs transition";
    } else if (ton === 0 && chk.checked) {
      chk.checked = false;
      if (row) row.className = "flex items-center justify-between p-2.5 rounded-xl border bg-slate-50 border-slate-200 transition";
    }
  }

  calculateAllocMmuSummary();
}

function getTargetPlanDthVolume() {
  const el = document.getElementById('edit_volume_ton');
  if (el && el.value) {
    const v = parseFloat(el.value);
    if (!isNaN(v) && v > 0) return v;
  }
  if (currentEditingItem) {
    const v = parseFloat(currentEditingItem.volume_ton || currentEditingItem.volume);
    if (!isNaN(v) && v > 0) return v;
    const h = Number(currentEditingItem.jumlah_holes) || 0;
    const i = Number(currentEditingItem.isian_kg) || 0;
    if (h > 0 && i > 0) return (h * i) / 1000;
  }
  return 0;
}

function calculateAllocMmuSummary() {
  const chks = document.querySelectorAll('input[name="alloc_mmu_chk"]:checked');
  let totalUnits = 0;
  let totalDth = 0;
  const formattedParts = [];

  chks.forEach(c => {
    const unit = c.value;
    const cleanId = unit.replace(/[^A-Z0-9]/gi, '');
    const cap = Number(c.dataset.cap || getMmuCapacity(unit));
    const qtyInput = document.getElementById(`qty_alloc_${cleanId}`);
    const tonInput = document.getElementById(`ton_alloc_${cleanId}`);

    let qty = qtyInput ? parseFloat(qtyInput.value) : 1;
    if (isNaN(qty) || qty <= 0) qty = 1;

    // Revisi 3: 2 angka di belakang koma
    const rowDth = Math.round(qty * cap * 100) / 100;
    if (tonInput && (!tonInput.value || document.activeElement !== tonInput)) {
      tonInput.value = rowDth > 0 ? (rowDth % 1 === 0 ? rowDth.toString() : rowDth.toFixed(2)) : '';
    }

    totalUnits += qty;
    totalDth += rowDth;

    const displayQty = (qty % 1 === 0) ? qty : parseFloat(qty.toFixed(2));
    formattedParts.push(`${displayQty} ${unit}`);
  });

  const summaryStr = formattedParts.length > 0
    ? `${formattedParts.join(', ')} (${totalDth.toFixed(2)} Ton)`
    : '';

  const mmuInput = document.getElementById('edit_unit_mmu');
  const totalDisplay = document.getElementById('display-alloc-mmu-total');
  const targetVol = getTargetPlanDthVolume();
  const isSufficient = (targetVol <= 0) || (totalDth >= (targetVol - 0.01));

  if (mmuInput) {
    mmuInput.value = summaryStr;
    if (!summaryStr) {
      mmuInput.className = "w-full bg-slate-50 border border-amber-300 rounded-xl p-2.5 font-mono font-bold text-slate-800 text-xs";
    } else if (isSufficient) {
      mmuInput.className = "w-full bg-emerald-50 border-2 border-emerald-500 rounded-xl p-2.5 font-mono font-black text-emerald-800 text-xs shadow-2xs transition";
    } else {
      mmuInput.className = "w-full bg-red-50 border-2 border-red-500 rounded-xl p-2.5 font-mono font-black text-red-700 text-xs shadow-2xs transition";
    }
  }

  if (totalDisplay) {
    const unitStr = (totalUnits % 1 === 0) ? totalUnits : totalUnits.toFixed(2);
    totalDisplay.innerText = `${unitStr} Unit | ${totalDth.toFixed(2)} Ton`;
    if (summaryStr && !isSufficient && targetVol > 0) {
      totalDisplay.className = "text-xs font-black text-red-600 font-mono";
    } else {
      totalDisplay.className = "text-xs font-black text-emerald-700 font-mono";
    }
  }

  const badgeEl = document.getElementById('alloc-mmu-comparison-badge');
  if (badgeEl) {
    if (targetVol > 0) {
      const diff = totalDth - targetVol;
      const absDiff = Math.abs(diff).toFixed(2);
      if (diff >= -0.01) {
        badgeEl.innerHTML = `
          <div class="mt-2 p-2 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center justify-between text-xs font-bold text-emerald-900 shadow-2xs">
            <span class="flex items-center gap-1.5"><i class="ph-bold ph-check-circle text-emerald-600 text-sm"></i> Alokasi MMU Sesuai / Mencukupi: ${totalDth.toFixed(2)} Ton (Kebutuhan: ${targetVol.toFixed(2)} Ton)</span>
            <span class="font-mono text-[11px] bg-emerald-100 px-2 py-0.5 rounded text-emerald-800 font-black">+${absDiff} T</span>
          </div>
        `;
      } else {
        badgeEl.innerHTML = `
          <div class="mt-2 p-2 bg-red-50 border border-red-300 rounded-xl flex items-center justify-between text-xs font-bold text-red-900 shadow-2xs">
            <span class="flex items-center gap-1.5"><i class="ph-bold ph-warning-circle text-red-600 text-sm"></i> Alokasi MMU Belum Cukup: ${totalDth.toFixed(2)} Ton (Kurang ${absDiff} Ton dari Kebutuhan: ${targetVol.toFixed(2)} Ton)</span>
            <span class="font-mono text-[11px] bg-red-100 px-2 py-0.5 rounded text-red-800 font-black">-${absDiff} T</span>
          </div>
        `;
      }
    } else {
      badgeEl.innerHTML = '';
    }
  }
}

function updateAllocBoxSummary(fromCustomInput = false) {
  const chks = document.querySelectorAll('input[name="alloc_box_chk"]:checked');
  const boxes = Array.from(chks).map(c => c.value);
  const customInput = document.getElementById('edit_unit_box');
  const countEl = document.getElementById('display-box-alloc-count');

  if (!fromCustomInput && customInput) {
    if (boxes.length > 0) {
      customInput.value = `${boxes.length} (${boxes.join(', ')})`;
    } else {
      customInput.value = '';
    }
  }

  if (countEl) {
    countEl.innerText = `${boxes.length} Box`;
  }
}

function closeEditModal() {
  const modal = document.getElementById('modal-edit-plan');
  if (modal) {
    modal.classList.remove('flex');
    modal.classList.add('hidden');
  }
  currentEditingItem = null;
}

async function handleEditPlanSubmit(event) {
  event.preventDefault();

  const uuid = document.getElementById('edit_uuid').value;
  const role = currentUser.role.toUpperCase();
  const userCompany = currentUser.company.toUpperCase();

  const updateData = { uuid: uuid };
  const grab = (id) => document.getElementById(id) ? document.getElementById(id).value : undefined;

  // 1. Kontraktor & Owner Fields
  if (isUserOwner() || isUserKontraktor()) {
    const h = Number(grab('edit_jumlah_holes')) || 0;
    const i = Number(grab('edit_isian_kg')) || 0;

    if (grab('edit_kontraktor')) {
      updateData.kontraktor = grab('edit_kontraktor');
    }
    updateData.lokasi = grab('edit_lokasi');
    updateData.prioritas = grab('edit_prioritas');
    updateData['today/sleep'] = grab('edit_today_sleep');
    updateData.today_sleep = grab('edit_today_sleep');
    updateData.inisiasi = grab('edit_inisiasi');
    updateData.jam_masuk = grab('edit_jam_masuk');
    updateData.remark = grab('edit_remark');
    updateData.pengawas_kontraktor = grab('edit_pengawas_kontraktor');
    updateData.jumlah_holes = h;
    updateData.isian_kg = i;

    // Revisi 4: Ambil manual Volume (Ton DTH) yang diinput sendiri oleh user
    updateData.volume_ton = parseFloat(grab('edit_volume_ton')) || 0;

    updateData.akses = grab('edit_akses');
    updateData.desa = grab('edit_desa');
    updateData.matrix = grab('edit_matrix');
    updateData.geometri = grab('edit_geometri');

    // Pertahankan / sinkronkan boundary spasial
    updateData.geometry = item.geometry || '';
    if (typeof findBoundaryByName === 'function') {
      const bound = findBoundaryByName(updateData.lokasi);
      if (bound) {
        updateData.geometry = bound.wkt;
        updateData.latitude = bound.centroid.lat;
        updateData.longitude = bound.centroid.lng;
      }
    }

    if (grab('edit_need_mmu') !== undefined) {
      const editNeedMmuVal = grab('edit_need_mmu').trim();
      updateData.unit_mmu = editNeedMmuVal;
      updateData.need_mmu = editNeedMmuVal;
      updateData.dth_supplier = calculateMmuTotalDth(editNeedMmuVal);
    }

    if (grab('edit_latitude') !== undefined) updateData.latitude = grab('edit_latitude');
    if (grab('edit_longitude') !== undefined) updateData.longitude = grab('edit_longitude');
  }

  // 2. Supplier Fields
  if (isUserOwner() || isUserSupplier()) {
    let supComp = isUserSupplier() ? cleanCompanyName(userCompany) : grab('edit_supplier_select');
    if (supComp) {
      updateData.supplier = supComp;
    }

    const spvVal = grab('alloc_spv_custom') || grab('edit_pengawas_supplier');
    if (spvVal !== undefined) {
      updateData.pengawas_supplier = spvVal;
      updateData.pengawas_sup = spvVal;
    }

    // Revisi 1: Blaster disimpan sebagai nama teks
    const blasterVal = grab('alloc_blaster_custom') || grab('edit_jumlah_blaster');
    if (blasterVal !== undefined) {
      updateData.jumlah_blaster = blasterVal;
      updateData.blaster = blasterVal;
    }

    const mmuVal = grab('edit_unit_mmu');
    if (mmuVal !== undefined) {
      updateData.unit_mmu = mmuVal;
    }

    const boxVal = grab('edit_unit_box');
    if (boxVal !== undefined) {
      updateData.unit_box = boxVal;
    }
  }

  const pinOk = await requestSecurityPin('menyimpan perubahan alokasi plan blasting');
  if (!pinOk) return;

  const btn = document.getElementById('btn-save-edit-plan');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="ph-bold ph-spinner animate-spin"></i> Menyimpan...`;
  }
  showGlobalLoading();

  try {
    const res = await apiCall('savePlan', {
      data: updateData,
      role: isUserOwner() ? 'ADMIN' : currentUser.role,
      company: currentUser ? currentUser.company : ''
    });

    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="ph-bold ph-check"></i> Simpan Perubahan`;
    }

    if (res && res.success) {
      Swal.fire({
        icon: 'success',
        title: 'Berhasil Diperbarui!',
        text: res.message || 'Data plan peledakan berhasil diperbarui.',
        timer: 1500,
        showConfirmButton: false
      });
      closeEditModal();
      refreshData(false);
    } else {
      Swal.fire({ icon: 'error', title: 'Gagal Menyimpan', text: (res && res.message) || 'Gagal menyimpan perubahan plan peledakan' });
    }
  } catch (err) {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="ph-bold ph-check"></i> Simpan Perubahan`;
    }
    Swal.fire({ icon: 'error', title: 'Gagal Menyimpan', text: 'Terjadi kesalahan sistem saat memperbarui data.' });
  } finally {
    hideGlobalLoading();
  }
}

async function handleClearSupplierAllocation() {
  if (!currentEditingItem) return;

  const confirmRes = await Swal.fire({
    title: 'Lepaskan Slot Supplier?',
    html: `Apakah Anda yakin ingin mengosongkan alokasi supplier, unit MMU, dan manpower pada plan <b>${currentEditingItem.lokasi || ''}</b>?`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#dc2626',
    cancelButtonColor: '#64748b',
    confirmButtonText: '<i class="ph-bold ph-trash"></i> Ya, Lepaskan Slot',
    cancelButtonText: 'Batal'
  });

  if (!confirmRes.isConfirmed) return;

  const pinOk = await requestSecurityPin('melepaskan slot supplier');
  if (!pinOk) return;

  const updateData = {
    uuid: currentEditingItem.uuid || currentEditingItem.id,
    supplier: '',
    pengawas_supplier: '',
    jumlah_blaster: '',
    blaster: '',
    unit_mmu: '',
    unit_box: ''
  };

  showGlobalLoading();
  try {
    const res = await apiCall('savePlan', {
      data: updateData,
      role: isUserOwner() ? 'ADMIN' : currentUser.role,
      company: currentUser ? currentUser.company : ''
    });

    if (res && res.success) {
      currentEditingItem.supplier = '';
      currentEditingItem.pengawas_supplier = '';
      currentEditingItem.jumlah_blaster = '';
      currentEditingItem.blaster = '';
      currentEditingItem.unit_mmu = '';
      currentEditingItem.unit_box = '';

      const foundInRaw = rawGlobalPlanData.find(x => String(x.uuid || x.id) === String(currentEditingItem.uuid || currentEditingItem.id));
      if (foundInRaw) {
        foundInRaw.supplier = '';
        foundInRaw.pengawas_supplier = '';
        foundInRaw.jumlah_blaster = '';
        foundInRaw.blaster = '';
        foundInRaw.unit_mmu = '';
        foundInRaw.unit_box = '';
      }

      Swal.fire({
        icon: 'success',
        title: 'Slot Berhasil Dikosongkan',
        text: 'Slot alokasi supplier telah dikosongkan dan siap dipilih kembali.',
        timer: 1500,
        showConfirmButton: false
      });

      closeEditModal();
      refreshData(false);
    } else {
      Swal.fire({ icon: 'error', title: 'Gagal', text: (res && res.message) || 'Gagal melepaskan slot supplier.' });
    }
  } catch (err) {
    console.error('handleClearSupplierClaim error:', err);
    Swal.fire({ icon: 'error', title: 'Gagal', text: 'Terjadi kesalahan saat melepaskan slot supplier.' });
  } finally {
    hideGlobalLoading();
  }
}


// ==================== MODAL EDIT KESIAPAN SUPPLIER ====================

let editSupSelectedMmus = [];

function openEditSupplierModal(uuid) {
  const item = globalSupplierData.find(x => String(x.uuid || x.id).trim() === String(uuid).trim());
  if (!item) {
    Swal.fire({ icon: 'error', title: 'Data Tidak Ditemukan', text: 'ID Supplier Readiness tidak ditemukan' });
    return;
  }

  document.getElementById('edit_sup_uuid').value = item.uuid || item.id || '';
  document.getElementById('edit_sup_tanggal').value = normalizeDateToYYYYMMDD(item.tanggal);
  document.getElementById('edit_sup_supplier').value = item.supplier || 'DAHANA';

  const existingMmuStr = item.unit_mmu || '';
  const existingMmus = existingMmuStr.split(/[,;/]+/).map(x => x.trim()).filter(Boolean);
  editSupSelectedMmus = existingMmus.map(code => ({
    code: code,
    cap: getMmuCapacity(code)
  }));

  renderModalEditMmuChips();

  document.getElementById('edit_sup_unit_box').value = item.unit_box || '';
  document.getElementById('edit_sup_hebs').value = item.hebs || '';
  document.getElementById('edit_sup_estar').value = item.estar || '';
  document.getElementById('edit_sup_axiss').value = item.axiss || '';
  document.getElementById('edit_sup_nonel').value = item.nonel || '';
  document.getElementById('edit_sup_nama_spv').value = item.nama_spv || '';
  document.getElementById('edit_sup_nama_blaster').value = item.nama_blaster || '';
  document.getElementById('edit_sup_note').value = item.note || '';

  initModalEditSupManpowerRoster(item.supplier || 'DAHANA', item.nama_spv || '', item.nama_blaster || '');
  calcEditSupManpower();

  const modal = document.getElementById('modal-edit-supplier');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
}

function closeEditSupplierModal() {
  const modal = document.getElementById('modal-edit-supplier');
  if (modal) {
    modal.classList.remove('flex');
    modal.classList.add('hidden');
  }
}

function renderModalEditMmuChips() {
  const supEl = document.getElementById('edit_sup_supplier');
  const sup = supEl ? supEl.value : 'DAHANA';
  initModalEditSupManpowerRoster(sup, document.getElementById('edit_sup_nama_spv').value, document.getElementById('edit_sup_nama_blaster').value);
  const container = document.getElementById('edit-sup-mmu-chips');
  if (!container) return;
  const presets = SUPPLIER_MMU_PRESETS[sup] || SUPPLIER_MMU_PRESETS['DAHANA'];

  const fieldHebs = document.getElementById('edit-field-sup-hebs');
  const fieldEstar = document.getElementById('edit-field-sup-estar');
  const fieldAxiss = document.getElementById('edit-field-sup-axiss');

  if (sup === 'MNK-KMB') {
    if (fieldHebs) fieldHebs.classList.add('hidden');
    if (fieldEstar) fieldEstar.classList.add('hidden');
    if (fieldAxiss) fieldAxiss.classList.remove('hidden');
  } else {
    if (fieldHebs) fieldHebs.classList.remove('hidden');
    if (fieldEstar) fieldEstar.classList.remove('hidden');
    if (fieldAxiss) fieldAxiss.classList.add('hidden');
  }

  let html = `
    <div class="w-full space-y-2.5">
      <div>
        <span class="block text-[10.5px] uppercase font-bold text-slate-500 mb-1">Unit Utama:</span>
        <div class="flex flex-wrap gap-2">
  `;

  presets.forEach(p => {
    const isSelected = editSupSelectedMmus.some(c => c.code.toUpperCase() === p.code.toUpperCase());
    html += `
      <button type="button" onclick="toggleModalEditMmuChip('${p.code}', ${p.cap})" id="modal-chip-${p.code.replace(/[^a-zA-Z0-9]/g, '-')}" class="px-2.5 py-1 rounded-lg text-xs font-mono font-bold border transition ${isSelected ? 'bg-amber-600 text-white border-amber-600 shadow-sm font-extrabold' : 'bg-white text-slate-700 border-slate-300 hover:border-amber-500'} shadow-2xs">
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
    const isSelected = editSupSelectedMmus.some(c => c.code.toUpperCase() === reloadCode.toUpperCase());
    html += `
      <button type="button" onclick="toggleModalEditMmuChip('${reloadCode}', ${p.cap})" id="modal-chip-${reloadCode.replace(/[^a-zA-Z0-9]/g, '-')}" class="px-2.5 py-1 rounded-lg text-xs font-mono font-bold border transition ${isSelected ? 'bg-amber-600 text-white border-amber-600 shadow-sm font-extrabold flex items-center gap-1' : 'bg-amber-50/70 text-amber-900 border-amber-300 hover:border-amber-600 flex items-center gap-1'} shadow-2xs">
        <i class="ph-bold ph-arrow-counter-clockwise text-[10px] ${isSelected ? 'text-white' : 'text-amber-600'}"></i>
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
  updateModalEditMmuDisplay();
}

function toggleModalEditMmuChip(code, cap) {
  const idx = editSupSelectedMmus.findIndex(c => c.code.toUpperCase() === code.toUpperCase());
  if (idx > -1) {
    editSupSelectedMmus.splice(idx, 1);
  } else {
    editSupSelectedMmus.push({ code, cap });
  }

  const btnId = `modal-chip-${code.replace(/[^a-zA-Z0-9]/g, '-')}`;
  const btn = document.getElementById(btnId);
  if (btn) {
    const isReload = code.toLowerCase().includes('reload');
    if (editSupSelectedMmus.some(c => c.code.toUpperCase() === code.toUpperCase())) {
      btn.className = "px-2.5 py-1 rounded-lg text-xs font-mono font-extrabold border transition bg-amber-600 text-white border-amber-600 shadow-sm flex items-center gap-1";
    } else {
      btn.className = isReload
        ? "px-2.5 py-1 rounded-lg text-xs font-mono font-bold border transition bg-amber-50/70 text-amber-900 border-amber-300 hover:border-amber-600 flex items-center gap-1 shadow-2xs"
        : "px-2.5 py-1 rounded-lg text-xs font-mono font-bold border transition bg-white text-slate-700 border-slate-300 hover:border-amber-500 shadow-2xs";
    }
  }

  updateModalEditMmuDisplay();
}

function updateModalEditMmuDisplay() {
  const codes = editSupSelectedMmus.map(c => c.code).join(', ');
  const totalCap = editSupSelectedMmus.reduce((sum, c) => sum + c.cap, 0);

  const listEl = document.getElementById('edit_sup_mmu_list');
  if (listEl) listEl.value = codes;
  const unitEl = document.getElementById('edit_sup_display_unit_count');
  if (unitEl) unitEl.innerText = `${editSupSelectedMmus.length} Unit`;
  const dthEl = document.getElementById('edit_sup_display_dth_calculated');
  if (dthEl) dthEl.innerText = `${totalCap.toFixed(2)} Ton`;
  const dthHidden = document.getElementById('edit_sup_dth_ready');
  if (dthHidden) dthHidden.value = totalCap;
}

function calcEditSupManpower() {
  const spvInput = document.getElementById('edit_sup_nama_spv').value.trim();
  const blasterInput = document.getElementById('edit_sup_nama_blaster').value.trim();

  const spvCount = spvInput ? spvInput.split(/[,;/]+/).filter(x => x.trim() !== '').length : 0;
  const blasterCount = blasterInput ? blasterInput.split(/[,;/]+/).filter(x => x.trim() !== '').length : 0;

  document.getElementById('edit_sup_supervisor').value = spvCount;
  document.getElementById('edit_sup_blaster').value = blasterCount;
}

function initModalEditSupManpowerRoster(supKey, existingSpvStr = '', existingBlasterStr = '') {
  const normKey = (supKey.toUpperCase().includes('MNK') || supKey.toUpperCase().includes('KMB')) ? 'MNK-KMB' : 'DAHANA';
  const roster = SUPPLIER_PERSONNEL_ROSTER[normKey] || SUPPLIER_PERSONNEL_ROSTER['DAHANA'];

  modalEditSupAttendance.pengawas.clear();
  modalEditSupAttendance.blaster.clear();

  const spvNames = existingSpvStr ? existingSpvStr.split(/[,;/]+/).map(s => s.trim().toLowerCase()).filter(Boolean) : [];
  roster.pengawas.forEach(name => {
    if (spvNames.some(p => p === name.toLowerCase() || name.toLowerCase().includes(p) || p.includes(name.toLowerCase()))) {
      modalEditSupAttendance.pengawas.add(name);
    }
  });

  const blsNames = existingBlasterStr ? existingBlasterStr.split(/[,;/]+/).map(s => s.trim().toLowerCase()).filter(Boolean) : [];
  roster.blaster.forEach(name => {
    if (blsNames.some(p => p === name.toLowerCase() || name.toLowerCase().includes(p) || p.includes(name.toLowerCase()))) {
      modalEditSupAttendance.blaster.add(name);
    }
  });

  renderModalEditSupManpowerUI(normKey);
}

function renderModalEditSupManpowerUI(supKey) {
  const normKey = (supKey.toUpperCase().includes('MNK') || supKey.toUpperCase().includes('KMB')) ? 'MNK-KMB' : 'DAHANA';
  const roster = SUPPLIER_PERSONNEL_ROSTER[normKey] || SUPPLIER_PERSONNEL_ROSTER['DAHANA'];

  const spvContainer = document.getElementById('modal-edit-sup-pengawas-list');
  const blsContainer = document.getElementById('modal-edit-sup-blaster-list');

  if (spvContainer) {
    let html = '';
    roster.pengawas.forEach((name, idx) => {
      const isHadir = modalEditSupAttendance.pengawas.has(name);
      html += `
        <div class="px-2.5 py-1.5 flex items-center justify-between text-xs hover:bg-slate-50">
          <span class="font-bold text-slate-800 text-[11px]">${idx + 1}. ${name}</span>
          <div class="inline-flex rounded p-0.5 bg-slate-100">
            <button type="button" onclick="setModalEditPersonStatus('pengawas', '${name.replace(/'/g, "\\'")}', true)" class="${isHadir ? 'bg-emerald-600 text-white font-bold' : 'text-slate-600 font-medium'} px-2 py-0.5 rounded text-[10px]">Hadir</button>
            <button type="button" onclick="setModalEditPersonStatus('pengawas', '${name.replace(/'/g, "\\'")}', false)" class="${!isHadir ? 'bg-rose-100 text-rose-800 font-bold' : 'text-slate-400 font-medium'} px-2 py-0.5 rounded text-[10px]">Tidak</button>
          </div>
        </div>
      `;
    });
    spvContainer.innerHTML = html;
  }

  if (blsContainer) {
    let html = '';
    roster.blaster.forEach((name, idx) => {
      const isHadir = modalEditSupAttendance.blaster.has(name);
      html += `
        <div class="px-2.5 py-1.5 flex items-center justify-between text-xs hover:bg-slate-50">
          <span class="font-bold text-slate-800 text-[11px]">${idx + 1}. ${name}</span>
          <div class="inline-flex rounded p-0.5 bg-slate-100">
            <button type="button" onclick="setModalEditPersonStatus('blaster', '${name.replace(/'/g, "\\'")}', true)" class="${isHadir ? 'bg-emerald-600 text-white font-bold' : 'text-slate-600 font-medium'} px-2 py-0.5 rounded text-[10px]">Hadir</button>
            <button type="button" onclick="setModalEditPersonStatus('blaster', '${name.replace(/'/g, "\\'")}', false)" class="${!isHadir ? 'bg-rose-100 text-rose-800 font-bold' : 'text-slate-400 font-medium'} px-2 py-0.5 rounded text-[10px]">Tidak</button>
          </div>
        </div>
      `;
    });
    blsContainer.innerHTML = html;
  }

  updateModalEditSupAttendanceFormValues();
}

function setModalEditPersonStatus(type, name, isHadir) {
  if (isHadir) {
    modalEditSupAttendance[type].add(name);
  } else {
    modalEditSupAttendance[type].delete(name);
  }
  const supEl = document.getElementById('edit_sup_supplier');
  const supKey = supEl ? supEl.value : 'DAHANA';
  renderModalEditSupManpowerUI(supKey);
}

function setAllModalEditSupplierManpower(status) {
  const supEl = document.getElementById('edit_sup_supplier');
  const supKey = (supEl ? supEl.value : 'DAHANA').toUpperCase();
  const normKey = (supKey.includes('MNK') || supKey.includes('KMB')) ? 'MNK-KMB' : 'DAHANA';
  const roster = SUPPLIER_PERSONNEL_ROSTER[normKey] || SUPPLIER_PERSONNEL_ROSTER['DAHANA'];

  if (status === 'HADIR') {
    roster.pengawas.forEach(n => modalEditSupAttendance.pengawas.add(n));
    roster.blaster.forEach(n => modalEditSupAttendance.blaster.add(n));
  } else {
    modalEditSupAttendance.pengawas.clear();
    modalEditSupAttendance.blaster.clear();
  }
  renderModalEditSupManpowerUI(normKey);
}

function updateModalEditSupAttendanceFormValues() {
  const spvList = Array.from(modalEditSupAttendance.pengawas);
  const blsList = Array.from(modalEditSupAttendance.blaster);

  const dispSpv = document.getElementById('edit-display-pengawas-hadir-count');
  if (dispSpv) dispSpv.innerText = `${spvList.length} Orang`;
  const inputSpv = document.getElementById('edit_sup_nama_spv');
  if (inputSpv && spvList.length > 0) inputSpv.value = spvList.join(', ');
  const hiddenSpvCount = document.getElementById('edit_sup_supervisor');
  if (hiddenSpvCount) hiddenSpvCount.value = spvList.length;

  const dispBls = document.getElementById('edit-display-blaster-hadir-count');
  if (dispBls) dispBls.innerText = `${blsList.length} Orang`;
  const inputBls = document.getElementById('edit_sup_nama_blaster');
  if (inputBls && blsList.length > 0) inputBls.value = blsList.join(', ');
  const hiddenBlsCount = document.getElementById('edit_sup_blaster');
  if (hiddenBlsCount) hiddenBlsCount.value = blsList.length;
}

async function handleModalEditSupplierSubmit(event) {
  event.preventDefault();

  const uuid = document.getElementById('edit_sup_uuid').value;
  const supName = document.getElementById('edit_sup_supplier').value;

  const readinessData = {
    uuid: uuid,
    tanggal: document.getElementById('edit_sup_tanggal').value,
    supplier: supName,
    unit_mmu: document.getElementById('edit_sup_mmu_list').value,
    dth_ready: Number(document.getElementById('edit_sup_dth_ready').value) || 0,
    unit_box: document.getElementById('edit_sup_unit_box').value,
    hebs: document.getElementById('edit_sup_hebs').value,
    estar: document.getElementById('edit_sup_estar').value,
    axiss: document.getElementById('edit_sup_axiss').value,
    nonel: document.getElementById('edit_sup_nonel').value,
    nama_spv: document.getElementById('edit_sup_nama_spv').value,
    supervisor: Number(document.getElementById('edit_sup_supervisor').value) || 0,
    nama_blaster: document.getElementById('edit_sup_nama_blaster').value,
    blaster: Number(document.getElementById('edit_sup_blaster').value) || 0,
    note: document.getElementById('edit_sup_note') ? document.getElementById('edit_sup_note').value.trim() : ''
  };

  const pinOk = await requestSecurityPin('menyimpan perubahan kesiapan operasional supplier');
  if (!pinOk) return;

  const btn = document.getElementById('btn-save-edit-supplier');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="ph-bold ph-spinner animate-spin"></i> Menyimpan...`;
  }

  const res = await apiCall('saveKesiapan', {
    data: readinessData,
    role: isUserOwner() ? 'ADMIN' : currentUser.role,
    company: supName
  });

  if (btn) {
    btn.disabled = false;
    btn.innerHTML = `<i class="ph-bold ph-check"></i> Simpan Perubahan Kesiapan`;
  }

  if (res && res.success) {
    Swal.fire({
      icon: 'success',
      title: 'Kesiapan Diperbarui!',
      text: res.message || 'Data kesiapan operasional supplier berhasil disimpan.',
      timer: 1500,
      showConfirmButton: false
    });
    closeEditSupplierModal();
    refreshData(false);
  } else {
    Swal.fire({ icon: 'error', title: 'Gagal Menyimpan', text: (res && res.message) || 'Gagal memperbarui kesiapan supplier' });
  }
}

async function handleClearSupplierClaim() {
  const uuid = document.getElementById('edit_uuid')?.value;
  if (!uuid) return;
  const item = globalPlanData.find(x => String(x.uuid || x.id).trim() === String(uuid).trim());
  if (!item) return;

  const result = await Swal.fire({
    title: 'Lepas Slot Supplier?',
    text: `Apakah Anda yakin ingin mengosongkan alokasi supplier pada plan #${uuid}?`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d97706',
    cancelButtonColor: '#64748b',
    confirmButtonText: 'Ya, Lepaskan',
    cancelButtonText: 'Batal'
  });

  if (!result.isConfirmed) return;

  const pinOk = await requestSecurityPin('melepaskan slot supplier');
  if (!pinOk) return;

  showGlobalLoading();
  try {
    const updatePayload = {
      uuid: uuid,
      supplier: '',
      pengawas_supplier: '',
      blaster: '',
      jumlah_blaster: '',
      unit_mmu: '',
      unit_box: '',
      need_mmu: ''
    };

    const res = await apiCall('savePlan', {
      data: updatePayload,
      role: isUserOwner() ? 'ADMIN' : (currentUser?.role || 'KONTRAKTOR'),
      company: currentUser?.company || 'OWNER'
    });

    if (res && res.success) {
      Swal.fire({
        icon: 'success',
        title: 'Slot Supplier Dilepas',
        text: 'Alokasi supplier pada plan ini telah dikosongkan.',
        timer: 1500,
        showConfirmButton: false
      });
      closeEditModal();
      refreshData(false);
    } else {
      Swal.fire({ icon: 'error', title: 'Gagal', text: (res && res.message) || 'Gagal melepaskan slot supplier' });
    }
  } catch (err) {
    console.error('handleClearSupplierClaim error:', err);
    Swal.fire({ icon: 'error', title: 'Gagal', text: 'Terjadi kesalahan saat melepaskan slot supplier.' });
  } finally {
    hideGlobalLoading();
  }
}

window.handleClearSupplierClaim = handleClearSupplierClaim;


