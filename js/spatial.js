/**
 * INTEGRATED BLASTING PLAN & DASHBOARD PLATFORM
 * Module: SPATIAL & DXF BOUNDARY ENGINE (FLEKSIBEL & MODULAR)
 * 
 * Mendukung 3 Skenario Spasial Penuh:
 * 1. DXF SEBELUM Plan: Upload DXF duluan -> Poligon siap dipilih di form manual / bulk import.
 * 2. DXF SESUDAH Plan (Nyusul): Plan diinput bebas lebih dulu -> DXF diunggah menyusul -> Auto-match & tautkan ke plan eksisting.
 * 3. REVISI DXF: Upload file boundary baru -> Update / overwrite geometri plan eksisting di database.
 * 
 * Fitur Utama:
 * - Buffer spesifik kontraktor: BUMA (200m Alat, 500m Manusia) & SIS (100m, 150m, 300m, 500m)
 * - Pembersihan otomatis blocker (4 titik & 145 titik) serta layer bendera / flag
 * - Form input plan fleksibel (bisa pilih DXF atau ketik nama lokasi manual)
 * - Sinkronisasi instan ke database Google Sheets saat boundary ditautkan/direvisi
 */

// ==================== 1. KOORDINAT & PROYEKSI SPASIAL ====================

// Registrasi Proj4 definitions jika Proj4 tersedia
if (typeof proj4 !== 'undefined') {
  proj4.defs('EPSG:32750', '+proj=utm +zone=50 +south +ellps=WGS84 +datum=WGS84 +units=m +no_defs');
  proj4.defs('EPSG:4326', '+proj=longlat +datum=WGS84 +no_defs');
}

// Parameter Kalibrasi Tutupan Site
const TUTUPAN_PARAMS = {
  rot: 57.26,
  dx: -330718.744,
  dy: -9748020.012,
  sf: 1.00008025,
  ox: 334759.446,
  oy: 9757090.68,
  olocx: 4040.702,
  olocy: 9070.668,
};

/**
 * Konversi Titik Tutupan Local Grid (Easting, Northing) ke UTM 50S (x3, y3)
 */
function tutupanToUtm50s(easting, northing) {
  const { rot, dx, dy, sf, ox, oy, olocx, olocy } = TUTUPAN_PARAMS;
  const x1 = (easting - olocx) / sf + olocx;
  const y1 = (northing - olocy) / sf + olocy;
  const x2 = x1 - dx;
  const y2 = y1 - dy;

  const rad = (-rot * Math.PI) / 180;
  const cosRad = Math.cos(rad);
  const sinRad = Math.sin(rad);

  const x3 = (x2 - ox) * cosRad - (y2 - oy) * sinRad + ox;
  const y3 = (y2 - oy) * cosRad + (x2 - ox) * sinRad + oy;

  return [x3, y3];
}

/**
 * Konversi Titik Tutupan Local Grid ke WGS84 Geografis [Longitude, Latitude]
 */
function tutupanToWgs84(easting, northing) {
  const [x3, y3] = tutupanToUtm50s(easting, northing);
  if (typeof proj4 !== 'undefined') {
    const [lon, lat] = proj4('EPSG:32750', 'EPSG:4326', [x3, y3]);
    return [lon, lat];
  }
  return utm50sToWgs84Math(x3, y3);
}

/**
 * Fallback konversi matematis UTM 50S ke WGS84 (Southern Hemisphere)
 */
function utm50sToWgs84Math(x3, y3) {
  const a = 6378137.0;
  const f = 1 / 298.257223563;
  const b = a * (1 - f);
  const e = Math.sqrt(1 - (b / a) ** 2);
  const e_prime_sq = (e ** 2) / (1 - e ** 2);
  const k0 = 0.9996;

  const x = x3 - 500000.0;
  const y = y3 - 10000000.0;

  const M = y / k0;
  const mu = M / (a * (1 - e ** 2 / 4 - 3 * e ** 4 / 64 - 5 * e ** 6 / 256));
  const e1 = (1 - Math.sqrt(1 - e ** 2)) / (1 + Math.sqrt(1 - e ** 2));

  const phi1 = mu +
    (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu) +
    (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu) +
    (151 * e1 ** 3 / 96) * Math.sin(6 * mu);

  const N1 = a / Math.sqrt(1 - e ** 2 * Math.sin(phi1) ** 2);
  const T1 = Math.tan(phi1) ** 2;
  const C1 = e_prime_sq * Math.cos(phi1) ** 2;
  const R1 = a * (1 - e ** 2) / ((1 - e ** 2 * Math.sin(phi1) ** 2) ** 1.5);
  const D = x / (N1 * k0);

  const lat = phi1 - (N1 * Math.tan(phi1) / R1) * (
    D ** 2 / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1 ** 2 - 9 * e_prime_sq) * D ** 4 / 24
  );
  const lon = (117.0 * Math.PI / 180.0) + (
    D - (1 + 2 * T1 + C1) * D ** 3 / 6 +
    (5 - 2 * C1 + 28 * T1 - 3 * C1 ** 2 + 8 * e_prime_sq + 24 * T1 ** 2) * D ** 5 / 120
  ) / Math.cos(phi1);

  return [lon * 180 / Math.PI, lat * 180 / Math.PI];
}

// ==================== 2. WKT SERIALIZER & PARSER ====================

/**
 * Mengonversi array koordinat [lon, lat] menjadi format WKT POLYGON
 */
function coordsToWktPolygon(coords) {
  if (!coords || coords.length < 3) return '';
  const ring = [...coords];
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (Math.abs(first[0] - last[0]) > 1e-7 || Math.abs(first[1] - last[1]) > 1e-7) {
    ring.push([first[0], first[1]]);
  }
  const pts = ring.map(([lon, lat]) => `${Number(lon).toFixed(7)} ${Number(lat).toFixed(7)}`).join(', ');
  return `POLYGON((${pts}))`;
}

/**
 * Membaca format WKT POLYGON menjadi array koordinat [[lon, lat], ...]
 */
function parseWktPolygon(wkt) {
  if (!wkt || typeof wkt !== 'string') return null;
  const match = wkt.match(/POLYGON\s*\(\(\s*(.*?)\s*\)\)/i);
  if (!match) return null;
  const pairs = match[1].split(',');
  const coords = [];
  pairs.forEach(pair => {
    const parts = pair.trim().split(/\s+/);
    if (parts.length >= 2) {
      const lon = parseFloat(parts[0]);
      const lat = parseFloat(parts[1]);
      if (!isNaN(lon) && !isNaN(lat)) {
        coords.push([lon, lat]);
      }
    }
  });
  return coords.length >= 3 ? coords : null;
}

/**
 * Menghitung titik tengah (centroid) dari array koordinat [lon, lat]
 */
function calculatePolygonCentroid(coords) {
  if (!coords || coords.length === 0) return { lat: 0, lng: 0 };
  let sumLat = 0;
  let sumLon = 0;
  const n = coords.length;
  coords.forEach(([lon, lat]) => {
    sumLon += lon;
    sumLat += lat;
  });
  return {
    lat: Number((sumLat / n).toFixed(7)),
    lng: Number((sumLon / n).toFixed(7))
  };
}

// ==================== 3. KONFIGURASI BUFFER KONSENTRIS PER KONTRAKTOR ====================

const CONTRACTOR_BUFFER_CONFIGS = {
  'PT BUMA': [
    { dist: 500, color: '#dc2626', label: 'Jarak Aman Manusia (500m)', fillOpacity: 0.08, dash: '4, 4' },
    { dist: 200, color: '#ea580c', label: 'Jarak Aman Alat (200m)', fillOpacity: 0.14, dash: null }
  ],
  'PT SIS': [
    { dist: 500, color: '#dc2626', label: 'Jarak Aman Manusia (500m)', fillOpacity: 0.06, dash: '4, 4' },
    { dist: 300, color: '#eab308', label: 'Jarak Aman Unit Support (300m)', fillOpacity: 0.09, dash: '3, 3' },
    { dist: 150, color: '#f97316', label: 'Jarak Aman Alat tanpa Pelindung (150m)', fillOpacity: 0.12, dash: null },
    { dist: 100, color: '#16a34a', label: 'Jarak Aman Alat dengan Pelindung (100m)', fillOpacity: 0.15, dash: null }
  ]
};

function getContractorBufferConfig(contractorName) {
  const norm = String(contractorName || '').toUpperCase();
  if (norm.includes('BUMA')) {
    return CONTRACTOR_BUFFER_CONFIGS['PT BUMA'];
  }
  return CONTRACTOR_BUFFER_CONFIGS['PT SIS'];
}

function normalizeContractorStandard(name) {
  const norm = String(name || '').toUpperCase();
  if (norm.includes('BUMA')) return 'PT BUMA';
  return 'PT SIS';
}

function getActiveContractor() {
  if (typeof currentUser !== 'undefined' && currentUser && currentUser.company) {
    const comp = currentUser.company.toUpperCase();
    if (comp.includes('BUMA')) return 'PT BUMA';
    if (comp.includes('SIS')) return 'PT SIS';
  }
  const sel = document.getElementById('input_kontraktor_select');
  if (sel && sel.value) {
    return normalizeContractorStandard(sel.value);
  }
  return 'PT SIS';
}

// ==================== 4. EKSTRAKSI FILE DXF & REKOGNISI POLIGON ====================

/**
 * Ekstraksi file DXF khusus boundary peledakan:
 * 1. Mendukung format LWPOLYLINE & POLYLINE (AutoCAD R12-2018).
 * 2. Mengabaikan layer radius / bendera pra-eksisting (BENDERA, RADIUS, FLAG, BUFFER).
 * 3. Logika Filter Blasting vs Blocker:
 *    - Blasting boundary asli adalah poligon ireguler dengan jumlah titik 5 s/d 80.
 *    - Blocker marka rambu memiliki tepat 4 titik (kotak berulang).
 *    - Blocker radius clearance memiliki 145 titik (lingkaran berulang).
 *    - Luas poligon blasting minimal 300 m2.
 * 4. Deteksi otomatis kontraktor pemilik file (PT BUMA / PT SIS).
 * 5. Transformasi Tutupan Local Grid ke WGS84 & serialisasi WKT.
 */
function parseDxfBlastingBoundaries(fileContent, fileName = 'boundaries.dxf', forceContractor = null) {
  if (typeof DxfParser === 'undefined' && typeof window.DxfParser === 'undefined') {
    throw new Error('DxfParser library belum termuat. Pastikan js/libs/dxf-parser.min.js aktif.');
  }

  const ParserClass = typeof DxfParser !== 'undefined' ? DxfParser : window.DxfParser;
  const parser = new ParserClass();
  let dxfData;
  try {
    dxfData = parser.parseSync(fileContent);
  } catch (err) {
    throw new Error('Gagal membaca format DXF: ' + (err.message || 'File tidak valid'));
  }

  if (!dxfData || !dxfData.entities || dxfData.entities.length === 0) {
    throw new Error('Tidak ditemukan boundaries dalam file DXF ini.');
  }

  // 1. Tentukan Kontraktor Mitra Kerja
  let targetContractor = forceContractor;
  if (!targetContractor) {
    const fn = fileName.toLowerCase();
    if (fn.includes('buma')) {
      targetContractor = 'PT BUMA';
    } else if (fn.includes('sis')) {
      targetContractor = 'PT SIS';
    } else {
      targetContractor = getActiveContractor();
    }
  }

  // 2. Kumpulkan Kandidat Poligon dari Semua Layer Valid
  const rawCandidates = [];

  dxfData.entities.forEach((ent, idx) => {
    if (ent.type !== 'LWPOLYLINE' && ent.type !== 'POLYLINE') {
      return;
    }

    const entLayer = String(ent.layer || '0').trim();
    const upLayer = entLayer.toUpperCase();

    // Saring keluar layer bendera / radius pra-eksisting
    if (upLayer.includes('BENDERA') || upLayer.includes('RADIUS') || upLayer.includes('FLAG') || upLayer.includes('BUFFER')) {
      return;
    }

    if (!ent.vertices || ent.vertices.length < 3) {
      return;
    }

    // Bersihkan titik duplikat berurutan
    const cleanPts = [];
    ent.vertices.forEach(v => {
      if (typeof v.x === 'number' && typeof v.y === 'number' && !isNaN(v.x) && !isNaN(v.y)) {
        if (cleanPts.length === 0 ||
            Math.abs(v.x - cleanPts[cleanPts.length - 1][0]) > 0.001 ||
            Math.abs(v.y - cleanPts[cleanPts.length - 1][1]) > 0.001) {
          cleanPts.push([v.x, v.y]);
        }
      }
    });

    // Lepas titik penutup jika sama dengan titik pertama untuk menghitung vertex unik
    if (cleanPts.length > 1 &&
        Math.abs(cleanPts[0][0] - cleanPts[cleanPts.length - 1][0]) < 0.001 &&
        Math.abs(cleanPts[0][1] - cleanPts[cleanPts.length - 1][1]) < 0.001) {
      cleanPts.pop();
    }

    const vCount = cleanPts.length;

    // PATTERN FILTER:
    // Blasting area: poligon ireguler dengan 5 s/d 80 titik
    // Blocker box: 4 titik (diabaikan)
    // Blocker radius circle: 145 titik (diabaikan)
    if (vCount < 5 || vCount > 80) {
      return;
    }

    // Hitung Luas Poligon (Shoelace Formula)
    let area = 0.0;
    for (let i = 0; i < vCount; i++) {
      const next = (i + 1) % vCount;
      area += cleanPts[i][0] * cleanPts[next][1] - cleanPts[next][0] * cleanPts[i][1];
    }
    area = Math.abs(area) / 2.0;

    // Filter luas minimal area blasting (300 m2)
    if (area < 300.0) {
      return;
    }

    const xs = cleanPts.map(p => p[0]);
    const ys = cleanPts.map(p => p[1]);
    const width = Math.max(...xs) - Math.min(...xs);
    const height = Math.max(...ys) - Math.min(...ys);

    rawCandidates.push({
      originalIndex: idx,
      handle: ent.handle || `h_${idx}`,
      layer: entLayer,
      type: ent.type,
      vCount: vCount,
      area: area,
      width: width,
      height: height,
      localPts: cleanPts
    });
  });

  // 3. Filter Duplikasi Simbol Rambu Blocker yang Berulang Identik (> 2 kali kemunculan)
  const shapeKeyCounts = {};
  rawCandidates.forEach(c => {
    const key = `${c.vCount}_${Math.round(c.area)}_${Math.round(c.width)}_${Math.round(c.height)}`;
    shapeKeyCounts[key] = (shapeKeyCounts[key] || 0) + 1;
  });

  const filteredCandidates = rawCandidates.filter(c => {
    const key = `${c.vCount}_${Math.round(c.area)}_${Math.round(c.width)}_${Math.round(c.height)}`;
    return shapeKeyCounts[key] <= 2;
  });

  // 4. Reproyeksi Tutupan -> WGS84 & Serialisasi WKT Polygon
  const extractedBoundaries = filteredCandidates.map((cand, idx) => {
    const closedLocal = [...cand.localPts, cand.localPts[0]];
    const wgsCoords = closedLocal.map(([x, y]) => tutupanToWgs84(x, y));
    const centroid = calculatePolygonCentroid(wgsCoords);
    const wkt = coordsToWktPolygon(wgsCoords);

    return {
      id: `bound_${Date.now()}_${idx}`,
      index: idx + 1,
      handle: cand.handle,
      layer: cand.layer,
      vertexCount: cand.vCount,
      area: Math.round(cand.area),
      coords: wgsCoords,
      centroid: centroid,
      wkt: wkt,
      name: '',
      kontraktor: targetContractor,
      linkedPlanUuid: '' // ID plan eksisting jika ditautkan (skenario nyusul/revisi)
    };
  });

  return {
    fileName,
    detectedContractor: targetContractor,
    boundaries: extractedBoundaries
  };
}

// ==================== 5. PENYIMPANAN LOKAL & TTL 24 JAM ====================

const STORAGE_KEY_BOUNDARIES = 'blasting_active_boundaries_v2';
const BOUNDARY_TTL_MS = 24 * 60 * 60 * 1000; // 24 Jam

function saveLocalBoundaries(boundaries, fileName = '', contractor = 'PT SIS', targetDate = null) {
  const chosenDate = targetDate || document.getElementById('input_tanggal')?.value || (typeof getWitaDateString === 'function' ? getWitaDateString() : new Date().toISOString().slice(0, 10));
  const payload = {
    timestamp: Date.now(),
    date: chosenDate,
    kontraktor: normalizeContractorStandard(contractor),
    fileName: fileName,
    boundaries: boundaries
  };
  localStorage.setItem(STORAGE_KEY_BOUNDARIES, JSON.stringify(payload));
  updateBoundaryUIState();
}

function getValidLocalBoundaries() {
  const raw = localStorage.getItem(STORAGE_KEY_BOUNDARIES);
  if (!raw) return [];
  try {
    const data = JSON.parse(raw);
    const now = Date.now();
    if (now - (data.timestamp || 0) > BOUNDARY_TTL_MS) {
      localStorage.removeItem(STORAGE_KEY_BOUNDARIES);
      updateBoundaryUIState();
      return [];
    }
    return data.boundaries || [];
  } catch (e) {
    console.warn('Gagal membaca cache boundary lokal:', e);
    return [];
  }
}

function getLocalBoundaryMetadata() {
  const raw = localStorage.getItem(STORAGE_KEY_BOUNDARIES);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    const now = Date.now();
    if (now - (data.timestamp || 0) > BOUNDARY_TTL_MS) {
      localStorage.removeItem(STORAGE_KEY_BOUNDARIES);
      return null;
    }
    return data;
  } catch (e) {
    return null;
  }
}

function hasValidLocalBoundaries() {
  const list = getValidLocalBoundaries();
  return Array.isArray(list) && list.length > 0;
}

function clearLocalBoundaries() {
  localStorage.removeItem(STORAGE_KEY_BOUNDARIES);
  updateBoundaryUIState();
}

function findBoundaryByName(name) {
  if (!name) return null;
  const list = getValidLocalBoundaries();
  const cleanTarget = String(name).trim().toLowerCase();
  return list.find(b => String(b.name || '').trim().toLowerCase() === cleanTarget) || null;
}

function getAllocatedBoundaryNames(targetDate, excludePlanUuid = null) {
  const normDate = targetDate || document.getElementById('input_tanggal')?.value || (typeof getWitaDateString === 'function' ? getWitaDateString() : '');
  const allocated = new Set();

  const sourceData = (typeof rawGlobalPlanData !== 'undefined' && Array.isArray(rawGlobalPlanData) && rawGlobalPlanData.length > 0)
    ? rawGlobalPlanData
    : ((typeof globalPlanData !== 'undefined' && Array.isArray(globalPlanData)) ? globalPlanData : []);

  sourceData.forEach(p => {
    const rawDate = (typeof getValFlexible === 'function') ? (getValFlexible(p, 'tanggal', 'date', 'tgl') || p.tanggal) : p.tanggal;
    const pDate = (typeof normalizeDateToYYYYMMDD === 'function') ? normalizeDateToYYYYMMDD(rawDate) : String(rawDate).slice(0, 10);

    if (pDate === normDate) {
      const pUuid = String(p.uuid || p.id || '');
      if (!excludePlanUuid || pUuid !== String(excludePlanUuid)) {
        const locName = String(p.lokasi || '').trim().toLowerCase();
        if (locName) {
          allocated.add(locName);
        }
      }
    }
  });

  return allocated;
}

// ==================== 6. MODAL PREVIEW, PENAMAAN & PENAUTAN (LINKING/REVISI) ====================

let previewMapInstance = null;
let previewPolygonsLayer = null;
let previewBuffersLayer = null;
let tempParsedBoundaries = [];
let tempParsedContractor = 'PT SIS';
let targetLinkPlanUuid = null; // Disimpan saat user klik '+DXF' langsung dari baris tabel plan

function openDxfUploadModal() {
  const modal = document.getElementById('modal-dxf-flow');
  if (!modal) return;

  document.getElementById('dxf-step-upload').classList.remove('hidden');
  document.getElementById('dxf-step-preview').classList.add('hidden');
  const fileInput = document.getElementById('dxf-file-input');
  if (fileInput) fileInput.value = '';

  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

/**
 * Membuka modal DXF yang diarahkan khusus untuk plan tertentu (Kasus: DXF Nyusul / Revisi)
 */
function openDxfUploadModalForPlan(planUuid) {
  targetLinkPlanUuid = planUuid;
  openDxfUploadModal();
}
window.openDxfUploadModalForPlan = openDxfUploadModalForPlan;

function closeDxfUploadModal() {
  const modal = document.getElementById('modal-dxf-flow');
  if (modal) {
    modal.classList.remove('flex');
    modal.classList.add('hidden');
  }
  if (previewMapInstance) {
    previewMapInstance.remove();
    previewMapInstance = null;
    previewPolygonsLayer = null;
    previewBuffersLayer = null;
  }
  tempParsedBoundaries = [];
  targetLinkPlanUuid = null;
}

function handleDxfFileSelect(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  processDxfFileObject(file);
}

function processDxfFileObject(file) {
  if (!file.name.toLowerCase().endsWith('.dxf')) {
    Swal.fire({
      icon: 'error',
      title: 'Format Salah',
      text: 'File yang diunggah harus berformat AutoCAD DXF (.dxf)'
    });
    return;
  }

  showGlobalLoading();
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const content = e.target.result;
      const res = parseDxfBlastingBoundaries(content, file.name);

      if (!res.boundaries || res.boundaries.length === 0) {
        hideGlobalLoading();
        Swal.fire({
          icon: 'warning',
          title: 'Tidak Ada Boundary Peledakan',
          text: 'Tidak ditemukan poligon boundary peledakan valid dalam file DXF ini. Pastikan file memuat poligon rencana peledakan.'
        });
        return;
      }

      tempParsedBoundaries = res.boundaries;
      tempParsedContractor = res.detectedContractor;

      hideGlobalLoading();
      renderDxfPreviewStep(file.name, res.detectedContractor);
    } catch (err) {
      hideGlobalLoading();
      console.error('Error parsing DXF:', err);
      Swal.fire({
        icon: 'error',
        title: 'Gagal Memproses DXF',
        text: err.message || 'Terjadi kesalahan saat mengekstrak poligon DXF.'
      });
    }
  };
  reader.onerror = function() {
    hideGlobalLoading();
    Swal.fire({ icon: 'error', title: 'Gagal Membaca File', text: 'Tidak dapat membaca file dari perangkat Anda.' });
  };
  reader.readAsText(file);
}

/**
 * Menampilkan Step 2: Preview Peta & Input Penamaan Boundary (Plus Fitur Tautkan ke Plan Nyusul / Revisi)
 */
function renderDxfPreviewStep(fileName, contractorName) {
  document.getElementById('dxf-step-upload').classList.add('hidden');
  document.getElementById('dxf-step-preview').classList.remove('hidden');

  const activeDate = document.getElementById('input_tanggal')?.value || (typeof getWitaDateString === 'function' ? getWitaDateString() : '');
  
  // Ambil daftar plan yang sudah ada di database untuk tanggal ini
  const existingPlansForDate = (typeof rawGlobalPlanData !== 'undefined' && Array.isArray(rawGlobalPlanData))
    ? rawGlobalPlanData.filter(p => {
        const d = (typeof normalizeDateToYYYYMMDD === 'function') ? normalizeDateToYYYYMMDD(p.tanggal) : String(p.tanggal || '').slice(0, 10);
        return d === activeDate;
      })
    : [];

  const titleEl = document.getElementById('dxf-preview-filename');
  if (titleEl) {
    titleEl.innerHTML = `
      <div class="flex items-center gap-2 flex-wrap">
        <span class="font-extrabold text-slate-900">${escapeXmlAttr(fileName)}</span>
        <span class="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${contractorName.includes('BUMA') ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-blue-100 text-blue-800 border border-blue-300'}">
          ${escapeXmlAttr(contractorName)}
        </span>
        <span class="text-xs text-slate-500 font-bold">(${tempParsedBoundaries.length} Boundary Terdeteksi)</span>
        ${existingPlansForDate.length > 0 ? `<span class="text-[10px] bg-amber-50 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full font-bold">Terdeteksi ${existingPlansForDate.length} Plan di Database (${activeDate})</span>` : ''}
      </div>
    `;
  }

  // Auto-Match cerdas: jika ada boundary yang namanya atau indexnya cocok dengan plan, atau ada targetLinkPlanUuid
  tempParsedBoundaries.forEach((b, idx) => {
    if (targetLinkPlanUuid && idx === 0) {
      b.linkedPlanUuid = targetLinkPlanUuid;
      const targetPlan = existingPlansForDate.find(p => String(p.uuid || p.id) === String(targetLinkPlanUuid));
      if (targetPlan && !b.name) {
        b.name = targetPlan.lokasi || '';
      }
    }
  });

  // Render Tabel Form Penamaan & Penautan Plan
  const tbody = document.getElementById('dxf-preview-tbody');
  if (tbody) {
    let html = '';
    tempParsedBoundaries.forEach((b, idx) => {
      // Opsi select plan eksisting untuk skenario DXF Nyusul atau Revisi
      let planOptions = `<option value="">-- Boundary Baru (Tanpa Tautan) --</option>`;
      existingPlansForDate.forEach(plan => {
        const planId = plan.uuid || plan.id || '';
        const isMatched = (b.linkedPlanUuid && String(b.linkedPlanUuid) === String(planId)) ||
                          (b.name && String(plan.lokasi || '').trim().toLowerCase() === String(b.name).trim().toLowerCase());
        
        if (isMatched && !b.linkedPlanUuid) {
          b.linkedPlanUuid = planId;
          if (!b.name) b.name = plan.lokasi || '';
        }

        const isSelected = (String(b.linkedPlanUuid) === String(planId));
        planOptions += `<option value="${escapeXmlAttr(planId)}" ${isSelected ? 'selected' : ''}>[${escapeXmlAttr(planId)}] ${escapeXmlAttr(plan.lokasi || 'Tanpa Nama')} (${plan.jumlah_holes || 0} holes)</option>`;
      });

      html += `
        <tr id="row-dxf-bound-${idx}" class="hover:bg-slate-50 border-b border-slate-200 transition">
          <td class="p-2 text-center font-bold">
            <span class="w-6 h-6 rounded-full bg-red-600 text-white inline-flex items-center justify-center text-xs font-black shadow-xs">
              ${idx + 1}
            </span>
          </td>
          <td class="p-2 font-mono text-[11px] text-slate-600">
            <div class="font-bold text-slate-800">${b.handle}</div>
            <div class="text-[9.5px] text-slate-500">${b.vertexCount} titik • ${b.area ? b.area.toLocaleString('id-ID') : 0} m²</div>
          </td>
          <td class="p-2">
            <input type="text" id="input-dxf-name-${idx}"
              value="${escapeXmlAttr(b.name || '')}"
              oninput="handleDxfNameInput(${idx}, this.value)"
              placeholder="Nama Lokasi Blasting (mis: PIT 1 WEST)..."
              class="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600">
          </td>
          <td class="p-2">
            <select id="select-dxf-link-${idx}"
              onchange="handleDxfPlanLinkChange(${idx}, this.value)"
              class="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-[11px] font-bold text-slate-800 focus:outline-none focus:border-red-600">
              ${planOptions}
            </select>
          </td>
          <td class="p-2 text-center">
            <button type="button" onclick="focusPreviewPolygon(${idx})"
              class="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition flex items-center gap-1 mx-auto"
              title="Zoom ke polygon di peta">
              <i class="ph-bold ph-magnifying-glass-plus"></i> Lihat
            </button>
          </td>
        </tr>
      `;
    });
    tbody.innerHTML = html;
  }

  updateDxfSaveButtonState();

  setTimeout(() => {
    initDxfPreviewMap();
  }, 100);
}

function handleDxfPlanLinkChange(index, selectedPlanUuid) {
  if (tempParsedBoundaries[index]) {
    tempParsedBoundaries[index].linkedPlanUuid = selectedPlanUuid;
    // Jika user memilih plan, otomatis isi nama boundary jika masih kosong
    if (selectedPlanUuid) {
      const activeDate = document.getElementById('input_tanggal')?.value || '';
      const source = (typeof rawGlobalPlanData !== 'undefined' && Array.isArray(rawGlobalPlanData)) ? rawGlobalPlanData : [];
      const plan = source.find(p => String(p.uuid || p.id) === String(selectedPlanUuid));
      if (plan && plan.lokasi) {
        const inputName = document.getElementById(`input-dxf-name-${index}`);
        if (inputName) {
          inputName.value = plan.lokasi;
          tempParsedBoundaries[index].name = plan.lokasi;
        }
      }
    }
  }
  updateDxfSaveButtonState();
}

function initDxfPreviewMap() {
  const container = document.getElementById('dxfPreviewMapContainer');
  if (!container) return;

  if (previewMapInstance) {
    previewMapInstance.remove();
    previewMapInstance = null;
  }

  previewMapInstance = L.map('dxfPreviewMapContainer', {
    zoomControl: true,
    attributionControl: false
  });

  L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
  }).addTo(previewMapInstance);

  previewBuffersLayer = L.featureGroup().addTo(previewMapInstance);
  previewPolygonsLayer = L.featureGroup().addTo(previewMapInstance);

  const bufferConfigs = getContractorBufferConfig(tempParsedContractor);

  tempParsedBoundaries.forEach((b, idx) => {
    const latlngs = b.coords.map(([lon, lat]) => [lat, lon]);

    if (typeof turf !== 'undefined') {
      try {
        const ring = [...b.coords];
        if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) {
          ring.push([ring[0][0], ring[0][1]]);
        }
        const geojsonPoly = {
          type: 'Feature',
          properties: {},
          geometry: { type: 'Polygon', coordinates: [ring] }
        };

        bufferConfigs.forEach(cfg => {
          const buf = turf.buffer(geojsonPoly, cfg.dist, { units: 'meters' });
          if (buf && buf.geometry && buf.geometry.coordinates) {
            const coordsArray = buf.geometry.type === 'MultiPolygon'
              ? buf.geometry.coordinates[0][0]
              : buf.geometry.coordinates[0];

            if (Array.isArray(coordsArray) && coordsArray.length > 0) {
              const bufLatLngs = coordsArray.map(([bLon, bLat]) => [bLat, bLon]);
              const bufPoly = L.polygon(bufLatLngs, {
                color: cfg.color,
                weight: 1.5,
                dashArray: cfg.dash || null,
                opacity: 0.8,
                fillColor: cfg.color,
                fillOpacity: cfg.fillOpacity || 0.1,
                interactive: true
              });

              bufPoly.bindTooltip(`
                <span class="font-sans text-[10px] font-bold text-slate-800">
                  Boundary #${idx + 1}: ${cfg.label}
                </span>
              `, { sticky: true });

              previewBuffersLayer.addLayer(bufPoly);
            }
          }
        });
      } catch (bufErr) {
        console.warn('Preview buffer error:', bufErr);
      }
    }

    const poly = L.polygon(latlngs, {
      color: '#dc2626',
      weight: 2.5,
      opacity: 0.95,
      fillColor: '#ef4444',
      fillOpacity: 0.35
    });

    poly.bindTooltip(`
      <div class="font-sans text-xs font-black text-red-600">
        Boundary #${idx + 1}
      </div>
    `, { direction: 'center', permanent: true, className: 'bg-white/95 px-1.5 py-0.5 rounded shadow text-xs font-black border border-red-500' });

    poly.on('click', () => {
      focusPreviewRow(idx);
    });

    b._leafletLayer = poly;
    previewPolygonsLayer.addLayer(poly);
  });

  if (previewPolygonsLayer.getLayers().length > 0) {
    previewMapInstance.fitBounds(previewPolygonsLayer.getBounds(), { padding: [30, 30], maxZoom: 16 });
  }

  setTimeout(() => {
    if (previewMapInstance) previewMapInstance.invalidateSize();
  }, 200);
}

function handleDxfNameInput(index, value) {
  if (tempParsedBoundaries[index]) {
    tempParsedBoundaries[index].name = value.trim();
  }
  updateDxfSaveButtonState();
}

function updateDxfSaveButtonState() {
  const btn = document.getElementById('btn-save-dxf-boundaries');
  const countTag = document.getElementById('dxf-named-count-tag');

  const total = tempParsedBoundaries.length;
  const namedList = tempParsedBoundaries.filter(b => b.name && b.name.trim().length > 0);
  const namedCount = namedList.length;

  if (countTag) {
    countTag.innerText = `${namedCount} dari ${total} Boundary Telah Dinamai`;
  }

  if (btn) {
    if (namedCount === total && total > 0) {
      btn.disabled = false;
      btn.classList.remove('opacity-50', 'cursor-not-allowed');
      btn.classList.add('hover:bg-red-700', 'shadow-md');
    } else {
      btn.disabled = true;
      btn.classList.add('opacity-50', 'cursor-not-allowed');
      btn.classList.remove('hover:bg-red-700', 'shadow-md');
    }
  }
}

function focusPreviewPolygon(index) {
  const b = tempParsedBoundaries[index];
  if (b && b._leafletLayer && previewMapInstance) {
    previewMapInstance.fitBounds(b._leafletLayer.getBounds(), { padding: [50, 50], maxZoom: 17 });
    b._leafletLayer.setStyle({ color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.6 });
    setTimeout(() => {
      b._leafletLayer.setStyle({ color: '#dc2626', fillColor: '#ef4444', fillOpacity: 0.35 });
    }, 1500);
  }
}

function focusPreviewRow(index) {
  const input = document.getElementById(`input-dxf-name-${index}`);
  const row = document.getElementById(`row-dxf-bound-${index}`);
  if (input) {
    input.focus();
    input.select();
  }
  if (row) {
    row.classList.add('bg-red-50');
    setTimeout(() => {
      row.classList.remove('bg-red-50');
    }, 1500);
    row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

/**
 * Menyimpan hasil ekstraksi boundary ke localStorage dan men-sinkronisasi ke Plan eksisting jika ditautkan
 */
async function confirmSaveDxfBoundaries() {
  const unnamed = tempParsedBoundaries.filter(b => !b.name || b.name.trim().length === 0);
  if (unnamed.length > 0) {
    Swal.fire({
      icon: 'warning',
      title: 'Nama Belum Lengkap',
      text: `Masih ada ${unnamed.length} boundary yang belum diberi nama. Harap lengkapi semua nama boundary sebelum menyimpan.`
    });
    return;
  }

  // Cek duplikasi nama boundary di dalam list upload
  const seenNames = new Set();
  for (const b of tempParsedBoundaries) {
    const norm = b.name.trim().toLowerCase();
    if (seenNames.has(norm)) {
      Swal.fire({
        icon: 'warning',
        title: 'Nama Boundary Duplikat',
        text: `Nama "${b.name}" digunakan lebih dari 1 kali. Setiap boundary harus memiliki nama unik agar alokasi 1:1 berjalan akurat.`
      });
      return;
    }
    seenNames.add(norm);
  }

  const cleanList = tempParsedBoundaries.map(b => ({
    id: b.id,
    index: b.index,
    name: b.name.trim(),
    handle: b.handle,
    layer: b.layer,
    vertexCount: b.vertexCount,
    area: b.area,
    coords: b.coords,
    centroid: b.centroid,
    wkt: b.wkt,
    kontraktor: tempParsedContractor,
    linkedPlanUuid: b.linkedPlanUuid || '',
    timestamp: Date.now()
  }));

  const activeDate = document.getElementById('input_tanggal')?.value || (typeof getWitaDateString === 'function' ? getWitaDateString() : '');
  const fileName = document.getElementById('dxf-preview-filename')?.innerText || 'boundaries.dxf';

  saveLocalBoundaries(cleanList, fileName, tempParsedContractor, activeDate);

  // Skenario DXF Nyusul & Revisi: Jika ada boundary yang ditautkan ke plan eksisting, update langsung ke server Google Apps Script!
  const linkedItems = cleanList.filter(b => b.linkedPlanUuid);
  let updatedCount = 0;

  if (linkedItems.length > 0) {
    showGlobalLoading();
    try {
      const sourcePlans = (typeof rawGlobalPlanData !== 'undefined' && Array.isArray(rawGlobalPlanData)) ? rawGlobalPlanData : [];
      for (const item of linkedItems) {
        const plan = sourcePlans.find(p => String(p.uuid || p.id) === String(item.linkedPlanUuid));
        if (plan) {
          const updatePayload = {
            ...plan,
            uuid: plan.uuid || plan.id,
            id: plan.uuid || plan.id,
            lokasi: item.name,
            geometry: item.wkt,
            latitude: item.centroid.lat,
            longitude: item.centroid.lng
          };

          const res = await apiCall('savePlan', {
            data: updatePayload,
            role: 'ADMIN',
            company: tempParsedContractor || plan.kontraktor
          });

          if (res && res.success) {
            updatedCount++;
          }
        }
      }
    } catch (err) {
      console.warn('Gagal sinkronisasi link boundary ke database:', err);
    } finally {
      hideGlobalLoading();
    }
  }

  closeDxfUploadModal();

  let successMsg = `${cleanList.length} boundary peledakan (${tempParsedContractor}) aktif untuk tanggal ${activeDate}.`;
  if (updatedCount > 0) {
    successMsg += ` Sebanyak ${updatedCount} rencana peledakan di database telah otomatis diperbarui koordinat poligon & buffernya!`;
  }

  Swal.fire({
    icon: 'success',
    title: 'Boundary Berhasil Disimpan!',
    text: successMsg,
    timer: 2500,
    showConfirmButton: false
  });

  if (updatedCount > 0 && typeof refreshData === 'function') {
    refreshData(false);
  } else {
    updateBoundaryUIState();
  }
}

// ==================== 7. INTEGRASI WORKFLOW FORM & TOGGLE MODE LOKASI ====================

let isManualLokasiMode = false;

/**
 * Toggle antara Mode Pilih dari Boundary DXF dan Mode Ketik Lokasi Manual
 */
function toggleLokasiInputMode(forceMode) {
  if (forceMode !== undefined) {
    isManualLokasiMode = !!forceMode;
  } else {
    isManualLokasiMode = !isManualLokasiMode;
  }

  const containerSelect = document.getElementById('container-lokasi-select');
  const containerManual = document.getElementById('container-lokasi-manual');
  const labelToggle = document.getElementById('label-toggle-lokasi-mode');
  const inputHidden = document.getElementById('input_lokasi');
  const inputGeom = document.getElementById('input_geometry');
  const badgeInfo = document.getElementById('selected-boundary-info-badge');

  if (isManualLokasiMode) {
    if (containerSelect) containerSelect.classList.add('hidden');
    if (containerManual) containerManual.classList.remove('hidden');
    if (labelToggle) labelToggle.innerText = 'Pilih dari DXF';
    const manualInput = document.getElementById('input_lokasi_manual');
    if (manualInput) {
      if (!manualInput.value && inputHidden && inputHidden.value) {
        manualInput.value = inputHidden.value;
      }
      if (inputHidden) inputHidden.value = manualInput.value || '';
      manualInput.focus();
    }
    if (inputGeom) inputGeom.value = '';
    if (badgeInfo) badgeInfo.classList.add('hidden');
  } else {
    if (containerSelect) containerSelect.classList.remove('hidden');
    if (containerManual) containerManual.classList.add('hidden');
    if (labelToggle) labelToggle.innerText = 'Ketik Manual';
    const selectEl = document.getElementById('input_lokasi_select');
    if (selectEl && selectEl.value) {
      handleBoundarySelectChange(selectEl.value);
    }
  }
}
window.toggleLokasiInputMode = toggleLokasiInputMode;

function handleManualLokasiInput(val) {
  const inputHidden = document.getElementById('input_lokasi');
  const inputGeom = document.getElementById('input_geometry');
  const badgeInfo = document.getElementById('selected-boundary-info-badge');
  if (inputHidden) inputHidden.value = String(val || '').trim();
  if (inputGeom) inputGeom.value = '';
  if (badgeInfo) badgeInfo.classList.add('hidden');
}
window.handleManualLokasiInput = handleManualLokasiInput;

/**
 * Memperbarui status UI secara fleksibel (form selalu terbuka, tidak dikunci)
 */
function updateBoundaryUIState() {
  const boundaries = getValidLocalBoundaries();
  const hasBoundaries = boundaries.length > 0;
  const targetDate = document.getElementById('input_tanggal')?.value || (typeof getWitaDateString === 'function' ? getWitaDateString() : '');

  // Pastikan wrapper form SELALU TERBUKA (fleksibel)
  const formFieldsWrapper = document.getElementById('kontraktor-form-fields-wrapper');
  if (formFieldsWrapper) {
    formFieldsWrapper.classList.remove('hidden');
  }

  const selectLokasi = document.getElementById('input_lokasi_select');
  const statusBanner = document.getElementById('dxf-boundary-status-banner');
  const bulkBtn = document.getElementById('btn-bulk-import-header');

  if (bulkBtn) {
    bulkBtn.classList.remove('opacity-50');
    bulkBtn.title = '';
  }

  const meta = getLocalBoundaryMetadata();
  const contractorName = meta ? meta.kontraktor : getActiveContractor();

  // Update Status Banner (Hijau jika ada DXF, Biru/Slate informatif jika belum ada DXF)
  if (statusBanner) {
    if (hasBoundaries) {
      statusBanner.className = 'mb-5 p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/90 text-emerald-950 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs';
      statusBanner.innerHTML = `
        <div class="flex items-center gap-2.5">
          <div class="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
            <i class="ph-bold ph-check"></i>
          </div>
          <div>
            <span class="font-extrabold tracking-wide uppercase text-[10px] text-emerald-800 block">
              DXF BOUNDARY AKTIF (${escapeXmlAttr(contractorName)})
            </span>
            <span class="font-bold text-slate-800">
              ${boundaries.length} boundary terdaftar untuk tanggal <span class="font-mono text-emerald-900">${escapeXmlAttr(targetDate)}</span>.
            </span>
          </div>
        </div>
        <button type="button" onclick="openDxfUploadModal()"
          class="px-3 py-1.5 bg-white hover:bg-emerald-100 text-emerald-800 font-bold rounded-lg border border-emerald-300 text-xs transition flex items-center gap-1.5 self-start sm:self-auto shadow-2xs cursor-pointer">
          <i class="ph-bold ph-pencil-simple"></i> Upload Ulang / Revisi DXF
        </button>
      `;
    } else {
      statusBanner.className = 'mb-5 p-3.5 rounded-xl border border-sky-200 bg-sky-50/80 text-sky-950 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs';
      statusBanner.innerHTML = `
        <div class="flex items-center gap-2.5">
          <div class="w-7 h-7 rounded-lg bg-sky-600 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
            <i class="ph-bold ph-info"></i>
          </div>
          <div>
            <span class="font-extrabold tracking-wide uppercase text-[10px] text-sky-800 block">
              DXF BELUM DIUNGGAH 
            </span>
            <span class="font-bold text-slate-800">
              File DXF dapat diunggah sebelum, sesudah, atau kapan saja.
            </span>
          </div>
        </div>
        <button type="button" onclick="openDxfUploadModal()"
          class="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-lg text-xs transition flex items-center gap-1.5 self-start sm:self-auto shadow-2xs cursor-pointer">
          <i class="ph-bold ph-upload-simple"></i> Upload File DXF (.dxf)
        </button>
      `;
    }
  }

  // Update Dropdown Lokasi jika ada boundary
  if (selectLokasi) {
    if (hasBoundaries) {
      const allocatedNames = getAllocatedBoundaryNames(targetDate, (typeof currentEditingItem !== 'undefined' && currentEditingItem) ? currentEditingItem.uuid : null);
      const currentValue = selectLokasi.value;

      let optHtml = '<option value="" disabled selected>-- Pilih Lokasi dari Boundary DXF --</option>';
      let availableCount = 0;

      boundaries.forEach(b => {
        const isAllocated = allocatedNames.has(String(b.name || '').trim().toLowerCase());
        const isCurrentlySelected = currentValue && (String(currentValue).trim().toLowerCase() === String(b.name).trim().toLowerCase());

        if (isAllocated && !isCurrentlySelected) {
          optHtml += `<option value="${escapeXmlAttr(b.name)}" disabled class="text-slate-400 bg-slate-100 italic">[TERPAKAI] ${escapeXmlAttr(b.name)} (#${b.index})</option>`;
        } else {
          availableCount++;
          optHtml += `<option value="${escapeXmlAttr(b.name)}" ${isCurrentlySelected ? 'selected' : ''}>${escapeXmlAttr(b.name)} (#${b.index} - ${b.vertexCount} pts)</option>`;
        }
      });

      selectLokasi.innerHTML = optHtml;
      selectLokasi.disabled = false;

      // Jika belum di mode manual, gunakan select
      if (!isManualLokasiMode) {
        toggleLokasiInputMode(false);
      }
    } else {
      selectLokasi.innerHTML = '<option value="" disabled selected>Belum ada DXF aktif</option>';
      selectLokasi.disabled = true;
      // Otomatis aktifkan mode manual jika belum ada DXF
      toggleLokasiInputMode(true);
    }
  }
}

function handleBoundarySelectChange(selectedName) {
  const bound = findBoundaryByName(selectedName);
  const inputHiddenLokasi = document.getElementById('input_lokasi');
  const inputGeometry = document.getElementById('input_geometry');
  const inputLat = document.getElementById('input_latitude');
  const inputLng = document.getElementById('input_longitude');
  const badgeInfo = document.getElementById('selected-boundary-info-badge');

  if (bound) {
    if (inputHiddenLokasi) inputHiddenLokasi.value = bound.name;
    if (inputGeometry) inputGeometry.value = bound.wkt;
    if (inputLat) inputLat.value = bound.centroid.lat;
    if (inputLng) inputLng.value = bound.centroid.lng;

    if (badgeInfo) {
      badgeInfo.classList.remove('hidden');
      badgeInfo.innerHTML = `
        <span class="text-emerald-700 font-bold flex items-center gap-1">
          <i class="ph-bold ph-check-circle"></i>
          Polygon Terpilih (#${bound.index}): ${bound.vertexCount} Titik Koordinat (${bound.kontraktor || 'Mitra'})
        </span>
        <span class="text-slate-400 font-mono text-[10px]">Centroid: ${bound.centroid.lat}, ${bound.centroid.lng}</span>
      `;
    }
  } else {
    if (inputHiddenLokasi) inputHiddenLokasi.value = selectedName || '';
    if (inputGeometry) inputGeometry.value = '';
    if (badgeInfo) badgeInfo.classList.add('hidden');
  }
}

function escapeXmlAttr(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    updateBoundaryUIState();
  }, 350);
});
