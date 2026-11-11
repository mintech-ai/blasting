/**
 * INTEGRATED BLASTING PLAN & DASHBOARD PLATFORM
 * Module: MAP & GEOSPATIAL VISUALIZATION
 * Menangani peta Leaflet, marker sebaran peledakan, kontrol basemap, legenda, serta modal Map Picker.
 */

let blastingMarkersGroup = null;
let blastingMarkerList = [];
let blastingDefaultTileLayer = null;
let blastingOrthoTileLayer = null;

// Helper: Parse koordinat (mendukung titik atau koma)
function parseCoordNumber(val) {
  if (val === undefined || val === null || val === '') return null;
  if (typeof val === 'number') return isNaN(val) ? null : val;
  const clean = String(val).trim().replace(',', '.');
  const num = parseFloat(clean);
  return isNaN(num) ? null : num;
}

// Inisialisasi Peta Utama Blasting
function initBlastingMap() {
  if (blastingMap) {
    blastingMap.invalidateSize();
    return;
  }

  const mapContainer = document.getElementById('blastingMapContainer');
  if (!mapContainer) return;

  // Default Area Tambang Adaro Kalsel (Tutupan / Wara / Paringin)
  const defaultCenter = [-2.1700, 115.5500];
  const defaultZoom = 12;

  blastingMap = L.map('blastingMapContainer', {
    zoomControl: false,
    attributionControl: false
  }).setView(defaultCenter, defaultZoom);

  // Base Layers (Peta Satelit & Orthophoto Intranet)
  const TILE_URL_ORTHOPHOTO = "http://10.165.1.14:9090/service?layer=basemap-image&style=&tilematrixset=grid_merc&Service=WMTS&Request=GetTile&Version=1.3.0&Format=png&TileMatrix={z}&TileCol={x}&TileRow={y}";

  blastingDefaultTileLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
  });

  blastingOrthoTileLayer = L.tileLayer(TILE_URL_ORTHOPHOTO, {
    attribution: '&copy; PT Adaro Indonesia - Orthophoto (Intranet)',
    maxZoom: 22,
    maxNativeZoom: 20,
    crossOrigin: false,
    updateWhenIdle: false,
    keepBuffer: 4
  });

  blastingDefaultTileLayer.addTo(blastingMap);

  const baseMaps = {
    "Peta Satelit": blastingDefaultTileLayer,
    "Orthophoto (Intranet)": blastingOrthoTileLayer
  };

  L.control.layers(baseMaps, null, { position: 'topright' }).addTo(blastingMap);
  L.control.zoom({ position: 'bottomright' }).addTo(blastingMap);

  // Sinkronisasi dropdown jika user memilih lewat menu kontrol Leaflet
  blastingMap.on('baselayerchange', function (e) {
    const sel = document.getElementById('mapBasemapSelector');
    if (sel) {
      sel.value = (e.layer === blastingOrthoTileLayer) ? 'ortho' : 'default';
    }
    if (e.layer && typeof e.layer.bringToBack === 'function') {
      e.layer.bringToBack();
    }
    if (e.layer && typeof e.layer.redraw === 'function') {
      e.layer.redraw();
    }
  });

  blastingMarkersGroup = L.featureGroup().addTo(blastingMap);

  // Pastikan invalidateSize dipanggil setelah render awal agar tile peta langsung aktif di HP
  setTimeout(() => {
    if (blastingMap) blastingMap.invalidateSize();
  }, 150);
  setTimeout(() => {
    if (blastingMap) blastingMap.invalidateSize();
  }, 350);

  window.addEventListener('resize', () => {
    if (blastingMap) blastingMap.invalidateSize();
  });

  window.addEventListener('orientationchange', () => {
    setTimeout(() => {
      if (blastingMap) blastingMap.invalidateSize();
    }, 300);
  });
}

function switchBlastingBasemap(type) {
  if (!blastingMap || !blastingDefaultTileLayer || !blastingOrthoTileLayer) return;
  if (type === 'ortho') {
    if (blastingMap.hasLayer(blastingDefaultTileLayer)) {
      blastingMap.removeLayer(blastingDefaultTileLayer);
    }
    if (!blastingMap.hasLayer(blastingOrthoTileLayer)) {
      blastingMap.addLayer(blastingOrthoTileLayer);
    }
    blastingOrthoTileLayer.bringToBack();
    blastingOrthoTileLayer.redraw();
  } else {
    if (blastingMap.hasLayer(blastingOrthoTileLayer)) {
      blastingMap.removeLayer(blastingOrthoTileLayer);
    }
    if (!blastingMap.hasLayer(blastingDefaultTileLayer)) {
      blastingMap.addLayer(blastingDefaultTileLayer);
    }
    blastingDefaultTileLayer.bringToBack();
    blastingDefaultTileLayer.redraw();
  }
  const sel = document.getElementById('mapBasemapSelector');
  if (sel) sel.value = type;

  setTimeout(() => {
    if (blastingMap) blastingMap.invalidateSize();
  }, 50);
}
window.switchBlastingBasemap = switchBlastingBasemap;

// Toggle tampilan legenda khusus di layar HP (tidak mempengaruhi laptop)
function toggleMapLegend() {
  if (window.innerWidth >= 768) return;
  const content = document.getElementById('blastingMapLegendContent');
  const chevron = document.getElementById('map-legend-chevron');
  if (content) {
    content.classList.toggle('hidden');
    if (chevron) {
      chevron.className = content.classList.contains('hidden')
        ? 'ph-bold ph-caret-down md:hidden text-slate-400 text-xs'
        : 'ph-bold ph-caret-up md:hidden text-slate-400 text-xs';
    }
  }
}

function fitBlastingMapBounds() {
  if (!blastingMap) return;
  const pad = window.innerWidth < 768 ? [24, 24] : [60, 60];
  if (blastingMarkersGroup && blastingMarkersGroup.getLayers().length > 0) {
    blastingMap.fitBounds(blastingMarkersGroup.getBounds(), { padding: pad, maxZoom: 15 });
  } else {
    blastingMap.setView([-2.1700, 115.5500], 12);
  }
}

function handleMapColorModeChange(mode) {
  renderBlastingMapMarkers();
}

function handleMapSearch(query) {
  if (!query || !query.trim()) {
    renderBlastingMapMarkers();
    return;
  }
  renderBlastingMapMarkers(query.trim().toLowerCase());
}

// Aturan Pewarnaan Titik Marker (Sesuai Permintaan User):
// 1. Kontraktor: SIS = Biru (#2563eb), BUMA = Hijau (#16a34a), Lainnya = Abu (#64748b)
// 2. Supplier: DAHANA = Kuning (#eab308), MNK-KMB = Merah (#dc2626), Belum Terisi = Abu (#94a3b8)
// 3. Prioritas: Prioritas 1 = Merah (#dc2626), Prioritas 2 = Cyan (#0891b2)
// 4. Status: TODAY = Hijau (#16a34a), SLEEP = Amber (#d97706)
function getBlastingMarkerColor(item, colorMode) {
  if (colorMode === 'supplier') {
    const sup = cleanCompanyName(item.supplier).toUpperCase();
    if (sup.includes('DAHANA')) return { color: '#eab308', label: 'DAHANA' };
    if (sup.includes('MNK') || sup.includes('KMB')) return { color: '#dc2626', label: 'MNK-KMB' };
    return { color: '#94a3b8', label: 'Belum Assigned' };
  }

  if (colorMode === 'prioritas') {
    const p = String(item.prioritas || '').toUpperCase();
    if (p.includes('1')) return { color: '#dc2626', label: 'Prioritas 1' };
    if (p.includes('2')) return { color: '#0891b2', label: 'Prioritas 2' };
    return { color: '#64748b', label: 'Lainnya' };
  }

  if (colorMode === 'today_sleep') {
    const norm = getPlanTodaySleepStatus(item);
    const cfg = BLASTING_STATUS_CONFIG[norm];
    if (cfg) return { color: cfg.mapColor, label: cfg.label };
    return { color: '#64748b', label: norm };
  }

  // Default: Kontraktor
  const k = cleanCompanyName(item.kontraktor).toUpperCase();
  if (k.includes('SIS')) return { color: '#2563eb', label: 'SIS' };
  if (k.includes('BUMA')) return { color: '#16a34a', label: 'BUMA' };
  return { color: '#64748b', label: item.kontraktor || 'Lainnya' };
}

function renderBlastingMapMarkers(searchQuery = '') {
  if (!blastingMap) initBlastingMap();
  if (!blastingMap || !blastingMarkersGroup) return;

  blastingMarkersGroup.clearLayers();
  blastingMarkerList = [];

  const colorMode = (document.getElementById('blastingMapColorMode') ? document.getElementById('blastingMapColorMode').value : 'kontraktor');
  const filterKontraktor = (document.getElementById('blastingMapFilterKontraktor') ? document.getElementById('blastingMapFilterKontraktor').value : 'ALL');
  const filterSupplier = (document.getElementById('blastingMapFilterSupplier') ? document.getElementById('blastingMapFilterSupplier').value : 'ALL');

  const subtitleEl = document.getElementById('map-legend-subtitle');
  if (subtitleEl) {
    if (colorMode === 'kontraktor') subtitleEl.innerText = 'Kontraktor';
    else if (colorMode === 'supplier') subtitleEl.innerText = 'Supplier';
    else if (colorMode === 'prioritas') subtitleEl.innerText = 'Prioritas';
    else subtitleEl.innerText = 'Status';
  }

  const legendCounts = {};
  let plottedCount = 0;
  let unplottedCount = 0;

  // Iterasi data harian plan blasting
  (globalPlanData || []).forEach(item => {
    const kUpper = cleanCompanyName(item.kontraktor).toUpperCase();
    const sUpper = cleanCompanyName(item.supplier).toUpperCase();

    if (filterKontraktor !== 'ALL' && !kUpper.includes(filterKontraktor)) return;

    if (filterSupplier !== 'ALL') {
      if (filterSupplier === 'UNASSIGNED') {
        if (sUpper !== '') return;
      } else if (!sUpper.includes(filterSupplier)) {
        return;
      }
    }

    if (searchQuery) {
      const loc = String(item.lokasi || '').toLowerCase();
      const uuid = String(item.uuid || '').toLowerCase();
      const kont = String(item.kontraktor || '').toLowerCase();
      if (!loc.includes(searchQuery) && !uuid.includes(searchQuery) && !kont.includes(searchQuery)) {
        return;
      }
    }

    const lat = parseCoordNumber(item.latitude || item.lat);
    const lng = parseCoordNumber(item.longitude || item.long || item.lng);

    if (lat === null || lng === null) {
      unplottedCount++;
      return;
    }

    plottedCount++;
    const { color, label } = getBlastingMarkerColor(item, colorMode);
    legendCounts[label] = (legendCounts[label] || 0) + 1;

    // Leaflet Circle Marker dengan glow modern
    const marker = L.circleMarker([lat, lng], {
      radius: 10,
      fillColor: color,
      color: '#ffffff',
      weight: 2.5,
      opacity: 1,
      fillOpacity: 0.95
    });

    // Tooltip Hover Cepat
    marker.bindTooltip(`
      <div class="font-sans text-xs">
        <span class="font-mono font-black text-red-600">#${item.uuid || 'PB'}</span> - 
        <span class="font-extrabold text-slate-900">${item.lokasi || 'Pit Blasting'}</span>
        <span class="text-slate-500 font-bold">(${item.kontraktor || '-'})</span>
      </div>
    `, { direction: 'top', offset: [0, -8] });

    // Popup Ringkasan / Summary Blasting saat Titik Diklik
    const popupContent = createBlastingPopupHtml(item, lat, lng, color);
    marker.bindPopup(popupContent, { maxWidth: 320, className: 'blasting-popup' });

    marker.on('click', () => {
      marker.openPopup();
    });

    blastingMarkersGroup.addLayer(marker);
    blastingMarkerList.push({ item, marker, lat, lng });
  });

  // Update Badges
  const countText = document.getElementById('map-plotted-count-text');
  if (countText) countText.innerText = `${plottedCount} Titik Terplot`;

  const unplottedBadge = document.getElementById('map-unplotted-badge');
  const unplottedText = document.getElementById('map-unplotted-count-text');
  if (unplottedBadge && unplottedText) {
    if (unplottedCount > 0) {
      unplottedBadge.classList.remove('hidden');
      unplottedBadge.classList.add('flex');
      unplottedText.innerText = `${unplottedCount} titik tanpa koordinat`;
    } else {
      unplottedBadge.classList.add('hidden');
      unplottedBadge.classList.remove('flex');
    }
  }

  // Render Legenda Peta
  renderBlastingMapLegend(colorMode, legendCounts);

  // Auto fit jika ada titik baru
  if (plottedCount > 0 && !searchQuery) {
    fitBlastingMapBounds();
  }
}

// Generator Kartu Popup Summary Titik Blasting
function createBlastingPopupHtml(item, lat, lng, markerColor) {
  const uuid = item.uuid || item.id || 'PB';
  const lokasi = item.lokasi || 'Lokasi Belum Ditentukan';
  const kontraktor = cleanCompanyName(item.kontraktor) || '-';
  const pengawasKont = item.pengawas_kontraktor || '-';
  const supplier = cleanCompanyName(item.supplier) || '';
  const pengawasSup = item.pengawas_supplier || '-';
  const holes = item.jumlah_holes || item.holes || 0;
  const isian = item.isian_kg || 0;
  const vol = Number(item.volume_ton || item.volume || 0).toFixed(2);
  const todaySleep = getPlanTodaySleepStatus(item);
  const prioritas = item.prioritas || 'Prioritas 1';
  const inisiasi = item.inisiasi || 'RF';
  const jamMasuk = formatExcelTime(item.jam_masuk || item.kondisi_jam_masuk);
  const mmu = item.unit_mmu || '-';
  const geometri = item.geometri || '-';
  const matrix = item.matrix || '-';

  const statusBadgeHtml = getStatusBadgeHtml(todaySleep);

  return `
    <div class="font-sans text-xs text-slate-800 p-1" style="min-width: 270px; max-width: 320px;">
      
      <!-- Header -->
      <div class="flex items-start justify-between gap-2 border-b border-slate-200 pb-2 mb-2">
        <div>
          <div class="flex items-center gap-1.5">
            <span class="text-[10px] font-mono font-black text-red-700 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">#${uuid}</span>
            ${statusBadgeHtml}
          </div>
          <h4 class="font-black text-sm text-slate-900 mt-1 leading-snug">${lokasi}</h4>
        </div>
        <span class="text-[10px] font-extrabold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded whitespace-nowrap">${prioritas}</span>
      </div>

      <!-- Info Tim Kontraktor & Supplier -->
      <div class="grid grid-cols-2 gap-2 mb-2.5">
        <div class="bg-blue-50/70 p-2 rounded-xl border border-blue-200">
          <span class="text-[9px] uppercase font-black text-blue-700 block tracking-wider">Kontraktor</span>
          <span class="font-black text-slate-900 text-xs">${kontraktor}</span>
          <span class="text-[10px] text-slate-500 block truncate mt-0.5" title="Pengawas Kontraktor: ${pengawasKont}">Pengawas: ${pengawasKont}</span>
        </div>
        <div class="bg-amber-50/70 p-2 rounded-xl border border-amber-200">
          <span class="text-[9px] uppercase font-black text-amber-800 block tracking-wider">Supplier</span>
          <span class="font-black text-slate-900 text-xs">${supplier || '<span class="italic text-slate-400 font-normal">Belum Assigned</span>'}</span>
          <span class="text-[10px] text-slate-500 block truncate mt-0.5" title="Pengawas Supplier: ${pengawasSup}">Pengawas: ${pengawasSup}</span>
        </div>
      </div>

      <!-- Parameter Teknis Peledakan -->
      <div class="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-1 text-[11px] mb-3">
        <div class="flex justify-between items-center">
          <span class="text-slate-500">Volume DTH / Isian:</span>
          <span class="font-mono font-black text-emerald-700">${vol} Ton <span class="text-slate-400 font-normal">(${isian} Kg)</span></span>
        </div>
        <div class="flex justify-between items-center">
          <span class="text-slate-500">Jumlah Lubang:</span>
          <span class="font-mono font-bold text-slate-800">${holes} Holes <span class="text-slate-400 font-normal">(${geometri})</span></span>
        </div>
        <div class="flex justify-between items-center">
          <span class="text-slate-500">Inisiasi & Jam:</span>
          <span class="font-mono font-bold text-slate-800">${inisiasi} @ ${jamMasuk}</span>
        </div>
        <div class="flex justify-between items-center">
          <span class="text-slate-500">Matrix Batuan:</span>
          <span class="font-medium text-slate-700 truncate max-w-[140px]" title="${matrix}">${matrix}</span>
        </div>
        <div class="pt-1 border-t border-slate-200/80">
          <span class="text-slate-500 block mb-0.5 font-bold text-[9.5px]">Unit MMU / MMT:</span>
          <div class="font-mono text-[9.5px] font-bold text-red-700 bg-red-50/80 p-1.5 rounded-lg border border-red-200 break-words leading-snug">${mmu}</div>
        </div>
      </div>

      <!-- Tombol Aksi Cepat -->
      <div class="flex items-center gap-1.5 pt-1">
        <button type="button" onclick="zoomToAndHighlightRow('${uuid}')"
          class="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-[10.5px] transition flex items-center justify-center gap-1">
          <i class="ph-bold ph-table text-xs"></i> Lihat di Tabel
        </button>
        <button type="button" onclick="openEditModalFromMap('${uuid}')"
          class="flex-1 py-1.5 bg-red-600 hover:bg-red-700 text-white font-extrabold rounded-xl text-[10.5px] shadow-sm glow-red transition flex items-center justify-center gap-1">
          <i class="ph-bold ph-pencil-simple text-xs"></i> Alokasi/Edit
        </button>
      </div>

    </div>
  `;
}

function renderBlastingMapLegend(colorMode, counts = {}) {
  const container = document.getElementById('blastingMapLegendContent');
  if (!container) return;

  let items = [];

  if (colorMode === 'supplier') {
    items = [
      { label: 'DAHANA', color: '#eab308' },
      { label: 'MNK-KMB', color: '#dc2626' },
      { label: 'Belum Assigned', color: '#94a3b8' }
    ];
  } else if (colorMode === 'prioritas') {
    items = [
      { label: 'Prioritas 1', color: '#dc2626' },
      { label: 'Prioritas 2', color: '#0891b2' }
    ];
  } else if (colorMode === 'today_sleep') {
    items = Object.values(BLASTING_STATUS_CONFIG).map(cfg => ({
      label: cfg.label,
      color: cfg.mapColor
    }));
  } else {
    // Kontraktor
    items = [
      { label: 'SIS', color: '#2563eb' },
      { label: 'BUMA', color: '#16a34a' },
      { label: 'Lainnya', color: '#64748b' }
    ];
  }

  let html = '';
  items.forEach(it => {
    const count = counts[it.label] || 0;
    html += `
      <div class="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-lg shadow-2xs">
        <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background-color: ${it.color};"></span>
        <span class="text-slate-800 font-bold text-[11px] whitespace-nowrap">${it.label}</span>
        <span class="font-mono font-black text-slate-900 text-[10px] bg-white border border-slate-200 px-1 py-0.2 rounded">${count}</span>
      </div>
    `;
  });

  container.innerHTML = html;
}

// Navigasi: Scroll dan Highlight baris di tabel Dashboard
function zoomToAndHighlightRow(uuid) {
  switchView('dashboard');
  setTimeout(() => {
    const row = document.getElementById('row-plan-' + uuid);
    if (row) {
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      row.classList.add('bg-amber-100');
      setTimeout(() => {
        row.classList.remove('bg-amber-100');
      }, 3000);
    } else {
      Swal.fire({ icon: 'info', title: 'Record Terpilih', text: `Data plan #${uuid} siap diakses di dashboard.` });
    }
  }, 150);
}

// Helper: Buka modal edit langsung dari popup map
function openEditModalFromMap(uuid) {
  openEditPlanModal(uuid);
}

// =========================================================================
// MAP PICKER MODAL LOGIC (Klik Peta Untuk Ambil Koordinat)
// =========================================================================
function openMapPickerModal(targetLatId, targetLngId) {
  pickerTargetLatId = targetLatId;
  pickerTargetLngId = targetLngId;
  tempPickerCoords = null;

  const modal = document.getElementById('modal-map-picker');
  const confirmBtn = document.getElementById('btn-confirm-map-picker');
  const readout = document.getElementById('pickerCoordsDisplay');

  if (confirmBtn) confirmBtn.disabled = true;
  if (readout) readout.innerText = 'Klik pada peta tambang...';

  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }

  setTimeout(() => {
    initPickerMap();
  }, 100);
}

function closeMapPickerModal() {
  const modal = document.getElementById('modal-map-picker');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
  pickerTargetLatId = null;
  pickerTargetLngId = null;
  tempPickerCoords = null;
}

function initPickerMap() {
  const container = document.getElementById('pickerMapContainer');
  if (!container) return;

  let currentLat = null;
  let currentLng = null;
  if (pickerTargetLatId && document.getElementById(pickerTargetLatId)) {
    currentLat = parseCoordNumber(document.getElementById(pickerTargetLatId).value);
  }
  if (pickerTargetLngId && document.getElementById(pickerTargetLngId)) {
    currentLng = parseCoordNumber(document.getElementById(pickerTargetLngId).value);
  }

  const center = (currentLat !== null && currentLng !== null) ? [currentLat, currentLng] : [-2.1700, 115.5500];
  const zoom = (currentLat !== null && currentLng !== null) ? 15 : 12;

  if (!pickerMap) {
    pickerMap = L.map('pickerMapContainer', {
      zoomControl: true,
      attributionControl: false
    }).setView(center, zoom);

    L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
    }).addTo(pickerMap);

    pickerMap.on('click', (e) => {
      setPickerLocation(e.latlng.lat, e.latlng.lng);
    });
  } else {
    pickerMap.invalidateSize();
    pickerMap.setView(center, zoom);
  }

  if (currentLat !== null && currentLng !== null) {
    setPickerLocation(currentLat, currentLng);
  } else if (pickerMarker) {
    pickerMap.removeLayer(pickerMarker);
    pickerMarker = null;
  }
}

function setPickerLocation(lat, lng) {
  tempPickerCoords = { lat: Number(lat), lng: Number(lng) };

  if (!pickerMarker) {
    pickerMarker = L.marker([lat, lng], { draggable: true }).addTo(pickerMap);
    pickerMarker.on('dragend', (e) => {
      const pos = e.target.getLatLng();
      setPickerLocation(pos.lat, pos.lng);
    });
  } else {
    pickerMarker.setLatLng([lat, lng]);
  }

  const readout = document.getElementById('pickerCoordsDisplay');
  if (readout) {
    readout.innerText = `Lat: ${lat.toFixed(6)}, Long: ${lng.toFixed(6)}`;
  }

  const confirmBtn = document.getElementById('btn-confirm-map-picker');
  if (confirmBtn) confirmBtn.disabled = false;
}

function confirmMapPickerSelection() {
  if (!tempPickerCoords) return;

  if (pickerTargetLatId && document.getElementById(pickerTargetLatId)) {
    document.getElementById(pickerTargetLatId).value = tempPickerCoords.lat.toFixed(6);
  }
  if (pickerTargetLngId && document.getElementById(pickerTargetLngId)) {
    document.getElementById(pickerTargetLngId).value = tempPickerCoords.lng.toFixed(6);
  }

  const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 1500
  });
  Toast.fire({ icon: 'success', title: 'Koordinat lokasi berhasil diset' });

  closeMapPickerModal();
}

window.parseCoordNumber = parseCoordNumber;
window.initBlastingMap = initBlastingMap;
window.switchBlastingBasemap = switchBlastingBasemap;
window.toggleMapLegend = toggleMapLegend;
window.fitBlastingMapBounds = fitBlastingMapBounds;
window.handleMapColorModeChange = handleMapColorModeChange;
window.handleMapSearch = handleMapSearch;
window.getBlastingMarkerColor = getBlastingMarkerColor;
window.renderBlastingMapMarkers = renderBlastingMapMarkers;
window.createBlastingPopupHtml = createBlastingPopupHtml;
window.renderBlastingMapLegend = renderBlastingMapLegend;
window.zoomToAndHighlightRow = zoomToAndHighlightRow;
window.openEditModalFromMap = openEditModalFromMap;
window.openMapPickerModal = openMapPickerModal;
window.closeMapPickerModal = closeMapPickerModal;
window.initPickerMap = initPickerMap;
window.setPickerLocation = setPickerLocation;
window.confirmMapPickerSelection = confirmMapPickerSelection;

