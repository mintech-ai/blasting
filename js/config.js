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

// Presets MMU / MMT (Kapasitas DTH Ton) - MMT 28 diupdate ke 15 Ton per User Request
const SUPPLIER_MMU_PRESETS = {
  'DAHANA': [
    { code: 'MMT 18', cap: 16 },
    { code: 'MMT 25', cap: 17.5 },
    { code: 'MMT 26', cap: 17.5 },
    { code: 'MMT 13', cap: 16 },
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
  { id: 'unit_box', label: 'MOBIL BOX', default: true },
  { id: 'coordinates', label: 'KOORDINAT (LAT, LONG)', default: false },
  { id: 'geometry', label: 'WKT GEOMETRY (POLYGON)', default: false }
];

let selectedExportColumnIds = new Set(EXPORT_AVAILABLE_COLUMNS.filter(c => c.default).map(c => c.id));

