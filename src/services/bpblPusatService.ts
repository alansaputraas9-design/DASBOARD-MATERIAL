import { fetchPublicGoogleSheetCsv, parseDelimitedText } from './sheetsService';

export const BPBL_PUSAT_SPREADSHEET_ID =
  '1yOAIhNvgfI7fhs5_adrznVPYvp6A9hpG8UyN6uhHgeQ';
export const BPBL_PUSAT_GID = '0';
export const BPBL_PUSAT_SPREADSHEET_EDIT_URL = `https://docs.google.com/spreadsheets/d/${BPBL_PUSAT_SPREADSHEET_ID}/edit?gid=${BPBL_PUSAT_GID}#gid=${BPBL_PUSAT_GID}`;

export interface BpblPusatRecord {
  id: string;
  no: string;
  namaPelanggan: string;
  kabupatenKota: string;
  kodeKecamatan: string;
  kecamatan: string;
  kodeKelurahan: string;
  desaKelurahan: string;
  alamat: string;
  nik: string;
  namaKk: string;
  nomorKk: string;
  kodeUiw: string;
  namaUiw: string;
  kodeUp3: string;
  namaUp3: string;
  kodeUlp: string;
  namaUlp: string;
  sumberData: string;
  dokumentasiInstalasi: string;
}

export type BpblPusatGroupBy =
  | 'kecamatan'
  | 'desa'
  | 'alamat'
  | 'sumberData'
  | 'kabupaten'
  | 'unitPln'
  | 'dokumentasi';

export interface BpblPusatGroupSummary {
  key: string;
  label: string;
  code?: string;
  parentLabel?: string;
  count: number;
  percentage: number;
  subBreakdown: Array<{ label: string; count: number }>;
  dokumentasiTerisi: number;
  records: BpblPusatRecord[];
}

export interface BpblPusatDataset {
  title: string;
  spreadsheetId: string;
  gid: string;
  fetchedAt: Date;
  records: BpblPusatRecord[];
}

function cleanIdentifierCell(raw: string | undefined): string {
  if (!raw) return '';
  return raw.trim().replace(/^'+/, '').trim();
}

function normalizeHeaderName(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function findColumnIndex(headers: string[], candidates: string[]): number {
  const normalized = headers.map(normalizeHeaderName);
  for (const candidate of candidates) {
    const idx = normalized.indexOf(normalizeHeaderName(candidate));
    if (idx !== -1) return idx;
  }
  for (const candidate of candidates) {
    const target = normalizeHeaderName(candidate);
    const idx = normalized.findIndex((h) => h.includes(target));
    if (idx !== -1) return idx;
  }
  return -1;
}

export function parseBpblPusatCsv(csvText: string): BpblPusatRecord[] {
  const rows = parseDelimitedText(csvText);
  if (rows.length === 0) return [];

  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(8, rows.length); i++) {
    const joined = rows[i].map(normalizeHeaderName).join(' ');
    if (joined.includes('NAMAPELANGGAN') || joined.includes('KECAMATAN')) {
      headerRowIdx = i;
      break;
    }
  }

  const headers = rows[headerRowIdx];
  const idxNo = findColumnIndex(headers, ['NO']);
  const idxNama = findColumnIndex(headers, ['NAMA_PELANGGAN', 'NAMAPELANGGAN']);
  const idxKab = findColumnIndex(headers, ['KABUPATENKOTA', 'KABUPATEN']);
  const idxKdKec = findColumnIndex(headers, ['KD_KEC', 'KODEKECAMATAN']);
  const idxKec = findColumnIndex(headers, ['KECAMATAN']);
  const idxKdKel = findColumnIndex(headers, ['KD_KEL', 'KODEKELURAHAN']);
  const idxDesa = findColumnIndex(headers, ['DESAKELURAHAN', 'DESA']);
  const idxAlamat = findColumnIndex(headers, ['ALAMAT']);
  const idxNik = findColumnIndex(headers, ['NIK']);
  const idxNamaKk = findColumnIndex(headers, ['NAMAKK']);
  const idxNoKk = findColumnIndex(headers, ['NOMORKK', 'NOKK']);
  const idxKdUiw = findColumnIndex(headers, ['UIW/UID', 'UIWUID']);
  const idxNamaUiw = findColumnIndex(headers, ['NAMA UIW/UID', 'NAMAUIWUID']);
  const idxKdUp3 = findColumnIndex(headers, ['UP3']);
  const idxNamaUp3 = findColumnIndex(headers, ['NAMA UP3', 'NAMAUP3']);
  const idxKdUlp = findColumnIndex(headers, ['ULP']);
  const idxNamaUlp = findColumnIndex(headers, ['NAMA ULP', 'NAMAULP']);
  const idxSumber = findColumnIndex(headers, ['SUMBER DATA', 'SUMBERDATA']);
  const idxDok = findColumnIndex(headers, [
    'DOKUMENTASI PEMASANGAN INSTALASI',
    'DOKUMENTASIPEMASANGANINSTALASI',
    'DOKUMENTASI',
  ]);

  const records: BpblPusatRecord[] = [];
  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    const namaPelanggan = cleanIdentifierCell(
      idxNama >= 0 ? row[idxNama] : row[1]
    );
    const nik = cleanIdentifierCell(idxNik >= 0 ? row[idxNik] : row[8]);
    const kecamatan = cleanIdentifierCell(idxKec >= 0 ? row[idxKec] : row[4]);
    const desaKelurahan = cleanIdentifierCell(
      idxDesa >= 0 ? row[idxDesa] : row[6]
    );

    if (!namaPelanggan && !nik && !kecamatan && !desaKelurahan) continue;

    const no = cleanIdentifierCell(idxNo >= 0 ? row[idxNo] : row[0]);
    if (no.toUpperCase() === 'TOTAL' || namaPelanggan.toUpperCase() === 'TOTAL') {
      continue;
    }

    records.push({
      id: `bpbl-pusat-${r}-${no || records.length + 1}`,
      no: no || String(records.length + 1),
      namaPelanggan: namaPelanggan || '—',
      kabupatenKota:
        cleanIdentifierCell(idxKab >= 0 ? row[idxKab] : row[2]) || '—',
      kodeKecamatan: cleanIdentifierCell(
        idxKdKec >= 0 ? row[idxKdKec] : row[3]
      ),
      kecamatan: kecamatan || 'Tidak Tercantum',
      kodeKelurahan: cleanIdentifierCell(
        idxKdKel >= 0 ? row[idxKdKel] : row[5]
      ),
      desaKelurahan: desaKelurahan || 'Tidak Tercantum',
      alamat: cleanIdentifierCell(idxAlamat >= 0 ? row[idxAlamat] : row[7]) || '—',
      nik,
      namaKk: cleanIdentifierCell(idxNamaKk >= 0 ? row[idxNamaKk] : row[9]),
      nomorKk: cleanIdentifierCell(idxNoKk >= 0 ? row[idxNoKk] : row[10]),
      kodeUiw: cleanIdentifierCell(idxKdUiw >= 0 ? row[idxKdUiw] : row[11]),
      namaUiw: cleanIdentifierCell(idxNamaUiw >= 0 ? row[idxNamaUiw] : row[12]),
      kodeUp3: cleanIdentifierCell(idxKdUp3 >= 0 ? row[idxKdUp3] : row[13]),
      namaUp3: cleanIdentifierCell(idxNamaUp3 >= 0 ? row[idxNamaUp3] : row[14]),
      kodeUlp: cleanIdentifierCell(idxKdUlp >= 0 ? row[idxKdUlp] : row[15]),
      namaUlp: cleanIdentifierCell(idxNamaUlp >= 0 ? row[idxNamaUlp] : row[16]),
      sumberData:
        cleanIdentifierCell(idxSumber >= 0 ? row[idxSumber] : row[17]) ||
        'Belum Terisi',
      dokumentasiInstalasi: cleanIdentifierCell(
        idxDok >= 0 ? row[idxDok] : row[18]
      ),
    });
  }

  return records;
}

export async function fetchBpblPusatData(): Promise<BpblPusatDataset> {
  const csvText = await fetchPublicGoogleSheetCsv(
    BPBL_PUSAT_SPREADSHEET_ID,
    BPBL_PUSAT_GID,
    'BPBL Anggaran Pusat 2026'
  );
  const records = parseBpblPusatCsv(csvText);

  return {
    title: 'BPBL ULP KBJ Anggaran Pusat Tahun 2026 (Sheet1 · gid=0)',
    spreadsheetId: BPBL_PUSAT_SPREADSHEET_ID,
    gid: BPBL_PUSAT_GID,
    fetchedAt: new Date(),
    records,
  };
}

export function groupBpblPusatRecords(
  records: BpblPusatRecord[],
  groupBy: BpblPusatGroupBy
): BpblPusatGroupSummary[] {
  const total = records.length;
  const map = new Map<
    string,
    {
      label: string;
      code?: string;
      parentLabel?: string;
      records: BpblPusatRecord[];
      subCounts: Map<string, number>;
      dokumentasiTerisi: number;
    }
  >();

  for (const r of records) {
    let key = '';
    let label = '';
    let code: string | undefined;
    let parentLabel: string | undefined;
    let subKey = '';

    switch (groupBy) {
      case 'kecamatan':
        key = r.kecamatan || 'Tidak Tercantum';
        label = key;
        code = r.kodeKecamatan ? `KD_KEC ${r.kodeKecamatan}` : undefined;
        parentLabel = r.kabupatenKota !== '—' ? r.kabupatenKota : undefined;
        subKey = r.desaKelurahan || 'Tanpa Desa';
        break;
      case 'desa':
        key = `${r.kecamatan}::${r.desaKelurahan}`;
        label = r.desaKelurahan || 'Tidak Tercantum';
        code = r.kodeKelurahan ? `KD_KEL ${r.kodeKelurahan}` : undefined;
        parentLabel = `Kec. ${r.kecamatan}`;
        subKey = r.alamat && r.alamat !== '—' ? r.alamat : 'Tanpa Alamat';
        break;
      case 'alamat':
        key = `${r.desaKelurahan}::${r.alamat}`;
        label = r.alamat || '—';
        parentLabel = `${r.desaKelurahan} · Kec. ${r.kecamatan}`;
        subKey = r.sumberData;
        break;
      case 'sumberData':
        key = r.sumberData || 'Belum Terisi';
        label = key;
        parentLabel = r.namaUlp || 'ULP KALEBAJENG';
        subKey = r.kecamatan;
        break;
      case 'kabupaten':
        key = r.kabupatenKota || '—';
        label = key;
        parentLabel = r.namaUp3 || 'UP3 MAKASSAR SELATAN';
        subKey = r.kecamatan;
        break;
      case 'unitPln':
        key = `${r.kodeUlp || ''} ${r.namaUlp || 'Belum Terisi'}`.trim();
        label = r.namaUlp || 'Belum Terisi';
        code = [r.kodeUiw, r.kodeUp3, r.kodeUlp].filter(Boolean).join(' · ');
        parentLabel = [r.namaUiw, r.namaUp3].filter(Boolean).join(' · ');
        subKey = r.kecamatan;
        break;
      case 'dokumentasi':
        key = r.dokumentasiInstalasi
          ? 'Sudah Ada Dokumentasi'
          : 'Belum Ada Dokumentasi';
        label = key;
        parentLabel = 'Kolom Dokumentasi Pemasangan Instalasi';
        subKey = r.kecamatan;
        break;
    }

    const entry = map.get(key) || {
      label,
      code,
      parentLabel,
      records: [],
      subCounts: new Map<string, number>(),
      dokumentasiTerisi: 0,
    };

    entry.records.push(r);
    if (r.dokumentasiInstalasi) {
      entry.dokumentasiTerisi += 1;
    }
    if (subKey) {
      entry.subCounts.set(subKey, (entry.subCounts.get(subKey) || 0) + 1);
    }
    map.set(key, entry);
  }

  return Array.from(map.entries())
    .map(([key, entry]) => ({
      key,
      label: entry.label,
      code: entry.code,
      parentLabel: entry.parentLabel,
      count: entry.records.length,
      percentage: total > 0 ? (entry.records.length / total) * 100 : 0,
      subBreakdown: Array.from(entry.subCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([subLabel, count]) => ({ label: subLabel, count })),
      dokumentasiTerisi: entry.dokumentasiTerisi,
      records: entry.records,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'id-ID'));
}

export function exportBpblPusatToCSV(
  records: BpblPusatRecord[],
  label = 'semua-data'
): void {
  const headers = [
    'NO',
    'NAMA_PELANGGAN',
    'KABUPATENKOTA',
    'KD_KEC',
    'KECAMATAN',
    'KD_KEL',
    'DESAKELURAHAN',
    'ALAMAT',
    'NIK',
    'NAMAKK',
    'NOMORKK',
    'UIW/UID',
    'NAMA UIW/UID',
    'UP3',
    'NAMA UP3',
    'ULP',
    'NAMA ULP',
    'SUMBER DATA',
    'DOKUMENTASI PEMASANGAN INSTALASI',
  ];

  const escapeCsv = (val: string) => `"${String(val ?? '').replace(/"/g, '""')}"`;

  const lines = [
    headers.map(escapeCsv).join(','),
    ...records.map((r) =>
      [
        r.no,
        r.namaPelanggan,
        r.kabupatenKota,
        r.kodeKecamatan,
        r.kecamatan,
        r.kodeKelurahan,
        r.desaKelurahan,
        r.alamat,
        r.nik ? `'${r.nik}` : '',
        r.namaKk,
        r.nomorKk ? `'${r.nomorKk}` : '',
        r.kodeUiw,
        r.namaUiw,
        r.kodeUp3,
        r.namaUp3,
        r.kodeUlp,
        r.namaUlp,
        r.sumberData,
        r.dokumentasiInstalasi,
      ]
        .map(escapeCsv)
        .join(',')
    ),
  ];

  const blob = new Blob([lines.join('\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeName = label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  link.href = url;
  link.setAttribute('download', `bpbl-anggaran-pusat-2026-${safeName}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
