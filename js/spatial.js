/**
 * INTEGRATED BLASTING PLAN & DASHBOARD PLATFORM
 * Module: SPATIAL & DXF BOUNDARY ENGINE
 * 
 * Mengintegrasikan pemrosesan spasial:
 * 1. Transformasi Koordinat Tutupan Local Grid -> UTM 50S (EPSG:32750) -> WGS84 (EPSG:4326)
 * 2. Ekstraksi otomatis file DXF (LWPOLYLINE / POLYLINE to Polygon) dengan pattern filter:
 *    - Eliminasi boundary blocker (simbol kotak 4 titik & lingkaran radius 145 titik)
 *    - Eliminasi layer bendera / flag pra-eksisting (layer BENDERA)
 *    - Deteksi akurat area blasting ireguler (5 - 80 titik)
 * 3. Buffer konsentris spesifik per kontraktor:
 *    - PT BUMA (2 buffer): 200m (Jarak Aman Alat) & 500m (Jarak Aman Manusia)
 *    - PT SIS (4 buffer): 100m (Alat Berpelindung), 150m (Alat Tanpa Pelindung), 300m (Unit Support), 500m (Manusia)
 * 4. Kunci form pengisian (Tampilan awal hanya Tanggal & Upload DXF) sebelum boundary diunggah
 * 5. Alokasi 1:1 boundary peledakan (1 boundary hanya dapat digunakan oleh 1 plan)
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

/**
 * Konfigurasi radius keselamatan kerja peledakan:
 * - BUMA: 2 buffer (200m Jarak Aman Alat, 500m Jarak Aman Manusia)
 * - SIS: 4 buffer (100m Alat Berpelindung, 150m Alat Tanpa Pelindung, 300m Unit Support, 500m Manusia)
 */
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

/**
 * Mengambil konfigurasi buffer konsentris berdasarkan nama kontraktor
 */
function getContractorBufferConfig(contractorName) {
  const norm = String(contractorName || '').toUpperCase();
  if (norm.includes('BUMA')) {
    return CONTRACTOR_BUFFER_CONFIGS['PT BUMA'];
  }
  return CONTRACTOR_BUFFER_CONFIGS['PT SIS'];
}

/**
 * Normalisasi nama kontraktor ke standar 'PT SIS' atau 'PT BUMA'
 */
function normalizeContractorStandard(name) {
  const norm = String(name || '').toUpperCase();
  if (norm.includes('BUMA')) return 'PT BUMA';
  return 'PT SIS';
}

/**
 * Mendapatkan kontraktor aktif dari user login atau selector admin
 */
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
 * 2. Mengabaikan layer radius / bendera pra-eksisting (seperti BENDERA, RADIUS, FLAG).
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
    throw new Error('Tidak ditemukan entitas gambar dalam file DXF ini.');
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
      kontraktor: targetContractor
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

/**
 * Menyimpan daftar boundary aktif ke localStorage
 */
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

/**
 * Mengambil daftar boundary lokal yang masih valid (< 24 jam)
 */
function getValidLocalBoundaries() {
  const raw = localStorage.getItem(STORAGE_KEY_BOUNDARIES);
  if (!raw) return [];
  try {
    const data = JSON.parse(raw);
    const now = Date.now();
    // Auto-expiry jika sudah lebih dari 24 jam
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

/**
 * Mengambil payload lengkap metadata boundary lokal
 */
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

/**
 * Cek apakah sudah ada boundary aktif
 */
function hasValidLocalBoundaries() {
  const list = getValidLocalBoundaries();
  return Array.isArray(list) && list.length > 0;
}

/**
 * Menghapus boundary lokal
 */
function clearLocalBoundaries() {
  localStorage.removeItem(STORAGE_KEY_BOUNDARIES);
  updateBoundaryUIState();
}

/**
 * Mencari boundary berdasarkan nama lokasi (case-insensitive)
 */
function findBoundaryByName(name) {
  if (!name) return null;
  const list = getValidLocalBoundaries();
  const cleanTarget = String(name).trim().toLowerCase();
  return list.find(b => String(b.name || '').trim().toLowerCase() === cleanTarget) || null;
}

/**
 * Mendapatkan himpunan nama boundary yang sudah teralokasikan ke plan pada tanggal tertentu
 * Digunakan untuk menegakkan aturan 1:1 alokasi (1 boundary hanya dapat digunakan oleh 1 plan)
 */
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

// ==================== 6. MODAL PREVIEW & PENAMAAN BOUNDARY ====================

let previewMapInstance = null;
let previewPolygonsLayer = null;
let previewBuffersLayer = null;
let tempParsedBoundaries = [];
let tempParsedContractor = 'PT SIS';

/**
 * Membuka modal upload DXF
 */
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
 * Menutup modal upload DXF
 */
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
}

/**
 * Menangani pemilihan file DXF
 */
function handleDxfFileSelect(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  processDxfFileObject(file);
}

/**
 * Memproses file object DXF
 */
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
 * Menampilkan Step 2: Preview Peta & Input Penamaan Boundary
 */
function renderDxfPreviewStep(fileName, contractorName) {
  document.getElementById('dxf-step-upload').classList.add('hidden');
  document.getElementById('dxf-step-preview').classList.remove('hidden');

  const titleEl = document.getElementById('dxf-preview-filename');
  if (titleEl) {
    titleEl.innerHTML = `
      <div class="flex items-center gap-2 flex-wrap">
        <span class="font-extrabold text-slate-900">${escapeXmlAttr(fileName)}</span>
        <span class="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${contractorName.includes('BUMA') ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-blue-100 text-blue-800 border border-blue-300'}">
          ${escapeXmlAttr(contractorName)}
        </span>
        <span class="text-xs text-slate-500 font-bold">(${tempParsedBoundaries.length} Boundary Blasting Terdeteksi)</span>
      </div>
    `;
  }

  // Render Tabel Form Penamaan
  const tbody = document.getElementById('dxf-preview-tbody');
  if (tbody) {
    let html = '';
    tempParsedBoundaries.forEach((b, idx) => {
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
              placeholder="Ketik Nama Lokasi Blasting (mis: PIT 1 WEST, STACK 2)..."
              class="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600">
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

/**
 * Inisialisasi peta Leaflet mini untuk preview boundary & buffer konsentris DXF
 */
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

  // Basemap Satelit Google
  L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
  }).addTo(previewMapInstance);

  previewBuffersLayer = L.featureGroup().addTo(previewMapInstance);
  previewPolygonsLayer = L.featureGroup().addTo(previewMapInstance);

  const bufferConfigs = getContractorBufferConfig(tempParsedContractor);

  // Gambar Poligon & Buffer Konsentris
  tempParsedBoundaries.forEach((b, idx) => {
    const latlngs = b.coords.map(([lon, lat]) => [lat, lon]);

    // 1. Gambar Buffer Konsentris jika Turf.js aktif
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

    // 2. Gambar Boundary Polygon
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

/**
 * Handle input teks penamaan boundary
 */
function handleDxfNameInput(index, value) {
  if (tempParsedBoundaries[index]) {
    tempParsedBoundaries[index].name = value.trim();
  }
  updateDxfSaveButtonState();
}

/**
 * Validasi apakah semua boundary sudah diberi nama & tidak ada nama ganda
 */
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

/**
 * Zoom ke poligon tertentu saat tombol 'Lihat' diklik
 */
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

/**
 * Sorot baris tabel saat poligon di peta diklik
 */
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
 * Menyimpan hasil ekstraksi boundary ke localStorage dan membuka kunci form blasting
 */
function confirmSaveDxfBoundaries() {
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
    timestamp: Date.now()
  }));

  const activeDate = document.getElementById('input_tanggal')?.value || (typeof getWitaDateString === 'function' ? getWitaDateString() : '');
  const fileName = document.getElementById('dxf-preview-filename')?.innerText || 'boundaries.dxf';

  saveLocalBoundaries(cleanList, fileName, tempParsedContractor, activeDate);

  Swal.fire({
    icon: 'success',
    title: 'Boundary Berhasil Disimpan!',
    text: `${cleanList.length} boundary peledakan (${tempParsedContractor}) telah aktif untuk tanggal ${activeDate}. Form plan peledakan kini terbuka.`,
    timer: 2200,
    showConfirmButton: false
  });

  closeDxfUploadModal();
}

// ==================== 7. INTEGRASI WORKFLOW FORM & VALIDASI 1:1 ====================

/**
 * Memperbarui status UI:
 * - Mengunci form jika boundary belum diunggah (tampilan awal hanya Tanggal & Tombol Upload DXF)
 * - Membuka form jika boundary sudah aktif
 * - Menegakkan aturan 1:1 alokasi boundary (menonaktifkan boundary yang sudah dialokasikan di database)
 */
function updateBoundaryUIState() {
  const boundaries = getValidLocalBoundaries();
  const hasBoundaries = boundaries.length > 0;
  const targetDate = document.getElementById('input_tanggal')?.value || (typeof getWitaDateString === 'function' ? getWitaDateString() : '');

  const gateCard = document.getElementById('dxf-upload-gate-card');
  const formFieldsWrapper = document.getElementById('kontraktor-form-fields-wrapper');
  const selectLokasi = document.getElementById('input_lokasi_select');
  const statusBanner = document.getElementById('dxf-boundary-status-banner');
  const bulkBtn = document.getElementById('btn-bulk-import-header');

  if (!hasBoundaries) {
    // KONDISI 1: Belum Ada DXF Diunggah -> Kunci Form, Hanya Tampilkan Tanggal & Upload DXF Gate Card
    if (gateCard) gateCard.classList.remove('hidden');
    if (formFieldsWrapper) formFieldsWrapper.classList.add('hidden');
    if (bulkBtn) {
      bulkBtn.classList.add('opacity-50');
      bulkBtn.title = 'Unggah file DXF boundary terlebih dahulu untuk mengaktifkan bulk import';
    }

    if (statusBanner) {
      statusBanner.innerHTML = '';
      statusBanner.className = 'hidden';
    }

    if (selectLokasi) {
      selectLokasi.innerHTML = '<option value="" disabled selected>⚠️ Upload DXF terlebih dahulu...</option>';
      selectLokasi.disabled = true;
    }
    return;
  }

  // KONDISI 2: DXF Sudah Diunggah -> Buka Form & Aktifkan Dropdown Lokasi dengan Filter 1:1
  if (gateCard) gateCard.classList.add('hidden');
  if (formFieldsWrapper) formFieldsWrapper.classList.remove('hidden');
  if (bulkBtn) {
    bulkBtn.classList.remove('opacity-50');
    bulkBtn.title = '';
  }

  const meta = getLocalBoundaryMetadata();
  const contractorName = meta ? meta.kontraktor : getActiveContractor();

  // Update Status Banner Hijau
  if (statusBanner) {
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
        class="px-3 py-1.5 bg-white hover:bg-emerald-100 text-emerald-800 font-bold rounded-lg border border-emerald-300 text-xs transition flex items-center gap-1.5 self-start sm:self-auto shadow-2xs">
        <i class="ph-bold ph-pencil-simple"></i> Upload Ulang DXF
      </button>
    `;
  }

  // Update Dropdown Lokasi di Form Manual (Menegakkan Aturan 1:1 Alokasi)
  if (selectLokasi) {
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

    // Jika semua boundary sudah dialokasikan
    const allocationNotice = document.getElementById('all-boundaries-allocated-notice');
    if (availableCount === 0 && boundaries.length > 0) {
      if (allocationNotice) {
        allocationNotice.classList.remove('hidden');
        allocationNotice.innerText = `Semua ${boundaries.length} boundary DXF telah dialokasikan ke plan peledakan hari ini.`;
      }
    } else if (allocationNotice) {
      allocationNotice.classList.add('hidden');
    }
  }
}

/**
 * Dipanggil saat user memilih opsi boundary di dropdown form kontraktor
 */
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
    if (inputHiddenLokasi) inputHiddenLokasi.value = '';
    if (inputGeometry) inputGeometry.value = '';
    if (badgeInfo) badgeInfo.classList.add('hidden');
  }
}

// Helper escape attribute
function escapeXmlAttr(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Inisialisasi saat window dimuat
window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    updateBoundaryUIState();
  }, 350);
});
