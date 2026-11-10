/**
 * INTEGRATED BLASTING PLAN & DASHBOARD PLATFORM
 * Module: DASHBOARD & EXECUTIVE SUMMARY
 * Menangani render 4 kartu ringkasan eksekutif (SIS, BUMA, DAHANA, MNK-KMB), filter tanggal, dan resize split tabel.
 */

function initTableSplitResizer() {
  const resizer = document.getElementById('drag-resizer-tables');
  const container = document.getElementById('dashboard-tables-container');
  const cardSupplier = document.getElementById('card-table-supplier');
  const cardPlan = document.getElementById('card-table-plan');

  if (!resizer || !container || !cardSupplier || !cardPlan) return;

  const DEFAULT_SUPPLIER_HEIGHT = 180;
  const MIN_SUPPLIER_HEIGHT = 50;
  const MIN_PLAN_HEIGHT = 110;

  try {
    const savedHeight = localStorage.getItem('blasting_supplier_table_height');
    if (savedHeight) {
      const parsed = parseFloat(savedHeight);
      if (!isNaN(parsed) && parsed >= MIN_SUPPLIER_HEIGHT) {
        cardSupplier.style.height = `${parsed}px`;
      }
    }
  } catch (e) { }

  let isDragging = false;
  let startY = 0;
  let startSupplierHeight = 0;

  function onPointerDown(e) {
    isDragging = true;
    startY = (e.touches && e.touches.length > 0) ? e.touches[0].clientY : e.clientY;
    startSupplierHeight = cardSupplier.getBoundingClientRect().height;

    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';

    window.addEventListener('mousemove', onPointerMove, { passive: false });
    window.addEventListener('mouseup', onPointerUp);
    window.addEventListener('touchmove', onPointerMove, { passive: false });
    window.addEventListener('touchend', onPointerUp);
    window.addEventListener('touchcancel', onPointerUp);
  }

  function onPointerMove(e) {
    if (!isDragging) return;
    if (e.cancelable) e.preventDefault();

    const currentY = (e.touches && e.touches.length > 0) ? e.touches[0].clientY : e.clientY;
    const deltaY = currentY - startY;

    const containerHeight = container.clientHeight;
    const resizerHeight = resizer.offsetHeight || 12;
    const availableHeight = containerHeight - resizerHeight;

    let newSupplierHeight = startSupplierHeight - deltaY;

    const maxSupplierHeight = Math.max(MIN_SUPPLIER_HEIGHT, availableHeight - MIN_PLAN_HEIGHT);
    newSupplierHeight = Math.max(MIN_SUPPLIER_HEIGHT, Math.min(maxSupplierHeight, newSupplierHeight));

    cardSupplier.style.height = `${newSupplierHeight}px`;
  }

  function onPointerUp() {
    if (!isDragging) return;
    isDragging = false;

    document.body.style.cursor = '';
    document.body.style.userSelect = '';

    window.removeEventListener('mousemove', onPointerMove);
    window.removeEventListener('mouseup', onPointerUp);
    window.removeEventListener('touchmove', onPointerMove);
    window.removeEventListener('touchend', onPointerUp);
    window.removeEventListener('touchcancel', onPointerUp);

    try {
      const finalHeight = parseFloat(cardSupplier.style.height);
      if (!isNaN(finalHeight)) {
        localStorage.setItem('blasting_supplier_table_height', finalHeight);
      }
    } catch (e) { }
  }

  resizer.addEventListener('mousedown', onPointerDown);
  resizer.addEventListener('touchstart', onPointerDown, { passive: true });

  resizer.addEventListener('dblclick', () => {
    cardSupplier.style.height = `${DEFAULT_SUPPLIER_HEIGHT}px`;
    try {
      localStorage.removeItem('blasting_supplier_table_height');
    } catch (e) { }
  });

  window.addEventListener('resize', () => {
    if (container.clientHeight > 0 && cardSupplier.style.height) {
      const currentH = parseFloat(cardSupplier.style.height);
      const availableHeight = container.clientHeight - (resizer.offsetHeight || 12);
      const maxSupplierHeight = Math.max(MIN_SUPPLIER_HEIGHT, availableHeight - MIN_PLAN_HEIGHT);
      if (currentH > maxSupplierHeight) {
        cardSupplier.style.height = `${maxSupplierHeight}px`;
      }
    }
  });
}

function toggleDashboardTables() {
  isDashboardTablesVisible = !isDashboardTablesVisible;
  applyDashboardTableVisibility();
}

function applyDashboardTableVisibility() {
  const tablesContainer = document.getElementById('dashboard-tables-container');
  const summaryContainer = document.getElementById('dashboard-summary-container');
  const btnLabel = document.getElementById('label-toggle-tables');
  const btnIcon = document.getElementById('icon-toggle-tables');
  const btn = document.getElementById('btn-toggle-dashboard-tables');

  if (!tablesContainer || !summaryContainer) return;

  if (isDashboardTablesVisible) {
    tablesContainer.classList.remove('hidden');
    summaryContainer.className = "w-full lg:w-72 xl:w-80 flex flex-col gap-2 flex-shrink-0 h-full overflow-y-auto custom-scrollbar pr-0.5 py-0.5 transition-all";
    if (btnLabel) btnLabel.innerText = "Sembunyikan Tabel";
    if (btnIcon) btnIcon.className = "ph-bold ph-eye-slash text-sm";
    if (btn) btn.className = "px-2.5 sm:px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer";
  } else {
    tablesContainer.classList.add('hidden');
    summaryContainer.className = "flex-1 w-full h-full overflow-y-auto custom-scrollbar p-1.5 sm:p-2.5 grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-2.5 content-start transition-all";
    if (btnLabel) btnLabel.innerText = "Tampilkan Tabel Data";
    if (btnIcon) btnIcon.className = "ph-bold ph-table text-sm";
    if (btn) btn.className = "px-2.5 sm:px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer";
  }
}

function handleGlobalDateChange() {
  const filterDate = document.getElementById('global-date-filter').value || getWitaDateString();
  filterAndRenderDashboard(filterDate);
}

function filterAndRenderDashboard(filterDate) {
  globalPlanData = rawGlobalPlanData.filter(item => {
    if (!filterDate) return true;
    const rawDate = getValFlexible(item, 'tanggal', 'date', 'tgl') || item.tanggal;
    const itemDate = normalizeDateToYYYYMMDD(rawDate);
    return itemDate === filterDate;
  });

  // Urutkan berdasarkan kontraktor: SIS dulu, baru BUMA, lalu lainnya
  globalPlanData.sort((a, b) => {
    const getRank = (item) => {
      const rawK = getValFlexible(item, 'kontraktor', 'mitra', 'company', 'perusahaan') || item.kontraktor || '';
      const k = String(rawK).toUpperCase();
      if (k.includes('SIS')) return 1;
      if (k.includes('BUMA')) return 2;
      return 99;
    };
    const rankA = getRank(a);
    const rankB = getRank(b);
    if (rankA !== rankB) return rankA - rankB;
    return String(a.kontraktor || '').localeCompare(String(b.kontraktor || ''));
  });

  globalSupplierData = rawGlobalSupplierData.filter(item => {
    if (!filterDate) return true;
    const rawDate = getValFlexible(item, 'tanggal', 'date', 'tgl') || item.tanggal;
    const itemDate = normalizeDateToYYYYMMDD(rawDate);
    return itemDate === filterDate;
  });

  renderDashboardUI(filterDate);

  if (typeof renderBlastingMapMarkers === 'function' && blastingMap) {
    renderBlastingMapMarkers();
  }
  if (typeof renderPlanNeedMmuChips === 'function') {
    renderPlanNeedMmuChips();
  }
}

function renderContractorSummaryCard(companyKey, config) {
  const plans = globalPlanData.filter(p => {
    const rawK = getValFlexible(p, 'kontraktor', 'mitra', 'company', 'perusahaan', 'kontraktor_nama') || p.kontraktor || '';
    const k = String(rawK).toUpperCase();
    if (companyKey === 'SIS') {
      return k.includes('SIS') || (!k.includes('BUMA'));
    } else if (companyKey === 'BUMA') {
      return k.includes('BUMA');
    }
    return k.includes(companyKey);
  });

  let blastTodayDth = 0;
  let blastTodayCount = 0;
  let blastSleepDth = 0;
  let blastSleepCount = 0;
  let totalAllocatedDth = 0;
  const allocatedUnitMap = new Map();

  plans.forEach(p => {
    let vol = parseNumeric(getValFlexible(p, 'volume_ton', 'volume', 'volumeton', 'vol') || p.volume_ton || p.volume || 0);
    if (vol === 0) {
      const holes = parseNumeric(getValFlexible(p, 'jumlah_holes', 'holes', 'jumlahholes') || p.jumlah_holes || 0);
      const isian = parseNumeric(getValFlexible(p, 'isian_kg', 'isian', 'isiankg') || p.isian_kg || 0);
      if (holes > 0 && isian > 0) {
        vol = (holes * isian) / 1000;
      }
    }

    const mode = getPlanTodaySleepStatus(p);
    if (mode === 'SLEEP' || mode === 'TODAY/SLEEP') {
      blastSleepDth += vol;
      blastSleepCount += 1;
    } else if (mode !== 'CANCEL/HOLD') {
      blastTodayDth += vol;
      blastTodayCount += 1;
    }

    const mmuRaw = getValFlexible(p, 'unit_mmu', 'need_mmu', 'mmu', 'unitmmu', 'needmmu') || p.unit_mmu || p.need_mmu || '';
    let planAllocatedDth = 0;

    if (mmuRaw && String(mmuRaw).trim() !== '' && String(mmuRaw).trim() !== '-') {
      const parsed = parseAllocatedMmuInfo(mmuRaw);
      planAllocatedDth = Number(parsed.totalDth || 0);

      if (parsed.items && parsed.items.length > 0) {
        parsed.items.forEach(it => {
          if (it.code && it.code !== '-') {
            const cleanCode = it.code.trim();
            const prev = allocatedUnitMap.get(cleanCode) || 0;
            allocatedUnitMap.set(cleanCode, prev + (Number(it.qty) || 1));
          }
        });
      } else {
        const rawParts = String(mmuRaw).replace(/\([^)]*Ton\)/gi, '').replace(/\([^)]*\)/g, '').split(/[,;/]+/).map(x => x.trim()).filter(Boolean);
        rawParts.forEach(u => {
          const cleanCode = u.replace(/^[\d.]+\s+/, '').trim();
          if (cleanCode && cleanCode !== '-') {
            const prev = allocatedUnitMap.get(cleanCode) || 0;
            allocatedUnitMap.set(cleanCode, prev + 1);
          }
        });
      }
    }

    if (planAllocatedDth === 0) {
      const dthRaw = parseNumeric(getValFlexible(p, 'dth_supplier', 'dth', 'dthsupplier') || p.dth_supplier || 0);
      if (dthRaw > 0) planAllocatedDth = dthRaw;
    }
    totalAllocatedDth += planAllocatedDth;
  });

  const unitBadges = [];
  let totalUnitCount = 0;

  allocatedUnitMap.forEach((qty, code) => {
    totalUnitCount += qty;
    const displayQty = parseFloat(qty.toFixed(2));
    unitBadges.push(`
      <span class="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-md font-mono text-[9px] font-bold ${config.unitBadge} shadow-2xs border transition hover:scale-105">
        <span class="px-1 py-0.2 rounded bg-black/5 font-extrabold text-[8px]">${displayQty}</span>
        <span class="truncate">${code}</span>
      </span>
    `);
  });

  const unitBadgesHtml = unitBadges.length > 0
    ? unitBadges.join('')
    : `<span class="text-[8.5px] text-slate-400 italic flex items-center gap-1"><i class="ph-bold ph-info text-[9px]"></i> Belum ada unit dialokasikan</span>`;

  const totalPlanDth = blastTodayDth + blastSleepDth;
  const totalLocations = plans.length;
  const ratioPercent = totalPlanDth > 0 ? Math.min(100, Math.round((totalAllocatedDth / totalPlanDth) * 100)) : 0;

  return `
    <div class="clean-card rounded-xl sm:rounded-2xl p-2.5 sm:p-3 flex flex-col justify-between border ${config.border} shadow-2xs hover:shadow-sm transition-all duration-200 relative overflow-hidden bg-gradient-to-b ${config.cardBg}">
      <div class="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${config.accentGradient}"></div>
      <div class="absolute -top-10 -right-10 w-24 h-24 rounded-full ${config.glowBg} blur-xl pointer-events-none opacity-25"></div>

      <div class="flex items-center justify-between pb-1 sm:pb-1.5 border-b border-slate-100/90 relative z-1">
        <div class="flex items-center gap-2 min-w-0">
          <div class="w-7 h-7 rounded-lg bg-gradient-to-br ${config.iconGradient} text-white flex items-center justify-center font-bold text-sm shadow-2xs ring-1 ring-black/5 flex-shrink-0">
            <i class="ph-bold ${config.icon}"></i>
          </div>
          <div class="min-w-0">
            <h3 class="text-xs sm:text-sm font-black text-slate-900 leading-tight tracking-tight truncate">${config.name}</h3>
            <span class="text-[8px] sm:text-[8.5px] font-bold text-slate-400 uppercase tracking-wider block">Plan Hari Ini</span>
          </div>
        </div>
        <span class="inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[8.5px] font-black uppercase tracking-wider ${config.badgeClass} flex-shrink-0 shadow-2xs">
          <span class="w-1.5 h-1.5 rounded-full ${config.dotColor} animate-pulse"></span> KONTRAKTOR
        </span>
      </div>

      <div class="my-1 sm:my-1.5 bg-gradient-to-br from-slate-50/95 via-white to-slate-50/85 p-1.5 sm:p-2 rounded-xl border border-slate-200/90 shadow-inner grid grid-cols-3 gap-1.5 items-center relative z-1">
        <div>
          <span class="text-[7.5px] sm:text-[8px] font-black uppercase tracking-wider text-slate-400 block truncate">Total Plan DTH</span>
          <div class="text-sm sm:text-base font-black ${config.textDth} font-mono tracking-tight leading-none mt-0.5 truncate">
            ${totalPlanDth.toFixed(2)} <span class="text-[8px] sm:text-[8.5px] font-bold text-slate-400 font-sans">Ton</span>
          </div>
        </div>
        <div class="border-x border-slate-200 px-1.5 text-center">
          <span class="text-[7.5px] sm:text-[8px] font-black uppercase tracking-wider ${config.allocLabelColor} flex items-center justify-center gap-0.5 truncate">
            <i class="ph-bold ph-check-circle text-[8.5px]"></i> Teralokasi
          </span>
          <div class="text-sm sm:text-base font-black ${config.allocValColor} font-mono tracking-tight leading-none mt-0.5 truncate">
            ${totalAllocatedDth.toFixed(2)} <span class="text-[8px] sm:text-[8.5px] font-bold opacity-75 font-sans">Ton</span>
          </div>
          <div class="w-full bg-slate-200/90 h-1 rounded-full mt-1 overflow-hidden flex" title="${ratioPercent}% teralokasi">
            <div class="h-full rounded-full ${config.allocBarGradient} transition-all duration-500" style="width: ${ratioPercent}%"></div>
          </div>
        </div>
        <div class="text-right flex flex-col items-end">
          <span class="text-[7.5px] sm:text-[8px] font-black text-slate-400 uppercase tracking-wider block">Total Lokasi</span>
          <div class="mt-0.5">
            <span class="inline-flex items-center gap-1 text-[10px] sm:text-[10.5px] font-black text-slate-800 font-mono bg-white px-1.5 py-0.2 rounded-md border border-slate-200 shadow-2xs">
              <i class="ph-bold ph-map-pin text-rose-500 text-[10px]"></i> ${totalLocations} <span class="text-[8px] font-bold text-slate-400 font-sans">Lok</span>
            </span>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-1.5 mb-1 sm:mb-1.5 relative z-1">
        <div class="bg-gradient-to-br from-emerald-500/10 via-emerald-50/50 to-teal-50/20 border border-emerald-300/70 rounded-lg sm:rounded-xl p-1 sm:p-1.5 flex items-center justify-between shadow-2xs">
          <div>
            <span class="text-[7.5px] sm:text-[8px] font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1">
              <i class="ph-bold ph-sun text-emerald-600 text-[10px]"></i> TODAY
            </span>
            <div class="text-xs font-black text-emerald-950 font-mono mt-0.5">
              ${blastTodayDth.toFixed(2)} <span class="text-[8px] font-bold text-emerald-700 font-sans">Ton</span>
            </div>
          </div>
          <span class="text-[8px] sm:text-[8.5px] font-black text-emerald-800 bg-white/90 px-1 py-0.2 rounded border border-emerald-200/80 font-mono shadow-2xs">${blastTodayCount} Lok</span>
        </div>

        <div class="bg-gradient-to-br from-blue-500/10 via-blue-50/50 to-indigo-50/20 border border-blue-300/70 rounded-lg sm:rounded-xl p-1 sm:p-1.5 flex items-center justify-between shadow-2xs">
          <div>
            <span class="text-[7.5px] sm:text-[8px] font-black uppercase tracking-wider text-blue-800 flex items-center gap-1">
              <i class="ph-bold ph-moon-stars text-blue-600 text-[10px]"></i> SLEEP
            </span>
            <div class="text-xs font-black text-blue-950 font-mono mt-0.5">
              ${blastSleepDth.toFixed(2)} <span class="text-[8px] font-bold text-blue-700 font-sans">Ton</span>
            </div>
          </div>
          <span class="text-[8px] sm:text-[8.5px] font-black text-blue-800 bg-white/90 px-1 py-0.2 rounded border border-blue-200/80 font-mono shadow-2xs">${blastSleepCount} Lok</span>
        </div>
      </div>

      <div class="bg-gradient-to-r from-slate-50/90 via-white to-slate-50/90 border border-slate-200/90 rounded-lg sm:rounded-xl p-1.5 space-y-1 shadow-2xs relative z-1">
        <div class="flex items-center justify-between">
          <span class="text-[8px] sm:text-[8.5px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1">
            <i class="ph-bold ph-truck ${config.iconText} text-[10px]"></i> MMU Teralokasi:
          </span>
          <span class="text-[9.5px] font-black font-mono text-slate-900 bg-white px-1.5 py-0.2 rounded border border-slate-200 shadow-2xs">
            ${parseFloat(totalUnitCount.toFixed(2))} Unit
          </span>
        </div>
        <div class="flex flex-wrap items-center gap-1">
          ${unitBadgesHtml}
        </div>
      </div>
    </div>
  `;
}

function renderSupplierSummaryCard(supKey, config) {
  const allMatchingSups = globalSupplierData.filter(s => {
    const name = cleanCompanyName(s.supplier).toUpperCase();
    return name.includes(supKey) || (supKey === 'MNK-KMB' && (name.includes('MNK') || name.includes('KMB')));
  });

  const latestMap = new Map();
  allMatchingSups.forEach(s => {
    const sName = cleanCompanyName(s.supplier).toUpperCase();
    latestMap.set(sName, s);
  });
  const sups = Array.from(latestMap.values());

  const totalCap = sups.reduce((sum, s) => sum + Number(s.dth_ready || 0), 0);

  let totalSupAllocatedDth = 0;
  globalPlanData.forEach(p => {
    const pSup = cleanCompanyName(p.supplier).toUpperCase();
    const isMatch = pSup.includes(supKey) || (supKey === 'MNK-KMB' && (pSup.includes('MNK') || pSup.includes('KMB')));
    if (isMatch && p.unit_mmu && String(p.unit_mmu).trim() !== '' && String(p.unit_mmu).trim() !== '-') {
      const parsed = parseAllocatedMmuInfo(p.unit_mmu);
      totalSupAllocatedDth += Number(parsed.totalDth || 0);
    }
  });

  const readyUnitsSet = new Set();
  let totalPengawas = 0;
  let pengawasNames = [];
  let totalBlaster = 0;
  let blasterNames = [];
  let notes = [];

  sups.forEach(s => {
    if (s.unit_mmu && String(s.unit_mmu).trim() !== '') {
      const parts = String(s.unit_mmu).split(/[,;/]+/).map(x => x.trim()).filter(Boolean);
      parts.forEach(u => readyUnitsSet.add(u));
    }

    let pCount = Number(s.supervisor || 0);
    if (s.nama_spv && String(s.nama_spv).trim() !== '' && String(s.nama_spv).trim() !== '-') {
      const pArr = String(s.nama_spv).split(/[,;/]+/).map(x => x.trim()).filter(Boolean);
      pCount = pArr.length;
      pengawasNames.push(...pArr);
    }
    totalPengawas += pCount;

    let bCount = Number(s.blaster || 0);
    if (s.nama_blaster && String(s.nama_blaster).trim() !== '' && String(s.nama_blaster).trim() !== '-') {
      const bArr = String(s.nama_blaster).split(/[,;/]+/).map(x => x.trim()).filter(Boolean);
      bCount = bArr.length;
      blasterNames.push(...bArr);
    }
    totalBlaster += bCount;

    if (s.note && String(s.note).trim() !== '') {
      notes.push(String(s.note).trim());
    }
  });

  pengawasNames = Array.from(new Set(pengawasNames));
  blasterNames = Array.from(new Set(blasterNames));
  if (totalPengawas === 0 && pengawasNames.length > 0) totalPengawas = pengawasNames.length;
  if (totalBlaster === 0 && blasterNames.length > 0) totalBlaster = blasterNames.length;

  const readyUnitsList = Array.from(readyUnitsSet);
  const readyUnitCount = readyUnitsList.length;

  const unitBadgesHtml = readyUnitsList.length > 0
    ? readyUnitsList.map(u => `
        <span class="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-md font-mono text-[9px] font-bold ${config.unitBadge} shadow-2xs border transition hover:scale-105">
          <i class="ph-bold ph-truck text-[9px]"></i>
          <span>${u}</span>
        </span>
      `).join('')
    : `<span class="text-[8.5px] text-slate-400 italic flex items-center gap-1"><i class="ph-bold ph-info text-[9px]"></i> Belum ada unit ready</span>`;

  const noteText = notes.length > 0 ? notes.join(' • ') : 'Tidak ada catatan kesiapan operasional';
  const supRatioPercent = totalCap > 0 ? Math.min(100, Math.round((totalSupAllocatedDth / totalCap) * 100)) : 0;

  return `
    <div class="clean-card rounded-xl sm:rounded-2xl p-2.5 sm:p-3 flex flex-col justify-between border ${config.border} shadow-2xs hover:shadow-sm transition-all duration-200 relative overflow-hidden bg-gradient-to-b ${config.cardBg}">
      <div class="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${config.accentGradient}"></div>
      <div class="absolute -top-10 -right-10 w-24 h-24 rounded-full ${config.glowBg} blur-xl pointer-events-none opacity-25"></div>

      <div class="flex items-center justify-between pb-1 sm:pb-1.5 border-b border-slate-100/90 relative z-1">
        <div class="flex items-center gap-2 min-w-0">
          <div class="w-7 h-7 rounded-lg bg-gradient-to-br ${config.iconGradient} text-white flex items-center justify-center font-bold text-sm shadow-2xs ring-1 ring-black/5 flex-shrink-0">
            <i class="ph-bold ${config.icon}"></i>
          </div>
          <div class="min-w-0">
            <h3 class="text-xs sm:text-sm font-black text-slate-900 leading-tight tracking-tight truncate">${config.name}</h3>
            <span class="text-[8px] sm:text-[8.5px] font-bold text-slate-400 uppercase tracking-wider block">Kesiapan MMU & Manpower</span>
          </div>
        </div>
        <span class="inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[8.5px] font-black uppercase tracking-wider ${config.badgeClass} flex-shrink-0 shadow-2xs">
          <span class="w-1.5 h-1.5 rounded-full ${config.dotColor} animate-pulse"></span> SUPPLIER
        </span>
      </div>

      <div class="my-1 sm:my-1.5 bg-gradient-to-br from-slate-50/95 via-white to-slate-50/85 p-1.5 sm:p-2 rounded-xl border border-slate-200/90 shadow-inner grid grid-cols-3 gap-1.5 items-center relative z-1">
        <div>
          <span class="text-[7.5px] sm:text-[8px] font-black uppercase tracking-wider text-slate-400 block truncate">Total Capacity</span>
          <div class="text-sm sm:text-base font-black ${config.textDth} font-mono tracking-tight leading-none mt-0.5 truncate">
            ${totalCap.toFixed(2)} <span class="text-[8px] sm:text-[8.5px] font-bold text-slate-400 font-sans">Ton</span>
          </div>
        </div>
        <div class="border-x border-slate-200 px-1.5 text-center">
          <span class="text-[7.5px] sm:text-[8px] font-black uppercase tracking-wider ${config.allocLabelColor} flex items-center justify-center gap-0.5 truncate">
            <i class="ph-bold ph-check-circle text-[8.5px]"></i> Teralokasi
          </span>
          <div class="text-sm sm:text-base font-black ${config.allocValColor} font-mono tracking-tight leading-none mt-0.5 truncate">
            ${totalSupAllocatedDth.toFixed(2)} <span class="text-[8px] sm:text-[8.5px] font-bold opacity-75 font-sans">Ton</span>
          </div>
          <div class="w-full bg-slate-200/90 h-1 rounded-full mt-1 overflow-hidden flex" title="${supRatioPercent}% teralokasi">
            <div class="h-full rounded-full ${config.allocBarGradient} transition-all duration-500" style="width: ${supRatioPercent}%"></div>
          </div>
        </div>
        <div class="text-right flex flex-col items-end">
          <span class="text-[7.5px] sm:text-[8px] font-black text-slate-400 uppercase tracking-wider block">Unit Ready</span>
          <div class="mt-0.5">
            <span class="inline-flex items-center gap-1 text-[10px] sm:text-[10.5px] font-black text-slate-800 font-mono bg-white px-1.5 py-0.2 rounded-md border border-slate-200 shadow-2xs">
              <i class="ph-bold ph-truck ${config.iconText} text-[10px]"></i> ${readyUnitCount} <span class="text-[8px] font-bold text-slate-400 font-sans">Unit</span>
            </span>
          </div>
        </div>
      </div>

      <div class="mb-1 sm:mb-1.5 bg-gradient-to-r from-slate-50/90 via-white to-slate-50/90 border border-slate-200/90 rounded-lg sm:rounded-xl p-1.5 space-y-1 shadow-2xs relative z-1">
        <div class="flex items-center justify-between">
          <span class="text-[8px] sm:text-[8.5px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1">
            <i class="ph-bold ph-truck ${config.iconText} text-[10px]"></i> Unit Ready:
          </span>
          <span class="text-[9.5px] font-black font-mono text-slate-900 bg-white px-1.5 py-0.2 rounded border border-slate-200 shadow-2xs">
            ${readyUnitsList.length} Unit
          </span>
        </div>
        <div class="flex flex-wrap items-center gap-1">
          ${unitBadgesHtml}
        </div>
      </div>

      <div class="grid grid-cols-2 gap-1.5 mb-1 sm:mb-1.5 relative z-1">
        <div class="bg-gradient-to-br from-blue-500/10 via-blue-50/50 to-cyan-50/20 border border-blue-300/70 rounded-lg sm:rounded-xl p-1 sm:p-1.5 shadow-2xs">
          <div class="flex items-center justify-between">
            <span class="text-[7.5px] sm:text-[8px] font-black uppercase text-blue-900 flex items-center gap-1">
              <i class="ph-bold ph-user-gear text-blue-600 text-[10px]"></i> Pengawas
            </span>
            <span class="font-mono font-black text-blue-900 bg-white/90 px-1 py-0.2 rounded border border-blue-200/80 text-[8.5px] sm:text-[9px] shadow-2xs">
              ${totalPengawas} Org
            </span>
          </div>
          <div class="text-[8.5px] sm:text-[9px] font-bold text-slate-800 truncate mt-0.5 pt-0.5 border-t border-blue-100" title="${pengawasNames.join(', ') || '-'}">
            <span class="truncate block">${pengawasNames.length > 0 ? pengawasNames.join(', ') : '-'}</span>
          </div>
        </div>

        <div class="bg-gradient-to-br from-purple-500/10 via-purple-50/50 to-fuchsia-50/20 border border-purple-300/70 rounded-lg sm:rounded-xl p-1 sm:p-1.5 shadow-2xs">
          <div class="flex items-center justify-between">
            <span class="text-[7.5px] sm:text-[8px] font-black uppercase text-purple-900 flex items-center gap-1">
              <i class="ph-bold ph-users-three text-purple-600 text-[10px]"></i> Blaster
            </span>
            <span class="font-mono font-black text-purple-900 bg-white/90 px-1 py-0.2 rounded border border-purple-200/80 text-[8.5px] sm:text-[9px] shadow-2xs">
              ${totalBlaster} Org
            </span>
          </div>
          <div class="text-[8.5px] sm:text-[9px] font-bold text-slate-800 truncate mt-0.5 pt-0.5 border-t border-purple-100" title="${blasterNames.join(', ') || '-'}">
            <span class="truncate block">${blasterNames.length > 0 ? blasterNames.join(', ') : '-'}</span>
          </div>
        </div>
      </div>

      <div class="bg-gradient-to-r from-amber-500/10 via-amber-50/60 to-transparent border border-amber-300/70 rounded-lg sm:rounded-xl px-2 py-0.5 sm:py-1 flex items-center gap-1.5 shadow-2xs relative z-1">
        <i class="ph-bold ph-notepad text-amber-600 text-xs flex-shrink-0"></i>
        <div class="min-w-0 flex-1 truncate">
          <span class="text-[7.5px] sm:text-[8px] font-black uppercase text-amber-900 mr-1">Note:</span>
          <span class="text-[8.5px] sm:text-[9px] text-slate-700 italic truncate">${noteText}</span>
        </div>
      </div>
    </div>
  `;
}

function renderDashboardUI(filterDate) {
  const planBadge = document.getElementById('plan-count-badge');
  if (planBadge) planBadge.innerText = `${globalPlanData.length} Baris`;

  const cardSis = document.getElementById('card-summary-sis');
  const cardBuma = document.getElementById('card-summary-buma');
  const cardDahana = document.getElementById('card-summary-dahana');
  const cardMnk = document.getElementById('card-summary-mnk');

  if (cardSis) {
    cardSis.innerHTML = renderContractorSummaryCard('SIS', {
      name: 'PT SIS',
      icon: 'ph-shield-check',
      iconGradient: 'from-blue-600 to-indigo-700',
      iconText: 'text-blue-600',
      border: 'border-blue-200/80 hover:border-blue-400 hover:ring-2 hover:ring-blue-100',
      accentGradient: 'from-blue-600 via-indigo-600 to-sky-500',
      cardBg: 'from-white via-blue-50/20 to-indigo-50/25',
      glowBg: 'bg-blue-400',
      dotColor: 'bg-blue-500',
      badgeClass: 'bg-blue-100/90 text-blue-900 border border-blue-200/90',
      textDth: 'text-blue-700',
      allocLabelColor: 'text-indigo-700',
      allocValColor: 'text-indigo-950',
      allocBarGradient: 'bg-gradient-to-r from-blue-500 to-indigo-600',
      unitBadge: 'bg-blue-50/90 text-blue-900 border-blue-200/90 hover:bg-blue-100'
    });
  }

  if (cardBuma) {
    cardBuma.innerHTML = renderContractorSummaryCard('BUMA', {
      name: 'PT BUMA',
      icon: 'ph-shield-star',
      iconGradient: 'from-emerald-600 to-teal-700',
      iconText: 'text-emerald-600',
      border: 'border-emerald-200/80 hover:border-emerald-400 hover:ring-2 hover:ring-emerald-100',
      accentGradient: 'from-emerald-600 via-teal-600 to-cyan-500',
      cardBg: 'from-white via-emerald-50/20 to-teal-50/25',
      glowBg: 'bg-emerald-400',
      dotColor: 'bg-emerald-500',
      badgeClass: 'bg-emerald-100/90 text-emerald-900 border border-emerald-200/90',
      textDth: 'text-emerald-700',
      allocLabelColor: 'text-teal-700',
      allocValColor: 'text-teal-950',
      allocBarGradient: 'bg-gradient-to-r from-emerald-500 to-teal-600',
      unitBadge: 'bg-emerald-50/90 text-emerald-900 border-emerald-200/90 hover:bg-emerald-100'
    });
  }

  if (cardDahana) {
    cardDahana.innerHTML = renderSupplierSummaryCard('DAHANA', {
      name: 'PT DAHANA',
      icon: 'ph-lightning',
      iconGradient: 'from-amber-500 to-orange-600',
      iconText: 'text-amber-600',
      border: 'border-amber-200/80 hover:border-amber-400 hover:ring-2 hover:ring-amber-100',
      accentGradient: 'from-amber-500 via-orange-500 to-yellow-400',
      cardBg: 'from-white via-amber-50/20 to-orange-50/25',
      glowBg: 'bg-amber-400',
      dotColor: 'bg-amber-500',
      badgeClass: 'bg-amber-100/90 text-amber-950 border border-amber-200/90',
      textDth: 'text-amber-700',
      allocLabelColor: 'text-amber-800',
      allocValColor: 'text-amber-950',
      allocBarGradient: 'bg-gradient-to-r from-amber-500 to-orange-600',
      unitBadge: 'bg-amber-50/90 text-amber-950 border-amber-200/90 hover:bg-amber-100'
    });
  }

  if (cardMnk) {
    cardMnk.innerHTML = renderSupplierSummaryCard('MNK-KMB', {
      name: 'PT MNK-KMB',
      icon: 'ph-fire',
      iconGradient: 'from-rose-600 to-red-700',
      iconText: 'text-rose-600',
      border: 'border-rose-200/80 hover:border-rose-400 hover:ring-2 hover:ring-rose-100',
      accentGradient: 'from-rose-600 via-red-600 to-pink-500',
      cardBg: 'from-white via-rose-50/20 to-red-50/25',
      glowBg: 'bg-rose-400',
      dotColor: 'bg-rose-500',
      badgeClass: 'bg-rose-100/90 text-rose-900 border border-rose-200/90',
      textDth: 'text-rose-700',
      allocLabelColor: 'text-rose-800',
      allocValColor: 'text-rose-950',
      allocBarGradient: 'bg-gradient-to-r from-rose-500 to-red-600',
      unitBadge: 'bg-rose-50/90 text-rose-900 border-rose-200/90 hover:bg-rose-100'
    });
  }

  if (typeof renderPlanBlastingTable === 'function') renderPlanBlastingTable();
  if (typeof renderKesiapanSupplierTable === 'function') renderKesiapanSupplierTable();
}

