/**
 * INTEGRATED BLASTING PLAN & DASHBOARD PLATFORM
 * Module: UTILITIES & HELPERS
 * Fungsi-fungsi pembantu umum, formatting, manipulasi teks, otorisasi peran, dan parsing data.
 */

// Global Loading Overlay Helpers (Layar gelap 50% + lingkaran loading)
function showGlobalLoading() {
  const overlay = document.getElementById('global-loading-overlay');
  if (overlay) {
    overlay.classList.remove('opacity-0', 'pointer-events-none');
    overlay.classList.add('opacity-100', 'pointer-events-auto');
  }
}

function hideGlobalLoading() {
  const overlay = document.getElementById('global-loading-overlay');
  if (overlay) {
    overlay.classList.remove('opacity-100', 'pointer-events-auto');
    overlay.classList.add('opacity-0', 'pointer-events-none');
  }
}

// Formatters untuk Unit MMU/MMT & Box: MMT/MMU xx (1 unit) atau MMT/MMU (nomor, nomor) (>1 unit)
function formatMmuReadyList(raw, supplierName = '') {
  if (!raw || String(raw).trim() === '' || String(raw).trim() === '-') return '-';
  const str = String(raw).trim();

  // Tentukan prefix MMT atau MMU
  const isMmt = /MMT/i.test(str) || /DAHANA/i.test(String(supplierName));
  const prefix = isMmt ? 'MMT' : 'MMU';

  // Lepas pembungkus luar jika sudah ada misal MMT (...) atau MMU (...)
  let cleanStr = str.replace(/^(?:MMT|MMU|UNIT)\s*\((.*)\)$/i, '$1');

  // Pisahkan berdasarkan koma, titik koma, slash, atau newline
  const parts = cleanStr.split(/[,;\n\/]+/).map(p => {
    // Hapus teks dalam kurung jika ada kapasitas misal (16T)
    let cleaned = p.replace(/\s*\([^)]*\)/g, '').trim();
    // Hapus prefix MMT / MMU / UNIT di setiap item secara menyeluruh
    cleaned = cleaned.replace(/^(?:MMT|MMU|UNIT)\s*[-:]?\s*/i, '').trim();
    return cleaned;
  }).filter(Boolean);

  if (parts.length === 0) return '-';

  // Jika hanya 1 unit: MMT xx atau MMU xx
  if (parts.length === 1) {
    return `${prefix} ${parts[0]}`;
  }

  // Jika > 1 unit: MMT (nomor, nomor) atau MMU (nomor, nomor)
  return `${prefix} (${parts.join(', ')})`;
}

function formatBoxReadyList(raw) {
  if (!raw || String(raw).trim() === '' || String(raw).trim() === '-') return '-';
  const str = String(raw).trim();

  // Lepas pembungkus luar jika sudah ada misal BOX (...) atau MOBIL BOX (...)
  let cleanStr = str.replace(/^(?:BOX|MOBIL\s*BOX|LV\s*BOX)\s*\((.*)\)$/i, '$1');

  const parts = cleanStr.split(/[,;\n\/]+/).map(p => {
    let cleaned = p.replace(/\s*\([^)]*\)/g, '').trim();
    cleaned = cleaned.replace(/^(?:LV\s*BOX|MOBIL\s*BOX|BOX|LV)\s*[-:]?\s*/i, '').trim();
    return cleaned;
  }).filter(Boolean);

  if (parts.length === 0) return '-';

  // Jika hanya 1 unit: BOX xx
  if (parts.length === 1) {
    return `BOX ${parts[0]}`;
  }

  // Jika > 1 unit: BOX (nomor, nomor)
  return `BOX (${parts.join(', ')})`;
}

function getAllPresetMmus() {
  const list = [];
  for (const [sup, items] of Object.entries(SUPPLIER_MMU_PRESETS)) {
    items.forEach(it => {
      list.push({ ...it, supplier: sup });
    });
  }
  return list;
}

function calculateMmuTotalDth(mmuString) {
  if (!mmuString || typeof mmuString !== 'string') return 0;
  const items = mmuString.split(/[,;/]+/).map(s => s.trim()).filter(Boolean);
  let total = 0;
  items.forEach(itemCode => {
    total += getMmuCapacity(itemCode);
  });
  return total;
}

// Helper Normalisasi Key MMU/MMT (Case-Insensitive & Space-Insensitive)
function cleanMmuKey(str) {
  if (!str) return '';
  return String(str).toUpperCase().replace(/\s+/g, '');
}

// Helper Numeric Parser (Kompatibel dengan koma desimal excel "25,50" atau string)
function parseNumeric(val) {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const str = String(val).replace(/,/g, '.').replace(/[^\d.-]/g, '');
  const n = parseFloat(str);
  return isNaN(n) ? 0 : n;
}

// Helper: Ambil peta MMU yang sudah dipakai pada tanggal tertentu
function getUsedMmuMapForDate(targetDate, excludePlanUuid = null) {
  const usedMap = {};
  if (!targetDate) return usedMap;
  const normTarget = normalizeDateToYYYYMMDD(targetDate);

  (rawGlobalPlanData || []).forEach(plan => {
    const planUuid = String(plan.uuid || plan.id || '').trim();
    if (excludePlanUuid && planUuid === String(excludePlanUuid).trim()) return;

    const rawDate = getValFlexible(plan, 'tanggal', 'date', 'tgl') || plan.tanggal;
    const planDate = normalizeDateToYYYYMMDD(rawDate);
    if (planDate === normTarget) {
      const mmuSources = [plan.unit_mmu, plan.need_mmu, plan.mmu].filter(Boolean).join(', ');
      if (mmuSources) {
        const units = mmuSources.split(/[,;/]+/).map(s => s.trim()).filter(Boolean);
        units.forEach(u => {
          const key = cleanMmuKey(u);
          if (key) {
            usedMap[key] = { plan: plan, code: u, lokasi: plan.lokasi || '-' };
          }
        });
      }
    }
  });

  return usedMap;
}

function notifyMmuAlreadyUsed(code) {
  Swal.fire({
    icon: 'info',
    title: 'Informasi Alokasi MMU',
    text: `Catatan: MMU/MMT ${code} tercatat sudah dialokasikan pada plan lain di tanggal ini.`,
    timer: 2000,
    showConfirmButton: false
  });
}

// Security PIN 8080 untuk Input, Edit, dan Delete
async function requestSecurityPin(actionDescription = 'melanjutkan tindakan ini') {
  const { value: pin } = await Swal.fire({
    title: 'Verifikasi PIN Keamanan',
    html: `<p class="text-xs text-slate-500 mb-2">Masukkan PIN otorisasi (4 digit) untuk <b>${actionDescription}</b>:</p>`,
    input: 'password',
    inputPlaceholder: 'PIN...',
    inputAttributes: {
      maxlength: '10',
      autocapitalize: 'off',
      autocorrect: 'off',
      style: 'text-align: center; letter-spacing: 0.3em; font-size: 1.25rem; font-family: monospace;'
    },
    showCancelButton: true,
    confirmButtonColor: '#dc2626',
    cancelButtonColor: '#64748b',
    confirmButtonText: '<i class="ph-bold ph-shield-check"></i> Konfirmasi',
    cancelButtonText: 'Batal',
    customClass: {
      popup: 'rounded-2xl',
      confirmButton: 'rounded-xl text-xs font-extrabold px-4 py-2.5',
      cancelButton: 'rounded-xl text-xs font-bold px-4 py-2.5'
    },
    preConfirm: (inputPin) => {
      if (!inputPin) {
        Swal.showValidationMessage('PIN tidak boleh kosong!');
        return false;
      }
      if (inputPin.trim() !== '8080') {
        Swal.showValidationMessage('PIN salah! Akses ditolak.');
        return false;
      }
      return true;
    }
  });

  return !!pin;
}

function cleanCompanyName(name) {
  if (!name) return '';
  let clean = name.replace(/^PT\.?\s+/i, '').trim();
  return `PT ${clean}`;
}

// Revisi 1: Manpower String Cleaner (Pengawas & Blaster)
function cleanManpowerString(val) {
  if (!val || val === '-' || String(val).includes('#NUM') || String(val) === 'NaN' || String(val).trim() === '0') return '-';
  return String(val).trim();
}

function getCurrentLoginContractor() {
  if (!currentUser || !currentUser.company) return 'SIS';
  const c = currentUser.company.toUpperCase().replace(/^PT\.?\s+/i, '').trim();
  if (c.includes('BUMA')) return 'BUMA';
  if (c.includes('SIS')) return 'SIS';
  return c || 'SIS';
}

function isUserOwner() {
  if (!currentUser) return false;
  const role = (currentUser.role || '').toUpperCase();
  return role === 'OWNER' || role === 'ADMIN' || role === 'ADARO' || role === 'CCR';
}

function isUserKontraktor() {
  if (!currentUser) return false;
  const role = (currentUser.role || '').toUpperCase();
  return role === 'KONTRAKTOR';
}

function isUserSupplier() {
  if (!currentUser) return false;
  const role = (currentUser.role || '').toUpperCase();
  return role === 'SUPPLIER';
}

function getMmuCapacity(unitCode) {
  if (!unitCode) return 15;
  const baseCode = String(unitCode).replace(/\s*reload/i, '').trim();
  const cleanCode = baseCode.toUpperCase().replace(/\s+/g, '');
  for (const list of Object.values(SUPPLIER_MMU_PRESETS)) {
    const found = list.find(m => m.code.toUpperCase().replace(/\s+/g, '') === cleanCode);
    if (found) return found.cap;
  }
  return 15;
}

function parseAllocatedMmuInfo(str) {
  const result = { items: [], totalDth: 0 };
  if (!str || typeof str !== 'string') return result;

  const dthMatch = str.match(/\(([\d.]+)\s*Ton\)/i);
  if (dthMatch) {
    result.totalDth = parseFloat(dthMatch[1]) || 0;
  }

  const cleanStr = str.replace(/\([^)]*Ton\)/gi, '').trim();
  const segments = cleanStr.split(/[,;/]+/).map(s => s.trim()).filter(Boolean);

  segments.forEach(seg => {
    let qty = 1;
    let code = seg;

    const prefixMatch = seg.match(/^([\d.]+)\s+(.+)$/);
    const parenMatch = seg.match(/^([^(]+)\s*\(([\d.]+)\)$/);

    if (prefixMatch) {
      qty = parseFloat(prefixMatch[1]) || 1;
      code = prefixMatch[2].trim();
    } else if (parenMatch) {
      code = parenMatch[1].trim();
      qty = parseFloat(parenMatch[2]) || 1;
    }

    if (code) {
      result.items.push({ code: code, qty: qty });
    }
  });

  // Fallback kalkulasi totalDth jika string tidak mencantumkan "(X Ton)"
  if (result.totalDth === 0 && result.items.length > 0) {
    result.totalDth = result.items.reduce((sum, it) => sum + (it.qty * getMmuCapacity(it.code)), 0);
  }

  return result;
}

function getWitaDateString(d = new Date()) {
  return new Date(d).toLocaleDateString('sv-SE', { timeZone: 'Asia/Makassar' });
}

// Normalisasi Tanggal Spreadsheet ke YYYY-MM-DD
function normalizeDateToYYYYMMDD(val) {
  if (!val) return '';
  if (typeof val === 'string') {
    const str = val.trim();
    // 1. Format ISO YYYY-MM-DD atau YYYY/MM/DD
    const isoMatch = str.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
    if (isoMatch) {
      return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
    }
    // 2. Format DD/MM/YYYY atau DD-MM-YYYY
    const dmyMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
    if (dmyMatch) {
      return `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`;
    }
    // 3. String tanggal Apps Script / Google Sheets
    const cleaned = str.replace(/\s+(GM|GMT|WITA|WIB|WIT).*$/i, '').trim();
    const dt = new Date(cleaned);
    if (!isNaN(dt.getTime())) {
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      const d = String(dt.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    // 4. Fallback jika masih ada string tanggal panjang
    const dtFallback = new Date(str.substring(0, 15));
    if (!isNaN(dtFallback.getTime())) {
      const y = dtFallback.getFullYear();
      const m = String(dtFallback.getMonth() + 1).padStart(2, '0');
      const d = String(dtFallback.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }
  if (val instanceof Date && !isNaN(val.getTime())) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(val).substring(0, 10);
}

// Mengubah Waktu Excel ke Format HH:MM
function formatExcelTime(val) {
  if (val === null || val === undefined || val === '' || val === '-') return '-';

  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed === '' || trimmed === '-') return '-';

    // 1. Format jam langsung HH:MM atau HH:MM:SS
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(trimmed)) {
      const parts = trimmed.split(':');
      const h = parts[0].padStart(2, '0');
      const m = parts[1].padStart(2, '0');
      return `${h}:${m}`;
    }
    // 2. Format ISO Timestamp dari Google Sheets / Apps Script
    if (trimmed.includes('T') || trimmed.includes('1899')) {
      const dt = new Date(trimmed);
      if (!isNaN(dt.getTime())) {
        try {
          const timeParts = dt.toLocaleTimeString('en-GB', {
            timeZone: 'Asia/Makassar',
            hour12: false,
            hour: '2-digit',
            minute: '2-digit'
          });
          if (timeParts && timeParts.includes(':')) {
            return timeParts;
          }
        } catch (e) { }

        const utcHours = dt.getUTCHours();
        const utcMinutes = dt.getUTCMinutes();
        let totalSec = (utcHours * 3600 + utcMinutes * 60 + 8 * 3600) % 86400;
        if (totalSec < 0) totalSec += 86400;
        const h = String(Math.floor(totalSec / 3600)).padStart(2, '0');
        const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
        return `${h}:${m}`;
      }
    }
  }

  // 3. Serial desimal Excel (contoh: 0.395833333333333)
  if (typeof val === 'number') {
    let totalSeconds = Math.round(val * 86400);
    totalSeconds = totalSeconds % 86400;
    if (totalSeconds < 0) totalSeconds += 86400;

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    const h = String(hours).padStart(2, '0');
    const m = String(minutes).padStart(2, '0');
    return `${h}:${m}`;
  }

  // 4. Object Date javascript
  if (val instanceof Date && !isNaN(val.getTime())) {
    try {
      return val.toLocaleTimeString('en-GB', {
        timeZone: 'Asia/Makassar',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      const h = String(val.getHours()).padStart(2, '0');
      const m = String(val.getMinutes()).padStart(2, '0');
      return `${h}:${m}`;
    }
  }

  return String(val);
}

// Helper Robust Pencerna Header Fleksibel
function getValFlexible(row, ...possibleKeys) {
  if (!row) return '';
  const rowKeys = Object.keys(row);
  for (let candidate of possibleKeys) {
    const normalizedTarget = candidate.toLowerCase().replace(/[^a-z0-9]/g, '');
    const matchedKey = rowKeys.find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedTarget);
    if (matchedKey && row[matchedKey] !== undefined && row[matchedKey] !== null && String(row[matchedKey]).trim() !== '') {
      return row[matchedKey];
    }
  }
  return '';
}

// Normalisasi Status Peledakan (Mendukung 6 Status)
function normalizeBlastingStatus(raw) {
  if (!raw) return 'TODAY';
  const str = String(raw).trim().toUpperCase();
  if (str.includes('CANCEL') || str.includes('CALCEL') || str.includes('HOLD')) return 'CANCEL/HOLD';
  if (str.includes('TIE') && str.includes('TODAY')) return 'TIE UP + TODAY';
  if (str.includes('TIE')) return 'TIE UP';
  if (str.includes('TODAY') && str.includes('SLEEP')) return 'TODAY/SLEEP';
  if (str.includes('SLEEP')) return 'SLEEP';
  if (str.includes('TODAY')) return 'TODAY';
  return str;
}

function getStatusBadgeHtml(status) {
  const norm = normalizeBlastingStatus(status);
  const cfg = BLASTING_STATUS_CONFIG[norm] || {
    label: norm,
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
    dotColor: 'bg-slate-400'
  };
  return `<span class="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide inline-flex items-center gap-1 border ${cfg.badgeClass}"><span class="w-1.5 h-1.5 rounded-full ${cfg.dotColor}"></span>${cfg.label}</span>`;
}

function getPlanTodaySleepStatus(item) {
  if (!item) return 'TODAY';
  const raw = getValFlexible(item, 'today_sleep', 'today/sleep', 'todaysleep', 'today / sleep', 'status', 'blast_status', 'mode');
  return normalizeBlastingStatus(raw);
}

function parseExcelDate(rawDate) {
  if (!rawDate) return getWitaDateString();

  if (typeof rawDate === 'number') {
    if (window.XLSX && XLSX.SSF && XLSX.SSF.parse_date_code) {
      const dateObj = XLSX.SSF.parse_date_code(rawDate);
      if (dateObj) {
        const yyyy = dateObj.y;
        const mm = String(dateObj.m).padStart(2, '0');
        const dd = String(dateObj.d).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      }
    }
  }

  if (typeof rawDate === 'string') {
    const str = rawDate.trim();
    const jsDate = new Date(str);
    if (!isNaN(jsDate.getTime())) {
      const yyyy = jsDate.getFullYear();
      const mm = String(jsDate.getMonth() + 1).padStart(2, '0');
      const dd = String(jsDate.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }

    if (str.includes('/') || str.includes('-')) {
      const parts = str.split(/[\/\-]/);
      if (parts.length === 3) {
        if (parts[2].length === 4) {
          const dd = parts[0].padStart(2, '0');
          const mm = parts[1].padStart(2, '0');
          const yyyy = parts[2];
          return `${yyyy}-${mm}-${dd}`;
        }
      }
    }
  }

  return getWitaDateString();
}

