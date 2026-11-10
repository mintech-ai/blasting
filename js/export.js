/**
 * INTEGRATED BLASTING PLAN & DASHBOARD PLATFORM
 * Module: EXPORT ENGINE (EXCEL & WHATSAPP)
 * Menangani modal pilihan kolom export, generate file Excel via SheetJS (.xlsx), dan format salin teks WhatsApp.
 */

function openExportModal() {
  renderExportColumnChecklist();
  updateExportPreviewCount();
  const modal = document.getElementById('modal-export-data');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
}

function closeExportModal() {
  const modal = document.getElementById('modal-export-data');
  if (modal) {
    modal.classList.remove('flex');
    modal.classList.add('hidden');
  }
}

function renderExportColumnChecklist() {
  const container = document.getElementById('export-columns-checklist');
  if (!container) return;

  let html = '';
  EXPORT_AVAILABLE_COLUMNS.forEach(col => {
    const isChecked = selectedExportColumnIds.has(col.id);
    html += `
      <label class="flex items-center gap-1.5 p-1.5 rounded-lg border transition cursor-pointer select-none ${isChecked ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-bold' : 'bg-slate-50 border-slate-200 text-slate-600'}">
        <input type="checkbox" onchange="toggleExportColumn('${col.id}')" ${isChecked ? 'checked' : ''} class="w-3.5 h-3.5 text-emerald-600 rounded">
        <span class="text-[11px] truncate" title="${col.label}">${col.label}</span>
      </label>
    `;
  });
  container.innerHTML = html;
}

function toggleExportColumn(colId) {
  if (selectedExportColumnIds.has(colId)) {
    selectedExportColumnIds.delete(colId);
  } else {
    selectedExportColumnIds.add(colId);
  }
  renderExportColumnChecklist();
}

function selectAllExportColumns(selectAll = true) {
  if (selectAll) {
    selectedExportColumnIds = new Set(EXPORT_AVAILABLE_COLUMNS.map(c => c.id));
  } else {
    selectedExportColumnIds.clear();
  }
  renderExportColumnChecklist();
}

function resetStandardExportColumns() {
  selectedExportColumnIds = new Set(EXPORT_AVAILABLE_COLUMNS.filter(c => c.default).map(c => c.id));
  renderExportColumnChecklist();
}

function toggleAllExportCheckboxes(type, isCheck) {
  const name = type === 'kontraktor' ? 'export_chk_kontraktor' : 'export_chk_supplier';
  document.querySelectorAll(`input[name="${name}"]`).forEach(cb => {
    cb.checked = isCheck;
  });
  updateExportPreviewCount();
}

function getFilteredExportPlans() {
  const selectedKontraktors = Array.from(document.querySelectorAll('input[name="export_chk_kontraktor"]:checked')).map(c => c.value);
  const filterStatus = (document.getElementById('export-filter-status') ? document.getElementById('export-filter-status').value : 'ALL');

  if (selectedKontraktors.length === 0) return [];

  return (globalPlanData || []).filter(item => {
    const k = String(item.kontraktor || '').toUpperCase();
    const matchKontraktor = selectedKontraktors.some(val => k.includes(val));
    if (!matchKontraktor) return false;

    if (filterStatus !== 'ALL') {
      const st = getPlanTodaySleepStatus(item);
      if (st !== filterStatus) return false;
    }

    return true;
  });
}

function getFilteredExportSuppliers() {
  const selectedSuppliers = Array.from(document.querySelectorAll('input[name="export_chk_supplier"]:checked')).map(c => c.value);
  if (selectedSuppliers.length === 0) return [];

  return (globalSupplierData || []).filter(item => {
    const s = String(item.supplier || '').toUpperCase();
    return selectedSuppliers.some(val => s.includes(val));
  });
}

function updateExportPreviewCount() {
  const countEl = document.getElementById('export-preview-count');
  if (countEl) {
    const plans = getFilteredExportPlans();
    const sups = getFilteredExportSuppliers();
    const parts = [];
    if (plans.length > 0) parts.push(`${plans.length} baris Plan Blasting`);
    if (sups.length > 0) parts.push(`${sups.length} baris Kesiapan Supplier`);
    if (parts.length === 0) {
      countEl.innerText = '0 data dipilih untuk diexport';
    } else {
      countEl.innerText = `${parts.join(' & ')} siap diexport`;
    }
  }
}

function downloadExportExcel() {
  const plans = getFilteredExportPlans();
  const sups = getFilteredExportSuppliers();

  if (plans.length === 0 && sups.length === 0) {
    Swal.fire({
      icon: 'warning',
      title: 'Tidak Ada Data',
      text: 'Harap centang minimal 1 Kontraktor atau 1 Supplier untuk diexport!'
    });
    return;
  }

  if (plans.length > 0 && selectedExportColumnIds.size === 0) {
    Swal.fire({
      icon: 'warning',
      title: 'Pilih Kolom Plan',
      text: 'Harap pilih minimal 1 kolom Plan Blasting yang ingin diexport!'
    });
    return;
  }

  const targetDate = document.getElementById('global-date-filter').value || getWitaDateString();
  const aoa = [];

  // ==================== TABEL 1: RENCANA PELEDAKAN (PLAN BLASTING) ====================
  if (plans.length > 0) {
    const activeColumns = EXPORT_AVAILABLE_COLUMNS.filter(c => selectedExportColumnIds.has(c.id));
    const groupByKontraktor = true;
    const includeSummary = true;

    aoa.push([`TABEL 1: RENCANA PELEDAKAN (PLAN BLASTING) - ${targetDate}`]);
    aoa.push([`Tanggal Export: ${getWitaDateString()} WITA | Total Record: ${plans.length}`]);
    aoa.push([]);

    const headerRow = activeColumns.map(c => c.label);
    aoa.push(headerRow);

    function getPlanColValue(item, colId, rowIndex) {
      switch (colId) {
        case 'no': return rowIndex + 1;
        case 'lokasi': return item.lokasi || '-';
        case 'prioritas': return item.prioritas || '-';
        case 'today_sleep': return getPlanTodaySleepStatus(item);
        case 'inisiasi': return item.inisiasi || '-';
        case 'jam_masuk': return formatExcelTime(item.jam_masuk || item.kondisi_jam_masuk);
        case 'remark': return item.remark || item.kondisi_remark || '-';
        case 'pengawas': return item.pengawas_kontraktor || '-';
        case 'holes': return Number(item.jumlah_holes || item.holes || 0);
        case 'isian': return Number(item.isian_kg || item.isian || 0);
        case 'volume': return Number(item.volume_ton || item.volume || 0);
        case 'akses': return item.akses || '-';
        case 'desa': return item.desa || item.desa_terdampak || '-';
        case 'matrix': return item.matrix || '-';
        case 'geometri': return item.geometri || '-';
        case 'supplier': return item.supplier || '-';
        case 'pengawas_sup': return cleanManpowerString(item.pengawas_supplier || item.supervisor || '') || '-';
        case 'blaster': return cleanManpowerString(item.blaster || item.jumlah_blaster || item.nama_blaster || '') || '-';
        case 'unit_mmu': return item.unit_mmu || item.need_mmu || '-';
        case 'unit_box': return item.unit_box || '-';
        case 'coordinates': return (item.latitude && item.longitude) ? `${item.latitude}, ${item.longitude}` : '-';
        default: return '';
      }
    }

    let dthTodaySum = 0;
    let dthSleepSum = 0;
    let globalRowIndex = 0;

    if (groupByKontraktor) {
      const groups = {};
      plans.forEach(p => {
        const kName = cleanCompanyName(p.kontraktor) || 'PT LAINNYA';
        if (!groups[kName]) groups[kName] = [];
        groups[kName].push(p);
      });

      const sortedGroupKeys = Object.keys(groups).sort((a, b) => {
        if (a.includes('SIS')) return -1;
        if (b.includes('SIS')) return 1;
        if (a.includes('BUMA')) return -1;
        if (b.includes('BUMA')) return 1;
        return a.localeCompare(b);
      });

      sortedGroupKeys.forEach(grpName => {
        aoa.push([grpName]);
        const grpPlans = groups[grpName];
        grpPlans.forEach(plan => {
          const rowData = activeColumns.map(c => getPlanColValue(plan, c.id, globalRowIndex));
          aoa.push(rowData);

          const vol = Number(plan.volume_ton || plan.volume || 0);
          const st = getPlanTodaySleepStatus(plan);
          if (st === 'SLEEP' || st === 'TODAY/SLEEP') {
            dthSleepSum += vol;
          } else if (st !== 'CANCEL/HOLD') {
            dthTodaySum += vol;
          }

          globalRowIndex++;
        });
        aoa.push([]);
      });
    } else {
      plans.forEach(plan => {
        const rowData = activeColumns.map(c => getPlanColValue(plan, c.id, globalRowIndex));
        aoa.push(rowData);

        const vol = Number(plan.volume_ton || plan.volume || 0);
        const st = getPlanTodaySleepStatus(plan);
        if (st === 'SLEEP' || st === 'TODAY/SLEEP') {
          dthSleepSum += vol;
        } else if (st !== 'CANCEL/HOLD') {
          dthTodaySum += vol;
        }

        globalRowIndex++;
      });
      aoa.push([]);
    }

    const totalDthSum = dthTodaySum + dthSleepSum;

    if (includeSummary) {
      const summarySpacer = new Array(Math.max(0, activeColumns.length - 4)).fill('');
      aoa.push([...summarySpacer, 'DTH TODAY', parseFloat(dthTodaySum.toFixed(3)), 'TOTAL DTH', parseFloat(totalDthSum.toFixed(3))]);
      aoa.push([...summarySpacer, 'DTH SLEEP', parseFloat(dthSleepSum.toFixed(3)), '', '']);
      aoa.push([]);
    }
  }

  // ==================== TABEL 2: KESIAPAN OPERASIONAL SUPPLIER ====================
  if (sups.length > 0) {
    if (plans.length > 0) {
      aoa.push([]);
      aoa.push([]);
    }

    aoa.push([`TABEL 2: KESIAPAN OPERASIONAL SUPPLIER - ${targetDate}`]);
    aoa.push([`Tanggal: ${targetDate} | Total Record Supplier: ${sups.length}`]);
    aoa.push([]);

    const supHeaders = [
      'NO',
      'TANGGAL',
      'SUPPLIER',
      'UNIT MMU / MMT READY',
      'TOTAL DTH READY (TON)',
      'MOBIL BOX READY',
      'DEVICE (HEBS / ESTAR)',
      'NONEL STARTER',
      'PENGAWAS ONSITE',
      'JML PENGAWAS',
      'BLASTER ONSITE',
      'JML BLASTER',
      'CATATAN / NOTE'
    ];
    aoa.push(supHeaders);

    sups.forEach((item, index) => {
      const rowNo = index + 1;
      const tgl = normalizeDateToYYYYMMDD(item.tanggal) || item.tanggal || '-';
      const sup = cleanCompanyName(item.supplier) || '-';
      const mmu = formatMmuReadyList(item.unit_mmu, item.supplier);
      const dth = Number(item.dth_ready || 0);
      const box = formatBoxReadyList(item.unit_box);
      const devices = [item.hebs, item.estar, item.axiss].filter(x => x && x !== '' && x !== '0').join(', ') || '-';
      const nonel = item.nonel || '-';
      const namaSpv = item.nama_spv || '-';
      const numSpv = Number(item.supervisor || 0);
      const namaBlaster = item.nama_blaster || '-';
      const numBlaster = Number(item.blaster || 0);
      const note = item.note || '-';

      aoa.push([
        rowNo,
        tgl,
        sup,
        mmu,
        dth,
        box,
        devices,
        nonel,
        namaSpv,
        numSpv,
        namaBlaster,
        numBlaster,
        note
      ]);
    });
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  const maxCols = Math.max(...aoa.map(r => r.length));
  const colWidths = [];
  for (let c = 0; c < maxCols; c++) {
    let maxLen = 10;
    aoa.forEach(r => {
      if (r[c] !== undefined && r[c] !== null) {
        const len = String(r[c]).length;
        if (len > maxLen) maxLen = len;
      }
    });
    colWidths.push({ wch: Math.min(Math.max(maxLen + 2, 10), 45) });
  }
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Blasting Data");

  let filePrefix = 'Plan_Blasting';
  if (plans.length > 0 && sups.length > 0) filePrefix = 'Laporan_Blasting_Lengkap';
  else if (sups.length > 0) filePrefix = 'Kesiapan_Supplier';

  const fileName = `${filePrefix}_${targetDate.replace(/[^a-zA-Z0-9-]/g, '_')}.xlsx`;
  XLSX.writeFile(wb, fileName);

  Swal.fire({
    icon: 'success',
    title: 'File Excel Berhasil Diunduh!',
    text: `File ${fileName} telah disimpan ke perangkat Anda.`,
    timer: 2000,
    showConfirmButton: false
  });
}

function copyExportToWhatsApp() {
  const plans = getFilteredExportPlans();
  const sups = getFilteredExportSuppliers();

  if (plans.length === 0 && sups.length === 0) {
    Swal.fire({
      icon: 'warning',
      title: 'Data Kosong',
      text: 'Harap centang minimal 1 Kontraktor atau 1 Supplier untuk disalin ke WhatsApp!'
    });
    return;
  }

  function waClean(val, fallback = '-') {
    if (val === undefined || val === null) return fallback;
    const clean = String(val).replace(/\s+/g, ' ').trim();
    return clean || fallback;
  }

  function waBold(val) {
    if (val === undefined || val === null) return '';
    const clean = String(val).replace(/\s+/g, ' ').trim();
    if (!clean) return '';
    return `*${clean}*`;
  }

  const targetDate = waClean(document.getElementById('global-date-filter').value || getWitaDateString());
  let text = '';

  // ==================== TABEL 1: PLAN BLASTING MITRA ====================
  if (plans.length > 0) {
    let dthTodaySum = 0;
    let dthSleepSum = 0;
    let countSis = 0;
    let countBuma = 0;
    let countOther = 0;

    const groups = {};
    plans.forEach(p => {
      const kName = cleanCompanyName(p.kontraktor) || 'PT LAINNYA';
      if (!groups[kName]) groups[kName] = [];
      groups[kName].push(p);

      const kUpper = String(p.kontraktor || '').toUpperCase();
      if (kUpper.includes('SIS')) countSis++;
      else if (kUpper.includes('BUMA')) countBuma++;
      else countOther++;
    });

    text += `*RENCANA PELEDAKAN (PLAN BLASTING)*\n`;
    text += `📅 *Tanggal:* ${targetDate}\n`;
    let rekapLine = `📊 *Total Plan:* PT SIS: *${countSis}* | PT BUMA: *${countBuma}*`;
    if (countOther > 0) {
      rekapLine += ` | Lainnya: *${countOther}*`;
    }
    rekapLine += ` (Total: *${plans.length}*)\n`;
    text += rekapLine;
    text += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

    const sortedGroupKeys = Object.keys(groups).sort((a, b) => {
      if (a.includes('SIS')) return -1;
      if (b.includes('SIS')) return 1;
      if (a.includes('BUMA')) return -1;
      if (b.includes('BUMA')) return 1;
      return a.localeCompare(b);
    });

    let overallIdx = 1;
    sortedGroupKeys.forEach(grpName => {
      text += `🏢 ${waBold(grpName)}\n`;
      const grpPlans = groups[grpName];
      grpPlans.forEach(p => {
        const st = getPlanTodaySleepStatus(p);
        const vol = Number(p.volume_ton || p.volume || 0);
        const holes = p.jumlah_holes || p.holes || 0;
        const isian = p.isian_kg || p.isian || 0;
        const prio = p.prioritas || 'P1';
        const inisiasi = p.inisiasi || 'RF';
        const jam = formatExcelTime(p.jam_masuk || p.kondisi_jam_masuk);
        const spv = p.pengawas_kontraktor || '-';
        const remark = p.remark || p.kondisi_remark || 'OK';
        const desa = p.desa || p.desa_terdampak || '-';
        const akses = p.akses || '-';
        const matrix = p.matrix || '-';
        const geo = p.geometri || '-';

        const lokasiClean = waClean(p.lokasi, 'Lokasi');
        const prioClean = waClean(prio, 'P1');
        const stClean = waClean(st, 'TODAY');

        text += `${overallIdx}. ${waBold(lokasiClean)} (${prioClean})\n`;

        // Baris 1: Status & Inisiasi
        const l1 = [];
        if (selectedExportColumnIds.has('today_sleep')) l1.push(`Status: ${waBold(stClean)}`);
        if (selectedExportColumnIds.has('inisiasi')) {
          const jm = selectedExportColumnIds.has('jam_masuk') ? ` @ ${waClean(jam, '-')}` : '';
          l1.push(`Inisiasi: ${waClean(inisiasi, 'RF')}${jm}`);
        } else if (selectedExportColumnIds.has('jam_masuk')) {
          l1.push(`Jam: ${waClean(jam, '-')}`);
        }
        if (l1.length > 0) text += `   • ${l1.join(' | ')}\n`;

        // Baris 2: Holes, Isian, Volume
        const l2 = [];
        if (selectedExportColumnIds.has('holes')) l2.push(`Holes: ${waClean(holes, '0')}`);
        if (selectedExportColumnIds.has('isian')) l2.push(`Isian: ${waClean(isian, '0')} kg`);
        if (selectedExportColumnIds.has('volume')) l2.push(waBold(`Vol: ${vol.toFixed(2)} Ton`));
        if (l2.length > 0) text += `   • ${l2.join(' | ')}\n`;

        // Baris 3: Pengawas Kontraktor & Remark
        const l3 = [];
        if (selectedExportColumnIds.has('pengawas')) l3.push(`Pengawas Kont: ${waClean(spv, '-')}`);
        if (selectedExportColumnIds.has('remark')) l3.push(`Remark: ${waClean(remark, 'OK')}`);
        if (l3.length > 0) text += `   • ${l3.join(' | ')}\n`;

        // Baris 4: Akses & Desa
        const l4 = [];
        if (selectedExportColumnIds.has('akses')) l4.push(`Akses: ${waClean(akses, '-')}`);
        if (selectedExportColumnIds.has('desa')) l4.push(`Desa: ${waClean(desa, '-')}`);
        if (l4.length > 0) text += `   • ${l4.join(' | ')}\n`;

        // Baris 5: Matrix & Geo
        const l5 = [];
        if (selectedExportColumnIds.has('matrix')) l5.push(`Matrix: ${waClean(matrix, '-')}`);
        if (selectedExportColumnIds.has('geometri')) l5.push(`Geo: ${waClean(geo, '-')}`);
        if (l5.length > 0) text += `   • ${l5.join(' | ')}\n`;

        // Baris 6: Supplier & Manpower Supplier (Pengawas & Blaster)
        const sup = waClean(p.supplier, '');
        const pSup = cleanManpowerString(p.pengawas_supplier || p.supervisor || '');
        const bls = cleanManpowerString(p.blaster || p.jumlah_blaster || p.nama_blaster || '');
        const lSup = [];
        if (selectedExportColumnIds.has('supplier')) {
          lSup.push(`Supplier: ${sup ? waBold('PT ' + sup.replace(/^PT\\s+/i, '')) : '-'}`);
        }
        if (selectedExportColumnIds.has('pengawas_sup')) {
          lSup.push(`Spv Sup: ${pSup || '-'}`);
        }
        if (selectedExportColumnIds.has('blaster')) {
          lSup.push(`Blaster: ${bls || '-'}`);
        }
        if (lSup.length > 0) text += `   • ${lSup.join(' | ')}\n`;

        // Baris 7: Unit MMU & Box
        const mmu = waClean(p.unit_mmu || p.need_mmu, '');
        const box = waClean(p.unit_box, '');
        const lUnit = [];
        if (selectedExportColumnIds.has('unit_mmu')) {
          lUnit.push(`MMU: ${mmu || '-'}`);
        }
        if (selectedExportColumnIds.has('unit_box')) {
          lUnit.push(`Box: ${box || '-'}`);
        }
        if (lUnit.length > 0) text += `   • ${lUnit.join(' | ')}\n`;

        // Baris 8: Koordinat
        if (selectedExportColumnIds.has('coordinates')) {
          const coord = (p.latitude && p.longitude) ? `${p.latitude}, ${p.longitude}` : '-';
          text += `   • Koordinat: ${coord}\n`;
        }

        text += `\n`;

        if (st === 'SLEEP' || st === 'TODAY/SLEEP') {
          dthSleepSum += vol;
        } else if (st !== 'CANCEL/HOLD') {
          dthTodaySum += vol;
        }

        overallIdx++;
      });
    });

    const totalDth = dthTodaySum + dthSleepSum;
    text += `━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `*RINGKASAN VOLUME DTH:*\n`;
    text += `🟢 *DTH TODAY:* ${dthTodaySum.toFixed(2)} Ton\n`;
    text += `🔴 *DTH SLEEP:* ${dthSleepSum.toFixed(2)} Ton\n`;
    text += `⭐ *TOTAL DTH:* ${totalDth.toFixed(2)} Ton\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━\n`;
  }

  // ==================== TABEL 2: KESIAPAN OPERASIONAL SUPPLIER ====================
  if (sups.length > 0) {
    if (plans.length > 0) {
      text += `\n`;
    }
    text += `*KESIAPAN OPERASIONAL SUPPLIER*\n`;
    text += `📅 *Tanggal:* ${targetDate}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

    sups.forEach((item, idx) => {
      const sup = cleanCompanyName(item.supplier) || 'PT SUPPLIER';
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

      text += `${idx + 1}. *${sup}*\n`;
      text += `   • Unit MMU: ${mmu} (*${dth} Ton*)\n`;
      text += `   • Mobil Box: ${box}\n`;
      text += `   • Pengawas: ${namaSpv} (${numSpv} Org)\n`;
      text += `   • Blaster: ${namaBlaster} (${numBlaster} Org)\n`;
      if (devices !== '-' || nonel !== '-') {
        text += `   • Device: ${devices} | Nonel: ${nonel}\n`;
      }
      if (note && note !== '-') {
        text += `   • Catatan: ${note}\n`;
      }
      text += `\n`;
    });

    text += `━━━━━━━━━━━━━━━━━━━━━\n`;
  }

  text += `_Dikirim via Integrated Blasting Portal Adaro_`;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      Swal.fire({
        icon: 'success',
        title: 'Teks WhatsApp Berhasil Disalin!',
        text: 'Format laporan WhatsApp telah disalin ke clipboard. Silakan tempel (paste) di grup WhatsApp Anda.',
        timer: 2500,
        showConfirmButton: false
      });
    }).catch(err => {
      prompt('Salin teks di bawah ini:', text);
    });
  } else {
    prompt('Salin teks di bawah ini:', text);
  }
}

window.openExportModal = openExportModal;
window.closeExportModal = closeExportModal;
window.renderExportColumnChecklist = renderExportColumnChecklist;
window.toggleExportColumn = toggleExportColumn;
window.selectAllExportColumns = selectAllExportColumns;
window.resetStandardExportColumns = resetStandardExportColumns;
window.toggleAllExportCheckboxes = toggleAllExportCheckboxes;
window.getFilteredExportPlans = getFilteredExportPlans;
window.getFilteredExportSuppliers = getFilteredExportSuppliers;
window.updateExportPreviewCount = updateExportPreviewCount;
window.downloadExportExcel = downloadExportExcel;
window.copyExportToWhatsApp = copyExportToWhatsApp;

