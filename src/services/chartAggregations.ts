import { HorizontalBarDatum, DonutSegment, VerticalBarPoint } from '../components/Charts';
import { parseSignedNumericCell } from './sheetsService';
import { ParsedWorkbookSheet } from './workbookService';

const MONTH_SHORT_ID = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];

export function parseMonthBucket(rawDate: string): {
  sortKey: string;
  label: string;
} | null {
  const cleaned = String(rawDate || '').trim();
  if (!cleaned) return null;

  // Match DD/MM/YYYY or D/M/YYYY
  const dmy = cleaned.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (dmy) {
    const month = Number(dmy[2]);
    let year = Number(dmy[3]);
    if (year < 100) year += 2000;
    if (month >= 1 && month <= 12 && year >= 2000 && year <= 2100) {
      const mPad = String(month).padStart(2, '0');
      return {
        sortKey: `${year}-${mPad}`,
        label: `${MONTH_SHORT_ID[month - 1]} ${String(year).slice(-2)}`,
      };
    }
  }

  // Match YYYY-MM-DD
  const ymd = cleaned.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (ymd) {
    const year = Number(ymd[1]);
    const month = Number(ymd[2]);
    if (month >= 1 && month <= 12) {
      const mPad = String(month).padStart(2, '0');
      return {
        sortKey: `${year}-${mPad}`,
        label: `${MONTH_SHORT_ID[month - 1]} ${String(year).slice(-2)}`,
      };
    }
  }

  return null;
}

export interface SheetChartBundle {
  leftTitle: string;
  leftSubtitle: string;
  leftType: 'vertical' | 'horizontal';
  leftVerticalData?: VerticalBarPoint[];
  leftVerticalPrimaryLabel?: string;
  leftHorizontalData?: HorizontalBarDatum[];
  rightTitle: string;
  rightSubtitle: string;
  rightType: 'donut' | 'horizontal' | 'vertical';
  rightDonutSegments?: DonutSegment[];
  rightDonutCenterTitle?: string;
  rightDonutCenterValue?: string;
  rightHorizontalData?: HorizontalBarDatum[];
  rightVerticalData?: VerticalBarPoint[];
  rightVerticalPrimaryLabel?: string;
}

export function buildMonthlyTrendFromWorkbookSheet(
  sheet: ParsedWorkbookSheet,
  qtyColIdx: number,
  dateColIdx = 0
): Array<{ sortKey: string; label: string; total: number }> {
  const buckets = new Map<string, { label: string; total: number }>();

  for (const row of sheet.rows) {
    const bucket = parseMonthBucket(row[dateColIdx] ?? '');
    if (!bucket) continue;
    const qty = Math.max(0, parseSignedNumericCell(row[qtyColIdx]));
    const existing = buckets.get(bucket.sortKey);
    if (existing) {
      existing.total += qty;
    } else {
      buckets.set(bucket.sortKey, { label: bucket.label, total: qty });
    }
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([sortKey, v]) => ({
      sortKey,
      label: v.label,
      total: Math.round(v.total * 100) / 100,
    }));
}

function aggregateByCategory(
  rows: string[][],
  labelIdx: number,
  valueIdx: number | null,
  subLabelIdx: number | null,
  limit: number,
  color: string
): HorizontalBarDatum[] {
  const map = new Map<string, { label: string; subLabel?: string; value: number }>();

  for (const row of rows) {
    const rawLabel = String(row[labelIdx] ?? '').trim();
    if (!rawLabel || /^#N\/A$/i.test(rawLabel)) continue;
    const key = rawLabel.toUpperCase();
    const val = valueIdx !== null ? parseSignedNumericCell(row[valueIdx]) : 1;
    const subLabel =
      subLabelIdx !== null ? String(row[subLabelIdx] ?? '').trim() : undefined;

    const existing = map.get(key);
    if (existing) {
      existing.value += val;
    } else {
      map.set(key, {
        label: rawLabel,
        subLabel: subLabel || undefined,
        value: val,
      });
    }
  }

  return Array.from(map.values())
    .filter((d) => d.value !== 0)
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    .slice(0, limit)
    .map((d) => ({
      label: d.label,
      subLabel: d.subLabel,
      value: Math.round(d.value * 100) / 100,
      color,
    }));
}

export function buildChartsForWorkbookSheet(
  sheet: ParsedWorkbookSheet
): SheetChartBundle | null {
  if (!sheet || sheet.rows.length === 0) return null;

  const gid = sheet.meta.gid;

  // 1. Varian Material (gid=733005147)
  if (gid === '733005147') {
    const nameIdx = sheet.headers.findIndex((h) => /nama\s*material/i.test(h));
    const unitIdx = sheet.headers.findIndex((h) => /satuan/i.test(h));
    const stockSiapIdx = sheet.headers.findIndex((h) => /^stock\s*siap$/i.test(h));

    const topItems =
      nameIdx >= 0 && stockSiapIdx >= 0
        ? sheet.rows
            .map((r) => ({
              label: r[nameIdx] || '-',
              subLabel: unitIdx >= 0 ? r[unitIdx] : undefined,
              value: parseSignedNumericCell(r[stockSiapIdx]),
              color: '#0e7490',
            }))
            .filter((x) => x.value > 0)
            .sort((a, b) => b.value - a.value)
            .slice(0, 8)
        : [];

    const bucketDefs = [
      { label: 'Stock Siap', pattern: /^stock\s*siap$/i, color: '#0e7490' },
      { label: 'Fisik Unit', pattern: /^stock\s*fisik\s*unit$/i, color: '#4f46e5' },
      { label: 'Fisik Yantek', pattern: /^stock\s*fisik\s*yantek$/i, color: '#059669' },
      { label: 'Retur', pattern: /^stock\s*retur$/i, color: '#d97706' },
      { label: 'Fisik Yanbung', pattern: /^stock\s*fisik\s*yanbung$/i, color: '#0284c7' },
      { label: 'Reservasi', pattern: /^stock\s*reservasi$/i, color: '#dc2626' },
    ];

    const segments: DonutSegment[] = bucketDefs
      .map((def) => {
        const colIdx = sheet.headers.findIndex((h) => def.pattern.test(h));
        if (colIdx < 0) return { label: def.label, value: 0, color: def.color };
        const sum = sheet.rows.reduce(
          (acc, r) => acc + Math.max(0, parseSignedNumericCell(r[colIdx])),
          0
        );
        return { label: def.label, value: Math.round(sum), color: def.color };
      })
      .filter((s) => s.value > 0);

    const totalAll = segments.reduce((s, x) => s + x.value, 0);

    return {
      leftTitle: '8 Material dengan Stock Siap Terbesar',
      leftSubtitle: 'Diurutkan dari varian dengan jumlah siap pakai tertinggi',
      leftType: 'horizontal',
      leftHorizontalData: topItems,
      rightTitle: 'Komposisi Kolom Stok Varian Material',
      rightSubtitle: 'Proporsi jumlah unit di setiap kategori penyimpanan',
      rightType: 'donut',
      rightDonutSegments: segments,
      rightDonutCenterTitle: 'Total Unit',
      rightDonutCenterValue: totalAll.toLocaleString('id-ID'),
    };
  }

  // 2. STOK (referensi) (gid=1192678235)
  if (gid === '1192678235') {
    const nameIdx = sheet.headers.findIndex((h) => /nama\s*harian|nama\s*material/i.test(h));
    const skuIdx = sheet.headers.findIndex((h) => /no\s*material/i.test(h));
    const siapIdx = sheet.headers.findIndex((h) => /stock\s*siap\s*pakai/i.test(h));
    const awalIdx = sheet.headers.findIndex((h) => /stock\s*awal\s*ago/i.test(h));
    const masukIdx = sheet.headers.findIndex((h) => /material\s*masuk/i.test(h));
    const keluarIdx = sheet.headers.findIndex((h) => /material\s*keluar/i.test(h));

    const topVariance =
      nameIdx >= 0 && siapIdx >= 0
        ? sheet.rows
            .map((r) => ({
              label: r[nameIdx] || '-',
              subLabel: skuIdx >= 0 ? r[skuIdx] : undefined,
              value: Math.round(parseSignedNumericCell(r[siapIdx]) * 100) / 100,
            }))
            .filter((x) => x.value !== 0)
            .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
            .slice(0, 8)
        : [];

    const sumCol = (idx: number) =>
      idx >= 0
        ? Math.round(
            sheet.rows.reduce((s, r) => s + parseSignedNumericCell(r[idx]), 0) * 100
          ) / 100
        : 0;

    const summaryBars: HorizontalBarDatum[] = [
      { label: 'STOCK AWAL AGO', value: sumCol(awalIdx), color: '#64748b' },
      { label: 'Material Masuk', value: sumCol(masukIdx), color: '#059669' },
      { label: 'Material Keluar', value: sumCol(keluarIdx), color: '#d97706' },
      { label: 'STOCK SIAP PAKAI', value: sumCol(siapIdx), color: '#0e7490' },
    ];

    return {
      leftTitle: '8 Material dengan Variansi Stock Siap Pakai Terbesar',
      leftSubtitle: 'Merah menandakan selisih minus / defisit dibanding catatan AGO',
      leftType: 'horizontal',
      leftHorizontalData: topVariance,
      rightTitle: 'Perbandingan Total Pergerakan (AGO Referensi)',
      rightSubtitle: 'Agregat seluruh 132 item referensi pada sheet ini',
      rightType: 'horizontal',
      rightHorizontalData: summaryBars,
    };
  }

  // 3. MATERIAL MASUK (gid=1600935918) & MATERIAL KELUAR (gid=478419117)
  if (gid === '1600935918' || gid === '478419117') {
    const isMasuk = gid === '1600935918';
    const qtyIdx = sheet.headers.findIndex((h) => /jumlah\s*material/i.test(h));
    const nameIdx = sheet.headers.findIndex((h) => /nama\s*material/i.test(h));
    const skuIdx = sheet.headers.findIndex((h) => /nomor\s*material/i.test(h));

    const monthly =
      qtyIdx >= 0 ? buildMonthlyTrendFromWorkbookSheet(sheet, qtyIdx, 0) : [];
    const topItems =
      nameIdx >= 0 && qtyIdx >= 0
        ? aggregateByCategory(
            sheet.rows,
            nameIdx,
            qtyIdx,
            skuIdx >= 0 ? skuIdx : null,
            8,
            isMasuk ? '#059669' : '#d97706'
          )
        : [];

    return {
      leftTitle: isMasuk
        ? 'Tren Bulanan Material Masuk'
        : 'Tren Bulanan Material Keluar',
      leftSubtitle: 'Agregasi kuantitas transaksi per bulan dari kolom Tanggal',
      leftType: 'vertical',
      leftVerticalData: monthly.map((m) => ({
        label: m.label,
        value: m.total,
      })),
      leftVerticalPrimaryLabel: isMasuk ? 'Material Masuk' : 'Material Keluar',
      rightTitle: isMasuk
        ? '8 Material Paling Banyak Diterima'
        : '8 Material Paling Banyak Dikeluarkan',
      rightSubtitle: `Total kumulatif sepanjang riwayat ${sheet.meta.name}`,
      rightType: 'horizontal',
      rightHorizontalData: topItems,
    };
  }

  // 4. Sheet5 (gid=669234199)
  if (gid === '669234199') {
    const petugasIdx = sheet.headers.findIndex((h) => /petugas/i.test(h));
    const pekerjaanIdx = sheet.headers.findIndex((h) => /pekerjaan/i.test(h));

    const topPetugas =
      petugasIdx >= 0
        ? aggregateByCategory(sheet.rows, petugasIdx, null, null, 8, '#0e7490')
        : [];

    const topJobs =
      pekerjaanIdx >= 0
        ? aggregateByCategory(sheet.rows, pekerjaanIdx, null, null, 5, '#4f46e5')
        : [];

    const palette = ['#0e7490', '#4f46e5', '#059669', '#d97706', '#64748b'];
    const totalShown = topJobs.reduce((s, j) => s + j.value, 0);
    const otherCount = Math.max(0, sheet.rows.length - totalShown);
    const segments: DonutSegment[] = topJobs.map((j, i) => ({
      label: j.label,
      value: j.value,
      color: palette[i % palette.length],
    }));
    if (otherCount > 0) {
      segments.push({ label: 'Lainnya', value: otherCount, color: '#94a3b8' });
    }

    return {
      leftTitle: '8 Petugas Penerima dengan Pengambilan Terbanyak',
      leftSubtitle: 'Berdasarkan jumlah baris catatan distribusi meter/material',
      leftType: 'horizontal',
      leftHorizontalData: topPetugas,
      rightTitle: 'Proporsi Kategori Pekerjaan',
      rightSubtitle: 'Distribusi jenis pekerjaan pada Sheet5',
      rightType: 'donut',
      rightDonutSegments: segments,
      rightDonutCenterTitle: 'Total Log',
      rightDonutCenterValue: sheet.rows.length.toLocaleString('id-ID'),
    };
  }

  // 5. Fallback for Sheet4 & Sheet1 (1)
  const prefixMap = new Map<string, number>();
  for (const row of sheet.rows) {
    const cell = String(row[0] ?? '').trim();
    if (!cell) continue;
    const prefix = /^\d+$/.test(cell)
      ? `Awalan ${cell.slice(0, 4)}***`
      : cell.split(/\s+/)[0].toUpperCase();
    prefixMap.set(prefix, (prefixMap.get(prefix) || 0) + 1);
  }
  const grouped = Array.from(prefixMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([label, value]) => ({ label, value, color: '#0e7490' }));

  const firstLetters = new Map<string, number>();
  for (const row of sheet.rows) {
    const ch = String(row[0] ?? '').trim().charAt(0).toUpperCase();
    if (!ch) continue;
    firstLetters.set(ch, (firstLetters.get(ch) || 0) + 1);
  }
  const letterBars = Array.from(firstLetters.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([label, value]) => ({ label, value }));

  return {
    leftTitle: `Pengelompokan Entri Teratas (${sheet.meta.name})`,
    leftSubtitle: `Berdasarkan ${sheet.rows.length.toLocaleString('id-ID')} entri yang terdaftar`,
    leftType: 'horizontal',
    leftHorizontalData: grouped,
    rightTitle: 'Frekuensi Karakter Awal Entri',
    rightSubtitle: 'Distribusi data berdasarkan digit/huruf pertama',
    rightType: 'vertical',
    rightVerticalData: letterBars,
    rightVerticalPrimaryLabel: 'Jumlah Entri',
  };
}
