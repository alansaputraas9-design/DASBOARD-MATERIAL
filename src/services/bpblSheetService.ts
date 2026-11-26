import { fetchPublicGoogleSheetCsv, parseGoogleSheetUrl } from './sheetsService';

export const BPBL_SPREADSHEET_ID = '1yo4S21g-YaG9lMIlCd82g-ZENcMeG9eh';

export const BPBL_SPREADSHEET_EDIT_URL =
  'https://docs.google.com/spreadsheets/d/1yo4S21g-YaG9lMIlCd82g-ZENcMeG9eh/edit?gid=1826313696#gid=1826313696';

export type BpblTabId = 'gowa';

export interface BpblTabMeta {
  id: BpblTabId;
  gid: string;
  name: string;
  subtitle: string;
}

export const BPBL_TABS: BpblTabMeta[] = [
  {
    id: 'gowa',
    gid: '1826313696',
    name: 'Kab. Gowa (gid=1826313696)',
    subtitle: 'Daftar Usulan Penerima BPBL T.A 2026 Kabupaten Gowa (ULP Kalebajeng & Takalar)',
  },
];

export type BpblProgressStage =
  | 'Sudah Terpasang'
  | 'Aktivasi Meter (Sisa Cetak)'
  | 'BP PLN Lunas (Proses Penyambungan)'
  | 'NIDI & SLO Terbit (Proses BP PLN)'
  | 'Proses Penugasan NIDI & SLO'
  | 'Diganti'
  | 'Layak Teknis / Usulan';

export interface BpblRecord {
  id: string;
  no: string;
  isPengganti: boolean;
  kecamatan: string;
  desa: string;
  alamat: string;
  kepalaKeluarga: string;
  namaPenerima: string;
  nik: string;
  kk: string;
  jenisKelamin: string;
  pekerjaan: string;
  sumberListrik: string;
  desil: string;
  noTlp: string;
  koordinat: string;
  maps: string;
  eviden: string;
  layakTeknisPln: string;
  noNidi: string;
  periodeNidi: string;
  noRegistrasiSlo: string;
  noSlo: string;
  keteranganInstalasi: string;
  noRegisterPln: string;
  dokumentasiPemasangan: string;
  catatanLampiran: string;
  statusProgresAkhir: string;
  tarif: string;
  kwhKeterangan: string;
  stage: BpblProgressStage;
}

export interface BpblTabData {
  meta: BpblTabMeta;
  title: string;
  records: BpblRecord[];
  legendNotes: string[];
  fetchedAt: Date;
}

export function getBpblCsvUrl(
  gid: string,
  spreadsheetId: string = BPBL_SPREADSHEET_ID
): string {
  return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(
    spreadsheetId
  )}/export?format=csv&gid=${encodeURIComponent(gid)}`;
}

function parseCsvPreservingEmpty(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        currentCell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && next === '\n') i++;
      currentRow.push(currentCell.trim());
      rows.push(currentRow);
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += ch;
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    rows.push(currentRow);
  }

  return rows;
}

function normalizeHeader(h: string): string {
  return h
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function deriveNidiPeriod(noNidi: string): string {
  const upper = noNidi.trim().toUpperCase();
  if (!upper) return 'Belum Ada NIDI';
  if (upper.startsWith('I.10.2026')) return 'Okt 2026 (I.10)';
  if (upper.startsWith('I.11.2026')) return 'Nov 2026 (I.11)';
  if (upper.startsWith('I.12.2026')) return 'Des 2026 (I.12)';
  if (upper.startsWith('I.09.2026')) return 'Sep 2026 (I.09)';
  const parts = upper.split('.');
  if (parts.length >= 3) {
    return `${parts[0]}.${parts[1]}.${parts[2]}`;
  }
  return 'Lainnya';
}

function deriveStage(fields: {
  keteranganInstalasi: string;
  dokumentasiPemasangan: string;
  catatanLampiran: string;
  statusProgresAkhir: string;
  kwhKeterangan: string;
  noNidi: string;
  noSlo: string;
}): BpblProgressStage {
  const ketUpper = fields.keteranganInstalasi.toUpperCase();
  const dokUpper = fields.dokumentasiPemasangan.toUpperCase();
  const catUpper = fields.catatanLampiran.toUpperCase();
  const progUpper = fields.statusProgresAkhir.toUpperCase();
  const kwhUpper = fields.kwhKeterangan.toUpperCase();
  const combinedStatus = `${progUpper} ${dokUpper} ${catUpper} ${kwhUpper}`;

  if (ketUpper === 'DIGANTI' || progUpper === 'DIGANTI') {
    return 'Diganti';
  }
  if (combinedStatus.includes('SUDAH TERPASANG') || kwhUpper === 'TERPASANG' || dokUpper === 'TERPASANG') {
    return 'Sudah Terpasang';
  }
  if (combinedStatus.includes('AKTIVASI') || combinedStatus.includes('AKTVASI')) {
    return 'Aktivasi Meter (Sisa Cetak)';
  }
  if (
    ketUpper.includes('LUNAS') ||
    ketUpper.includes('TERBAYAR') ||
    dokUpper.includes('TERBAYAR') ||
    dokUpper.includes('LUNAS')
  ) {
    return 'BP PLN Lunas (Proses Penyambungan)';
  }
  if (
    ketUpper.includes('NIDI SLO (TERBIT)') ||
    (fields.noNidi.trim().length > 0 && fields.noSlo.trim().length > 0)
  ) {
    return 'NIDI & SLO Terbit (Proses BP PLN)';
  }
  if (ketUpper.includes('PENUGASAN') || ketUpper.includes('NIDI')) {
    return 'Proses Penugasan NIDI & SLO';
  }
  return 'Layak Teknis / Usulan';
}

export function parseBpblCsvText(csvText: string, meta: BpblTabMeta): BpblTabData {
  const rows = parseCsvPreservingEmpty(csvText);

  let headerRowIdx = -1;
  for (let r = 0; r < Math.min(rows.length, 20); r++) {
    const row = rows[r] || [];
    const normalized = row.map(normalizeHeader);
    if (
      normalized.some((c) => c === 'KECAMATAN') &&
      normalized.some((c) => c.includes('NAMA PENERIMA'))
    ) {
      headerRowIdx = r;
      break;
    }
  }

  let title = meta.subtitle;
  if (headerRowIdx > 0) {
    for (let r = 0; r < headerRowIdx; r++) {
      const nonEmpty = (rows[r] || []).map((c) => c.trim()).filter(Boolean);
      if (nonEmpty.length > 0) {
        title = nonEmpty.join(' · ');
        break;
      }
    }
  }

  if (headerRowIdx === -1) {
    return {
      meta,
      title,
      records: [],
      legendNotes: [],
      fetchedAt: new Date(),
    };
  }

  const headerRow = (rows[headerRowIdx] || []).map(normalizeHeader);
  const findCol = (...candidates: string[]): number => {
    for (const cand of candidates) {
      const idx = headerRow.findIndex((h) => h === cand);
      if (idx !== -1) return idx;
    }
    for (const cand of candidates) {
      const idx = headerRow.findIndex((h) => h.includes(cand));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const colNo = findCol('NO');
  const colKec = findCol('KECAMATAN');
  const colDesa = findCol('DESA/KELURAHAN', 'DESA');
  const colAlamat = findCol('ALAMAT');
  const colKkHead = findCol('KEPALA KELUARGA');
  const colNama = findCol('NAMA PENERIMA');
  const colNik = findCol('NIK');
  const colKkNum = findCol('KK');
  const colGender = findCol('JENIS KELAMIN');
  const colJob = findCol('PEKERJAAN');
  const colSumber = findCol('SUMBER LISTRIK');
  const colDesil = findCol('DESIL');
  const colTlp = findCol('NO TLP', 'TLP (PIC)', 'TLP');
  const colKoord = findCol('TITIK KOORDINAT', 'KOORDINAT');
  const colMaps = findCol('MAPS');
  const colEviden = findCol('EVIDEN', 'FOTO');
  const colLayak = findCol('LAYAK TEKNIS PLN');
  const colNidi = findCol('NO NIDI');
  const colRegSlo = findCol('NO REGISTRASI SLO');
  const colSlo = findCol('NO SLO');
  const colKetInst = findCol('KETERANGAN INSTALASI', 'KETERANGAN', 'KET');
  const colRegPln = findCol('NO REGISTER PASANG BARU PLN', 'ID PELANGGAN');
  const colDok = findCol('DOKUMENTASI PEMASANGAN');
  const colKwh = findCol('KWH');
  const colTarif = findCol('TARIF');

  const records: BpblRecord[] = [];
  const legendNotes: string[] = [];
  let inPenggantiBlock = false;

  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const nonEmptyCells = row.map((c) => c.trim()).filter(Boolean);
    if (nonEmptyCells.length === 0) continue;

    const firstText = nonEmptyCells[0].toUpperCase();
    if (firstText === 'PENGGANTI') {
      inPenggantiBlock = true;
      continue;
    }

    if (
      firstText.startsWith('WARNA ') ||
      firstText.includes('RUMAH SELESAI') ||
      firstText === 'OK'
    ) {
      legendNotes.push(nonEmptyCells.join(' — '));
      continue;
    }

    const rowUpper = row.map(normalizeHeader);
    if (
      rowUpper.some((c) => c === 'KECAMATAN') &&
      rowUpper.some((c) => c.includes('NAMA PENERIMA'))
    ) {
      continue;
    }

    const get = (idx: number): string => (idx >= 0 ? (row[idx] || '').trim() : '');

    const namaPenerima = get(colNama);
    const kecamatan = get(colKec);
    const kepalaKeluarga = get(colKkHead);

    if (!namaPenerima && !kecamatan && !kepalaKeluarga) {
      if (nonEmptyCells.some((c) => c.toUpperCase().includes('WARNA'))) {
        legendNotes.push(nonEmptyCells.join(' — '));
      }
      continue;
    }

    const no = get(colNo) || String(records.length + 1);
    const noNidi = get(colNidi);
    const noSlo = get(colSlo);
    const keteranganInstalasi = get(colKetInst);
    const dokumentasiPemasangan = get(colDok);
    const catatanLampiran =
      colDok >= 0 && row[colDok + 1] ? row[colDok + 1].trim() : '';
    const statusProgresAkhir =
      colDok >= 0 && row[colDok + 2] ? row[colDok + 2].trim() : '';
    const kwhKeterangan = get(colKwh);

    const stage = deriveStage({
      keteranganInstalasi,
      dokumentasiPemasangan,
      catatanLampiran,
      statusProgresAkhir,
      kwhKeterangan,
      noNidi,
      noSlo,
    });

    records.push({
      id: `${meta.id}-${r}-${no}`,
      no,
      isPengganti:
        inPenggantiBlock ||
        catatanLampiran.toLowerCase().includes('menggantikan') ||
        dokumentasiPemasangan.toLowerCase().includes('menggantikan') ||
        keteranganInstalasi.toLowerCase().includes('mengganti'),
      kecamatan,
      desa: get(colDesa),
      alamat: get(colAlamat),
      kepalaKeluarga,
      namaPenerima: namaPenerima || kepalaKeluarga,
      nik: get(colNik).replace(/^'+/, ''),
      kk: get(colKkNum).replace(/^'+/, ''),
      jenisKelamin: get(colGender),
      pekerjaan: get(colJob),
      sumberListrik: get(colSumber),
      desil: get(colDesil),
      noTlp: get(colTlp),
      koordinat: get(colKoord),
      maps: get(colMaps),
      eviden: get(colEviden),
      layakTeknisPln: get(colLayak),
      noNidi,
      periodeNidi: deriveNidiPeriod(noNidi),
      noRegistrasiSlo: get(colRegSlo),
      noSlo,
      keteranganInstalasi,
      noRegisterPln: get(colRegPln),
      dokumentasiPemasangan,
      catatanLampiran,
      statusProgresAkhir,
      tarif: get(colTarif),
      kwhKeterangan,
      stage,
    });
  }

  return {
    meta,
    title,
    records,
    legendNotes,
    fetchedAt: new Date(),
  };
}

export async function fetchBpblTab(
  tabIdOrUrl: BpblTabId | string = 'gowa'
): Promise<BpblTabData> {
  const knownTab = BPBL_TABS.find((t) => t.id === tabIdOrUrl);
  let spreadsheetId = BPBL_SPREADSHEET_ID;
  let gid = knownTab?.gid || '1826313696';
  let meta: BpblTabMeta = knownTab || BPBL_TABS[0];

  if (!knownTab) {
    const parsed = parseGoogleSheetUrl(tabIdOrUrl);
    if (parsed.spreadsheetId) {
      spreadsheetId = parsed.spreadsheetId;
      if (parsed.gid !== null) {
        gid = String(parsed.gid);
      }
      const matchingTab = BPBL_TABS.find((t) => t.gid === gid);
      meta = matchingTab || {
        id: 'gowa',
        gid,
        name: `Sheet gid=${gid}`,
        subtitle: `Sinkronisasi Spreadsheet ${spreadsheetId} (gid=${gid})`,
      };
    }
  }

  const csvText = await fetchPublicGoogleSheetCsv(
    spreadsheetId,
    gid,
    meta.name
  );

  return parseBpblCsvText(csvText, meta);
}

export function exportBpblRecordsToCSV(
  tabName: string,
  records: BpblRecord[]
) {
  const escape = (val: string | number | boolean | null | undefined) => {
    const str = val === null || val === undefined ? '' : String(val);
    return `"${str.replace(/"/g, '""')}"`;
  };

  const headers = [
    'No',
    'Status Baris',
    'Kecamatan',
    'Desa/Kelurahan',
    'Alamat/Dusun',
    'Kepala Keluarga',
    'Nama Penerima',
    'NIK',
    'No KK',
    'Jenis Kelamin',
    'Pekerjaan',
    'Sumber Listrik',
    'Desil',
    'No TLP',
    'Koordinat',
    'Layak Teknis PLN',
    'No NIDI',
    'Periode NIDI',
    'No Registrasi SLO',
    'No SLO',
    'Keterangan Instalasi',
    'No Register Pasang Baru PLN',
    'Dokumentasi Pemasangan',
    'Catatan Lampiran',
    'Status Progres Akhir',
    'Tahap Progres',
  ];

  const rows = records.map((r) => [
    r.no,
    r.isPengganti ? 'PENGGANTI' : 'UTAMA',
    r.kecamatan,
    r.desa,
    r.alamat,
    r.kepalaKeluarga,
    r.namaPenerima,
    r.nik,
    r.kk,
    r.jenisKelamin,
    r.pekerjaan,
    r.sumberListrik,
    r.desil,
    r.noTlp,
    r.koordinat,
    r.layakTeknisPln,
    r.noNidi,
    r.periodeNidi,
    r.noRegistrasiSlo,
    r.noSlo,
    r.keteranganInstalasi,
    r.noRegisterPln,
    r.dokumentasiPemasangan,
    r.catatanLampiran,
    r.statusProgresAkhir,
    r.stage,
  ]);

  const csv = [
    headers.map(escape).join(','),
    ...rows.map((r) => r.map(escape).join(',')),
  ].join('\n');

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bpbl-${tabName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${new Date()
    .toISOString()
    .slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
