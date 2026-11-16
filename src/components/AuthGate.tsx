import { BellRing, Database, FileSpreadsheet, Layers } from 'lucide-react';

interface AuthGateProps {
  onSignIn: () => void;
  signingIn: boolean;
  error: string | null;
}

export function AuthGate({ onSignIn, signingIn, error }: AuthGateProps) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center px-6 py-12">
      <div className="max-w-4xl w-full mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12">
        <div className="lg:col-span-7 p-8 sm:p-10 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800">
          <div>
            <div className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 font-display">
              BinaLogistik
            </div>
            <h1 className="mt-6 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 leading-tight text-balance">
              Kontrol Stok Material Konstruksi Secara Real-Time
            </h1>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-lg">
              Pantau ketersediaan semen, baja tulangan, agregat, dan material proyek langsung dari Google Sheets serta database Firestore dengan log mutasi permanen dan notifikasi otomatis.
            </p>
          </div>

          <div className="mt-8 space-y-4">
            <div className="flex items-start gap-3">
              <FileSpreadsheet className="w-4 h-4 text-cyan-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  Sumber Data Google Sheets Terintegrasi
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Tarik daftar material dan saldo stok langsung dari link spreadsheet proyek Anda.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Database className="w-4 h-4 text-cyan-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  Sinkronisasi Database Real-Time
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Setiap pembaruan stok antar perangkat langsung tercatat dan tampil seketika tanpa muat ulang.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Layers className="w-4 h-4 text-cyan-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  Buku Besar Mutasi Atomik & Notifikasi Otomatis
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Pencatatan barang masuk/keluar tervalidasi dan peringatan menipis atau kritis terpicu otomatis.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <BellRing className="w-4 h-4 text-cyan-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  Peringatan Ambang Batas Otomatis
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Notifikasi aktif membantu tim logistik mencegah keterlambatan pengadaan di lapangan.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 p-8 sm:p-10 bg-slate-50/70 dark:bg-slate-950/40 flex flex-col justify-center">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Masuk ke Ruang Kerja Proyek
          </h2>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Gunakan akun Google Anda untuk mengakses database inventaris dan menghubungkan sumber data Google Sheets.
          </p>

          <button
            type="button"
            onClick={onSignIn}
            disabled={signingIn}
            className="mt-6 w-full inline-flex items-center justify-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-xs transition-colors disabled:opacity-50"
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
            </svg>
            <span>{signingIn ? 'Menghubungkan...' : 'Sign in with Google'}</span>
          </button>

          {error && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-lg text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <p className="mt-6 text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
            Setelah masuk, Anda dapat langsung menyinkronkan data dari tab Sumber Spreadsheet.
          </p>
        </div>
      </div>
    </div>
  );
}
