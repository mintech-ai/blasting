/**
 * INTEGRATED BLASTING PLAN & DASHBOARD PLATFORM
 * Module: CONFIG & GLOBAL STATE
 * Berisi konfigurasi endpoint Google Apps Script, konstanta sistem, dan state global aplikasi.
 */

// URL Endpoint Google Apps Script Web App Backend
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzlEnxcAS_MlWFZwlsTcV0k-in1FuiTPe4ZZJE7cNJ1oAMLU4ZwpfA72L-3pAnNQJ32/exec';

// Current State
let currentUser = null;
let rawGlobalPlanData = [];
let rawGlobalSupplierData = [];
let globalPlanData = [];
let globalSupplierData = [];
let globalMasterData = [];
let globalForecastData = [];
let isDashboardCardsCollapsed = false;
let selectedMmuChips = [];
let bulkPreviewRows = [];
let selectedPlanNeedMmus = [];

// State Presensi Manpower Roster Supplier
let supplierManpowerAttendance = {
  pengawas: new Set(),
  blaster: new Set()
};
let modalEditSupAttendance = {
  pengawas: new Set(),
  blaster: new Set()
};

// State View & Modal
let isDashboardTablesVisible = false;
let currentEditingItem = null;
let editAllocMmuList = [];

// State Map & Picker
let blastingMap = null;
let blastingMarkersLayer = null;
let mapColorMode = 'kontraktor';
let currentBasemapType = 'osm';
let tileLayer = null;
let satelliteLayer = null;
let esriLabelsLayer = null;

let pickerMap = null;
let pickerMarker = null;
let pickerTargetLatId = null;
let pickerTargetLngId = null;
let tempPickerCoords = null;

// Presets MMU / MMT (Kapasitas DTH Ton) - MMT 13 diupdate ke 17 Ton, MMT 28 ke 15 Ton per User Request
const MMU_CAPACITY_MAP = {
  'MMT 18': 16, 'MMT 25': 17.5, 'MMT 26': 17.5, 'MMT 13': 17, 'MMT 28': 15, 'MMT 39': 10,
  'MMU 120': 17, 'MMU 121': 17, 'MMU 122': 17, 'MMU 123': 17, 'MMU 19': 12.5, 'MMU 23': 15
};
window.MMU_CAPACITY_MAP = MMU_CAPACITY_MAP;

const SUPPLIER_MMU_PRESETS = {
  'DAHANA': [
    { code: 'MMT 13', cap: 17 },
    { code: 'MMT 18', cap: 16 },
    { code: 'MMT 25', cap: 17.5 },
    { code: 'MMT 26', cap: 17.5 },
    { code: 'MMT 28', cap: 15 },
    { code: 'MMT 39', cap: 10 }
  ],
  'MNK-KMB': [
    { code: 'MMU 19', cap: 12.5 },
    { code: 'MMU 23', cap: 15 },
    { code: 'MMU 120', cap: 17 },
    { code: 'MMU 121', cap: 17 },
    { code: 'MMU 122', cap: 17 },
    { code: 'MMU 123', cap: 17 }
  ]
};

// Presets Mobil Box Ready per Supplier
const SUPPLIER_BOX_PRESETS = {
  'DAHANA': ['Box 10', 'Box 16', 'Box 20', 'Box 40'],
  'MNK-KMB': ['Box 17', 'Box 18', 'Box 19']
};
window.SUPPLIER_BOX_PRESETS = SUPPLIER_BOX_PRESETS;

// Helper untuk memperbarui preset dari Master Data (dari Apps Script MASTER_DATA_CONFIG atau spreadsheet)
function applyMasterData(masterData) {
  if (!masterData) return;
  globalMasterData = masterData;

  // 1. Jika format Object dari Apps Script MASTER_DATA_CONFIG
  if (typeof masterData === 'object' && !Array.isArray(masterData)) {
    if (masterData.MMU_CAPACITIES) {
      Object.assign(MMU_CAPACITY_MAP, masterData.MMU_CAPACITIES);
    }
    if (masterData.UNITS_BY_SUPPLIER) {
      ['DAHANA', 'MNK-KMB'].forEach(sup => {
        const units = masterData.UNITS_BY_SUPPLIER[sup] || masterData.UNITS_BY_SUPPLIER['PT ' + sup];
        if (Array.isArray(units)) {
          SUPPLIER_MMU_PRESETS[sup] = units.map(code => ({
            code: code,
            cap: (masterData.MMU_CAPACITIES && masterData.MMU_CAPACITIES[code]) || MMU_CAPACITY_MAP[code] || 17
          }));
        }
      });
    }
    if (masterData.BOX_BY_SUPPLIER) {
      ['DAHANA', 'MNK-KMB'].forEach(sup => {
        const boxes = masterData.BOX_BY_SUPPLIER[sup] || masterData.BOX_BY_SUPPLIER['PT ' + sup];
        if (Array.isArray(boxes)) {
          SUPPLIER_BOX_PRESETS[sup] = boxes;
        }
      });
    }
    if (masterData.PENGAWAS_BY_SUPPLIER) {
      ['DAHANA', 'MNK-KMB'].forEach(sup => {
        const spv = masterData.PENGAWAS_BY_SUPPLIER[sup] || masterData.PENGAWAS_BY_SUPPLIER['PT ' + sup];
        if (Array.isArray(spv) && spv.length > 0) {
          SUPPLIER_PERSONNEL_ROSTER[sup].pengawas = spv;
        }
      });
    }
    if (masterData.BLASTER_BY_SUPPLIER) {
      ['DAHANA', 'MNK-KMB'].forEach(sup => {
        const bls = masterData.BLASTER_BY_SUPPLIER[sup] || masterData.BLASTER_BY_SUPPLIER['PT ' + sup];
        if (Array.isArray(bls) && bls.length > 0) {
          SUPPLIER_PERSONNEL_ROSTER[sup].blaster = bls;
        }
      });
    }
    return;
  }

  // 2. Format Array (jika data tabular)
  if (Array.isArray(masterData) && masterData.length > 0) {
    const mmuByCompany = { 'DAHANA': [], 'MNK-KMB': [] };
    const rosterByCompany = {
      'DAHANA': { pengawas: [], blaster: [] },
      'MNK-KMB': { pengawas: [], blaster: [] }
    };

    masterData.forEach(item => {
      const rawComp = String(item.perusahaan || item.Perusahaan || '').toUpperCase();
      const compKey = (rawComp.includes('MNK') || rawComp.includes('KMB')) ? 'MNK-KMB' : (rawComp.includes('DAHANA') ? 'DAHANA' : '');
      if (!compKey) return;

      const rawJenis = String(item.jenis || item.Jenis || '').toUpperCase();
      const nama = String(item.nama || item.Nama || '').trim();
      if (!nama) return;

      const cap = parseFloat(item.kapasitas || item.Kapasitas) || 0;

      if (rawJenis.includes('MMU') || rawJenis.includes('MMT')) {
        mmuByCompany[compKey].push({ code: nama, cap: cap > 0 ? cap : 17 });
      } else if (rawJenis.includes('PENGAWAS') || rawJenis.includes('SPV')) {
        if (!rosterByCompany[compKey].pengawas.includes(nama)) rosterByCompany[compKey].pengawas.push(nama);
      } else if (rawJenis.includes('BLASTER')) {
        if (!rosterByCompany[compKey].blaster.includes(nama)) rosterByCompany[compKey].blaster.push(nama);
      }
    });

    if (mmuByCompany['DAHANA'].length > 0) SUPPLIER_MMU_PRESETS['DAHANA'] = mmuByCompany['DAHANA'];
    if (mmuByCompany['MNK-KMB'].length > 0) SUPPLIER_MMU_PRESETS['MNK-KMB'] = mmuByCompany['MNK-KMB'];

    if (rosterByCompany['DAHANA'].pengawas.length > 0) SUPPLIER_PERSONNEL_ROSTER['DAHANA'].pengawas = rosterByCompany['DAHANA'].pengawas;
    if (rosterByCompany['DAHANA'].blaster.length > 0) SUPPLIER_PERSONNEL_ROSTER['DAHANA'].blaster = rosterByCompany['DAHANA'].blaster;
    if (rosterByCompany['MNK-KMB'].pengawas.length > 0) SUPPLIER_PERSONNEL_ROSTER['MNK-KMB'].pengawas = rosterByCompany['MNK-KMB'].pengawas;
    if (rosterByCompany['MNK-KMB'].blaster.length > 0) SUPPLIER_PERSONNEL_ROSTER['MNK-KMB'].blaster = rosterByCompany['MNK-KMB'].blaster;
  }
}

// Daftar Lengkap Nama Pengawas dan Blaster Default Onsite
const SUPPLIER_PERSONNEL_ROSTER = {
  'DAHANA': {
    title: 'Pengawas dan Blaster Dahana',
    pengawas: [
      'Bakery', 'Xaverius', 'Arman', 'Teguh', 'Hairi',
      'Abu', 'Athaul', 'Rendi', 'Ade', 'Agam'
    ],
    blaster: [
      'Hendry', 'Saprul', 'Ihsan', 'Tumadi', 'Ady P',
      'Aulia', 'Bayu', 'Marwandi', 'Rahmadi', 'Rizal (ast blaster)'
    ]
  },
  'MNK-KMB': {
    title: 'Pengawas dan Blaster MNK-KMB',
    pengawas: [
      'Sahlan', 'Dayat', 'Ideris', 'Jekson',
      'Rolly', 'Badrianoor', 'Mahadir', 'Sepiyanus'
    ],
    blaster: [
      'Faisal', 'Henderi', 'Doni', 'Eko',
      'Khamim', 'Ardani', 'Ari', 'Arfi'
    ]
  }
};

// Konfigurasi Pilihan Status Peledakan & Visual Badge
const BLASTING_STATUS_CONFIG = {
  'TODAY': {
    label: 'TODAY',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    dotColor: 'bg-emerald-500',
    mapColor: '#16a34a'
  },
  'SLEEP': {
    label: 'SLEEP',
    badgeClass: 'bg-red-100 text-red-800 border-red-300',
    dotColor: 'bg-red-500',
    mapColor: '#dc2626'
  },
  'TIE UP': {
    label: 'TIE UP',
    badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
    dotColor: 'bg-amber-500',
    mapColor: '#d97706'
  },
  'TIE UP + TODAY': {
    label: 'TIE UP + TODAY',
    badgeClass: 'bg-blue-100 text-blue-900 border-blue-300',
    dotColor: 'bg-blue-600',
    mapColor: '#2563eb'
  },
  'TODAY/SLEEP': {
    label: 'TODAY/SLEEP',
    badgeClass: 'bg-slate-200 text-slate-800 border-slate-300',
    dotColor: 'bg-slate-500',
    mapColor: '#64748b'
  },
  'CANCEL/HOLD': {
    label: 'CANCEL/HOLD',
    badgeClass: 'bg-stone-800 text-stone-100 border-stone-900',
    dotColor: 'bg-rose-400',
    mapColor: '#292524'
  }
};

// Kolom Tersedia untuk Export Excel & WhatsApp
const EXPORT_AVAILABLE_COLUMNS = [
  { id: 'no', label: 'NO', default: true },
  { id: 'lokasi', label: 'LOKASI', default: true },
  { id: 'prioritas', label: 'PRIORITAS', default: true },
  { id: 'today_sleep', label: 'TODAY / SLEEP', default: true },
  { id: 'inisiasi', label: 'INISIASI', default: true },
  { id: 'jam_masuk', label: 'JAM MASUK', default: true },
  { id: 'remark', label: 'REMARK', default: true },
  { id: 'pengawas', label: 'PENGAWAS KONT.', default: true },
  { id: 'holes', label: 'JUMLAH HOLES', default: true },
  { id: 'isian', label: 'ISIAN (KG)', default: true },
  { id: 'volume', label: 'VOLUME DTH (TON)', default: true },
  { id: 'akses', label: 'AKSES', default: true },
  { id: 'desa', label: 'DESA', default: true },
  { id: 'matrix', label: 'MATRIX ISIAN', default: true },
  { id: 'geometri', label: 'GEOMETRI', default: true },
  { id: 'supplier', label: 'SUPPLIER', default: true },
  { id: 'pengawas_sup', label: 'PENGAWAS SUPPLIER', default: true },
  { id: 'blaster', label: 'BLASTER', default: true },
  { id: 'unit_mmu', label: 'UNIT MMU/MMT', default: true },
  { id: 'unit_box', label: 'MOBIL BOX', default: true }
];

let selectedExportColumnIds = new Set(EXPORT_AVAILABLE_COLUMNS.filter(c => c.default).map(c => c.id));

